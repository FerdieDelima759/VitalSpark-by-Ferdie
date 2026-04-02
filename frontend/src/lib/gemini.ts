// Interface for image generation options
export interface ImageGenerationOptions {
    prompt: string;
    model?: string;
    numberOfImages?: number;
    aspectRatio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4";
    safetyFilterLevel?: "block_some" | "block_most" | "block_few" | "none";
    personGeneration?: "allow_all" | "allow_adult" | "dont_allow_adult" | "dont_allow";
    negativePrompt?: string;
    enhancePrompt?: boolean;
    outputMimeType?: "image/png" | "image/jpeg";
    imageSize?: "1K" | "2K";
}

// Interface for image generation response
export interface ImageGenerationResponse {
    success: boolean;
    images?: string[]; // Base64 encoded images or URLs
    error?: string;
}

const IMAGE_GEN_QUOTA_PAUSE_KEY = "vitalspark_image_quota_pause_until";
const IMAGE_GEN_QUOTA_PAUSE_MS = 12 * 60 * 60 * 1000;
const QUOTA_ERROR_PATTERN =
    /(resource_exhausted|quota|exceeded your current quota|429)/i;

type ErrorRecord = Record<string, unknown>;

function parseMaybeJson(value: unknown): unknown {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
    try {
        return JSON.parse(trimmed);
    } catch {
        return value;
    }
}

function asRecord(value: unknown): ErrorRecord | undefined {
    if (typeof value === "object" && value !== null) {
        return value as ErrorRecord;
    }
    return undefined;
}

function normalizeImageGenerationError(
    status: number | undefined,
    errorData: unknown,
): { message: string; isQuotaExceeded: boolean } {
    const queue: unknown[] = [errorData];
    const visited = new Set<unknown>();
    let message: string | undefined;
    let isQuotaExceeded = status === 429;

    while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined || current === null || visited.has(current)) {
            continue;
        }
        visited.add(current);

        const parsed = parseMaybeJson(current);
        if (parsed !== current && !visited.has(parsed)) {
            queue.push(parsed);
        }

        if (typeof parsed === "string") {
            const trimmed = parsed.trim();
            if (!message && trimmed.length > 0) {
                message = trimmed;
            }
            if (QUOTA_ERROR_PATTERN.test(trimmed)) {
                isQuotaExceeded = true;
            }
            continue;
        }

        const record = asRecord(parsed);
        if (!record) continue;

        const code = record.code;
        if (code === 429 || code === "429") {
            isQuotaExceeded = true;
        }

        const statusText =
            typeof record.status === "string"
                ? record.status
                : typeof record.code === "string"
                    ? record.code
                    : "";
        if (/RESOURCE_EXHAUSTED/i.test(statusText)) {
            isQuotaExceeded = true;
        }

        const rawMessage = record.message;
        if (typeof rawMessage === "string" && !message) {
            message = rawMessage;
        }

        if (record.error !== undefined) queue.push(record.error);
        if (rawMessage !== undefined) queue.push(rawMessage);

        const details = record.details;
        if (Array.isArray(details)) {
            for (const detail of details) {
                queue.push(detail);
            }
        }
    }

    return {
        message: message || (status ? `API request failed with status ${status}` : "Image generation failed"),
        isQuotaExceeded,
    };
}

function getImageQuotaPauseUntil(): number {
    if (typeof window === "undefined") return 0;
    try {
        const raw = window.localStorage.getItem(IMAGE_GEN_QUOTA_PAUSE_KEY);
        if (!raw) return 0;
        const until = Number(raw);
        if (!Number.isFinite(until) || until <= Date.now()) {
            window.localStorage.removeItem(IMAGE_GEN_QUOTA_PAUSE_KEY);
            return 0;
        }
        return until;
    } catch {
        return 0;
    }
}

function setImageQuotaPause(): number {
    const until = Date.now() + IMAGE_GEN_QUOTA_PAUSE_MS;
    if (typeof window === "undefined") return until;
    try {
        window.localStorage.setItem(IMAGE_GEN_QUOTA_PAUSE_KEY, String(until));
    } catch {
        // Ignore storage errors; caller still gets pause-until timestamp.
    }
    return until;
}

function formatPauseUntil(timestamp: number): string {
    try {
        return new Date(timestamp).toLocaleString();
    } catch {
        return new Date(timestamp).toISOString();
    }
}

export function isImageQuotaExceededError(errorMessage: string | undefined): boolean {
    if (!errorMessage) return false;
    return QUOTA_ERROR_PATTERN.test(errorMessage);
}

function normalizeModelId(model: string): string {
    return model.startsWith("models/") ? model.slice("models/".length) : model;
}

/**
 * Generate images through the server-side API route.
 *
 * This keeps credentials on the server and lets the route use Vertex auth
 * (ADC in local/dev or service-account credentials in deployment).
 * 
 * @param options - Image generation options including prompt and model settings
 * @returns Promise with generated images (base64 or URLs)
 */
export async function generateImage(
    options: ImageGenerationOptions
): Promise<ImageGenerationResponse> {
    const normalizedOptions: ImageGenerationOptions = {
        ...options,
        model: normalizeModelId(options.model || "imagen-4.0-generate-001"),
    };
    const quotaPauseUntil = getImageQuotaPauseUntil();

    if (quotaPauseUntil > Date.now()) {
        return {
            success: false,
            error: `Image generation paused due to quota limits until ${formatPauseUntil(quotaPauseUntil)}.`
        };
    }

    try {
        const response = await fetch("/api/generate-image", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(normalizedOptions),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const normalizedError = normalizeImageGenerationError(response.status, errorData);
            if (normalizedError.isQuotaExceeded) {
                const pauseUntil = setImageQuotaPause();
                return {
                    success: false,
                    error: `Image generation quota exceeded. Paused retries until ${formatPauseUntil(pauseUntil)}.`
                };
            }
            return {
                success: false,
                error: normalizedError.message
            };
        }

        const data = await response.json();
        if (!Array.isArray(data?.images) || data.images.length === 0) {
            return {
                success: false,
                error: "No images were generated in the API response"
            };
        }

        const images = data.images.filter((image: unknown): image is string => typeof image === "string");

        return {
            success: true,
            images
        };
    } catch (error: any) {
        console.error("Error generating image via /api/generate-image:", error);
        const normalizedError = normalizeImageGenerationError(undefined, error);
        if (normalizedError.isQuotaExceeded) {
            const pauseUntil = setImageQuotaPause();
            return {
                success: false,
                error: `Image generation quota exceeded. Paused retries until ${formatPauseUntil(pauseUntil)}.`
            };
        }
        return {
            success: false,
            error: normalizedError.message || "Unknown error occurred while generating image"
        };
    }
}

/**
 * Generate a single image with simplified parameters
 * 
 * @param prompt - Text prompt describing the image to generate
 * @param aspectRatio - Optional aspect ratio (default: "1:1")
 * @returns Promise with generated image URL or base64 string
 */
export async function generateSingleImage(
    prompt: string,
    aspectRatio: "1:1" | "9:16" | "16:9" | "4:3" | "3:4" = "1:1"
): Promise<{ success: boolean; image?: string; error?: string }> {
    const result = await generateImage({
        prompt,
        aspectRatio,
        numberOfImages: 1,
    });

    if (!result.success || !result.images || result.images.length === 0) {
        return {
            success: false,
            error: result.error || "Failed to generate image"
        };
    }

    return {
        success: true,
        image: result.images[0]
    };
}

/**
 * Build exercise image prompt based on gender
 * 
 * @param exerciseName - Name of the exercise
 * @param exerciseDescription - Description of the exercise
 * @param gender - User's gender ("female" or "male")
 * @returns Formatted prompt string for image generation
 */
export function buildExerciseImagePrompt(
    exerciseName: string,
    exerciseDescription: string,
    gender: "female" | "male"
): string {
    const cleanedDescription = exerciseDescription.trim().replace(/\.+$/, "");
    const baseStyle =
        "2D flat vector fitness illustration, non-photorealistic, clean geometric shapes, smooth shading, sharp outlines.";
    const framing =
        "Full body visible from head to shoes, centered composition, side profile when helpful for form clarity, pure seamless white background only.";
    const constraints =
        "No photo look, no real-person skin texture, no environment scene, no props other than a blue yoga mat, absolutely no text or characters anywhere (background, mat, clothing, or foreground), no icons, no logo, no watermark.";

    if (gender.toLowerCase() === "female") {
        return `${baseStyle} Subject: young athletic woman performing ${exerciseName}. Appearance: dark brown hair in a high ponytail, bright orange short-sleeve athletic shirt, navy blue leggings, grey running sneakers with white soles. Pose requirement: ${cleanedDescription}. She is on a blue yoga mat. ${framing} ${constraints}`;
    } else {
        return `${baseStyle} Subject: young athletic man performing ${exerciseName}. Appearance: short dark brown hair, bright orange short-sleeve athletic shirt, navy blue shorts, grey running sneakers with white soles. Pose requirement: ${cleanedDescription}. He is on a blue yoga mat. ${framing} ${constraints}`;
    }
}

/**
 * Generate exercise image using Imagen 4 model
 * 
 * @param exerciseName - Name of the exercise
 * @param exerciseDescription - Description of the exercise
 * @param gender - User's gender ("female" or "male")
 * @param timeoutMs - Timeout in milliseconds (default: 60000 = 60 seconds)
 * @returns Promise with generated image as base64 data URL
 */
export async function generateExerciseImage(
    exerciseName: string,
    exerciseDescription: string,
    gender: "female" | "male",
    timeoutMs: number = 60000
): Promise<{ success: boolean; image?: string; error?: string }> {
    const timeoutPromise = new Promise<{ success: boolean; image?: string; error?: string }>((resolve) => {
        setTimeout(() => {
            resolve({
                success: false,
                error: `Image generation timed out after ${timeoutMs / 1000} seconds`
            });
        }, timeoutMs);
    });

    const generatePromise = async (): Promise<{ success: boolean; image?: string; error?: string }> => {
        try {
            const prompt = buildExerciseImagePrompt(exerciseName, exerciseDescription, gender);
            console.log(`Generating image for: ${exerciseName} (model: imagen-4.0-generate-001)`);

            const result = await generateImage({
                prompt,
                model: "models/imagen-4.0-generate-001",
                numberOfImages: 1,
                aspectRatio: "4:3",
                personGeneration: "allow_adult",
                negativePrompt:
                    "text, letters, words, typography, captions, labels, logo, watermark, signature, symbols, numbers, signage, banner, poster, UI overlay",
                enhancePrompt: false,
                outputMimeType: "image/jpeg",
                imageSize: "1K",
            });

            if (!result.success || !result.images || result.images.length === 0) {
                return {
                    success: false,
                    error: result.error || "No image was generated in the response"
                };
            }

            console.log(`Image generated for: ${exerciseName}`);
            return {
                success: true,
                image: result.images[0]
            };
        } catch (error: any) {
            console.error("Error generating exercise image:", error);
            return {
                success: false,
                error: error?.message || "Unknown error occurred while generating exercise image"
            };
        }
    };

    return Promise.race([generatePromise(), timeoutPromise]);
}

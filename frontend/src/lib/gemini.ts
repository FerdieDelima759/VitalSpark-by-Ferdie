// Interface for image generation options
export interface ImageGenerationOptions {
    prompt: string;
    model?: string;
    numberOfImages?: number;
    sampleCount?: number;
    aspectRatio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4";
    safetyFilterLevel?:
        | "block_low_and_above"
        | "block_medium_and_above"
        | "block_only_high"
        | "block_none"
        | "block_some"
        | "block_most"
        | "block_few"
        | "none";
    safetySetting?: ImageGenerationOptions["safetyFilterLevel"];
    personGeneration?: "allow_all" | "allow_adult" | "dont_allow_adult" | "dont_allow";
    negativePrompt?: string;
    enhancePrompt?: boolean;
    outputMimeType?: "image/png" | "image/jpeg";
    outputCompressionQuality?: number;
    imageSize?: "1K" | "2K";
    sampleImageSize?: "1K" | "2K" | "1k" | "2k";
    addWatermark?: boolean;
    includeRaiReason?: boolean;
    language?: "auto";
    outputOptions?: {
        mimeType?: "image/png" | "image/jpeg";
        compressionQuality?: number;
    };
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

function normalizeSafetyFilterLevel(
    value: ImageGenerationOptions["safetyFilterLevel"] | undefined,
): "block_low_and_above" | "block_medium_and_above" | "block_only_high" | "block_none" | undefined {
    switch (value) {
        case "block_most":
        case "block_low_and_above":
            return "block_low_and_above";
        case "block_some":
        case "block_medium_and_above":
            return "block_medium_and_above";
        case "block_few":
        case "block_only_high":
            return "block_only_high";
        case "none":
        case "block_none":
            return "block_none";
        default:
            return undefined;
    }
}

function normalizeImageSize(
    value: ImageGenerationOptions["imageSize"] | ImageGenerationOptions["sampleImageSize"] | undefined,
): "1K" | "2K" | undefined {
    if (value === "1k" || value === "1K") return "1K";
    if (value === "2k" || value === "2K") return "2K";
    return undefined;
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
    const normalizedSafetyFilterLevel = normalizeSafetyFilterLevel(
        options.safetySetting || options.safetyFilterLevel,
    );
    const normalizedImageSize = normalizeImageSize(
        options.sampleImageSize || options.imageSize,
    );
    const normalizedOptions: ImageGenerationOptions = {
        ...options,
        model: normalizeModelId(options.model || "imagen-4.0-generate-001"),
        numberOfImages: options.numberOfImages || options.sampleCount,
        safetyFilterLevel: normalizedSafetyFilterLevel,
        imageSize: normalizedImageSize,
        outputMimeType: options.outputOptions?.mimeType || options.outputMimeType,
        outputCompressionQuality:
            options.outputOptions?.compressionQuality ?? options.outputCompressionQuality,
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
    const cleanName = exerciseName.trim();
    const cleanDescription = exerciseDescription.trim().replace(/\s+/g, " ");

    if (gender === "male") {
        return `A realistic vector-style illustration of a young athletic man performing ${cleanName}, ${cleanDescription} He has light skin and short dark brown hair, with a calm and neutral facial expression. He is wearing a bright orange athletic t-shirt, navy blue shorts, and grey sneakers with white rubber soles. He is centered on a medium blue yoga mat placed horizontally across the frame. The background is pure white, clean, and minimal. The composition uses a 4:3 aspect ratio, centered with balanced spacing and no cropping. Rendered in a realistic vector art style with clean, visible linework and smooth gradient shading.`;
    }

    return `A realistic vector-style illustration of a young athletic woman performing ${cleanName}, ${cleanDescription} She has light skin and long dark brown hair tied in a ponytail, with a calm and neutral facial expression. She is wearing a bright orange athletic t-shirt (No crop top), navy blue leggings, and grey sneakers with white rubber soles. She is centered on a medium blue yoga mat placed horizontally across the frame. The background is pure white, clean, and minimal. The composition uses a 4:3 aspect ratio, centered with balanced spacing and no cropping. Rendered in a realistic vector art style with clean, visible linework and smooth gradient shading.`;
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
                aspectRatio: "4:3",
                sampleCount: 1,
                sampleImageSize: "1K",
                personGeneration: "allow_adult",
                safetySetting: "block_few",
                addWatermark: true,
                includeRaiReason: true,
                language: "auto",
                outputOptions: {
                    mimeType: "image/jpeg",
                    compressionQuality: 95,
                },
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

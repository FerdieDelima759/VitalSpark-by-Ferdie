import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";

// Read API key from Next.js public env (safe for client distribution per user's request).
// Note: For production secrecy, prefer server-side API route or proxy.
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.warn(
        "Missing NEXT_PUBLIC_GEMINI_API_KEY. Set it in your .env.local file to use Gemini services."
    );
}

// Initialize Gemini client
export const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Check if Gemini service is available and working
export async function isGeminiAvailable(): Promise<boolean> {
    if (!genAI) {
        console.warn("Gemini client is not initialized. Please set NEXT_PUBLIC_GEMINI_API_KEY in .env.local");
        return false;
    }
    try {
        // Test with a simple API call by getting a model and making a minimal request
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("test");
        return result !== null;
    } catch (error) {
        console.error("Gemini API test failed:", error);
        return false;
    }
}

// Test Gemini connection with a simple generation
export async function testGeminiConnection(): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!genAI) {
        return {
            success: false,
            error: "Gemini client is not initialized. Please set NEXT_PUBLIC_GEMINI_API_KEY in .env.local"
        };
    }
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Say 'Hello, Gemini connection successful!' and nothing else.");
        const response = await result.response;
        const text = response.text();
        return {
            success: true,
            message: text.trim()
        };
    } catch (error: any) {
        return {
            success: false,
            error: error?.message || "Unknown error occurred"
        };
    }
}

// Interface for image generation options
export interface ImageGenerationOptions {
    prompt: string;
    model?: "gemini-2.5-flash-image" | "gemini-3-pro-image-preview"; // Nano Banana models
    numberOfImages?: number;
    aspectRatio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4";
    safetyFilterLevel?: "block_some" | "block_most" | "block_few" | "none";
    personGeneration?: "allow_all" | "dont_allow_adult" | "dont_allow";
}

// Interface for image generation response
export interface ImageGenerationResponse {
    success: boolean;
    images?: string[]; // Base64 encoded images or URLs
    error?: string;
}

/**
 * Generate images using Gemini/Imagen API
 * 
 * Note: Google's Imagen API for image generation typically requires server-side implementation
 * through Vertex AI. This function attempts client-side access, but for production use,
 * consider creating a Next.js API route at /api/generate-image that proxies the request.
 * 
 * @param options - Image generation options including prompt and model settings
 * @returns Promise with generated images (base64 or URLs)
 */
export async function generateImage(
    options: ImageGenerationOptions
): Promise<ImageGenerationResponse> {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
        return {
            success: false,
            error: "Gemini API key is not initialized. Please set NEXT_PUBLIC_GEMINI_API_KEY in .env.local"
        };
    }

    try {
        // Try using Next.js API route first (recommended for production)
        // If the route doesn't exist, fall back to direct client-side call
        const useApiRoute = true; // Set to false to use direct client-side call

        if (useApiRoute) {
            try {
                const response = await fetch("/api/generate-image", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(options),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    return {
                        success: false,
                        error: errorData.error || `API request failed with status ${response.status}`
                    };
                }

                const data = await response.json();
                return {
                    success: true,
                    images: data.images || []
                };
            } catch (apiRouteError) {
                console.warn("API route not available, falling back to direct call:", apiRouteError);
                // Fall through to direct client-side call
            }
        }

        // Direct client-side call (may not work for all Imagen models)
        // Note: Imagen API typically requires Vertex AI authentication
        const model = options.model || "imagen-3.0-generate-001";
        const numberOfImages = options.numberOfImages || 1;
        const aspectRatio = options.aspectRatio || "1:1";

        // Attempt direct API call
        // This may require the API key to have Imagen access enabled
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImages?key=${apiKey}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt: options.prompt,
                    number_of_images: numberOfImages,
                    aspect_ratio: aspectRatio,
                    safety_filter_level: options.safetyFilterLevel || "block_some",
                    person_generation: options.personGeneration || "allow_all",
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                error: errorData.error?.message || `API request failed with status ${response.status}. Consider creating a server-side API route for better security and compatibility.`
            };
        }

        const data = await response.json();

        // Extract images from response
        // The response structure may vary, so we handle multiple formats
        let images: string[] = [];

        if (data.images && Array.isArray(data.images)) {
            images = data.images.map((img: any) => {
                if (typeof img === "string") return img;
                if (img.base64) return `data:image/png;base64,${img.base64}`;
                if (img.url) return img.url;
                if (img.bytesBase64Encoded) return `data:image/png;base64,${img.bytesBase64Encoded}`;
                return String(img);
            });
        } else if (data.generatedImages && Array.isArray(data.generatedImages)) {
            images = data.generatedImages.map((img: any) => {
                if (typeof img === "string") return img;
                if (img.base64) return `data:image/png;base64,${img.base64}`;
                if (img.url) return img.url;
                if (img.bytesBase64Encoded) return `data:image/png;base64,${img.bytesBase64Encoded}`;
                return String(img);
            });
        } else if (data.image && typeof data.image === "string") {
            images = [data.image];
        } else if (data.base64) {
            images = [`data:image/png;base64,${data.base64}`];
        }

        if (images.length === 0) {
            return {
                success: false,
                error: "No images were generated in the response"
            };
        }

        return {
            success: true,
            images: images
        };
    } catch (error: any) {
        console.error("Error generating image with Gemini:", error);
        return {
            success: false,
            error: error?.message || "Unknown error occurred while generating image"
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
    if (gender.toLowerCase() === "female") {
        return `Style & Medium: A digital illustration in a smooth and clean vector art style, no visible outlines or seam lines on the shirt and leggings; form is defined solely by smooth gradient shading.
Subject: A young athletic woman with light skin and long dark brown hair tied back in a ponytail. She has a calm, neutral facial expression.
Attire: She is wearing a bright orange athletic t-shirt, navy blue leggings, and grey sneakers with white rubber soles.
Action: She is performing "${exerciseName}" exercise. ${exerciseDescription}
Environment: She is centered on a medium blue yoga mat against a pure white background.
Composition: Square frame (1:1 aspect ratio). Her full body is fully contained within the image borders, with no cropping.`;
    } else {
        return `Style & Medium: A digital illustration in a smooth and clean vector art style, no visible outlines or seam lines on the shirt and shorts; form is defined solely by smooth gradient shading.
Subject: A young athletic man with light skin and short dark brown hair. He has a calm, neutral facial expression.
Attire: He is wearing a bright orange athletic t-shirt, navy blue shorts, and grey sneakers with white rubber soles.
Action: He is performing "${exerciseName}" exercise. ${exerciseDescription}
Environment: He is centered on a medium blue yoga mat against a pure white background.
Composition: Square frame (1:1 aspect ratio). His full body is fully contained within the image borders, with no cropping.`;
    }
}

/**
 * Generate exercise image using Gemini 2.5 Flash Image model
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
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
        return {
            success: false,
            error: "Gemini API key is not initialized. Please set NEXT_PUBLIC_GEMINI_API_KEY in .env.local"
        };
    }

    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
        setTimeout(() => {
            resolve({
                success: false,
                error: `Image generation timed out after ${timeoutMs / 1000} seconds`
            });
        }, timeoutMs);
    });

    // The actual generation logic
    const generatePromise = async (): Promise<{ success: boolean; image?: string; error?: string }> => {
        try {
            const ai = new GoogleGenAI({
                apiKey: apiKey,
            });

            const prompt = buildExerciseImagePrompt(exerciseName, exerciseDescription, gender);

            const config = {
                responseModalities: ['IMAGE', 'TEXT'],
                imageConfig: {
                    aspectRatio: '1:1',
                },
            };

            const model = 'gemini-2.5-flash-image';
            const contents = [
                {
                    role: 'user',
                    parts: [
                        {
                            text: prompt,
                        },
                    ],
                },
            ];

            console.log(`🎨 Generating image for: ${exerciseName}`);

            const response = await ai.models.generateContentStream({
                model,
                config,
                contents,
            });

            // Process the stream to extract the image
            for await (const chunk of response) {
                if (!chunk.candidates || !chunk.candidates[0]?.content?.parts) {
                    continue;
                }

                const part = chunk.candidates[0].content.parts[0];

                if (part.inlineData) {
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    const base64Data = part.inlineData.data || '';

                    if (base64Data) {
                        console.log(`✅ Image generated for: ${exerciseName}`);
                        return {
                            success: true,
                            image: `data:${mimeType};base64,${base64Data}`
                        };
                    }
                }
            }

            return {
                success: false,
                error: "No image was generated in the response"
            };
        } catch (error: any) {
            console.error("Error generating exercise image:", error);
            return {
                success: false,
                error: error?.message || "Unknown error occurred while generating exercise image"
            };
        }
    };

    // Race between generation and timeout
    return Promise.race([generatePromise(), timeoutPromise]);
}

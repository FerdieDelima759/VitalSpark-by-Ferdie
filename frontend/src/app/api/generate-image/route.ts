import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { ImageGenerationOptions } from "@/lib/gemini";

/**
 * Next.js API route for server-side image generation using Google's Nano Banana (Gemini 2.5 Flash Image)
 * 
 * This route uses the official @google/genai SDK with generateContent for image generation.
 * 
 * POST /api/generate-image
 * Body: ImageGenerationOptions
 */
export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: "Gemini API key is not configured. Please set GEMINI_API_KEY in your environment variables." },
                { status: 500 }
            );
        }

        const options: ImageGenerationOptions = await request.json();

        if (!options.prompt) {
            return NextResponse.json(
                { error: "Prompt is required" },
                { status: 400 }
            );
        }

        console.log("🎨 Generating image with Nano Banana (gemini-2.5-flash-image):", options.prompt.substring(0, 100) + "...");

        // Initialize the Google GenAI client
        const ai = new GoogleGenAI({ apiKey });

        const model = options.model || "gemini-2.5-flash-image";
        const aspectRatio = options.aspectRatio || "1:1";

        const config = {
            responseModalities: ["IMAGE", "TEXT"],
            imageConfig: {
                aspectRatio,
            },
        };

        const contents = [
            {
                role: "user",
                parts: [{ text: options.prompt }],
            },
        ];

        // Generate image using Nano Banana (Gemini 2.5 Flash Image)
        const response = await ai.models.generateContent({
            model,
            config,
            contents,
        });

        // Extract image from response
        const images: string[] = [];

        if (response?.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData?.data) {
                    const mimeType = part.inlineData.mimeType || "image/png";
                    images.push(`data:${mimeType};base64,${part.inlineData.data}`);
                }
            }
        }

        if (images.length === 0) {
            console.error("No images generated from Nano Banana API");
            return NextResponse.json(
                { error: "No images were generated. Please try again." },
                { status: 500 }
            );
        }

        console.log(`✅ Generated ${images.length} image(s) successfully with Nano Banana`);
        return NextResponse.json({ images });

    } catch (error: any) {
        console.error("Error in generate-image API route:", error);

        // Handle specific Google API errors
        const errorMessage = error?.message || "Unknown error occurred while generating image";

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}

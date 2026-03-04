import OpenAI from "openai";

// Read API key from Expo public env (safe for client distribution per user's request).
// Note: For production secrecy, prefer server-side proxy like a Supabase Edge Function.
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.warn(
        "Missing EXPO_PUBLIC_OPENAI_API_KEY. Set it in your .env.local file to use OpenAI services."
    );
}

// Initialize OpenAI client
export const openai = OPENAI_API_KEY ? new OpenAI({
    apiKey: OPENAI_API_KEY,
    dangerouslyAllowBrowser: true, // Required for Expo/React Native web compatibility
}) : null;

// Check if OpenAI service is available and working
export async function isOpenAIAvailable(): Promise<boolean> {
    if (!openai) {
        console.warn("OpenAI client is not initialized. Please set EXPO_PUBLIC_OPENAI_API_KEY in .env.local");
        return false;
    }
    try {
        // Test with a simple, lightweight API call
        await openai.models.list();
        return true;
    } catch (error) {
        console.error("OpenAI API test failed:", error);
        return false;
    }
}

// Test OpenAI connection with a simple chat completion
export async function testOpenAIConnection(): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!openai) {
        return {
            success: false,
            error: "OpenAI client is not initialized. Please set EXPO_PUBLIC_OPENAI_API_KEY in .env.local"
        };
    }
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "user",
                    content: "Say 'Hello, OpenAI connection successful!' and nothing else."
                }
            ],
            max_tokens: 20,
        });
        const message = response.choices[0]?.message?.content || "No response";
        return {
            success: true,
            message: message.trim()
        };
    } catch (error: any) {
        return {
            success: false,
            error: error?.message || "Unknown error occurred"
        };
    }
}

// Generate a simple workout sentence using OpenAI
export async function GenerateWorkout(userProfile?: {
    fitness_goal?: string;
    fitness_level?: string;
    workout_duration_minutes?: number;
    workout_location?: string;
    equipment_list?: string[];
}): Promise<{ success: boolean; workout?: string; error?: string }> {
    if (!openai) {
        return {
            success: false,
            error: "OpenAI client is not initialized. Please set EXPO_PUBLIC_OPENAI_API_KEY in .env.local"
        };
    }
    try {
        // Build a simple prompt based on user profile
        let prompt = "Generate a simple, motivational one-sentence workout suggestion";

        if (userProfile) {
            const parts: string[] = [];
            if (userProfile.fitness_goal) {
                parts.push(`goal: ${userProfile.fitness_goal}`);
            }
            if (userProfile.fitness_level) {
                parts.push(`level: ${userProfile.fitness_level}`);
            }
            if (userProfile.workout_duration_minutes) {
                parts.push(`duration: ${userProfile.workout_duration_minutes} minutes`);
            }
            if (userProfile.workout_location) {
                parts.push(`location: ${userProfile.workout_location}`);
            }
            if (parts.length > 0) {
                prompt += ` for someone with ${parts.join(", ")}`;
            }
        }

        prompt += ". Keep it short, encouraging, and actionable (one sentence only).";

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Using gpt-4o-mini as a stable alternate model
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 100,
            temperature: 0.7,
        });

        const workout = response.choices[0]?.message?.content?.trim() || "No workout generated";
        return {
            success: true,
            workout: workout
        };
    } catch (error: any) {
        return {
            success: false,
            error: error?.message || "Unknown error occurred while generating workout"
        };
    }
}


import { NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * Independent prompt for rest-day encouragement.
 * Returns a short, random message about resting and not pushing too hard.
 * POST /api/rest-day-message
 */
export async function POST() {
  try {
    const apiKey =
      process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OpenAI API key is not configured. Set OPENAI_API_KEY or NEXT_PUBLIC_OPENAI_API_KEY.",
        },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a supportive fitness coach. Generate a single, short (1-2 sentences) rest-day message. 
Theme: encourage the user to rest and recover, remind them that rest is part of progress, and that pushing too hard can lead to injury or burnout. 
Tone: warm, reassuring, and brief. Do not include quotes or labels—output only the message text. 
Vary the message each time (e.g. mention sleep, muscles repairing, mental recovery, or listening to your body).`,
        },
        {
          role: "user",
          content:
            "Generate one short rest-day encouragement message for someone who just saw it's their rest day.",
        },
      ],
      max_tokens: 120,
      temperature: 0.9,
    });

    const message =
      response.choices[0]?.message?.content?.trim() ||
      "Rest is part of the plan. Let your body recover so you can come back stronger.";

    return NextResponse.json({ message });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Rest-day message API error:", err);
    return NextResponse.json(
      {
        error: err?.message || "Failed to generate rest-day message.",
      },
      { status: 500 }
    );
  }
}

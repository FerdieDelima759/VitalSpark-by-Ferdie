import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

interface TtsRequestBody {
  text?: string;
  gender?: string;
  speakingRate?: number;
  pitch?: number;
  instructions?: string;
  responseFormat?: "mp3" | "wav" | "opus" | "aac" | "flac" | "pcm";
}

function normalizeGender(value: string | undefined): "male" | "female" {
  const normalized = (value || "").toLowerCase().trim();
  return normalized === "female" || normalized === "f" ? "female" : "male";
}

export async function POST(req: NextRequest) {
  try {
    const apiKey =
      process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OpenAI API key is not configured. Set OPENAI_API_KEY or NEXT_PUBLIC_OPENAI_API_KEY.",
        },
        { status: 500 },
      );
    }

    const body = (await req.json()) as TtsRequestBody;
    const text = body.text?.trim();
    if (!text) {
      return NextResponse.json(
        { error: "Text is required for TTS." },
        { status: 400 },
      );
    }

    const normalizedGender = normalizeGender(body.gender);
    const maleVoice = "cedar";
    const femaleVoice = "marin";
    const selectedVoice = normalizedGender === "female" ? femaleVoice : maleVoice;

    const openai = new OpenAI({ apiKey });
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: selectedVoice,
      input: text,
      instructions:
        body.instructions ||
        "Speak smoothly at normal speed (1.00x) with short pauses and no trailing silence.",
      response_format: body.responseFormat || "wav",
    });

    const audioArrayBuffer = await speech.arrayBuffer();
    const audioContent = Buffer.from(audioArrayBuffer).toString("base64");

    return NextResponse.json({
      audioContent,
      provider: "openai",
      model: "gpt-4o-mini-tts",
      voiceName: selectedVoice,
      format: body.responseFormat || "wav",
    });
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number };
    return NextResponse.json(
      {
        error: err?.message || "Unexpected error while generating TTS audio.",
      },
      { status: err?.status || 500 },
    );
  }
}

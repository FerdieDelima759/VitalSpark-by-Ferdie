import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const EXERCISE_DESCRIPTION_PROMPT_ID =
  "pmpt_69d7d7aad26c8190ac376c8997bcf4c20f277dac9c469df0";
const EXERCISE_DESCRIPTION_PROMPT_VERSION = "2";

type ExerciseDescriptionPromptVariables = {
  exercise?: string;
  gender?: string;
};

/**
 * POST /api/generate-exercise-description
 * Body: { variables: { exercise: string, gender?: string } }
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey =
      process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OpenAI API key is not configured. Please set OPENAI_API_KEY in your environment variables.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      variables?: ExerciseDescriptionPromptVariables;
    };

    const exerciseName = body?.variables?.exercise?.trim();
    if (!exerciseName) {
      return NextResponse.json(
        { error: "Missing required variable: exercise." },
        { status: 400 },
      );
    }

    const openai = new OpenAI({ apiKey });
    const openaiResponses = openai.responses as {
      create: (input: Record<string, unknown>) => Promise<unknown>;
    };

    const response = await openaiResponses.create({
      prompt: {
        id: EXERCISE_DESCRIPTION_PROMPT_ID,
        version: EXERCISE_DESCRIPTION_PROMPT_VERSION,
        variables: {
          exercise: exerciseName,
          gender: body.variables?.gender?.trim() || "not specified",
        },
      },
      input: [],
    });

    const responseRecord = response as {
      output_text?: string;
      text?: { content?: string } | string;
    };

    let responseText: string;
    if (responseRecord.output_text) {
      responseText = responseRecord.output_text;
    } else if (
      responseRecord.text &&
      typeof responseRecord.text === "object" &&
      "content" in responseRecord.text &&
      typeof responseRecord.text.content === "string"
    ) {
      responseText = responseRecord.text.content;
    } else if (responseRecord.text) {
      responseText =
        typeof responseRecord.text === "string"
          ? responseRecord.text
          : JSON.stringify(responseRecord.text);
    } else if (typeof response === "string") {
      responseText = response;
    } else if (typeof response === "object") {
      responseText = JSON.stringify(response, null, 2);
    } else {
      responseText = String(response);
    }

    const description = responseText.trim();
    if (!description) {
      return NextResponse.json(
        { error: "Description prompt returned an empty response." },
        { status: 500 },
      );
    }

    return NextResponse.json({ response: description });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

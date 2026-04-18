import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const DAY_WORKOUT_RPE_PROMPT_ID =
  "pmpt_696e02b6b42481948ee34e01a195d335063de4e3479a8980";
const DAY_WORKOUT_RPE_PROMPT_VERSION = "6";

type DayWorkoutRpePromptVariables = {
  gender?: string;
  goal?: string;
  location?: string;
  equipments?: string;
  level?: string;
  schedule?: string;
  age?: string;
  duration?: string;
  rpe?: string;
  day_name: string;
  plan_name: string;
  day_focus: string;
  week_number?: string;
  remaining_days?: string;
};

/**
 * POST /api/generate-day-workout-rpe
 * Body: { variables: DayWorkoutRpePromptVariables }
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
      variables?: DayWorkoutRpePromptVariables;
    };

    if (!body?.variables?.day_name || !body?.variables?.plan_name) {
      return NextResponse.json(
        { error: "Missing required variables for adaptive day generation." },
        { status: 400 },
      );
    }

    const openai = new OpenAI({ apiKey });

    const openaiResponses = openai.responses as {
      create: (input: Record<string, unknown>) => Promise<unknown>;
    };

    const response = await openaiResponses.create({
      prompt: {
        id: DAY_WORKOUT_RPE_PROMPT_ID,
        version: DAY_WORKOUT_RPE_PROMPT_VERSION,
        variables: {
          gender: body.variables.gender ?? "example gender",
          goal: body.variables.goal ?? "example goal",
          location: body.variables.location ?? "example location",
          equipments: body.variables.equipments ?? "example equipments",
          level: body.variables.level ?? "example level",
          age: body.variables.age ?? "example age",
          duration: body.variables.duration ?? "example duration",
          rpe: body.variables.rpe ?? "example rpe",
          schedule: body.variables.schedule ?? "example schedule",
          day_name: body.variables.day_name ?? "example day_name",
          plan_name: body.variables.plan_name ?? "example plan_name",
          day_focus: body.variables.day_focus ?? "example day_focus",
          week_number: body.variables.week_number ?? "example week_number",
          remaining_days:
            body.variables.remaining_days ?? "example remaining_days",
        },
      },
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

    try {
      const parsedJSON = JSON.parse(responseText);
      return NextResponse.json({ response: parsedJSON });
    } catch {
      if (typeof response === "object" && response !== null) {
        return NextResponse.json({ response });
      }
      return NextResponse.json(
        { error: "Failed to parse workout response as JSON" },
        { status: 500 },
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

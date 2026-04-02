import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const DAY_WORKOUT_PROMPT_ID = "pmpt_696b4c297ebc8193ab67088cd5e034c10a70cda92773d275";
const DAY_WORKOUT_PROMPT_VERSION = "16";

type DayWorkoutPromptVariables = {
  gender?: string;
  goal?: string;
  location?: string;
  equipments?: string;
  level?: string;
  schedule?: string;
  age?: string;
  duration?: string;
  day_name: string;
  plan_name: string;
  day_focus: string;
  plan_duration?: string;
  week_number?: string;
};

/**
 * POST /api/generate-day-workout
 * Body: { variables: DayWorkoutPromptVariables }
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
      variables?: DayWorkoutPromptVariables;
    };

    if (!body?.variables?.day_name || !body?.variables?.plan_name) {
      return NextResponse.json(
        { error: "Missing required variables for day workout generation." },
        { status: 400 },
      );
    }

    const openai = new OpenAI({ apiKey });

    const response = await (openai as any).responses.create({
      prompt: {
        id: DAY_WORKOUT_PROMPT_ID,
        version: DAY_WORKOUT_PROMPT_VERSION,
        variables: {
          gender: body.variables.gender ?? "example gender",
          goal: body.variables.goal ?? "example goal",
          location: body.variables.location ?? "example location",
          equipments: body.variables.equipments ?? "example equipments",
          level: body.variables.level ?? "example level",
          age: body.variables.age ?? "example age",
          duration: body.variables.duration ?? "example duration",
          schedule: body.variables.schedule ?? "example schedule",
          day_name: body.variables.day_name ?? "example day_name",
          plan_name: body.variables.plan_name ?? "example plan_name",
          day_focus: body.variables.day_focus ?? "example day_focus",
        },
      },
    });

    let responseText: string;
    if (response?.output_text) {
      responseText = response.output_text;
    } else if (response?.text?.content) {
      responseText = response.text.content;
    } else if (response?.text) {
      responseText =
        typeof response.text === "string"
          ? response.text
          : JSON.stringify(response.text);
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unknown error occurred" },
      { status: 500 },
    );
  }
}

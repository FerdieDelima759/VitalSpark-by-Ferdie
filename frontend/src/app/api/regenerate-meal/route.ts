import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const MEAL_REGEN_PROMPT_ID = "pmpt_69cdeb9f95f081968ae6369d64bf560000ab810b52782ed8";
const MEAL_REGEN_PROMPT_VERSION = "4";

type MealType = "breakfast" | "lunch" | "dinner" | "snacks";

type MealRegenPromptVariables = {
  meal_type: string;
  gender?: string;
  goal?: string;
  dietary_preference?: string;
  allergies?: string;
  daily_budget?: string;
  current_cost?: string;
  original_meal_json?: string;
};

type RegeneratedIngredient = {
  measurement: string;
  item_name: string;
  price: string;
};

type RegeneratedMeal = {
  meal_name: string;
  best_time_to_eat: string;
  estimated_meal_cost: string;
  cooking_instructions: string[];
  ingredients: RegeneratedIngredient[];
};

const toSafeString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
};

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const extractResponseText = (response: unknown): string => {
  const record = toRecord(response);
  if (!record) return String(response ?? "");

  const outputText = record.output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText;
  }

  const text = record.text;
  if (typeof text === "string" && text.trim()) {
    return text;
  }
  const textRecord = toRecord(text);
  if (textRecord && typeof textRecord.content === "string") {
    return textRecord.content;
  }

  return JSON.stringify(response);
};

const parseJsonFromText = (text: string): unknown | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through and try common wrappers (e.g. ```json ... ```).
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch {
      // continue
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const maybeJson = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(maybeJson);
    } catch {
      return null;
    }
  }

  return null;
};

const normalizeMealType = (value: string): MealType => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "breakfast") return "breakfast";
  if (normalized === "lunch") return "lunch";
  if (normalized === "dinner") return "dinner";
  return "snacks";
};

const pickMealCandidate = (
  parsed: unknown,
  mealType: MealType,
): Record<string, unknown> | null => {
  const parsedRecord = toRecord(parsed);
  if (!parsedRecord) return null;

  if (
    typeof parsedRecord.meal_name === "string" ||
    typeof parsedRecord.best_time_to_eat === "string" ||
    typeof parsedRecord.best_time === "string"
  ) {
    return parsedRecord;
  }

  const commonContainers = [
    parsedRecord.meal,
    parsedRecord.regenerated_meal,
    parsedRecord.updated_meal,
    parsedRecord.result,
    parsedRecord.response,
  ];

  for (const container of commonContainers) {
    const record = toRecord(container);
    if (!record) continue;
    if (
      typeof record.meal_name === "string" ||
      typeof record.best_time_to_eat === "string" ||
      typeof record.best_time === "string"
    ) {
      return record;
    }
  }

  const keyedDirect = toRecord(parsedRecord[mealType]);
  if (keyedDirect) return keyedDirect;

  const mealsContainer = toRecord(parsedRecord.meals);
  if (mealsContainer) {
    const keyedMeal = toRecord(mealsContainer[mealType]);
    if (keyedMeal) return keyedMeal;
  }

  return null;
};

const normalizeIngredients = (value: unknown): RegeneratedIngredient[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          measurement: "-",
          item_name: entry.trim(),
          price: "-",
        };
      }
      const record = toRecord(entry);
      if (!record) return null;

      const itemName = toSafeString(
        record.item_name ?? record.item ?? record.name,
        "",
      );
      const measurement = toSafeString(
        record.measurement ?? record.quantity ?? record.qty,
        "-",
      );
      const price = toSafeString(record.price ?? record.cost, "-");

      if (!itemName) return null;
      return {
        measurement,
        item_name: itemName,
        price,
      };
    })
    .filter((entry): entry is RegeneratedIngredient => Boolean(entry));
};

const normalizeRegeneratedMeal = (
  candidate: Record<string, unknown>,
): RegeneratedMeal => {
  const mealName = toSafeString(candidate.meal_name, "Unnamed Meal");
  const bestTimeToEat = toSafeString(
    candidate.best_time_to_eat ?? candidate.best_time,
    "Time not set",
  );
  const estimatedMealCost = toSafeString(
    candidate.estimated_meal_cost ??
    candidate.estimated_cost ??
    candidate.current_cost ??
    candidate.cost,
    "-",
  );

  const instructionsRaw = Array.isArray(candidate.cooking_instructions)
    ? candidate.cooking_instructions
    : Array.isArray(candidate.instructions)
      ? candidate.instructions
      : [];
  const cookingInstructions = instructionsRaw
    .map((instruction) => toSafeString(instruction, ""))
    .filter((instruction) => instruction.length > 0);

  return {
    meal_name: mealName,
    best_time_to_eat: bestTimeToEat,
    estimated_meal_cost: estimatedMealCost,
    cooking_instructions: cookingInstructions,
    ingredients: normalizeIngredients(candidate.ingredients),
  };
};

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
      variables?: MealRegenPromptVariables;
    };
    const variables = body?.variables;

    if (!variables?.meal_type) {
      return NextResponse.json(
        { error: "Missing required variable: meal_type." },
        { status: 400 },
      );
    }

    const openai = new OpenAI({ apiKey });
    const openaiResponses = openai.responses as {
      create: (input: Record<string, unknown>) => Promise<unknown>;
    };

    const response = await openaiResponses.create({
      prompt: {
        id: MEAL_REGEN_PROMPT_ID,
        version: MEAL_REGEN_PROMPT_VERSION,
        variables: {
          meal_type: variables.meal_type ?? "example meal_type",
          gender: variables.gender ?? "example gender",
          goal: variables.goal ?? "example goal",
          dietary_preference:
            variables.dietary_preference ?? "example dietary_preference",
          allergies: variables.allergies ?? "example allergies",
          daily_budget: variables.daily_budget ?? "example daily_budget",
          current_cost: variables.current_cost ?? "example current_cost",
          original_meal_json:
            variables.original_meal_json ?? "example original_meal_json",
        },
      },
    });

    const responseText = extractResponseText(response);
    const parsed = parseJsonFromText(responseText);
    const mealType = normalizeMealType(variables.meal_type);
    const candidate = pickMealCandidate(parsed, mealType);

    if (!candidate) {
      return NextResponse.json(
        {
          error:
            "Failed to extract regenerated meal JSON from prompt response. Check prompt output format.",
          raw_response: responseText,
        },
        { status: 500 },
      );
    }

    const meal = normalizeRegeneratedMeal(candidate);
    return NextResponse.json({ meal });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

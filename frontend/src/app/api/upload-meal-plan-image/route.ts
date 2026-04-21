// cspell:ignore supabase
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const MEAL_IMAGE_BUCKET = "workouts";
const MEAL_IMAGE_FOLDER = "meals/plans";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const buildPublicUrl = (storagePath: string): string =>
  `${SUPABASE_URL}/storage/v1/object/public/${MEAL_IMAGE_BUCKET}/${storagePath}`;

const imageToBuffer = async (image: string): Promise<Buffer> => {
  if (image.startsWith("data:image")) {
    const base64Data = image.split(",")[1] || "";
    return Buffer.from(base64Data, "base64");
  }

  if (image.startsWith("http://") || image.startsWith("https://")) {
    const response = await fetch(image);
    if (!response.ok) {
      throw new Error("Failed to fetch generated meal image.");
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  return Buffer.from(image, "base64");
};

const listExistingMealImageNumbers = async (
  supabaseAdmin: SupabaseClient,
): Promise<number[]> => {
  const { data, error } = await supabaseAdmin.storage
    .from(MEAL_IMAGE_BUCKET)
    .list(MEAL_IMAGE_FOLDER, { limit: 1000, offset: 0 });

  if (error) {
    throw new Error(error.message || "Failed to list existing meal images.");
  }

  return (data ?? [])
    .map((item) => item.name)
    .filter((name) => /^\d+\.png$/i.test(name))
    .map((name) => parseInt(name.replace(/\.png$/i, ""), 10))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
};

export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json(
      {
        error:
          "Supabase storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as {
      image?: string;
      food?: string;
      prompt?: string;
    };

    if (!body.image || typeof body.image !== "string") {
      return NextResponse.json(
        { error: "Meal image payload is required." },
        { status: 400 },
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const imageBuffer = await imageToBuffer(body.image);
    const existingNumbers = await listExistingMealImageNumbers(supabaseAdmin);
    let nextNumber =
      existingNumbers.length > 0
        ? existingNumbers[existingNumbers.length - 1] + 1
        : 1;

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const fileName = `${nextNumber}.png`;
      const storagePath = `${MEAL_IMAGE_FOLDER}/${fileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(MEAL_IMAGE_BUCKET)
        .upload(storagePath, imageBuffer, {
          contentType: "image/png",
          upsert: false,
        });

      if (!uploadError) {
        return NextResponse.json({
          success: true,
          url: buildPublicUrl(storagePath),
          fileName,
          food: body.food ?? null,
          prompt: body.prompt ?? null,
        });
      }

      if (!/exists|duplicate|already/i.test(uploadError.message)) {
        return NextResponse.json(
          { error: uploadError.message || "Failed to upload meal image." },
          { status: 500 },
        );
      }

      nextNumber += 1;
    }

    return NextResponse.json(
      { error: "Failed to allocate a unique meal image filename." },
      { status: 500 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload meal image.",
      },
      { status: 500 },
    );
  }
}

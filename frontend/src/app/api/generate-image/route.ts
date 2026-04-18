import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenAI,
  ImagePromptLanguage,
  PersonGeneration,
  SafetyFilterLevel,
} from "@google/genai";
import { existsSync } from "node:fs";
import { ImageGenerationOptions } from "@/lib/gemini";

export const runtime = "nodejs";

/**
 * Next.js API route for server-side image generation using Gemini/Imagen models.
 *
 * POST /api/generate-image
 * Body: ImageGenerationOptions
 */
const PERSON_GENERATION_MAP: Record<
  NonNullable<ImageGenerationOptions["personGeneration"]>,
  PersonGeneration
> = {
  allow_all: PersonGeneration.ALLOW_ALL,
  allow_adult: PersonGeneration.ALLOW_ADULT,
  dont_allow_adult: PersonGeneration.DONT_ALLOW,
  dont_allow: PersonGeneration.DONT_ALLOW,
};

const SAFETY_FILTER_LEVEL_MAP: Record<
  NonNullable<ImageGenerationOptions["safetyFilterLevel"]>,
  SafetyFilterLevel
> = {
  block_low_and_above: SafetyFilterLevel.BLOCK_LOW_AND_ABOVE,
  block_medium_and_above: SafetyFilterLevel.BLOCK_MEDIUM_AND_ABOVE,
  block_only_high: SafetyFilterLevel.BLOCK_ONLY_HIGH,
  block_none: SafetyFilterLevel.BLOCK_NONE,
  block_some: SafetyFilterLevel.BLOCK_LOW_AND_ABOVE,
  block_most: SafetyFilterLevel.BLOCK_MEDIUM_AND_ABOVE,
  block_few: SafetyFilterLevel.BLOCK_ONLY_HIGH,
  none: SafetyFilterLevel.BLOCK_NONE,
};

const IMAGE_PROMPT_LANGUAGE_MAP: Record<
  NonNullable<ImageGenerationOptions["language"]>,
  ImagePromptLanguage
> = {
  auto: ImagePromptLanguage.auto,
};

function normalizeModelId(model: string): string {
  return model.startsWith("models/") ? model.slice("models/".length) : model;
}

type ErrorRecord = Record<string, unknown>;
type JsonRecord = Record<string, unknown>;

function sanitizeCredentialPath(pathValue: string): string {
  // Handles accidental values like ""D:\path\file.json"" from .env formatting.
  return pathValue.trim().replace(/^"+|"+$/g, "");
}

function parseServiceAccountCredentials(rawJson: string): {
  credentials?: JsonRecord;
  error?: string;
} {
  try {
    const parsed = JSON.parse(rawJson);
    const record = asRecord(parsed);
    if (!record) {
      return {
        error: "GOOGLE_SERVICE_ACCOUNT_JSON must be a valid JSON object.",
      };
    }
    return { credentials: record };
  } catch {
    return {
      error:
        "Invalid GOOGLE_SERVICE_ACCOUNT_JSON format. Use valid minified JSON or rely on ADC.",
    };
  }
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function asRecord(value: unknown): ErrorRecord | undefined {
  if (typeof value === "object" && value !== null) {
    return value as ErrorRecord;
  }
  return undefined;
}

function normalizeRouteError(error: unknown): {
  status: number;
  message: string;
  code?: string | number;
  isQuotaExceeded: boolean;
  details?: unknown;
} {
  const queue: unknown[] = [error];
  const visited = new Set<unknown>();
  let status = 500;
  let message = "Unknown error occurred while generating image";
  let code: string | number | undefined;
  let details: unknown;
  let isQuotaExceeded = false;

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || current === null || visited.has(current)) {
      continue;
    }
    visited.add(current);

    const parsed = parseMaybeJson(current);
    if (parsed !== current && !visited.has(parsed)) {
      queue.push(parsed);
    }

    if (typeof parsed === "string") {
      const trimmed = parsed.trim();
      if (trimmed.length > 0 && message === "Unknown error occurred while generating image") {
        message = trimmed;
      }
      if (
        /resource_exhausted|quota|exceeded your current quota|429/i.test(
          trimmed,
        )
      ) {
        isQuotaExceeded = true;
      }
      continue;
    }

    const record = asRecord(parsed);
    if (!record) continue;

    if (typeof record.message === "string" && message === "Unknown error occurred while generating image") {
      message = record.message;
    }

    if (record.code !== undefined && code === undefined) {
      code = record.code as string | number;
    }

    if (
      record.code === 429 ||
      record.code === "429" ||
      (typeof record.status === "string" &&
        /RESOURCE_EXHAUSTED/i.test(record.status))
    ) {
      isQuotaExceeded = true;
    }

    if (typeof record.code === "number" && record.code >= 400 && record.code <= 599) {
      status = record.code;
    } else if (
      typeof record.status === "number" &&
      record.status >= 400 &&
      record.status <= 599
    ) {
      status = record.status;
    }

    if (record.details !== undefined && details === undefined) {
      details = record.details;
    }

    if (record.error !== undefined) queue.push(record.error);
    if (record.message !== undefined) queue.push(record.message);
    if (Array.isArray(record.details)) {
      for (const detail of record.details) {
        queue.push(detail);
      }
    }
  }

  if (isQuotaExceeded) {
    status = 429;
  }

  return { status, message, code, isQuotaExceeded, details };
}

export async function POST(request: NextRequest) {
  try {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
    if (!project) {
      return NextResponse.json(
        {
          error:
            "GOOGLE_CLOUD_PROJECT is not configured. Set Vertex env vars and use ADC or GOOGLE_SERVICE_ACCOUNT_JSON.",
        },
        { status: 500 },
      );
    }

    let serviceAccountCredentials: JsonRecord | undefined;
    const rawServiceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
    if (rawServiceAccount) {
      const parsed = parseServiceAccountCredentials(rawServiceAccount);
      if (parsed.error) {
        return NextResponse.json({ error: parsed.error }, { status: 500 });
      }
      serviceAccountCredentials = parsed.credentials;
    }
    if (!serviceAccountCredentials) {
      const rawCredentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
      if (rawCredentialsPath) {
        const credentialsPath = sanitizeCredentialPath(rawCredentialsPath);
        process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
        if (!existsSync(credentialsPath)) {
          return NextResponse.json(
            {
              error: `GOOGLE_APPLICATION_CREDENTIALS file not found: ${credentialsPath}`,
            },
            { status: 500 },
          );
        }
      }
    }

    const options: ImageGenerationOptions = await request.json();

    if (!options.prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const ai = new GoogleGenAI({
      vertexai: true,
      project,
      location,
      apiVersion: "v1",
      ...(serviceAccountCredentials
        ? { googleAuthOptions: { credentials: serviceAccountCredentials } }
        : {}),
    });
    const model = normalizeModelId(options.model || "imagen-4.0-generate-001");
    const aspectRatio = options.aspectRatio || "1:1";
    const numberOfImages = options.numberOfImages || options.sampleCount || 1;
    const safetySetting = options.safetyFilterLevel || options.safetySetting;
    const outputMimeType =
      options.outputOptions?.mimeType || options.outputMimeType;
    const outputCompressionQuality =
      options.outputOptions?.compressionQuality ??
      options.outputCompressionQuality;
    const imageSize = options.sampleImageSize || options.imageSize;
    const isImagenModel = model.startsWith("imagen-");
    const images: string[] = [];

    if (isImagenModel) {
      const response = await ai.models.generateImages({
        model,
        prompt: options.prompt,
        config: {
          numberOfImages,
          aspectRatio,
          personGeneration: options.personGeneration
            ? PERSON_GENERATION_MAP[options.personGeneration]
            : PersonGeneration.ALLOW_ADULT,
          safetyFilterLevel: safetySetting
            ? SAFETY_FILTER_LEVEL_MAP[safetySetting]
            : SafetyFilterLevel.BLOCK_LOW_AND_ABOVE,
          includeRaiReason: options.includeRaiReason,
          language: options.language
            ? IMAGE_PROMPT_LANGUAGE_MAP[options.language]
            : undefined,
          negativePrompt: options.negativePrompt,
          enhancePrompt: options.enhancePrompt ?? false,
          outputMimeType,
          outputCompressionQuality,
          addWatermark: options.addWatermark,
          imageSize,
        },
      });

      if (response.generatedImages) {
        for (const generated of response.generatedImages) {
          const base64Data = generated.image?.imageBytes;
          if (!base64Data) continue;
          const mimeType = generated.image?.mimeType || "image/png";
          images.push(`data:${mimeType};base64,${base64Data}`);
        }
      }
    } else {
      const response = await ai.models.generateContent({
        model,
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: {
            aspectRatio,
          },
        },
        contents: [
          {
            role: "user",
            parts: [{ text: options.prompt }],
          },
        ],
      });

      if (response?.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (!part.inlineData?.data) continue;
          const mimeType = part.inlineData.mimeType || "image/png";
          images.push(`data:${mimeType};base64,${part.inlineData.data}`);
        }
      }
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: "No images were generated. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ images });
  } catch (error: unknown) {
    console.error("Error in generate-image API route:", error);
    const normalized = normalizeRouteError(error);
    return NextResponse.json(
      {
        error: normalized.message,
        code: normalized.code,
        isQuotaExceeded: normalized.isQuotaExceeded,
        details: normalized.details,
      },
      { status: normalized.status },
    );
  }
}

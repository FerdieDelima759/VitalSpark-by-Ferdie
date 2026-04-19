"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { supabase } from "@/lib/api/supabase";
import { generateExerciseImage, isImageQuotaExceededError } from "@/lib/gemini";
import type { DayWorkoutResponse } from "@/lib/openai-prompt";
import { getUserSessionData } from "@/utils/sessionStorage";

// ============================================================================
// TYPES
// ============================================================================

export interface ImageGenExercise {
  dayName: string;
  section: string;
  index: number;
  exerciseName: string;
  exerciseDescription: string;
  imageSlug: string;
  status: "pending" | "generating" | "uploaded" | "failed";
  retryCount: number;
  error?: string;
  uploadedUrl?: string;
  lastAttempt?: number;
}

export interface ImageGenState {
  sessionId: string;
  planId: string | null;
  gender: "male" | "female";
  createdAt: number;
  updatedAt: number;
  currentDay: string | null;
  dayOrder: string[];
  completedDays: string[];
  exercises: ImageGenExercise[];
  stats: {
    total: number;
    pending: number;
    generating: number;
    uploaded: number;
    failed: number;
  };
}

export interface ImageGenStats {
  total: number;
  pending: number;
  uploaded: number;
  failed: number;
}

interface ImageGenerationContextType {
  // State
  imageGenState: ImageGenState | null;
  imageGenStats: ImageGenStats;
  isProcessingImages: boolean;
  currentImageGenDay: string | null;
  exerciseImages: Record<string, string>;
  generatingImages: Set<string>;
  completedImageDays: Set<string>;

  // Actions
  queueDayForImageGeneration: (
    dayName: string,
    dayResult: DayWorkoutResponse,
    gender: "male" | "female",
    dayOrder?: string[],
    planId?: string | null,
  ) => void;
  clearImageGeneration: () => void;
  retryFailedImages: () => void;
  pauseImageGeneration: () => void;
  resumeImageGeneration: () => void;
  syncPendingImagesFromDatabase: (reason?: string) => Promise<boolean>;
  restartDayImageGeneration: (
    dayName: string,
    dayResult: DayWorkoutResponse,
    gender: "male" | "female",
  ) => void;
  setExerciseImage: (key: string, url: string) => void;

  // Utilities
  isDayImagesComplete: (dayName: string) => boolean;
  getDayImageCounts: (dayName: string) => {
    total: number;
    ready: number;
    generating: number;
  };
  isExerciseGenerating: (key: string) => boolean;
  getExerciseImageUrl: (key: string) => string | undefined;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const IMAGE_GEN_STORAGE_KEY_PREFIX = "vitalspark_image_generation_state";
const DRAFT_PLAN_ID_PREFIX = "draft:";
const EXERCISE_DELAY_MIN_MS = Math.max(
  800,
  Number(process.env.NEXT_PUBLIC_IMAGE_GEN_EXERCISE_DELAY_MIN_MS ?? "1800"),
);
const EXERCISE_DELAY_MAX_MS = Math.max(
  EXERCISE_DELAY_MIN_MS,
  Number(process.env.NEXT_PUBLIC_IMAGE_GEN_EXERCISE_DELAY_MAX_MS ?? "3200"),
);
const DAY_PAUSE_MS = Math.max(
  3000,
  Number(process.env.NEXT_PUBLIC_IMAGE_GEN_DAY_PAUSE_MS ?? "20000"),
);
const QUOTA_PAUSE_MS = Math.max(
  60_000,
  Number(process.env.NEXT_PUBLIC_IMAGE_GEN_QUOTA_PAUSE_MS ?? "1800000"),
);
const IMAGE_GEN_VERBOSE_LOGS =
  process.env.NEXT_PUBLIC_IMAGE_GEN_VERBOSE_LOGS === "true";

const imgDebug = (...args: unknown[]) => {
  if (IMAGE_GEN_VERBOSE_LOGS) {
    console.log(...args);
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper function to map section keys to storage section names
const mapSectionKeyToStorage = (
  sectionKey: string,
): "warmup" | "main" | "cooldown" => {
  const sectionMap: Record<string, "warmup" | "main" | "cooldown"> = {
    warm_up: "warmup",
    main_workout: "main",
    cooldown: "cooldown",
  };
  return sectionMap[sectionKey] || "main";
};

// Helper function to generate image slug from section and name
const createImageSlug = (section: string, name: string): string => {
  const storageSection = mapSectionKeyToStorage(section);
  const kebabName = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${storageSection}/${kebabName}`;
};

const decodeGeneratedImageToBlob = async (
  imageData: string,
): Promise<Blob> => {
  const normalized = imageData.startsWith("data:image")
    ? imageData
    : `data:image/png;base64,${imageData}`;
  const response = await fetch(normalized);
  if (!response.ok) {
    throw new Error("Failed to decode generated image");
  }
  return response.blob();
};

const convertBlobToPng = async (sourceBlob: Blob): Promise<Blob> => {
  if (sourceBlob.type === "image/png") {
    return sourceBlob;
  }

  const objectUrl = URL.createObjectURL(sourceBlob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () =>
        reject(new Error("Failed to load generated image for PNG conversion"));
      nextImage.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create canvas context for image upload");
    }

    context.drawImage(image, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
            return;
          }
          reject(new Error("Failed to convert generated image to PNG"));
        },
        "image/png",
        1,
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const checkPublicStorageUrlExists = async (publicUrl: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(publicUrl, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok || response.status === 206;
  } catch {
    return false;
  }
};

// Upload base64 image to Supabase Storage
const uploadImageToStorage = async (
  base64Image: string,
  gender: "male" | "female",
  imageSlug: string,
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    // Keep the storage contract stable: generated assets are always stored as PNG.
    const decodedBlob = await decodeGeneratedImageToBlob(base64Image);
    const imageBlob = await convertBlobToPng(decodedBlob);

    const storagePath = `exercises/${gender}/${imageSlug}.png`;
    const publicUrl = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/${storagePath}`;

    const { error: uploadError } = await supabase.storage
      .from("workouts")
      .upload(storagePath, imageBlob, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      const alreadyExists = await checkPublicStorageUrlExists(publicUrl);
      if (alreadyExists) {
        return { success: true, url: publicUrl };
      }

      const { error: updateError } = await supabase.storage
        .from("workouts")
        .update(storagePath, imageBlob, {
          contentType: "image/png",
          upsert: true,
        });

      if (!updateError) {
        return { success: true, url: publicUrl };
      }

      return {
        success: false,
        error:
          updateError.message !== uploadError.message
            ? `${uploadError.message} | update fallback: ${updateError.message}`
            : uploadError.message,
      };
    }

    return { success: true, url: publicUrl };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return { success: false, error: message };
  }
};

const fetchPlanExerciseImageStatus = async (
  imagePath: string,
): Promise<{ hasRecords: boolean; shouldProcess: boolean }> => {
  try {
    const { data, error } = await supabase
      .from("user_workout_plan_exercises")
      .select("id,is_image_generated")
      .eq("image_path", imagePath);

    if (error) {
      console.warn(
        "[ImageGenContext] Failed to read is_image_generated:",
        error.message,
      );
      return { hasRecords: false, shouldProcess: true };
    }

    if (!data || data.length === 0) {
      imgDebug(
        "[ImageGenContext] No user_workout_plan_exercises rows yet; image will be generated.",
        { imagePath },
      );
      return { hasRecords: false, shouldProcess: true };
    }

    const shouldProcess = data.some((row) => row.is_image_generated !== true);
    if (!shouldProcess) {
      imgDebug(
        "[ImageGenContext] All linked plan rows already marked generated.",
        { imagePath, rows: data.length },
      );
    }
    return { hasRecords: true, shouldProcess };
  } catch (err) {
    console.warn("[ImageGenContext] is_image_generated check failed:", err);
    return { hasRecords: false, shouldProcess: true };
  }
};

const fetchPlanExerciseDescription = async (
  imagePath: string,
): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from("user_workout_plan_exercises")
      .select("description")
      .eq("image_path", imagePath)
      .not("description", "is", null)
      .limit(1);

    if (error) {
      console.warn(
        "[ImageGenContext] Failed to read description:",
        error.message,
      );
      return null;
    }

    const description = data?.[0]?.description;
    if (typeof description !== "string") return null;
    const trimmed = description.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (err) {
    console.warn("[ImageGenContext] description read failed:", err);
    return null;
  }
};

const markPlanExercisesImageGenerated = async (
  imagePath: string,
): Promise<void> => {
  try {
    const { error } = await supabase
      .from("user_workout_plan_exercises")
      .update({ is_image_generated: true })
      .eq("image_path", imagePath)
      .or("is_image_generated.is.null,is_image_generated.eq.false");

    if (error) {
      console.warn(
        "[ImageGenContext] Failed to update is_image_generated:",
        error.message,
      );
    }
  } catch (err) {
    console.warn("[ImageGenContext] is_image_generated update failed:", err);
  }
};

// LocalStorage helpers
const getImageGenStorageKey = (userId: string | null): string =>
  `${IMAGE_GEN_STORAGE_KEY_PREFIX}_${userId || "anonymous"}`;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const randomBetween = (min: number, max: number): number => {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const isDraftPlanId = (planId: string | null | undefined): boolean =>
  typeof planId === "string" && planId.startsWith(DRAFT_PLAN_ID_PREFIX);

const parseImagePathMetadata = (
  imagePath: string,
): { gender: "male" | "female"; imageSlug: string } | null => {
  const match = imagePath.match(
    /\/exercises\/(male|female)\/(.+?)\.png(?:\?|$)/i,
  );
  if (!match) return null;
  const [, genderRaw, slugRaw] = match;
  if (!genderRaw || !slugRaw) return null;
  return {
    gender: genderRaw.toLowerCase() === "male" ? "male" : "female",
    imageSlug: slugRaw,
  };
};

const mapStoredSectionToQueueSection = (section: string | null): string => {
  if (section === "warmup") return "warm_up";
  if (section === "cooldown") return "cooldown";
  return "main_workout";
};

const parseExerciseNameFromImageAlt = (imageAlt: string | null): string | null => {
  if (!imageAlt) return null;
  const trimmed = imageAlt
    .replace(/\s*exercise demonstration\s*$/i, "")
    .trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseExerciseNameFromSlug = (imageSlug: string): string => {
  const namePart = imageSlug.includes("/")
    ? imageSlug.split("/").slice(1).join("/")
    : imageSlug;
  return namePart.replace(/-/g, " ").trim() || "Exercise";
};

const buildExerciseStorageUrl = (
  gender: "male" | "female",
  imageSlug: string,
): string =>
  `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/exercises/${gender}/${imageSlug}.png`;

const checkStorageObjectExists = async (
  storageUrl: string,
  cache: Map<string, boolean>,
): Promise<boolean> => {
  const cached = cache.get(storageUrl);
  if (typeof cached === "boolean") {
    return cached;
  }

  let exists = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(storageUrl, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    exists = response.ok || response.status === 206;
  } catch {
    exists = false;
  }

  cache.set(storageUrl, exists);
  return exists;
};

const normalizeDayLabel = (value: string | null | undefined): string =>
  (value || "").toLowerCase().trim();

const parseQueuedDayMetadata = (
  queuedDayName: string,
): {
  dayLabel: string | null;
  weekNumber: number | null;
  planId: string | null;
  dayPlanId: string | null;
} => {
  const trimmed = queuedDayName.trim();
  if (!trimmed) {
    return { dayLabel: null, weekNumber: null, planId: null, dayPlanId: null };
  }

  const canonicalMatch = trimmed.match(
    /^(.*?)\s*\|\s*W(\d+)\s*(?:\|\s*P:([a-f0-9-]{8,}))?(?:\|\s*D:([a-f0-9-]{8,}))?\s*$/i,
  );
  if (canonicalMatch) {
    return {
      dayLabel: canonicalMatch[1]?.trim() || null,
      weekNumber: Number(canonicalMatch[2]),
      planId: canonicalMatch[3] || null,
      dayPlanId: canonicalMatch[4] || null,
    };
  }

  const weekParenMatch = trimmed.match(/^(.*?)\s*\(week\s*(\d+)\)\s*$/i);
  if (weekParenMatch) {
    return {
      dayLabel: weekParenMatch[1]?.trim() || null,
      weekNumber: Number(weekParenMatch[2]),
      planId: null,
      dayPlanId: null,
    };
  }

  const weekPipeMatch = trimmed.match(/^(.*?)\s*\|\s*w(\d+)\b/i);
  if (weekPipeMatch) {
    return {
      dayLabel: weekPipeMatch[1]?.trim() || null,
      weekNumber: Number(weekPipeMatch[2]),
      planId: null,
      dayPlanId: null,
    };
  }

  return { dayLabel: trimmed, weekNumber: null, planId: null, dayPlanId: null };
};

const buildQueuedDayName = (
  dayLabel: string,
  weekNumber: number | null | undefined,
  planId?: string | null,
  dayPlanId?: string | null,
): string => {
  const safeDay = dayLabel.trim() || "Day";
  const safeWeek = Number.isFinite(weekNumber as number)
    ? Number(weekNumber)
    : 1;
  let name = `${safeDay} | W${safeWeek}`;
  if (planId) {
    name += ` | P:${planId}`;
  }
  if (dayPlanId) {
    name += ` | D:${dayPlanId}`;
  }
  return name;
};

const getQueuedDayPlanId = (
  queuedDayName: string,
  fallbackPlanId: string | null,
): string | null => {
  const parsed = parseQueuedDayMetadata(queuedDayName);
  return parsed.planId || fallbackPlanId;
};

const fetchPendingDayExercisesFromDatabase = async (
  planId: string | null,
  queuedDayName: string,
  expectedGender: "male" | "female",
): Promise<ImageGenExercise[]> => {
  if (!planId) return [];

  try {
    type WeekRow = { id: string; week_number: number | null };
    type DayRow = { id: string; day: string | null; week_plan_id: string };
    type ExerciseRow = {
      id: string;
      weekly_plan_id: string;
      section: string | null;
      position: number | null;
      image_path: string | null;
      image_alt: string | null;
      description: string | null;
      is_image_generated: boolean | null;
    };

    const queuedMeta = parseQueuedDayMetadata(queuedDayName);

    let weeksQuery = supabase
      .from("user_workout_weekly_plan")
      .select("id,week_number")
      .eq("plan_id", planId);
    if (queuedMeta.weekNumber !== null && !Number.isNaN(queuedMeta.weekNumber)) {
      weeksQuery = weeksQuery.eq("week_number", queuedMeta.weekNumber);
    }
    const { data: weeksData, error: weeksError } = await weeksQuery;
    if (weeksError || !weeksData || weeksData.length === 0) {
      if (weeksError) {
        console.warn(
          "[ImageGenContext] Day re-check: weekly plan read failed:",
          weeksError.message,
        );
      }
      return [];
    }

    const weekRows = weeksData as WeekRow[];
    const weekPlanIds = weekRows.map((row) => row.id);

    const { data: daysData, error: daysError } = await supabase
      .from("user_workout_weekly_day_plan")
      .select("id,day,week_plan_id")
      .in("week_plan_id", weekPlanIds);
    if (daysError || !daysData || daysData.length === 0) {
      if (daysError) {
        console.warn(
          "[ImageGenContext] Day re-check: daily plan read failed:",
          daysError.message,
        );
      }
      return [];
    }

    const normalizedQueuedDay = normalizeDayLabel(queuedMeta.dayLabel);
    const dayRows = (daysData as DayRow[]).filter((row) => {
      if (!normalizedQueuedDay) return true;
      const normalizedRowDay = normalizeDayLabel(row.day);
      return (
        normalizedRowDay === normalizedQueuedDay ||
        normalizedQueuedDay.startsWith(normalizedRowDay) ||
        normalizedRowDay.startsWith(normalizedQueuedDay)
      );
    });
    if (dayRows.length === 0) {
      return [];
    }

    const dayPlanIds = dayRows.map((row) => row.id);

    const { data: exercisesData, error: exercisesError } = await supabase
      .from("user_workout_plan_exercises")
      .select(
        "id,weekly_plan_id,section,position,image_path,image_alt,description,is_image_generated",
      )
      .in("weekly_plan_id", dayPlanIds)
      .or("is_image_generated.is.null,is_image_generated.eq.false")
      .not("image_path", "is", null)
      .order("weekly_plan_id", { ascending: true })
      .order("position", { ascending: true });
    if (exercisesError || !exercisesData || exercisesData.length === 0) {
      if (exercisesError) {
        console.warn(
          "[ImageGenContext] Day re-check: pending exercise read failed:",
          exercisesError.message,
        );
      }
      return [];
    }

    const pendingRows = exercisesData as ExerciseRow[];
    const pendingExercises = pendingRows
      .map((row, fallbackIndex) => {
        const parsedPath = parseImagePathMetadata(row.image_path || "");
        if (parsedPath && parsedPath.gender !== expectedGender) {
          return null;
        }

        const section = mapStoredSectionToQueueSection(row.section);
        const imageSlug =
          parsedPath?.imageSlug ||
          createImageSlug(
            section,
            parseExerciseNameFromImageAlt(row.image_alt) || "exercise",
          );
        const exerciseName =
          parseExerciseNameFromImageAlt(row.image_alt) ||
          parseExerciseNameFromSlug(imageSlug);
        const description =
          row.description?.trim() ||
          `Exercise demonstration for ${exerciseName}`;

        return {
          dayName: queuedDayName,
          section,
          index: row.position ?? fallbackIndex,
          exerciseName,
          exerciseDescription: description,
          imageSlug,
          status: "pending" as const,
          retryCount: 0,
        } as ImageGenExercise;
      })
      .filter((entry): entry is ImageGenExercise => Boolean(entry));

    const uniqueBySlugAndSection = new Map<string, ImageGenExercise>();
    pendingExercises.forEach((exercise) => {
      const key = `${exercise.imageSlug}|${exercise.section}`;
      if (!uniqueBySlugAndSection.has(key)) {
        uniqueBySlugAndSection.set(key, exercise);
      }
    });

    return Array.from(uniqueBySlugAndSection.values());
  } catch (error) {
    console.warn("[ImageGenContext] Day re-check failed:", error);
    return [];
  }
};

const fetchPendingPlanExercisesFromDatabase = async (
  planId: string | null,
  expectedGender: "male" | "female",
): Promise<ImageGenExercise[]> => {
  if (!planId) return [];

  try {
    type WeekRow = { id: string; week_number: number | null };
    type DayRow = { id: string; day: string | null; week_plan_id: string };
    type ExerciseRow = {
      id: string;
      weekly_plan_id: string;
      section: string | null;
      position: number | null;
      image_path: string | null;
      image_alt: string | null;
      description: string | null;
      is_image_generated: boolean | null;
    };

    const { data: weeksData, error: weeksError } = await supabase
      .from("user_workout_weekly_plan")
      .select("id,week_number")
      .eq("plan_id", planId);
    if (weeksError || !weeksData || weeksData.length === 0) {
      if (weeksError) {
        console.warn(
          "[ImageGenContext] Plan re-check: weekly plan read failed:",
          weeksError.message,
        );
      }
      return [];
    }

    const weekRows = weeksData as WeekRow[];
    const weekById = new Map<string, WeekRow>();
    weekRows.forEach((row) => weekById.set(row.id, row));
    const weekPlanIds = weekRows.map((row) => row.id);

    const { data: daysData, error: daysError } = await supabase
      .from("user_workout_weekly_day_plan")
      .select("id,day,week_plan_id")
      .in("week_plan_id", weekPlanIds);
    if (daysError || !daysData || daysData.length === 0) {
      if (daysError) {
        console.warn(
          "[ImageGenContext] Plan re-check: daily plan read failed:",
          daysError.message,
        );
      }
      return [];
    }

    const dayRows = daysData as DayRow[];
    const dayById = new Map<string, DayRow>();
    dayRows.forEach((row) => dayById.set(row.id, row));
    const dayPlanIds = dayRows.map((row) => row.id);

    const { data: exercisesData, error: exercisesError } = await supabase
      .from("user_workout_plan_exercises")
      .select(
        "id,weekly_plan_id,section,position,image_path,image_alt,description,is_image_generated",
      )
      .in("weekly_plan_id", dayPlanIds)
      .or("is_image_generated.is.null,is_image_generated.eq.false")
      .not("image_path", "is", null)
      .order("weekly_plan_id", { ascending: true })
      .order("position", { ascending: true });
    if (exercisesError || !exercisesData || exercisesData.length === 0) {
      if (exercisesError) {
        console.warn(
          "[ImageGenContext] Plan re-check: pending exercise read failed:",
          exercisesError.message,
        );
      }
      return [];
    }

    const pendingRows = exercisesData as ExerciseRow[];
    const pendingExercises = pendingRows
      .map((row, fallbackIndex) => {
        const dayRow = dayById.get(row.weekly_plan_id);
        if (!dayRow) return null;
        const weekRow = weekById.get(dayRow.week_plan_id);
        if (!weekRow) return null;

        const parsedPath = parseImagePathMetadata(row.image_path || "");
        if (parsedPath && parsedPath.gender !== expectedGender) {
          return null;
        }

        const section = mapStoredSectionToQueueSection(row.section);
        const imageSlug =
          parsedPath?.imageSlug ||
          createImageSlug(
            section,
            parseExerciseNameFromImageAlt(row.image_alt) || "exercise",
          );
        const exerciseName =
          parseExerciseNameFromImageAlt(row.image_alt) ||
          parseExerciseNameFromSlug(imageSlug);
        const description =
          row.description?.trim() ||
          `Exercise demonstration for ${exerciseName}`;

        const queueDayName = buildQueuedDayName(
          dayRow.day?.trim() || "Day",
          weekRow.week_number ?? 1,
          planId,
          dayRow.id,
        );

        return {
          dayName: queueDayName,
          section,
          index: row.position ?? fallbackIndex,
          exerciseName,
          exerciseDescription: description,
          imageSlug,
          status: "pending" as const,
          retryCount: 0,
        } as ImageGenExercise;
      })
      .filter((entry): entry is ImageGenExercise => Boolean(entry));

    const uniqueByKey = new Map<string, ImageGenExercise>();
    pendingExercises.forEach((exercise) => {
      const key = `${exercise.dayName}|${exercise.section}|${exercise.imageSlug}`;
      if (!uniqueByKey.has(key)) {
        uniqueByKey.set(key, exercise);
      }
    });

    return Array.from(uniqueByKey.values()).sort((a, b) => {
      const aMeta = parseQueuedDayMetadata(a.dayName);
      const bMeta = parseQueuedDayMetadata(b.dayName);
      const weekDiff = (aMeta.weekNumber ?? 999) - (bMeta.weekNumber ?? 999);
      if (weekDiff !== 0) return weekDiff;
      const dayDiff = daySortRank(aMeta.dayLabel) - daySortRank(bMeta.dayLabel);
      if (dayDiff !== 0) return dayDiff;
      return a.index - b.index;
    });
  } catch (error) {
    console.warn("[ImageGenContext] Plan re-check failed:", error);
    return [];
  }
};

const daySortRank = (day: string | null): number => {
  if (!day) return 99;
  const normalized = day.toLowerCase().trim();
  const rankMap: Record<string, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 7,
  };
  if (rankMap[normalized]) {
    return rankMap[normalized];
  }

  const numericMatch = normalized.match(/\d+/);
  if (numericMatch?.[0]) {
    return Number(numericMatch[0]);
  }
  return 99;
};

const getImageGenState = (storageKey: string): ImageGenState | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<ImageGenState>;
    return {
      ...(parsed as ImageGenState),
      planId: parsed.planId ?? null,
    };
  } catch {
    return null;
  }
};

const saveImageGenState = (state: ImageGenState, storageKey: string): void => {
  if (typeof window === "undefined") return;
  try {
    state.updatedAt = Date.now();
    state.stats = {
      total: state.exercises.length,
      pending: state.exercises.filter((e) => e.status === "pending").length,
      generating: state.exercises.filter((e) => e.status === "generating")
        .length,
      uploaded: state.exercises.filter((e) => e.status === "uploaded").length,
      failed: state.exercises.filter((e) => e.status === "failed").length,
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (err) {
    console.error("Failed to save image gen state:", err);
  }
};

const clearStoredImageGenState = (storageKey: string): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey);
    imgDebug("🗑️ Cleared image generation state from localStorage");
  } catch (err) {
    console.error("Failed to clear image gen state:", err);
  }
};

const createImageGenSession = (
  gender: "male" | "female",
  dayOrder: string[],
  planId: string | null = null,
): ImageGenState => {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  return {
    sessionId,
    planId,
    gender,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    currentDay: null,
    dayOrder,
    completedDays: [],
    exercises: [],
    stats: {
      total: 0,
      pending: 0,
      generating: 0,
      uploaded: 0,
      failed: 0,
    },
  };
};

const addExercisesToState = (
  state: ImageGenState,
  dayName: string,
  exercises: Array<{
    section: string;
    index: number;
    name: string;
    description: string;
  }>,
): ImageGenState => {
  const newExercises: ImageGenExercise[] = exercises.map((ex) => ({
    dayName,
    section: ex.section,
    index: ex.index,
    exerciseName: ex.name,
    exerciseDescription: ex.description,
    imageSlug: createImageSlug(ex.section, ex.name),
    status: "pending" as const,
    retryCount: 0,
  }));

  const existingKeys = new Set(
    state.exercises.map((e) => `${e.dayName}-${e.section}-${e.index}`),
  );
  const uniqueNewExercises = newExercises.filter(
    (e) => !existingKeys.has(`${e.dayName}-${e.section}-${e.index}`),
  );

  const newTotal = state.stats.total + uniqueNewExercises.length;
  const newPending = state.stats.pending + uniqueNewExercises.length;

  return {
    ...state,
    exercises: [...state.exercises, ...uniqueNewExercises],
    stats: {
      ...state.stats,
      total: newTotal,
      pending: newPending,
    },
  };
};

const updateExerciseStatus = (
  state: ImageGenState,
  dayName: string,
  section: string,
  index: number,
  status: ImageGenExercise["status"],
  extras?: Partial<ImageGenExercise>,
): ImageGenState => {
  const exercise = state.exercises.find(
    (ex) =>
      ex.dayName === dayName && ex.section === section && ex.index === index,
  );
  const oldStatus = exercise?.status || "pending";

  const newStats = { ...state.stats };

  if (oldStatus === "pending")
    newStats.pending = Math.max(0, newStats.pending - 1);
  else if (oldStatus === "uploaded")
    newStats.uploaded = Math.max(0, newStats.uploaded - 1);
  else if (oldStatus === "failed")
    newStats.failed = Math.max(0, newStats.failed - 1);

  if (status === "pending") newStats.pending++;
  else if (status === "uploaded") newStats.uploaded++;
  else if (status === "failed") newStats.failed++;

  return {
    ...state,
    stats: newStats,
    exercises: state.exercises.map((ex) =>
      ex.dayName === dayName && ex.section === section && ex.index === index
        ? { ...ex, status, lastAttempt: Date.now(), ...extras }
        : ex,
    ),
  };
};

const markDayCompleted = (
  state: ImageGenState,
  dayName: string,
): ImageGenState => {
  if (state.completedDays.includes(dayName)) return state;
  return {
    ...state,
    completedDays: [...state.completedDays, dayName],
  };
};

const getNextPendingExercise = (
  state: ImageGenState,
  dayName: string,
): ImageGenExercise | null => {
  const sectionOrder = ["warm_up", "main_workout", "cooldown"];
  const dayExercises = state.exercises
    .filter((e) => e.dayName === dayName && e.status === "pending")
    .sort((a, b) => {
      const sectionDiff =
        sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section);
      if (sectionDiff !== 0) return sectionDiff;
      return a.index - b.index;
    });
  return dayExercises[0] || null;
};

const getNextDayToProcess = (state: ImageGenState): string | null => {
  for (const day of state.dayOrder) {
    if (!state.completedDays.includes(day)) {
      const hasRunnableWork = state.exercises.some(
        (e) =>
          e.dayName === day &&
          (e.status === "pending" ||
            e.status === "generating"),
      );
      if (hasRunnableWork) return day;
      const dayExercises = state.exercises.filter((e) => e.dayName === day);
      if (
        dayExercises.length > 0 &&
        dayExercises.every(
          (e) => e.status === "uploaded" || e.status === "failed",
        )
      ) {
        continue;
      }
      return day;
    }
  }
  return null;
};

const isDayComplete = (state: ImageGenState, dayName: string): boolean => {
  const dayExercises = state.exercises.filter((e) => e.dayName === dayName);
  if (dayExercises.length === 0) return false;
  return dayExercises.every((e) => e.status === "uploaded");
};

// ============================================================================
// CONTEXT
// ============================================================================

const ImageGenerationContext = createContext<
  ImageGenerationContextType | undefined
>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface ImageGenerationProviderProps {
  children: ReactNode;
}

export function ImageGenerationProvider({
  children,
}: ImageGenerationProviderProps): React.ReactElement {
  // State
  const [imageGenState, setImageGenState] = useState<ImageGenState | null>(
    null,
  );
  const [imageGenStats, setImageGenStats] = useState<ImageGenStats>({
    total: 0,
    pending: 0,
    uploaded: 0,
    failed: 0,
  });
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [currentImageGenDay, setCurrentImageGenDay] = useState<string | null>(
    null,
  );
  const [exerciseImages, setExerciseImages] = useState<Record<string, string>>(
    {},
  );
  const [generatingImages, setGeneratingImages] = useState<Set<string>>(
    new Set(),
  );
  const [completedImageDays, setCompletedImageDays] = useState<Set<string>>(
    new Set(),
  );

  // Refs
  const isProcessingImagesRef = useRef(false);
  const processingAbortedRef = useRef(false);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const userIdRef = useRef<string | null>(null);
  const quotaPauseUntilRef = useRef<number>(0);
  const bootstrapInFlightRef = useRef(false);
  const lastBootstrapAttemptRef = useRef<number>(0);

  const getStorageKey = useCallback((): string => {
    const sessionData = getUserSessionData();
    const userId = sessionData.userId || userIdRef.current || null;
    return getImageGenStorageKey(userId);
  }, []);

  const bootstrapPendingQueueFromDatabase = useCallback(
    async (reason: string): Promise<boolean> => {
      const now = Date.now();
      if (bootstrapInFlightRef.current) return false;
      if (now - lastBootstrapAttemptRef.current < 15000) return false;
      lastBootstrapAttemptRef.current = now;
      bootstrapInFlightRef.current = true;

      try {
        const sessionData = getUserSessionData();
        let userId = sessionData.userId || userIdRef.current || null;
        if (!userId) {
          const { data } = await supabase.auth.getUser();
          userId = data?.user?.id ?? null;
        }
        if (!userId) {
          return false;
        }

        const storageKey = getStorageKey();
        const existingState = getImageGenState(storageKey);
        const hasLocalWork =
          !!existingState &&
          (existingState.stats.pending > 0 ||
            existingState.exercises.some(
              (ex) =>
                ex.status === "pending" ||
                ex.status === "generating" ||
                ex.status === "failed",
            ));

        type PlanRow = { id: string; created_at: string | null };
        type WeekRow = {
          id: string;
          plan_id: string;
          week_number: number | null;
        };
        type DayRow = { id: string; day: string | null; week_plan_id: string };
        type PlanExerciseRow = {
          id: string;
          weekly_plan_id: string;
          section: string | null;
          position: number | null;
          image_path: string | null;
          image_alt: string | null;
          description: string | null;
          is_image_generated: boolean | null;
        };

        const { data: plansData, error: plansError } = await supabase
          .from("user_workout_plans")
          .select("id, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });
        if (plansError) {
          console.warn(
            "[ImageGenContext] Failed to read user plans for queue bootstrap:",
            plansError.message,
          );
          return false;
        }

        const planRows = (plansData || []) as PlanRow[];
        if (planRows.length === 0) {
          return false;
        }
        const planIds = planRows.map((row) => row.id);

        const { data: weeksData, error: weeksError } = await supabase
          .from("user_workout_weekly_plan")
          .select("id, plan_id, week_number")
          .in("plan_id", planIds);
        if (weeksError) {
          console.warn(
            "[ImageGenContext] Failed to read weekly plans for queue bootstrap:",
            weeksError.message,
          );
          return false;
        }

        const weekRows = (weeksData || []) as WeekRow[];
        if (weekRows.length === 0) {
          return false;
        }
        const weekPlanIds = weekRows.map((row) => row.id);

        const { data: daysData, error: daysError } = await supabase
          .from("user_workout_weekly_day_plan")
          .select("id, day, week_plan_id")
          .in("week_plan_id", weekPlanIds);
        if (daysError) {
          console.warn(
            "[ImageGenContext] Failed to read daily plans for queue bootstrap:",
            daysError.message,
          );
          return false;
        }

        const dayRows = (daysData || []) as DayRow[];
        if (dayRows.length === 0) {
          return false;
        }
        const dayPlanIds = dayRows.map((row) => row.id);

        const { data: exercisesData, error: exercisesError } = await supabase
          .from("user_workout_plan_exercises")
          .select(
            "id, weekly_plan_id, section, position, image_path, image_alt, description, is_image_generated",
          )
          .in("weekly_plan_id", dayPlanIds)
          .or("is_image_generated.is.null,is_image_generated.eq.false")
          .not("image_path", "is", null)
          .order("weekly_plan_id", { ascending: true })
          .order("position", { ascending: true });
        if (exercisesError) {
          console.warn(
            "[ImageGenContext] Failed to read pending exercises for queue bootstrap:",
            exercisesError.message,
          );
          return false;
        }

        const exerciseRows = (exercisesData || []) as PlanExerciseRow[];
        if (exerciseRows.length === 0) {
          return false;
        }

        const planOrder = new Map<string, number>();
        planRows.forEach((row, index) => planOrder.set(row.id, index));

        const weekById = new Map<string, WeekRow>();
        weekRows.forEach((row) => weekById.set(row.id, row));

        const dayById = new Map<string, DayRow>();
        dayRows.forEach((row) => dayById.set(row.id, row));

        const pendingQueueEntries = exerciseRows
          .map((row) => {
            if (!row.image_path) return null;

            const dayPlan = dayById.get(row.weekly_plan_id);
            if (!dayPlan) return null;
            const weekPlan = weekById.get(dayPlan.week_plan_id);
            if (!weekPlan) return null;
            const planId = weekPlan.plan_id;
            const parsedPath = parseImagePathMetadata(row.image_path);
            const imageSlug =
              parsedPath?.imageSlug ||
              createImageSlug(
                mapStoredSectionToQueueSection(row.section),
                parseExerciseNameFromImageAlt(row.image_alt) || "exercise",
              );
            const exerciseName =
              parseExerciseNameFromImageAlt(row.image_alt) ||
              parseExerciseNameFromSlug(imageSlug);
            const dayLabel = dayPlan.day?.trim() || "Day";
            const dayName = buildQueuedDayName(
              dayLabel,
              weekPlan.week_number ?? 1,
              planId,
              dayPlan.id,
            );
            const section = mapStoredSectionToQueueSection(row.section);

            return {
              dayName,
              planId,
              planOrder: planOrder.get(planId) ?? 9999,
              weekNumber: weekPlan.week_number ?? 999,
              dayRank: daySortRank(dayPlan.day),
              position: row.position ?? 0,
              gender: parsedPath?.gender || "female",
              exercise: {
                dayName,
                section,
                index: row.position ?? 0,
                exerciseName,
                exerciseDescription:
                  row.description?.trim() ||
                  `Exercise demonstration for ${exerciseName}`,
                imageSlug,
                status: "pending" as const,
                retryCount: 0,
              } as ImageGenExercise,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

        if (pendingQueueEntries.length === 0) {
          return false;
        }

        const genderCounts = pendingQueueEntries.reduce(
          (acc, entry) => {
            acc[entry.gender] += 1;
            return acc;
          },
          { male: 0, female: 0 },
        );
        const selectedGender: "male" | "female" =
          existingState?.gender ||
          (genderCounts.male > genderCounts.female ? "male" : "female");
        const filteredEntries = pendingQueueEntries.filter(
          (entry) => entry.gender === selectedGender,
        );
        if (filteredEntries.length === 0) {
          return false;
        }

        filteredEntries.sort((a, b) => {
          if (a.planOrder !== b.planOrder) return a.planOrder - b.planOrder;
          if (a.weekNumber !== b.weekNumber) return a.weekNumber - b.weekNumber;
          if (a.dayRank !== b.dayRank) return a.dayRank - b.dayRank;
          return a.position - b.position;
        });

        const dayOrder = Array.from(
          new Set(filteredEntries.map((entry) => entry.dayName)),
        );
        const uniquePlanIds = Array.from(
          new Set(filteredEntries.map((entry) => entry.planId)),
        );

        if (existingState && hasLocalWork) {
          const existingImageSlugs = new Set(
            existingState.exercises.map((exercise) => exercise.imageSlug),
          );
          const appendedExercises = filteredEntries
            .map((entry) => entry.exercise)
            .filter((exercise) => !existingImageSlugs.has(exercise.imageSlug));

          if (appendedExercises.length === 0) {
            imgDebug(
              "[ImageGenContext] Login DB check completed; local queue already covers pending images.",
              {
                reason,
                userId,
                pendingDbRows: filteredEntries.length,
                localPending: existingState.stats.pending,
              },
            );
            return false;
          }

          const mergedDayOrder = Array.from(
            new Set([...existingState.dayOrder, ...dayOrder]),
          );
          const mergedState: ImageGenState = {
            ...existingState,
            gender: existingState.gender || selectedGender,
            planId:
              existingState.planId ??
              (uniquePlanIds.length === 1 ? uniquePlanIds[0] : null),
            dayOrder: mergedDayOrder,
            exercises: [...existingState.exercises, ...appendedExercises],
          };
          saveImageGenState(mergedState, storageKey);
          setImageGenState(mergedState);
          setImageGenStats(mergedState.stats);

          imgDebug(
            "[ImageGenContext] Login DB check merged missing pending images into local queue.",
            {
              reason,
              userId,
              addedExercises: appendedExercises.length,
              pendingDbRows: filteredEntries.length,
              localPending: mergedState.stats.pending,
            },
          );
          return true;
        }

        const bootstrapState: ImageGenState = {
          ...createImageGenSession(
            selectedGender,
            dayOrder,
            uniquePlanIds.length === 1 ? uniquePlanIds[0] : null,
          ),
          exercises: filteredEntries.map((entry) => entry.exercise),
          stats: {
            total: filteredEntries.length,
            pending: filteredEntries.length,
            generating: 0,
            uploaded: 0,
            failed: 0,
          },
        };

        saveImageGenState(bootstrapState, storageKey);
        setImageGenState(bootstrapState);
        setImageGenStats(bootstrapState.stats);
        setCompletedImageDays(new Set());
        setExerciseImages({});

        imgDebug("[ImageGenContext] Bootstrapped pending queue from DB.", {
          reason,
          userId,
          plans: uniquePlanIds.length,
          days: dayOrder.length,
          exercises: filteredEntries.length,
          gender: selectedGender,
          droppedForGenderMismatch:
            pendingQueueEntries.length - filteredEntries.length,
        });
        return true;
      } catch (error) {
        console.warn(
          "[ImageGenContext] Failed to bootstrap queue from DB:",
          error,
        );
        return false;
      } finally {
        bootstrapInFlightRef.current = false;
      }
    },
    [getStorageKey],
  );

  // Load state from localStorage on mount (scoped by signed-in user)
  useEffect(() => {
    const loadState = () => {
      const primaryKey = getStorageKey();
      let savedState = getImageGenState(primaryKey);

      // Recover queue created before session user_id was available.
      if (!savedState && primaryKey !== getImageGenStorageKey(null)) {
        const anonymousKey = getImageGenStorageKey(null);
        const anonymousState = getImageGenState(anonymousKey);
        if (anonymousState) {
          savedState = anonymousState;
          saveImageGenState(anonymousState, primaryKey);
          clearStoredImageGenState(anonymousKey);
        }
      }

      if (!savedState) {
        setImageGenState(null);
        setImageGenStats({ total: 0, pending: 0, uploaded: 0, failed: 0 });
        setCompletedImageDays(new Set());
        setExerciseImages({});
        void bootstrapPendingQueueFromDatabase("loadState:no-local-state");
        return;
      }

      imgDebug("[ImageGenContext] Loaded state from localStorage:", {
        sessionId: savedState.sessionId,
        totalExercises: savedState.exercises.length,
        stats: savedState.stats,
        completedDays: savedState.completedDays,
      });
      setImageGenState(savedState);
      setImageGenStats(savedState.stats);
      setCompletedImageDays(new Set(savedState.completedDays));

      const images: Record<string, string> = {};
      savedState.exercises.forEach((ex) => {
        if (ex.status === "uploaded" && ex.uploadedUrl) {
          const key = `${ex.dayName}-${ex.section}-${ex.index}`;
          images[key] = ex.uploadedUrl;
        }
      });
      setExerciseImages(images);

      void bootstrapPendingQueueFromDatabase("loadState:auth-sync");
    };

    userIdRef.current = getUserSessionData().userId;
    loadState();

    const syncFromAuth = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const resolvedUserId = data?.user?.id ?? null;
        if (resolvedUserId !== userIdRef.current) {
          userIdRef.current = resolvedUserId;
          loadState();
        }
      } catch {
        // Ignore auth sync errors.
      }
    };
    void syncFromAuth();

    const handleSessionStorageChange = () => {
      const nextUserId = getUserSessionData().userId;
      if (nextUserId === userIdRef.current) return;
      userIdRef.current = nextUserId;
      loadState();
    };

    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUserId = session?.user?.id ?? null;
        if (nextUserId === userIdRef.current) return;
        userIdRef.current = nextUserId;
        loadState();
      },
    );

    window.addEventListener("sessionStorageChange", handleSessionStorageChange);
    return () => {
      authSubscription.subscription.unsubscribe();
      window.removeEventListener(
        "sessionStorageChange",
        handleSessionStorageChange,
      );
    };
  }, [bootstrapPendingQueueFromDatabase, getStorageKey]);

  // Process image generation queue
  const processImageGenerationQueue = useCallback(async () => {
    if (isProcessingImagesRef.current) {
      imgDebug(`⏳ [ImageGenContext] Image processing already running...`);
      return;
    }

    if (processingAbortedRef.current) {
      return;
    }

    const now = Date.now();
    if (quotaPauseUntilRef.current > now) {
      const remainingMs = quotaPauseUntilRef.current - now;
      console.warn(
        `[ImageGenContext] Quota cooldown active (${Math.ceil(remainingMs / 1000)}s remaining).`,
      );
      return;
    }

    const storageKey = getStorageKey();
    const state = getImageGenState(storageKey);
    if (!state) {
      imgDebug(`📋 [ImageGenContext] No image generation state found`);
      return;
    }

    const nextDay = getNextDayToProcess(state);
    if (!nextDay) {
      imgDebug(`✅ [ImageGenContext] All days completed!`);
      setCurrentImageGenDay(null);
      setIsProcessingImages(false);
      return;
    }

    isProcessingImagesRef.current = true;
    setIsProcessingImages(true);
    lastActivityTimeRef.current = Date.now();

    imgDebug(
      `\n🚀 [ImageGenContext] Starting image generation from localStorage state...`,
    );
    imgDebug(`📊 Session: ${state.sessionId}`);
    imgDebug(
      `📋 Days to process: ${state.dayOrder.filter((d) => !state.completedDays.includes(d)).join(" → ")}`,
    );
    imgDebug(
      `📊 Stats: ${state.stats.pending} pending, ${state.stats.uploaded} uploaded, ${state.stats.failed} failed`,
    );

    try {
      let currentState = state;
      let quotaExceeded = false;
      const storageExistenceCache = new Map<string, boolean>();
      for (let dayIndex = 0; dayIndex < currentState.dayOrder.length; ) {
        const dayName = currentState.dayOrder[dayIndex];
        if (!dayName) {
          dayIndex += 1;
          continue;
        }
        if (processingAbortedRef.current) {
          imgDebug("[ImageGenContext] ⏹️ Processing aborted");
          break;
        }

        if (currentState.completedDays.includes(dayName)) {
          dayIndex += 1;
          continue;
        }

        imgDebug(`\n${"═".repeat(65)}`);
        imgDebug(
          `🎯 [ImageGenContext] PROCESSING: ${dayName.toUpperCase()}`,
        );
        imgDebug(`${"═".repeat(65)}`);

        setCurrentImageGenDay(dayName);
        currentState = { ...currentState, currentDay: dayName };
        saveImageGenState(currentState, storageKey);

        let exercise = getNextPendingExercise(currentState, dayName);
        let dayProcessed = 0;
        let dayUploaded = 0;
        let dayFailed = 0;
        let consecutiveErrors = 0;
        const MAX_CONSECUTIVE_ERRORS = 5;

        imgDebug(
          `📋 Found ${currentState.exercises.filter((e) => e.dayName === dayName && e.status === "pending").length} pending exercises for ${dayName}`,
        );

        while (
          exercise &&
          !processingAbortedRef.current &&
          consecutiveErrors < MAX_CONSECUTIVE_ERRORS
        ) {
          dayProcessed++;
          const progress = `[${dayProcessed}]`;
          const imageKey = `${exercise.dayName}-${exercise.section}-${exercise.index}`;
          const storageUrl = buildExerciseStorageUrl(
            currentState.gender,
            exercise.imageSlug,
          );

          lastActivityTimeRef.current = Date.now();

          imgDebug(`\n${progress} 🔍 ${exercise.exerciseName}`);
          imgDebug(`    📂 ${exercise.section} | 🏷️ ${exercise.imageSlug}`);

          try {
            const planStatus = await fetchPlanExerciseImageStatus(storageUrl);
            if (planStatus.hasRecords && !planStatus.shouldProcess) {
              // DB says already generated; verify object exists in storage before skipping.
              const hasStorageObject = await checkStorageObjectExists(
                storageUrl,
                storageExistenceCache,
              );

              if (hasStorageObject) {
                imgDebug(
                  `${progress} ⏭️ Skipping generation (already generated in DB + storage exists)`,
                );
                currentState = updateExerciseStatus(
                  currentState,
                  exercise.dayName,
                  exercise.section,
                  exercise.index,
                  "uploaded",
                  { uploadedUrl: storageUrl },
                );
                saveImageGenState(currentState, storageKey);
                setImageGenStats(currentState.stats);
                setExerciseImages((prev) => ({
                  ...prev,
                  [imageKey]: storageUrl,
                }));
                dayUploaded++;
                consecutiveErrors = 0;
                exercise = getNextPendingExercise(currentState, dayName);
                continue;
              }

              imgDebug(
                `${progress} DB marked generated but storage object missing. Regenerating...`,
              );
            }

            if (!exercise) {
              continue;
            }
            currentState = updateExerciseStatus(
              currentState,
              exercise.dayName,
              exercise.section,
              exercise.index,
              "generating",
            );
            saveImageGenState(currentState, storageKey);
            setGeneratingImages((prev) => new Set(prev).add(imageKey));

            // Check if already exists in storage
            const imageExists = await checkStorageObjectExists(
              storageUrl,
              storageExistenceCache,
            );

            if (imageExists) {
              await markPlanExercisesImageGenerated(storageUrl);
              imgDebug(`${progress} ✅ EXISTS in storage`);
              currentState = updateExerciseStatus(
                currentState,
                exercise.dayName,
                exercise.section,
                exercise.index,
                "uploaded",
                { uploadedUrl: storageUrl },
              );
              setExerciseImages((prev) => ({
                ...prev,
                [imageKey]: storageUrl,
              }));
              dayUploaded++;
              consecutiveErrors = 0;
            } else {
              // Generate image
              imgDebug(`${progress} 🎨 Generating (timeout: 60s)...`);
              const description =
                exercise.exerciseDescription?.trim() ||
                (await fetchPlanExerciseDescription(storageUrl)) ||
                "";
              if (!description) {
                imgDebug(
                  `${progress} ⚠️ Missing description in user_workout_plan_exercises.description`,
                );
                currentState = updateExerciseStatus(
                  currentState,
                  exercise.dayName,
                  exercise.section,
                  exercise.index,
                  "failed",
                  {
                    error:
                      "Missing description in user_workout_plan_exercises.description",
                  },
                );
                dayFailed++;
                consecutiveErrors++;
                continue;
              }

              const generateStartTime = Date.now();
              const result = await generateExerciseImage(
                exercise.exerciseName,
                description,
                currentState.gender,
                60000,
              );
              const generateDuration = Date.now() - generateStartTime;
              imgDebug(
                `${progress} ⏱️ Generation took ${(generateDuration / 1000).toFixed(1)}s`,
              );

              if (result.success && result.image) {
                setExerciseImages((prev) => ({
                  ...prev,
                  [imageKey]: result.image!,
                }));
                imgDebug(`${progress} ✅ Generated`);

                // Upload to storage
                imgDebug(`${progress} 📤 Uploading...`);
                const uploadResult = await uploadImageToStorage(
                  result.image,
                  currentState.gender,
                  exercise.imageSlug,
                );

                if (uploadResult.success) {
                  await markPlanExercisesImageGenerated(storageUrl);
                  storageExistenceCache.set(storageUrl, true);
                  imgDebug(`${progress} ✅ Uploaded: ${uploadResult.url}`);
                  currentState = updateExerciseStatus(
                    currentState,
                    exercise.dayName,
                    exercise.section,
                    exercise.index,
                    "uploaded",
                    { uploadedUrl: uploadResult.url },
                  );
                  // Update with final URL
                  setExerciseImages((prev) => ({
                    ...prev,
                    [imageKey]: uploadResult.url!,
                  }));
                  dayUploaded++;
                  consecutiveErrors = 0;
                } else {
                  imgDebug(
                    `${progress} ⚠️ Upload failed: ${uploadResult.error}`,
                  );
                  currentState = updateExerciseStatus(
                    currentState,
                    exercise.dayName,
                    exercise.section,
                    exercise.index,
                    "failed",
                    {
                      error: uploadResult.error,
                      retryCount: exercise.retryCount + 1,
                    },
                  );
                  dayFailed++;
                  consecutiveErrors++;
                }
              } else {
                imgDebug(
                  `${progress} ❌ Generation failed: ${result.error}`,
                );
                currentState = updateExerciseStatus(
                  currentState,
                  exercise.dayName,
                  exercise.section,
                  exercise.index,
                  "failed",
                  { error: result.error, retryCount: exercise.retryCount + 1 },
                );
                consecutiveErrors++;
                dayFailed++;
                if (isImageQuotaExceededError(result.error)) {
                  quotaExceeded = true;
                  quotaPauseUntilRef.current = Date.now() + QUOTA_PAUSE_MS;
                  console.warn(
                    `[ImageGenContext] Quota reached. Pausing image generation for ${Math.ceil(QUOTA_PAUSE_MS / 1000)}s.`,
                  );
                }
              }
            }
          } catch (err: unknown) {
            console.error(`${progress} ❌ Error:`, err);
            if (!exercise) {
              continue;
            }
            const errorMessage =
              err instanceof Error ? err.message : "Image generation failed";
            currentState = updateExerciseStatus(
              currentState,
              exercise.dayName,
              exercise.section,
              exercise.index,
              "failed",
              { error: errorMessage, retryCount: exercise.retryCount + 1 },
            );
            dayFailed++;
            consecutiveErrors++;
            if (isImageQuotaExceededError(errorMessage)) {
              quotaExceeded = true;
              quotaPauseUntilRef.current = Date.now() + QUOTA_PAUSE_MS;
              console.warn(
                `[ImageGenContext] Quota reached. Pausing image generation for ${Math.ceil(QUOTA_PAUSE_MS / 1000)}s.`,
              );
            }
          } finally {
            setGeneratingImages((prev) => {
              const next = new Set(prev);
              next.delete(imageKey);
              return next;
            });
          }

          saveImageGenState(currentState, storageKey);
          setImageGenStats(currentState.stats);
          setImageGenState(currentState);

          if (quotaExceeded) {
            break;
          }

          // Delay between exercises to avoid quota spikes.
          await wait(randomBetween(EXERCISE_DELAY_MIN_MS, EXERCISE_DELAY_MAX_MS));

          exercise = getNextPendingExercise(currentState, dayName);
        }

        if (quotaExceeded) {
          console.warn(
            `[ImageGenContext] Paused ${dayName} due to quota exhaustion.`,
          );
          break;
        }

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.warn(
            `⚠️ Too many consecutive errors (${consecutiveErrors}), pausing ${dayName}`,
          );
        }

        // Re-check DB before moving to next day. If any rows for this day are
        // still NULL/FALSE, keep processing this same day first.
        const activePlanIdForDay = getQueuedDayPlanId(dayName, currentState.planId);
        const pendingDbExercises = await fetchPendingDayExercisesFromDatabase(
          activePlanIdForDay,
          dayName,
          currentState.gender,
        );
        if (pendingDbExercises.length > 0) {
          const keyFor = (exerciseEntry: {
            section: string;
            imageSlug: string;
          }): string => `${exerciseEntry.section}|${exerciseEntry.imageSlug}`;

          const pendingByKey = new Map<string, ImageGenExercise>();
          pendingDbExercises.forEach((pendingExercise) => {
            pendingByKey.set(keyFor(pendingExercise), pendingExercise);
          });

          let requeuedCount = 0;
          const reconciledExercises = currentState.exercises.map((existing) => {
            if (existing.dayName !== dayName) return existing;
            const pendingMatch = pendingByKey.get(keyFor(existing));
            if (!pendingMatch) return existing;

            if (existing.status === "pending" || existing.status === "generating") {
              return existing;
            }

            if (existing.status === "uploaded" || existing.retryCount < 3) {
              requeuedCount += 1;
              return {
                ...existing,
                status: "pending" as const,
                error: undefined,
              };
            }

            return existing;
          });

          const existingDayKeys = new Set(
            reconciledExercises
              .filter((exerciseRow) => exerciseRow.dayName === dayName)
              .map((exerciseRow) => keyFor(exerciseRow)),
          );
          const missingExercises = pendingDbExercises.filter(
            (pendingExercise) => !existingDayKeys.has(keyFor(pendingExercise)),
          );

          const recoverableCount = requeuedCount + missingExercises.length;
          if (recoverableCount > 0) {
            currentState = {
              ...currentState,
              completedDays: currentState.completedDays.filter((d) => d !== dayName),
              exercises: [...reconciledExercises, ...missingExercises],
            };
            saveImageGenState(currentState, storageKey);
            setImageGenState(currentState);
            setImageGenStats(currentState.stats);
            setCompletedImageDays((prev) => {
              const next = new Set(prev);
              next.delete(dayName);
              return next;
            });

            imgDebug(
              `[ImageGenContext] Day re-check found ${pendingDbExercises.length} DB-pending rows; re-queued ${recoverableCount} for ${dayName} before next day.`,
            );
            continue;
          }

          console.warn(
            `[ImageGenContext] Day re-check still has ${pendingDbExercises.length} DB-pending rows with no recoverable local entries; continuing queue progression.`,
          );
        }

        // Check if day is complete
        if (isDayComplete(currentState, dayName)) {
          currentState = markDayCompleted(currentState, dayName);
          saveImageGenState(currentState, storageKey);
          setCompletedImageDays((prev) => new Set(prev).add(dayName));
          imgDebug(
            `\n✅ ${dayName.toUpperCase()} COMPLETE! (${dayUploaded} uploaded, ${dayFailed} failed)`,
          );
        } else {
          imgDebug(
            `\n⚠️ ${dayName.toUpperCase()} has ${dayFailed} failed exercises`,
          );
        }

        const nextQueuedDay = currentState.dayOrder
          .slice(dayIndex + 1)
          .find((queuedDay) => !currentState.completedDays.includes(queuedDay));
        const currentQueuedPlanId = getQueuedDayPlanId(dayName, currentState.planId);
        const nextQueuedPlanId = nextQueuedDay
          ? getQueuedDayPlanId(nextQueuedDay, currentState.planId)
          : null;
        const isCrossingToAnotherPlan =
          Boolean(nextQueuedDay) &&
          Boolean(currentQueuedPlanId) &&
          Boolean(nextQueuedPlanId) &&
          currentQueuedPlanId !== nextQueuedPlanId;

        if (isCrossingToAnotherPlan && currentQueuedPlanId) {
          const pendingCurrentPlanExercises =
            await fetchPendingPlanExercisesFromDatabase(
              currentQueuedPlanId,
              currentState.gender,
            );

          if (pendingCurrentPlanExercises.length > 0) {
            const queueKeyFor = (exerciseEntry: {
              dayName: string;
              section: string;
              imageSlug: string;
            }): string =>
              `${exerciseEntry.dayName}|${exerciseEntry.section}|${exerciseEntry.imageSlug}`;

            const pendingByKey = new Map<string, ImageGenExercise>();
            pendingCurrentPlanExercises.forEach((exerciseEntry) => {
              pendingByKey.set(queueKeyFor(exerciseEntry), exerciseEntry);
            });

            let requeuedCount = 0;
            const reconciledExercises = currentState.exercises.map((existing) => {
              const existingPlanId = getQueuedDayPlanId(
                existing.dayName,
                currentState.planId,
              );
              if (existingPlanId !== currentQueuedPlanId) return existing;

              const pendingMatch = pendingByKey.get(queueKeyFor(existing));
              if (!pendingMatch) return existing;

              if (existing.status === "pending" || existing.status === "generating") {
                return existing;
              }

              if (existing.status === "uploaded" || existing.retryCount < 3) {
                requeuedCount += 1;
                return {
                  ...existing,
                  status: "pending" as const,
                  error: undefined,
                };
              }

              return existing;
            });

            const existingKeys = new Set(
              reconciledExercises.map((exerciseEntry) => queueKeyFor(exerciseEntry)),
            );
            const missingExercises = pendingCurrentPlanExercises.filter(
              (exerciseEntry) => !existingKeys.has(queueKeyFor(exerciseEntry)),
            );
            const recoverableCount = requeuedCount + missingExercises.length;
            const hasRunnablePending = reconciledExercises.some((existing) => {
              const existingPlanId = getQueuedDayPlanId(
                existing.dayName,
                currentState.planId,
              );
              if (existingPlanId !== currentQueuedPlanId) return false;
              if (!pendingByKey.has(queueKeyFor(existing))) return false;
              return (
                existing.status === "pending" || existing.status === "generating"
              );
            });

            if (recoverableCount > 0 || hasRunnablePending) {
              const currentPlanDaysFromQueue = Array.from(
                new Set(
                  currentState.dayOrder.filter(
                    (queuedDay) =>
                      getQueuedDayPlanId(queuedDay, currentState.planId) ===
                      currentQueuedPlanId,
                  ),
                ),
              );
              const currentPlanDaysFromDb = Array.from(
                new Set(
                  pendingCurrentPlanExercises.map((exerciseEntry) => exerciseEntry.dayName),
                ),
              );
              const mergedCurrentPlanDays = Array.from(
                new Set([...currentPlanDaysFromQueue, ...currentPlanDaysFromDb]),
              );
              const remainingPlanDays = currentState.dayOrder.filter(
                (queuedDay) =>
                  getQueuedDayPlanId(queuedDay, currentState.planId) !==
                  currentQueuedPlanId,
              );

              currentState = {
                ...currentState,
                planId: currentQueuedPlanId,
                dayOrder: [...mergedCurrentPlanDays, ...remainingPlanDays],
                completedDays: currentState.completedDays.filter(
                  (queuedDay) =>
                    !mergedCurrentPlanDays.includes(queuedDay),
                ),
                exercises: [...reconciledExercises, ...missingExercises],
              };
              saveImageGenState(currentState, storageKey);
              setImageGenState(currentState);
              setImageGenStats(currentState.stats);
              setCompletedImageDays((prev) => {
                const next = new Set(prev);
                mergedCurrentPlanDays.forEach((queuedDay) => next.delete(queuedDay));
                return next;
              });

              imgDebug(
                `[ImageGenContext] Plan switch blocked: ${pendingCurrentPlanExercises.length} DB-pending row(s) found for plan ${currentQueuedPlanId}; recovered ${recoverableCount}, pending-in-queue=${hasRunnablePending}.`,
              );
              continue;
            }

            console.warn(
              `[ImageGenContext] Plan switch found unresolved pending rows for plan ${currentQueuedPlanId} with no recoverable local entries; continuing with remaining queued work.`,
            );
          }
        }

        // Delay before next day
        const remainingDays = currentState.dayOrder.filter(
          (d) => !currentState.completedDays.includes(d),
        );
        if (remainingDays.length > 0) {
          imgDebug(
            `\n[ImageGenContext] Day complete. Waiting ${Math.ceil(DAY_PAUSE_MS / 1000)}s before next day...`,
          );
          await wait(DAY_PAUSE_MS);
        }

        dayIndex += 1;
      }

      // Final summary
      const finalState = getImageGenState(storageKey);
      imgDebug(`\n${"═".repeat(65)}`);
      imgDebug(`🎉 [ImageGenContext] IMAGE GENERATION COMPLETE!`);
      imgDebug(`${"─".repeat(65)}`);
      if (finalState) {
        imgDebug(`📊 Final Stats:`);
        imgDebug(`   Total: ${finalState.stats.total}`);
        imgDebug(`   ✅ Uploaded: ${finalState.stats.uploaded}`);
        imgDebug(`   ❌ Failed: ${finalState.stats.failed}`);
        imgDebug(
          `   📁 Completed Days: ${finalState.completedDays.join(", ")}`,
        );
      }
      imgDebug(`${"═".repeat(65)}\n`);
    } catch (error) {
      console.error(
        "[ImageGenContext] ❌ Image generation error (will auto-restart):",
        error,
      );
    } finally {
      isProcessingImagesRef.current = false;
      setIsProcessingImages(false);
      setCurrentImageGenDay(null);
    }
  }, [getStorageKey]);

  // Auto-restart processing if interrupted
  useEffect(() => {
    const checkAndRestartProcessing = () => {
      if (isProcessingImagesRef.current) return;
      if (processingAbortedRef.current) return;
      if (quotaPauseUntilRef.current > Date.now()) return;

      const storageKey = getStorageKey();
      const state = getImageGenState(storageKey);
      if (!state) return;

      // Check for stale processing
      const STALE_TIMEOUT_MS = 90000;
      const isStale =
        isProcessingImagesRef.current &&
        Date.now() - lastActivityTimeRef.current > STALE_TIMEOUT_MS;

      if (isStale) {
        console.warn(
          `⚠️ [ImageGenContext] Processing appears stale, forcing restart...`,
        );
        isProcessingImagesRef.current = false;
        if (state) {
          const stuckExercises = state.exercises.filter(
            (ex) => ex.status === "generating",
          );
          if (stuckExercises.length > 0) {
            const updatedState = {
              ...state,
              stats: {
                ...state.stats,
                pending: state.stats.pending + stuckExercises.length,
              },
              exercises: state.exercises.map((ex) =>
                ex.status === "generating"
                  ? { ...ex, status: "pending" as const }
                  : ex,
              ),
            };
            saveImageGenState(updatedState, storageKey);
          }
        }
      }

      // Check for pending work
      const hasPendingWork = state.stats.pending > 0;
      const hasStuckGenerating = state.exercises.some(
        (ex) => ex.status === "generating",
      );

      if (hasPendingWork || hasStuckGenerating) {
        imgDebug(
          `🔄 [ImageGenContext] Auto-restarting image processing... (pending: ${state.stats.pending})`,
        );
        if (hasStuckGenerating) {
          const updatedState = {
            ...state,
            exercises: state.exercises.map((ex) =>
              ex.status === "generating"
                ? { ...ex, status: "pending" as const }
                : ex,
            ),
          };
          saveImageGenState(updatedState, storageKey);
        }
        setTimeout(() => {
          if (!isProcessingImagesRef.current) {
            processImageGenerationQueue();
          }
        }, 500);
      }
    };

    // Check every 2 seconds
    const intervalId = setInterval(checkAndRestartProcessing, 2000);

    // Check on mount
    setTimeout(checkAndRestartProcessing, 1000);

    return () => clearInterval(intervalId);
  }, [getStorageKey, processImageGenerationQueue]);

  // Resume processing promptly on tab/window lifecycle events and cross-tab
  // state updates so queue work keeps moving when users navigate around.
  useEffect(() => {
    const resumeIfNeeded = (reason: string) => {
      if (processingAbortedRef.current) return;
      if (quotaPauseUntilRef.current > Date.now()) return;

      const storageKey = getStorageKey();
      const state = getImageGenState(storageKey);
      if (!state) return;

      const hasWork =
        state.stats.pending > 0 ||
        state.exercises.some(
          (ex) =>
            ex.status === "pending" ||
            ex.status === "generating",
        );
      if (!hasWork) return;

      imgDebug(
        `[ImageGenContext] Resume trigger: ${reason} (session=${state.sessionId}, pending=${state.stats.pending})`,
      );
      if (!isProcessingImagesRef.current) {
        setTimeout(() => {
          if (!isProcessingImagesRef.current) {
            processImageGenerationQueue();
          }
        }, 100);
      }
    };

    const handleVisibilityChange = () => {
      resumeIfNeeded(`visibility:${document.visibilityState}`);
    };
    const handleFocus = () => resumeIfNeeded("window:focus");
    const handlePageShow = () => resumeIfNeeded("window:pageshow");
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || !event.key.startsWith(IMAGE_GEN_STORAGE_KEY_PREFIX)) {
        return;
      }
      resumeIfNeeded("storage:update");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("storage", handleStorage);

    // Run once on mount to recover any existing pending queue immediately.
    resumeIfNeeded("mount");

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("storage", handleStorage);
    };
  }, [getStorageKey, processImageGenerationQueue]);

  // Queue day for image generation
  const queueDayForImageGeneration = useCallback(
    (
      dayName: string,
      dayResult: DayWorkoutResponse,
      gender: "male" | "female",
      dayOrder?: string[],
      planId?: string | null,
    ) => {
      processingAbortedRef.current = false;
      const storageKey = getStorageKey();
      let state = getImageGenState(storageKey);
      const incomingPlanId = planId ?? null;
      const parsedIncomingDay = parseQueuedDayMetadata(dayName);
      const canonicalDayName = incomingPlanId
        ? buildQueuedDayName(
            parsedIncomingDay.dayLabel || dayName,
            parsedIncomingDay.weekNumber ?? 1,
            incomingPlanId,
            parsedIncomingDay.dayPlanId,
          )
        : dayName;
      const canonicalIncomingDayOrder = Array.from(
        new Set(
          (dayOrder || [dayName]).map((candidate) => {
            if (!incomingPlanId) return candidate;
            const parsedCandidate = parseQueuedDayMetadata(candidate);
            return buildQueuedDayName(
              parsedCandidate.dayLabel || candidate,
              parsedCandidate.weekNumber ?? parsedIncomingDay.weekNumber ?? 1,
              incomingPlanId,
              parsedCandidate.dayPlanId,
            );
          }),
        ),
      );

      if (!state) {
        state = createImageGenSession(
          gender,
          canonicalIncomingDayOrder,
          incomingPlanId,
        );
        imgDebug(
          `📋 [ImageGenContext] Created new image generation session: ${state.sessionId}`,
        );
      } else if (
        incomingPlanId &&
        state.planId &&
        state.planId !== incomingPlanId
      ) {
        if (isDraftPlanId(state.planId)) {
          state = { ...state, planId: incomingPlanId };
          imgDebug(
            `[ImageGenContext] Bound draft queue ${state.sessionId} to saved plan ${incomingPlanId}.`,
          );
        } else {
          // Keep current queue and append newly saved plan after existing work.
          state = { ...state, planId: null };
          imgDebug(
            `[ImageGenContext] Appending plan ${incomingPlanId} behind existing queued plan(s).`,
          );
        }
      } else if (incomingPlanId && state.planId !== incomingPlanId) {
        state =
          state.exercises.length === 0
            ? { ...state, planId: incomingPlanId }
            : { ...state, planId: null };
      }

      canonicalIncomingDayOrder.forEach((queuedDay) => {
        if (!state!.dayOrder.includes(queuedDay)) {
          state!.dayOrder.push(queuedDay);
        }
      });

      if (state.completedDays.includes(canonicalDayName)) {
        imgDebug(
          `[ImageGenContext] ${canonicalDayName} already completed; skipping enqueue.`,
          { planId: state.planId, sessionId: state.sessionId },
        );
        return;
      }

      const sections = [
        { key: "warm_up", exercises: dayResult.warm_up || [] },
        { key: "main_workout", exercises: dayResult.main_workout || [] },
        { key: "cooldown", exercises: dayResult.cooldown || [] },
      ];

      const exercisesToAdd: Array<{
        section: string;
        index: number;
        name: string;
        description: string;
      }> = [];

      sections.forEach(({ key, exercises }) => {
        exercises.forEach((ex, index) => {
          if (ex.name) {
            exercisesToAdd.push({
              section: key,
              index,
              name: ex.name,
              description:
                ex.description || ex.safety_cue || "A fitness exercise",
            });
          }
        });
      });

      state = addExercisesToState(state, canonicalDayName, exercisesToAdd);
      saveImageGenState(state, storageKey);
      setImageGenState(state);
      setImageGenStats(state.stats);

      imgDebug("[ImageGenContext] Day queued for image generation.", {
        sessionId: state.sessionId,
        planId: state.planId,
        dayName: canonicalDayName,
        addedExercises: exercisesToAdd.length,
        pending: state.stats.pending,
        total: state.stats.total,
      });
      imgDebug(
        `📋 [ImageGenContext] Added ${exercisesToAdd.length} exercises for ${canonicalDayName}`,
      );
      imgDebug(
        `📊 Total state: ${state.stats.total} exercises, ${state.stats.pending} pending`,
      );

      processImageGenerationQueue();
    },
    [getStorageKey, processImageGenerationQueue],
  );

  // Clear all image generation
  const clearImageGeneration = useCallback(() => {
    processingAbortedRef.current = true;
    const storageKey = getStorageKey();
    clearStoredImageGenState(storageKey);
    setImageGenState(null);
    setImageGenStats({ total: 0, pending: 0, uploaded: 0, failed: 0 });
    setExerciseImages({});
    setGeneratingImages(new Set());
    setCompletedImageDays(new Set());
    isProcessingImagesRef.current = false;
    setIsProcessingImages(false);
    setCurrentImageGenDay(null);
    imgDebug("🗑️ [ImageGenContext] Cleared all image generation state");
  }, [getStorageKey]);

  // Retry failed images
  const retryFailedImages = useCallback(() => {
    processingAbortedRef.current = false;
    const storageKey = getStorageKey();
    const state = getImageGenState(storageKey);
    if (!state) return;

    const failed = state.exercises.filter((ex) => ex.status === "failed");
    if (failed.length === 0) {
      imgDebug("[ImageGenContext] ✅ No failed images to retry");
      return;
    }

    imgDebug(`🔄 [ImageGenContext] Retrying ${failed.length} failed images`);

    let updatedState = state;
    failed.forEach((ex) => {
        updatedState = updateExerciseStatus(
          updatedState,
          ex.dayName,
          ex.section,
          ex.index,
          "pending",
          { error: undefined, retryCount: 0 },
        );
      });
    saveImageGenState(updatedState, storageKey);
    setImageGenState(updatedState);
    setImageGenStats(updatedState.stats);

    processImageGenerationQueue();
  }, [getStorageKey, processImageGenerationQueue]);

  // Pause image generation
  const pauseImageGeneration = useCallback(() => {
    processingAbortedRef.current = true;
    imgDebug("[ImageGenContext] ⏸️ Image generation paused");
  }, []);

  // Resume image generation
  const resumeImageGeneration = useCallback(() => {
    processingAbortedRef.current = false;
    processImageGenerationQueue();
    imgDebug("[ImageGenContext] ▶️ Image generation resumed");
  }, [processImageGenerationQueue]);

  const syncPendingImagesFromDatabase = useCallback(
    async (reason = "manual-sync"): Promise<boolean> => {
      processingAbortedRef.current = false;

      const bootstrapped = await bootstrapPendingQueueFromDatabase(reason);
      const storageKey = getStorageKey();
      const state = getImageGenState(storageKey);
      const hasWork = Boolean(
        state &&
          (state.stats.pending > 0 ||
            state.exercises.some(
              (ex) =>
                ex.status === "pending" || ex.status === "generating",
            )),
      );

      if (
        hasWork &&
        !isProcessingImagesRef.current &&
        quotaPauseUntilRef.current <= Date.now()
      ) {
        setTimeout(() => {
          if (!isProcessingImagesRef.current) {
            processImageGenerationQueue();
          }
        }, 100);
      }

      return bootstrapped || hasWork;
    },
    [bootstrapPendingQueueFromDatabase, getStorageKey, processImageGenerationQueue],
  );

  // Restart image generation for a specific day
  const restartDayImageGeneration = useCallback(
    (
      dayName: string,
      dayResult: DayWorkoutResponse,
      gender: "male" | "female",
    ) => {
      let planIdForRetry: string | null = null;
      let dayOrderForRetry: string[] | undefined;
      imgDebug(
        `🔄 [ImageGenContext] Restarting image generation for ${dayName}`,
      );

      // Clear images for this day
      setExerciseImages((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          if (key.startsWith(`${dayName}-`)) {
            delete updated[key];
          }
        });
        return updated;
      });

      // Update localStorage state
      const storageKey = getStorageKey();
      const state = getImageGenState(storageKey);
      if (state) {
        planIdForRetry = state.planId ?? null;
        dayOrderForRetry = state.dayOrder;
        const updatedCompletedDays = state.completedDays.filter(
          (d) => d !== dayName,
        );
        const updatedExercises = state.exercises.filter(
          (ex) => ex.dayName !== dayName,
        );
        const updatedDayOrder = state.dayOrder.filter((d) => d !== dayName);

        const updatedState: ImageGenState = {
          ...state,
          completedDays: updatedCompletedDays,
          exercises: updatedExercises,
          dayOrder: updatedDayOrder,
          stats: {
            total: updatedExercises.length,
            pending: updatedExercises.filter((ex) => ex.status === "pending")
              .length,
            generating: updatedExercises.filter(
              (ex) => ex.status === "generating",
            ).length,
            uploaded: updatedExercises.filter((ex) => ex.status === "uploaded")
              .length,
            failed: updatedExercises.filter((ex) => ex.status === "failed")
              .length,
          },
        };

        saveImageGenState(updatedState, storageKey);
        setImageGenState(updatedState);
        setImageGenStats(updatedState.stats);
      }

      setCompletedImageDays((prev) => {
        const updated = new Set(prev);
        updated.delete(dayName);
        return updated;
      });

      // Re-queue the day
      setTimeout(() => {
        queueDayForImageGeneration(
          dayName,
          dayResult,
          gender,
          dayOrderForRetry,
          planIdForRetry,
        );
      }, 500);
    },
    [getStorageKey, queueDayForImageGeneration],
  );

  // Set exercise image
  const setExerciseImage = useCallback((key: string, url: string) => {
    setExerciseImages((prev) => ({ ...prev, [key]: url }));
  }, []);

  // Check if day images are complete
  const isDayImagesComplete = useCallback(
    (dayName: string): boolean => {
      const state = getImageGenState(getStorageKey());
      if (!state) return false;
      return (
        completedImageDays.has(dayName) || state.completedDays.includes(dayName)
      );
    },
    [completedImageDays, getStorageKey],
  );

  // Get day image counts
  const getDayImageCounts = useCallback(
    (dayName: string): { total: number; ready: number; generating: number } => {
      const state = getImageGenState(getStorageKey());
      if (!state) return { total: 0, ready: 0, generating: 0 };

      const dayExercises = state.exercises.filter(
        (ex) => ex.dayName === dayName,
      );
      const ready = dayExercises.filter(
        (ex) => ex.status === "uploaded",
      ).length;
      const generating = dayExercises.filter(
        (ex) => ex.status === "generating",
      ).length;

      // Also count from exerciseImages
      let imageCount = 0;
      Object.keys(exerciseImages).forEach((key) => {
        if (key.startsWith(`${dayName}-`)) {
          imageCount++;
        }
      });

      return {
        total: dayExercises.length,
        ready: Math.max(ready, imageCount),
        generating,
      };
    },
    [exerciseImages, getStorageKey],
  );

  // Check if exercise is generating
  const isExerciseGenerating = useCallback(
    (key: string): boolean => {
      return generatingImages.has(key);
    },
    [generatingImages],
  );

  // Get exercise image URL
  const getExerciseImageUrl = useCallback(
    (key: string): string | undefined => {
      return exerciseImages[key];
    },
    [exerciseImages],
  );

  const value: ImageGenerationContextType = {
    // State
    imageGenState,
    imageGenStats,
    isProcessingImages,
    currentImageGenDay,
    exerciseImages,
    generatingImages,
    completedImageDays,

    // Actions
    queueDayForImageGeneration,
    clearImageGeneration,
    retryFailedImages,
    pauseImageGeneration,
    resumeImageGeneration,
    syncPendingImagesFromDatabase,
    restartDayImageGeneration,
    setExerciseImage,

    // Utilities
    isDayImagesComplete,
    getDayImageCounts,
    isExerciseGenerating,
    getExerciseImageUrl,
  };

  return (
    <ImageGenerationContext.Provider value={value}>
      {children}
    </ImageGenerationContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useImageGeneration(): ImageGenerationContextType {
  const context = useContext(ImageGenerationContext);
  if (context === undefined) {
    throw new Error(
      "useImageGeneration must be used within an ImageGenerationProvider",
    );
  }
  return context;
}




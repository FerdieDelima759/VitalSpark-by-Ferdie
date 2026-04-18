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
import { getUserSessionData } from "@/utils/sessionStorage";

// ============================================================================
// TYPES
// ============================================================================

export interface BackgroundImageGenExercise {
  id: string;
  name: string;
  imagePath: string;
  imageSlug: string;
  section: string;
  description?: string | null;
  gender?: "male" | "female";
  status:
    | "pending"
    | "checking"
    | "generating"
    | "uploaded"
    | "exists"
    | "failed";
  error?: string;
  uploadedUrl?: string;
}

export interface BackgroundImageGenStats {
  total: number;
  pending: number;
  checking: number;
  generating: number;
  completed: number; // uploaded + exists
  failed: number;
}

interface BackgroundImageGenerationContextType {
  // State
  isInitialized: boolean;
  isProcessing: boolean;
  currentExercise: string | null;
  stats: BackgroundImageGenStats;
  exercises: BackgroundImageGenExercise[];
  userGender: "male" | "female";

  // Actions
  startBackgroundGeneration: () => void;
  pauseBackgroundGeneration: () => void;
  resumeBackgroundGeneration: () => void;
  retryFailedImages: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = "vitalspark_bg_image_gen_state";
const CHECK_DELAY_MS = 500; // Delay between checking each image
const GENERATE_DELAY_MS = 1500; // Delay between generating each image
const MAX_CONSECUTIVE_ERRORS = 5;

// Debug mode - set to true to enable verbose logging
const DEBUG = process.env.NODE_ENV === "development";

// ============================================================================
// LOGGER - Optimized console logging
// ============================================================================

const log = {
  info: (msg: string) => DEBUG && console.log(`[BgImg] ${msg}`),
  warn: (msg: string) => console.warn(`[BgImg] ${msg}`),
  error: (msg: string, err?: unknown) =>
    console.error(`[BgImg] ${msg}`, err || ""),
  progress: (current: number, total: number, name: string, status: string) =>
    DEBUG && console.log(`[BgImg] [${current}/${total}] ${name}: ${status}`),
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Upload base64 image to Supabase Storage
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

const uploadImageToStorage = async (
  base64Image: string,
  gender: "male" | "female",
  imageSlug: string,
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
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
  } catch (err: any) {
    return { success: false, error: err?.message || "Upload failed" };
  }
};

const fetchPlanExerciseImageStatus = async (
  imagePath: string,
): Promise<{ hasRecords: boolean; shouldProcess: boolean }> => {
  try {
    const { data, error } = await supabase
      .from("user_workout_plan_exercises")
      .select("id,is_image_generated")
      .eq("image_path", imagePath)
      .or("is_image_generated.is.null,is_image_generated.eq.false");

    if (error) {
      log.warn(`Failed to read is_image_generated: ${error.message}`);
      return { hasRecords: false, shouldProcess: true };
    }

    if (!data || data.length === 0) {
      return { hasRecords: true, shouldProcess: false };
    }

    return { hasRecords: true, shouldProcess: true };
  } catch {
    log.warn("is_image_generated check failed");
    return { hasRecords: false, shouldProcess: true };
  }
};

const parseImagePathMetadata = (
  imagePath: string,
): { gender: "male" | "female"; imageSlug: string } | null => {
  const match = imagePath.match(
    /\/exercises\/(male|female)\/(.+?)\.png(?:\?|$)/i,
  );
  if (!match?.[1] || !match?.[2]) return null;

  return {
    gender: match[1].toLowerCase() === "male" ? "male" : "female",
    imageSlug: match[2],
  };
};

const formatTitleCase = (value: string): string =>
  value.replace(/\w\S*/g, (word) => {
    const lower = word.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });

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
  return formatTitleCase(namePart.replace(/-/g, " ").trim() || "Exercise");
};

const checkImageUrlExists = async (imagePath: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(imagePath, {
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
      log.warn(`Failed to read description: ${error.message}`);
      return null;
    }

    const description = data?.[0]?.description;
    if (typeof description !== "string") return null;

    const trimmed = description.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    log.warn("description read failed");
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
      log.warn(`Failed to update is_image_generated: ${error.message}`);
    }
  } catch {
    log.warn("is_image_generated update failed");
  }
};

// Get stored state
const getStoredState = (): BackgroundImageGenExercise[] | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as BackgroundImageGenExercise[];
  } catch {
    return null;
  }
};

// Save state to localStorage
const saveState = (exercises: BackgroundImageGenExercise[]): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exercises));
  } catch (err) {
    log.error("Failed to save state", err);
  }
};

// ============================================================================
// CONTEXT
// ============================================================================

const BackgroundImageGenerationContext = createContext<
  BackgroundImageGenerationContextType | undefined
>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface BackgroundImageGenerationProviderProps {
  children: ReactNode;
}

export function BackgroundImageGenerationProvider({
  children,
}: BackgroundImageGenerationProviderProps): React.ReactElement {
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentExercise, setCurrentExercise] = useState<string | null>(null);
  const [exercises, setExercises] = useState<BackgroundImageGenExercise[]>([]);
  const [userGender, setUserGender] = useState<"male" | "female">("female");
  const [stats, setStats] = useState<BackgroundImageGenStats>({
    total: 0,
    pending: 0,
    checking: 0,
    generating: 0,
    completed: 0,
    failed: 0,
  });

  // Refs
  const isProcessingRef = useRef(false);
  const isPausedRef = useRef(false);
  const exercisesRef = useRef<BackgroundImageGenExercise[]>([]);
  const userGenderRef = useRef<"male" | "female">("female");

  // Keep refs in sync with state
  useEffect(() => {
    exercisesRef.current = exercises;
  }, [exercises]);

  useEffect(() => {
    userGenderRef.current = userGender;
  }, [userGender]);

  // Calculate stats from exercises
  const calculateStats = useCallback(
    (exerciseList: BackgroundImageGenExercise[]): BackgroundImageGenStats => {
      return {
        total: exerciseList.length,
        pending: exerciseList.filter((e) => e.status === "pending").length,
        checking: exerciseList.filter((e) => e.status === "checking").length,
        generating: exerciseList.filter((e) => e.status === "generating")
          .length,
        completed: exerciseList.filter(
          (e) => e.status === "uploaded" || e.status === "exists",
        ).length,
        failed: exerciseList.filter((e) => e.status === "failed").length,
      };
    },
    [],
  );

  // Update exercise status
  const updateExerciseStatus = useCallback(
    (
      exerciseId: string,
      status: BackgroundImageGenExercise["status"],
      extras?: Partial<BackgroundImageGenExercise>,
    ) => {
      setExercises((prev) => {
        const updated = prev.map((ex) =>
          ex.id === exerciseId ? { ...ex, status, ...extras } : ex,
        );
        saveState(updated);
        setStats(calculateStats(updated));
        return updated;
      });
    },
    [calculateStats],
  );

  // Fetch user gender from session storage or database
  const fetchUserGender = useCallback(async (): Promise<"male" | "female"> => {
    try {
      // First try session storage
      const sessionData = getUserSessionData();
      if (sessionData.userProfile?.gender) {
        const gender = sessionData.userProfile.gender.toLowerCase();
        return gender === "male" || gender === "m" ? "male" : "female";
      }

      // Fallback: try to fetch from database
      if (sessionData.userId) {
        const { data } = await supabase
          .from("user_profile")
          .select("gender")
          .eq("user_id", sessionData.userId)
          .maybeSingle();

        if (data?.gender) {
          const gender = data.gender.toLowerCase();
          return gender === "male" || gender === "m" ? "male" : "female";
        }
      }

      return "female"; // Default
    } catch {
      return "female";
    }
  }, []);

  // Fetch pending plan exercises from database
  const fetchPendingPlanExercises = useCallback(async (): Promise<
    BackgroundImageGenExercise[]
  > => {
    try {
      const { data, error } = await supabase
        .from("user_workout_plan_exercises")
        .select("id,image_path,image_alt,description,section,is_image_generated")
        .or("is_image_generated.is.null,is_image_generated.eq.false")
        .not("image_path", "is", null)
        .order("position", { ascending: true });

      if (error) {
        log.error("Error fetching pending plan exercises", error);
        return [];
      }

      type PendingPlanExerciseRow = {
        id: string;
        image_path: string | null;
        image_alt: string | null;
        description: string | null;
        section: string | null;
        is_image_generated: boolean | null;
      };

      const uniqueExercises = new Map<string, BackgroundImageGenExercise>();

      ((data || []) as PendingPlanExerciseRow[]).forEach((row) => {
        if (!row.image_path || uniqueExercises.has(row.image_path)) return;

        const parsedPath = parseImagePathMetadata(row.image_path);
        if (!parsedPath) return;

        const exerciseName =
          parseExerciseNameFromImageAlt(row.image_alt) ||
          parseExerciseNameFromSlug(parsedPath.imageSlug);

        uniqueExercises.set(row.image_path, {
          id: row.image_path,
          name: exerciseName,
          imagePath: row.image_path,
          imageSlug: parsedPath.imageSlug,
          section: row.section || "main",
          description: row.description?.trim() || null,
          gender: parsedPath.gender,
          status: "pending",
        });
      });

      return Array.from(uniqueExercises.values());
    } catch (err) {
      log.error("Exception fetching pending plan exercises", err);
      return [];
    }
  }, []);

  // Process image generation queue
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;

    isProcessingRef.current = true;
    setIsProcessing(true);
    isPausedRef.current = false;

    const totalPending = exercisesRef.current.filter(
      (e) => e.status === "pending",
    ).length;
    log.info(`Starting: ${totalPending} images to process`);

    let consecutiveErrors = 0;
    let processed = 0;
    const gender = userGenderRef.current;
    let quotaExceeded = false;

    while (!isPausedRef.current && consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
      const currentExercises = exercisesRef.current;
      const nextExercise = currentExercises.find(
        (ex) => ex.status === "pending",
      );

      if (!nextExercise) break;

      const {
        id: exerciseId,
        imagePath,
        imageSlug,
        name: exerciseName,
        description: cachedDescription,
        gender: queuedGender,
      } = nextExercise;
      processed++;

      if (!imageSlug || !imagePath) {
        updateExerciseStatus(exerciseId, "failed", {
          error: "Missing image metadata",
        });
        continue;
      }

      setCurrentExercise(exerciseName);
      updateExerciseStatus(exerciseId, "checking");
      await new Promise((resolve) => setTimeout(resolve, CHECK_DELAY_MS));

      try {
        const planStatus = await fetchPlanExerciseImageStatus(imagePath);
        if (planStatus.hasRecords && !planStatus.shouldProcess) {
          updateExerciseStatus(exerciseId, "exists", { uploadedUrl: imagePath });
          consecutiveErrors = 0;
          continue;
        }

        const exists = await checkImageUrlExists(imagePath);

        if (exists) {
          log.progress(processed, totalPending, exerciseName, "exists");
          await markPlanExercisesImageGenerated(imagePath);
          updateExerciseStatus(exerciseId, "exists", { uploadedUrl: imagePath });
          consecutiveErrors = 0;
          continue;
        }

        log.progress(processed, totalPending, exerciseName, "generating...");
        updateExerciseStatus(exerciseId, "generating");

        const description =
          cachedDescription?.trim() || (await fetchPlanExerciseDescription(imagePath));
        if (!description) {
          updateExerciseStatus(exerciseId, "failed", {
            error:
              "Missing description in user_workout_plan_exercises.description",
          });
          consecutiveErrors++;
          await new Promise((resolve) =>
            setTimeout(resolve, GENERATE_DELAY_MS),
          );
          continue;
        }

        const result = await generateExerciseImage(
          exerciseName,
          description,
          queuedGender || gender,
          60000,
        );

        if (!result.success || !result.image) {
          log.progress(
            processed,
            totalPending,
            exerciseName,
            `failed: ${result.error}`,
          );
          updateExerciseStatus(exerciseId, "failed", { error: result.error });
          consecutiveErrors++;
          if (isImageQuotaExceededError(result.error)) {
            quotaExceeded = true;
            isPausedRef.current = true;
            log.warn("Quota reached. Pausing background image generation.");
          }
          if (quotaExceeded) {
            break;
          }
          await new Promise((resolve) =>
            setTimeout(resolve, GENERATE_DELAY_MS),
          );
          continue;
        }

        const uploadResult = await uploadImageToStorage(
          result.image,
          queuedGender || gender,
          imageSlug,
        );

        if (!uploadResult.success) {
          log.progress(
            processed,
            totalPending,
            exerciseName,
            `upload failed: ${uploadResult.error}`,
          );
          updateExerciseStatus(exerciseId, "failed", {
            error: uploadResult.error,
          });
          consecutiveErrors++;
        } else {
          log.progress(processed, totalPending, exerciseName, "uploaded");
          await markPlanExercisesImageGenerated(imagePath);
          updateExerciseStatus(exerciseId, "uploaded", {
            uploadedUrl: uploadResult.url,
          });
          consecutiveErrors = 0;
        }

        await new Promise((resolve) => setTimeout(resolve, GENERATE_DELAY_MS));
      } catch (err: any) {
        log.error(`${exerciseName} error`, err);
        updateExerciseStatus(exerciseId, "failed", { error: err?.message });
        consecutiveErrors++;
        if (isImageQuotaExceededError(err?.message)) {
          quotaExceeded = true;
          isPausedRef.current = true;
          log.warn("Quota reached. Pausing background image generation.");
        }
        if (quotaExceeded) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, GENERATE_DELAY_MS));
      }
    }

    if (quotaExceeded) {
      log.warn("Background image generation paused until Gemini quota resets.");
    }

    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      log.warn(`Paused: ${consecutiveErrors} consecutive errors`);
    }

    const finalStats = calculateStats(exercisesRef.current);
    log.info(
      `Done: ${finalStats.completed}/${finalStats.total} complete, ${finalStats.failed} failed`,
    );

    isProcessingRef.current = false;
    setIsProcessing(false);
    setCurrentExercise(null);
  }, [updateExerciseStatus, calculateStats]);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      const gender = await fetchUserGender();
      setUserGender(gender);
      userGenderRef.current = gender;

      // Check for stored state with pending work
      const storedExercises = getStoredState();
      if (storedExercises?.length) {
        const sanitizedStoredExercises = storedExercises.filter(
          (exercise): exercise is BackgroundImageGenExercise =>
            Boolean(exercise.imagePath && exercise.imageSlug),
        );
        const hasPendingWork = sanitizedStoredExercises.some(
          (ex) =>
            ex.status === "pending" ||
            ex.status === "checking" ||
            ex.status === "generating",
        );

        if (hasPendingWork) {
          const restored = sanitizedStoredExercises.map((ex) =>
            ex.status === "checking" || ex.status === "generating"
              ? { ...ex, status: "pending" as const }
              : ex,
          );
          const stats = calculateStats(restored);
          log.info(
            `Restored: ${stats.pending} pending, ${stats.completed} done`,
          );
          setExercises(restored);
          setStats(stats);
          setIsInitialized(true);
          setTimeout(() => processQueue(), 2000);
          return;
        }
      }

      // Fetch fresh pending plan exercises
      const pendingPlanExercises = await fetchPendingPlanExercises();
      if (!pendingPlanExercises.length) {
        setIsInitialized(true);
        return;
      }

      log.info(`Found ${pendingPlanExercises.length} pending plan exercise images`);
      setExercises(pendingPlanExercises);
      setStats(calculateStats(pendingPlanExercises));
      saveState(pendingPlanExercises);
      setIsInitialized(true);
      setTimeout(() => processQueue(), 3000);
    };

    initialize();
  }, [fetchUserGender, fetchPendingPlanExercises, calculateStats, processQueue]);

  // Actions
  const startBackgroundGeneration = useCallback(() => {
    if (!isProcessingRef.current) {
      processQueue();
    }
  }, [processQueue]);

  const pauseBackgroundGeneration = useCallback(() => {
    isPausedRef.current = true;
    log.info("Paused");
  }, []);

  const resumeBackgroundGeneration = useCallback(() => {
    isPausedRef.current = false;
    if (!isProcessingRef.current) {
      processQueue();
    }
    log.info("Resumed");
  }, [processQueue]);

  const retryFailedImages = useCallback(() => {
    setExercises((prev) => {
      const updated = prev.map((ex) =>
        ex.status === "failed"
          ? { ...ex, status: "pending" as const, error: undefined }
          : ex,
      );
      saveState(updated);
      setStats(calculateStats(updated));
      return updated;
    });

    // Start processing if not already running
    setTimeout(() => {
      if (!isProcessingRef.current) {
        processQueue();
      }
    }, 500);
  }, [calculateStats, processQueue]);

  const value: BackgroundImageGenerationContextType = {
    isInitialized,
    isProcessing,
    currentExercise,
    stats,
    exercises,
    userGender,
    startBackgroundGeneration,
    pauseBackgroundGeneration,
    resumeBackgroundGeneration,
    retryFailedImages,
  };

  return (
    <BackgroundImageGenerationContext.Provider value={value}>
      {children}
    </BackgroundImageGenerationContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useBackgroundImageGeneration(): BackgroundImageGenerationContextType {
  const context = useContext(BackgroundImageGenerationContext);
  if (context === undefined) {
    throw new Error(
      "useBackgroundImageGeneration must be used within a BackgroundImageGenerationProvider",
    );
  }
  return context;
}

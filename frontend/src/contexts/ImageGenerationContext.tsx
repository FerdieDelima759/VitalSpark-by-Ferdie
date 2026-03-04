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
import { generateExerciseImage } from "@/lib/gemini";
import type { DayWorkoutResponse } from "@/lib/openai-prompt";

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
  ) => void;
  clearImageGeneration: () => void;
  retryFailedImages: () => void;
  pauseImageGeneration: () => void;
  resumeImageGeneration: () => void;
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

const IMAGE_GEN_STORAGE_KEY = "vitalspark_image_generation_state";

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

// Upload base64 image to Supabase Storage
const uploadImageToStorage = async (
  base64Image: string,
  gender: "male" | "female",
  imageSlug: string,
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    let imageBlob: Blob;
    if (base64Image.startsWith("data:image")) {
      const base64Data = base64Image.split(",")[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      imageBlob = new Blob([byteArray], { type: "image/png" });
    } else {
      const byteCharacters = atob(base64Image);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      imageBlob = new Blob([byteArray], { type: "image/png" });
    }

    const storagePath = `exercises/${gender}/${imageSlug}.png`;

    const { error: uploadError } = await supabase.storage
      .from("workouts")
      .upload(storagePath, imageBlob, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const publicUrl = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/${storagePath}`;
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
      console.warn(
        "[ImageGenContext] Failed to read is_image_generated:",
        error.message,
      );
      return { hasRecords: false, shouldProcess: true };
    }

    if (!data || data.length === 0) {
      return { hasRecords: true, shouldProcess: false };
    }

    return { hasRecords: true, shouldProcess: true };
  } catch (err) {
    console.warn("[ImageGenContext] is_image_generated check failed:", err);
    return { hasRecords: false, shouldProcess: true };
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
const getImageGenState = (): ImageGenState | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(IMAGE_GEN_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ImageGenState;
  } catch {
    return null;
  }
};

const saveImageGenState = (state: ImageGenState): void => {
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
    localStorage.setItem(IMAGE_GEN_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Failed to save image gen state:", err);
  }
};

const clearStoredImageGenState = (): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(IMAGE_GEN_STORAGE_KEY);
    console.log("🗑️ Cleared image generation state from localStorage");
  } catch (err) {
    console.error("Failed to clear image gen state:", err);
  }
};

const createImageGenSession = (
  gender: "male" | "female",
  dayOrder: string[],
): ImageGenState => {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  return {
    sessionId,
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
      const hasWork = state.exercises.some(
        (e) =>
          e.dayName === day &&
          (e.status === "pending" ||
            e.status === "generating" ||
            e.status === "failed"),
      );
      if (hasWork) return day;
      const dayExercises = state.exercises.filter((e) => e.dayName === day);
      if (
        dayExercises.length > 0 &&
        dayExercises.every((e) => e.status === "uploaded")
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

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = getImageGenState();
    if (savedState) {
      console.log("📂 [ImageGenContext] Loaded state from localStorage:", {
        sessionId: savedState.sessionId,
        totalExercises: savedState.exercises.length,
        stats: savedState.stats,
        completedDays: savedState.completedDays,
      });
      setImageGenState(savedState);
      setImageGenStats(savedState.stats);
      setCompletedImageDays(new Set(savedState.completedDays));

      // Restore exercise images from uploaded exercises
      const images: Record<string, string> = {};
      savedState.exercises.forEach((ex) => {
        if (ex.status === "uploaded" && ex.uploadedUrl) {
          const key = `${ex.dayName}-${ex.section}-${ex.index}`;
          images[key] = ex.uploadedUrl;
        }
      });
      if (Object.keys(images).length > 0) {
        setExerciseImages(images);
      }
    }
  }, []);

  // Process image generation queue
  const processImageGenerationQueue = useCallback(async () => {
    if (isProcessingImagesRef.current) {
      console.log(`⏳ [ImageGenContext] Image processing already running...`);
      return;
    }

    processingAbortedRef.current = false;

    const state = getImageGenState();
    if (!state) {
      console.log(`📋 [ImageGenContext] No image generation state found`);
      return;
    }

    const nextDay = getNextDayToProcess(state);
    if (!nextDay) {
      console.log(`✅ [ImageGenContext] All days completed!`);
      setCurrentImageGenDay(null);
      setIsProcessingImages(false);
      return;
    }

    isProcessingImagesRef.current = true;
    setIsProcessingImages(true);
    lastActivityTimeRef.current = Date.now();

    console.log(
      `\n🚀 [ImageGenContext] Starting image generation from localStorage state...`,
    );
    console.log(`📊 Session: ${state.sessionId}`);
    console.log(
      `📋 Days to process: ${state.dayOrder.filter((d) => !state.completedDays.includes(d)).join(" → ")}`,
    );
    console.log(
      `📊 Stats: ${state.stats.pending} pending, ${state.stats.uploaded} uploaded, ${state.stats.failed} failed`,
    );

    try {
      let currentState = state;
      for (const dayName of currentState.dayOrder) {
        if (processingAbortedRef.current) {
          console.log("[ImageGenContext] ⏹️ Processing aborted");
          break;
        }

        if (currentState.completedDays.includes(dayName)) {
          continue;
        }

        console.log(`\n${"═".repeat(65)}`);
        console.log(
          `🎯 [ImageGenContext] PROCESSING: ${dayName.toUpperCase()}`,
        );
        console.log(`${"═".repeat(65)}`);

        setCurrentImageGenDay(dayName);
        currentState = { ...currentState, currentDay: dayName };
        saveImageGenState(currentState);

        let exercise = getNextPendingExercise(currentState, dayName);
        let dayProcessed = 0;
        let dayUploaded = 0;
        let dayFailed = 0;
        let consecutiveErrors = 0;
        const MAX_CONSECUTIVE_ERRORS = 5;

        console.log(
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
          const storageUrl = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/exercises/${currentState.gender}/${exercise.imageSlug}.png`;

          lastActivityTimeRef.current = Date.now();

          console.log(`\n${progress} 🔍 ${exercise.exerciseName}`);
          console.log(`    📂 ${exercise.section} | 🏷️ ${exercise.imageSlug}`);

          try {
            const planStatus = await fetchPlanExerciseImageStatus(storageUrl);
            if (planStatus.hasRecords && !planStatus.shouldProcess) {
              currentState = updateExerciseStatus(
                currentState,
                exercise.dayName,
                exercise.section,
                exercise.index,
                "uploaded",
                { uploadedUrl: storageUrl },
              );
              saveImageGenState(currentState);
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
            saveImageGenState(currentState);
            setGeneratingImages((prev) => new Set(prev).add(imageKey));

            // Check if already exists in storage
            let imageExists = false;
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000);
              const response = await fetch(storageUrl, {
                method: "GET",
                headers: { Range: "bytes=0-0" },
                signal: controller.signal,
              });
              clearTimeout(timeoutId);
              imageExists = response.ok || response.status === 206;
            } catch {
              imageExists = false;
            }

            if (imageExists) {
              await markPlanExercisesImageGenerated(storageUrl);
              console.log(`${progress} ✅ EXISTS in storage`);
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
              console.log(`${progress} 🎨 Generating (timeout: 60s)...`);
              const generateStartTime = Date.now();
              const result = await generateExerciseImage(
                exercise.exerciseName,
                exercise.exerciseDescription,
                currentState.gender,
                60000,
              );
              const generateDuration = Date.now() - generateStartTime;
              console.log(
                `${progress} ⏱️ Generation took ${(generateDuration / 1000).toFixed(1)}s`,
              );

              if (result.success && result.image) {
                setExerciseImages((prev) => ({
                  ...prev,
                  [imageKey]: result.image!,
                }));
                console.log(`${progress} ✅ Generated`);

                // Upload to storage
                console.log(`${progress} 📤 Uploading...`);
                const uploadResult = await uploadImageToStorage(
                  result.image,
                  currentState.gender,
                  exercise.imageSlug,
                );

                if (uploadResult.success) {
                  await markPlanExercisesImageGenerated(storageUrl);
                  console.log(`${progress} ✅ Uploaded: ${uploadResult.url}`);
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
                  console.warn(
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
                console.warn(
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
              }
            }
          } catch (err: any) {
            console.error(`${progress} ❌ Error:`, err);
            if (!exercise) {
              continue;
            }
            currentState = updateExerciseStatus(
              currentState,
              exercise.dayName,
              exercise.section,
              exercise.index,
              "failed",
              { error: err?.message, retryCount: exercise.retryCount + 1 },
            );
            dayFailed++;
            consecutiveErrors++;
          } finally {
            setGeneratingImages((prev) => {
              const next = new Set(prev);
              next.delete(imageKey);
              return next;
            });
          }

          saveImageGenState(currentState);
          setImageGenStats(currentState.stats);

          // Delay between exercises
          await new Promise((resolve) => setTimeout(resolve, 1000));

          exercise = getNextPendingExercise(currentState, dayName);
        }

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.warn(
            `⚠️ Too many consecutive errors (${consecutiveErrors}), pausing ${dayName}`,
          );
        }

        // Check if day is complete
        if (isDayComplete(currentState, dayName)) {
          currentState = markDayCompleted(currentState, dayName);
          saveImageGenState(currentState);
          setCompletedImageDays((prev) => new Set(prev).add(dayName));
          console.log(
            `\n✅ ${dayName.toUpperCase()} COMPLETE! (${dayUploaded} uploaded, ${dayFailed} failed)`,
          );
        } else {
          console.log(
            `\n⚠️ ${dayName.toUpperCase()} has ${dayFailed} failed exercises`,
          );
        }

        // Delay before next day
        const remainingDays = currentState.dayOrder.filter(
          (d) => !currentState.completedDays.includes(d),
        );
        if (remainingDays.length > 0) {
          console.log(`\n⏳ Moving to next day...`);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // Final summary
      const finalState = getImageGenState();
      console.log(`\n${"═".repeat(65)}`);
      console.log(`🎉 [ImageGenContext] IMAGE GENERATION COMPLETE!`);
      console.log(`${"─".repeat(65)}`);
      if (finalState) {
        console.log(`📊 Final Stats:`);
        console.log(`   Total: ${finalState.stats.total}`);
        console.log(`   ✅ Uploaded: ${finalState.stats.uploaded}`);
        console.log(`   ❌ Failed: ${finalState.stats.failed}`);
        console.log(
          `   📁 Completed Days: ${finalState.completedDays.join(", ")}`,
        );
      }
      console.log(`${"═".repeat(65)}\n`);
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
  }, []);

  // Auto-restart processing if interrupted
  useEffect(() => {
    const checkAndRestartProcessing = () => {
      if (isProcessingImagesRef.current) return;
      if (processingAbortedRef.current) return;

      const state = getImageGenState();
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
            saveImageGenState(updatedState);
          }
        }
      }

      // Check for pending work
      const hasPendingWork = state.stats.pending > 0;
      const hasStuckGenerating = state.exercises.some(
        (ex) => ex.status === "generating",
      );

      if (hasPendingWork || hasStuckGenerating) {
        console.log(
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
          saveImageGenState(updatedState);
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
  }, [processImageGenerationQueue]);

  // Queue day for image generation
  const queueDayForImageGeneration = useCallback(
    (
      dayName: string,
      dayResult: DayWorkoutResponse,
      gender: "male" | "female",
      dayOrder?: string[],
    ) => {
      let state = getImageGenState();
      if (!state) {
        state = createImageGenSession(gender, dayOrder || [dayName]);
        console.log(
          `📋 [ImageGenContext] Created new image generation session: ${state.sessionId}`,
        );
      }

      if (state.completedDays.includes(dayName)) {
        console.log(`✅ [ImageGenContext] ${dayName} images already completed`);
        return;
      }

      if (!state.dayOrder.includes(dayName)) {
        state.dayOrder.push(dayName);
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

      state = addExercisesToState(state, dayName, exercisesToAdd);
      saveImageGenState(state);
      setImageGenState(state);
      setImageGenStats(state.stats);

      console.log(
        `📋 [ImageGenContext] Added ${exercisesToAdd.length} exercises for ${dayName}`,
      );
      console.log(
        `📊 Total state: ${state.stats.total} exercises, ${state.stats.pending} pending`,
      );

      processImageGenerationQueue();
    },
    [processImageGenerationQueue],
  );

  // Clear all image generation
  const clearImageGeneration = useCallback(() => {
    processingAbortedRef.current = true;
    clearStoredImageGenState();
    setImageGenState(null);
    setImageGenStats({ total: 0, pending: 0, uploaded: 0, failed: 0 });
    setExerciseImages({});
    setGeneratingImages(new Set());
    setCompletedImageDays(new Set());
    isProcessingImagesRef.current = false;
    setIsProcessingImages(false);
    setCurrentImageGenDay(null);
    console.log("🗑️ [ImageGenContext] Cleared all image generation state");
  }, []);

  // Retry failed images
  const retryFailedImages = useCallback(() => {
    const state = getImageGenState();
    if (!state) return;

    const failed = state.exercises.filter(
      (ex) => ex.status === "failed" && ex.retryCount < 3,
    );
    if (failed.length === 0) {
      console.log("[ImageGenContext] ✅ No failed images to retry");
      return;
    }

    console.log(`🔄 [ImageGenContext] Retrying ${failed.length} failed images`);

    let updatedState = state;
    failed.forEach((ex) => {
      updatedState = updateExerciseStatus(
        updatedState,
        ex.dayName,
        ex.section,
        ex.index,
        "pending",
      );
    });
    saveImageGenState(updatedState);
    setImageGenState(updatedState);
    setImageGenStats(updatedState.stats);

    processImageGenerationQueue();
  }, [processImageGenerationQueue]);

  // Pause image generation
  const pauseImageGeneration = useCallback(() => {
    processingAbortedRef.current = true;
    console.log("[ImageGenContext] ⏸️ Image generation paused");
  }, []);

  // Resume image generation
  const resumeImageGeneration = useCallback(() => {
    processingAbortedRef.current = false;
    processImageGenerationQueue();
    console.log("[ImageGenContext] ▶️ Image generation resumed");
  }, [processImageGenerationQueue]);

  // Restart image generation for a specific day
  const restartDayImageGeneration = useCallback(
    (
      dayName: string,
      dayResult: DayWorkoutResponse,
      gender: "male" | "female",
    ) => {
      console.log(
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
      const state = getImageGenState();
      if (state) {
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

        saveImageGenState(updatedState);
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
        queueDayForImageGeneration(dayName, dayResult, gender);
      }, 500);
    },
    [queueDayForImageGeneration],
  );

  // Set exercise image
  const setExerciseImage = useCallback((key: string, url: string) => {
    setExerciseImages((prev) => ({ ...prev, [key]: url }));
  }, []);

  // Check if day images are complete
  const isDayImagesComplete = useCallback(
    (dayName: string): boolean => {
      const state = getImageGenState();
      if (!state) return false;
      return (
        completedImageDays.has(dayName) || state.completedDays.includes(dayName)
      );
    },
    [completedImageDays],
  );

  // Get day image counts
  const getDayImageCounts = useCallback(
    (dayName: string): { total: number; ready: number; generating: number } => {
      const state = getImageGenState();
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
    [exerciseImages],
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

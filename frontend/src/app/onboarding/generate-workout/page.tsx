"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "@/components/Dialog";
import Loader from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { useUserWorkoutData } from "@/hooks/useUserWorkoutData";
import type { UserProfile } from "@/types/UserProfile";
import type {
  CreateUserExerciseDetailsPayload,
  CreateUserWorkoutPlanExercisePayload,
  ExerciseSection,
} from "@/types/UserWorkout";
import {
  convertUserProfileToVariables,
  generateDayWorkoutWithPrompt,
  enrichDayWorkoutWithExerciseDescriptions,
  generatePlanMetadataWithPrompt,
  generateWorkoutWithPrompt,
  parseExerciseMetrics,
  type DayWorkoutResponse,
  type ExerciseItem,
  type WorkoutPlanJSON,
} from "@/lib/openai-prompt";
import { getSavedPersonalizedWorkoutPlan } from "@/lib/user-workout-plan";

const PLAN_DURATION_DAYS = 28;
const PLAN_DURATION_LABEL = `${PLAN_DURATION_DAYS} days`;
const PROFILE_REQUEST_TIMEOUT_MS = 30000;
const PROFILE_SAVE_TIMEOUT_MS = 30000;
const EXISTING_PLANS_TIMEOUT_MS = 30000;
const PLAN_METADATA_TIMEOUT_MS = 60000;
const WORKOUT_STRUCTURE_TIMEOUT_MS = 60000;
const DAY_WORKOUT_TIMEOUT_MS = 60000;
const DAY_EXERCISE_ENRICH_TIMEOUT_MS = 60000;
const PLAN_IMAGE_TIMEOUT_MS = 15000;
const SINGLE_SAVE_TIMEOUT_MS = 60000;
const BATCH_SAVE_TIMEOUT_MS = 90000;
const SAVE_VERIFICATION_TIMEOUT_MS = 30000;
const PLAN_EXERCISE_SAVE_CHUNK_SIZE = 40;

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type NormalizedGender = "male" | "female";
type NormalizedLocation = "home" | "gym";

interface GeneratedPlanPreview {
  planName: string;
  planDescription: string;
  planCategory: string;
  planTags: string[];
  workoutPlanJSON: WorkoutPlanJSON;
  dayWorkoutResults: Record<string, DayWorkoutResponse>;
  userGender: NormalizedGender;
  userLocation: NormalizedLocation;
  imagePath: string | null;
}

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        window.clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
};

const mapSectionName = (sectionKey: string): ExerciseSection | null => {
  const sectionMap: Record<string, ExerciseSection> = {
    warm_up: "warmup",
    main_workout: "main",
    cooldown: "cooldown",
  };
  return sectionMap[sectionKey] || null;
};

const parseEquipmentList = (
  equipment: string | string[] | null | undefined,
): string[] | null => {
  if (!equipment) return null;
  if (Array.isArray(equipment)) {
    return equipment
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return equipment
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const normalizeEquipment = (
  equipment: string | string[] | null | undefined,
): string => {
  const parsed = parseEquipmentList(equipment);
  if (!parsed || parsed.length === 0) return "";
  return parsed
    .map((item) => item.toLowerCase())
    .sort()
    .join(",");
};

const createExerciseKey = (
  name: string,
  equipment: string | string[] | null | undefined,
): string => `${name.toLowerCase().trim()}|${normalizeEquipment(equipment)}`;

const formatEstimatedCalories = (value: string | undefined): string | null => {
  if (!value) return null;
  const cleaned = value.replace(/\s*(k?cal|kcal)\s*/gi, "").trim();
  if (!cleaned) return null;
  return `${cleaned} kCal`;
};

const parsePlanExerciseMetricsForSave = (value: string | undefined) => {
  const parsed = parseExerciseMetrics(value);

  if (!value || value.toLowerCase().trim() === "none") {
    return parsed;
  }

  const lowerValue = value.toLowerCase();
  const normalized = { ...parsed };

  const setsMatch = lowerValue.match(/(\d+)\s*sets?\b/i);
  if (setsMatch) {
    normalized.sets = parseInt(setsMatch[1], 10);
  }

  const repsMatch = lowerValue.match(/(\d+)\s*reps?\b/i);
  if (repsMatch) {
    normalized.reps = parseInt(repsMatch[1], 10);
  }

  const secondMatches = Array.from(
    lowerValue.matchAll(/(\d+)\s*(?:sec|secs|second|seconds)\b/gi),
  );
  let durationSecondsFromRaw: number | null = null;
  secondMatches.forEach((match) => {
    const idx = match.index ?? -1;
    if (idx < 0) return;

    const before = lowerValue.slice(Math.max(0, idx - 8), idx);
    const after = lowerValue.slice(
      idx + match[0].length,
      idx + match[0].length + 8,
    );
    const isRestValue = /\brest\s*$/.test(before) || /^\s*rest\b/.test(after);

    if (!isRestValue) {
      durationSecondsFromRaw = parseInt(match[1], 10);
    }
  });

  if (durationSecondsFromRaw !== null) {
    normalized.duration_seconds = durationSecondsFromRaw;
  }

  const restAfterMatch = lowerValue.match(
    /(\d+)\s*(?:sec|secs|second|seconds)\s*rest\b/i,
  );
  const restBeforeMatch = lowerValue.match(
    /\brest\s*(\d+)\s*(?:sec|secs|second|seconds)\b/i,
  );
  const restValue = restAfterMatch?.[1] || restBeforeMatch?.[1];
  if (restValue) {
    normalized.rest_seconds = parseInt(restValue, 10);
  }

  if (normalized.rest_seconds === 0) {
    normalized.rest_seconds = 5;
  }

  return normalized;
};

const calculateTotalMinutesFromSavedExerciseMetrics = (
  exercises: ExerciseItem[] | undefined,
): number => {
  if (!exercises || exercises.length === 0) return 0;

  const totalSeconds = exercises.reduce((sum, exercise) => {
    const metrics = parsePlanExerciseMetricsForSave(
      exercise.sets_reps_duration_seconds_rest,
    );
    const sets = metrics.sets && metrics.sets > 0 ? metrics.sets : 1;

    if (metrics.duration_seconds !== null && metrics.duration_seconds > 0) {
      return sum + metrics.duration_seconds * sets;
    }

    return sum;
  }, 0);

  return totalSeconds > 0 ? Math.ceil(totalSeconds / 60) : 0;
};

const chunkItems = <T,>(items: T[], chunkSize: number): T[][] => {
  if (chunkSize <= 0) return [items];

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const capitalizeDay = (day: string): string => {
  if (!day) return day;
  return day.charAt(0).toUpperCase() + day.slice(1);
};

export default function OnboardingGenerateWorkoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { fetchUserProfile, upsertUserProfile } = useUserData();
  const {
    fetchUserWorkoutPlans,
    fetchUserWorkoutPlanById,
    getRandomImagePath,
    createUserWorkoutPlan,
    createUserWorkoutWeekPlan,
    createUserWorkoutWeeklyPlans,
    createOrReuseExerciseDetailsBatch,
    createUserWorkoutPlanExercisesBatch,
    deleteUserWorkoutPlanCascade,
    getExercisePosition,
    getExerciseImagePath,
    generateImageSlug,
  } = useUserWorkoutData();

  const [statusTitle, setStatusTitle] = useState("Preparing your experience");
  const [statusDetail, setStatusDetail] = useState(
    "Validating your profile before workout generation.",
  );
  const [progress, setProgress] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [isRunningGeneration, setIsRunningGeneration] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [previewPlan, setPreviewPlan] = useState<GeneratedPlanPreview | null>(
    null,
  );
  const [selectedPreviewDay, setSelectedPreviewDay] = useState<string | null>(
    null,
  );
  const [showBackgroundImageDialog, setShowBackgroundImageDialog] =
    useState(false);
  const [pendingRedirectPlanId, setPendingRedirectPlanId] = useState<
    string | null
  >(null);
  const hasAutoStartedRef = useRef(false);
  const redirectTimeoutRef = useRef<number | null>(null);

  const isComplete = useMemo(
    () => progress >= 100 && !!savedPlanId,
    [progress, savedPlanId],
  );
  const hasUnsavedPlan = useMemo(
    () => Boolean(previewPlan) && !savedPlanId,
    [previewPlan, savedPlanId],
  );

  const previewDays = useMemo(() => {
    if (!previewPlan) return [];
    return DAY_ORDER.filter((dayName) => {
      const day = previewPlan.workoutPlanJSON.days?.[dayName];
      return Boolean(day?.title?.trim()) && Boolean(day?.focus?.trim());
    });
  }, [previewPlan]);

  const activePreviewDayName = useMemo(() => {
    if (previewDays.length === 0) return null;
    const matched = previewDays.find(
      (dayName) => dayName === selectedPreviewDay,
    );
    return matched || previewDays[0];
  }, [previewDays, selectedPreviewDay]);

  const clearRedirectTimeout = useCallback(() => {
    if (redirectTimeoutRef.current !== null) {
      window.clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
  }, []);

  const proceedToWorkoutDetails = useCallback(
    (planId: string) => {
      clearRedirectTimeout();
      setShowBackgroundImageDialog(false);
      router.replace(`/personal/workout/details?id=${planId}`);
    },
    [clearRedirectTimeout, router],
  );

  const runGeneration = useCallback(async () => {
    if (!user?.id) return;

    setError(null);
    setSavedPlanId(null);
    setPreviewPlan(null);
    setSelectedPreviewDay(null);
    setIsRunningGeneration(true);

    const updateStatus = (
      title: string,
      detail: string,
      nextProgress: number,
    ) => {
      setStatusTitle(title);
      setStatusDetail(detail);
      setProgress(nextProgress);
    };

    try {
      updateStatus(
        "Analyzing profile",
        "Reading your onboarding data and preferences.",
        10,
      );

      const profileResult = await withTimeout(
        fetchUserProfile(user.id),
        PROFILE_REQUEST_TIMEOUT_MS,
        "fetch user_profile",
      );
      if (!profileResult.success || !profileResult.data) {
        throw new Error(profileResult.error || "Unable to load user profile.");
      }

      const profile = profileResult.data as UserProfile;
      const hasReachedFinalOnboardingStep =
        (profile.current_step ?? 0) >= 10 ||
        profile.is_onboarding_complete === true;
      if (!hasReachedFinalOnboardingStep) {
        router.replace("/onboarding/finish");
        return;
      }

      updateStatus(
        "Checking existing plans",
        "Ensuring onboarding auto-generation runs only once.",
        18,
      );

      const existingPlansResult = await withTimeout(
        fetchUserWorkoutPlans(user.id),
        EXISTING_PLANS_TIMEOUT_MS,
        "fetch user workout plans",
      );
      if (!existingPlansResult.success) {
        throw new Error(
          existingPlansResult.error ||
            "Unable to check existing workout plans.",
        );
      }

      const existingPlans = existingPlansResult.data || [];
      const savedPlanCheck = await withTimeout(
        getSavedPersonalizedWorkoutPlan(user.id),
        EXISTING_PLANS_TIMEOUT_MS,
        "verify saved personalized workout plan",
      );

      if (!savedPlanCheck.success) {
        throw new Error(
          savedPlanCheck.error ||
            "Unable to verify existing saved workout plans.",
        );
      }

      if (existingPlans.length > 0 && savedPlanCheck.hasSavedPlan) {
        const completeResult = await withTimeout(
          upsertUserProfile({
            user_id: user.id,
            current_step: 11,
            is_onboarding_complete: true,
            plan_code: profile.plan_code ?? "premium",
          }),
          PROFILE_SAVE_TIMEOUT_MS,
          "mark onboarding complete",
        );
        if (!completeResult.success) {
          throw new Error(
            completeResult.error || "Unable to mark onboarding as complete.",
          );
        }

        updateStatus(
          "Workout already generated",
          "You already have a saved personalized workout plan. Redirecting now.",
          100,
        );
        window.setTimeout(() => {
          router.replace(
            savedPlanCheck.planId
              ? `/personal/workout/details?id=${savedPlanCheck.planId}`
              : "/",
          );
        }, 900);
        return;
      }

      const userVariables = convertUserProfileToVariables(profile);

      updateStatus(
        "Creating plan metadata",
        "Naming your personalized 28-day program.",
        28,
      );

      const metadataResult = await withTimeout(
        generatePlanMetadataWithPrompt({
          gender: userVariables.gender,
          goal: userVariables.goal,
          location: userVariables.location,
          equipments: userVariables.equipments,
          level: userVariables.level,
          schedule: userVariables.schedule,
          age: userVariables.age,
          duration: userVariables.duration,
        }),
        PLAN_METADATA_TIMEOUT_MS,
        "generate workout plan metadata",
      );

      const fallbackPlanName = "Personalized 28-Day Workout Plan";
      const fallbackDescription =
        "A personalized 28-day workout plan based on your onboarding profile.";
      const fallbackCategory = "General Fitness";
      const fallbackTags = ["workout", "fitness", "onboarding"];

      const planName =
        metadataResult.success && metadataResult.response?.plan_name
          ? metadataResult.response.plan_name
          : fallbackPlanName;
      const planDescription =
        metadataResult.success && metadataResult.response?.description
          ? metadataResult.response.description
          : fallbackDescription;
      const planCategory =
        metadataResult.success && metadataResult.response?.category
          ? metadataResult.response.category
          : fallbackCategory;
      const planTags =
        metadataResult.success && metadataResult.response?.tags?.length
          ? metadataResult.response.tags
          : fallbackTags;

      updateStatus(
        "Generating workout structure",
        "Building your weekly framework and rest-day pattern.",
        38,
      );

      const workoutResult = await withTimeout(
        generateWorkoutWithPrompt({
          gender: userVariables.gender,
          goal: userVariables.goal,
          location: userVariables.location,
          equipments: userVariables.equipments,
          level: userVariables.level,
          schedule: userVariables.schedule,
          age: userVariables.age,
          duration: userVariables.duration,
          plan_name: planName,
          plan_duration: PLAN_DURATION_LABEL,
          week_number: "1",
        }),
        WORKOUT_STRUCTURE_TIMEOUT_MS,
        "generate workout structure",
      );

      if (!workoutResult.success || !workoutResult.json) {
        throw new Error(
          workoutResult.error || "Unable to generate workout structure.",
        );
      }

      const workoutPlanJSON: WorkoutPlanJSON = {
        ...workoutResult.json,
        plan_duration: PLAN_DURATION_LABEL,
      };

      const dayEntries = Object.entries(workoutPlanJSON.days || {}).filter(
        ([, day]) => Boolean(day?.title?.trim()) && Boolean(day?.focus?.trim()),
      );

      if (dayEntries.length === 0) {
        throw new Error("Generated workout did not contain valid day entries.");
      }

      const initialPreviewDay = DAY_ORDER.find((dayName) => {
        const day = workoutPlanJSON.days?.[dayName];
        return Boolean(day?.title?.trim()) && Boolean(day?.focus?.trim());
      });

      const dayWorkoutResults: Record<string, DayWorkoutResponse> = {};
      const rawGender = profile.gender?.toLowerCase().trim() || "female";
      const userGender: NormalizedGender =
        rawGender === "male" || rawGender === "m" ? "male" : "female";

      for (let index = 0; index < dayEntries.length; index += 1) {
        const [dayName, dayData] = dayEntries[index];
        const phaseProgress = Math.round(
          38 + ((index + 1) / dayEntries.length) * 42,
        );
        updateStatus(
          "Generating daily workouts",
          `Creating ${dayName} plan (${index + 1}/${dayEntries.length}).`,
          phaseProgress,
        );

        const dayResult = await withTimeout(
          generateDayWorkoutWithPrompt({
            gender: userVariables.gender,
            goal: userVariables.goal,
            location: userVariables.location,
            equipments: userVariables.equipments,
            level: userVariables.level,
            schedule: userVariables.schedule,
            age: userVariables.age,
            duration: userVariables.duration,
            day_name: dayName,
            plan_name: dayData.title,
            day_focus: dayData.focus,
            plan_duration: PLAN_DURATION_LABEL,
            week_number: workoutPlanJSON.week_number || "1",
          }),
          DAY_WORKOUT_TIMEOUT_MS,
          `generate ${dayName} workout`,
        );

        if (!dayResult.success || !dayResult.response) {
          throw new Error(
            dayResult.error || `Unable to generate ${dayName} workout.`,
          );
        }

        const dayResultWithDescriptions = await withTimeout(
          enrichDayWorkoutWithExerciseDescriptions(dayResult.response, userGender),
          DAY_EXERCISE_ENRICH_TIMEOUT_MS,
          `generate ${dayName} exercise descriptions`,
        );

        dayWorkoutResults[dayName] = dayResultWithDescriptions;
      }

      const rawLocation =
        profile.workout_location?.toLowerCase().trim() || "gym";
      const userLocation: NormalizedLocation =
        rawLocation === "home" ? "home" : "gym";

      const imageResult = await withTimeout(
        getRandomImagePath(user.id, userGender, userLocation),
        PLAN_IMAGE_TIMEOUT_MS,
        "fetch plan image",
      );

      let imagePath: string | null = null;
      if (imageResult.success && imageResult.data) {
        imagePath = imageResult.data;
      } else {
        const randomNum = Math.floor(Math.random() * 50) + 1;
        imagePath = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/plans/${userGender}/${userLocation}/${randomNum}.png`;
      }

      setPreviewPlan({
        planName,
        planDescription,
        planCategory,
        planTags,
        workoutPlanJSON,
        dayWorkoutResults,
        userGender,
        userLocation,
        imagePath,
      });
      setSelectedPreviewDay(initialPreviewDay || dayEntries[0][0]);

      updateStatus(
        "Preview ready",
        "Review your generated plan, then save it to your account.",
        100,
      );
    } catch (runError: unknown) {
      const message =
        runError instanceof Error
          ? runError.message
          : "Unable to generate your workout plan.";
      setError(message);
      setStatusTitle("Generation failed");
      setStatusDetail(
        "We could not finish generating your workout plan. Retry to continue.",
      );
      setProgress(0);
    } finally {
      setIsRunningGeneration(false);
    }
  }, [
    user?.id,
    fetchUserProfile,
    upsertUserProfile,
    fetchUserWorkoutPlans,
    getRandomImagePath,
    router,
  ]);

  const handleSavePlan = useCallback(async () => {
    if (!user?.id || !previewPlan) return;

    let createdPlanId: string | null = null;
    let shouldCleanupCreatedPlan = false;

    setError(null);
    setIsSavingPlan(true);
    setStatusTitle("Saving your workout plan");
    setStatusDetail("Persisting your generated plan to your account.");
    setProgress(75);

    try {
      const {
        planName,
        planDescription,
        planCategory,
        planTags,
        workoutPlanJSON,
        dayWorkoutResults,
        userGender,
        userLocation,
        imagePath,
      } = previewPlan;

      const createdPlanResult = await withTimeout(
        createUserWorkoutPlan({
          name: planName,
          description: planDescription,
          tags: planTags,
          duration_days: PLAN_DURATION_DAYS,
          category: planCategory,
          user_id: user.id,
          image_path: imagePath,
          image_alt: `${planName} workout plan`,
          gender: userGender,
          location: userLocation,
        }),
        SINGLE_SAVE_TIMEOUT_MS,
        "save workout plan",
      );

      if (!createdPlanResult.success || !createdPlanResult.data?.id) {
        throw new Error(
          createdPlanResult.error || "Unable to save workout plan.",
        );
      }

      const planId = createdPlanResult.data.id;
      createdPlanId = planId;
      shouldCleanupCreatedPlan = true;

      const weekPlanResult = await withTimeout(
        createUserWorkoutWeekPlan({
          week_number: parseInt(workoutPlanJSON.week_number || "1", 10) || 1,
          plan_id: planId,
          rest_days: workoutPlanJSON.rest_days || [],
          remaining_days: Math.max(0, PLAN_DURATION_DAYS - 7),
        }),
        SINGLE_SAVE_TIMEOUT_MS,
        "save workout week plan",
      );

      if (!weekPlanResult.success || !weekPlanResult.data?.id) {
        throw new Error(weekPlanResult.error || "Unable to save week plan.");
      }

      const weekPlanId = weekPlanResult.data.id;

      const dayEntries = Object.entries(workoutPlanJSON.days || {}).filter(
        ([, day]) => Boolean(day?.title?.trim()) && Boolean(day?.focus?.trim()),
      );

      const weeklyDayPayloads = dayEntries.map(([dayName, dayData]) => {
        const dayResult = dayWorkoutResults[dayName];
        const estimatedCalories = formatEstimatedCalories(
          dayResult?.["estimated total calories"] ||
            dayResult?.estimated_total_calories,
        );
        const totalMinutes =
          calculateTotalMinutesFromSavedExerciseMetrics(dayResult?.warm_up) +
          calculateTotalMinutesFromSavedExerciseMetrics(
            dayResult?.main_workout,
          ) +
          calculateTotalMinutesFromSavedExerciseMetrics(dayResult?.cooldown);

        return {
          day: dayName,
          title: dayData.title || null,
          focus: dayData.focus ? [dayData.focus] : null,
          motivation: dayData.motivation || null,
          week_plan_id: weekPlanId,
          total_calories: estimatedCalories,
          total_minutes: totalMinutes > 0 ? totalMinutes : null,
        };
      });

      const exerciseDetailsPayloads: CreateUserExerciseDetailsPayload[] = [];
      dayEntries.forEach(([dayName]) => {
        const dayResult = dayWorkoutResults[dayName];
        if (!dayResult) return;

        const sections = [
          { key: "warm_up", exercises: dayResult.warm_up || [] },
          { key: "main_workout", exercises: dayResult.main_workout || [] },
          { key: "cooldown", exercises: dayResult.cooldown || [] },
        ];

        sections.forEach(({ key, exercises }) => {
          const section = mapSectionName(key);
          if (!section) return;

          exercises.forEach((exercise) => {
            if (!exercise.name) return;
            exerciseDetailsPayloads.push({
              name: exercise.name,
              safety_cue: exercise.safety_cue || null,
              section,
              equipment: parseEquipmentList(exercise.equipment),
            });
          });
        });
      });

      const [weeklyPlansResult, exerciseDetailsResult] = await Promise.all([
        withTimeout(
          createUserWorkoutWeeklyPlans(weeklyDayPayloads),
          BATCH_SAVE_TIMEOUT_MS,
          "save workout daily plans",
        ),
        withTimeout(
          createOrReuseExerciseDetailsBatch(exerciseDetailsPayloads),
          BATCH_SAVE_TIMEOUT_MS,
          "save workout exercise details",
        ),
      ]);

      if (!weeklyPlansResult.success || !weeklyPlansResult.data?.length) {
        throw new Error(
          weeklyPlansResult.error || "Unable to save daily workout rows.",
        );
      }

      const weekDayMap = new Map<string, string>();
      weeklyPlansResult.data.forEach((item) => {
        if (item.day && item.id) {
          weekDayMap.set(item.day.toLowerCase(), item.id);
        }
      });

      if (
        !exerciseDetailsResult.success ||
        !exerciseDetailsResult.data?.length
      ) {
        throw new Error(
          exerciseDetailsResult.error || "Unable to save exercises.",
        );
      }

      const exerciseById = new Map(
        exerciseDetailsResult.data.map((exercise) => [exercise.id, exercise]),
      );
      const exerciseIdMap = new Map<string, string>();
      exerciseDetailsResult.data.forEach((exercise) => {
        exerciseIdMap.set(
          createExerciseKey(exercise.name, exercise.equipment),
          exercise.id,
        );
      });

      const planExercisesPayloads: CreateUserWorkoutPlanExercisePayload[] = [];

      Object.entries(dayWorkoutResults).forEach(([dayName, dayResult]) => {
        const linkedWeekDayId = weekDayMap.get(dayName.toLowerCase());
        if (!linkedWeekDayId) return;

        const sectionPosition = {
          warmup: 0,
          main: 0,
          cooldown: 0,
        };

        const sections = [
          { key: "warm_up", exercises: dayResult.warm_up || [] },
          { key: "main_workout", exercises: dayResult.main_workout || [] },
          { key: "cooldown", exercises: dayResult.cooldown || [] },
        ];

        sections.forEach(({ key, exercises }) => {
          const section = mapSectionName(key);
          if (!section) return;

          exercises.forEach((exercise) => {
            if (!exercise.name) return;

            const exerciseId = exerciseIdMap.get(
              createExerciseKey(exercise.name, exercise.equipment),
            );
            if (!exerciseId) return;

            const metrics = parsePlanExerciseMetricsForSave(
              exercise.sets_reps_duration_seconds_rest,
            );
            const position = getExercisePosition(
              section,
              sectionPosition[section],
            );
            sectionPosition[section] += 1;

            const savedExercise = exerciseById.get(exerciseId);
            const imageSlug =
              savedExercise?.image_slug ||
              generateImageSlug(section, exercise.name);

            planExercisesPayloads.push({
              weekly_plan_id: linkedWeekDayId,
              exercise_id: exerciseId,
              position,
              section,
              sets: metrics.sets,
              reps: metrics.reps,
              duration_seconds: metrics.duration_seconds,
              rest_seconds: metrics.rest_seconds,
              per_side: exercise.per_side?.toLowerCase() === "yes",
              image_path: getExerciseImagePath(userGender, imageSlug),
              image_alt: `${exercise.name} exercise demonstration`,
              description: exercise.description || null,
              is_image_generated: null,
            });
          });
        });
      });

      if (planExercisesPayloads.length > 0) {
        for (const payloadChunk of chunkItems(
          planExercisesPayloads,
          PLAN_EXERCISE_SAVE_CHUNK_SIZE,
        )) {
          const savedPlanExercisesResult = await withTimeout(
            createUserWorkoutPlanExercisesBatch(payloadChunk),
            BATCH_SAVE_TIMEOUT_MS,
            "save workout plan exercises",
          );
          if (!savedPlanExercisesResult.success) {
            throw new Error(
              savedPlanExercisesResult.error || "Unable to save plan exercises.",
            );
          }
        }
      }

      const savedPlanResult = await withTimeout(
        fetchUserWorkoutPlanById(planId),
        SAVE_VERIFICATION_TIMEOUT_MS,
        "verify personalized workout plan",
      );
      if (!savedPlanResult.success || !savedPlanResult.data?.id) {
        throw new Error(
          savedPlanResult.error || "Unable to verify the saved workout plan.",
        );
      }

      shouldCleanupCreatedPlan = false;

      const completeResult = await withTimeout(
        upsertUserProfile({
          user_id: user.id,
          current_step: 11,
          is_onboarding_complete: true,
        }),
        PROFILE_SAVE_TIMEOUT_MS,
        "mark onboarding complete",
      );
      if (!completeResult.success) {
        throw new Error(
          completeResult.error || "Unable to mark onboarding as complete.",
        );
      }

      setSavedPlanId(planId);
      setStatusTitle("All set");
      setStatusDetail("Your personalized 28-day workout plan is ready.");
      setProgress(100);
      setPendingRedirectPlanId(planId);
      setShowBackgroundImageDialog(true);
      clearRedirectTimeout();
      redirectTimeoutRef.current = window.setTimeout(() => {
        proceedToWorkoutDetails(planId);
      }, 3500);
    } catch (saveError: unknown) {
      let message =
        saveError instanceof Error
          ? saveError.message
          : "Unable to save your workout plan.";

      if (createdPlanId && shouldCleanupCreatedPlan) {
        const cleanupResult = await deleteUserWorkoutPlanCascade(createdPlanId);
        if (!cleanupResult.success) {
          console.error(
            "Failed to clean up incomplete onboarding workout plan:",
            cleanupResult.error,
          );
          message = `${message} Automatic cleanup failed. Please refresh before retrying.`;
        }
      }

      setError(message);
      setStatusTitle("Save failed");
      setStatusDetail(
        "We could not save your plan yet. You can generate again or try saving again.",
      );
    } finally {
      setIsSavingPlan(false);
    }
  }, [
    user?.id,
    previewPlan,
    fetchUserWorkoutPlanById,
    upsertUserProfile,
    createUserWorkoutPlan,
    createUserWorkoutWeekPlan,
    createUserWorkoutWeeklyPlans,
    createOrReuseExerciseDetailsBatch,
    createUserWorkoutPlanExercisesBatch,
    deleteUserWorkoutPlanCascade,
    getExercisePosition,
    getExerciseImagePath,
    generateImageSlug,
    clearRedirectTimeout,
    proceedToWorkoutDetails,
  ]);

  useEffect(() => {
    if (!user?.id || hasAutoStartedRef.current || previewPlan || savedPlanId)
      return;
    hasAutoStartedRef.current = true;
    void runGeneration();
  }, [user?.id, previewPlan, savedPlanId, runGeneration]);

  useEffect(() => {
    if (!hasUnsavedPlan) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedPlan]);

  useEffect(() => {
    return () => {
      clearRedirectTimeout();
    };
  }, [clearRedirectTimeout]);

  const handleRetry = () => {
    if (!user?.id || isRunningGeneration || isSavingPlan) return;
    void runGeneration();
  };

  const handleGenerateAgain = () => {
    if (!user?.id || isRunningGeneration || isSavingPlan) return;
    void runGeneration();
  };

  const handleSkip = () => {
    router.replace("/");
  };

  if (previewPlan) {
    const activeDayPlan = activePreviewDayName
      ? previewPlan.workoutPlanJSON.days[activePreviewDayName]
      : null;
    const activeDayWorkout = activePreviewDayName
      ? previewPlan.dayWorkoutResults[activePreviewDayName]
      : null;
    const activeDaySections = [
      { title: "Warm-up", exercises: activeDayWorkout?.warm_up || [] },
      {
        title: "Main workout",
        exercises: activeDayWorkout?.main_workout || [],
      },
      { title: "Cooldown", exercises: activeDayWorkout?.cooldown || [] },
    ];

    return (
      <div className="min-h-dvh bg-linear-to-b from-[#0b1220] via-[#0f1829] to-[#0a0f1a] px-4 py-6 sm:py-8">
        <div className="mx-auto w-full max-w-5xl rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-8 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-teal-300">
              Onboarding
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white">
              Preview your first week of your 28 - day workout plan
            </h1>
            <p className="mt-3 text-sm sm:text-sm text-slate-300">
              Review your generated plan. It will be saved only after you click
              Save plan. Second week is auto-generated 2 days before end of
              first week.
            </p>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/50 bg-red-500/15 p-4">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/40 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  {previewPlan.planName}
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  {previewPlan.planDescription}
                </p>
              </div>
              <div className="text-xs text-teal-100 rounded-lg border border-teal-300/35 bg-teal-500/10 px-3 py-2 whitespace-nowrap">
                {PLAN_DURATION_LABEL}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-md border border-teal-300/40 bg-teal-500/10 px-2 py-1 text-xs text-teal-100">
                {previewPlan.planCategory}
              </span>
              {previewPlan.planTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap gap-2">
              {previewDays.map((dayName) => {
                const dayPlan = previewPlan.workoutPlanJSON.days[dayName];
                const dayWorkout = previewPlan.dayWorkoutResults[dayName];
                const isSelectedDay = activePreviewDayName === dayName;
                const calories =
                  formatEstimatedCalories(
                    dayWorkout?.["estimated total calories"] ||
                      dayWorkout?.estimated_total_calories,
                  ) || "-";

                return (
                  <button
                    key={dayName}
                    type="button"
                    onClick={() => setSelectedPreviewDay(dayName)}
                    className={`w-full min-w-[170px] flex-1 rounded-xl border p-3 text-left transition-colors ${
                      isSelectedDay
                        ? "border-teal-300/70 bg-gradient-to-br from-amber-500/10 to-teal-500/10"
                        : "border-white/10 bg-slate-950/40 hover:bg-slate-900/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-xs font-semibold ${
                          isSelectedDay ? "text-teal-200" : "text-amber-300"
                        }`}
                      >
                        {capitalizeDay(dayName)}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[72px]">
                        {calories}
                      </p>
                    </div>

                    <p className="mt-1 text-xs font-semibold text-white truncate">
                      {dayPlan?.title || "Workout day"}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-300 truncate">
                      {dayPlan?.focus || "General"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {activePreviewDayName && (
            <div className="mt-6 rounded-xl border border-teal-300/30 bg-slate-950/40 p-4 sm:p-5">
              <h3 className="text-base sm:text-lg font-semibold text-white">
                {capitalizeDay(activePreviewDayName)} exercise list
              </h3>
              <p className="mt-1 text-xs text-slate-300">
                {activeDayPlan?.title || "Workout day"}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Focus: {activeDayPlan?.focus || "General"}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {activeDaySections.map((section) => (
                  <div
                    key={section.title}
                    className="rounded-lg border border-white/10 bg-black/20 p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-teal-300">
                      {section.title}
                    </p>
                    {section.exercises.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-400">
                        No exercises
                      </p>
                    ) : (
                      <ol className="mt-2 space-y-2">
                        {section.exercises.map((exercise, index) => (
                          <li
                            key={`${section.title}-${exercise.name || "exercise"}-${index}`}
                            className="text-xs text-slate-200"
                          >
                            <p className="font-semibold text-slate-100">
                              {index + 1}. {exercise.name || "Exercise"}
                            </p>
                            {exercise.sets_reps_duration_seconds_rest && (
                              <p className="text-slate-300">
                                {exercise.sets_reps_duration_seconds_rest}
                              </p>
                            )}
                            {exercise.equipment &&
                              exercise.equipment !== "none" && (
                                <p className="text-slate-400">
                                  Equipment: {exercise.equipment}
                                </p>
                              )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-teal-300/35 bg-gradient-to-r from-amber-500/10 to-teal-500/10 p-3 text-xs text-slate-100">
            This plan has not been saved yet. Click Save plan to store it in
            your account.
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleGenerateAgain}
              disabled={isRunningGeneration || isSavingPlan}
              className="px-4 py-2 rounded-lg border border-teal-300/40 text-teal-100 text-sm font-semibold hover:bg-teal-500/10 disabled:opacity-60"
            >
              {isRunningGeneration ? "Generating..." : "Generate again"}
            </button>

            <button
              type="button"
              onClick={() => {
                void handleSavePlan();
              }}
              disabled={isRunningGeneration || isSavingPlan || isComplete}
              className="px-5 py-2 rounded-lg bg-amber-500 text-slate-900 text-sm font-semibold hover:bg-amber-400 disabled:opacity-60"
            >
              {isSavingPlan ? "Saving plan..." : "Save plan"}
            </button>

            {isSavingPlan && (
              <div className="ml-auto flex items-center gap-2 text-xs text-slate-300">
                <Loader size="sm" inline />
                <span>Saving and preparing your plan details...</span>
              </div>
            )}

            {isComplete && !isSavingPlan && (
              <p className="ml-auto text-xs text-green-300">
                Saved. Redirecting to workout details...
              </p>
            )}
          </div>
        </div>

        <Dialog
          visible={showBackgroundImageDialog}
          onDismiss={() => setShowBackgroundImageDialog(false)}
          dismissible={true}
          maxWidth={520}
        >
          <div className="text-slate-900 dark:text-slate-100">
            <h3 className="text-base sm:text-lg font-extrabold">
              Plan saved successfully
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Your workout plan is ready. Exercise images are still being
              generated in the background and will continue to appear
              automatically.
            </p>
            <div className="mt-4 flex items-center gap-2 text-teal-700 dark:text-teal-300 text-xs font-semibold">
              <Loader size="sm" inline />
              <span>Background image generation is in progress.</span>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!pendingRedirectPlanId) return;
                  proceedToWorkoutDetails(pendingRedirectPlanId);
                }}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors"
              >
                Continue to workout
              </button>
            </div>
          </div>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-linear-to-b from-[#0b1220] via-[#0f1829] to-[#0a0f1a] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 sm:p-8">
        <div className="text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-amber-300">
            Onboarding
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white">
            {statusTitle}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-300">
            {statusDetail}
          </p>
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-300">
            <span>Personalizing your workout</span>
            <span>{Math.min(100, Math.max(0, progress))}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-green-400 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          {isRunningGeneration ? (
            <Loader size="lg" color="amber" />
          ) : (
            <div className="text-slate-400 text-sm">
              Waiting for next action...
            </div>
          )}
        </div>

        {!error && (
          <p className="mt-6 text-center text-xs text-slate-400">
            {PLAN_DURATION_LABEL} workout plan specially personalized for you.
          </p>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/50 bg-red-500/15 p-4">
            <p className="text-sm text-red-200">{error}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRunningGeneration || isSavingPlan}
                className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 text-sm font-semibold hover:bg-amber-400 disabled:opacity-60"
              >
                Retry generation
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="px-4 py-2 rounded-lg border border-slate-500 text-slate-200 text-sm font-semibold hover:bg-white/10"
              >
                Go to dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

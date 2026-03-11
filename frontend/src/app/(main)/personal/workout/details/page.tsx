"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useUserContext } from "@/contexts/UserContext";
import { supabase } from "@/lib/api/supabase";
import { useUserWorkoutData } from "@/hooks/useUserWorkoutData";
import { useCoachWorkoutData } from "@/hooks/useCoachWorkoutData";
import { useMeals } from "@/contexts/MealsContext";
import Dialog from "@/components/Dialog";
import {
  generateDayWorkoutWithRpePrompt,
  parseExerciseMetrics,
  type DayWorkoutResponse,
  type ExerciseItem,
} from "@/lib/openai-prompt";
import type {
  CreateUserExerciseDetailsPayload,
  CreateUserWorkoutPlanExercisePayload,
  ExerciseSection,
  UserWorkoutPlan,
  UserWorkoutWeekPlan,
  UserWorkoutWeeklyPlan,
  UserWorkoutPlanExerciseWithDetails,
} from "@/types/UserWorkout";
import {
  HiArrowLeft,
  HiCalendar,
  HiClock,
  HiFire,
  HiMoon,
  HiSparkles,
  HiBolt,
  HiArrowPath,
} from "react-icons/hi2";
import { MdRestaurant } from "react-icons/md";

// Type for week data with day plans
interface WeekData {
  weekPlan: UserWorkoutWeekPlan;
  dayPlans: UserWorkoutWeeklyPlan[];
}

interface WorkoutDayRef {
  week: number;
  day: string;
  dayNumber: number;
  dayPlanId: string | null;
}

type ParsedPlanMetrics = {
  sets: number | null;
  reps: number | null;
  duration_seconds: number | null;
  rest_seconds: number;
};

type WeeklyPlanRow = {
  id: string;
  plan_id: string;
  week_number: number | null;
  rest_days: string[] | null;
  remaining_days: number | null;
};

type WeeklyDayPlanRow = {
  id: string;
  day: string | null;
  title: string | null;
  focus: string[] | null;
  motivation: string | null;
  rpe_record: number | null;
  isCompleted: boolean | null;
  is_completed: boolean | null;
};

type NextWeekPreviewDay = {
  day: string;
  title: string | null;
  focus: string[] | null;
  motivation: string | null;
  isRestDay: boolean;
  totalCalories: string | null;
  totalMinutes: number | null;
  exercises: DayWorkoutResponse | null;
  aiDay: string | null;
  aiName: string | null;
  aiFocus: string | null;
  aiEstimatedCalories: string | null;
  aiIntensity: string | null;
};

type NextWeekPreviewData = {
  planName: string;
  weekNumber: number;
  restDays: string[];
  days: NextWeekPreviewDay[];
};

type PendingNextWeekGeneration = {
  nextWeekPlanId: string | null;
  planId: string;
  nextWeekNumber: number;
  remainingDaysForNextWeek: number;
  restDays: string[];
  nextWeekDayPayloads: Array<{
    day: string;
    title: string | null;
    focus: string[] | null;
    motivation: string | null;
    week_plan_id: string | null;
    total_calories: string | null;
    total_minutes: number | null;
    rpe_record: number | null;
  }>;
  generatedDayResults: Record<string, DayWorkoutResponse>;
};

type PendingDayRegeneration = {
  weekNumber: number;
  dayName: string;
  dayPlanId: string;
  dayResult: DayWorkoutResponse;
  totalCalories: string | null;
  totalMinutes: number | null;
};

type IntensityOption = {
  label: string;
  emoji: string;
  rpe: number;
};

const INTENSITY_OPTIONS: IntensityOption[] = [
  { label: "Very Light", emoji: "\u{1F60C}", rpe: 10 },
  { label: "Easy", emoji: "\u{1F642}", rpe: 8 },
  { label: "Moderate", emoji: "\u{1F610}", rpe: 6 },
  { label: "Hard", emoji: "\u{1F624}", rpe: 4 },
  { label: "Very Hard", emoji: "\u{1F635}", rpe: 2 },
];

const GENERATION_STEPS = [
  {
    title: "Analyzing and Reading your profile",
    detail: "Reviewing goals, schedule, and equipment.",
  },
  {
    title: "Generating Workout Plan",
    detail: "Building your weekly structure and focus.",
  },
  {
    title: "Adding Exercises",
    detail: "Curating warmups, main sets, and cooldowns.",
  },
  {
    title: "Finalizing",
    detail: "Polishing details and double-checking flow.",
  },
];

const GENERATION_STEP_TIMINGS = [0, 20, 45, 70];
const GENERATION_DURATION_SECONDS = 90;

const mapSectionNameForPlan = (sectionKey: string): ExerciseSection | null => {
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
    const cleaned = equipment.map((e) => e.trim()).filter((e) => e.length > 0);
    return cleaned.length > 0 ? cleaned : null;
  }

  const cleaned = equipment
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
  return cleaned.length > 0 ? cleaned : null;
};

const normalizeEquipment = (
  equipment: string[] | string | null | undefined,
): string => {
  const list = parseEquipmentList(equipment);
  if (!list || list.length === 0) return "";
  return list
    .map((e) => e.toLowerCase().trim())
    .sort()
    .join(",");
};

const createExerciseKey = (
  name: string,
  equipment: string[] | string | null | undefined,
): string => {
  return `${name.toLowerCase().trim()}|${normalizeEquipment(equipment)}`;
};

const formatEstimatedCalories = (value: string | undefined): string | null => {
  if (!value) return null;
  const cleaned = value.replace(/\s*(k?cal|kcal)\s*/gi, "").trim();
  if (!cleaned) return null;
  return `${cleaned} kCal`;
};

const getExerciseMetricsText = (exercise: ExerciseItem): string | undefined => {
  return exercise.sets_reps_duration_seconds_rest || exercise.sets_reps_rest;
};

const parsePlanExerciseMetricsForSave = (
  value: string | undefined,
): ParsedPlanMetrics => {
  const parsed = parseExerciseMetrics(value);
  const normalized: ParsedPlanMetrics = {
    sets: parsed.sets,
    reps: parsed.reps,
    duration_seconds: parsed.duration_seconds,
    rest_seconds: parsed.rest_seconds,
  };

  if (!value || value.toLowerCase().trim() === "none") {
    return normalized;
  }

  const lowerValue = value.toLowerCase();
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

const calculateTotalMinutes = (
  exercises: ExerciseItem[] | undefined,
): number => {
  if (!exercises || exercises.length === 0) return 0;

  const totalSeconds = exercises.reduce((sum, exercise) => {
    const metrics = parsePlanExerciseMetricsForSave(
      getExerciseMetricsText(exercise),
    );
    const sets = metrics.sets ?? 1;

    if (metrics.duration_seconds !== null && metrics.duration_seconds > 0) {
      return sum + metrics.duration_seconds * sets;
    }

    if (metrics.reps !== null && metrics.reps > 0) {
      return sum + metrics.reps * sets;
    }

    return sum;
  }, 0);

  return totalSeconds > 0 ? Math.ceil(totalSeconds / 60) : 0;
};

const calculateDayTotalMinutes = (dayResult: DayWorkoutResponse): number => {
  return (
    calculateTotalMinutes(dayResult.warm_up) +
    calculateTotalMinutes(dayResult.main_workout) +
    calculateTotalMinutes(dayResult.cooldown)
  );
};

export default function MyWorkoutDetailsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("id");
  const source = searchParams.get("source");

  const { user } = useAuth();
  const { userProfile } = useUserContext();
  const {
    fetchUserWorkoutPlanById,
    fetchAllUserWorkoutWeekPlans,
    fetchUserWorkoutWeeklyDayPlans,
    fetchUserWorkoutPlanExercises,
    createOrReuseExerciseDetailsBatch,
    createUserWorkoutPlanExercisesBatch,
    getExercisePosition,
    generateImageSlug,
    getExerciseImagePath,
  } = useUserWorkoutData();
  const { fetchCoachWorkoutPlanById } = useCoachWorkoutData();
  const { getLinkedMealPlanForWorkout } = useMeals();

  const [workoutPlan, setWorkoutPlan] = useState<UserWorkoutPlan | null>(null);
  const [mealPlanDialogOpen, setMealPlanDialogOpen] = useState(false);
  const [checkingMealLink, setCheckingMealLink] = useState(false);
  const [weeksData, setWeeksData] = useState<Map<number, WeekData>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedDay, setSelectedDay] = useState<{
    week: number;
    day: string;
  } | null>(null);
  const [selectedDayExercises, setSelectedDayExercises] = useState<
    UserWorkoutPlanExerciseWithDetails[]
  >([]);
  const [completedSessionsCount, setCompletedSessionsCount] =
    useState<number>(0);
  const [isLoadingExercises, setIsLoadingExercises] = useState<boolean>(false);
  const [isGeneratingNextWeek, setIsGeneratingNextWeek] =
    useState<boolean>(false);
  const [generationSeconds, setGenerationSeconds] = useState<number>(0);
  const [isSavingGeneratedPlan, setIsSavingGeneratedPlan] =
    useState<boolean>(false);
  const [showIntensityDialog, setShowIntensityDialog] =
    useState<boolean>(false);
  const [regeneratingDayPlanIds, setRegeneratingDayPlanIds] = useState<
    string[]
  >([]);
  const [savingRegeneratedDayPlanIds, setSavingRegeneratedDayPlanIds] =
    useState<string[]>([]);
  const [pendingDayRegenerations, setPendingDayRegenerations] = useState<
    Record<string, PendingDayRegeneration>
  >({});
  const [nextWeekPreview, setNextWeekPreview] =
    useState<NextWeekPreviewData | null>(null);
  const [pendingNextWeekGeneration, setPendingNextWeekGeneration] =
    useState<PendingNextWeekGeneration | null>(null);
  const [selectedPreviewDayKey, setSelectedPreviewDayKey] = useState<
    string | null
  >(null);
  const [isRefreshingPage, setIsRefreshingPage] = useState(false);
  const exercisesByDayPlanIdRef = useRef<
    Map<string, UserWorkoutPlanExerciseWithDetails[]>
  >(new Map());
  const preloadedImageUrlsRef = useRef<Set<string>>(new Set());
  const ongoingExerciseFetchesRef = useRef<
    Map<string, Promise<UserWorkoutPlanExerciseWithDetails[]>>
  >(new Map());
  const autoGenerationInFlightRef = useRef(false);
  const normalizedGender = useMemo(() => {
    const gender = userProfile?.gender?.toLowerCase().trim() || "male";
    return gender === "female" || gender === "f" ? "female" : "male";
  }, [userProfile?.gender]);

  const handleRefreshPage = useCallback(() => {
    setIsRefreshingPage(true);
    window.location.reload();
  }, []);

  const getResolvedExerciseImageUrl = useCallback(
    (exercise: UserWorkoutPlanExerciseWithDetails): string => {
      return exercise.image_path?.trim() || "";
    },
    [],
  );

  const preloadImageUrl = useCallback((url: string) => {
    if (!url || typeof window === "undefined") return;
    if (preloadedImageUrlsRef.current.has(url)) return;

    preloadedImageUrlsRef.current.add(url);
    const image = new window.Image();
    image.decoding = "async";
    image.src = url;
  }, []);

  const preloadExercisesImages = useCallback(
    (exerciseList: UserWorkoutPlanExerciseWithDetails[]) => {
      exerciseList.forEach((exercise) => {
        preloadImageUrl(getResolvedExerciseImageUrl(exercise));
      });
    },
    [getResolvedExerciseImageUrl, preloadImageUrl],
  );

  const fetchExercisesWithCache = useCallback(
    async (
      dayPlanId: string,
    ): Promise<UserWorkoutPlanExerciseWithDetails[]> => {
      const cached = exercisesByDayPlanIdRef.current.get(dayPlanId);
      if (cached) {
        preloadExercisesImages(cached);
        return cached;
      }

      const ongoing = ongoingExerciseFetchesRef.current.get(dayPlanId);
      if (ongoing) {
        return ongoing;
      }

      const request = (async () => {
        const result = await fetchUserWorkoutPlanExercises(dayPlanId);
        const exercises = result.success && result.data ? result.data : [];
        exercisesByDayPlanIdRef.current.set(dayPlanId, exercises);
        preloadExercisesImages(exercises);
        return exercises;
      })();

      ongoingExerciseFetchesRef.current.set(dayPlanId, request);

      try {
        return await request;
      } finally {
        ongoingExerciseFetchesRef.current.delete(dayPlanId);
      }
    },
    [fetchUserWorkoutPlanExercises, preloadExercisesImages],
  );

  const fetchWeeksDataForPlan = useCallback(
    async (targetPlanId: string): Promise<Map<number, WeekData>> => {
      const weeksResult = await fetchAllUserWorkoutWeekPlans(targetPlanId);
      if (!weeksResult.success || !weeksResult.data) {
        return new Map<number, WeekData>();
      }

      const weeksMap = new Map<number, WeekData>();
      for (const weekPlan of weeksResult.data) {
        const weekNumber = weekPlan.week_number || 1;
        const dayResult = await fetchUserWorkoutWeeklyDayPlans(weekPlan.id);

        weeksMap.set(weekNumber, {
          weekPlan,
          dayPlans: dayResult.success && dayResult.data ? dayResult.data : [],
        });
      }

      return weeksMap;
    },
    [fetchAllUserWorkoutWeekPlans, fetchUserWorkoutWeeklyDayPlans],
  );

  const loadWorkoutPlanDetails = useCallback(
    async (targetPlanId: string): Promise<void> => {
      setIsLoading(true);
      try {
        const planResult = await fetchUserWorkoutPlanById(targetPlanId);
        if (planResult.success && planResult.data) {
          setWorkoutPlan(planResult.data);
          const weeksMap = await fetchWeeksDataForPlan(targetPlanId);
          setWeeksData(weeksMap);
          return;
        }

        const coachPlanResult = await fetchCoachWorkoutPlanById(targetPlanId);
        if (coachPlanResult.success && coachPlanResult.data) {
          router.replace(`/personal/coach/workout/details?id=${targetPlanId}`);
        }
      } catch (error) {
        console.error("Error fetching workout data:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      fetchUserWorkoutPlanById,
      fetchWeeksDataForPlan,
      fetchCoachWorkoutPlanById,
      router,
    ],
  );

  useEffect(() => {
    if (!planId) {
      router.push("/personal");
      return;
    }

    if (source === "coach") {
      router.replace(`/personal/coach/workout/details?id=${planId}`);
      return;
    }

    void loadWorkoutPlanDetails(planId);
  }, [planId, source, loadWorkoutPlanDetails, router]);

  const maybeAutoGenerateNextWeekForPlan = useCallback(
    async (options?: {
      openPreviewOnSuccess?: boolean;
      forcedRpe?: number;
    }): Promise<void> => {
      if (!planId || !userProfile?.user_id) return;
      if (autoGenerationInFlightRef.current) return;

      autoGenerationInFlightRef.current = true;
      try {
        const { data: weekPlansData, error: weekPlansError } = await supabase
          .from("user_workout_weekly_plan")
          .select("id, plan_id, week_number, rest_days, remaining_days")
          .eq("plan_id", planId)
          .order("week_number", { ascending: true });

        const weekPlans = (weekPlansData || []) as WeeklyPlanRow[];
        if (weekPlansError || weekPlans.length === 0) {
          return;
        }

        const sortedWeekPlans = [...weekPlans].sort(
          (a, b) => (a.week_number ?? 0) - (b.week_number ?? 0),
        );
        let currentWeekPlan: WeeklyPlanRow | null = null;
        let sourceWeekDayPlans: WeeklyDayPlanRow[] = [];

        // Choose the latest week that has workout rows and remaining days.
        // This avoids getting stuck on partial/empty latest week rows.
        for (let i = sortedWeekPlans.length - 1; i >= 0; i--) {
          const candidateWeek = sortedWeekPlans[i];
          const candidateRemainingDays = candidateWeek.remaining_days ?? 0;
          if (candidateRemainingDays === 0) continue;

          const {
            data: candidateWeekDayPlansData,
            error: candidateWeekDaysError,
          } = await supabase
            .from("user_workout_weekly_day_plan")
            .select("*")
            .eq("week_plan_id", candidateWeek.id)
            .order("created_at", { ascending: true });

          const candidateWeekDayPlans = (candidateWeekDayPlansData ||
            []) as WeeklyDayPlanRow[];
          if (
            candidateWeekDaysError ||
            !candidateWeekDayPlans ||
            candidateWeekDayPlans.length === 0
          ) {
            continue;
          }

          const candidateRestDaySet = new Set(
            (candidateWeek.rest_days || []).map((restDay) =>
              String(restDay).toLowerCase(),
            ),
          );
          const candidateWorkoutRows = candidateWeekDayPlans.filter(
            (dayPlan) => {
              const dayName = dayPlan.day?.toLowerCase() || "";
              return !!dayName && !candidateRestDaySet.has(dayName);
            },
          );
          if (candidateWorkoutRows.length === 0) {
            continue;
          }

          currentWeekPlan = candidateWeek;
          sourceWeekDayPlans = candidateWeekDayPlans;
          break;
        }

        if (!currentWeekPlan?.id || !currentWeekPlan.plan_id) {
          return;
        }

        const currentWeekNumber = currentWeekPlan.week_number ?? 1;
        const nextWeekNumber = currentWeekNumber + 1;

        const { data: workoutPlanRow, error: workoutPlanError } = await supabase
          .from("user_workout_plans")
          .select("id, name, duration_days")
          .eq("id", currentWeekPlan.plan_id)
          .maybeSingle();

        if (workoutPlanError || !workoutPlanRow?.id) {
          return;
        }

        const durationDays =
          workoutPlanRow.duration_days ?? workoutPlan?.duration_days ?? 28;
        const maxWeeks = Math.max(1, Math.ceil(durationDays / 7));
        if (nextWeekNumber > maxWeeks) {
          return;
        }

        if (sourceWeekDayPlans.length === 0) {
          return;
        }

        const { data: existingNextWeek } = await supabase
          .from("user_workout_weekly_plan")
          .select("id")
          .eq("plan_id", currentWeekPlan.plan_id)
          .eq("week_number", nextWeekNumber)
          .maybeSingle();

        let didMutateData = false;
        let nextWeekPlanId: string | null = existingNextWeek?.id || null;
        const existingNextWeekDayIdByName = new Map<string, string>();

        if (nextWeekPlanId) {
          const {
            data: existingNextWeekDays,
            error: existingNextWeekDaysError,
          } = await supabase
            .from("user_workout_weekly_day_plan")
            .select("id, day")
            .eq("week_plan_id", nextWeekPlanId)
            .limit(7);

          if (
            !existingNextWeekDaysError &&
            existingNextWeekDays &&
            existingNextWeekDays.length > 0
          ) {
            existingNextWeekDays.forEach((dayPlan) => {
              if (dayPlan.day && dayPlan.id) {
                existingNextWeekDayIdByName.set(
                  dayPlan.day.toLowerCase(),
                  dayPlan.id,
                );
              }
            });

            if (existingNextWeekDays.length >= 7) {
              return;
            }
          }
        }

        const remainingDaysForNextWeek = Math.max(
          durationDays - nextWeekNumber * 7,
          0,
        );

        if (!nextWeekPlanId && !options?.openPreviewOnSuccess) {
          const { data: insertedWeek, error: insertWeekError } = await supabase
            .from("user_workout_weekly_plan")
            .insert({
              week_number: nextWeekNumber,
              plan_id: currentWeekPlan.plan_id,
              rest_days: currentWeekPlan.rest_days || [],
              remaining_days: remainingDaysForNextWeek,
            })
            .select("id")
            .single();

          if (insertWeekError || !insertedWeek?.id) {
            const { data: refetchedWeek } = await supabase
              .from("user_workout_weekly_plan")
              .select("id")
              .eq("plan_id", currentWeekPlan.plan_id)
              .eq("week_number", nextWeekNumber)
              .maybeSingle();

            if (!refetchedWeek?.id) {
              return;
            }
            nextWeekPlanId = refetchedWeek.id;
          } else {
            nextWeekPlanId = insertedWeek.id;
            didMutateData = true;
          }
        }

        if (!nextWeekPlanId && !options?.openPreviewOnSuccess) {
          return;
        }

        const toTitleDay = (day: string): string =>
          day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();

        const weekDayOrder = [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ];

        const sourceDayPlanByName = new Map<string, WeeklyDayPlanRow>();
        sourceWeekDayPlans.forEach((dayPlan) => {
          if (dayPlan.day) {
            sourceDayPlanByName.set(dayPlan.day.toLowerCase(), dayPlan);
          }
        });

        const restDayNameMap = new Map<string, string>();
        (currentWeekPlan.rest_days || []).forEach((restDay) => {
          if (typeof restDay === "string" && restDay.trim()) {
            restDayNameMap.set(restDay.toLowerCase(), restDay);
          }
        });

        const restDaySet = new Set<string>(Array.from(restDayNameMap.keys()));
        weekDayOrder.forEach((dayNameLower) => {
          if (!sourceDayPlanByName.has(dayNameLower)) {
            restDaySet.add(dayNameLower);
            if (!restDayNameMap.has(dayNameLower)) {
              restDayNameMap.set(dayNameLower, toTitleDay(dayNameLower));
            }
          }
        });

        if (sourceDayPlanByName.size + restDaySet.size < 7) {
          return;
        }

        const generatedDayResults = new Map<string, DayWorkoutResponse>();
        for (const dayPlan of sourceWeekDayPlans) {
          const dayName = dayPlan.day || "";
          const dayNameLower = dayName.toLowerCase();
          if (!dayName || restDaySet.has(dayNameLower)) {
            continue;
          }

          const dayFocus = Array.isArray(dayPlan.focus)
            ? dayPlan.focus.join(", ")
            : "not specified";
          const dayRpe =
            typeof options?.forcedRpe === "number"
              ? options.forcedRpe
              : typeof dayPlan.rpe_record === "number" && dayPlan.rpe_record > 0
                ? dayPlan.rpe_record
                : 5;

          const adaptiveResult = await generateDayWorkoutWithRpePrompt({
            gender: userProfile.gender || "not specified",
            goal: userProfile.fitness_goal || "not specified",
            location: userProfile.workout_location || "not specified",
            equipments: userProfile.equipment_list?.length
              ? userProfile.equipment_list.join(", ")
              : "not specified",
            level: userProfile.fitness_level || "not specified",
            schedule: userProfile.weekly_frequency?.length
              ? userProfile.weekly_frequency.join(", ")
              : "not specified",
            age: userProfile.age_range || "not specified",
            duration: userProfile.workout_duration_minutes
              ? userProfile.workout_duration_minutes.toString()
              : "not specified",
            rpe: String(dayRpe),
            day_name: dayName,
            plan_name: workoutPlanRow.name || "Workout Plan",
            day_focus: dayFocus,
            week_number: String(nextWeekNumber),
            remaining_days: String(remainingDaysForNextWeek),
          });

          if (adaptiveResult.success && adaptiveResult.response) {
            generatedDayResults.set(dayNameLower, adaptiveResult.response);
          }
        }

        const nextWeekDayPayloads = weekDayOrder.map((dayNameLower) => {
          const sourceDayPlan = sourceDayPlanByName.get(dayNameLower);
          const generated = generatedDayResults.get(dayNameLower);
          const isRestDay = restDaySet.has(dayNameLower);
          const estimatedCalories =
            !isRestDay && generated
              ? formatEstimatedCalories(
                  generated["estimated total calories"] ||
                    generated.estimated_total_calories,
                )
              : null;
          const totalMinutes =
            !isRestDay && generated
              ? calculateDayTotalMinutes(generated)
              : null;
          const resolvedDayName =
            sourceDayPlan?.day ||
            restDayNameMap.get(dayNameLower) ||
            toTitleDay(dayNameLower);

          return {
            day: resolvedDayName,
            title: isRestDay ? "Rest Day" : sourceDayPlan?.title || null,
            focus: isRestDay ? null : sourceDayPlan?.focus || null,
            motivation: isRestDay ? null : sourceDayPlan?.motivation || null,
            week_plan_id: nextWeekPlanId,
            total_calories: estimatedCalories,
            total_minutes:
              totalMinutes && totalMinutes > 0 ? totalMinutes : null,
            rpe_record: null,
          };
        });

        if (options?.openPreviewOnSuccess) {
          const previewDays: NextWeekPreviewDay[] = weekDayOrder.map(
            (dayNameLower) => {
              const payload = nextWeekDayPayloads.find(
                (item) => item.day.toLowerCase() === dayNameLower,
              );
              const isRestDay = restDaySet.has(dayNameLower);
              return {
                day: payload?.day || toTitleDay(dayNameLower),
                title: payload?.title ?? null,
                focus: payload?.focus ?? null,
                motivation: payload?.motivation ?? null,
                isRestDay,
                totalCalories: payload?.total_calories ?? null,
                totalMinutes: payload?.total_minutes ?? null,
                exercises: generatedDayResults.get(dayNameLower) || null,
                aiDay: generatedDayResults.get(dayNameLower)?.day || null,
                aiName: generatedDayResults.get(dayNameLower)?.name || null,
                aiFocus: generatedDayResults.get(dayNameLower)?.focus || null,
                aiEstimatedCalories:
                  generatedDayResults.get(dayNameLower)?.[
                    "estimated total calories"
                  ] ||
                  generatedDayResults.get(dayNameLower)
                    ?.estimated_total_calories ||
                  null,
                aiIntensity:
                  generatedDayResults.get(dayNameLower)?.intensity || null,
              };
            },
          );

          const previewRestDays = weekDayOrder
            .filter((day) => restDaySet.has(day))
            .map((day) => toTitleDay(day));
          setNextWeekPreview({
            planName: workoutPlanRow.name || "Workout Plan",
            weekNumber: nextWeekNumber,
            restDays: previewRestDays,
            days: previewDays,
          });
          const generatedDayResultsRecord: Record<string, DayWorkoutResponse> =
            {};
          generatedDayResults.forEach((value, key) => {
            generatedDayResultsRecord[key] = value;
          });
          setPendingNextWeekGeneration({
            nextWeekPlanId,
            planId: currentWeekPlan.plan_id,
            nextWeekNumber,
            remainingDaysForNextWeek,
            restDays: currentWeekPlan.rest_days || [],
            nextWeekDayPayloads,
            generatedDayResults: generatedDayResultsRecord,
          });
          const firstWorkoutPreviewDay = previewDays.find(
            (day) => !day.isRestDay,
          );
          setSelectedPreviewDayKey(
            (
              firstWorkoutPreviewDay?.day ||
              previewDays[0]?.day ||
              ""
            ).toLowerCase(),
          );
          return;
        }

        const missingNextWeekDayPayloads = nextWeekDayPayloads.filter(
          (dayPayload) =>
            !existingNextWeekDayIdByName.has(dayPayload.day.toLowerCase()),
        );
        let insertedDayPlans: Array<{ id: string; day: string | null }> = [];

        if (missingNextWeekDayPayloads.length > 0) {
          const { data: newlyInsertedDayPlans, error: insertDayPlansError } =
            await supabase
              .from("user_workout_weekly_day_plan")
              .insert(missingNextWeekDayPayloads)
              .select("id, day");

          if (insertDayPlansError || !newlyInsertedDayPlans) {
            return;
          }

          insertedDayPlans = newlyInsertedDayPlans;
          didMutateData = true;
        }

        const nextWeekDayMap = new Map<string, string>([
          ...Array.from(existingNextWeekDayIdByName.entries()),
        ]);
        insertedDayPlans.forEach((dayPlan) => {
          if (dayPlan.day && dayPlan.id) {
            nextWeekDayMap.set(dayPlan.day.toLowerCase(), dayPlan.id);
          }
        });

        const exerciseDetailsPayloads: CreateUserExerciseDetailsPayload[] = [];
        generatedDayResults.forEach((dayResult) => {
          const sections = [
            { key: "warm_up", exercises: dayResult.warm_up || [] },
            { key: "main_workout", exercises: dayResult.main_workout || [] },
            { key: "cooldown", exercises: dayResult.cooldown || [] },
          ];

          sections.forEach(({ key, exercises }) => {
            const section = mapSectionNameForPlan(key);
            if (!section) return;

            exercises.forEach((exercise) => {
              if (!exercise.name) return;

              exerciseDetailsPayloads.push({
                name: exercise.name,
                safety_cue: exercise.safety_cue || null,
                section,
                equipment: parseEquipmentList(exercise.equipment) || null,
                image_slug: generateImageSlug(section, exercise.name),
              });
            });
          });
        });

        if (exerciseDetailsPayloads.length > 0) {
          const exerciseDetailsResult = await createOrReuseExerciseDetailsBatch(
            exerciseDetailsPayloads,
          );
          if (!exerciseDetailsResult.success || !exerciseDetailsResult.data) {
            return;
          }

          const exerciseById = new Map(
            exerciseDetailsResult.data.map((exercise) => [
              exercise.id,
              exercise,
            ]),
          );
          const exerciseIdMap = new Map<string, string>();
          exerciseDetailsResult.data.forEach((exercise) => {
            exerciseIdMap.set(
              createExerciseKey(exercise.name, exercise.equipment),
              exercise.id,
            );
          });

          const planExercisePayloads: CreateUserWorkoutPlanExercisePayload[] =
            [];
          generatedDayResults.forEach((dayResult, dayNameLower) => {
            const weeklyPlanId = nextWeekDayMap.get(dayNameLower);
            if (!weeklyPlanId) return;

            const positionCounters = { warmup: 0, main: 0, cooldown: 0 };
            const sections = [
              { key: "warm_up", exercises: dayResult.warm_up || [] },
              { key: "main_workout", exercises: dayResult.main_workout || [] },
              { key: "cooldown", exercises: dayResult.cooldown || [] },
            ];

            sections.forEach(({ key, exercises }) => {
              const section = mapSectionNameForPlan(key);
              if (!section) return;

              exercises.forEach((exercise) => {
                if (!exercise.name) return;

                const exerciseKey = createExerciseKey(
                  exercise.name,
                  exercise.equipment,
                );
                const exerciseId = exerciseIdMap.get(exerciseKey);
                if (!exerciseId) return;

                const metrics = parsePlanExerciseMetricsForSave(
                  getExerciseMetricsText(exercise),
                );
                const position = getExercisePosition(
                  section,
                  positionCounters[section],
                );
                positionCounters[section]++;

                const savedExercise = exerciseById.get(exerciseId);
                const imageSlug =
                  savedExercise?.image_slug ||
                  generateImageSlug(section, exercise.name);
                const imagePath = getExerciseImagePath(
                  normalizedGender,
                  imageSlug,
                );

                planExercisePayloads.push({
                  weekly_plan_id: weeklyPlanId,
                  exercise_id: exerciseId,
                  position,
                  section,
                  sets: metrics.sets,
                  reps: metrics.reps,
                  duration_seconds: metrics.duration_seconds,
                  rest_seconds: metrics.rest_seconds,
                  per_side: exercise.per_side?.toLowerCase() === "yes",
                  image_path: imagePath,
                  image_alt: `${exercise.name} exercise demonstration`,
                  description: exercise.description || null,
                  is_image_generated: null,
                });
              });
            });
          });

          if (planExercisePayloads.length > 0) {
            await createUserWorkoutPlanExercisesBatch(planExercisePayloads);
            didMutateData = true;
          }
        }

        if (didMutateData) {
          await loadWorkoutPlanDetails(planId);
        }
      } catch (error) {
        console.error("Auto-generate next week failed (details page):", error);
      } finally {
        autoGenerationInFlightRef.current = false;
      }
    },
    [
      planId,
      userProfile?.user_id,
      userProfile?.gender,
      userProfile?.fitness_goal,
      userProfile?.workout_location,
      userProfile?.equipment_list,
      userProfile?.fitness_level,
      userProfile?.weekly_frequency,
      userProfile?.age_range,
      userProfile?.workout_duration_minutes,
      workoutPlan?.duration_days,
      createOrReuseExerciseDetailsBatch,
      createUserWorkoutPlanExercisesBatch,
      getExercisePosition,
      generateImageSlug,
      getExerciseImagePath,
      normalizedGender,
      loadWorkoutPlanDetails,
    ],
  );

  // Reset per-plan preload/cache state
  useEffect(() => {
    exercisesByDayPlanIdRef.current.clear();
    preloadedImageUrlsRef.current.clear();
    ongoingExerciseFetchesRef.current.clear();
    setSelectedDayExercises([]);
    setPendingDayRegenerations({});
    setSavingRegeneratedDayPlanIds([]);
    setRegeneratingDayPlanIds([]);
  }, [planId]);

  // Fetch exercises when a day is selected (with cache)
  useEffect(() => {
    if (!selectedDay) {
      setSelectedDayExercises([]);
      setIsLoadingExercises(false);
      return;
    }

    const fetchExercises = async () => {
      try {
        // Get week data and find the day plan ID
        const weekData = weeksData.get(selectedDay.week);
        if (weekData?.dayPlans) {
          const dayPlan = weekData.dayPlans.find(
            (d) => d.day?.toLowerCase() === selectedDay.day.toLowerCase(),
          );

          if (dayPlan?.id) {
            const cached = exercisesByDayPlanIdRef.current.get(dayPlan.id);
            if (cached) {
              setSelectedDayExercises(cached);
              setIsLoadingExercises(false);
              return;
            }

            setIsLoadingExercises(true);
            const exercises = await fetchExercisesWithCache(dayPlan.id);
            setSelectedDayExercises(exercises);
          } else {
            setSelectedDayExercises([]);
            setIsLoadingExercises(false);
          }
        } else {
          setSelectedDayExercises([]);
          setIsLoadingExercises(false);
        }
      } catch (error) {
        console.error("Error fetching exercises:", error);
        setSelectedDayExercises([]);
        setIsLoadingExercises(false);
      } finally {
        setIsLoadingExercises(false);
      }
    };

    fetchExercises();
  }, [selectedDay, weeksData, fetchExercisesWithCache]);

  useEffect(() => {
    if (!planId || !user?.id) {
      setCompletedSessionsCount(0);
      return;
    }

    let isCancelled = false;

    const fetchCompletedSessionsCount = async () => {
      const { count, error } = await supabase
        .from("user_workout_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("plan_id", planId)
        .not("ended_at", "is", null);

      if (isCancelled) return;

      if (error) {
        setCompletedSessionsCount(0);
        return;
      }

      setCompletedSessionsCount(count || 0);
    };

    fetchCompletedSessionsCount();

    return () => {
      isCancelled = true;
    };
  }, [planId, user?.id]);

  // Preload images for this plan (first workout day first, then remaining in background)
  useEffect(() => {
    if (!planId || weeksData.size === 0) return;

    let isCancelled = false;

    const preloadPlanExerciseImages = async () => {
      const orderedWeeks = Array.from(weeksData.entries()).sort(
        (a, b) => a[0] - b[0],
      );

      const allDayPlanIds: string[] = [];
      let firstWorkoutDayPlanId: string | null = null;

      for (const [, weekData] of orderedWeeks) {
        const restDays = (weekData.weekPlan.rest_days || []).map((d) =>
          d.toLowerCase(),
        );

        for (const dayPlan of weekData.dayPlans) {
          if (!dayPlan.id || !dayPlan.day) continue;
          allDayPlanIds.push(dayPlan.id);

          if (
            !firstWorkoutDayPlanId &&
            !restDays.includes(dayPlan.day.toLowerCase())
          ) {
            firstWorkoutDayPlanId = dayPlan.id;
          }
        }
      }

      if (allDayPlanIds.length === 0) return;

      // Prime likely first-screen exercises/images first.
      if (firstWorkoutDayPlanId) {
        await fetchExercisesWithCache(firstWorkoutDayPlanId);
      }

      if (isCancelled) return;

      const remainingIds = Array.from(new Set(allDayPlanIds)).filter(
        (id) => id !== firstWorkoutDayPlanId,
      );

      let cursor = 0;
      const concurrency = Math.min(3, remainingIds.length);

      const workers = Array.from({ length: concurrency }, () =>
        (async () => {
          while (!isCancelled) {
            const currentIndex = cursor;
            cursor += 1;
            if (currentIndex >= remainingIds.length) break;
            await fetchExercisesWithCache(remainingIds[currentIndex]);
          }
        })(),
      );

      await Promise.all(workers);
    };

    preloadPlanExerciseImages().catch((error) => {
      console.error("Error preloading workout exercise images:", error);
    });

    return () => {
      isCancelled = true;
    };
  }, [planId, weeksData, fetchExercisesWithCache]);

  // Calculate total weeks needed based on duration
  const totalWeeks = useMemo(() => {
    const durationDays = workoutPlan?.duration_days || 28;
    return Math.ceil(durationDays / 7);
  }, [workoutPlan?.duration_days]);

  const firstWeekFirstDayInfo = useMemo(() => {
    const firstWeekData = weeksData.get(1);
    if (!firstWeekData?.dayPlans?.length) {
      return { dayName: null as string | null, isCompleted: false };
    }

    const firstDayPlan = firstWeekData.dayPlans.find((dayPlan) => !!dayPlan.day);
    if (!firstDayPlan?.day) {
      return { dayName: null as string | null, isCompleted: false };
    }

    return {
      dayName: firstDayPlan.day,
      isCompleted: Boolean(firstDayPlan.isCompleted ?? firstDayPlan.is_completed),
    };
  }, [weeksData]);

  // Day names for display.
  // Default: Day 1 starts from today's local weekday.
  // Once the first day is completed, keep a stable order anchored to that first day.
  const orderedDayNames = useMemo(() => {
    const baseDays = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const todayIndex = new Date().getDay(); // 0=Sunday ... 6=Saturday

    const firstDayIndex = firstWeekFirstDayInfo.dayName
      ? baseDays.findIndex(
          (dayName) =>
            dayName.toLowerCase() === firstWeekFirstDayInfo.dayName!.toLowerCase(),
        )
      : -1;

    const startIndex =
      firstWeekFirstDayInfo.isCompleted && firstDayIndex >= 0
        ? firstDayIndex
        : todayIndex;

    return [...baseDays.slice(startIndex), ...baseDays.slice(0, startIndex)];
  }, [firstWeekFirstDayInfo]);

  const orderedDayAbbrev = useMemo(
    () => orderedDayNames.map((day) => day.slice(0, 3)),
    [orderedDayNames],
  );

  // Helper to get rest days for a specific week
  const getRestDaysForWeek = useCallback(
    (weekNumber: number): string[] => {
      const weekData = weeksData.get(weekNumber);
      return weekData?.weekPlan?.rest_days || [];
    },
    [weeksData],
  );

  // Helper to get day data map for a specific week
  const getDayDataMapForWeek = useCallback(
    (weekNumber: number): Map<string, UserWorkoutWeeklyPlan> => {
      const map = new Map<string, UserWorkoutWeeklyPlan>();
      const weekData = weeksData.get(weekNumber);
      if (weekData?.dayPlans) {
        weekData.dayPlans.forEach((day) => {
          if (day.day) {
            map.set(day.day.toLowerCase(), day);
          }
        });
      }
      return map;
    },
    [weeksData],
  );

  // Check if a week has data
  const weekHasData = useCallback(
    (weekNumber: number): boolean => {
      const weekData = weeksData.get(weekNumber);
      return Boolean(weekData && weekData.dayPlans.length > 0);
    },
    [weeksData],
  );

  // Build calendar data for a specific week
  const getWeekCalendarData = useCallback(
    (weekNumber: number) => {
      const durationDays = workoutPlan?.duration_days || 28;
      const restDays = getRestDaysForWeek(weekNumber);
      const dayDataMap = getDayDataMapForWeek(weekNumber);

      const weekDays: {
        dayName: string;
        dayAbbrev: string;
        dayNumber: number;
        isRestDay: boolean;
        data: UserWorkoutWeeklyPlan | null;
      }[] = [];

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const dayNumber = (weekNumber - 1) * 7 + dayIndex + 1;
        if (dayNumber <= durationDays) {
          const dayName = orderedDayNames[dayIndex];
          const isRestDay = restDays.some(
            (rd) => rd.toLowerCase() === dayName.toLowerCase(),
          );
          const dayData = dayDataMap.get(dayName.toLowerCase()) || null;

          weekDays.push({
            dayName,
            dayAbbrev: orderedDayAbbrev[dayIndex],
            dayNumber,
            isRestDay,
            data: dayData,
          });
        }
      }
      return weekDays;
    },
    [
      workoutPlan?.duration_days,
      getRestDaysForWeek,
      getDayDataMapForWeek,
      orderedDayNames,
      orderedDayAbbrev,
    ],
  );

  // Clean plan name (remove timestamp)
  const cleanPlanName = useMemo(() => {
    if (!workoutPlan?.name) return "";
    return workoutPlan.name.replace(/ - \d{4}-\d{2}-\d{2}.*$/, "");
  }, [workoutPlan?.name]);

  // Parse calories string to number
  const parseCalories = (caloriesStr: string | null): number | null => {
    if (!caloriesStr) return null;
    const match = caloriesStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  // Exercise helper functions
  const formatDuration = useCallback((seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }, []);

  const getSectionTitle = useCallback(
    (section: string, count: number): string => {
      if (section === "warmup") return `Warm Up (${count})`;
      if (section === "main") return `Main Exercises (${count})`;
      if (section === "cooldown") return `Cool Down (${count})`;
      return section;
    },
    [],
  );

  const allWorkoutDays = useMemo<WorkoutDayRef[]>(() => {
    const workoutDays: WorkoutDayRef[] = [];
    for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber++) {
      const weekDays = getWeekCalendarData(weekNumber);
      weekDays.forEach((day) => {
        if (!day.isRestDay) {
          workoutDays.push({
            week: weekNumber,
            day: day.dayName,
            dayNumber: day.dayNumber,
            dayPlanId: day.data?.id || null,
          });
        }
      });
    }
    return workoutDays;
  }, [totalWeeks, getWeekCalendarData]);

  const workoutDayOrderByKey = useMemo(() => {
    const map = new Map<string, number>();
    allWorkoutDays.forEach((day, index) => {
      map.set(`${day.week}|${day.day.toLowerCase()}`, index);
    });
    return map;
  }, [allWorkoutDays]);

  const nextUnlockedWorkoutDay = useMemo<WorkoutDayRef | null>(() => {
    if (allWorkoutDays.length === 0) return null;

    const dayIndex = Math.min(
      Math.max(completedSessionsCount, 0),
      allWorkoutDays.length - 1,
    );
    return allWorkoutDays[dayIndex];
  }, [allWorkoutDays, completedSessionsCount]);

  const selectedWorkoutDay = useMemo<WorkoutDayRef | null>(() => {
    if (!selectedDay) return null;
    return (
      allWorkoutDays.find(
        (day) =>
          day.week === selectedDay.week &&
          day.day.toLowerCase() === selectedDay.day.toLowerCase(),
      ) || null
    );
  }, [selectedDay, allWorkoutDays]);

  const isSelectedDayLocked = useMemo(() => {
    if (!selectedWorkoutDay) return false;
    const selectedIndex = workoutDayOrderByKey.get(
      `${selectedWorkoutDay.week}|${selectedWorkoutDay.day.toLowerCase()}`,
    );
    return (
      typeof selectedIndex === "number" &&
      selectedIndex > completedSessionsCount
    );
  }, [selectedWorkoutDay, workoutDayOrderByKey, completedSessionsCount]);

  const resolvedStartDay = useMemo<WorkoutDayRef | null>(() => {
    if (selectedWorkoutDay && !isSelectedDayLocked) {
      return selectedWorkoutDay;
    }
    return nextUnlockedWorkoutDay;
  }, [selectedWorkoutDay, isSelectedDayLocked, nextUnlockedWorkoutDay]);

  const buildSessionPath = useCallback((): string | null => {
    if (!planId) return null;
    if (!resolvedStartDay) return null;

    return `/personal/workout/exercises/session?planId=${planId}&week=${resolvedStartDay.week}&day=${resolvedStartDay.day}${resolvedStartDay.dayPlanId ? `&dayPlanId=${resolvedStartDay.dayPlanId}` : ""}&fullscreen=1`;
  }, [planId, resolvedStartDay]);

  const isStartWorkoutDisabled =
    !resolvedStartDay || (Boolean(selectedDay) && isSelectedDayLocked);

  const todayDayName = useMemo(
    () => new Date().toLocaleDateString("en-US", { weekday: "long" }),
    [],
  );

  const activeProgressWeek = useMemo(() => {
    if (nextUnlockedWorkoutDay?.week) return nextUnlockedWorkoutDay.week;
    if (resolvedStartDay?.week) return resolvedStartDay.week;
    return 1;
  }, [nextUnlockedWorkoutDay, resolvedStartDay]);

  const isTodayRestDay = useMemo(() => {
    const weekDays = getWeekCalendarData(activeProgressWeek);
    const todayEntry = weekDays.find(
      (day) => day.dayName.toLowerCase() === todayDayName.toLowerCase(),
    );
    return Boolean(todayEntry?.isRestDay);
  }, [activeProgressWeek, getWeekCalendarData, todayDayName]);

  const isStartWorkoutButtonDisabled = isTodayRestDay || isStartWorkoutDisabled;

  const selectedDayCompletion = useMemo(() => {
    if (!selectedDay) {
      return { isCompleted: false, dayNumber: null as number | null };
    }

    const selectedWeekDays = getWeekCalendarData(selectedDay.week);
    const selectedEntry = selectedWeekDays.find(
      (day) => day.dayName.toLowerCase() === selectedDay.day.toLowerCase(),
    );

    const completedFromDayPlan = Boolean(
      selectedEntry?.data?.isCompleted ?? selectedEntry?.data?.is_completed,
    );

    return {
      isCompleted: completedFromDayPlan,
      dayNumber: selectedEntry?.dayNumber ?? null,
    };
  }, [selectedDay, getWeekCalendarData]);

  const isSelectedDayCompleted = selectedDayCompletion.isCompleted;
  const finalStartButtonDisabled =
    isStartWorkoutButtonDisabled || isSelectedDayCompleted;

  const handleStartWorkout = useCallback(() => {
    if (isTodayRestDay) {
      return;
    }

    if (isSelectedDayCompleted) {
      return;
    }

    if (selectedDay && isSelectedDayLocked && nextUnlockedWorkoutDay) {
      alert(
        `Complete Day ${nextUnlockedWorkoutDay.dayNumber} (${nextUnlockedWorkoutDay.day}) first before starting another day.`,
      );
      return;
    }

    const sessionPath = buildSessionPath();
    if (!sessionPath) return;

    router.push(sessionPath);
  }, [
    isTodayRestDay,
    isSelectedDayCompleted,
    selectedDay,
    isSelectedDayLocked,
    nextUnlockedWorkoutDay,
    buildSessionPath,
    router,
  ]);

  const startWorkoutLabel = useMemo(() => {
    if (isTodayRestDay) {
      return "Time to take a Rest!";
    }

    if (isSelectedDayCompleted) {
      return `You have completed day ${selectedDayCompletion.dayNumber ?? "#"}`;
    }

    if (selectedDay && isSelectedDayLocked && nextUnlockedWorkoutDay) {
      return `Complete Day ${nextUnlockedWorkoutDay.dayNumber} (${nextUnlockedWorkoutDay.day}) first`;
    }

    if (resolvedStartDay) {
      return `Start Workout Day ${resolvedStartDay.dayNumber} (${resolvedStartDay.day})`;
    }

    return "Start Workout";
  }, [
    isTodayRestDay,
    isSelectedDayCompleted,
    selectedDayCompletion.dayNumber,
    selectedDay,
    isSelectedDayLocked,
    nextUnlockedWorkoutDay,
    resolvedStartDay,
  ]);

  const latestGeneratedWeekNumber = useMemo(() => {
    const weekNumbersWithRows = Array.from(weeksData.entries())
      .filter(([, weekData]) => weekData.dayPlans.length > 0)
      .map(([weekNumber]) => weekNumber);
    if (weekNumbersWithRows.length === 0) return 0;
    return Math.max(...weekNumbersWithRows);
  }, [weeksData]);

  const nextWeekToGenerate = useMemo(() => {
    if (latestGeneratedWeekNumber <= 0) return 1;
    return latestGeneratedWeekNumber + 1;
  }, [latestGeneratedWeekNumber]);

  const handleGenerateNow = useCallback(
    async (forcedRpe: number) => {
      if (isGeneratingNextWeek) return;
      setIsGeneratingNextWeek(true);
      try {
        await maybeAutoGenerateNextWeekForPlan({
          openPreviewOnSuccess: true,
          forcedRpe,
        });
      } finally {
        setIsGeneratingNextWeek(false);
      }
    },
    [isGeneratingNextWeek, maybeAutoGenerateNextWeekForPlan],
  );

  const generationProgressPercent = useMemo(
    () =>
      Math.min(
        Math.round((generationSeconds / GENERATION_DURATION_SECONDS) * 100),
        100,
      ),
    [generationSeconds],
  );
  const currentGenerationStep = useMemo(
    () =>
      GENERATION_STEP_TIMINGS.reduce(
        (acc, startTime, index) =>
          generationSeconds >= startTime ? index : acc,
        0,
      ),
    [generationSeconds],
  );
  const hasPendingDayRegeneration = useMemo(
    () => Object.keys(pendingDayRegenerations).length > 0,
    [pendingDayRegenerations],
  );
  const hasPendingWeekGeneration = Boolean(pendingNextWeekGeneration);
  const hasWeekPreviewToSave = Boolean(nextWeekPreview);
  const hasRegeneratingDayPlans = regeneratingDayPlanIds.length > 0;
  const hasSavingRegeneratedDayPlans = savingRegeneratedDayPlanIds.length > 0;
  const shouldBlockTabClose = useMemo(
    () =>
      isGeneratingNextWeek ||
      isSavingGeneratedPlan ||
      hasPendingWeekGeneration ||
      hasWeekPreviewToSave ||
      hasPendingDayRegeneration ||
      hasRegeneratingDayPlans ||
      hasSavingRegeneratedDayPlans,
    [
      isGeneratingNextWeek,
      isSavingGeneratedPlan,
      hasPendingWeekGeneration,
      hasWeekPreviewToSave,
      hasPendingDayRegeneration,
      hasRegeneratingDayPlans,
      hasSavingRegeneratedDayPlans,
    ],
  );

  useEffect(() => {
    if (!isGeneratingNextWeek) {
      setGenerationSeconds(0);
      return;
    }

    const startTime = Date.now();
    const intervalId = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      setGenerationSeconds(
        Math.min(elapsedSeconds, GENERATION_DURATION_SECONDS),
      );
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isGeneratingNextWeek]);

  useEffect(() => {
    if (!shouldBlockTabClose) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [shouldBlockTabClose]);

  const handleSaveGeneratedPlan = useCallback(async (): Promise<void> => {
    if (isSavingGeneratedPlan) return;
    if (!planId || !pendingNextWeekGeneration) return;

    setIsSavingGeneratedPlan(true);
    try {
      let nextWeekPlanId = pendingNextWeekGeneration.nextWeekPlanId;
      if (!nextWeekPlanId) {
        const { data: existingNextWeek } = await supabase
          .from("user_workout_weekly_plan")
          .select("id")
          .eq("plan_id", pendingNextWeekGeneration.planId)
          .eq("week_number", pendingNextWeekGeneration.nextWeekNumber)
          .maybeSingle();

        if (existingNextWeek?.id) {
          nextWeekPlanId = existingNextWeek.id;
        } else {
          const { data: insertedWeek, error: insertWeekError } = await supabase
            .from("user_workout_weekly_plan")
            .insert({
              week_number: pendingNextWeekGeneration.nextWeekNumber,
              plan_id: pendingNextWeekGeneration.planId,
              rest_days: pendingNextWeekGeneration.restDays,
              remaining_days:
                pendingNextWeekGeneration.remainingDaysForNextWeek,
            })
            .select("id")
            .single();
          if (insertWeekError || !insertedWeek?.id) {
            return;
          }
          nextWeekPlanId = insertedWeek.id;
        }
      }

      if (!nextWeekPlanId) {
        return;
      }

      const { data: existingNextWeekDays, error: existingNextWeekDaysError } =
        await supabase
          .from("user_workout_weekly_day_plan")
          .select("id, day")
          .eq("week_plan_id", nextWeekPlanId)
          .limit(7);

      const existingNextWeekDayIdByName = new Map<string, string>();
      if (!existingNextWeekDaysError && existingNextWeekDays) {
        existingNextWeekDays.forEach((dayPlan) => {
          if (dayPlan.day && dayPlan.id) {
            existingNextWeekDayIdByName.set(
              dayPlan.day.toLowerCase(),
              dayPlan.id,
            );
          }
        });
      }

      const nextWeekDayPayloadsWithPlanId =
        pendingNextWeekGeneration.nextWeekDayPayloads.map((payload) => ({
          ...payload,
          week_plan_id: nextWeekPlanId,
        }));
      const missingNextWeekDayPayloads = nextWeekDayPayloadsWithPlanId.filter(
        (dayPayload) =>
          !existingNextWeekDayIdByName.has(dayPayload.day.toLowerCase()),
      );

      let insertedDayPlans: Array<{ id: string; day: string | null }> = [];
      if (missingNextWeekDayPayloads.length > 0) {
        const { data: newlyInsertedDayPlans, error: insertDayPlansError } =
          await supabase
            .from("user_workout_weekly_day_plan")
            .insert(missingNextWeekDayPayloads)
            .select("id, day");

        if (insertDayPlansError || !newlyInsertedDayPlans) {
          return;
        }

        insertedDayPlans = newlyInsertedDayPlans;
      }

      const nextWeekDayMap = new Map<string, string>([
        ...Array.from(existingNextWeekDayIdByName.entries()),
      ]);
      insertedDayPlans.forEach((dayPlan) => {
        if (dayPlan.day && dayPlan.id) {
          nextWeekDayMap.set(dayPlan.day.toLowerCase(), dayPlan.id);
        }
      });

      const generatedDayResults = new Map<string, DayWorkoutResponse>(
        Object.entries(pendingNextWeekGeneration.generatedDayResults),
      );
      const exerciseDetailsPayloads: CreateUserExerciseDetailsPayload[] = [];
      generatedDayResults.forEach((dayResult) => {
        const sections = [
          { key: "warm_up", exercises: dayResult.warm_up || [] },
          { key: "main_workout", exercises: dayResult.main_workout || [] },
          { key: "cooldown", exercises: dayResult.cooldown || [] },
        ];

        sections.forEach(({ key, exercises }) => {
          const section = mapSectionNameForPlan(key);
          if (!section) return;

          exercises.forEach((exercise) => {
            if (!exercise.name) return;

            exerciseDetailsPayloads.push({
              name: exercise.name,
              safety_cue: exercise.safety_cue || null,
              section,
              equipment: parseEquipmentList(exercise.equipment) || null,
              image_slug: generateImageSlug(section, exercise.name),
            });
          });
        });
      });

      if (exerciseDetailsPayloads.length > 0) {
        const exerciseDetailsResult = await createOrReuseExerciseDetailsBatch(
          exerciseDetailsPayloads,
        );
        if (!exerciseDetailsResult.success || !exerciseDetailsResult.data) {
          return;
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

        const affectedDayPlanIds = Array.from(nextWeekDayMap.values());
        if (affectedDayPlanIds.length > 0) {
          await supabase
            .from("user_workout_plan_exercises")
            .delete()
            .in("weekly_plan_id", affectedDayPlanIds);
        }

        const planExercisePayloads: CreateUserWorkoutPlanExercisePayload[] = [];
        generatedDayResults.forEach((dayResult, dayNameLower) => {
          const weeklyPlanId = nextWeekDayMap.get(dayNameLower);
          if (!weeklyPlanId) return;

          const positionCounters = { warmup: 0, main: 0, cooldown: 0 };
          const sections = [
            { key: "warm_up", exercises: dayResult.warm_up || [] },
            { key: "main_workout", exercises: dayResult.main_workout || [] },
            { key: "cooldown", exercises: dayResult.cooldown || [] },
          ];

          sections.forEach(({ key, exercises }) => {
            const section = mapSectionNameForPlan(key);
            if (!section) return;

            exercises.forEach((exercise) => {
              if (!exercise.name) return;

              const exerciseKey = createExerciseKey(
                exercise.name,
                exercise.equipment,
              );
              const exerciseId = exerciseIdMap.get(exerciseKey);
              if (!exerciseId) return;

              const metrics = parsePlanExerciseMetricsForSave(
                getExerciseMetricsText(exercise),
              );
              const position = getExercisePosition(
                section,
                positionCounters[section],
              );
              positionCounters[section]++;

              const savedExercise = exerciseById.get(exerciseId);
              const imageSlug =
                savedExercise?.image_slug ||
                generateImageSlug(section, exercise.name);
              const imagePath = getExerciseImagePath(
                normalizedGender,
                imageSlug,
              );

              planExercisePayloads.push({
                weekly_plan_id: weeklyPlanId,
                exercise_id: exerciseId,
                position,
                section,
                sets: metrics.sets,
                reps: metrics.reps,
                duration_seconds: metrics.duration_seconds,
                rest_seconds: metrics.rest_seconds,
                per_side: exercise.per_side?.toLowerCase() === "yes",
                image_path: imagePath,
                image_alt: `${exercise.name} exercise demonstration`,
                description: exercise.description || null,
                is_image_generated: null,
              });
            });
          });
        });

        if (planExercisePayloads.length > 0) {
          await createUserWorkoutPlanExercisesBatch(planExercisePayloads);
        }
      }

      await loadWorkoutPlanDetails(planId);
      setNextWeekPreview(null);
      setPendingNextWeekGeneration(null);
      setSelectedPreviewDayKey(null);
    } catch (error) {
      console.error("Save generated plan failed:", error);
    } finally {
      setIsSavingGeneratedPlan(false);
    }
  }, [
    isSavingGeneratedPlan,
    planId,
    pendingNextWeekGeneration,
    createOrReuseExerciseDetailsBatch,
    createUserWorkoutPlanExercisesBatch,
    getExercisePosition,
    generateImageSlug,
    getExerciseImagePath,
    normalizedGender,
    loadWorkoutPlanDetails,
  ]);

  const handleRegenerateDay = useCallback(
    async (weekNumber: number, dayName: string): Promise<void> => {
      if (!planId || !userProfile?.user_id) return;

      const weekData = weeksData.get(weekNumber);
      if (!weekData) return;

      const dayPlan =
        weekData.dayPlans.find(
          (row) => row.day?.toLowerCase() === dayName.toLowerCase(),
        ) || null;
      if (!dayPlan?.id) return;

      const dayPlanId = dayPlan.id;
      const isCompleted = Boolean(dayPlan.isCompleted ?? dayPlan.is_completed);
      if (isCompleted) return;
      if (regeneratingDayPlanIds.includes(dayPlanId)) return;

      setRegeneratingDayPlanIds((prev) => [...prev, dayPlanId]);

      try {
        const dayFocus =
          Array.isArray(dayPlan.focus) && dayPlan.focus.length > 0
            ? dayPlan.focus.join(", ")
            : "not specified";
        const dayRpe =
          typeof dayPlan.rpe_record === "number" && dayPlan.rpe_record > 0
            ? dayPlan.rpe_record
            : 5;

        const regenerateResult = await generateDayWorkoutWithRpePrompt({
          gender: userProfile.gender || "not specified",
          goal: userProfile.fitness_goal || "not specified",
          location: userProfile.workout_location || "not specified",
          equipments: userProfile.equipment_list?.length
            ? userProfile.equipment_list.join(", ")
            : "not specified",
          level: userProfile.fitness_level || "not specified",
          schedule: userProfile.weekly_frequency?.length
            ? userProfile.weekly_frequency.join(", ")
            : "not specified",
          age: userProfile.age_range || "not specified",
          duration: userProfile.workout_duration_minutes
            ? userProfile.workout_duration_minutes.toString()
            : "not specified",
          rpe: String(dayRpe),
          day_name: dayPlan.day || dayName,
          plan_name: workoutPlan?.name || "Workout Plan",
          day_focus: dayFocus,
          week_number: String(weekData.weekPlan.week_number ?? weekNumber),
          remaining_days: String(weekData.weekPlan.remaining_days ?? 0),
        });

        if (!regenerateResult.success || !regenerateResult.response) {
          return;
        }

        const dayResult = regenerateResult.response;
        const estimatedCalories = formatEstimatedCalories(
          dayResult["estimated total calories"] ||
            dayResult.estimated_total_calories,
        );
        const totalMinutes = calculateDayTotalMinutes(dayResult);

        setPendingDayRegenerations((prev) => ({
          ...prev,
          [dayPlanId]: {
            weekNumber,
            dayName: dayPlan.day || dayName,
            dayPlanId,
            dayResult,
            totalCalories: estimatedCalories,
            totalMinutes: totalMinutes > 0 ? totalMinutes : null,
          },
        }));
      } catch (error) {
        console.error("Regenerate day failed:", error);
      } finally {
        setRegeneratingDayPlanIds((prev) =>
          prev.filter((id) => id !== dayPlanId),
        );
      }
    },
    [
      planId,
      userProfile?.user_id,
      userProfile?.gender,
      userProfile?.fitness_goal,
      userProfile?.workout_location,
      userProfile?.equipment_list,
      userProfile?.fitness_level,
      userProfile?.weekly_frequency,
      userProfile?.age_range,
      userProfile?.workout_duration_minutes,
      weeksData,
      regeneratingDayPlanIds,
      workoutPlan?.name,
    ],
  );

  const handleSaveRegeneratedDay = useCallback(
    async (dayPlanId: string): Promise<void> => {
      if (!planId || !dayPlanId) return;
      if (savingRegeneratedDayPlanIds.includes(dayPlanId)) return;

      const pendingRegeneration = pendingDayRegenerations[dayPlanId];
      if (!pendingRegeneration) return;

      setSavingRegeneratedDayPlanIds((prev) => [...prev, dayPlanId]);
      try {
        await supabase
          .from("user_workout_weekly_day_plan")
          .update({
            total_calories: pendingRegeneration.totalCalories,
            total_minutes: pendingRegeneration.totalMinutes,
          })
          .eq("id", dayPlanId);

        const dayResult = pendingRegeneration.dayResult;
        const sections = [
          { key: "warm_up", exercises: dayResult.warm_up || [] },
          { key: "main_workout", exercises: dayResult.main_workout || [] },
          { key: "cooldown", exercises: dayResult.cooldown || [] },
        ];

        const exerciseDetailsPayloads: CreateUserExerciseDetailsPayload[] = [];
        sections.forEach(({ key, exercises }) => {
          const section = mapSectionNameForPlan(key);
          if (!section) return;

          exercises.forEach((exercise) => {
            if (!exercise.name) return;
            exerciseDetailsPayloads.push({
              name: exercise.name,
              safety_cue: exercise.safety_cue || null,
              section,
              equipment: parseEquipmentList(exercise.equipment) || null,
              image_slug: generateImageSlug(section, exercise.name),
            });
          });
        });

        if (exerciseDetailsPayloads.length > 0) {
          const exerciseDetailsResult = await createOrReuseExerciseDetailsBatch(
            exerciseDetailsPayloads,
          );
          if (!exerciseDetailsResult.success || !exerciseDetailsResult.data) {
            return;
          }

          const exerciseById = new Map(
            exerciseDetailsResult.data.map((exercise) => [
              exercise.id,
              exercise,
            ]),
          );
          const exerciseIdMap = new Map<string, string>();
          exerciseDetailsResult.data.forEach((exercise) => {
            exerciseIdMap.set(
              createExerciseKey(exercise.name, exercise.equipment),
              exercise.id,
            );
          });

          await supabase
            .from("user_workout_plan_exercises")
            .delete()
            .eq("weekly_plan_id", dayPlanId);

          const planExercisePayloads: CreateUserWorkoutPlanExercisePayload[] =
            [];
          const positionCounters = { warmup: 0, main: 0, cooldown: 0 };
          sections.forEach(({ key, exercises }) => {
            const section = mapSectionNameForPlan(key);
            if (!section) return;

            exercises.forEach((exercise) => {
              if (!exercise.name) return;

              const exerciseKey = createExerciseKey(
                exercise.name,
                exercise.equipment,
              );
              const exerciseId = exerciseIdMap.get(exerciseKey);
              if (!exerciseId) return;

              const metrics = parsePlanExerciseMetricsForSave(
                getExerciseMetricsText(exercise),
              );
              const position = getExercisePosition(
                section,
                positionCounters[section],
              );
              positionCounters[section]++;

              const savedExercise = exerciseById.get(exerciseId);
              const imageSlug =
                savedExercise?.image_slug ||
                generateImageSlug(section, exercise.name);
              const imagePath = getExerciseImagePath(
                normalizedGender,
                imageSlug,
              );

              planExercisePayloads.push({
                weekly_plan_id: dayPlanId,
                exercise_id: exerciseId,
                position,
                section,
                sets: metrics.sets,
                reps: metrics.reps,
                duration_seconds: metrics.duration_seconds,
                rest_seconds: metrics.rest_seconds,
                per_side: exercise.per_side?.toLowerCase() === "yes",
                image_path: imagePath,
                image_alt: `${exercise.name} exercise demonstration`,
                description: exercise.description || null,
                is_image_generated: null,
              });
            });
          });

          if (planExercisePayloads.length > 0) {
            await createUserWorkoutPlanExercisesBatch(planExercisePayloads);
          }
        }

        setPendingDayRegenerations((prev) => {
          const next = { ...prev };
          delete next[dayPlanId];
          return next;
        });
        await loadWorkoutPlanDetails(planId);
      } catch (error) {
        console.error("Save regenerated day failed:", error);
      } finally {
        setSavingRegeneratedDayPlanIds((prev) =>
          prev.filter((id) => id !== dayPlanId),
        );
      }
    },
    [
      planId,
      savingRegeneratedDayPlanIds,
      pendingDayRegenerations,
      createOrReuseExerciseDetailsBatch,
      createUserWorkoutPlanExercisesBatch,
      getExercisePosition,
      generateImageSlug,
      getExerciseImagePath,
      normalizedGender,
      loadWorkoutPlanDetails,
    ],
  );

  // Group exercises by section
  const warmupExercises = useMemo(
    () => selectedDayExercises.filter((ex) => ex.section === "warmup"),
    [selectedDayExercises],
  );
  const mainExercises = useMemo(
    () => selectedDayExercises.filter((ex) => ex.section === "main"),
    [selectedDayExercises],
  );
  const cooldownExercises = useMemo(
    () => selectedDayExercises.filter((ex) => ex.section === "cooldown"),
    [selectedDayExercises],
  );

  const selectedPreviewDay = useMemo<NextWeekPreviewDay | null>(() => {
    if (!nextWeekPreview || nextWeekPreview.days.length === 0) {
      return null;
    }

    if (!selectedPreviewDayKey) {
      return nextWeekPreview.days[0];
    }

    return (
      nextWeekPreview.days.find(
        (day) => day.day.toLowerCase() === selectedPreviewDayKey,
      ) || nextWeekPreview.days[0]
    );
  }, [nextWeekPreview, selectedPreviewDayKey]);

  const selectedPreviewWarmupExercises = useMemo(
    () => selectedPreviewDay?.exercises?.warm_up || [],
    [selectedPreviewDay],
  );
  const selectedPreviewMainExercises = useMemo(
    () => selectedPreviewDay?.exercises?.main_workout || [],
    [selectedPreviewDay],
  );
  const selectedPreviewCooldownExercises = useMemo(
    () => selectedPreviewDay?.exercises?.cooldown || [],
    [selectedPreviewDay],
  );
  const selectedPreviewCalories = useMemo(
    () => parseCalories(selectedPreviewDay?.totalCalories ?? null),
    [selectedPreviewDay],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600" />
          <p className="text-sm font-bold text-teal-700 dark:text-teal-300">
            Loading workout details...
          </p>
        </div>
      </div>
    );
  }

  if (!workoutPlan) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827] flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-semibold text-red-600 dark:text-red-300 mb-4">
            Workout plan not found
          </p>
          <button
            onClick={() => router.push("/personal")}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition-colors"
          >
            Back to Personal
          </button>
        </div>
      </div>
    );
  }

  // Format tag as Title Case
  const formatTagTitleCase = (tag: string) => {
    return tag
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const nextWeekPreviewContent = nextWeekPreview ? (
    <div className="mt-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <div className="flex items-start justify-between gap-3 mb-4 mt-1 pb-3 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
            Week {nextWeekPreview.weekNumber} Preview
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {nextWeekPreview.planName}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Rest days:{" "}
            {nextWeekPreview.restDays.length > 0
              ? nextWeekPreview.restDays.join(", ")
              : "None"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setNextWeekPreview(null);
              setPendingNextWeekGeneration(null);
              setSelectedPreviewDayKey(null);
            }}
            disabled={isSavingGeneratedPlan}
            className={`rounded-lg px-3 py-2 text-xs font-bold border transition-colors ${
              isSavingGeneratedPlan
                ? "border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSaveGeneratedPlan();
            }}
            disabled={isSavingGeneratedPlan || !pendingNextWeekGeneration}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
              isSavingGeneratedPlan || !pendingNextWeekGeneration
                ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                : "bg-teal-600 dark:bg-teal-500 text-white hover:bg-teal-700 dark:hover:bg-teal-400"
            }`}
          >
            {isSavingGeneratedPlan ? "Saving..." : "Save Plan"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {nextWeekPreview.days.map((day, index) => {
          const isSelectedPreviewDay =
            selectedPreviewDay?.day.toLowerCase() === day.day.toLowerCase();
          const calories = parseCalories(day.totalCalories);
          const minutes = day.totalMinutes ?? 0;
          const previewDayNumber =
            (nextWeekPreview.weekNumber - 1) * 7 + index + 1;

          return (
            <button
              key={`${day.day}-${index}`}
              type="button"
              onClick={() => setSelectedPreviewDayKey(day.day.toLowerCase())}
              className={`rounded-xl overflow-hidden transition-all flex flex-col outline-none focus:outline-none active:outline-none w-full h-full ${
                isSelectedPreviewDay
                  ? "ring-2 ring-teal-400 ring-offset-2 dark:ring-offset-slate-900 shadow-lg scale-[1.02]"
                  : "hover:shadow-md hover:scale-[1.01] border border-slate-200 dark:border-slate-700"
              }`}
            >
              {day.isRestDay ? (
                <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-800">
                  <div className="bg-slate-200/70 dark:bg-slate-700 py-2 px-3">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300 text-center block">
                      {day.day}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center py-4 relative">
                    <div className="absolute inset-0 flex items-center justify-center opacity-5">
                      <HiMoon className="w-16 h-16 text-slate-500 dark:text-slate-300" />
                    </div>
                    <span className="text-2xl font-black text-slate-400 dark:text-slate-500 relative z-10">
                      {previewDayNumber}
                    </span>
                  </div>

                  <div className="bg-slate-200/50 dark:bg-slate-700 py-2.5 px-2">
                    <div className="flex items-center justify-center gap-1.5">
                      <HiMoon className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                        Rest
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full bg-white dark:bg-slate-800">
                  <div className="py-2 px-3 bg-amber-50 dark:bg-amber-900/30">
                    <span className="text-[11px] font-bold text-center block text-amber-600 dark:text-amber-300">
                      {day.day}
                    </span>
                  </div>

                  <div className="flex-1 flex items-center justify-center py-4">
                    <span className="text-3xl font-black text-slate-800 dark:text-slate-100">
                      {previewDayNumber}
                    </span>
                  </div>

                  <div className="py-2 px-1.5 bg-slate-50 dark:bg-slate-700">
                    <div className="flex items-center justify-center gap-1.5">
                      <HiFire className="w-3.5 h-3.5 shrink-0 text-orange-500" />
                      <span className="text-[11px] font-bold tabular-nums text-orange-600">
                        {calories || 0}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">|</span>
                      <span className="text-[11px] font-bold tabular-nums text-teal-600 dark:text-teal-300">
                        {minutes || 0}m
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedPreviewDay && (
        <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-700">
          <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/30 dark:to-emerald-900/30 rounded-xl p-4 mb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center">
                  <span className="text-base font-extrabold text-teal-600 dark:text-teal-300">
                    {selectedPreviewDay.day.slice(0, 3)}
                  </span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    {selectedPreviewDay.day}
                  </h4>
                  {selectedPreviewDay.title && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {selectedPreviewDay.title}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {typeof selectedPreviewDay.totalMinutes === "number" &&
                  selectedPreviewDay.totalMinutes > 0 && (
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg shadow-sm">
                      <HiClock className="w-4 h-4 text-teal-600" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {selectedPreviewDay.totalMinutes}m
                      </span>
                    </div>
                  )}
                {typeof selectedPreviewCalories === "number" &&
                  selectedPreviewCalories > 0 && (
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg shadow-sm">
                      <HiFire className="w-4 h-4 text-orange-500" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {selectedPreviewCalories} cal
                      </span>
                    </div>
                  )}
              </div>
            </div>

            {selectedPreviewDay.focus &&
              selectedPreviewDay.focus.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {selectedPreviewDay.focus.slice(0, 4).map((focus, index) => (
                    <span
                      key={`${selectedPreviewDay.day}-focus-${index}`}
                      className="text-[11px] bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 px-2.5 py-1 rounded-full font-semibold shadow-sm"
                    >
                      {formatTagTitleCase(focus)}
                    </span>
                  ))}
                </div>
              )}

            {selectedPreviewDay.motivation && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-3 pt-3 border-t border-teal-100 dark:border-teal-800">
                &ldquo;{selectedPreviewDay.motivation}&rdquo;
              </p>
            )}
          </div>

          {selectedPreviewDay.isRestDay ? (
            <div className="text-center py-8 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <HiMoon className="w-7 h-7 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Rest Day</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                No exercises scheduled for this day.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedPreviewWarmupExercises.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <HiFire className="w-4 h-4 text-orange-500" />
                    <h5 className="text-xs font-bold text-orange-600">
                      {getSectionTitle(
                        "warmup",
                        selectedPreviewWarmupExercises.length,
                      )}
                    </h5>
                  </div>
                  <div className="space-y-2">
                    {selectedPreviewWarmupExercises.map((exercise, index) => (
                      <PreviewExerciseRow
                        key={`preview-warmup-${selectedPreviewDay.day}-${index}`}
                        exercise={exercise}
                        formatDuration={formatDuration}
                      />
                    ))}
                  </div>
                </div>
              )}

              {selectedPreviewMainExercises.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <HiBolt className="w-4 h-4 text-teal-600" />
                    <h5 className="text-xs font-bold text-teal-600">
                      {getSectionTitle(
                        "main",
                        selectedPreviewMainExercises.length,
                      )}
                    </h5>
                  </div>
                  <div className="space-y-2">
                    {selectedPreviewMainExercises.map((exercise, index) => (
                      <PreviewExerciseRow
                        key={`preview-main-${selectedPreviewDay.day}-${index}`}
                        exercise={exercise}
                        formatDuration={formatDuration}
                      />
                    ))}
                  </div>
                </div>
              )}

              {selectedPreviewCooldownExercises.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <HiMoon className="w-4 h-4 text-blue-500" />
                    <h5 className="text-xs font-bold text-blue-600">
                      {getSectionTitle(
                        "cooldown",
                        selectedPreviewCooldownExercises.length,
                      )}
                    </h5>
                  </div>
                  <div className="space-y-2">
                    {selectedPreviewCooldownExercises.map((exercise, index) => (
                      <PreviewExerciseRow
                        key={`preview-cooldown-${selectedPreviewDay.day}-${index}`}
                        exercise={exercise}
                        formatDuration={formatDuration}
                      />
                    ))}
                  </div>
                </div>
              )}

              {selectedPreviewWarmupExercises.length === 0 &&
                selectedPreviewMainExercises.length === 0 &&
                selectedPreviewCooldownExercises.length === 0 && (
                  <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500">
                    No exercises generated for this day.
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827] pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Hero Image */}
        <div className="relative h-52 md:h-64 rounded-3xl overflow-hidden mb-6 shadow-lg">
          {workoutPlan.image_path ? (
            <Image
              src={workoutPlan.image_path}
              alt={workoutPlan.image_alt || cleanPlanName}
              fill
              className="object-cover"
              priority
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
              <span className="text-8xl opacity-80">ðŸ’ª</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

          {/* Top Left Actions */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <button
              onClick={() => router.push("/personal")}
              className="bg-white/20 backdrop-blur-sm hover:bg-white/30 p-2 rounded-full transition-all"
              aria-label="Back to personal"
            >
              <HiArrowLeft className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={handleRefreshPage}
              disabled={isRefreshingPage}
              className="bg-white/20 backdrop-blur-sm hover:bg-white/30 p-2 rounded-full transition-all disabled:opacity-60"
              aria-label="Refresh page"
            >
              <HiArrowPath
                className={`w-4 h-4 text-white ${isRefreshingPage ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {/* Category Badge */}
          {workoutPlan.category && (
            <div className="absolute top-4 right-4 z-10">
              <span className="bg-teal-500/90 backdrop-blur-sm text-white px-2.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide">
                {workoutPlan.category}
              </span>
            </div>
          )}

          {/* Plan Name & Tags Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <h1 className="text-lg md:text-xl font-extrabold text-white drop-shadow-lg mb-2">
              {cleanPlanName}
            </h1>
            {/* Tags on Hero */}
            {workoutPlan.tags && workoutPlan.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {workoutPlan.tags
                  .slice(0, 3)
                  .map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="bg-white/20 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    >
                      {formatTagTitleCase(tag)}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards - 2 Column */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Weeks */}
          <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-3.5 shadow-sm dark:shadow-black/30 border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/40 flex items-center justify-center">
                <HiCalendar className="w-4 h-4 text-teal-600 dark:text-teal-300" />
              </div>
              <div>
                <p className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                  {totalWeeks} Week{totalWeeks !== 1 ? "s" : ""}
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {workoutPlan.duration_days || 28} Days Program
                </p>
              </div>
            </div>
          </div>

          {/* Created */}
          <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-3.5 shadow-sm dark:shadow-black/30 border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/40 flex items-center justify-center">
                <HiSparkles className="w-4 h-4 text-purple-500 dark:text-purple-300" />
              </div>
              <div>
                <p className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                  {new Date(workoutPlan.created_at).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                    },
                  )}
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Created
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Description (if available) */}
        {workoutPlan.description && (
          <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-sm dark:shadow-black/30 border border-slate-100 dark:border-slate-700 mb-6">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
              About This Plan
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {workoutPlan.description}
            </p>
          </div>
        )}

        {/* Attach a meal plan */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-sm dark:shadow-black/30 border border-slate-100 dark:border-slate-700 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-900/35 flex items-center justify-center">
              <MdRestaurant className="w-5 h-5 text-amber-600 dark:text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Attach a meal plan
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                View or link a meal plan for this workout
              </p>
            </div>
            <button
              type="button"
              disabled={checkingMealLink}
              onClick={async () => {
                if (!planId) return;
                setCheckingMealLink(true);
                const linked = await getLinkedMealPlanForWorkout(planId);
                setCheckingMealLink(false);
                if (linked) {
                  router.push(`/meals/workout/plan/${planId}`);
                } else {
                  setMealPlanDialogOpen(true);
                }
              }}
              className="shrink-0 px-4 py-2.5 bg-teal-600 dark:bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 dark:hover:bg-teal-400 disabled:opacity-60 transition-colors"
            >
              {checkingMealLink ? "Checking..." : "View meal plan"}
            </button>
          </div>
        </div>

        {/* No linked meal plan dialog */}
        {mealPlanDialogOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-sm w-full p-6 text-center border border-transparent dark:border-slate-700">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/35 flex items-center justify-center mx-auto mb-4">
                <MdRestaurant className="w-6 h-6 text-amber-600 dark:text-amber-300" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">
                No linked meal plan
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-6">
                No linked meal plan for this workout yet.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMealPlanDialogOpen(false);
                    router.push(
                      planId ? `/meals/workout/plan/${planId}` : "/meals",
                    );
                  }}
                  className="w-full py-3 rounded-xl bg-teal-600 dark:bg-teal-500 text-white text-sm font-semibold hover:bg-teal-700 dark:hover:bg-teal-400 transition-colors"
                >
                  Generate
                </button>
                <button
                  type="button"
                  onClick={() => setMealPlanDialogOpen(false)}
                  className="w-full py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Okay
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Weekly Calendar Section Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
            <HiCalendar className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
            Weekly Schedule
          </h2>
        </div>

        {/* Weekly Calendar */}
        <div className="space-y-5">
          {Array.from({ length: totalWeeks }, (_, weekIndex) => {
            const weekNumber = weekIndex + 1;
            const hasData = weekHasData(weekNumber);
            const weekDays = hasData ? getWeekCalendarData(weekNumber) : [];
            const hasInlinePreview =
              !hasData && nextWeekPreview?.weekNumber === weekNumber;

            return (
              <div
                key={weekNumber}
                className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-sm dark:shadow-black/30 border border-slate-100 dark:border-slate-700"
              >
                {/* Week Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-sm">
                      <span className="text-base font-bold text-white">
                        {weekNumber}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        Week {weekNumber}
                      </h3>
                    </div>
                  </div>
                  {hasData && (
                    <div className="flex items-center gap-1.5 bg-teal-50 dark:bg-teal-900/40 px-2.5 py-1 rounded-full">
                      <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                      <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                        Active
                      </span>
                    </div>
                  )}
                </div>

                {/* Week has data - show day cards */}
                {hasData ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                      {weekDays.map((day) => {
                        const isSelected =
                          selectedDay?.week === weekNumber &&
                          selectedDay?.day === day.dayName;
                        const isCompletedDay = Boolean(
                          day.data?.isCompleted ?? day.data?.is_completed,
                        );
                        const dayProgressIndex = workoutDayOrderByKey.get(
                          `${weekNumber}|${day.dayName.toLowerCase()}`,
                        );
                        const isLockedByProgress =
                          !day.isRestDay &&
                          typeof dayProgressIndex === "number" &&
                          dayProgressIndex > completedSessionsCount;
                        const calories = day.data
                          ? parseCalories(day.data.total_calories)
                          : 0;
                        const minutes = day.data?.total_minutes ?? 0;
                        const dayPlanId = day.data?.id || null;
                        const pendingRegeneratedDay = dayPlanId
                          ? pendingDayRegenerations[dayPlanId]
                          : null;
                        const isPendingRegeneratedDay = !!pendingRegeneratedDay;
                        const displayedCalories = isPendingRegeneratedDay
                          ? parseCalories(pendingRegeneratedDay.totalCalories)
                          : calories;
                        const displayedMinutes = isPendingRegeneratedDay
                          ? (pendingRegeneratedDay.totalMinutes ?? 0)
                          : minutes;
                        const canRegenerateDay =
                          !day.isRestDay && !!day.data?.id && !isCompletedDay;
                        const isRegeneratingDay =
                          !!day.data?.id &&
                          regeneratingDayPlanIds.includes(day.data.id);
                        const isSavingRegeneratedDay =
                          !!day.data?.id &&
                          savingRegeneratedDayPlanIds.includes(day.data.id);

                        return (
                          <div key={day.dayNumber} className="relative group">
                            <button
                              onClick={() =>
                                !day.isRestDay &&
                                setSelectedDay({
                                  week: weekNumber,
                                  day: day.dayName,
                                })
                              }
                              disabled={day.isRestDay}
                              className={`
                              relative rounded-xl overflow-hidden transition-all flex flex-col outline-none focus:outline-none active:outline-none
                              w-full h-full
                              ${
                                day.isRestDay
                                  ? "cursor-default"
                                  : isSelected
                                    ? "ring-2 ring-teal-400 ring-offset-2 dark:ring-offset-slate-900 shadow-lg scale-[1.02]"
                                    : isCompletedDay
                                      ? "hover:shadow-md hover:scale-[1.01] border border-emerald-300 dark:border-emerald-700"
                                      : isLockedByProgress
                                        ? "hover:shadow-md hover:scale-[1.01] border border-slate-200 dark:border-slate-700"
                                        : "hover:shadow-md hover:scale-[1.01] border border-slate-200 dark:border-slate-700"
                              }
                            `}
                            >
                              {/* REST DAY - Subtle Design */}
                              {day.isRestDay ? (
                                <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-800">
                                  {/* Top - Day Name */}
                                  <div className="bg-slate-200/70 dark:bg-slate-700 py-2 px-3">
                                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-300 text-center block">
                                      {day.dayName}
                                    </span>
                                  </div>

                                  {/* Middle - Day Number with Rest Icon */}
                                  <div className="flex-1 flex flex-col items-center justify-center py-4 relative">
                                    <div className="absolute inset-0 flex items-center justify-center opacity-5">
                                      <HiMoon className="w-16 h-16 text-slate-500 dark:text-slate-300" />
                                    </div>
                                    <span className="text-2xl font-black text-slate-300 dark:text-slate-500 relative z-10">
                                      {day.dayNumber}
                                    </span>
                                  </div>

                                  {/* Bottom - Rest Day Label */}
                                  <div className="bg-slate-200/50 dark:bg-slate-700 py-2.5 px-2">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <HiMoon className="w-4 h-4 text-slate-400 dark:text-slate-300" />
                                      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-300">
                                        Rest
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                /* WORKOUT DAY - 3 Horizontal Divisions */
                                <div
                                  className={`flex flex-col h-full ${isCompletedDay ? "bg-emerald-50/40 dark:bg-emerald-900/20" : "bg-white dark:bg-slate-800"}`}
                                >
                                  {/* TOP - Day Name with Amber Background */}
                                  <div
                                    className={`py-2 px-3 ${isCompletedDay ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-amber-50 dark:bg-amber-900/30"}`}
                                  >
                                    <span
                                      className={`text-[11px] font-bold text-center block ${isCompletedDay ? "text-emerald-700 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}
                                    >
                                      {day.dayName}
                                    </span>
                                  </div>

                                  {/* MIDDLE - Day Number Centered */}
                                  <div className="flex-1 flex items-center justify-center py-4">
                                    <span
                                      className={`text-3xl font-black ${isCompletedDay ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-slate-100"}`}
                                    >
                                      {day.dayNumber}
                                    </span>
                                  </div>

                                  {/* BOTTOM - Calories & Minutes (### | ##m format) */}
                                  <div
                                    className={`py-2 px-1.5 ${isCompletedDay ? "bg-emerald-100/80 dark:bg-emerald-900/35" : "bg-slate-50 dark:bg-slate-700"}`}
                                  >
                                    <div className="flex items-center justify-center gap-1.5">
                                      <HiFire
                                        className={`w-3.5 h-3.5 shrink-0 ${isCompletedDay ? "text-emerald-600 dark:text-emerald-300" : "text-orange-500"}`}
                                      />
                                      <span
                                        className={`text-[11px] font-bold tabular-nums ${isCompletedDay ? "text-emerald-700 dark:text-emerald-300" : "text-orange-600 dark:text-orange-300"}`}
                                      >
                                        {displayedCalories || 0}
                                      </span>
                                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                        |
                                      </span>
                                      <span
                                        className={`text-[11px] font-bold tabular-nums ${isCompletedDay ? "text-emerald-700 dark:text-emerald-300" : "text-teal-600 dark:text-teal-300"}`}
                                      >
                                        {displayedMinutes || 0}m
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </button>

                            {canRegenerateDay && (
                              <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDay({
                                      week: weekNumber,
                                      day: day.dayName,
                                    });
                                    void handleRegenerateDay(
                                      weekNumber,
                                      day.dayName,
                                    );
                                  }}
                                  disabled={isRegeneratingDay}
                                  aria-label="Regenerate day"
                                  className={`rounded-full p-1.5 shadow-sm transition-all opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto ${
                                    isRegeneratingDay
                                      ? "bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-not-allowed"
                                      : "bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/30"
                                  }`}
                                >
                                  <HiArrowPath
                                    className={`w-4 h-4 ${
                                      isRegeneratingDay ? "animate-spin" : ""
                                    }`}
                                  />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Exercises for selected day in this week */}
                    {selectedDay?.week === weekNumber &&
                      (() => {
                        const dayDataMap = getDayDataMapForWeek(weekNumber);
                        const dayData = dayDataMap.get(
                          selectedDay.day.toLowerCase(),
                        );
                        const totalCalories = dayData
                          ? parseCalories(dayData.total_calories)
                          : 0;
                        const totalMinutes = dayData?.total_minutes ?? 0;
                        const dayPlanId = dayData?.id || null;
                        const isSelectedDayCompleted = Boolean(
                          dayData?.isCompleted ?? dayData?.is_completed,
                        );
                        const pendingSelectedRegeneration = dayPlanId
                          ? pendingDayRegenerations[dayPlanId]
                          : null;
                        const isSelectedDayRegenerating = dayPlanId
                          ? regeneratingDayPlanIds.includes(dayPlanId)
                          : false;
                        const isSelectedDaySaving = dayPlanId
                          ? savingRegeneratedDayPlanIds.includes(dayPlanId)
                          : false;
                        const displayedTotalCalories =
                          pendingSelectedRegeneration
                            ? parseCalories(
                                pendingSelectedRegeneration.totalCalories,
                              )
                            : totalCalories;
                        const displayedTotalMinutes =
                          pendingSelectedRegeneration
                            ? (pendingSelectedRegeneration.totalMinutes ?? 0)
                            : totalMinutes;
                        const selectedPendingWarmupExercises =
                          pendingSelectedRegeneration?.dayResult.warm_up || [];
                        const selectedPendingMainExercises =
                          pendingSelectedRegeneration?.dayResult.main_workout ||
                          [];
                        const selectedPendingCooldownExercises =
                          pendingSelectedRegeneration?.dayResult.cooldown || [];

                        return (
                          <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-700">
                            {/* Day Header - Enhanced */}
                            <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/30 dark:to-emerald-900/30 rounded-xl p-4 mb-4">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center">
                                    <span className="text-base font-extrabold text-teal-600 dark:text-teal-300">
                                      {selectedDay.day.slice(0, 3)}
                                    </span>
                                  </div>
                                  <div>
                                    <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                                      {selectedDay.day}
                                    </h4>
                                    {dayData?.title && (
                                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                                        {dayData.title}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Stats + Actions */}
                                <div className="flex items-start gap-2">
                                  <div className="flex items-center gap-3">
                                    {displayedTotalMinutes > 0 && (
                                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg shadow-sm">
                                        <HiClock className="w-4 h-4 text-teal-600" />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                          {displayedTotalMinutes}m
                                        </span>
                                      </div>
                                    )}
                                    {displayedTotalCalories &&
                                      displayedTotalCalories > 0 && (
                                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg shadow-sm">
                                          <HiFire className="w-4 h-4 text-orange-500" />
                                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                            {displayedTotalCalories} cal
                                          </span>
                                        </div>
                                      )}
                                  </div>
                                  {!!dayPlanId && !isSelectedDayCompleted && (
                                    <div className="flex flex-col gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void handleRegenerateDay(
                                            weekNumber,
                                            selectedDay.day,
                                          );
                                        }}
                                        disabled={isSelectedDayRegenerating}
                                        className={`rounded-md px-2 py-1 text-[12px] font-bold shadow-sm transition-colors ${
                                          isSelectedDayRegenerating
                                            ? "bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-not-allowed"
                                            : "bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-teal-200 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/30"
                                        }`}
                                      >
                                        {isSelectedDayRegenerating
                                          ? "Regenerating..."
                                          : "Regenerate"}
                                      </button>
                                      {pendingSelectedRegeneration && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!dayPlanId) return;
                                            void handleSaveRegeneratedDay(
                                              dayPlanId,
                                            );
                                          }}
                                          disabled={isSelectedDaySaving}
                                          className={`rounded-md px-2 py-1 text-[10px] font-bold shadow-sm transition-colors ${
                                            isSelectedDaySaving
                                              ? "bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-not-allowed"
                                              : "bg-teal-600 dark:bg-teal-500 text-white hover:bg-teal-700 dark:hover:bg-teal-400"
                                          }`}
                                        >
                                          {isSelectedDaySaving
                                            ? "Saving..."
                                            : "Save"}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Focus Areas */}
                              {dayData?.focus && dayData.focus.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {dayData.focus.slice(0, 4).map((f, i) => (
                                    <span
                                      key={i}
                                      className="text-[11px] bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 px-2.5 py-1 rounded-full font-semibold shadow-sm"
                                    >
                                      {formatTagTitleCase(f)}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Motivation Quote */}
                              {dayData?.motivation && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-3 pt-3 border-t border-teal-100 dark:border-teal-800">
                                  &ldquo;{dayData.motivation}&rdquo;
                                </p>
                              )}
                              {pendingSelectedRegeneration && (
                                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-3 pt-3 border-t border-amber-100 dark:border-amber-800 font-semibold">
                                  Unsaved regenerated exercises. Click Save to
                                  apply changes.
                                </p>
                              )}
                            </div>

                            {/* Exercises */}
                            {pendingSelectedRegeneration ? (
                              <div className="space-y-4">
                                {selectedPendingWarmupExercises.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-3">
                                      <HiFire className="w-4 h-4 text-orange-500" />
                                      <h5 className="text-xs font-bold text-orange-600">
                                        {getSectionTitle(
                                          "warmup",
                                          selectedPendingWarmupExercises.length,
                                        )}
                                      </h5>
                                    </div>
                                    <div className="space-y-2">
                                      {selectedPendingWarmupExercises.map(
                                        (exercise, index) => (
                                          <PreviewExerciseRow
                                            key={`selected-pending-warmup-${selectedDay.day}-${index}`}
                                            exercise={exercise}
                                            formatDuration={formatDuration}
                                          />
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}

                                {selectedPendingMainExercises.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-3">
                                      <HiBolt className="w-4 h-4 text-teal-600" />
                                      <h5 className="text-xs font-bold text-teal-600">
                                        {getSectionTitle(
                                          "main",
                                          selectedPendingMainExercises.length,
                                        )}
                                      </h5>
                                    </div>
                                    <div className="space-y-2">
                                      {selectedPendingMainExercises.map(
                                        (exercise, index) => (
                                          <PreviewExerciseRow
                                            key={`selected-pending-main-${selectedDay.day}-${index}`}
                                            exercise={exercise}
                                            formatDuration={formatDuration}
                                          />
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}

                                {selectedPendingCooldownExercises.length >
                                  0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-3">
                                      <HiMoon className="w-4 h-4 text-blue-500" />
                                      <h5 className="text-xs font-bold text-blue-600">
                                        {getSectionTitle(
                                          "cooldown",
                                          selectedPendingCooldownExercises.length,
                                        )}
                                      </h5>
                                    </div>
                                    <div className="space-y-2">
                                      {selectedPendingCooldownExercises.map(
                                        (exercise, index) => (
                                          <PreviewExerciseRow
                                            key={`selected-pending-cooldown-${selectedDay.day}-${index}`}
                                            exercise={exercise}
                                            formatDuration={formatDuration}
                                          />
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : isLoadingExercises ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
                              </div>
                            ) : selectedDayExercises.length > 0 ? (
                              <div className="space-y-4">
                                {/* Warm Up */}
                                {warmupExercises.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-3">
                                      <HiFire className="w-4 h-4 text-orange-500" />
                                      <h5 className="text-xs font-bold text-orange-600">
                                        {getSectionTitle(
                                          "warmup",
                                          warmupExercises.length,
                                        )}
                                      </h5>
                                    </div>
                                    <div className="space-y-2">
                                      {warmupExercises.map(
                                        (exercise, index) => (
                                          <ExerciseRow
                                            key={`warmup-${exercise.id}-${index}`}
                                            exercise={exercise}
                                            eager={index < 3}
                                            formatDuration={formatDuration}
                                          />
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Main Exercises */}
                                {mainExercises.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-3">
                                      <HiBolt className="w-4 h-4 text-teal-600" />
                                      <h5 className="text-xs font-bold text-teal-600">
                                        {getSectionTitle(
                                          "main",
                                          mainExercises.length,
                                        )}
                                      </h5>
                                    </div>
                                    <div className="space-y-2">
                                      {mainExercises.map((exercise, index) => (
                                        <ExerciseRow
                                          key={`main-${exercise.id}-${index}`}
                                          exercise={exercise}
                                          eager={index < 3}
                                          formatDuration={formatDuration}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Cool Down */}
                                {cooldownExercises.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-3">
                                      <HiMoon className="w-4 h-4 text-blue-500" />
                                      <h5 className="text-xs font-bold text-blue-600">
                                        {getSectionTitle(
                                          "cooldown",
                                          cooldownExercises.length,
                                        )}
                                      </h5>
                                    </div>
                                    <div className="space-y-2">
                                      {cooldownExercises.map(
                                        (exercise, index) => (
                                          <ExerciseRow
                                            key={`cooldown-${exercise.id}-${index}`}
                                            exercise={exercise}
                                            eager={index < 3}
                                            formatDuration={formatDuration}
                                          />
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500">
                                No exercises found for this day.
                              </div>
                            )}
                          </div>
                        );
                      })()}
                  </>
                ) : hasInlinePreview ? (
                  nextWeekPreviewContent
                ) : (
                  /* Week has no data - show placeholder message */
                  <div className="flex flex-col items-center justify-center py-8 px-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <HiSparkles className="w-10 h-10 text-slate-300 dark:text-slate-500 mb-3" />
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 text-center">
                      Week {weekNumber} is not generated yet.
                    </p>
                    {weekNumber === nextWeekToGenerate &&
                    latestGeneratedWeekNumber > 0 ? (
                      isGeneratingNextWeek ? (
                        <div className="mt-3 w-full max-w-xl">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div>
                              <h4 className="text-sm font-extrabold text-teal-800 dark:text-teal-300">
                                Generating Your Workout
                              </h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                This might take a while, please wait.
                              </p>
                            </div>
                            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                              {generationProgressPercent}%
                            </div>
                          </div>

                          <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-amber-400 transition-all duration-700"
                              style={{ width: `${generationProgressPercent}%` }}
                            />
                          </div>
                          <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 text-right">
                            ~{GENERATION_DURATION_SECONDS}s
                          </div>

                          <div className="mt-3 space-y-2">
                            {GENERATION_STEPS.map((step, index) => {
                              const isComplete = index < currentGenerationStep;
                              const isActive = index === currentGenerationStep;

                              return (
                                <div
                                  key={step.title}
                                    className={`flex items-start gap-2 rounded-xl border px-3 py-2 transition-all ${
                                      isActive
                                        ? "border-teal-200 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/30"
                                        : isComplete
                                          ? "border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30"
                                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                    }`}
                                  >
                                  <div
                                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                                      isComplete
                                        ? "bg-amber-500 text-white"
                                        : isActive
                                          ? "bg-teal-600 text-white"
                                          : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
                                    }`}
                                  >
                                    {isComplete ? "\u2713" : index + 1}
                                  </div>
                                  <div className="flex-1">
                                    <p
                                      className={`text-[11px] font-bold ${
                                        isActive
                                          ? "text-teal-800 dark:text-teal-300"
                                          : isComplete
                                            ? "text-amber-700 dark:text-amber-300"
                                            : "text-slate-700 dark:text-slate-200"
                                      }`}
                                    >
                                      {step.title}
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                      {step.detail}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setShowIntensityDialog(true);
                            }}
                            disabled={isGeneratingNextWeek}
                            className={`mt-3 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                              isGeneratingNextWeek
                                ? "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                                : "bg-teal-600 dark:bg-teal-500 text-white hover:bg-teal-700 dark:hover:bg-teal-400"
                            }`}
                          >
                            {isGeneratingNextWeek
                              ? "Generating..."
                              : "Generate Now"}
                          </button>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 text-center">
                            Preview will appear here after generation.
                          </p>
                        </>
                      )
                    ) : (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        Keep going!
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        visible={showIntensityDialog}
        onDismiss={() => {
          if (!isGeneratingNextWeek) {
            setShowIntensityDialog(false);
          }
        }}
        maxWidth="900px"
        height="350px"
      >
        <div className="pb-6 pt-6 text-slate-900 dark:text-slate-100">
          <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 text-center">
            What intensity do you want for this week&apos;s workout?
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center mt-2 mb-12">
            Choose one to generate next week.
          </p>

          <div className="grid grid-cols-5 gap-0 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            {INTENSITY_OPTIONS.map((option, index) => (
              <button
                key={option.label}
                type="button"
                onClick={() => {
                  setShowIntensityDialog(false);
                  void handleGenerateNow(option.rpe);
                }}
                disabled={isGeneratingNextWeek}
                className={`h-24 flex flex-col items-center justify-center transition-colors ${
                  index < INTENSITY_OPTIONS.length - 1
                    ? "border-r border-slate-200 dark:border-slate-700"
                    : ""
                } ${
                  isGeneratingNextWeek
                    ? "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-900/30"
                }`}
              >
                <span className="text-lg">{option.emoji}</span>
                <span className="text-[10px] font-bold mt-1 text-center px-1">
                  {option.label}
                </span>
                <span className="hidden text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  RPE {option.rpe}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Dialog>

      {/* Sticky Start Workout Button */}
      <div className="fixed bottom-[70px] left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-black/40 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <button
            onClick={() => {
              void handleStartWorkout();
            }}
            disabled={finalStartButtonDisabled}
            className={`w-full rounded-xl py-3.5 px-6 font-bold text-base shadow-md transition-all flex items-center justify-center gap-3 ${
              isTodayRestDay
                ? "bg-amber-100 dark:bg-amber-900/35 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 cursor-not-allowed"
                : finalStartButtonDisabled
                  ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-teal-600 to-teal-500 dark:from-teal-500 dark:to-teal-400 hover:from-teal-700 hover:to-teal-600 dark:hover:from-teal-400 dark:hover:to-teal-300 text-white hover:shadow-lg"
            }`}
          >
            <HiCalendar className="w-5 h-5" />
            <span>{startWorkoutLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Exercise Row Component
function ExerciseRow({
  exercise,
  eager = false,
  formatDuration,
}: {
  exercise: UserWorkoutPlanExerciseWithDetails;
  eager?: boolean;
  formatDuration: (seconds: number) => string;
}) {
  const imageUrl = exercise.image_path?.trim() || "";
  const hasImage = imageUrl && imageUrl.trim() !== "";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md dark:hover:shadow-black/30 transition-all overflow-hidden">
      <div className="flex items-stretch">
        {/* Exercise Image - Square 1:1 */}
        <div className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 rounded-l-2xl overflow-hidden">
          {hasImage ? (
            <Image
              src={imageUrl}
              alt={exercise.exercise_details?.name || "Exercise"}
              fill
              className="object-cover"
              loading={eager ? "eager" : "lazy"}
              fetchPriority={eager ? "high" : "auto"}
              sizes="(max-width: 640px) 80px, 96px"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                <HiBolt className="w-6 h-6 text-slate-400 dark:text-slate-300" />
              </div>
            </div>
          )}
        </div>

        {/* Exercise Details */}
        <div className="flex-1 p-3 flex flex-col justify-center min-w-0">
          <h5 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight mb-2 line-clamp-2">
            {exercise.exercise_details?.name || "Exercise"}
          </h5>

          {/* Exercise Meta */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
            {exercise.sets && exercise.sets > 0 && (
              <span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {exercise.sets}
                </span>{" "}
                sets
              </span>
            )}
            {exercise.reps && exercise.reps > 0 && (
              <span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {exercise.reps}
                </span>{" "}
                reps
              </span>
            )}
            {exercise.duration_seconds && exercise.duration_seconds > 0 && (
              <span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {formatDuration(exercise.duration_seconds)}
                </span>
              </span>
            )}
            {exercise.per_side && (
              <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-300">
                Each side
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewExerciseRow({
  exercise,
  formatDuration,
}: {
  exercise: ExerciseItem;
  formatDuration: (seconds: number) => string;
}) {
  const metricsText = getExerciseMetricsText(exercise) || "none";
  const metrics = parsePlanExerciseMetricsForSave(metricsText);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md dark:hover:shadow-black/30 transition-all overflow-hidden">
      <div className="flex items-stretch">
        <div className="flex-1 p-3 flex flex-col justify-center min-w-0">
          <h5 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight mb-2 line-clamp-2">
            {exercise.name || "Exercise"}
          </h5>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
            {metrics.sets && metrics.sets > 0 && (
              <span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {metrics.sets}
                </span>{" "}
                sets
              </span>
            )}
            {metrics.reps && metrics.reps > 0 && (
              <span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {metrics.reps}
                </span>{" "}
                reps
              </span>
            )}
            {metrics.duration_seconds && metrics.duration_seconds > 0 && (
              <span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {formatDuration(metrics.duration_seconds)}
                </span>
              </span>
            )}
            {exercise.per_side?.toLowerCase() === "yes" && (
              <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-300">
                Each side
              </span>
            )}
            {exercise.per_side?.toLowerCase() === "n/a" && (
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                N/A
              </span>
            )}
            {metricsText.toLowerCase() === "none" && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                No metrics
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

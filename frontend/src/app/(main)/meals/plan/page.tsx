"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MdAdd,
  MdAutorenew,
  MdCheckCircle,
  MdChevronLeft,
  MdClose,
  MdRestaurant,
  MdRefresh,
  MdSave,
  MdSchedule,
  MdSwapHoriz,
} from "react-icons/md";
import { HiMoon, HiArrowRightOnRectangle } from "react-icons/hi2";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import Dialog from "@/components/Dialog";
import { supabase } from "@/lib/api/supabase";
import type {
  UserMeal,
  UserMealDailyLog,
  UserMealIngredient,
  UserMealRecord,
  UserMealPlan,
  UserMealWeeklyDayPlan,
  UserMealWeeklyPlan,
} from "@/types/UserMeals";
import type { UserProfile } from "@/types/UserProfile";

type MealWithIngredients = UserMeal & {
  ingredients: UserMealIngredient[];
};

type DayPlanWithMeals = UserMealWeeklyDayPlan & {
  week_number: number | null;
  meals: MealWithIngredients[];
};

type MealTypeForPrompt = "breakfast" | "lunch" | "dinner" | "snacks";
type MealRecordStatus = UserMealRecord["status"];
type MealRecordSource = UserMealRecord["source"];

type RegeneratedIngredientDraft = {
  measurement: string;
  item_name: string;
  price: string;
};

type RegeneratedMealDraft = {
  meal_name: string;
  best_time_to_eat: string;
  est_cost: number | null;
  cooking_instructions: string[];
  ingredients: RegeneratedIngredientDraft[];
};

type MealRecordDraft = {
  plannedMealId: string | null;
  mealName: string;
  mealTime: string;
  status: MealRecordStatus;
  recordDate: string;
  consumedAt: string;
  notes: string;
  portionMultiplier: string;
  completionPercent: string;
  actualCost: string;
  waterGlasses: string;
  source: MealRecordSource;
};

type MealRecordDialogState = {
  mode: "planned" | "manual" | "prompt";
  meal: MealWithIngredients | null;
  dayPlan: DayPlanWithMeals | null;
  promptKey?: string | null;
};

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const MEAL_TIME_ORDER: Record<string, number> = {
  Breakfast: 0,
  Lunch: 1,
  Dinner: 2,
  Snack: 3,
};

const DAILY_WATER_GLASS_GOAL = 8;
const WATER_ML_PER_GLASS = 250;

const normalizeDayName = (value?: string | null): string =>
  (value ?? "").trim().toLowerCase();

const toDayLabel = (value?: string | null): string => {
  const normalized = normalizeDayName(value);
  if (!normalized) return "Unknown Day";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const parseClockValue = (value?: string | null): number => {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const input = value.trim().toLowerCase();
  const twelveMatch = input.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (twelveMatch) {
    let hour = parseInt(twelveMatch[1], 10);
    const minute = parseInt(twelveMatch[2] || "0", 10);
    const period = twelveMatch[3];
    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    return hour * 60 + minute;
  }

  const twentyFourMatch = input.match(/^([01]?\d|2[0-3])(?::([0-5]\d))?$/);
  if (twentyFourMatch) {
    const hour = parseInt(twentyFourMatch[1], 10);
    const minute = parseInt(twentyFourMatch[2] || "0", 10);
    return hour * 60 + minute;
  }

  return Number.MAX_SAFE_INTEGER;
};

const formatDateLabel = (value?: string | null): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatMoney = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) return "-";
  return `$${value.toFixed(2)}`;
};

/** Title case per word (Aa bb); also formats text inside (...). */
const formatMealPlanDisplayName = (raw?: string | null): string => {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";

  const titleCaseWord = (word: string): string => {
    if (!word) return word;
    return word
      .split("-")
      .map((part) =>
        part
          ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          : part,
      )
      .join("-");
  };

  const titleCasePhrase = (phrase: string): string =>
    phrase
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(titleCaseWord)
      .join(" ");

  let out = "";
  let rest = s;
  while (rest.length > 0) {
    const open = rest.indexOf("(");
    if (open === -1) {
      out += titleCasePhrase(rest);
      break;
    }
    out += titleCasePhrase(rest.slice(0, open));
    const close = rest.indexOf(")", open);
    if (close === -1) {
      out += titleCasePhrase(rest.slice(open));
      break;
    }
    const inner = rest.slice(open + 1, close);
    out += `(${titleCasePhrase(inner)})`;
    rest = rest.slice(close + 1).trimStart();
  }
  return out.trim();
};

const parseEstimatedCost = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.-]/g, "");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeMealTypeForPrompt = (
  value?: string | null,
): MealTypeForPrompt => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "breakfast") return "breakfast";
  if (normalized === "lunch") return "lunch";
  if (normalized === "dinner") return "dinner";
  return "snacks";
};

const formatHoursAway = (minutesAway: number): string => {
  const safeMinutes = Math.max(0, Math.ceil(minutesAway));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  const hourLabel = `hour${hours === 1 ? "" : "s"}`;
  const minLabel = `min${mins === 1 ? "" : "s"}`;
  return `${hours} ${hourLabel} ${mins} ${minLabel} away`;
};

const toLocalDateInputValue = (date: Date): string => {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
};

const toLocalDateTimeInputValue = (date: Date): string => {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const toLocalDateTimeInputValueFromIso = (
  value: string | null | undefined,
  fallbackDate: Date,
): string => {
  if (!value) return toLocalDateTimeInputValue(fallbackDate);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return toLocalDateTimeInputValue(fallbackDate);
  }
  return toLocalDateTimeInputValue(parsed);
};

const combineDateAndTimeToIso = (value: string): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const getMealTimeBadgeClass = (mealTime?: string | null): string => {
  const key = (mealTime ?? "").trim().toLowerCase();
  if (key === "breakfast")
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  if (key === "lunch")
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (key === "dinner")
    return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";
  return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300";
};

const compareMealsBySchedule = (
  mealA: MealWithIngredients,
  mealB: MealWithIngredients,
): number => {
  const timeA = parseClockValue(mealA.best_time_to_eat);
  const timeB = parseClockValue(mealB.best_time_to_eat);
  if (timeA !== timeB) return timeA - timeB;

  const mealOrderA = MEAL_TIME_ORDER[mealA.meal_time || ""] ?? 99;
  const mealOrderB = MEAL_TIME_ORDER[mealB.meal_time || ""] ?? 99;
  if (mealOrderA !== mealOrderB) return mealOrderA - mealOrderB;

  return (mealA.meal_name || "").localeCompare(mealB.meal_name || "");
};

export default function MealPlanDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { fetchUserProfile } = useUserData();
  const planId = searchParams.get("id");
  const workoutPlanId = searchParams.get("workoutPlanId");
  const activeLoadRequestRef = useRef(0);
  const autoReloadKeyRef = useRef<string | null>(null);

  const [mealPlan, setMealPlan] = useState<UserMealPlan | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [dayPlans, setDayPlans] = useState<DayPlanWithMeals[]>([]);
  const [activeDayPlanId, setActiveDayPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mealFilter, setMealFilter] = useState<
    "all" | "breakfast" | "lunch" | "dinner" | "snack"
  >("all");
  const [expandedMealDetails, setExpandedMealDetails] = useState<
    Record<string, boolean>
  >({});
  const [pendingMealDrafts, setPendingMealDrafts] = useState<
    Record<string, RegeneratedMealDraft>
  >({});
  const [regeneratingMealIds, setRegeneratingMealIds] = useState<
    Record<string, boolean>
  >({});
  const [savingMealIds, setSavingMealIds] = useState<Record<string, boolean>>(
    {},
  );
  const [mealActionErrors, setMealActionErrors] = useState<
    Record<string, string>
  >({});
  const [activeSwapMealId, setActiveSwapMealId] = useState<string | null>(null);
  const [swapTargetDayPlanId, setSwapTargetDayPlanId] = useState("");
  const [swapTargetMealId, setSwapTargetMealId] = useState("");
  const [swapMealError, setSwapMealError] = useState<string | null>(null);
  const [isSwappingMeal, setIsSwappingMeal] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [mealRecordsByPlannedMealId, setMealRecordsByPlannedMealId] = useState<
    Record<string, UserMealRecord>
  >({});
  const [isLoadingMealRecords, setIsLoadingMealRecords] = useState(false);
  const [todayMealDailyLog, setTodayMealDailyLog] =
    useState<UserMealDailyLog | null>(null);
  const [mealRecordDialogState, setMealRecordDialogState] =
    useState<MealRecordDialogState | null>(null);
  const [mealRecordDraft, setMealRecordDraft] = useState<MealRecordDraft>({
    plannedMealId: null,
    mealName: "",
    mealTime: "breakfast",
    status: "eaten",
    recordDate: toLocalDateInputValue(new Date()),
    consumedAt: toLocalDateTimeInputValue(new Date()),
    notes: "",
    portionMultiplier: "1",
    completionPercent: "",
    actualCost: "",
    waterGlasses: "0",
    source: "manual",
  });
  const [mealRecordError, setMealRecordError] = useState<string | null>(null);
  const [isSavingMealRecordDialog, setIsSavingMealRecordDialog] =
    useState(false);
  const dismissedPromptKeysRef = useRef<Set<string>>(new Set());

  const ROUTE_LOAD_TIMEOUT_MS = 10000;
  const clearAutoReloadFlag = useCallback(() => {
    if (typeof window === "undefined") return;
    const key = autoReloadKeyRef.current;
    if (!key) return;
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore storage access issues.
    }
  }, []);

  const tryAutoHardReload = useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    const key = planId ? `vs:auto-hard-reload:meal-plan:${planId}` : null;
    autoReloadKeyRef.current = key;
    if (!key) return false;

    try {
      if (window.sessionStorage.getItem(key) === "1") {
        return false;
      }
      window.sessionStorage.setItem(key, "1");
    } catch {
      // If storage is unavailable, still attempt one hard reload.
    }

    window.location.reload();
    return true;
  }, [planId]);

  const backHref = workoutPlanId
    ? `/meals/workout/plan/${workoutPlanId}`
    : "/meals";

  const activeDayPlan = useMemo(() => {
    if (!activeDayPlanId) return null;
    return dayPlans.find((dayPlan) => dayPlan.id === activeDayPlanId) ?? null;
  }, [activeDayPlanId, dayPlans]);

  const todayDate = useMemo(() => new Date(clockNow), [clockNow]);
  const todayRecordDate = useMemo(
    () => toLocalDateInputValue(todayDate),
    [todayDate],
  );
  const todayDayName = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", { weekday: "long" })
        .format(todayDate)
        .toLowerCase(),
    [todayDate],
  );
  const todayDayPlan = useMemo(() => {
    if (
      activeDayPlan &&
      normalizeDayName(activeDayPlan.day_name) === todayDayName
    ) {
      return activeDayPlan;
    }
    return (
      dayPlans.find(
        (dayPlan) => normalizeDayName(dayPlan.day_name) === todayDayName,
      ) ?? null
    );
  }, [activeDayPlan, dayPlans, todayDayName]);

  const upcomingMeal = useMemo(() => {
    if (!activeDayPlan || activeDayPlan.meals.length === 0) return null;

    const now = new Date(clockNow);
    const currentMinutes =
      now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

    const candidates = activeDayPlan.meals
      .map((meal) => {
        const mealMinutes = parseClockValue(meal.best_time_to_eat);
        if (mealMinutes === Number.MAX_SAFE_INTEGER) return null;
        const minutesAway =
          mealMinutes >= currentMinutes
            ? mealMinutes - currentMinutes
            : 24 * 60 - (currentMinutes - mealMinutes);
        return { meal, minutesAway };
      })
      .filter(
        (
          entry,
        ): entry is {
          meal: MealWithIngredients;
          minutesAway: number;
        } => entry !== null,
      )
      .sort((a, b) => {
        if (a.minutesAway !== b.minutesAway)
          return a.minutesAway - b.minutesAway;
        const aOrder = MEAL_TIME_ORDER[a.meal.meal_time || ""] ?? 99;
        const bOrder = MEAL_TIME_ORDER[b.meal.meal_time || ""] ?? 99;
        return aOrder - bOrder;
      });

    if (candidates.length > 0) {
      const nearest = candidates[0];
      return {
        mealTime: nearest.meal.meal_time || "Meal",
        mealName: nearest.meal.meal_name || "Unnamed Meal",
        distanceLabel: formatHoursAway(nearest.minutesAway),
      };
    }

    const fallbackMeal = activeDayPlan.meals[0];
    return {
      mealTime: fallbackMeal.meal_time || "Meal",
      mealName: fallbackMeal.meal_name || "Unnamed Meal",
      distanceLabel: "Time not set",
    };
  }, [activeDayPlan, clockNow]);

  const loadUserProfile = useCallback(async () => {
    if (!user?.id) {
      setUserProfile(null);
      return;
    }

    try {
      const result = await fetchUserProfile(user.id);
      if (result.success && result.data) {
        setUserProfile(result.data);
      }
    } catch (error) {
      console.warn("Unable to load user profile for meal regeneration:", error);
    }
  }, [fetchUserProfile, user?.id]);

  useEffect(() => {
    void loadUserProfile();
  }, [loadUserProfile]);

  useEffect(() => {
    setActiveSwapMealId(null);
    setSwapTargetDayPlanId("");
    setSwapTargetMealId("");
    setSwapMealError(null);
  }, [activeDayPlanId]);

  const buildMealRecordDraft = useCallback(
    (
      meal: MealWithIngredients | null,
      options?: {
        existingRecord?: UserMealRecord | null;
        source?: MealRecordSource;
        status?: MealRecordStatus;
      },
    ): MealRecordDraft => {
      const existingRecord = options?.existingRecord ?? null;
      return {
        plannedMealId: meal?.id ?? existingRecord?.planned_meal_id ?? null,
        mealName:
          existingRecord?.meal_name_snapshot?.trim() ||
          meal?.meal_name?.trim() ||
          "",
        mealTime: (
          existingRecord?.meal_time?.trim().toLowerCase() ||
          meal?.meal_time?.trim().toLowerCase() ||
          "breakfast"
        ).replace("snacks", "snack"),
        status: options?.status ?? existingRecord?.status ?? "eaten",
        recordDate: existingRecord?.record_date ?? todayRecordDate,
        consumedAt: toLocalDateTimeInputValueFromIso(
          existingRecord?.consumed_at,
          todayDate,
        ),
        notes: existingRecord?.notes ?? "",
        portionMultiplier:
          existingRecord?.portion_multiplier != null
            ? String(existingRecord.portion_multiplier)
            : "1",
        completionPercent:
          options?.status === "partial"
            ? "50"
            : existingRecord?.completion_percent != null
              ? String(existingRecord.completion_percent)
              : "",
        actualCost:
          existingRecord?.actual_cost != null
            ? String(existingRecord.actual_cost)
            : "",
        waterGlasses: "0",
        source:
          options?.source ??
          existingRecord?.source ??
          (meal ? "planned" : "manual"),
      };
    },
    [todayDate, todayRecordDate],
  );

  const dismissMealRecordDialog = useCallback(() => {
    setMealRecordDialogState((prev) => {
      if (prev?.promptKey) {
        dismissedPromptKeysRef.current.add(prev.promptKey);
      }
      return null;
    });
    setMealRecordError(null);
  }, []);

  const openMealRecordDialog = useCallback(
    (
      mode: MealRecordDialogState["mode"],
      meal: MealWithIngredients | null,
      dayPlan: DayPlanWithMeals | null,
      options?: {
        promptKey?: string | null;
        source?: MealRecordSource;
        status?: MealRecordStatus;
      },
    ) => {
      const existingRecord = meal?.id
        ? (mealRecordsByPlannedMealId[meal.id] ?? null)
        : null;
      setMealRecordError(null);
      setMealRecordDraft(
        buildMealRecordDraft(meal, {
          existingRecord,
          source:
            options?.source ??
            (mode === "manual" && !meal ? "manual" : "planned"),
          status: options?.status,
        }),
      );
      setMealRecordDialogState({
        mode,
        meal,
        dayPlan,
        promptKey: options?.promptKey ?? null,
      });
    },
    [buildMealRecordDraft, mealRecordsByPlannedMealId],
  );

  const loadTodayMealRecords = useCallback(async () => {
    if (!user?.id || !planId) {
      setMealRecordsByPlannedMealId({});
      setTodayMealDailyLog(null);
      setIsLoadingMealRecords(false);
      return;
    }

    setIsLoadingMealRecords(true);
    try {
      const { data, error } = await supabase
        .from("user_meal_records")
        .select("*")
        .eq("user_id", user.id)
        .eq("meal_plan_id", planId)
        .eq("record_date", todayRecordDate)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const { data: dailyLogData, error: dailyLogError } = await supabase
        .from("user_meal_daily_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("log_date", todayRecordDate)
        .limit(1)
        .maybeSingle();

      if (dailyLogError) {
        throw dailyLogError;
      }

      const records = (data ?? []) as UserMealRecord[];
      const nextMap = records.reduce<Record<string, UserMealRecord>>(
        (acc, record) => {
          if (record.planned_meal_id && !acc[record.planned_meal_id]) {
            acc[record.planned_meal_id] = record;
          }
          return acc;
        },
        {},
      );
      setMealRecordsByPlannedMealId(nextMap);
      setTodayMealDailyLog((dailyLogData as UserMealDailyLog | null) ?? null);
    } catch {
      setMealRecordsByPlannedMealId({});
      setTodayMealDailyLog(null);
    } finally {
      setIsLoadingMealRecords(false);
    }
  }, [planId, todayRecordDate, user?.id]);

  const ensureMealDailyLog = useCallback(
    async (recordDate: string, additionalWaterMl: number) => {
      if (!user?.id) return;
      const normalizedWaterMl = Math.max(0, additionalWaterMl || 0);

      const payload = {
        user_id: user.id,
        log_date: recordDate,
        meal_plan_id: mealPlan?.id ?? null,
        water_ml: normalizedWaterMl,
      } satisfies Partial<UserMealDailyLog>;

      const { data: existingLog, error: existingLogError } = await supabase
        .from("user_meal_daily_logs")
        .select("id, meal_plan_id, water_ml")
        .eq("user_id", user.id)
        .eq("log_date", recordDate)
        .limit(1)
        .maybeSingle();

      if (existingLogError) {
        throw new Error(
          existingLogError.message || "Failed to load meal daily log.",
        );
      }

      if (existingLog?.id) {
        const nextWaterMl = Math.max(
          0,
          (existingLog.water_ml ?? 0) + normalizedWaterMl,
        );

        if (
          existingLog.meal_plan_id === payload.meal_plan_id &&
          existingLog.water_ml === nextWaterMl
        ) {
          return;
        }

        const { error: updateLogError } = await supabase
          .from("user_meal_daily_logs")
          .update({
            meal_plan_id: payload.meal_plan_id,
            water_ml: nextWaterMl,
          })
          .eq("id", existingLog.id);

        if (updateLogError) {
          throw new Error(
            updateLogError.message || "Failed to update meal daily log.",
          );
        }
        return;
      }

      const { error: insertLogError } = await supabase
        .from("user_meal_daily_logs")
        .insert(payload);

      if (insertLogError) {
        throw new Error(
          insertLogError.message || "Failed to create meal daily log.",
        );
      }
    },
    [mealPlan?.id, user?.id],
  );

  const persistMealRecord = useCallback(
    async (
      dialogState: MealRecordDialogState,
      draft: MealRecordDraft,
    ): Promise<UserMealRecord> => {
      if (!user?.id) {
        throw new Error("You need to be signed in to record meals.");
      }

      const mealNameSnapshot = draft.mealName.trim();
      if (!mealNameSnapshot) {
        throw new Error("Meal name is required.");
      }

      const recordDate = draft.recordDate || todayRecordDate;
      const consumedAt = combineDateAndTimeToIso(draft.consumedAt);
      const portionMultiplier = Number(draft.portionMultiplier);
      const completionPercent = draft.completionPercent.trim()
        ? Number(draft.completionPercent)
        : draft.status === "partial"
          ? 50
          : null;
      const actualCost = draft.actualCost.trim()
        ? Number(draft.actualCost)
        : null;
      const waterGlasses = draft.waterGlasses.trim()
        ? Number(draft.waterGlasses)
        : 0;
      const waterMl = Math.round(waterGlasses * WATER_ML_PER_GLASS);

      if (!Number.isFinite(portionMultiplier) || portionMultiplier <= 0) {
        throw new Error("Portion multiplier must be greater than 0.");
      }

      if (
        completionPercent != null &&
        (!Number.isFinite(completionPercent) ||
          completionPercent < 0 ||
          completionPercent > 100)
      ) {
        throw new Error("Completion percent must be between 0 and 100.");
      }

      if (actualCost != null && !Number.isFinite(actualCost)) {
        throw new Error("Actual cost must be a valid number.");
      }

      if (
        !Number.isFinite(waterGlasses) ||
        waterGlasses < 0 ||
        waterGlasses > DAILY_WATER_GLASS_GOAL
      ) {
        throw new Error("Water intake must be between 0 and 8 glasses.");
      }

      const payload = {
        user_id: user.id,
        record_date: recordDate,
        consumed_at: consumedAt,
        planned_meal_id: draft.plannedMealId ?? dialogState.meal?.id ?? null,
        meal_plan_id: mealPlan?.id ?? null,
        week_plan_id: dialogState.dayPlan?.week_plan_id ?? null,
        day_plan_id: dialogState.dayPlan?.id ?? null,
        source: draft.source,
        status: draft.status,
        meal_time: draft.mealTime || null,
        meal_name_snapshot: mealNameSnapshot,
        best_time_to_eat_snapshot: dialogState.meal?.best_time_to_eat ?? null,
        portion_multiplier: portionMultiplier,
        completion_percent: completionPercent,
        estimated_cost: dialogState.meal?.est_cost ?? null,
        actual_cost: actualCost,
        notes: draft.notes.trim() || null,
      };

      const plannedMealId = payload.planned_meal_id;
      let query;

      if (plannedMealId) {
        const { data: existingRecord, error: existingRecordError } =
          await supabase
            .from("user_meal_records")
            .select("id")
            .eq("user_id", user.id)
            .eq("planned_meal_id", plannedMealId)
            .eq("record_date", recordDate)
            .limit(1)
            .maybeSingle();

        if (existingRecordError) {
          throw new Error(
            existingRecordError.message ||
              "Failed to load existing meal record.",
          );
        }

        if (existingRecord?.id) {
          throw new Error("This meal has already been logged for today.");
        }

        query = supabase
          .from("user_meal_records")
          .insert(payload)
          .select("*")
          .single();
      } else {
        query = supabase
          .from("user_meal_records")
          .insert(payload)
          .select("*")
          .single();
      }

      const { data, error } = await query;
      if (error || !data) {
        throw new Error(error?.message || "Failed to save meal record.");
      }

      try {
        await ensureMealDailyLog(recordDate, waterMl);
      } catch (dailyLogError) {
        console.warn(
          "Meal record saved, but daily meal log sync failed:",
          dailyLogError,
        );
      }
      await loadTodayMealRecords();

      return data as UserMealRecord;
    },
    [
      ensureMealDailyLog,
      loadTodayMealRecords,
      mealPlan?.id,
      todayRecordDate,
      user?.id,
    ],
  );

  const handlePromptMealRecord = useCallback(
    async (status: MealRecordStatus) => {
      if (
        !mealRecordDialogState ||
        mealRecordDialogState.mode !== "prompt" ||
        !mealRecordDialogState.meal ||
        !mealRecordDialogState.dayPlan
      ) {
        return;
      }

      setMealRecordError(null);
      setIsSavingMealRecordDialog(true);

      try {
        await persistMealRecord(
          {
            ...mealRecordDialogState,
            mode: "planned",
          },
          buildMealRecordDraft(mealRecordDialogState.meal, {
            source: "planned",
            status,
          }),
        );
        setMealRecordDialogState(null);
      } catch (error) {
        setMealRecordError(
          error instanceof Error
            ? error.message
            : "Failed to save meal record.",
        );
      } finally {
        setIsSavingMealRecordDialog(false);
      }
    },
    [buildMealRecordDraft, mealRecordDialogState, persistMealRecord],
  );

  const handleSaveMealRecordDialog = useCallback(async () => {
    if (!mealRecordDialogState) return;

    setMealRecordError(null);
    setIsSavingMealRecordDialog(true);

    try {
      await persistMealRecord(mealRecordDialogState, mealRecordDraft);
      setMealRecordDialogState(null);
    } catch (error) {
      setMealRecordError(
        error instanceof Error ? error.message : "Failed to save meal record.",
      );
    } finally {
      setIsSavingMealRecordDialog(false);
    }
  }, [mealRecordDialogState, mealRecordDraft, persistMealRecord]);

  const getDayTotalEstimatedCost = useCallback((dayPlan: DayPlanWithMeals) => {
    return dayPlan.meals.reduce((sum, meal) => sum + (meal.est_cost ?? 0), 0);
  }, []);

  const buildOriginalMealJson = useCallback((dayPlan: DayPlanWithMeals) => {
    const groupedMeals: {
      breakfast: Record<string, unknown> | null;
      lunch: Record<string, unknown> | null;
      dinner: Record<string, unknown> | null;
      snacks: Record<string, unknown>[];
    } = {
      breakfast: null,
      lunch: null,
      dinner: null,
      snacks: [],
    };

    dayPlan.meals.forEach((meal) => {
      const mealPayload = {
        id: meal.id,
        meal_time: meal.meal_time ?? null,
        meal_name: meal.meal_name ?? null,
        best_time_to_eat: meal.best_time_to_eat ?? null,
        est_cost: meal.est_cost ?? null,
        cooking_instructions: meal.cooking_instructions ?? [],
        ingredients: meal.ingredients.map((ingredient) => ({
          item_name: ingredient.item_name ?? null,
          measurement: ingredient.measurement ?? null,
          price: ingredient.price ?? null,
        })),
      };

      const mealType = normalizeMealTypeForPrompt(meal.meal_time);
      if (mealType === "snacks") {
        groupedMeals.snacks.push(mealPayload);
        return;
      }

      if (mealType === "breakfast") {
        groupedMeals.breakfast = mealPayload;
      }
      if (mealType === "lunch") {
        groupedMeals.lunch = mealPayload;
      }
      if (mealType === "dinner") {
        groupedMeals.dinner = mealPayload;
      }
    });

    return JSON.stringify(groupedMeals);
  }, []);

  const handleRegenerateMeal = useCallback(
    async (meal: MealWithIngredients, dayPlan: DayPlanWithMeals) => {
      const mealType = normalizeMealTypeForPrompt(meal.meal_time);
      const allergies =
        userProfile?.health_conditions &&
        userProfile.health_conditions.length > 0
          ? userProfile.health_conditions.join(", ")
          : "none";
      const totalDayCost = getDayTotalEstimatedCost(dayPlan);

      setMealActionErrors((prev) => {
        const next = { ...prev };
        delete next[meal.id];
        return next;
      });
      setRegeneratingMealIds((prev) => ({ ...prev, [meal.id]: true }));

      try {
        const response = await fetch("/api/regenerate-meal", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            variables: {
              meal_type: mealType,
              gender: userProfile?.gender ?? "not specified",
              goal: userProfile?.fitness_goal ?? "not specified",
              dietary_preference:
                userProfile?.dietary_preference ?? "not specified",
              allergies,
              daily_budget: dayPlan.daily_budget ?? "not specified",
              current_cost: formatMoney(totalDayCost),
              original_meal_json: buildOriginalMealJson(dayPlan),
            },
          }),
        });

        const payload = (await response.json()) as {
          error?: string;
          meal?: {
            meal_name?: string;
            best_time_to_eat?: string;
            estimated_meal_cost?: string;
            cooking_instructions?: string[];
            ingredients?: Array<{
              item_name?: string;
              measurement?: string;
              price?: string;
            }>;
          };
        };

        if (!response.ok || !payload?.meal) {
          throw new Error(payload?.error || "Failed to regenerate meal.");
        }

        const regeneratedMeal = payload.meal;
        const draft: RegeneratedMealDraft = {
          meal_name: (
            regeneratedMeal.meal_name ||
            meal.meal_name ||
            "Meal"
          ).trim(),
          best_time_to_eat: (
            regeneratedMeal.best_time_to_eat ||
            meal.best_time_to_eat ||
            "Time not set"
          ).trim(),
          est_cost: parseEstimatedCost(
            regeneratedMeal.estimated_meal_cost ?? meal.est_cost,
          ),
          cooking_instructions: Array.isArray(
            regeneratedMeal.cooking_instructions,
          )
            ? regeneratedMeal.cooking_instructions
                .map((instruction) => instruction.trim())
                .filter((instruction) => instruction.length > 0)
            : [],
          ingredients: Array.isArray(regeneratedMeal.ingredients)
            ? regeneratedMeal.ingredients
                .map((ingredient) => ({
                  item_name: (ingredient.item_name ?? "").trim(),
                  measurement: (ingredient.measurement ?? "-").trim() || "-",
                  price: (ingredient.price ?? "-").trim() || "-",
                }))
                .filter((ingredient) => ingredient.item_name.length > 0)
            : [],
        };

        setPendingMealDrafts((prev) => ({
          ...prev,
          [meal.id]: draft,
        }));
      } catch (error: unknown) {
        setMealActionErrors((prev) => ({
          ...prev,
          [meal.id]:
            error instanceof Error
              ? error.message
              : "Failed to regenerate meal.",
        }));
      } finally {
        setRegeneratingMealIds((prev) => ({
          ...prev,
          [meal.id]: false,
        }));
      }
    },
    [buildOriginalMealJson, getDayTotalEstimatedCost, userProfile],
  );

  const handleCancelRegeneratedMeal = useCallback((mealId: string) => {
    setPendingMealDrafts((prev) => {
      const next = { ...prev };
      delete next[mealId];
      return next;
    });
    setMealActionErrors((prev) => {
      const next = { ...prev };
      delete next[mealId];
      return next;
    });
  }, []);

  const handleSaveRegeneratedMeal = useCallback(
    async (meal: MealWithIngredients) => {
      const draft = pendingMealDrafts[meal.id];
      if (!draft) return;

      setMealActionErrors((prev) => {
        const next = { ...prev };
        delete next[meal.id];
        return next;
      });
      setSavingMealIds((prev) => ({ ...prev, [meal.id]: true }));

      try {
        const updatePayload = {
          meal_name: draft.meal_name || meal.meal_name || null,
          best_time_to_eat:
            draft.best_time_to_eat || meal.best_time_to_eat || null,
          est_cost: draft.est_cost,
          cooking_instructions:
            draft.cooking_instructions.length > 0
              ? draft.cooking_instructions
              : null,
        };

        const { error: updateMealError } = await supabase
          .from("user_meals")
          .update(updatePayload)
          .eq("id", meal.id);

        if (updateMealError) {
          throw new Error(updateMealError.message || "Failed to update meal.");
        }

        const { data: existingLinksData, error: existingLinksError } =
          await supabase
            .from("user_meal_ingredients_link")
            .select("ingredient_id")
            .eq("meal_id", meal.id);

        if (existingLinksError) {
          throw new Error(
            existingLinksError.message ||
              "Failed to load existing ingredient links.",
          );
        }

        const previousIngredientIds = Array.from(
          new Set(
            (existingLinksData ?? [])
              .map((row) => row.ingredient_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );

        const { error: deleteLinksError } = await supabase
          .from("user_meal_ingredients_link")
          .delete()
          .eq("meal_id", meal.id);

        if (deleteLinksError) {
          throw new Error(
            deleteLinksError.message || "Failed to reset ingredient links.",
          );
        }

        if (previousIngredientIds.length > 0) {
          const { data: remainingLinksData, error: remainingLinksError } =
            await supabase
              .from("user_meal_ingredients_link")
              .select("ingredient_id")
              .in("ingredient_id", previousIngredientIds);

          if (remainingLinksError) {
            throw new Error(
              remainingLinksError.message ||
                "Failed to validate remaining ingredient links.",
            );
          }

          const stillLinkedIngredientIds = new Set(
            (remainingLinksData ?? [])
              .map((row) => row.ingredient_id)
              .filter((id): id is string => Boolean(id)),
          );
          const removableIngredientIds = previousIngredientIds.filter(
            (ingredientId) => !stillLinkedIngredientIds.has(ingredientId),
          );

          if (removableIngredientIds.length > 0) {
            const { error: deleteIngredientsError } = await supabase
              .from("user_meals_ingredients")
              .delete()
              .in("id", removableIngredientIds);

            if (deleteIngredientsError) {
              throw new Error(
                deleteIngredientsError.message ||
                  "Failed to remove previous ingredients.",
              );
            }
          }
        }

        let insertedIngredients: UserMealIngredient[] = [];
        const ingredientInsertPayload = draft.ingredients
          .map((ingredient) => ({
            item_name: ingredient.item_name || null,
            measurement: ingredient.measurement || null,
            price: ingredient.price || null,
          }))
          .filter(
            (ingredient) =>
              !!ingredient.item_name ||
              !!ingredient.measurement ||
              !!ingredient.price,
          );

        if (ingredientInsertPayload.length > 0) {
          const {
            data: insertedIngredientsData,
            error: insertIngredientsError,
          } = await supabase
            .from("user_meals_ingredients")
            .insert(ingredientInsertPayload)
            .select("*");

          if (insertIngredientsError) {
            throw new Error(
              insertIngredientsError.message ||
                "Failed to save regenerated ingredients.",
            );
          }

          insertedIngredients = (insertedIngredientsData ??
            []) as UserMealIngredient[];

          if (insertedIngredients.length > 0) {
            const ingredientLinksPayload = insertedIngredients.map(
              (ingredient) => ({
                meal_id: meal.id,
                ingredient_id: ingredient.id,
              }),
            );

            const { error: insertIngredientLinksError } = await supabase
              .from("user_meal_ingredients_link")
              .insert(ingredientLinksPayload);

            if (insertIngredientLinksError) {
              throw new Error(
                insertIngredientLinksError.message ||
                  "Failed to save regenerated ingredient links.",
              );
            }
          }
        }

        setDayPlans((prev) =>
          prev.map((dayPlan) => ({
            ...dayPlan,
            meals: dayPlan.meals.map((existingMeal) =>
              existingMeal.id === meal.id
                ? {
                    ...existingMeal,
                    meal_name: updatePayload.meal_name,
                    best_time_to_eat: updatePayload.best_time_to_eat,
                    est_cost: updatePayload.est_cost,
                    cooking_instructions: updatePayload.cooking_instructions,
                    ingredients: insertedIngredients,
                  }
                : existingMeal,
            ),
          })),
        );

        setPendingMealDrafts((prev) => {
          const next = { ...prev };
          delete next[meal.id];
          return next;
        });
      } catch (error: unknown) {
        setMealActionErrors((prev) => ({
          ...prev,
          [meal.id]:
            error instanceof Error
              ? error.message
              : "Failed to save regenerated meal.",
        }));
      } finally {
        setSavingMealIds((prev) => ({ ...prev, [meal.id]: false }));
      }
    },
    [pendingMealDrafts],
  );

  const handleConfirmSwapMeal = useCallback(
    async (sourceMeal: MealWithIngredients, sourceDayPlanId: string) => {
      if (!swapTargetDayPlanId || !swapTargetMealId) {
        setSwapMealError("Please choose a target day and meal to swap.");
        return;
      }

      if (swapTargetDayPlanId === sourceDayPlanId) {
        setSwapMealError("Please choose a different day to swap with.");
        return;
      }

      const targetDayPlan = dayPlans.find(
        (dayPlan) => dayPlan.id === swapTargetDayPlanId,
      );
      const targetMeal = targetDayPlan?.meals.find(
        (meal) => meal.id === swapTargetMealId,
      );

      if (!targetDayPlan || !targetMeal) {
        setSwapMealError(
          "Selected target meal no longer exists. Please retry.",
        );
        return;
      }

      setSwapMealError(null);
      setIsSwappingMeal(true);

      try {
        const { error: moveSourceMealError } = await supabase
          .from("user_meals")
          .update({ meal_day_plan_id: swapTargetDayPlanId })
          .eq("id", sourceMeal.id);

        if (moveSourceMealError) {
          throw new Error(
            moveSourceMealError.message || "Failed to move source meal.",
          );
        }

        const { error: moveTargetMealError } = await supabase
          .from("user_meals")
          .update({ meal_day_plan_id: sourceDayPlanId })
          .eq("id", targetMeal.id);

        if (moveTargetMealError) {
          await supabase
            .from("user_meals")
            .update({ meal_day_plan_id: sourceDayPlanId })
            .eq("id", sourceMeal.id);
          throw new Error(
            moveTargetMealError.message || "Failed to move target meal.",
          );
        }

        setDayPlans((prev) => {
          const sourceDayPlan = prev.find(
            (dayPlan) => dayPlan.id === sourceDayPlanId,
          );
          const targetDayPlanLocal = prev.find(
            (dayPlan) => dayPlan.id === swapTargetDayPlanId,
          );
          if (!sourceDayPlan || !targetDayPlanLocal) {
            return prev;
          }

          const sourceMealLocal = sourceDayPlan.meals.find(
            (meal) => meal.id === sourceMeal.id,
          );
          const targetMealLocal = targetDayPlanLocal.meals.find(
            (meal) => meal.id === targetMeal.id,
          );
          if (!sourceMealLocal || !targetMealLocal) {
            return prev;
          }

          const nextSourceMeals = sourceDayPlan.meals
            .filter((meal) => meal.id !== sourceMealLocal.id)
            .concat({
              ...targetMealLocal,
              meal_day_plan_id: sourceDayPlanId,
            })
            .sort(compareMealsBySchedule);

          const nextTargetMeals = targetDayPlanLocal.meals
            .filter((meal) => meal.id !== targetMealLocal.id)
            .concat({
              ...sourceMealLocal,
              meal_day_plan_id: swapTargetDayPlanId,
            })
            .sort(compareMealsBySchedule);

          return prev.map((dayPlan) => {
            if (dayPlan.id === sourceDayPlanId) {
              return { ...dayPlan, meals: nextSourceMeals };
            }
            if (dayPlan.id === swapTargetDayPlanId) {
              return { ...dayPlan, meals: nextTargetMeals };
            }
            return dayPlan;
          });
        });

        setActiveSwapMealId(null);
        setSwapTargetDayPlanId("");
        setSwapTargetMealId("");
        setSwapMealError(null);
      } catch (error: unknown) {
        setSwapMealError(
          error instanceof Error ? error.message : "Failed to swap meals.",
        );
      } finally {
        setIsSwappingMeal(false);
      }
    },
    [dayPlans, swapTargetDayPlanId, swapTargetMealId],
  );

  const loadMealPlanDetails = useCallback(async () => {
    if (!planId) return;

    const requestId = activeLoadRequestRef.current + 1;
    activeLoadRequestRef.current = requestId;
    let loadCompleted = false;
    const timeoutId = window.setTimeout(() => {
      if (activeLoadRequestRef.current !== requestId) return;
      if (tryAutoHardReload()) return;
      setErrorMessage(
        "Loading meal plan took too long. Please refresh and try again.",
      );
      setIsLoading(false);
    }, ROUTE_LOAD_TIMEOUT_MS);

    setErrorMessage(null);
    setIsLoading(true);
    setPendingMealDrafts({});
    setMealActionErrors({});
    setActiveSwapMealId(null);
    setSwapTargetDayPlanId("");
    setSwapTargetMealId("");
    setSwapMealError(null);

    try {
      const { data: planData, error: planError } = await supabase
        .from("user_meal_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError || !planData) {
        throw new Error(planError?.message || "Meal plan not found");
      }
      if (activeLoadRequestRef.current !== requestId) return;
      setMealPlan(planData as UserMealPlan);

      const { data: weeklyPlansData, error: weeklyPlansError } = await supabase
        .from("user_meal_weekly_plan")
        .select("*")
        .eq("plan_id", planId);

      if (weeklyPlansError) {
        throw new Error(
          weeklyPlansError.message || "Failed to load weekly meal plans",
        );
      }

      const weeklyPlans = (weeklyPlansData ?? []) as UserMealWeeklyPlan[];
      if (weeklyPlans.length === 0) {
        if (activeLoadRequestRef.current !== requestId) return;
        loadCompleted = true;
        setDayPlans([]);
        setActiveDayPlanId(null);
        return;
      }

      const weekById = new Map<string, UserMealWeeklyPlan>(
        weeklyPlans.map((weekPlan) => [weekPlan.id, weekPlan]),
      );
      const weekPlanIds = weeklyPlans.map((weekPlan) => weekPlan.id);

      const { data: dayPlansData, error: dayPlansError } = await supabase
        .from("user_meal_weekly_day_plan")
        .select("*")
        .in("week_plan_id", weekPlanIds);

      if (dayPlansError) {
        throw new Error(dayPlansError.message || "Failed to load day plans");
      }

      const sortedDayPlans = ((dayPlansData ?? []) as UserMealWeeklyDayPlan[])
        .map((dayPlan) => ({
          ...dayPlan,
          week_number:
            weekById.get(dayPlan.week_plan_id || "")?.week_number ?? 1,
        }))
        .sort((a, b) => {
          const weekA = a.week_number ?? 1;
          const weekB = b.week_number ?? 1;
          if (weekA !== weekB) return weekA - weekB;

          const dayA = DAY_ORDER.indexOf(normalizeDayName(a.day_name));
          const dayB = DAY_ORDER.indexOf(normalizeDayName(b.day_name));
          const normalizedA = dayA === -1 ? Number.MAX_SAFE_INTEGER : dayA;
          const normalizedB = dayB === -1 ? Number.MAX_SAFE_INTEGER : dayB;
          return normalizedA - normalizedB;
        });

      const dayPlanIds = sortedDayPlans.map((dayPlan) => dayPlan.id);
      if (dayPlanIds.length === 0) {
        if (activeLoadRequestRef.current !== requestId) return;
        loadCompleted = true;
        setDayPlans([]);
        setActiveDayPlanId(null);
        return;
      }

      const { data: mealsData, error: mealsError } = await supabase
        .from("user_meals")
        .select("*")
        .in("meal_day_plan_id", dayPlanIds);

      if (mealsError) {
        throw new Error(mealsError.message || "Failed to load meals");
      }

      const mealRows = (mealsData ?? []) as UserMeal[];
      const mealIds = mealRows.map((meal) => meal.id);

      const ingredientLinksByMealId = new Map<string, string[]>();
      const ingredientById = new Map<string, UserMealIngredient>();

      if (mealIds.length > 0) {
        const { data: ingredientLinksData, error: ingredientLinksError } =
          await supabase
            .from("user_meal_ingredients_link")
            .select("meal_id, ingredient_id")
            .in("meal_id", mealIds);

        if (ingredientLinksError) {
          throw new Error(
            ingredientLinksError.message || "Failed to load ingredient links",
          );
        }

        const links = (ingredientLinksData ?? []) as Array<{
          meal_id: string | null;
          ingredient_id: string | null;
        }>;

        const ingredientIds = Array.from(
          new Set(
            links
              .map((link) => link.ingredient_id)
              .filter((value): value is string => !!value),
          ),
        );

        links.forEach((link) => {
          if (!link.meal_id || !link.ingredient_id) return;
          const existing = ingredientLinksByMealId.get(link.meal_id) ?? [];
          ingredientLinksByMealId.set(link.meal_id, [
            ...existing,
            link.ingredient_id,
          ]);
        });

        if (ingredientIds.length > 0) {
          const { data: ingredientsData, error: ingredientsError } =
            await supabase
              .from("user_meals_ingredients")
              .select("*")
              .in("id", ingredientIds);

          if (ingredientsError) {
            throw new Error(
              ingredientsError.message || "Failed to load ingredients",
            );
          }

          ((ingredientsData ?? []) as UserMealIngredient[]).forEach(
            (ingredient) => {
              ingredientById.set(ingredient.id, ingredient);
            },
          );
        }
      }

      const mealsByDayPlanId = new Map<string, MealWithIngredients[]>();
      mealRows.forEach((meal) => {
        if (!meal.meal_day_plan_id) return;
        const ingredientIds = ingredientLinksByMealId.get(meal.id) ?? [];
        const ingredients = ingredientIds
          .map((ingredientId) => ingredientById.get(ingredientId))
          .filter(
            (ingredient): ingredient is UserMealIngredient => !!ingredient,
          );

        const mealWithIngredients: MealWithIngredients = {
          ...meal,
          ingredients,
        };
        const existing = mealsByDayPlanId.get(meal.meal_day_plan_id) ?? [];
        mealsByDayPlanId.set(meal.meal_day_plan_id, [
          ...existing,
          mealWithIngredients,
        ]);
      });

      const composedDayPlans: DayPlanWithMeals[] = sortedDayPlans.map(
        (dayPlan) => {
          const mealsForDay = (mealsByDayPlanId.get(dayPlan.id) ?? []).sort(
            compareMealsBySchedule,
          );

          return {
            ...dayPlan,
            meals: mealsForDay,
          };
        },
      );

      if (activeLoadRequestRef.current !== requestId) return;
      loadCompleted = true;
      setDayPlans(composedDayPlans);
      setActiveDayPlanId((prev) => {
        if (prev && composedDayPlans.some((dayPlan) => dayPlan.id === prev)) {
          return prev;
        }
        return composedDayPlans[0]?.id ?? null;
      });
    } catch (error: unknown) {
      if (activeLoadRequestRef.current !== requestId) return;
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load meal plan details",
      );
      setMealPlan(null);
      setDayPlans([]);
      setActiveDayPlanId(null);
    } finally {
      window.clearTimeout(timeoutId);
      if (loadCompleted) {
        clearAutoReloadFlag();
      }
      if (activeLoadRequestRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [clearAutoReloadFlag, planId, ROUTE_LOAD_TIMEOUT_MS, tryAutoHardReload]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadMealPlanDetails();
    setIsRefreshing(false);
  }, [loadMealPlanDetails]);

  useEffect(() => {
    if (planId) return;
    router.replace("/meals");
  }, [planId, router]);

  useEffect(() => {
    if (!planId) return;
    if (isAuthLoading) {
      setIsLoading(true);
      return;
    }
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    void loadMealPlanDetails();
  }, [isAuthLoading, loadMealPlanDetails, planId, user?.id]);

  useEffect(() => {
    dismissedPromptKeysRef.current.clear();
  }, [planId, todayRecordDate]);

  useEffect(() => {
    if (!planId || !user?.id) {
      setMealRecordsByPlannedMealId({});
      setTodayMealDailyLog(null);
      return;
    }

    void loadTodayMealRecords();
  }, [loadTodayMealRecords, planId, user?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!todayDayPlan || isLoadingMealRecords || mealRecordDialogState) return;

    const now = new Date(clockNow);
    const currentMinutes =
      now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

    const overdueMeal = todayDayPlan.meals.find((meal) => {
      const mealMinutes = parseClockValue(meal.best_time_to_eat);
      if (mealMinutes === Number.MAX_SAFE_INTEGER) return false;
      if (currentMinutes < mealMinutes + 15) return false;
      if (mealRecordsByPlannedMealId[meal.id]) return false;

      const promptKey = `${todayRecordDate}:${meal.id}`;
      return !dismissedPromptKeysRef.current.has(promptKey);
    });

    if (!overdueMeal) return;

    openMealRecordDialog("prompt", overdueMeal, todayDayPlan, {
      promptKey: `${todayRecordDate}:${overdueMeal.id}`,
      source: "planned",
    });
  }, [
    clockNow,
    isLoadingMealRecords,
    mealRecordDialogState,
    mealRecordsByPlannedMealId,
    openMealRecordDialog,
    todayDayPlan,
    todayRecordDate,
  ]);

  const selectedWaterGlasses = Number(mealRecordDraft.waterGlasses) || 0;
  const selectedWaterMl = Math.round(selectedWaterGlasses * WATER_ML_PER_GLASS);
  const projectedDailyWaterMl = Math.max(
    0,
    (todayMealDailyLog?.water_ml ?? 0) + selectedWaterMl,
  );
  const projectedDailyWaterGlasses = projectedDailyWaterMl / WATER_ML_PER_GLASS;

  if (!planId || (!isAuthLoading && !user)) {
    return null;
  }

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Loading meal plan...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827] pb-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Image
                src="/images/Logo_VitalSpark.png"
                alt="VitalSpark"
                width={28}
                height={28}
                className="object-contain"
              />
              <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-200">
                VitalSpark by Ferdie
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white text-slate-600 shadow-sm hover:bg-slate-50 transition-colors dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <HiMoon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => router.replace("/auth/logout")}
                className="inline-flex items-center justify-center px-3 h-8 rounded-full bg-white text-slate-600 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <HiArrowRightOnRectangle className="w-4 h-4 mr-1" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <MdChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <button
            type="button"
            onClick={() => {
              void handleRefresh();
            }}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
          >
            <MdRefresh
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-100 dark:border-red-900/60 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 shadow-sm dark:shadow-black/30 overflow-hidden mb-5">
              <div className="grid grid-cols-1 md:grid-cols-[210px_1fr]">
                <div className="relative h-40 md:h-full min-h-[150px] bg-slate-100 dark:bg-slate-700">
                  {mealPlan?.image_path ? (
                    <Image
                      src={mealPlan.image_path}
                      alt={
                        mealPlan.image_alt ||
                        formatMealPlanDisplayName(mealPlan.plan_name) ||
                        "Meal plan"
                      }
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <MdRestaurant className="w-14 h-14 text-slate-400 dark:text-slate-500" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
                    {formatMealPlanDisplayName(mealPlan?.plan_name) ||
                      "Meal Plan"}
                  </h1>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/70 px-2.5 py-2">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Duration
                      </p>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {mealPlan?.duration_dayss ?? 0} days
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/70 px-2.5 py-2">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Status
                      </p>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {mealPlan?.completed ? "Completed" : "In Progress"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/70 px-2.5 py-2">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Created
                      </p>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {formatDateLabel(mealPlan?.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {dayPlans.length === 0 ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No saved day plans found for this meal plan.
              </div>
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                  {dayPlans.map((dayPlan) => {
                    const isActive = dayPlan.id === activeDayPlanId;
                    return (
                      <button
                        key={dayPlan.id}
                        type="button"
                        onClick={() => setActiveDayPlanId(dayPlan.id)}
                        className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          isActive
                            ? "bg-teal-600 border-teal-600 text-white"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                        }`}
                      >
                        {toDayLabel(dayPlan.day_name)}
                      </button>
                    );
                  })}
                </div>

                {upcomingMeal && (
                  <div className="mb-3 rounded-xl border border-amber-200 dark:border-amber-700 bg-gradient-to-r from-amber-700 to-amber-500 dark:from-amber-800 dark:to-amber-600 px-3 py-2.5 text-white shadow-sm dark:shadow-black/30 relative">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300 dark:text-amber-200">
                      Upcoming Meal
                    </p>
                    <div className="mt-1 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold leading-tight text-white">
                          {upcomingMeal.mealName}
                        </p>
                        <p className="text-xs text-teal-100/90 dark:text-teal-100 mt-0.5">
                          {upcomingMeal.distanceLabel}
                        </p>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2">
                      <span className="inline-flex items-center rounded-full bg-gradient-to-r from-teal-600 to-teal-500 dark:from-teal-500 dark:to-teal-400 px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-sm">
                        {upcomingMeal.mealTime}
                      </span>
                    </div>
                  </div>
                )}

                {activeDayPlan && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-3 shadow-sm dark:shadow-black/30">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                            {toDayLabel(activeDayPlan.day_name)}
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {activeDayPlan.day_theme || "No day theme"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {[
                              { key: "all", label: "All meals" },
                              { key: "breakfast", label: "Breakfast" },
                              { key: "lunch", label: "Lunch" },
                              { key: "dinner", label: "Dinner" },
                              { key: "snack", label: "Snacks" },
                            ].map((option) => {
                              const isActiveFilter =
                                mealFilter === option.key ||
                                (mealFilter === "all" && option.key === "all");
                              return (
                                <button
                                  key={option.key}
                                  type="button"
                                  onClick={() =>
                                    setMealFilter((current) =>
                                      current === option.key
                                        ? "all"
                                        : (option.key as
                                            | "all"
                                            | "breakfast"
                                            | "lunch"
                                            | "dinner"
                                            | "snack"),
                                    )
                                  }
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${
                                    isActiveFilter
                                      ? "bg-teal-600 border-teal-600 text-white"
                                      : "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600"
                                  }`}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {isLoadingMealRecords && (
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              Syncing today&apos;s meal records...
                            </p>
                          )}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-[220px]">
                            <div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Budget
                              </p>
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                {activeDayPlan.daily_budget || "-"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Calories
                              </p>
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                {activeDayPlan.calorie_target ?? "-"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Protein
                              </p>
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                {activeDayPlan.protein ?? "-"}g
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Carbs/Fats
                              </p>
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                {activeDayPlan.carbs ?? "-"}g /{" "}
                                {activeDayPlan.fats ?? "-"}g
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {activeDayPlan.meals.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-5 text-sm text-slate-500 dark:text-slate-400">
                        No meals saved for this day.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeDayPlan.meals
                          .filter((meal) => {
                            if (mealFilter === "all") return true;
                            const key = (meal.meal_time ?? "")
                              .trim()
                              .toLowerCase();
                            if (mealFilter === "snack") {
                              return key === "snack" || key === "snacks";
                            }
                            return key === mealFilter;
                          })
                          .map((meal) => {
                            const pendingDraft = pendingMealDrafts[meal.id];
                            const isRegenerating = Boolean(
                              regeneratingMealIds[meal.id],
                            );
                            const isSavingMeal = Boolean(
                              savingMealIds[meal.id],
                            );
                            const mealActionError = mealActionErrors[meal.id];
                            const mealRecord =
                              mealRecordsByPlannedMealId[meal.id];
                            const isMealBusy = isRegenerating || isSavingMeal;

                            const displayMealName =
                              pendingDraft?.meal_name ||
                              meal.meal_name ||
                              "Unnamed Meal";
                            const displayBestTimeToEat =
                              pendingDraft?.best_time_to_eat ||
                              meal.best_time_to_eat ||
                              "Time not set";
                            const displayEstimatedCost =
                              pendingDraft?.est_cost ?? meal.est_cost;
                            const displayIngredients = pendingDraft
                              ? pendingDraft.ingredients.map(
                                  (ingredient, index) => ({
                                    id: `draft-${meal.id}-${index}`,
                                    created_at: "",
                                    item_name: ingredient.item_name || null,
                                    measurement: ingredient.measurement || null,
                                    price: ingredient.price || null,
                                  }),
                                )
                              : meal.ingredients;
                            const displayCookingInstructions = pendingDraft
                              ? pendingDraft.cooking_instructions
                              : Array.isArray(meal.cooking_instructions)
                                ? meal.cooking_instructions
                                : [];
                            const sourceMealType = normalizeMealTypeForPrompt(
                              meal.meal_time,
                            );
                            const candidateDayPlans = dayPlans
                              .filter(
                                (dayPlan) => dayPlan.id !== activeDayPlan.id,
                              )
                              .map((dayPlan) => ({
                                dayPlan,
                                meals: dayPlan.meals.filter(
                                  (candidateMeal) =>
                                    normalizeMealTypeForPrompt(
                                      candidateMeal.meal_time,
                                    ) === sourceMealType &&
                                    candidateMeal.id !== meal.id,
                                ),
                              }))
                              .filter((entry) => entry.meals.length > 0);
                            const selectedCandidateDay =
                              candidateDayPlans.find(
                                (entry) =>
                                  entry.dayPlan.id === swapTargetDayPlanId,
                              ) ??
                              candidateDayPlans[0] ??
                              null;
                            const selectedCandidateMeals =
                              selectedCandidateDay?.meals ?? [];
                            const selectedTargetMeal =
                              selectedCandidateMeals.find(
                                (candidateMeal) =>
                                  candidateMeal.id === swapTargetMealId,
                              ) ??
                              selectedCandidateMeals[0] ??
                              null;
                            const canSwapMeal = candidateDayPlans.length > 0;

                            return (
                              <div
                                key={meal.id}
                                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-3 shadow-sm dark:shadow-black/30"
                              >
                                <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                                  <div>
                                    <p
                                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${getMealTimeBadgeClass(meal.meal_time)}`}
                                    >
                                      {meal.meal_time || "Meal"}
                                    </p>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                                      {displayMealName}
                                    </h3>
                                    {pendingDraft && (
                                      <p className="mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                        Regenerated preview ready. Save to
                                        apply.
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                      <MdSchedule className="w-3.5 h-3.5" />
                                      {displayBestTimeToEat}
                                    </p>
                                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mt-1">
                                      Est. Cost:{" "}
                                      {formatMoney(displayEstimatedCost)}
                                    </p>
                                  </div>
                                </div>

                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  {pendingDraft && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void handleSaveRegeneratedMeal(meal);
                                        }}
                                        disabled={
                                          isSavingMeal || isRegenerating
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-60"
                                      >
                                        <MdSave className="w-3.5 h-3.5" />
                                        {isSavingMeal
                                          ? "Saving..."
                                          : "Save meal"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCancelRegeneratedMeal(meal.id)
                                        }
                                        disabled={
                                          isSavingMeal || isRegenerating
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-60"
                                      >
                                        <MdClose className="w-3.5 h-3.5" />
                                        Cancel
                                      </button>
                                    </>
                                  )}
                                </div>

                                {activeSwapMealId === meal.id && (
                                  <div className="mb-2 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50/70 dark:bg-indigo-900/20 p-2.5">
                                    <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
                                      Swap this{" "}
                                      {sourceMealType === "snacks"
                                        ? "snack"
                                        : sourceMealType}{" "}
                                      with another day
                                    </p>
                                    {canSwapMeal ? (
                                      <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          <label className="flex flex-col gap-1">
                                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                              Target day
                                            </span>
                                            <select
                                              value={swapTargetDayPlanId}
                                              onChange={(event) => {
                                                const nextDayPlanId =
                                                  event.target.value;
                                                setSwapTargetDayPlanId(
                                                  nextDayPlanId,
                                                );
                                                const nextDay =
                                                  candidateDayPlans.find(
                                                    (entry) =>
                                                      entry.dayPlan.id ===
                                                      nextDayPlanId,
                                                  );
                                                setSwapTargetMealId(
                                                  nextDay?.meals[0]?.id ?? "",
                                                );
                                              }}
                                              className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-100"
                                            >
                                              {candidateDayPlans.map(
                                                (entry) => (
                                                  <option
                                                    key={`${meal.id}-swap-day-${entry.dayPlan.id}`}
                                                    value={entry.dayPlan.id}
                                                  >
                                                    {toDayLabel(
                                                      entry.dayPlan.day_name,
                                                    )}
                                                  </option>
                                                ),
                                              )}
                                            </select>
                                          </label>
                                          <label className="flex flex-col gap-1">
                                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                              Target meal
                                            </span>
                                            <select
                                              value={
                                                selectedTargetMeal?.id ?? ""
                                              }
                                              onChange={(event) =>
                                                setSwapTargetMealId(
                                                  event.target.value,
                                                )
                                              }
                                              className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-100"
                                            >
                                              {selectedCandidateMeals.map(
                                                (candidateMeal) => (
                                                  <option
                                                    key={`${meal.id}-swap-meal-${candidateMeal.id}`}
                                                    value={candidateMeal.id}
                                                  >
                                                    {(
                                                      candidateMeal.meal_name ||
                                                      "Unnamed Meal"
                                                    ).trim()}
                                                    {candidateMeal.best_time_to_eat
                                                      ? ` (${candidateMeal.best_time_to_eat})`
                                                      : ""}
                                                  </option>
                                                ),
                                              )}
                                            </select>
                                          </label>
                                        </div>
                                        {selectedTargetMeal && (
                                          <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 p-2.5">
                                            <div className="mb-2 flex items-start justify-between gap-2">
                                              <div>
                                                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                  Selected meal from{" "}
                                                  {toDayLabel(
                                                    selectedCandidateDay
                                                      ?.dayPlan.day_name,
                                                  )}
                                                </p>
                                                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                                  {selectedTargetMeal.meal_name ||
                                                    "Unnamed Meal"}
                                                </p>
                                              </div>
                                              <div className="text-right">
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                  {selectedTargetMeal.best_time_to_eat ||
                                                    "Time not set"}
                                                </p>
                                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                  Est. Cost:{" "}
                                                  {formatMoney(
                                                    selectedTargetMeal.est_cost,
                                                  )}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                              <div>
                                                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                                                  Ingredients
                                                </p>
                                                {selectedTargetMeal.ingredients
                                                  .length > 0 ? (
                                                  <div className="space-y-1">
                                                    <div className="grid grid-cols-[0.9fr_1.8fr_0.8fr] gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                                      <span>Qty</span>
                                                      <span>Item</span>
                                                      <span>Price</span>
                                                    </div>
                                                    {selectedTargetMeal.ingredients.map(
                                                      (ingredient) => (
                                                        <div
                                                          key={`${selectedTargetMeal.id}-swap-preview-ingredient-${ingredient.id}`}
                                                          className="grid grid-cols-[0.9fr_1.8fr_0.8fr] gap-2 text-[11px] text-slate-700 dark:text-slate-200"
                                                        >
                                                          <span>
                                                            {ingredient.measurement ||
                                                              "-"}
                                                          </span>
                                                          <span>
                                                            {ingredient.item_name ||
                                                              "-"}
                                                          </span>
                                                          <span>
                                                            {ingredient.price ||
                                                              "-"}
                                                          </span>
                                                        </div>
                                                      ),
                                                    )}
                                                  </div>
                                                ) : (
                                                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    No ingredient data.
                                                  </p>
                                                )}
                                              </div>
                                              <div>
                                                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                                                  Cooking Instructions
                                                </p>
                                                {Array.isArray(
                                                  selectedTargetMeal.cooking_instructions,
                                                ) &&
                                                selectedTargetMeal
                                                  .cooking_instructions.length >
                                                  0 ? (
                                                  <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-700 dark:text-slate-200">
                                                    {selectedTargetMeal.cooking_instructions.map(
                                                      (instruction, index) => (
                                                        <li
                                                          key={`${selectedTargetMeal.id}-swap-preview-step-${index}`}
                                                        >
                                                          {instruction}
                                                        </li>
                                                      ),
                                                    )}
                                                  </ol>
                                                ) : (
                                                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    No instruction data.
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              void handleConfirmSwapMeal(
                                                meal,
                                                activeDayPlan.id,
                                              );
                                            }}
                                            disabled={isSwappingMeal}
                                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 dark:bg-indigo-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors disabled:opacity-60"
                                          >
                                            <MdSwapHoriz className="w-3.5 h-3.5" />
                                            {isSwappingMeal
                                              ? "Swapping..."
                                              : "Confirm swap"}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveSwapMealId(null);
                                              setSwapTargetDayPlanId("");
                                              setSwapTargetMealId("");
                                              setSwapMealError(null);
                                            }}
                                            disabled={isSwappingMeal}
                                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-60"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </>
                                    ) : (
                                      <p className="text-xs text-slate-600 dark:text-slate-300">
                                        No compatible{" "}
                                        {sourceMealType === "snacks"
                                          ? "snacks"
                                          : sourceMealType}{" "}
                                        found on other days.
                                      </p>
                                    )}
                                    {swapMealError && (
                                      <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                                        {swapMealError}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {mealActionError && (
                                  <p className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">
                                    {mealActionError}
                                  </p>
                                )}
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedMealDetails((prev) => ({
                                        ...prev,
                                        [meal.id]: !prev[meal.id],
                                      }))
                                    }
                                    className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors"
                                  >
                                    {expandedMealDetails[meal.id]
                                      ? "Hide Full details"
                                      : "View Full details"}
                                  </button>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openMealRecordDialog(
                                          "planned",
                                          meal,
                                          activeDayPlan,
                                          {
                                            source: "planned",
                                          },
                                        )
                                      }
                                      disabled={
                                        isMealBusy || Boolean(mealRecord)
                                      }
                                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
                                        mealRecord
                                          ? "border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                          : "border border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50"
                                      }`}
                                    >
                                      {mealRecord ? (
                                        <MdCheckCircle className="h-3.5 w-3.5" />
                                      ) : (
                                        <MdAdd className="h-3.5 w-3.5" />
                                      )}
                                      {mealRecord
                                        ? "Meal logged"
                                        : "Record meal"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleRegenerateMeal(
                                          meal,
                                          activeDayPlan,
                                        );
                                      }}
                                      disabled={isMealBusy}
                                      className="inline-flex items-center gap-1 rounded-lg border border-teal-200 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/30 px-2.5 py-1 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors disabled:opacity-60"
                                    >
                                      <MdAutorenew
                                        className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`}
                                      />
                                      {isRegenerating
                                        ? "Regenerating..."
                                        : "Regenerate"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (activeSwapMealId === meal.id) {
                                          setActiveSwapMealId(null);
                                          setSwapTargetDayPlanId("");
                                          setSwapTargetMealId("");
                                          setSwapMealError(null);
                                          return;
                                        }

                                        setActiveSwapMealId(meal.id);
                                        if (candidateDayPlans.length > 0) {
                                          const [firstCandidate] =
                                            candidateDayPlans;
                                          setSwapTargetDayPlanId(
                                            firstCandidate.dayPlan.id,
                                          );
                                          setSwapTargetMealId(
                                            firstCandidate.meals[0]?.id ?? "",
                                          );
                                        } else {
                                          setSwapTargetDayPlanId("");
                                          setSwapTargetMealId("");
                                        }
                                        setSwapMealError(null);
                                      }}
                                      disabled={isSwappingMeal || isMealBusy}
                                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-60"
                                    >
                                      <MdSwapHoriz className="w-3.5 h-3.5" />
                                      {activeSwapMealId === meal.id
                                        ? "Close swap"
                                        : "Swap meal"}
                                    </button>
                                  </div>
                                </div>

                                {expandedMealDetails[meal.id] && (
                                  <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-3">
                                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
                                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-2">
                                        Ingredients
                                      </p>
                                      {displayIngredients.length === 0 ? (
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                          No ingredient data.
                                        </p>
                                      ) : (
                                        <div className="space-y-2">
                                          <div className="grid grid-cols-[0.9fr_1.8fr_0.8fr] gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                            <span>Qty</span>
                                            <span>Item</span>
                                            <span>Price</span>
                                          </div>
                                          {displayIngredients.map(
                                            (ingredient) => (
                                              <div
                                                key={ingredient.id}
                                                className="grid grid-cols-[0.9fr_1.8fr_0.8fr] gap-3 text-xs text-slate-700 dark:text-slate-200"
                                              >
                                                <span>
                                                  {ingredient.measurement ||
                                                    "-"}
                                                </span>
                                                <span>
                                                  {ingredient.item_name || "-"}
                                                </span>
                                                <span>
                                                  {ingredient.price || "-"}
                                                </span>
                                              </div>
                                            ),
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
                                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-2">
                                        Cooking Instructions
                                      </p>
                                      {displayCookingInstructions.length > 0 ? (
                                        <ol className="space-y-1 text-xs text-slate-700 dark:text-slate-200 list-decimal list-inside">
                                          {displayCookingInstructions.map(
                                            (instruction, index) => (
                                              <li
                                                key={`${meal.id}-step-${index}`}
                                              >
                                                {instruction}
                                              </li>
                                            ),
                                          )}
                                        </ol>
                                      ) : (
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                          No instruction data.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-3 text-right">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Total Estimated Cost
                          </p>
                          <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                            {formatMoney(
                              activeDayPlan.meals.reduce(
                                (sum, meal) => sum + (meal.est_cost ?? 0),
                                0,
                              ),
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
      <Dialog
        visible={Boolean(mealRecordDialogState)}
        onDismiss={dismissMealRecordDialog}
        maxWidth={560}
      >
        {mealRecordDialogState?.mode === "prompt" ? (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
                Meal Check-in
              </p>
              <h3 className="mt-2 text-lg font-extrabold text-slate-900 dark:text-slate-100">
                Did you eat{" "}
                {mealRecordDialogState.meal?.meal_name || "this meal"}?
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                It&apos;s been 15 minutes since{" "}
                {mealRecordDialogState.meal?.best_time_to_eat ||
                  "your scheduled meal time"}
                . Log it now or add the details manually.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-900/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${getMealTimeBadgeClass(
                    mealRecordDialogState.meal?.meal_time,
                  )}`}
                >
                  {mealRecordDialogState.meal?.meal_time || "Meal"}
                </span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {mealRecordDialogState.meal?.best_time_to_eat ||
                    "Time not set"}
                </span>
              </div>
            </div>
            {mealRecordError && (
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                {mealRecordError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void handlePromptMealRecord("eaten");
                }}
                disabled={isSavingMealRecordDialog}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                <MdCheckCircle className="h-4 w-4" />
                {isSavingMealRecordDialog ? "Saving..." : "I ate it"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handlePromptMealRecord("skipped");
                }}
                disabled={isSavingMealRecordDialog}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/30 px-3 py-2 text-sm font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-60"
              >
                Skip meal
              </button>
              <button
                type="button"
                onClick={() =>
                  setMealRecordDialogState((prev) =>
                    prev
                      ? {
                          ...prev,
                          mode: "planned",
                        }
                      : prev,
                  )
                }
                disabled={isSavingMealRecordDialog}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-900/30 px-3 py-2 text-sm font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors disabled:opacity-60"
              >
                <MdAdd className="h-4 w-4" />
                Record manually
              </button>
              <button
                type="button"
                onClick={dismissMealRecordDialog}
                disabled={isSavingMealRecordDialog}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
              >
                Not now
              </button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveMealRecordDialog();
            }}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
                {mealRecordDialogState?.mode === "manual"
                  ? "Manual Meal Record"
                  : "Meal Record"}
              </p>
              <h3 className="mt-2 text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {mealRecordDialogState?.mode === "manual"
                  ? "Record a meal manually"
                  : `Record ${mealRecordDialogState?.meal?.meal_name || "this meal"}`}
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Save the actual meal result for today, including the status,
                timing, and any notes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Meal name
                </span>
                <input
                  type="text"
                  value={mealRecordDraft.mealName}
                  onChange={(event) =>
                    setMealRecordDraft((prev) => ({
                      ...prev,
                      mealName: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="Chicken rice bowl"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Meal time
                </span>
                <select
                  value={mealRecordDraft.mealTime}
                  onChange={(event) =>
                    setMealRecordDraft((prev) => ({
                      ...prev,
                      mealTime: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Status
                </span>
                <select
                  value={mealRecordDraft.status}
                  onChange={(event) =>
                    setMealRecordDraft((prev) => ({
                      ...prev,
                      status: event.target.value as MealRecordStatus,
                      completionPercent:
                        event.target.value === "partial" &&
                        !prev.completionPercent.trim()
                          ? "50"
                          : event.target.value === "eaten"
                            ? ""
                            : prev.completionPercent,
                    }))
                  }
                  className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="eaten">Eaten</option>
                  <option value="partial">Partial</option>
                  <option value="skipped">Skipped</option>
                  <option value="missed">Missed</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Source
                </span>
                <select
                  value={mealRecordDraft.source}
                  onChange={(event) =>
                    setMealRecordDraft((prev) => ({
                      ...prev,
                      source: event.target.value as MealRecordSource,
                    }))
                  }
                  className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="planned">Planned</option>
                  <option value="manual">Manual</option>
                  <option value="quick_add">Quick add</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Record date
                </span>
                <input
                  type="date"
                  value={mealRecordDraft.recordDate}
                  onChange={(event) =>
                    setMealRecordDraft((prev) => ({
                      ...prev,
                      recordDate: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Consumed at
                </span>
                <input
                  type="datetime-local"
                  value={mealRecordDraft.consumedAt}
                  onChange={(event) =>
                    setMealRecordDraft((prev) => ({
                      ...prev,
                      consumedAt: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Portion multiplier
                </span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={mealRecordDraft.portionMultiplier}
                  onChange={(event) =>
                    setMealRecordDraft((prev) => ({
                      ...prev,
                      portionMultiplier: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Completion %
                </span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={mealRecordDraft.completionPercent}
                  onChange={(event) =>
                    setMealRecordDraft((prev) => ({
                      ...prev,
                      completionPercent: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="50"
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Actual cost
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={mealRecordDraft.actualCost}
                  onChange={(event) =>
                    setMealRecordDraft((prev) => ({
                      ...prev,
                      actualCost: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="0.00"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50/80 dark:bg-sky-950/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-sky-900 dark:text-sky-100">
                    Water intake
                  </p>
                  <p className="mt-1 text-sm text-sky-700 dark:text-sky-300">
                    {selectedWaterGlasses.toFixed(
                      selectedWaterGlasses % 1 === 0 ? 0 : 1,
                    )}{" "}
                    / {DAILY_WATER_GLASS_GOAL} glasses
                  </p>
                </div>
                <p className="rounded-full bg-white/80 dark:bg-slate-900/70 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
                  {selectedWaterMl} ml
                </p>
              </div>
              <p className="mt-2 text-xs text-sky-700 dark:text-sky-300">
                Daily total after save:{" "}
                {projectedDailyWaterGlasses.toFixed(
                  projectedDailyWaterGlasses % 1 === 0 ? 0 : 1,
                )}{" "}
                glasses ({projectedDailyWaterMl} ml)
              </p>

              <input
                type="range"
                min="0"
                max={String(DAILY_WATER_GLASS_GOAL)}
                step="0.5"
                value={mealRecordDraft.waterGlasses}
                onChange={(event) =>
                  setMealRecordDraft((prev) => ({
                    ...prev,
                    waterGlasses: event.target.value,
                  }))
                }
                className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-sky-200 dark:bg-sky-900"
              />

              <div className="mt-4 grid grid-cols-8 gap-2">
                {Array.from({ length: DAILY_WATER_GLASS_GOAL }).map(
                  (_, index) => {
                    const glassFill = Math.max(
                      0,
                      Math.min(1, selectedWaterGlasses - index),
                    );

                    return (
                      <div
                        key={`water-glass-${index}`}
                        className="flex flex-col items-center gap-1"
                      >
                        <div className="relative h-14 w-full max-w-[34px] overflow-hidden rounded-b-xl rounded-t-md border border-sky-300 bg-white/90 dark:border-sky-700 dark:bg-slate-900/70">
                          <div
                            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-sky-500 to-cyan-300 transition-all duration-200"
                            style={{ height: `${glassFill * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                          {index + 1}
                        </span>
                      </div>
                    );
                  },
                )}
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-sky-700/80 dark:text-sky-300/80">
                <span>0</span>
                <span>Half-glass steps</span>
                <span>{DAILY_WATER_GLASS_GOAL}</span>
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Notes
              </span>
              <textarea
                value={mealRecordDraft.notes}
                onChange={(event) =>
                  setMealRecordDraft((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                className="min-h-28 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                placeholder="Felt full after half, swapped white rice for brown rice..."
              />
            </label>

            {mealRecordError && (
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                {mealRecordError}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isSavingMealRecordDialog}
                className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 transition-colors disabled:opacity-60"
              >
                <MdSave className="h-4 w-4" />
                {isSavingMealRecordDialog ? "Saving..." : "Save meal record"}
              </button>
              <button
                type="button"
                onClick={dismissMealRecordDialog}
                disabled={isSavingMealRecordDialog}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}

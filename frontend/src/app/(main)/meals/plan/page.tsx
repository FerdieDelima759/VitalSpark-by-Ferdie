"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MdChevronLeft,
  MdRestaurant,
  MdRefresh,
  MdSchedule,
} from "react-icons/md";
import { HiMoon, HiArrowRightOnRectangle } from "react-icons/hi2";
import { supabase } from "@/lib/api/supabase";
import type {
  UserMeal,
  UserMealIngredient,
  UserMealPlan,
  UserMealWeeklyDayPlan,
  UserMealWeeklyPlan,
} from "@/types/UserMeals";

type MealWithIngredients = UserMeal & {
  ingredients: UserMealIngredient[];
};

type DayPlanWithMeals = UserMealWeeklyDayPlan & {
  week_number: number | null;
  meals: MealWithIngredients[];
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

const formatHoursAway = (minutesAway: number): string => {
  const safeMinutes = Math.max(0, Math.ceil(minutesAway));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  const hourLabel = `hour${hours === 1 ? "" : "s"}`;
  const minLabel = `min${mins === 1 ? "" : "s"}`;
  return `${hours} ${hourLabel} ${mins} ${minLabel} away`;
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

export default function MealPlanDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("id");
  const workoutPlanId = searchParams.get("workoutPlanId");

  const [mealPlan, setMealPlan] = useState<UserMealPlan | null>(null);
  const [dayPlans, setDayPlans] = useState<DayPlanWithMeals[]>([]);
  const [activeDayPlanId, setActiveDayPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mealFilter, setMealFilter] = useState<
    "all" | "breakfast" | "lunch" | "dinner" | "snack"
  >("all");
  const [clockNow, setClockNow] = useState(() => Date.now());

  const backHref = workoutPlanId
    ? `/meals/workout/plan/${workoutPlanId}`
    : "/meals";

  const activeDayPlan = useMemo(() => {
    if (!activeDayPlanId) return null;
    return dayPlans.find((dayPlan) => dayPlan.id === activeDayPlanId) ?? null;
  }, [activeDayPlanId, dayPlans]);

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

  const loadMealPlanDetails = useCallback(async () => {
    if (!planId) return;

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const { data: planData, error: planError } = await supabase
        .from("user_meal_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError || !planData) {
        throw new Error(planError?.message || "Meal plan not found");
      }
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
            (mealA, mealB) => {
              const timeA = parseClockValue(mealA.best_time_to_eat);
              const timeB = parseClockValue(mealB.best_time_to_eat);
              if (timeA !== timeB) return timeA - timeB;

              const mealOrderA = MEAL_TIME_ORDER[mealA.meal_time || ""] ?? 99;
              const mealOrderB = MEAL_TIME_ORDER[mealB.meal_time || ""] ?? 99;
              if (mealOrderA !== mealOrderB) return mealOrderA - mealOrderB;

              return (mealA.meal_name || "").localeCompare(
                mealB.meal_name || "",
              );
            },
          );

          return {
            ...dayPlan,
            meals: mealsForDay,
          };
        },
      );

      setDayPlans(composedDayPlans);
      setActiveDayPlanId((prev) => {
        if (prev && composedDayPlans.some((dayPlan) => dayPlan.id === prev)) {
          return prev;
        }
        return composedDayPlans[0]?.id ?? null;
      });
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load meal plan details",
      );
      setMealPlan(null);
      setDayPlans([]);
      setActiveDayPlanId(null);
    } finally {
      setIsLoading(false);
    }
  }, [planId]);

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
    void loadMealPlanDetails();
  }, [loadMealPlanDetails, planId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!planId) {
    return null;
  }

  if (isLoading) {
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
                        mealPlan.image_alt || mealPlan.plan_name || "Meal plan"
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
                    {mealPlan?.plan_name || "Meal Plan"}
                  </h1>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/70 px-2.5 py-2">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Duration</p>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {mealPlan?.duration_dayss ?? 0} days
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/70 px-2.5 py-2">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Status</p>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {mealPlan?.completed ? "Completed" : "In Progress"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/70 px-2.5 py-2">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Days Saved</p>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {dayPlans.length}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/70 px-2.5 py-2">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Created</p>
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
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-[220px]">
                          <div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">Budget</p>
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
                          .map((meal) => (
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
                                    {meal.meal_name || "Unnamed Meal"}
                                  </h3>
                                </div>
                                <div className="text-right">
                                  <p className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                    <MdSchedule className="w-3.5 h-3.5" />
                                    {meal.best_time_to_eat || "Time not set"}
                                  </p>
                                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mt-1">
                                    Est. Cost: {formatMoney(meal.est_cost)}
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-3">
                                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
                                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-2">
                                    Ingredients
                                  </p>
                                  {meal.ingredients.length === 0 ? (
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
                                      {meal.ingredients.map((ingredient) => (
                                        <div
                                          key={ingredient.id}
                                          className="grid grid-cols-[0.9fr_1.8fr_0.8fr] gap-3 text-xs text-slate-700 dark:text-slate-200"
                                        >
                                          <span>
                                            {ingredient.measurement || "-"}
                                          </span>
                                          <span>
                                            {ingredient.item_name || "-"}
                                          </span>
                                          <span>{ingredient.price || "-"}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
                                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-2">
                                    Cooking Instructions
                                  </p>
                                  {Array.isArray(meal.cooking_instructions) &&
                                  meal.cooking_instructions.length > 0 ? (
                                    <ol className="space-y-1 text-xs text-slate-700 dark:text-slate-200 list-decimal list-inside">
                                      {meal.cooking_instructions.map(
                                        (instruction, index) => (
                                          <li key={`${meal.id}-step-${index}`}>
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
                            </div>
                          ))}

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
    </div>
  );
}

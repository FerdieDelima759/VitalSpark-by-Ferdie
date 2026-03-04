"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { supabase } from "../lib/api/supabase";
import type {
  UserMealPlan,
  UserWorkoutMealPlanLink,
  UserMealWeeklyPlan,
  UserMealWeeklyDayPlan,
  UserMealsDataResponse,
  UserMealsLoadingState,
} from "../types/UserMeals";
import type {
  MealPlanDayOutput,
  MealPlanOverviewOutput,
  MealPlanMeal,
} from "../lib/openai-prompt";

const USER_MEAL_PLANS_SESSION_KEY_PREFIX = "vitalspark:userMealPlans:";
const WORKOUT_MEAL_LINK_SESSION_KEY_PREFIX =
  "vitalspark:workoutMealLinks:v2:";

const canUseSessionStorage = () => typeof window !== "undefined";

const readSessionJson = <T,>(key: string): T | null => {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeSessionJson = (key: string, value: unknown) => {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / serialization issues
  }
};

const removeSessionKey = (key: string) => {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
};

const toTitleCaseLabel = (value: string): string => {
  return value
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((part) =>
          part.length > 0
            ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`
            : part,
        )
        .join("-"),
    )
    .join(" ");
};

// ===========================
// Context type
// ===========================

interface MealsContextType {
  userMealPlans: UserMealPlan[];
  loadingState: UserMealsLoadingState;

  refreshUserMealPlans: (userId: string) => Promise<void>;
  saveMealPlanWithWorkoutLink: (input: {
    userId: string;
    workoutPlanId?: string | null;
    dietaryPreference: string;
    durationDays: number;
    imagePath?: string | null;
    imageAlt?: string | null;
    mealPlanOverview: MealPlanOverviewOutput;
    mealPlanDayResults: Record<string, MealPlanDayOutput>;
  }) => Promise<UserMealsDataResponse<UserMealPlan>>;
  getLinkedMealPlansForWorkout: (
    workoutPlanId: string,
  ) => Promise<
    Array<{
      link: UserWorkoutMealPlanLink;
      mealPlan: UserMealPlan;
    }>
  >;
  getLinkedMealPlanForWorkout: (
    workoutPlanId: string,
  ) => Promise<{
    link: UserWorkoutMealPlanLink;
    mealPlan: UserMealPlan;
  } | null>;
  getMealPlanById: (mealPlanId: string) => UserMealPlan | undefined;
  fetchMealPlanById: (
    mealPlanId: string,
  ) => Promise<UserMealsDataResponse<UserMealPlan>>;
  fetchWeeklyPlansForMealPlan: (
    mealPlanId: string,
  ) => Promise<UserMealsDataResponse<UserMealWeeklyPlan[]>>;
  fetchDayPlansForWeekPlan: (
    weekPlanId: string,
  ) => Promise<UserMealsDataResponse<UserMealWeeklyDayPlan[]>>;
}

const MealsContext = createContext<MealsContextType | undefined>(undefined);

// ===========================
// Provider
// ===========================

interface MealsProviderProps {
  children: ReactNode;
}

export function MealsProvider({
  children,
}: MealsProviderProps): React.ReactElement {
  const [userMealPlans, setUserMealPlans] = useState<UserMealPlan[]>([]);
  const [loadingState, setLoadingState] = useState<UserMealsLoadingState>({
    isLoading: false,
    error: null,
  });

  const refreshUserMealPlans = useCallback(async (userId: string) => {
    if (!userId) return;
    const cacheKey = `${USER_MEAL_PLANS_SESSION_KEY_PREFIX}${userId}`;
    const cachedMealPlans = readSessionJson<UserMealPlan[]>(cacheKey);
    const hasCachedMealPlans = Array.isArray(cachedMealPlans);

    try {
      if (hasCachedMealPlans) {
        setUserMealPlans(cachedMealPlans ?? []);
        setLoadingState({ isLoading: false, error: null });
      } else {
        setLoadingState({ isLoading: true, error: null });
      }

      const { data, error } = await supabase
        .from("user_meal_plans")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const nextMealPlans = (data ?? []) as UserMealPlan[];
      setUserMealPlans(nextMealPlans);
      writeSessionJson(cacheKey, nextMealPlans);
      setLoadingState({ isLoading: false, error: null });
    } catch (err: unknown) {
      if (hasCachedMealPlans) {
        setLoadingState({ isLoading: false, error: null });
        return;
      }

      const message =
        err instanceof Error ? err.message : "Failed to fetch meal plans";
      setLoadingState({ isLoading: false, error: message });
      setUserMealPlans([]);
    }
  }, []);

  const getLinkedMealPlansForWorkout = useCallback(
    async (
      workoutPlanId: string,
    ): Promise<
      Array<{
        link: UserWorkoutMealPlanLink;
        mealPlan: UserMealPlan;
      }>
    > => {
      try {
        const linkCacheKey = `${WORKOUT_MEAL_LINK_SESSION_KEY_PREFIX}${workoutPlanId}`;
        const cachedLinkData = readSessionJson<
          | {
              link: UserWorkoutMealPlanLink;
              mealPlan: UserMealPlan;
            }
          | Array<{
              link: UserWorkoutMealPlanLink;
              mealPlan: UserMealPlan;
            }>
        >(linkCacheKey);
        if (Array.isArray(cachedLinkData)) {
          return cachedLinkData;
        }
        if (
          cachedLinkData?.mealPlan?.id &&
          cachedLinkData?.link?.meal_plan_id === cachedLinkData.mealPlan.id
        ) {
          return [cachedLinkData];
        }

        const { data: linkRows, error: linkError } = await supabase
          .from("user_workout_meal_plan_link")
          .select("meal_plan_id, workout_plan_id")
          .eq("workout_plan_id", workoutPlanId);

        if (linkError || !linkRows || linkRows.length === 0) {
          removeSessionKey(linkCacheKey);
          return [];
        }

        const mealPlanIds = Array.from(
          new Set(
            linkRows
              .map((row) => row.meal_plan_id)
              .filter((id): id is string => !!id),
          ),
        );

        if (mealPlanIds.length === 0) {
          removeSessionKey(linkCacheKey);
          return [];
        }

        const { data: plans, error: planError } = await supabase
          .from("user_meal_plans")
          .select("*")
          .in("id", mealPlanIds);

        if (planError || !plans || plans.length === 0) {
          removeSessionKey(linkCacheKey);
          return [];
        }

        const planById = new Map<string, UserMealPlan>(
          (plans as UserMealPlan[]).map((plan) => [plan.id, plan]),
        );
        const payload = linkRows
          .map((row) => {
            const mealPlan = planById.get(row.meal_plan_id);
            if (!mealPlan) return null;
            return {
              link: {
                meal_plan_id: row.meal_plan_id,
                workout_plan_id: row.workout_plan_id,
              },
              mealPlan,
            };
          })
          .filter(
            (
              item,
            ): item is {
              link: UserWorkoutMealPlanLink;
              mealPlan: UserMealPlan;
            } => item !== null,
          )
          .sort((a, b) =>
            (b.mealPlan.created_at ?? "").localeCompare(
              a.mealPlan.created_at ?? "",
            ),
          );

        writeSessionJson(linkCacheKey, payload);

        const firstUserId = payload[0]?.mealPlan.user_id;
        if (firstUserId) {
          const listCacheKey = `${USER_MEAL_PLANS_SESSION_KEY_PREFIX}${firstUserId}`;
          const cachedList = readSessionJson<UserMealPlan[]>(listCacheKey) ?? [];
          const merged = [...payload.map((item) => item.mealPlan), ...cachedList]
            .filter(
              (plan, index, arr) =>
                arr.findIndex((other) => other.id === plan.id) === index,
            )
            .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
          writeSessionJson(listCacheKey, merged);
        }

        setUserMealPlans((prev) => {
          const merged = [...payload.map((item) => item.mealPlan), ...prev]
            .filter(
              (plan, index, arr) =>
                arr.findIndex((other) => other.id === plan.id) === index,
            )
            .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
          return merged;
        });

        return payload;
      } catch {
        return [];
      }
    },
    [],
  );

  const getLinkedMealPlanForWorkout = useCallback(
    async (
      workoutPlanId: string,
    ): Promise<{
      link: UserWorkoutMealPlanLink;
      mealPlan: UserMealPlan;
    } | null> => {
      const linkedMealPlans = await getLinkedMealPlansForWorkout(workoutPlanId);
      return linkedMealPlans.length > 0 ? linkedMealPlans[0] : null;
    },
    [getLinkedMealPlansForWorkout],
  );

  const getMealPlanById = useCallback(
    (mealPlanId: string): UserMealPlan | undefined => {
      return userMealPlans.find((p) => p.id === mealPlanId);
    },
    [userMealPlans],
  );

  const fetchMealPlanById = useCallback(
    async (
      mealPlanId: string,
    ): Promise<UserMealsDataResponse<UserMealPlan>> => {
      try {
        const { data, error } = await supabase
          .from("user_meal_plans")
          .select("*")
          .eq("id", mealPlanId)
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data as UserMealPlan };
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to fetch meal plan";
        return { success: false, error: msg };
      }
    },
    [],
  );

  const fetchWeeklyPlansForMealPlan = useCallback(
    async (
      mealPlanId: string,
    ): Promise<UserMealsDataResponse<UserMealWeeklyPlan[]>> => {
      try {
        const { data, error } = await supabase
          .from("user_meal_weekly_plan")
          .select("*")
          .eq("plan_id", mealPlanId)
          .order("week_number", { ascending: true });

        if (error) return { success: false, error: error.message };
        return { success: true, data: (data ?? []) as UserMealWeeklyPlan[] };
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to fetch weekly plans";
        return { success: false, error: msg };
      }
    },
    [],
  );

  const fetchDayPlansForWeekPlan = useCallback(
    async (
      weekPlanId: string,
    ): Promise<UserMealsDataResponse<UserMealWeeklyDayPlan[]>> => {
      try {
        const { data, error } = await supabase
          .from("user_meal_weekly_day_plan")
          .select("*")
          .eq("week_plan_id", weekPlanId)
          .order("day_name");

        if (error) return { success: false, error: error.message };
        return { success: true, data: (data ?? []) as UserMealWeeklyDayPlan[] };
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to fetch day plans";
        return { success: false, error: msg };
      }
    },
    [],
  );

  const parseIntegerFromText = useCallback((value?: string | null): number | null => {
    if (!value) return null;
    const normalized = value.replace(/,/g, "");
    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Math.round(parseFloat(match[0]));
    return Number.isNaN(parsed) ? null : parsed;
  }, []);

  const parseFloatFromText = useCallback((value?: string | null): number | null => {
    if (!value) return null;
    const normalized = value.replace(/,/g, "");
    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = parseFloat(match[0]);
    return Number.isNaN(parsed) ? null : parsed;
  }, []);

  const formatDailyBudget = useCallback((value?: string | null): string | null => {
    const parsed = parseFloatFromText(value);
    if (parsed === null) return null;
    return `$${Math.round(parsed)}`;
  }, [parseFloatFromText]);

  const normalizeMealList = useCallback((day: MealPlanDayOutput): Array<{
    mealTime: "Breakfast" | "Lunch" | "Dinner" | "Snack";
    meal: MealPlanMeal;
  }> => {
    const meals = day.meals;
    if (!meals) return [];

    const list: Array<{
      mealTime: "Breakfast" | "Lunch" | "Dinner" | "Snack";
      meal: MealPlanMeal;
    }> = [];
    if (meals.breakfast) list.push({ mealTime: "Breakfast", meal: meals.breakfast });
    if (meals.lunch) list.push({ mealTime: "Lunch", meal: meals.lunch });
    if (meals.dinner) list.push({ mealTime: "Dinner", meal: meals.dinner });
    if (Array.isArray(meals.snacks)) {
      meals.snacks.forEach((snack) => list.push({ mealTime: "Snack", meal: snack }));
    }

    return list;
  }, []);

  const toMealNameFallback = useCallback((index: number): string => {
    return `Meal ${index + 1}`;
  }, []);

  const saveMealPlanWithWorkoutLink = useCallback(
    async ({
      userId,
      workoutPlanId,
      dietaryPreference,
      durationDays,
      imagePath,
      imageAlt,
      mealPlanOverview,
      mealPlanDayResults,
    }: {
      userId: string;
      workoutPlanId?: string | null;
      dietaryPreference: string;
      durationDays: number;
      imagePath?: string | null;
      imageAlt?: string | null;
      mealPlanOverview: MealPlanOverviewOutput;
      mealPlanDayResults: Record<string, MealPlanDayOutput>;
    }): Promise<UserMealsDataResponse<UserMealPlan>> => {
      try {
        let nextIndex = 1;
        if (workoutPlanId) {
          const { count, error: countError } = await supabase
            .from("user_workout_meal_plan_link")
            .select("*", { count: "exact", head: true })
            .eq("workout_plan_id", workoutPlanId);

          if (countError) throw countError;
          nextIndex = (count ?? 0) + 1;
        }

        const formattedDietaryPreference = toTitleCaseLabel(
          dietaryPreference || "Not Specified",
        );
        const planName = `Meal Plan #${nextIndex} (${formattedDietaryPreference})`;

        const { data: plan, error: planError } = await supabase
          .from("user_meal_plans")
          .insert({
            plan_name: planName,
            duration_dayss: durationDays,
            completed: false,
            image_path: imagePath ?? null,
            image_alt: imageAlt ?? null,
            user_id: userId,
          })
          .select("*")
          .single();

        if (planError || !plan) {
          return {
            success: false,
            error: planError?.message ?? "Failed to save meal plan",
          };
        }

        if (workoutPlanId) {
          const { error: linkError } = await supabase
            .from("user_workout_meal_plan_link")
            .insert({
              meal_plan_id: plan.id,
              workout_plan_id: workoutPlanId,
            });

          if (linkError) {
            return { success: false, error: linkError.message };
          }

          removeSessionKey(
            `${WORKOUT_MEAL_LINK_SESSION_KEY_PREFIX}${workoutPlanId}`,
          );
        }

        const { data: weeklyPlan, error: weeklyPlanError } = await supabase
          .from("user_meal_weekly_plan")
          .insert({
            plan_id: plan.id,
            week_number: 1,
            remaining_days: durationDays,
          })
          .select("id")
          .single();

        if (weeklyPlanError || !weeklyPlan?.id) {
          console.error("Meal save failed at user_meal_weekly_plan insert:", {
            weeklyPlanError,
            planId: plan.id,
          });
          return {
            success: false,
            error:
              weeklyPlanError?.message ??
              "Failed to save meal weekly plan (user_meal_weekly_plan)",
          };
        }

        const weekOrder = [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ];
        const dayResultByName = new Map<string, MealPlanDayOutput>(
          Object.entries(mealPlanDayResults).map(([key, value]) => [
            key.trim().toLowerCase(),
            value,
          ]),
        );

        const overviewDayEntries: Array<[string, { theme?: string } | undefined]> = mealPlanOverview.days
          ? Object.entries(mealPlanOverview.days).sort(
              ([dayA], [dayB]) =>
                weekOrder.indexOf(dayA.toLowerCase()) -
                weekOrder.indexOf(dayB.toLowerCase()),
            )
          : [];

        const sortedDayNames = (() => {
          const names = new Set<string>();
          overviewDayEntries.forEach(([dayName]) =>
            names.add(dayName.trim().toLowerCase()),
          );
          dayResultByName.forEach((dayResult, dayNameFromKey) => {
            names.add(
              (dayResult.day ?? dayNameFromKey ?? "").trim().toLowerCase(),
            );
          });

          return Array.from(names).filter(Boolean).sort((a, b) => {
            const aIndex = weekOrder.indexOf(a);
            const bIndex = weekOrder.indexOf(b);
            if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          });
        })();

        const dayThemeByName = new Map<string, string | null>(
          overviewDayEntries.map(([dayName, overviewDay]) => [
            dayName.trim().toLowerCase(),
            overviewDay?.theme ?? null,
          ]),
        );

        const dayPlanPayloads = sortedDayNames.map((normalizedDayName) => {
          const dayResult = dayResultByName.get(normalizedDayName);
          return {
            week_plan_id: weeklyPlan.id,
            day_name: normalizedDayName,
            day_theme:
              dayThemeByName.get(normalizedDayName) ?? dayResult?.meal_theme ?? null,
            daily_budget: formatDailyBudget(dayResult?.daily_budget),
            calorie_target: parseIntegerFromText(dayResult?.calorie_target),
            protein: parseIntegerFromText(dayResult?.macro_breakdown?.protein),
            carbs: parseIntegerFromText(dayResult?.macro_breakdown?.carbs),
            fats: parseIntegerFromText(dayResult?.macro_breakdown?.fats),
          };
        });

        let insertedDayPlans: Array<{ id: string; day_name: string | null }> = [];
        if (dayPlanPayloads.length > 0) {
          const { data: dayPlans, error: dayPlansError } = await supabase
            .from("user_meal_weekly_day_plan")
            .insert(dayPlanPayloads)
            .select("id, day_name");

          if (dayPlansError) {
            console.error("Meal save failed at user_meal_weekly_day_plan insert:", {
              dayPlansError,
              dayPlanPayloadCount: dayPlanPayloads.length,
            });
            return {
              success: false,
              error:
                dayPlansError.message ??
                "Failed to save meal day plans (user_meal_weekly_day_plan)",
            };
          }

          insertedDayPlans = (dayPlans ?? []) as Array<{
            id: string;
            day_name: string | null;
          }>;
        }

        const createUuid = () => {
          if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
          }
          // Fallback for browsers/environments without crypto.randomUUID
          return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
            const random = Math.floor(Math.random() * 16);
            const value = char === "x" ? random : (random & 0x3) | 0x8;
            return value.toString(16);
          });
        };

        const ingredientRows: Array<{
          id: string;
          item_name: string | null;
          measurement: string | null;
          price: string | null;
        }> = [];
        const mealRows: Array<{
          id: string;
          meal_name: string | null;
          best_time_to_eat: string | null;
          meal_day_plan_id: string;
          meal_time: string | null;
          est_cost: number | null;
          cooking_instructions: string[] | null;
        }> = [];
        const ingredientLinkRows: Array<{
          id: string;
          meal_id: string;
          ingredient_id: string;
        }> = [];

        for (const dayPlan of insertedDayPlans) {
          const dayKey = (dayPlan.day_name ?? "").toLowerCase();
          const dayResult = dayResultByName.get(dayKey);
          if (!dayResult) continue;

          const mealList = normalizeMealList(dayResult);
          mealList.forEach((mealRecord, mealIndex) => {
            const meal = mealRecord.meal;
            const mealName = meal.meal_name?.trim() || toMealNameFallback(mealIndex);
            const bestTimeToEat =
              meal.best_time_to_eat?.trim() || meal.best_time?.trim() || null;
            const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
            const estCost =
              parseFloatFromText(
                meal.estimated_cost ?? meal.estimated_meal_cost ?? null,
              ) ?? null;
            const cookingInstructions = Array.isArray(meal.cooking_instructions)
              ? meal.cooking_instructions
                  .map((step) => String(step).trim())
                  .filter((step) => step.length > 0)
              : null;
            const mealId = createUuid();

            mealRows.push({
              id: mealId,
              meal_name: mealName,
              best_time_to_eat: bestTimeToEat,
              meal_day_plan_id: dayPlan.id,
              meal_time: mealRecord.mealTime,
              est_cost: estCost,
              cooking_instructions:
                cookingInstructions && cookingInstructions.length > 0
                  ? cookingInstructions
                  : null,
            });

            ingredients.forEach((ingredient) => {
              const ingredientId = createUuid();
              ingredientRows.push({
                id: ingredientId,
                item_name:
                  ingredient.item?.trim() || ingredient.item_name?.trim() || null,
                measurement: ingredient.measurement?.trim() || null,
                price: ingredient.price?.trim() || null,
              });

              ingredientLinkRows.push({
                id: createUuid(),
                meal_id: mealId,
                ingredient_id: ingredientId,
              });
            });
          });
        }

        if (mealRows.length > 0) {
          const { error: mealsError } = await supabase
            .from("user_meals")
            .insert(mealRows);
          if (mealsError) {
            console.error("Meal save failed at user_meals insert:", {
              mealsError,
              mealRowCount: mealRows.length,
            });
            return {
              success: false,
              error: mealsError.message ?? "Failed to save meals (user_meals)",
            };
          }
        }

        if (ingredientRows.length > 0) {
          const { error: ingredientsError } = await supabase
            .from("user_meals_ingredients")
            .insert(ingredientRows);
          if (ingredientsError) {
            console.error("Meal save failed at user_meals_ingredients insert:", {
              ingredientsError,
              ingredientRowCount: ingredientRows.length,
            });
            return {
              success: false,
              error:
                ingredientsError.message ??
                "Failed to save meal ingredients (user_meals_ingredients)",
            };
          }
        }

        if (ingredientLinkRows.length > 0) {
          const { error: ingredientLinkError } = await supabase
            .from("user_meal_ingredients_link")
            .insert(ingredientLinkRows);
          if (ingredientLinkError) {
            console.error("Meal save failed at user_meal_ingredients_link insert:", {
              ingredientLinkError,
              ingredientLinkRowCount: ingredientLinkRows.length,
            });
            return {
              success: false,
              error:
                ingredientLinkError.message ??
                "Failed to save meal ingredient links (user_meal_ingredients_link)",
            };
          }
        }

        await refreshUserMealPlans(userId);
        return { success: true, data: plan as UserMealPlan };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to save meal plan";
        return { success: false, error: message };
      }
    },
    [
      normalizeMealList,
      parseFloatFromText,
      parseIntegerFromText,
      formatDailyBudget,
      refreshUserMealPlans,
      toMealNameFallback,
    ],
  );

  const value: MealsContextType = {
    userMealPlans,
    loadingState,
    refreshUserMealPlans,
    saveMealPlanWithWorkoutLink,
    getLinkedMealPlansForWorkout,
    getLinkedMealPlanForWorkout,
    getMealPlanById,
    fetchMealPlanById,
    fetchWeeklyPlansForMealPlan,
    fetchDayPlansForWeekPlan,
  };

  return (
    <MealsContext.Provider value={value}>{children}</MealsContext.Provider>
  );
}

// ===========================
// Hook
// ===========================

export function useMeals(): MealsContextType {
  const ctx = useContext(MealsContext);
  if (ctx === undefined) {
    throw new Error("useMeals must be used within a MealsProvider");
  }
  return ctx;
}

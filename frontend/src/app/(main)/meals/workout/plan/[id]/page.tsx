"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import {
  MdRestaurant,
  MdLink,
  MdChevronRight,
  MdCheck,
  MdArrowBack,
  MdRefresh,
  MdFitnessCenter,
} from "react-icons/md";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { useUserWorkoutData } from "@/hooks/useUserWorkoutData";
import { useMeals } from "@/contexts/MealsContext";
import type { UserProfile } from "@/types/UserProfile";
import type { UserMealPlan } from "@/types/UserMeals";
import type { UserWorkoutPlan } from "@/types/UserWorkout";
import {
  generateMealPlanOverviewWithPrompt,
  generateMealPlanDayWithPrompt,
  type MealPlanOverviewOutput,
  type MealPlanDayOutput,
} from "@/lib/openai-prompt";
import { generateAndUploadMealPlanImage } from "@/lib/meal-image";

const GENERATION_STEP_LABELS = [
  "Reading",
  "Analyzing",
  "Planning",
  "Meal Plan",
  "Finalizing",
] as const;

function getGenerationStageDurationMs(dayCount: number): number {
  if (dayCount <= 2) return 3000; // 5-7s
  if (dayCount === 3) return 4000;
  if (dayCount === 4) return 5000; // 8-12s
  if (dayCount === 5) return 6000;
  if (dayCount === 6) return 8000; // 13-20s
  return 9000; // 7+ days
}

interface WorkoutMealPlanPageProps {
  workoutPlanIdOverride?: string | null;
  dayGenerationConcurrency?: number;
  showBackToMealsButton?: boolean;
  showRefreshButton?: boolean;
}

export default function WorkoutMealPlanPage({
  workoutPlanIdOverride = null,
  dayGenerationConcurrency,
  showBackToMealsButton,
  showRefreshButton = false,
}: WorkoutMealPlanPageProps = {}) {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const routeWorkoutPlanId = params?.id ?? null;
  const workoutPlanId = workoutPlanIdOverride ?? routeWorkoutPlanId;
  const resolvedDayGenerationConcurrency =
    dayGenerationConcurrency ?? (routeWorkoutPlanId ? 2 : 1);
  const resolvedShowBackToMealsButton =
    showBackToMealsButton ?? Boolean(routeWorkoutPlanId);

  const { user } = useAuth();
  const { fetchUserProfile } = useUserData();
  const { fetchUserWorkoutPlans } = useUserWorkoutData();
  const {
    refreshUserMealPlans,
    saveMealPlanWithWorkoutLink,
    getLinkedMealPlansForWorkout,
  } = useMeals();

  // Profile: fetch and keep in local state (same pattern as personal page)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [linkedPlansForWorkout, setLinkedPlansForWorkout] = useState<
    UserMealPlan[]
  >([]);
  const [checkingLink, setCheckingLink] = useState(!!workoutPlanId);
  const [userWorkoutPlans, setUserWorkoutPlans] = useState<UserWorkoutPlan[]>(
    [],
  );
  const [isLoadingWorkoutPlans, setIsLoadingWorkoutPlans] = useState(false);
  const [isRefreshingDashboard, setIsRefreshingDashboard] = useState(false);

  // Generated meal plan (no DB save - display only)
  const [mealPlanOverview, setMealPlanOverview] =
    useState<MealPlanOverviewOutput | null>(null);
  const [mealPlanDayResults, setMealPlanDayResults] = useState<
    Record<string, MealPlanDayOutput>
  >({});
  const [isGeneratingOverview, setIsGeneratingOverview] = useState(false);
  const [isGeneratingDays, setIsGeneratingDays] = useState(false);
  const [generatingDayKeys, setGeneratingDayKeys] = useState<string[]>([]);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [showGenerationDialog, setShowGenerationDialog] = useState(false);
  const [, setGenerationStepIndex] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [displayedGenerationProgress, setDisplayedGenerationProgress] =
    useState(0);
  const [generationFinished, setGenerationFinished] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(
    null,
  );
  const [estimatedGenerationDayCount, setEstimatedGenerationDayCount] =
    useState(7);
  const [prioritizeMealPlans, setPrioritizeMealPlans] = useState(false);
  const allowBeforeUnloadRef = useRef(false);
  const mealPlanImageRef = useRef<{
    url: string;
    label: string | null;
  } | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [showAllergyDialog, setShowAllergyDialog] = useState(false);
  const [allergyInput, setAllergyInput] = useState("");
  const [userAllergies, setUserAllergies] = useState<string | null>(null);
  const myWorkoutPlansCacheKey = user?.id
    ? `my_workout_plans_cache_${user.id}`
    : null;

  useEffect(() => {
    if (user?.id) {
      loadUserProfile();
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUserProfile = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingProfile(true);
    try {
      const result = await fetchUserProfile(user.id);
      if (result.success && result.data) {
        setUserProfile(result.data);
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [user?.id, fetchUserProfile]);

  useEffect(() => {
    if (activeDay || !mealPlanOverview?.days) return;
    const [firstDay] = Object.keys(mealPlanOverview.days);
    if (firstDay) setActiveDay(firstDay);
  }, [activeDay, mealPlanOverview]);

  useEffect(() => {
    if (!showGenerationDialog) {
      setGenerationStepIndex(0);
      setGenerationProgress(0);
      setDisplayedGenerationProgress(0);
      setGenerationFinished(false);
      setGenerationStartedAt(null);
      return;
    }

    setGenerationStartedAt(Date.now());
  }, [showGenerationDialog]);

  useEffect(() => {
    if (!showGenerationDialog) return;
    const tickMs = 100;
    const maxDurationMs = 100_000;
    const stageDurationMs = getGenerationStageDurationMs(
      estimatedGenerationDayCount,
    );
    const baseIncrementPerTick = (20 * tickMs) / stageDurationMs;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setDisplayedGenerationProgress((prev) => {
        const target = Math.max(0, Math.min(100, generationProgress));
        if (prev >= target) return prev;

        const elapsed = generationStartedAt ? now - generationStartedAt : 0;
        const remainingMs = Math.max(1, maxDurationMs - elapsed);
        const remainingToTarget = target - prev;
        const minNeededIncrement =
          remainingToTarget / Math.max(1, remainingMs / tickMs);
        const increment = Math.max(baseIncrementPerTick, minNeededIncrement);
        return Math.min(target, prev + increment);
      });
    }, tickMs);

    return () => clearInterval(interval);
  }, [
    estimatedGenerationDayCount,
    generationProgress,
    generationStartedAt,
    showGenerationDialog,
  ]);

  useEffect(() => {
    if (!showGenerationDialog || !generationFinished) return;
    if (displayedGenerationProgress < 99.5) return;
    const timeout = window.setTimeout(() => {
      setShowGenerationDialog(false);
    }, 450);
    return () => clearTimeout(timeout);
  }, [displayedGenerationProgress, generationFinished, showGenerationDialog]);

  // Build prompt variables from profile (same pattern as personal page: field || "not specified")
  const getMealPlanVariables = useCallback(
    (allergiesOverride?: string) => {
      if (!userProfile) {
        return {
          gender: "not specified",
          goal: "not specified",
          fitness_goal: "not specified",
          dietary_preference: "not specified",
          weekly_budget: "not specified",
          weekly_duration: "7 days",
          allergies: allergiesOverride ?? "none",
        };
      }
      const fitnessGoal = userProfile.fitness_goal || "not specified";
      const weeklyBudgetValue =
        userProfile.weekly_budget != null
          ? String(userProfile.weekly_budget)
          : "not specified";
      const weeklyBudgetCurrency = userProfile.weekly_budget_currency?.trim();
      const formattedWeeklyBudget =
        weeklyBudgetValue !== "not specified" && weeklyBudgetCurrency
          ? `${weeklyBudgetValue} ${weeklyBudgetCurrency}`
          : weeklyBudgetValue;
      const fallbackAllergies = userProfile.health_conditions?.length
        ? userProfile.health_conditions.join(", ")
        : "none";
      const normalizedMealPlanDays =
        userProfile.meal_plan_duration?.map((day) => day.toLowerCase()) ?? [];
      const weekOrder = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ];
      const orderedMealPlanDays = normalizedMealPlanDays
        .filter((day) => weekOrder.includes(day))
        .sort((a, b) => weekOrder.indexOf(a) - weekOrder.indexOf(b));
      const formattedWeeklyDuration =
        orderedMealPlanDays.length > 0
          ? orderedMealPlanDays.join(", ")
          : "7 days";
      return {
        gender: userProfile.gender || "not specified",
        goal: fitnessGoal,
        fitness_goal: fitnessGoal,
        dietary_preference: userProfile.dietary_preference || "not specified",
        weekly_budget: formattedWeeklyBudget,
        weekly_duration: formattedWeeklyDuration,
        allergies: allergiesOverride ?? userAllergies ?? fallbackAllergies,
      };
    },
    [userAllergies, userProfile],
  );

  const handleGenerateOverview = useCallback(
    async (allergiesOverride?: string) => {
      if (!userProfile) {
        console.error(" User profile not available");
        setGenerateError(
          "Please complete your profile before generating a meal plan.",
        );
        setShowGenerationDialog(false);
        return;
      }
      // Prepare user data for prompts (same pattern as personal page)
      const userData = getMealPlanVariables(allergiesOverride);
      setGenerationStepIndex(1); // Analyzing
      setGenerationProgress(20);
      setGenerationFinished(false);
      console.log("' User Data for Prompts:", userData);
      setGenerateError(null);
      setSaveError(null);
      setSaveSuccess(null);
      setPrioritizeMealPlans(false);
      mealPlanImageRef.current = null;
      setIsGeneratingOverview(true);
      setMealPlanOverview(null);
      setMealPlanDayResults({});
      setIsGeneratingDays(false);
      try {
        const result = await generateMealPlanOverviewWithPrompt(userData);
        if (result.success && result.response) {
          setGenerationStepIndex(2); // Planning
          setGenerationProgress((prev) => Math.max(prev, 40));
          setMealPlanOverview(result.response);
          void generateAndUploadMealPlanImage(userData.dietary_preference)
            .then((imageResult) => {
              if (imageResult.success && imageResult.url) {
                // TODO: persist image URL later if/when saving generated plans.
                mealPlanImageRef.current = {
                  url: imageResult.url,
                  label: imageResult.food ?? "Meal plan image",
                };
              } else if (imageResult.error) {
                console.warn(
                  "Meal plan image generation failed:",
                  imageResult.error,
                );
              }
            })
            .catch((err: unknown) => {
              console.warn(
                "Meal plan image generation failed:",
                err instanceof Error
                  ? err.message
                  : "Failed to generate meal image",
              );
            });
          const days = result.response.days;
          const weekOrder = [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
          ];
          const dayEntries = days
            ? Object.entries(days).sort(
                ([dayA], [dayB]) =>
                  weekOrder.indexOf(dayA.toLowerCase()) -
                  weekOrder.indexOf(dayB.toLowerCase()),
              )
            : [];
          if (dayEntries.length > 0) {
            setEstimatedGenerationDayCount(dayEntries.length);
          }
          if (dayEntries.length > 0) {
            setGenerationStepIndex(3); // Meal Plan
            setGenerationProgress((prev) => Math.max(prev, 60));
            setIsGeneratingDays(true);
            setGeneratingDayKeys([]);
            let firstGenerated: string | null = null;
            let completedDays = 0;
            const concurrency = Math.max(
              1,
              Math.min(resolvedDayGenerationConcurrency, dayEntries.length),
            );
            let cursor = 0;

            const workers = Array.from({ length: concurrency }, () =>
              (async () => {
                while (true) {
                  const currentIndex = cursor;
                  cursor += 1;
                  if (currentIndex >= dayEntries.length) break;

                  const [dayName, dayData] = dayEntries[currentIndex];
                  const theme = dayData?.theme ?? "";
                  const normalizedDayName = dayName.toLowerCase();

                  setGeneratingDayKeys((prev) => [...prev, dayName]);
                  try {
                    const dayResult = await generateMealPlanDayWithPrompt({
                      ...userData,
                      day_name: normalizedDayName,
                      day_theme: theme,
                    });
                    if (dayResult.success && dayResult.response) {
                      setMealPlanDayResults((prev) => ({
                        ...prev,
                        [dayName]: dayResult.response!,
                      }));
                      if (firstGenerated === null) firstGenerated = dayName;
                    }
                  } catch {
                    // continue with other days
                  } finally {
                    completedDays += 1;
                    const mealPlanProgress =
                      60 + Math.round((completedDays / dayEntries.length) * 20);
                    setGenerationProgress((prev) =>
                      Math.max(prev, mealPlanProgress),
                    );
                    setGeneratingDayKeys((prev) =>
                      prev.filter((key) => key !== dayName),
                    );
                  }
                }
              })(),
            );

            try {
              await Promise.all(workers);
            } finally {
              setGenerationProgress((prev) => Math.max(prev, 80));
              setGeneratingDayKeys([]);
              setIsGeneratingDays(false);
              if (!activeDay && firstGenerated) setActiveDay(firstGenerated);
            }
          } else {
            setGenerationProgress((prev) => Math.max(prev, 80));
          }
        } else {
          setGenerateError(result.error ?? "Failed to generate meal plan");
        }
      } catch (e) {
        setGenerateError(
          e instanceof Error ? e.message : "Something went wrong",
        );
      } finally {
        setIsGeneratingOverview(false);
        setGenerationStepIndex(GENERATION_STEP_LABELS.length - 1);
        setGenerationProgress(100);
        setGenerationFinished(true);
      }
    },
    [
      activeDay,
      resolvedDayGenerationConcurrency,
      getMealPlanVariables,
      userProfile,
    ],
  );

  const handleGenerateDay = useCallback(
    async (dayName: string, dayTheme: string) => {
      setGenerateError(null);
      setGeneratingDayKeys((prev) => [...prev, dayName]);
      try {
        const result = await generateMealPlanDayWithPrompt({
          ...getMealPlanVariables(),
          day_name: dayName,
          day_theme: dayTheme,
        });
        if (result.success && result.response) {
          setMealPlanDayResults((prev) => ({
            ...prev,
            [dayName]: result.response!,
          }));
        } else {
          setGenerateError(
            result.error ?? `Failed to generate meals for ${dayName}`,
          );
        }
      } catch (e) {
        setGenerateError(
          e instanceof Error ? e.message : "Something went wrong",
        );
      } finally {
        setGeneratingDayKeys((prev) => prev.filter((key) => key !== dayName));
      }
    },
    [getMealPlanVariables],
  );

  const handleSavePlan = useCallback(async () => {
    if (!user?.id || !mealPlanOverview) return;
    const expectedDayCount = mealPlanOverview.days
      ? Object.keys(mealPlanOverview.days).length
      : 0;
    const generatedDayCount = Object.keys(mealPlanDayResults).length;
    const hasAllGeneratedDays =
      expectedDayCount > 0 && generatedDayCount >= expectedDayCount;

    if (!hasAllGeneratedDays || isGeneratingDays) {
      setSaveError("Generate all day meals first before saving the meal plan.");
      return;
    }

    setSaveError(null);
    setSaveSuccess(null);
    setIsSavingPlan(true);
    const dietaryPreference =
      userProfile?.dietary_preference?.trim() || "not specified";
    const durationDays = mealPlanOverview.days
      ? Object.keys(mealPlanOverview.days).length
      : 0;
    const imagePath = mealPlanImageRef.current?.url ?? null;
    const imageAlt = mealPlanImageRef.current?.label ?? null;
    const result = await saveMealPlanWithWorkoutLink({
      userId: user.id,
      workoutPlanId,
      dietaryPreference,
      durationDays,
      imagePath,
      imageAlt,
      mealPlanOverview,
      mealPlanDayResults,
    });
    if (result.success) {
      setSaveSuccess("Meal plan saved.");
      setMealPlanOverview(null);
      setMealPlanDayResults({});
      setActiveDay(null);
      setGeneratingDayKeys([]);
      setPrioritizeMealPlans(true);
      allowBeforeUnloadRef.current = true;
      window.setTimeout(() => {
        window.location.reload();
      }, 250);
    } else {
      setSaveError(result.error ?? "Failed to save meal plan");
    }
    setIsSavingPlan(false);
  }, [
    mealPlanOverview,
    mealPlanDayResults,
    mealPlanImageRef,
    isGeneratingDays,
    saveMealPlanWithWorkoutLink,
    user?.id,
    userProfile?.dietary_preference,
    workoutPlanId,
  ]);

  const openAllergyDialog = useCallback(() => {
    const fallbackAllergies = userProfile?.health_conditions?.length
      ? userProfile.health_conditions.join(", ")
      : "";
    setAllergyInput(userAllergies ?? fallbackAllergies);
    setShowAllergyDialog(true);
  }, [userAllergies, userProfile]);

  const handleAllergySubmit = useCallback(() => {
    const normalized = allergyInput.trim() || "none";
    allowBeforeUnloadRef.current = false;
    setUserAllergies(normalized);
    setShowAllergyDialog(false);
    setGenerationStepIndex(0);
    setGenerationProgress(0);
    setDisplayedGenerationProgress(0);
    setGenerationFinished(false);
    const selectedDayCount = userProfile?.meal_plan_duration?.length ?? 0;
    setEstimatedGenerationDayCount(selectedDayCount > 0 ? selectedDayCount : 7);
    setShowGenerationDialog(true);
    void handleGenerateOverview(normalized);
  }, [allergyInput, handleGenerateOverview, userProfile?.meal_plan_duration]);

  const toTitleCase = useCallback((value: string) => {
    return value
      .trim()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }, []);

  const parseMealTime = useCallback((value?: string) => {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const trimmed = value.trim();
    const twelveMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (twelveMatch) {
      let hour = parseInt(twelveMatch[1], 10);
      const minute = parseInt(twelveMatch[2] || "0", 10);
      const period = twelveMatch[3].toLowerCase();
      if (period === "pm" && hour !== 12) hour += 12;
      if (period === "am" && hour === 12) hour = 0;
      const minutes = hour * 60 + minute;
      return minutes < 360 ? minutes + 1440 : minutes;
    }
    const twentyFourMatch = trimmed.match(/^([01]?\d|2[0-3])(?::([0-5]\d))?$/);
    if (twentyFourMatch) {
      const hour = parseInt(twentyFourMatch[1], 10);
      const minute = parseInt(twentyFourMatch[2] || "0", 10);
      const minutes = hour * 60 + minute;
      return minutes < 360 ? minutes + 1440 : minutes;
    }
    return Number.MAX_SAFE_INTEGER;
  }, []);

  const formatMealTime = useCallback((value?: string) => {
    if (!value) return "";
    const trimmed = value.trim();
    const twelveMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (twelveMatch) {
      const hourRaw = parseInt(twelveMatch[1], 10);
      const hour = hourRaw === 0 ? 12 : hourRaw;
      const minute = (twelveMatch[2] || "00").padStart(2, "0");
      return `${hour}:${minute} ${twelveMatch[3].toUpperCase()}`;
    }
    const twentyFourMatch = trimmed.match(/^([01]?\d|2[0-3])(?::([0-5]\d))?$/);
    if (twentyFourMatch) {
      const hour24 = parseInt(twentyFourMatch[1], 10);
      const minute = (twentyFourMatch[2] || "00").padStart(2, "0");
      const period = hour24 >= 12 ? "PM" : "AM";
      const hour12 = hour24 % 12 || 12;
      return `${hour12}:${minute} ${period}`;
    }
    return trimmed;
  }, []);

  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>(
    {},
  );

  const renderMealCard = useCallback(
    (title: string, meal: unknown, index?: number) => {
      if (!meal) return null;
      const mealRecord =
        typeof meal === "object" ? (meal as Record<string, unknown>) : null;
      const mealName =
        (mealRecord?.meal_name as string) ||
        (mealRecord?.name as string) ||
        (mealRecord?.title as string) ||
        (typeof meal === "string" ? meal : null) ||
        (index != null ? `${title} ${index + 1}` : title);
      const bestTime =
        (mealRecord?.best_time_to_eat as string) ||
        (mealRecord?.best_time as string) ||
        "";
      const formattedBestTime = bestTime
        ? formatMealTime(bestTime)
        : "Time not specified";
      const ingredients =
        (mealRecord?.ingredients as unknown[]) ||
        (mealRecord?.items as unknown[]) ||
        [];
      const instructions =
        (mealRecord?.cooking_instructions as unknown[]) || [];
      const mealKey = `${title}-${mealName}-${index ?? 0}`;
      const isExpanded = !!expandedMeals[mealKey];
      const hasIngredients =
        Array.isArray(ingredients) && ingredients.length > 0;
      const hasInstructions =
        Array.isArray(instructions) && instructions.length > 0;
      const hasFullDetails = hasIngredients || hasInstructions;

      return (
        <div className="rounded-xl border border-slate-200 dark:border-teal-600 bg-white dark:bg-teal-500/80 px-3 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {title}
            </p>
            <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
              {formattedBestTime}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2 mb-3">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {mealName}
            </p>
          </div>
          {hasFullDetails && (
            <button
              type="button"
              onClick={() =>
                setExpandedMeals((prev) => ({
                  ...prev,
                  [mealKey]: !prev[mealKey],
                }))
              }
              className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors mb-3"
            >
              {isExpanded ? "Hide Full details" : "View Full details"}
            </button>
          )}
          {isExpanded && (
            <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400 mb-2">
                  Ingredients
                </p>
                {hasIngredients ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[0.8fr_1.6fr_0.6fr] gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <span>Qty</span>
                      <span>Item name</span>
                      <span>Price</span>
                    </div>
                    {ingredients.map((ingredient, ingredientIndex) => {
                      if (typeof ingredient === "string") {
                        return (
                          <div
                            key={`${mealName}-ingredient-${ingredientIndex}`}
                            className="grid grid-cols-[0.8fr_1.6fr_0.6fr] gap-4 text-sm text-slate-700 dark:text-slate-300"
                          >
                            <span className="text-slate-500 dark:text-slate-400">
                              -
                            </span>
                            <span>{ingredient}</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              -
                            </span>
                          </div>
                        );
                      }
                      const ingredientRecord = ingredient as Record<
                        string,
                        unknown
                      >;
                      return (
                        <div
                          key={`${mealName}-ingredient-${ingredientIndex}`}
                          className="grid grid-cols-[0.8fr_1.6fr_0.6fr] gap-4 text-sm text-slate-700 dark:text-slate-300"
                        >
                          <span className="text-slate-600 dark:text-slate-400">
                            {(ingredientRecord.measurement as string) || "-"}
                          </span>
                          <span>
                            {(() => {
                              const rawItem =
                                (ingredientRecord.item_name as string) ||
                                (ingredientRecord.item as string) ||
                                (ingredientRecord.name as string) ||
                                "";
                              return rawItem ? toTitleCase(rawItem) : "-";
                            })()}
                          </span>
                          <span className="text-slate-600 dark:text-slate-400">
                            {(ingredientRecord.price as string) || "-"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No ingredient details provided.
                  </p>
                )}
              </div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400 mb-2">
                  Cooking Instructions
                </p>
                {hasInstructions ? (
                  <ol className="space-y-1 text-xs text-slate-600 dark:text-slate-300 list-decimal list-inside">
                    {instructions.map((step, stepIndex) => (
                      <li key={`${mealKey}-step-${stepIndex}`}>{String(step)}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No cooking instructions provided.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      );
    },
    [expandedMeals, formatMealTime, toTitleCase],
  );

  useEffect(() => {
    if (!user?.id) return;
    refreshUserMealPlans(user.id);
  }, [user?.id, refreshUserMealPlans]);

  const readWorkoutPlansCache = useCallback((): UserWorkoutPlan[] | null => {
    if (typeof window === "undefined" || !myWorkoutPlansCacheKey) return null;
    try {
      const raw = localStorage.getItem(myWorkoutPlansCacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        data?: UserWorkoutPlan[];
        timestamp?: number;
      };
      if (!Array.isArray(parsed.data)) return null;
      const cacheAge = Date.now() - (parsed.timestamp ?? 0);
      const cacheDurationMs = 15 * 60 * 1000;
      if (cacheAge >= cacheDurationMs) return null;
      return parsed.data;
    } catch (error) {
      console.warn("Error reading my workout plans cache:", error);
      return null;
    }
  }, [myWorkoutPlansCacheKey]);

  const writeWorkoutPlansCache = useCallback(
    (plans: UserWorkoutPlan[]) => {
      if (typeof window === "undefined" || !myWorkoutPlansCacheKey) return;
      try {
        localStorage.setItem(
          myWorkoutPlansCacheKey,
          JSON.stringify({
            data: plans,
            timestamp: Date.now(),
          }),
        );
      } catch (error) {
        console.warn("Error caching my workout plans:", error);
      }
    },
    [myWorkoutPlansCacheKey],
  );

  const loadWorkoutPlans = useCallback(
    async (options?: { forceRefresh?: boolean }) => {
      if (!user?.id || workoutPlanId) {
        setUserWorkoutPlans([]);
        setIsLoadingWorkoutPlans(false);
        return;
      }

      const forceRefresh = options?.forceRefresh ?? false;
      if (!forceRefresh) {
        const cachedPlans = readWorkoutPlansCache();
        if (cachedPlans && cachedPlans.length > 0) {
          setUserWorkoutPlans(cachedPlans);
          setIsLoadingWorkoutPlans(false);
        } else if (cachedPlans && cachedPlans.length === 0) {
          setUserWorkoutPlans([]);
          setIsLoadingWorkoutPlans(false);
        } else {
          setIsLoadingWorkoutPlans(true);
        }
      } else {
        setIsLoadingWorkoutPlans(true);
      }

      const result = await fetchUserWorkoutPlans(user.id);
      if (result.success && result.data) {
        setUserWorkoutPlans(result.data);
        writeWorkoutPlansCache(result.data);
      } else if (!forceRefresh) {
        setUserWorkoutPlans((prev) => prev);
      }
      setIsLoadingWorkoutPlans(false);
    },
    [
      fetchUserWorkoutPlans,
      readWorkoutPlansCache,
      user?.id,
      workoutPlanId,
      writeWorkoutPlansCache,
    ],
  );

  const handleRefreshDashboard = useCallback(async () => {
    if (!user?.id) return;
    setIsRefreshingDashboard(true);
    await Promise.all([
      refreshUserMealPlans(user.id),
      loadWorkoutPlans({ forceRefresh: true }),
    ]);
    setIsRefreshingDashboard(false);
  }, [loadWorkoutPlans, refreshUserMealPlans, user?.id]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.id || workoutPlanId) {
        setUserWorkoutPlans([]);
        setIsLoadingWorkoutPlans(false);
        return;
      }
      if (!cancelled) {
        await loadWorkoutPlans();
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [loadWorkoutPlans, user?.id, workoutPlanId]);

  useEffect(() => {
    if (!workoutPlanId) {
      setCheckingLink(false);
      setLinkedPlansForWorkout([]);
      return;
    }
    let cancelled = false;
    setCheckingLink(true);
    getLinkedMealPlansForWorkout(workoutPlanId).then((result) => {
      if (cancelled) return;
      setLinkedPlansForWorkout(result.map((item) => item.mealPlan));
      setCheckingLink(false);
    });
    return () => {
      cancelled = true;
    };
  }, [workoutPlanId, getLinkedMealPlansForWorkout]);

  const showWorkoutContext = !!workoutPlanId;
  const hasUnsavedGeneratedPlan =
    isGeneratingOverview || isGeneratingDays || !!mealPlanOverview;
  const hasGeneratedPreview = !!mealPlanOverview;
  const showMealPlansFirst = prioritizeMealPlans && !hasGeneratedPreview;
  const generateCtaLabel = isLoadingProfile
    ? "Loading profile..."
    : !userProfile
      ? "Complete profile first"
      : "Generate now";
  const generateAnotherCtaLabel = isLoadingProfile
    ? "Loading profile..."
    : !userProfile
      ? "Complete profile first"
      : "Generate Another";
  const workoutCardOrderClass = showMealPlansFirst
    ? "order-3"
    : hasGeneratedPreview
      ? "order-2"
      : "order-1";
  const standAloneCardOrderClass = showMealPlansFirst ? "order-2" : "order-1";
  const previewOrderClass = showWorkoutContext ? "order-1" : "order-2";
  const generateMealPlanCard = ({
    compact = false,
    ctaLabelOverride,
    extraClassName = "",
  }: {
    compact?: boolean;
    ctaLabelOverride?: string;
    extraClassName?: string;
  } = {}) => (
    <div
      className={`relative overflow-hidden rounded-2xl border border-teal-100 dark:border-teal-800 bg-gradient-to-br from-teal-50 via-emerald-50 to-white dark:from-teal-900/25 dark:via-emerald-900/20 dark:to-slate-900 ${extraClassName}`}
    >
      <div className="pointer-events-none absolute -top-14 -right-14 h-36 w-36 rounded-full bg-teal-300/25 dark:bg-teal-300/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-12 h-32 w-32 rounded-full bg-emerald-300/20 dark:bg-emerald-300/10 blur-2xl" />
      <div className="relative p-4 sm:p-5">
        {!compact && (
          <>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 dark:border-teal-700 bg-white/80 dark:bg-slate-800/70 px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300">
              <MdRestaurant className="h-3.5 w-3.5" />
              Generate meal plan
            </div>
            <h3 className="mt-3 text-lg font-extrabold text-slate-800 dark:text-slate-100">
              Personalized Meal Plan
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Build a nutrition plan tailored to this workout, your profile, and
              your goals.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-teal-100 dark:border-teal-800 bg-white/85 dark:bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                <div className="mb-1 inline-flex items-center gap-1 text-teal-700 dark:text-teal-300">
                  <MdFitnessCenter className="h-3.5 w-3.5" />
                  Workout-based
                </div>

                <div>
                  Calorie and meal structure that matches your training load.
                </div>
              </div>
              <div className="rounded-xl border border-teal-100 dark:border-teal-800 bg-white/85 dark:bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                <div className="mb-1 inline-flex items-center gap-1 text-teal-700 dark:text-teal-300">
                  <MdCheck className="h-3.5 w-3.5" />
                  Profile-aware
                </div>
                <div>
                  Respects your diet preferences, restrictions, and budget goals.
                </div>
              </div>
              <div className="rounded-xl border border-teal-100 dark:border-teal-800 bg-white/85 dark:bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                <div className="mb-1 inline-flex items-center gap-1 text-teal-700 dark:text-teal-300">
                  <MdRestaurant className="h-3.5 w-3.5" />
                  Day-by-day
                </div>
                <div>Generates meals for each day with clear macro targets.</div>
              </div>
            </div>
          </>
        )}
        <button
          type="button"
          disabled={
            isLoadingProfile ||
            isGeneratingOverview ||
            isGeneratingDays ||
            !userProfile
          }
          onClick={openAllergyDialog}
          className={`${compact ? "" : "mt-4"} w-full py-3 rounded-xl bg-teal-600 dark:bg-teal-500 text-white font-semibold hover:bg-teal-700 dark:hover:bg-teal-400 disabled:opacity-60 transition-colors`}
        >
          {ctaLabelOverride ?? generateCtaLabel}
        </button>
        {!userProfile && !isLoadingProfile && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Open Personal to complete your profile (diet, budget, etc.).
          </p>
        )}
      </div>
    </div>
  );

  useEffect(() => {
    if (!hasUnsavedGeneratedPlan) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowBeforeUnloadRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedGeneratedPlan]);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-transparent pb-6">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#ccfbf1] dark:bg-teal-900/50 flex items-center justify-center">
              <MdRestaurant className="w-6 h-6 text-[#0f766e] dark:text-teal-300" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                Meals
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Your meal plans and nutrition
              </p>
            </div>
          </div>
          {workoutPlanId && (
            <div className="shrink-0 flex items-center gap-2">
              {resolvedShowBackToMealsButton && (
                <button
                  type="button"
                  onClick={() => router.push("/meals")}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5"
                >
                  <MdArrowBack className="w-4 h-4" />
                  Meals
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  router.push(`/personal/workout/details?id=${workoutPlanId}`)
                }
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5"
              >
                <MdFitnessCenter className="w-4 h-4" />
                Workout
              </button>
            </div>
          )}
          {!workoutPlanId && showRefreshButton && (
            <button
              type="button"
              onClick={handleRefreshDashboard}
              disabled={isRefreshingDashboard}
              className="shrink-0 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              <MdRefresh
                className={`w-4 h-4 ${isRefreshingDashboard ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          )}
        </div>

        <div className="flex flex-col">
          {/* From workout: show linked plan or empty */}
          {showWorkoutContext && (
            <div
              className={`mb-6 p-4 rounded-2xl bg-white dark:bg-slate-800/80 dark:border-slate-700 border border-slate-100 shadow-sm ${workoutCardOrderClass}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <MdLink className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Linked to this workout
                </div>
                {!checkingLink && linkedPlansForWorkout.length > 0 && (
                  <button
                    type="button"
                    disabled={
                      isLoadingProfile ||
                      isGeneratingOverview ||
                      isGeneratingDays ||
                      !userProfile
                    }
                    onClick={openAllergyDialog}
                    className="shrink-0 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400"
                  >
                    {generateAnotherCtaLabel}
                  </button>
                )}
              </div>
              {checkingLink ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Loading linked meal plans...
                </p>
              ) : linkedPlansForWorkout.length > 0 ? (
                <div className="space-y-3">
                  {linkedPlansForWorkout.map((linkedPlan, index) => (
                    <button
                      key={linkedPlan.id}
                      type="button"
                      onClick={() =>
                        router.push(
                          `/meals/plan?id=${linkedPlan.id}&workoutPlanId=${workoutPlanId}`,
                        )
                      }
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-teal-50 dark:bg-teal-900/40 border border-teal-100 dark:border-teal-700 hover:bg-teal-100 dark:hover:bg-teal-800/60 transition-colors text-left"
                    >
                      <div className="h-7 w-7 shrink-0 rounded-full bg-white dark:bg-slate-800 border border-teal-200 dark:border-teal-700 flex items-center justify-center text-xs font-bold text-teal-700 dark:text-teal-300">
                        {index + 1}
                      </div>
                      {linkedPlan.image_path ? (
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0">
                          <Image
                            src={linkedPlan.image_path}
                            alt={
                              linkedPlan.image_alt ||
                              linkedPlan.plan_name ||
                              "Meal plan"
                            }
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-teal-200 dark:bg-teal-800 flex items-center justify-center shrink-0">
                          <MdRestaurant className="w-7 h-7 text-teal-700 dark:text-teal-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {linkedPlan.plan_name || "Unnamed plan"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {linkedPlan.duration_dayss ?? 0} days
                          {linkedPlan.completed && " - Completed"}
                        </p>
                      </div>
                      <MdChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    No meal plan linked to this workout yet. Attach by Generating Meal Plan.
                  </p>
                  {generateMealPlanCard()}
                </>
              )}
            </div>
          )}

          {/* Workout plans list for /meals */}
          {!workoutPlanId && (
            <div className={`mb-6 ${standAloneCardOrderClass}`}>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
                Select a workout plan
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Choose a workout to generate and view linked meal plans.
              </p>
              {isLoadingWorkoutPlans ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Loading workout plans...
                </div>
              ) : userWorkoutPlans.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No workout plans found yet. Create one first in Personal.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {userWorkoutPlans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() =>
                        router.push(`/meals/workout/plan/${plan.id}`)
                      }
                      className="group rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 overflow-hidden text-left shadow-sm hover:shadow-md hover:border-teal-200 dark:hover:border-teal-600 transition-all"
                    >
                      {plan.image_path ? (
                        <div className="relative h-28 w-full">
                          <Image
                            src={plan.image_path}
                            alt={plan.image_alt || plan.name || "Workout plan"}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="h-28 w-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                          <MdLink className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                        </div>
                      )}
                      <div className="p-3">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">
                          {plan.name || "Workout Plan"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {plan.duration_days ?? 0} days
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Generated meal plan overview + day details (display only, no save) */}
          {generateError && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-sm text-red-700 dark:text-red-200">
              {generateError}
            </div>
          )}
          {showAllergyDialog && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4">
              <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    Allergies and Dietary Restrictions
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Before we generate your meal plan, please let us know about
                    any allergies or dietary restrictions.
                  </p>
                </div>
                <div className="p-5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Allergies (comma-separated)
                  </label>
                  <textarea
                    value={allergyInput}
                    onChange={(event) => setAllergyInput(event.target.value)}
                    rows={3}
                    placeholder="e.g. peanuts, shellfish, lactose"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Leave this field blank if you have no allergies or dietary
                    restrictions.
                  </p>
                </div>
                <div className="p-5 pt-0 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAllergyDialog(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAllergySubmit}
                    className="flex-1 py-2.5 rounded-xl bg-teal-600 dark:bg-teal-500 text-white font-semibold hover:bg-teal-700 dark:hover:bg-teal-400 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          )}
          {showGenerationDialog && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4">
              <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    Generating your meal plan
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Please wait while we prepare your personalized plan.
                  </p>
                </div>
                <div className="p-6">
                  {(() => {
                    const stagePercent = Math.max(
                      0,
                      Math.min(100, displayedGenerationProgress),
                    );
                    const percent = Math.round(stagePercent);
                    const linePercent =
                      stagePercent <= 20 ? 0 : ((stagePercent - 20) / 80) * 100;
                    const stepSize = 100 / GENERATION_STEP_LABELS.length;
                    const activeStep = Math.min(
                      GENERATION_STEP_LABELS.length - 1,
                      Math.floor(stagePercent / stepSize),
                    );

                    return (
                      <>
                        <div className="mb-4 flex items-center justify-between">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Step{" "}
                            {Math.min(
                              activeStep + 1,
                              GENERATION_STEP_LABELS.length,
                            )}{" "}
                            of {GENERATION_STEP_LABELS.length}
                          </p>
                          <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                            {percent}%
                          </p>
                        </div>
                        <div className="relative px-1">
                          <div className="absolute left-8 right-8 top-[17px] h-[6px] bg-slate-200 dark:bg-slate-600 rounded-full" />
                          <div
                            className="absolute left-8 top-[17px] h-[6px] bg-amber-500 dark:bg-amber-400 rounded-full transition-all duration-300"
                            style={{
                              width: `calc((100% - 64px) * ${linePercent / 100})`,
                            }}
                          />
                          <div className="relative z-10 flex items-start justify-between gap-2">
                            {GENERATION_STEP_LABELS.map((label, index) => {
                              const completionThreshold =
                                (index + 1) * stepSize;
                              const isComplete =
                                stagePercent >= completionThreshold;
                              const isActive =
                                !isComplete && index === activeStep;
                              return (
                                <div
                                  key={label}
                                  className="flex w-16 shrink-0 flex-col items-center"
                                >
                                  <div
                                    className={`h-10 w-10 rounded-full border-2 flex items-center justify-center transition-colors ${
                                      isComplete
                                        ? "bg-amber-500 dark:bg-amber-500 border-amber-500 text-white"
                                        : isActive
                                          ? "bg-amber-50 dark:bg-amber-900/40 border-amber-500 text-amber-700 dark:text-amber-300 shadow-[0_0_0_3px_rgba(245,158,11,0.15)] dark:shadow-[0_0_0_3px_rgba(251,191,36,0.2)]"
                                          : "bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500"
                                    }`}
                                  >
                                    {isComplete ? (
                                      <MdCheck className="h-5 w-5" />
                                    ) : (
                                      <span className="text-xs font-semibold">
                                        {index + 1}
                                      </span>
                                    )}
                                  </div>
                                  <p
                                    className={`mt-2 text-center text-[11px] leading-tight ${
                                      isComplete || isActive
                                        ? "text-amber-700 dark:text-amber-400"
                                        : "text-slate-500 dark:text-slate-400"
                                    }`}
                                  >
                                    {label}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
          {!showGenerationDialog && mealPlanOverview && (
            <div className={`mb-6 space-y-4 ${previewOrderClass}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    Generated Plan Preview
                  </h2>
                  {saveSuccess && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      {saveSuccess}
                    </p>
                  )}
                  {saveError && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {saveError}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSavePlan}
                    disabled={!user?.id || isSavingPlan || isGeneratingDays}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 dark:bg-teal-500 text-white text-sm font-semibold hover:bg-teal-700 dark:hover:bg-teal-400 disabled:opacity-60"
                  >
                    {isSavingPlan ? "Saving" : "Save plan"}
                  </button>
                </div>
              </div>

              {mealPlanOverview.days &&
                Object.keys(mealPlanOverview.days).length > 0 && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(mealPlanOverview.days).map((dayName) => {
                        const isActive = activeDay === dayName;
                        return (
                          <button
                            key={`tab-${dayName}`}
                            type="button"
                            onClick={() => setActiveDay(dayName)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                              isActive
                                ? "bg-teal-600 dark:bg-teal-500 text-white"
                                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-teal-200 dark:hover:border-teal-500"
                            }`}
                          >
                            {dayName}
                          </button>
                        );
                      })}
                    </div>
                    {Object.entries(mealPlanOverview.days).map(
                      ([dayName, dayData]) => {
                        if (activeDay && dayName !== activeDay) return null;
                        const theme = dayData?.theme ?? "";
                        const dayResult = mealPlanDayResults[dayName];
                        const isGenerating =
                          generatingDayKeys.includes(dayName);
                        return (
                          <div
                            key={dayName}
                            className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800/80 shadow-sm px-3 py-4 space-y-4"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                                  {dayName}
                                </p>
                                {theme && (
                                  <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {theme}
                                  </p>
                                )}
                              </div>
                              {!dayResult ? (
                                <button
                                  type="button"
                                  disabled={isGenerating}
                                  onClick={() =>
                                    handleGenerateDay(dayName, theme)
                                  }
                                  className="shrink-0 px-3 py-1.5 rounded-lg bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-sm font-medium hover:bg-teal-200 dark:hover:bg-teal-800 disabled:opacity-60"
                                >
                                  Generate meals
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isGenerating}
                                  onClick={() =>
                                    handleGenerateDay(dayName, theme)
                                  }
                                  className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-60"
                                >
                                  Regenerate meals
                                </button>
                              )}
                            </div>
                            {dayResult && (
                              <div className="mt-4 space-y-3 text-sm">
                                <p>
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Daily budget:
                                  </span>{" "}
                                  {dayResult.daily_budget ?? "-"}
                                </p>
                                <p>
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Calorie target:
                                  </span>{" "}
                                  {dayResult.calorie_target ?? "-"}
                                </p>
                                {dayResult.macro_breakdown && (
                                  <p className="text-slate-600 dark:text-slate-300">
                                    Macros - P:{" "}
                                    {dayResult.macro_breakdown.protein ?? "-"} |
                                    C: {dayResult.macro_breakdown.carbs ?? "-"}{" "}
                                    | F: {dayResult.macro_breakdown.fats ?? "-"}
                                  </p>
                                )}
                                {dayResult.meals && (
                                  <div className="space-y-2">
                                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                                      Meals
                                    </p>
                                    <div className="space-y-3">
                                      {(() => {
                                        const mealEntries: Array<{
                                          label: string;
                                          meal: unknown;
                                          index?: number;
                                        }> = [];
                                        if (dayResult.meals.breakfast) {
                                          mealEntries.push({
                                            label: "Breakfast",
                                            meal: dayResult.meals.breakfast,
                                          });
                                        }
                                        if (dayResult.meals.lunch) {
                                          mealEntries.push({
                                            label: "Lunch",
                                            meal: dayResult.meals.lunch,
                                          });
                                        }
                                        if (dayResult.meals.dinner) {
                                          mealEntries.push({
                                            label: "Dinner",
                                            meal: dayResult.meals.dinner,
                                          });
                                        }
                                        if (dayResult.meals.snacks) {
                                          dayResult.meals.snacks.forEach(
                                            (snack, snackIndex) => {
                                              mealEntries.push({
                                                label: "Snack",
                                                meal: snack,
                                                index: snackIndex,
                                              });
                                            },
                                          );
                                        }
                                        return mealEntries
                                          .sort((a, b) => {
                                            const timeA =
                                              typeof a.meal === "object"
                                                ? parseMealTime(
                                                    ((
                                                      a.meal as Record<
                                                        string,
                                                        unknown
                                                      >
                                                    ).best_time_to_eat as
                                                      | string
                                                      | undefined) ??
                                                      ((
                                                        a.meal as Record<
                                                          string,
                                                          unknown
                                                        >
                                                      ).best_time as
                                                        | string
                                                        | undefined),
                                                  )
                                                : Number.MAX_SAFE_INTEGER;
                                            const timeB =
                                              typeof b.meal === "object"
                                                ? parseMealTime(
                                                    ((
                                                      b.meal as Record<
                                                        string,
                                                        unknown
                                                      >
                                                    ).best_time_to_eat as
                                                      | string
                                                      | undefined) ??
                                                      ((
                                                        b.meal as Record<
                                                          string,
                                                          unknown
                                                        >
                                                      ).best_time as
                                                        | string
                                                        | undefined),
                                                  )
                                                : Number.MAX_SAFE_INTEGER;
                                            return timeA - timeB;
                                          })
                                          .map((entry, entryIndex) => (
                                            <div
                                              key={`${entry.label}-${entry.index ?? entryIndex}`}
                                            >
                                              {renderMealCard(
                                                entry.label,
                                                entry.meal,
                                                entry.index,
                                              )}
                                            </div>
                                          ));
                                      })()}
                                    </div>
                                  </div>
                                )}
                                {dayResult.total_daily_cost && (
                                  <p className="font-medium text-slate-700 dark:text-slate-300">
                                    Total daily cost:{" "}
                                    {dayResult.total_daily_cost}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { HiArrowLeft, HiPencil, HiPlus, HiTrash } from "react-icons/hi2";
import Loader from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useCoachMealData } from "@/hooks/useCoachMealData";
import { useCoachWorkoutData } from "@/hooks/useCoachWorkoutData";
import { useAdminSupabase } from "@/hooks/useAdminSupabase";
import Dialog from "@/components/Dialog";
import {
  CoachMeal,
  CoachMealItemWithDetails,
  CoachMealPlanDayMeal,
  CoachMealPlanFull,
} from "@/types/CoachMeal";
import { CoachWorkoutPlan } from "@/types/CoachWorkout";
import SelectBox from "@/components/SelectBox";

interface CoachMealPlanDetailPageProps {
  params: Promise<{
    mealPlanId: string;
  }>;
}

export default function CoachMealPlanDetailPage({
  params,
}: CoachMealPlanDetailPageProps) {
  const router = useRouter();
  const { mealPlanId } = use(params);
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const { fetchMealPlanFull, fetchMeals } = useCoachMealData();
  const { fetchCoachWorkoutPlans } = useCoachWorkoutData();
  const adminClient = useAdminSupabase();
  const hasCheckedAuth = useRef(false);
  const [mealPlan, setMealPlan] = useState<CoachMealPlanFull | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [mealsCatalog, setMealsCatalog] = useState<CoachMeal[]>([]);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "",
    description: "",
    goal: "",
    durationDays: "0",
    estimatedDailyCalories: "",
    isPublic: true,
  });
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [isPlanSaving, setIsPlanSaving] = useState(false);
  const [mealDialogState, setMealDialogState] = useState<{
    visible: boolean;
    mode: "create" | "edit";
    targetMealId: string | null;
  }>({ visible: false, mode: "create", targetMealId: null });
  const [mealForm, setMealForm] = useState({
    dayId: "",
    mealId: "",
    mealNumber: 1,
    plannedTime: "",
    variantLabel: "",
    notes: "",
  });
  const [isMealSaving, setIsMealSaving] = useState(false);
  const [deleteState, setDeleteState] = useState<{
    visible: boolean;
    mealId: string | null;
  }>({ visible: false, mealId: null });
  const [isDeletingMeal, setIsDeletingMeal] = useState(false);
  const [dayDialogState, setDayDialogState] = useState<{
    visible: boolean;
    mode: "create" | "edit";
    targetDayId: string | null;
  }>({ visible: false, mode: "create", targetDayId: null });
  const [dayForm, setDayForm] = useState({
    dayNumber: 1,
    label: "",
    notes: "",
  });
  const [isDaySaving, setIsDaySaving] = useState(false);
  const [workoutPlans, setWorkoutPlans] = useState<CoachWorkoutPlan[]>([]);
  const [attachDialogState, setAttachDialogState] = useState<{
    visible: boolean;
    selectedWorkoutPlanId: string;
  }>({ visible: false, selectedWorkoutPlanId: "" });
  const [isAttaching, setIsAttaching] = useState(false);

  useEffect(() => {
    if (!isLoading && !isLoadingRole) {
      if (!hasCheckedAuth.current) {
        hasCheckedAuth.current = true;
      }

      if (!isAuthenticated) {
        router.push("/auth/login");
      } else if (hasCheckedAuth.current && !isAdmin) {
        router.push("/");
      }
    }
  }, [isAuthenticated, isAdmin, isLoading, isLoadingRole, router]);

  const refreshMealPlan = useCallback(async () => {
    if (!isAuthenticated || !isAdmin || !mealPlanId) {
      return;
    }

    setIsLoadingPlan(true);
    const result = await fetchMealPlanFull(mealPlanId);
    if (result.success && result.data) {
      setMealPlan(result.data);
      setPlanError(null);
      setPlanForm({
        name: result.data.name,
        description: result.data.description || "",
        goal: result.data.goal || "",
        durationDays: String(result.data.duration_days ?? 0),
        estimatedDailyCalories: result.data.estimated_daily_calories
          ? String(result.data.estimated_daily_calories)
          : "",
        isPublic: result.data.is_public,
      });
    } else {
      setMealPlan(null);
      setPlanError(result.error || "Unable to load meal plan details");
    }
    setIsLoadingPlan(false);
  }, [fetchMealPlanFull, isAdmin, isAuthenticated, mealPlanId]);

  useEffect(() => {
    refreshMealPlan();
  }, [refreshMealPlan]);

  useEffect(() => {
    const loadMealsCatalog = async () => {
      const result = await fetchMeals();
      if (result.success && result.data) {
        setMealsCatalog(result.data);
      }
    };

    loadMealsCatalog();
  }, [fetchMeals]);

  useEffect(() => {
    const loadWorkoutPlans = async () => {
      const result = await fetchCoachWorkoutPlans();
      if (result.success && result.data) {
        setWorkoutPlans(result.data);
      }
    };

    loadWorkoutPlans();
  }, [fetchCoachWorkoutPlans]);

  const formatCalories = (value: number | null | undefined) => {
    if (!value || Number.isNaN(value)) {
      return "—";
    }
    return new Intl.NumberFormat("en-US").format(value);
  };

  const formatTime = (value: string | null | undefined) => {
    if (!value) {
      return "Anytime";
    }
    try {
      return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "numeric",
      }).format(new Date(`1970-01-01T${value}`));
    } catch {
      return value;
    }
  };

  const renderMealItems = (items?: CoachMealItemWithDetails[]) => {
    if (!items || items.length === 0) {
      return (
        <p className="text-sm text-slate-500">
          No specific food or recipe items listed.
        </p>
      );
    }

    return (
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                {item.item_type === "recipe"
                  ? item.recipe?.name || "Recipe"
                  : item.food?.name || "Food"}
              </span>
              <span className="text-xs text-slate-500">
                {item.quantity ? `${item.quantity} ${item.unit || ""}` : ""}
              </span>
            </div>
            {item.notes && (
              <p className="mt-1 text-xs text-slate-500">{item.notes}</p>
            )}
          </li>
        ))}
      </ul>
    );
  };

  const openPlanDialog = () => {
    if (!mealPlan) {
      return;
    }
    setPlanForm({
      name: mealPlan.name,
      description: mealPlan.description || "",
      goal: mealPlan.goal || "",
      durationDays: String(mealPlan.duration_days ?? 0),
      estimatedDailyCalories: mealPlan.estimated_daily_calories
        ? String(mealPlan.estimated_daily_calories)
        : "",
      isPublic: mealPlan.is_public,
    });
    setIsPlanDialogOpen(true);
  };

  const handlePlanFieldChange = (
    field: keyof typeof planForm,
    value: string | boolean
  ) => {
    setPlanForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePlanSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adminClient) {
      setFeedback({
        type: "error",
        message: "Admin client is not available for plan updates.",
      });
      return;
    }
    if (!planForm.name.trim()) {
      setFeedback({
        type: "error",
        message: "Plan name is required.",
      });
      return;
    }

    const durationDays = Number(planForm.durationDays) || 0;
    const estimatedDailyCalories = planForm.estimatedDailyCalories
      ? Number(planForm.estimatedDailyCalories)
      : null;

    try {
      setIsPlanSaving(true);
      const { error } = await adminClient
        .from("coach_meal_plans")
        .update({
          name: planForm.name.trim(),
          description: planForm.description.trim() || null,
          goal: planForm.goal.trim() || null,
          duration_days: durationDays,
          estimated_daily_calories: estimatedDailyCalories,
          is_public: planForm.isPublic,
          updated_at: new Date().toISOString(),
        })
        .eq("id", mealPlanId);

      if (error) {
        throw error;
      }

      setFeedback({
        type: "success",
        message: "Plan details updated.",
      });
      setIsPlanDialogOpen(false);
      refreshMealPlan();
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error.message || "Unable to update plan.",
      });
    } finally {
      setIsPlanSaving(false);
    }
  };

  const openMealDialog = (
    mode: "create" | "edit",
    options?: {
      dayId?: string;
      dayMeal?: CoachMealPlanDayMeal;
    }
  ) => {
    const defaultDayId =
      options?.dayId ||
      mealPlan?.days?.[0]?.id ||
      options?.dayMeal?.meal_plan_day_id ||
      "";
    const defaultMealId =
      options?.dayMeal?.meal_id || mealsCatalog[0]?.id || "";
    const defaultMealNumber =
      options?.dayMeal?.meal_number ||
      (mealPlan?.days?.find((day) => day.id === defaultDayId)?.meals?.length ||
        0) + (mode === "create" ? 1 : 0) ||
      1;

    setMealDialogState({
      visible: true,
      mode,
      targetMealId: options?.dayMeal?.id || null,
    });
    setMealForm({
      dayId: defaultDayId,
      mealId: defaultMealId,
      mealNumber: defaultMealNumber,
      plannedTime: options?.dayMeal?.planned_time || "",
      variantLabel: options?.dayMeal?.variant_label || "",
      notes: options?.dayMeal?.notes || "",
    });
  };

  const handleMealFieldChange = (
    field: keyof typeof mealForm,
    value: string | number
  ) => {
    setMealForm((prev) => ({
      ...prev,
      [field]: field === "mealNumber" ? Math.max(1, Number(value) || 1) : value,
    }));
  };

  const handleMealSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adminClient) {
      setFeedback({
        type: "error",
        message: "Admin client is not available for meal changes.",
      });
      return;
    }
    if (!mealForm.dayId || !mealForm.mealId) {
      setFeedback({
        type: "error",
        message: "Day and meal are required.",
      });
      return;
    }

    const payload = {
      meal_plan_day_id: mealForm.dayId,
      meal_id: mealForm.mealId,
      meal_number: mealForm.mealNumber,
      planned_time: mealForm.plannedTime || null,
      variant_label: mealForm.variantLabel.trim() || null,
      notes: mealForm.notes.trim() || null,
    };

    try {
      setIsMealSaving(true);
      let errorFromRequest = null;

      if (mealDialogState.mode === "create") {
        const { error } = await adminClient
          .from("coach_meal_plan_day_meals")
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          });
        errorFromRequest = error;
      } else if (mealDialogState.targetMealId) {
        const { error } = await adminClient
          .from("coach_meal_plan_day_meals")
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", mealDialogState.targetMealId);
        errorFromRequest = error;
      }

      if (errorFromRequest) {
        throw errorFromRequest;
      }

      setFeedback({
        type: "success",
        message:
          mealDialogState.mode === "create"
            ? "Meal added to plan."
            : "Meal updated.",
      });
      setMealDialogState({
        visible: false,
        mode: "create",
        targetMealId: null,
      });
      refreshMealPlan();
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error.message || "Unable to save meal changes.",
      });
    } finally {
      setIsMealSaving(false);
    }
  };

  const openDeleteMealDialog = (mealId: string) => {
    setDeleteState({ visible: true, mealId });
  };

  const handleDeleteMeal = async () => {
    if (!adminClient || !deleteState.mealId) {
      return;
    }
    try {
      setIsDeletingMeal(true);
      const { error } = await adminClient
        .from("coach_meal_plan_day_meals")
        .delete()
        .eq("id", deleteState.mealId);
      if (error) {
        throw error;
      }
      setFeedback({
        type: "success",
        message: "Meal removed from plan.",
      });
      setDeleteState({ visible: false, mealId: null });
      refreshMealPlan();
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error.message || "Unable to delete meal.",
      });
    } finally {
      setIsDeletingMeal(false);
    }
  };

  const openDayDialog = (
    mode: "create" | "edit",
    day?: {
      id: string;
      day_number: number;
      label: string | null;
      notes: string | null;
    }
  ) => {
    setDayDialogState({
      visible: true,
      mode,
      targetDayId: day?.id || null,
    });
    setDayForm({
      dayNumber:
        mode === "create"
          ? (mealPlan?.days?.length || 0) + 1
          : day?.day_number || 1,
      label: day?.label || "",
      notes: day?.notes || "",
    });
  };

  const handleDayFieldChange = (
    field: keyof typeof dayForm,
    value: string | number
  ) => {
    setDayForm((prev) => ({
      ...prev,
      [field]: field === "dayNumber" ? Math.max(1, Number(value) || 1) : value,
    }));
  };

  const handleDaySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adminClient) {
      setFeedback({
        type: "error",
        message: "Admin client is not available for day changes.",
      });
      return;
    }
    try {
      setIsDaySaving(true);
      if (dayDialogState.mode === "create") {
        const { error } = await adminClient
          .from("coach_meal_plan_days")
          .insert({
            meal_plan_id: mealPlanId,
            day_number: dayForm.dayNumber,
            label: dayForm.label.trim() || null,
            notes: dayForm.notes.trim() || null,
            created_at: new Date().toISOString(),
          });
        if (error) {
          throw error;
        }
      } else if (dayDialogState.targetDayId) {
        const { error } = await adminClient
          .from("coach_meal_plan_days")
          .update({
            day_number: dayForm.dayNumber,
            label: dayForm.label.trim() || null,
            notes: dayForm.notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", dayDialogState.targetDayId);
        if (error) {
          throw error;
        }
      }
      setFeedback({
        type: "success",
        message:
          dayDialogState.mode === "create"
            ? "Day added to plan."
            : "Day updated.",
      });
      setDayDialogState({ visible: false, mode: "create", targetDayId: null });
      refreshMealPlan();
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error.message || "Unable to save day changes.",
      });
    } finally {
      setIsDaySaving(false);
    }
  };

  const dayOptions = mealPlan?.days || [];
  const [daySort, setDaySort] = useState<"day-number" | "created-at">(
    "day-number"
  );
  const sortedDays = [...dayOptions].sort((dayA, dayB) => {
    if (daySort === "created-at") {
      return (
        new Date(dayB.created_at || 0).getTime() -
        new Date(dayA.created_at || 0).getTime()
      );
    }
    return dayA.day_number - dayB.day_number;
  });

  const openAttachDialog = () => {
    setAttachDialogState({
      visible: true,
      selectedWorkoutPlanId: "",
    });
  };

  const handleAttachSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!attachDialogState.selectedWorkoutPlanId || !mealPlanId) {
      setFeedback({
        type: "error",
        message: "Please select a workout plan.",
      });
      return;
    }

    if (!adminClient) {
      setFeedback({
        type: "error",
        message: "Admin client is not available for creating links.",
      });
      return;
    }

    try {
      setIsAttaching(true);

      // Check if link already exists
      const { data: existingLink, error: checkError } = await adminClient
        .from("coach_workout_meal_plan_link")
        .select("*")
        .eq("plan_id", attachDialogState.selectedWorkoutPlanId)
        .eq("meal_plan_id", mealPlanId)
        .maybeSingle();

      if (checkError) {
        throw new Error(
          checkError.message || "Unable to check for existing link."
        );
      }

      if (existingLink) {
        setFeedback({
          type: "error",
          message:
            "This meal plan is already linked to the selected workout plan.",
        });
        return;
      }

      // Create the link using admin client (bypasses RLS)
      const { error: insertError } = await adminClient
        .from("coach_workout_meal_plan_link")
        .insert({
          plan_id: attachDialogState.selectedWorkoutPlanId,
          meal_plan_id: mealPlanId,
        });

      if (insertError) {
        throw new Error(insertError.message || "Unable to create link.");
      }

      setFeedback({
        type: "success",
        message: "Meal plan attached to workout plan successfully.",
      });
      setAttachDialogState({ visible: false, selectedWorkoutPlanId: "" });
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error.message || "Unable to attach meal plan to workout plan.",
      });
    } finally {
      setIsAttaching(false);
    }
  };

  if (!isAuthenticated || !isAdmin) {
    if (!isLoading && !isLoadingRole) {
      return null;
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading || isLoadingRole ? (
          <div className="flex min-h-[calc(100vh-140px)] items-center justify-center">
            <Loader
              size="lg"
              text="Loading..."
              color="green"
              textColor="slate"
            />
          </div>
        ) : (
          <>
            {/* Page heading */}
            <div className="mb-6 sm:mb-8">
              <div className="mb-2">
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                  >
                    <HiArrowLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={openAttachDialog}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-amber-500 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!mealPlan}
                  >
                    <HiPlus className="h-4 w-4" />
                    Attach to a Workout Plan
                  </button>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
                  {mealPlan?.name || "Meal Plan"}
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  Review every day, mealtime, and linked recipes
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Role: Admin</span>
                </div>
              </div>
              <div className="h-1 bg-[#f59e0b] rounded-full w-16 mt-1" />
            </div>

            {feedback && (
              <div
                className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
                  feedback.type === "success"
                    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                    : "border-rose-100 bg-rose-50 text-rose-700"
                }`}
              >
                {feedback.message}
              </div>
            )}

            <div className="mb-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openDayDialog("create")}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!mealPlan}
              >
                <HiPlus className="h-4 w-4" />
                Add Day
              </button>

              <button
                type="button"
                onClick={openPlanDialog}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!mealPlan}
              >
                <HiPencil className="h-4 w-4" />
                Edit Plan
              </button>

              <div className="ml-auto flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1">
                <span className="text-xs font-semibold text-slate-600">
                  Sort days:
                </span>
                <SelectBox
                  aria-label="Sort plan days"
                  value={daySort}
                  onChange={(event) =>
                    setDaySort(
                      event.target.value as "day-number" | "created-at"
                    )
                  }
                  variant="inline"
                  wrapperClassName="w-auto"
                  className="text-xs font-semibold text-slate-900"
                >
                  <option value="day-number">By day number</option>
                  <option value="created-at">Newest created</option>
                </SelectBox>
              </div>
            </div>

            {planError && (
              <p className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {planError}
              </p>
            )}
            {isLoadingPlan ? (
              <div className="flex min-h-[200px] items-center justify-center">
                <Loader
                  size="md"
                  text="Loading plan..."
                  color="green"
                  textColor="slate"
                />
              </div>
            ) : mealPlan ? (
              <>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                    Duration: {mealPlan.duration_days} days
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    Calories:{" "}
                    {formatCalories(mealPlan.estimated_daily_calories)} kcal/day
                  </span>
                </div>
                {mealPlan.description && (
                  <p className="mt-4 text-sm text-slate-600">
                    {mealPlan.description}
                  </p>
                )}

                <div className="mt-8 space-y-5">
                  {sortedDays.map((day) => (
                    <article
                      key={day.id}
                      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            Day {day.day_number}
                            {day.label ? ` · ${day.label}` : ""}
                          </h3>
                          {day.notes && (
                            <p className="text-sm text-slate-600">
                              {day.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-slate-500">
                            {day.meals?.length || 0} meals planned
                          </span>
                          <button
                            type="button"
                            onClick={() => openDayDialog("edit", day)}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            <HiPencil className="h-4 w-4" />
                            Edit day
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openMealDialog("create", { dayId: day.id })
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            <HiPlus className="h-4 w-4" />
                            Add meal
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3">
                        {(day.meals || []).map((dayMeal) => (
                          <div
                            key={dayMeal.id}
                            className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 shadow-sm"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-teal-500">
                                  Meal {dayMeal.meal_number}
                                </p>
                                <h4 className="text-base font-semibold text-slate-900">
                                  {dayMeal.meal?.name || "Untitled meal"}
                                </h4>
                                <p className="text-xs text-slate-500">
                                  {dayMeal.meal?.goal || "General goal"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (dayMeal.meal_id) {
                                      router.push(
                                        `/admin/general/nutrition/base/meals/${dayMeal.meal_id}`
                                      );
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                                  disabled={!dayMeal.meal_id}
                                >
                                  <HiPencil className="h-4 w-4" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openDeleteMealDialog(dayMeal.id)
                                  }
                                  className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
                                >
                                  <HiTrash className="h-4 w-4" />
                                  Delete
                                </button>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                                {formatTime(dayMeal.planned_time)}
                              </span>
                              {dayMeal.meal?.typical_time_of_day && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                                  {dayMeal.meal.typical_time_of_day}
                                </span>
                              )}
                              {dayMeal.variant_label && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                                  {dayMeal.variant_label}
                                </span>
                              )}
                            </div>
                            {dayMeal.meal?.description && (
                              <p className="mt-2 text-sm text-slate-600">
                                {dayMeal.meal.description}
                              </p>
                            )}
                            {renderMealItems(dayMeal.meal?.items)}
                          </div>
                        ))}
                        {(day.meals || []).length === 0 && (
                          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                            No meals scheduled for this day yet.
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                  {sortedDays.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
                      This meal plan does not have any scheduled days yet.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Select a meal plan from the library to view its details.
              </p>
            )}
          </>
        )}

        <Dialog
          visible={isPlanDialogOpen}
          onDismiss={() => setIsPlanDialogOpen(false)}
          maxWidth={560}
        >
          <form onSubmit={handlePlanSave} className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Edit meal plan
              </h3>
              <p className="text-sm text-slate-500">
                Update the core information visible to coaches.
              </p>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700">
                Plan name
              </label>
              <input
                type="text"
                value={planForm.name}
                onChange={(event) =>
                  handlePlanFieldChange("name", event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-300 focus:ring"
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                value={planForm.description}
                onChange={(event) =>
                  handlePlanFieldChange("description", event.target.value)
                }
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-300 focus:ring"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">
                  Goal
                </label>
                <input
                  type="text"
                  value={planForm.goal}
                  onChange={(event) =>
                    handlePlanFieldChange("goal", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-300 focus:ring"
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">
                  Duration (days)
                </label>
                <input
                  type="number"
                  min={1}
                  value={planForm.durationDays}
                  onChange={(event) =>
                    handlePlanFieldChange("durationDays", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-300 focus:ring"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">
                  Estimated kcal/day
                </label>
                <input
                  type="number"
                  min={0}
                  value={planForm.estimatedDailyCalories}
                  onChange={(event) =>
                    handlePlanFieldChange(
                      "estimatedDailyCalories",
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-300 focus:ring"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsPlanDialogOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                disabled={isPlanSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-teal-600 hover:to-emerald-600 disabled:opacity-60"
                disabled={isPlanSaving}
              >
                {isPlanSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </Dialog>

        <Dialog
          visible={dayDialogState.visible}
          onDismiss={() =>
            setDayDialogState({
              visible: false,
              mode: "create",
              targetDayId: null,
            })
          }
          maxWidth={520}
        >
          <form onSubmit={handleDaySubmit} className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {dayDialogState.mode === "create"
                  ? "Add plan day"
                  : "Edit plan day"}
              </h3>
              <p className="text-sm text-slate-500">
                Control day sequencing, labels, and internal notes.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">
                  Day number
                </label>
                <input
                  type="number"
                  min={1}
                  value={dayForm.dayNumber}
                  onChange={(event) =>
                    handleDayFieldChange("dayNumber", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-300 focus:ring"
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">
                  Label
                </label>
                <input
                  type="text"
                  value={dayForm.label}
                  onChange={(event) =>
                    handleDayFieldChange("label", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-300 focus:ring"
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                rows={3}
                value={dayForm.notes}
                onChange={(event) =>
                  handleDayFieldChange("notes", event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-300 focus:ring"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  setDayDialogState({
                    visible: false,
                    mode: "create",
                    targetDayId: null,
                  })
                }
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                disabled={isDaySaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-teal-600 hover:to-emerald-600 disabled:opacity-60"
                disabled={isDaySaving}
              >
                {isDaySaving ? "Saving..." : "Save day"}
              </button>
            </div>
          </form>
        </Dialog>

        <Dialog
          visible={mealDialogState.visible}
          onDismiss={() =>
            setMealDialogState({
              visible: false,
              mode: "create",
              targetMealId: null,
            })
          }
          maxWidth={520}
        >
          <form onSubmit={handleMealSubmit} className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {mealDialogState.mode === "create" ? "Add meal" : "Edit meal"}
              </h3>
              <p className="text-sm text-slate-500">
                Link a base meal to any day and control scheduling details.
              </p>
            </div>
            <SelectBox
              label="Day"
              value={mealForm.dayId}
              onChange={(event) =>
                handleMealFieldChange("dayId", event.target.value)
              }
              isRequired
            >
              <option value="" disabled>
                Select day
              </option>
              {sortedDays.map((day) => (
                <option key={day.id} value={day.id}>
                  Day {day.day_number}
                  {day.label ? ` · ${day.label}` : ""}
                </option>
              ))}
            </SelectBox>
            <SelectBox
              label="Meal"
              value={mealForm.mealId}
              onChange={(event) =>
                handleMealFieldChange("mealId", event.target.value)
              }
              isRequired
            >
              <option value="" disabled>
                Select meal
              </option>
              {mealsCatalog.map((meal) => (
                <option key={meal.id} value={meal.id}>
                  {meal.name}
                </option>
              ))}
            </SelectBox>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">
                  Order
                </label>
                <input
                  type="number"
                  min={1}
                  value={mealForm.mealNumber}
                  onChange={(event) =>
                    handleMealFieldChange("mealNumber", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-300 focus:ring"
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">
                  Planned time
                </label>
                <input
                  type="time"
                  value={mealForm.plannedTime}
                  onChange={(event) =>
                    handleMealFieldChange("plannedTime", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-300 focus:ring"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">
                  Variant label
                </label>
                <input
                  type="text"
                  value={mealForm.variantLabel}
                  onChange={(event) =>
                    handleMealFieldChange("variantLabel", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-300 focus:ring"
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">
                  Notes
                </label>
                <input
                  type="text"
                  value={mealForm.notes}
                  onChange={(event) =>
                    handleMealFieldChange("notes", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-300 focus:ring"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  setMealDialogState({
                    visible: false,
                    mode: "create",
                    targetMealId: null,
                  })
                }
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                disabled={isMealSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-teal-600 hover:to-emerald-600 disabled:opacity-60"
                disabled={isMealSaving}
              >
                {isMealSaving ? "Saving..." : "Save meal"}
              </button>
            </div>
          </form>
        </Dialog>

        <Dialog
          visible={deleteState.visible}
          onDismiss={() => setDeleteState({ visible: false, mealId: null })}
          maxWidth={420}
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Remove meal from plan?
              </h3>
              <p className="text-sm text-slate-500">
                This action cannot be undone. The base meal stays available in
                the library.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteState({ visible: false, mealId: null })}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                disabled={isDeletingMeal}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteMeal}
                className="rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-rose-600 hover:to-rose-700 disabled:opacity-60"
                disabled={isDeletingMeal}
              >
                {isDeletingMeal ? "Removing..." : "Delete meal"}
              </button>
            </div>
          </div>
        </Dialog>

        <Dialog
          visible={attachDialogState.visible}
          onDismiss={() =>
            setAttachDialogState({ visible: false, selectedWorkoutPlanId: "" })
          }
          maxWidth={560}
          height="75vh"
        >
          <form
            onSubmit={handleAttachSubmit}
            className="flex h-full flex-col overflow-hidden"
          >
            <div className="flex-1 space-y-4 overflow-y-auto">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Attach to a Workout Plan
                </h3>
                <p className="text-sm text-slate-500">
                  Link this meal plan to a workout plan. Users can then access
                  both plans together.
                </p>
              </div>
              <SelectBox
                label="Workout Plan"
                value={attachDialogState.selectedWorkoutPlanId}
                onChange={(event) =>
                  setAttachDialogState((prev) => ({
                    ...prev,
                    selectedWorkoutPlanId: event.target.value,
                  }))
                }
                isRequired
              >
                <option value="" disabled>
                  Select workout plan
                </option>
                {workoutPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </SelectBox>
              {attachDialogState.selectedWorkoutPlanId && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {(() => {
                    const selectedPlan = workoutPlans.find(
                      (p) => p.id === attachDialogState.selectedWorkoutPlanId
                    );
                    if (!selectedPlan) return null;
                    return (
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs font-semibold text-slate-600">
                            Name:
                          </span>
                          <p className="text-sm font-semibold text-slate-900">
                            {selectedPlan.name}
                          </p>
                        </div>
                        {selectedPlan.description && (
                          <div>
                            <span className="text-xs font-semibold text-slate-600">
                              Description:
                            </span>
                            <p className="text-sm text-slate-700">
                              {selectedPlan.description}
                            </p>
                          </div>
                        )}
                        {selectedPlan.level && (
                          <div>
                            <span className="text-xs font-semibold text-slate-600">
                              Level:
                            </span>
                            <p className="text-sm text-slate-700">
                              {selectedPlan.level}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            <div className="mt-auto flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() =>
                  setAttachDialogState({
                    visible: false,
                    selectedWorkoutPlanId: "",
                  })
                }
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                disabled={isAttaching}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-teal-600 hover:to-emerald-600 disabled:opacity-60"
                disabled={
                  isAttaching || !attachDialogState.selectedWorkoutPlanId
                }
              >
                {isAttaching ? "Attaching..." : "Attach"}
              </button>
            </div>
          </form>
        </Dialog>
      </main>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { HiArrowLeft, HiPencil, HiPlus, HiTrash } from "react-icons/hi2";
import Loader from "@/components/Loader";
import Dialog from "@/components/Dialog";
import Toast, { ToastProps } from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useGeneralMealPlanData } from "@/hooks/useGeneralMealPlanData";
import { useCoachMealData } from "@/hooks/useCoachMealData";
import {
  GeneralMealPlanFull,
  GeneralMealPlanDay,
  GeneralMealPlanDayMeal,
} from "@/types/GeneralMealPlan";
import { CoachMeal, CoachMealItemWithDetails } from "@/types/CoachMeal";
import SelectBox from "@/components/SelectBox";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

interface GeneralMealPlanDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function GeneralMealPlanDetailPage({
  params,
}: GeneralMealPlanDetailPageProps) {
  const router = useRouter();
  const { id: mealPlanId } = use(params);
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const {
    fetchMealPlanFull,
    createDay,
    updateDay,
    deleteDay,
    createDayMeal,
    updateDayMeal,
    deleteDayMeal,
  } = useGeneralMealPlanData();
  const { fetchMeals } = useCoachMealData();
  const hasCheckedAuth = useRef(false);
  const [mealPlan, setMealPlan] = useState<GeneralMealPlanFull | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [mealsCatalog, setMealsCatalog] = useState<CoachMeal[]>([]);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
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
  const [mealDialogState, setMealDialogState] = useState<{
    visible: boolean;
    mode: "create" | "edit";
    targetMealId: string | null;
  }>({ visible: false, mode: "create", targetMealId: null });
  const [mealForm, setMealForm] = useState({
    dayId: "",
    mealId: "",
    mealNumber: 1,
    typicalTimeOfDay: "",
    plannedTime: "",
    variantLabel: "",
    notes: "",
  });
  const [isMealSaving, setIsMealSaving] = useState(false);
  const [deleteState, setDeleteState] = useState<{
    visible: boolean;
    type: "day" | "meal";
    id: string | null;
    name: string | null;
  }>({ visible: false, type: "day", id: null, name: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [daySort, setDaySort] = useState<"day-number" | "created-at">(
    "created-at"
  );

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

  const showToast = (
    type: "success" | "error",
    title: string,
    message: string
  ) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

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
      <ul className="mt-4 space-y-2.5">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">
                {item.item_type === "recipe"
                  ? item.recipe?.name || "Recipe"
                  : item.food?.name || "Food"}
              </span>
              <span className="text-sm text-slate-500">
                {item.quantity ? `${item.quantity} ${item.unit || ""}` : ""}
              </span>
            </div>
            {item.notes && (
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {item.notes}
              </p>
            )}
          </li>
        ))}
      </ul>
    );
  };

  const openDayDialog = (mode: "create" | "edit", day?: GeneralMealPlanDay) => {
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

  const handleDaySave = async () => {
    if (!mealPlanId) {
      showToast("error", "Error", "Meal plan ID is required");
      return;
    }

    if (dayForm.dayNumber < 1) {
      showToast("error", "Validation Error", "Day number must be at least 1");
      return;
    }

    setIsDaySaving(true);
    try {
      if (dayDialogState.mode === "create") {
        const result = await createDay(mealPlanId, {
          day_number: dayForm.dayNumber,
          label: dayForm.label.trim() || null,
          notes: dayForm.notes.trim() || null,
        });
        if (result.success) {
          showToast("success", "Success", "Day added to plan");
          setDayDialogState({
            visible: false,
            mode: "create",
            targetDayId: null,
          });
          // Reset form
          setDayForm({
            dayNumber: (mealPlan?.days?.length || 0) + 1,
            label: "",
            notes: "",
          });
          refreshMealPlan();
        } else {
          showToast("error", "Error", result.error || "Failed to create day");
        }
      } else if (dayDialogState.targetDayId) {
        const result = await updateDay(dayDialogState.targetDayId, {
          day_number: dayForm.dayNumber,
          label: dayForm.label.trim() || null,
          notes: dayForm.notes.trim() || null,
        });
        if (result.success) {
          showToast("success", "Success", "Day updated");
          setDayDialogState({
            visible: false,
            mode: "create",
            targetDayId: null,
          });
          // Reset form
          setDayForm({
            dayNumber: 1,
            label: "",
            notes: "",
          });
          refreshMealPlan();
        } else {
          showToast("error", "Error", result.error || "Failed to update day");
        }
      }
    } catch (error: any) {
      showToast(
        "error",
        "Error",
        error.message || "An unexpected error occurred"
      );
    } finally {
      setIsDaySaving(false);
    }
  };

  const formatTimeForInput = (
    timeString: string | null | undefined
  ): string => {
    if (!timeString) return "";
    // Convert "HH:MM:SS" or "HH:MM" to "HH:MM" for HTML time input
    try {
      const parts = timeString.split(":");
      if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}`;
      }
      return timeString;
    } catch {
      return "";
    }
  };

  const openMealDialog = (
    mode: "create" | "edit",
    options?: {
      dayId?: string;
      dayMeal?: GeneralMealPlanDayMeal;
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

    // Get the base meal to get typical_time_of_day
    const selectedMeal = mealsCatalog.find((m) => m.id === defaultMealId);
    const defaultTypicalTimeOfDay =
      options?.dayMeal?.typical_time_of_the_day ||
      selectedMeal?.typical_time_of_day ||
      "";

    setMealDialogState({
      visible: true,
      mode,
      targetMealId: options?.dayMeal?.id || null,
    });
    setMealForm({
      dayId: defaultDayId,
      mealId: defaultMealId,
      mealNumber: defaultMealNumber,
      typicalTimeOfDay: defaultTypicalTimeOfDay,
      plannedTime: formatTimeForInput(options?.dayMeal?.planned_time),
      variantLabel: options?.dayMeal?.variant_label || "",
      notes: options?.dayMeal?.notes || "",
    });
  };

  const handleMealSave = async () => {
    if (!mealForm.dayId || !mealForm.mealId) {
      showToast("error", "Error", "Day and meal are required");
      return;
    }

    // Format time to HH:MM:SS format if provided
    let formattedTime: string | null = null;
    if (mealForm.plannedTime && mealForm.plannedTime.trim()) {
      const timeParts = mealForm.plannedTime.split(":");
      if (timeParts.length >= 2) {
        formattedTime = `${timeParts[0]}:${timeParts[1]}:00`;
      } else {
        formattedTime = mealForm.plannedTime;
      }
    }

    setIsMealSaving(true);
    try {
      if (mealDialogState.mode === "create") {
        const result = await createDayMeal(mealForm.dayId, {
          meal_id: mealForm.mealId,
          meal_number: mealForm.mealNumber,
          typical_time_of_the_day: mealForm.typicalTimeOfDay.trim() || null,
          planned_time: formattedTime,
          variant_label: mealForm.variantLabel.trim() || null,
          notes: mealForm.notes.trim() || null,
        });
        if (result.success) {
          showToast("success", "Success", "Meal added to plan");
          setMealDialogState({
            visible: false,
            mode: "create",
            targetMealId: null,
          });
          // Reset form
          setMealForm({
            dayId: "",
            mealId: "",
            mealNumber: 1,
            typicalTimeOfDay: "",
            plannedTime: "",
            variantLabel: "",
            notes: "",
          });
          refreshMealPlan();
        } else {
          showToast("error", "Error", result.error || "Failed to add meal");
        }
      } else if (mealDialogState.targetMealId) {
        const result = await updateDayMeal(mealDialogState.targetMealId, {
          meal_id: mealForm.mealId,
          meal_number: mealForm.mealNumber,
          typical_time_of_the_day: mealForm.typicalTimeOfDay.trim() || null,
          planned_time: formattedTime,
          variant_label: mealForm.variantLabel.trim() || null,
          notes: mealForm.notes.trim() || null,
        });
        if (result.success) {
          showToast("success", "Success", "Meal updated");
          setMealDialogState({
            visible: false,
            mode: "create",
            targetMealId: null,
          });
          // Reset form
          setMealForm({
            dayId: "",
            mealId: "",
            mealNumber: 1,
            typicalTimeOfDay: "",
            plannedTime: "",
            variantLabel: "",
            notes: "",
          });
          refreshMealPlan();
        } else {
          showToast("error", "Error", result.error || "Failed to update meal");
        }
      }
    } catch (error: any) {
      showToast(
        "error",
        "Error",
        error.message || "An unexpected error occurred"
      );
    } finally {
      setIsMealSaving(false);
    }
  };

  const openDeleteDialog = (type: "day" | "meal", id: string, name: string) => {
    setDeleteState({ visible: true, type, id, name });
  };

  const handleDelete = async () => {
    if (!deleteState.id) return;

    setIsDeleting(true);
    try {
      let result;
      if (deleteState.type === "day") {
        result = await deleteDay(deleteState.id);
      } else {
        result = await deleteDayMeal(deleteState.id);
      }

      if (result.success) {
        showToast(
          "success",
          "Success",
          `${deleteState.type === "day" ? "Day" : "Meal"} deleted successfully`
        );
        setDeleteState({ visible: false, type: "day", id: null, name: null });
        refreshMealPlan();
      } else {
        showToast("error", "Error", result.error || "Failed to delete");
      }
    } catch (error: any) {
      showToast(
        "error",
        "Error",
        error.message || "An unexpected error occurred"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const sortedDays = [...(mealPlan?.days || [])].sort((dayA, dayB) => {
    if (daySort === "created-at") {
      return (
        new Date(dayB.created_at || 0).getTime() -
        new Date(dayA.created_at || 0).getTime()
      );
    }
    return dayA.day_number - dayB.day_number;
  });

  if (!isAuthenticated || !isAdmin) {
    if (!isLoading && !isLoadingRole) {
      return null;
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading || isLoadingRole ? (
          <div className="flex min-h-[calc(100vh-180px)] items-center justify-center">
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
                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() =>
                      router.push("/admin/general/nutrition/plans")
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                  >
                    <HiArrowLeft className="h-5 w-5" />
                  </button>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
                  {mealPlan?.name || "Meal Plan"}
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  Manage days and meals for this meal plan
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Role: Admin</span>
                </div>
              </div>
              <div className="h-1 bg-[#f59e0b] rounded-full w-16 mt-1" />
            </div>
            <div className="mb-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>{mealPlan?.goal || "General goal"}</span>
                </div>
              </div>

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
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      Duration: {mealPlan.duration_days} days
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                      Calories:{" "}
                      {formatCalories(mealPlan.estimated_daily_calories)}{" "}
                      kcal/day
                    </span>
                  </div>
                  {mealPlan.description && (
                    <p className="mt-5 text-sm leading-relaxed text-slate-600">
                      {mealPlan.description}
                    </p>
                  )}

                  <div className="mt-8 space-y-5">
                    {sortedDays.map((day) => (
                      <article
                        key={day.id}
                        className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1.5">
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
                            <button
                              type="button"
                              onClick={() =>
                                openDeleteDialog(
                                  "day",
                                  day.id,
                                  `Day ${day.day_number}`
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                            >
                              <HiTrash className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="mt-6 grid gap-4">
                          {(day.meals || []).map((dayMeal) => (
                            <div
                              key={dayMeal.id}
                              className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 shadow-sm"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
                                      Meal {dayMeal.meal_number}
                                    </p>
                                    {dayMeal.typical_time_of_the_day && (
                                      <span className="text-xs font-medium text-slate-600">
                                        · {dayMeal.typical_time_of_the_day}
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-base font-semibold text-slate-900">
                                    {dayMeal.meal?.name || "Untitled meal"}
                                  </h4>
                                  <p className="text-sm text-slate-500">
                                    {dayMeal.meal?.goal || "General goal"}
                                  </p>
                                  <div className="flex flex-col gap-1.5">
                                    {dayMeal.planned_time && (
                                      <p className="text-sm text-slate-600">
                                        ⏰ {formatTime(dayMeal.planned_time)}
                                      </p>
                                    )}
                                    {dayMeal.variant_label && (
                                      <p className="text-sm text-slate-600">
                                        Variant: {dayMeal.variant_label}
                                      </p>
                                    )}
                                    {dayMeal.notes && (
                                      <p className="text-sm text-slate-600">
                                        {dayMeal.notes}
                                      </p>
                                    )}
                                  </div>
                                  {dayMeal.meal?.items &&
                                    renderMealItems(dayMeal.meal.items)}
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
                                    View Base Meal
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openMealDialog("edit", { dayMeal })
                                    }
                                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-50"
                                  >
                                    <HiPencil className="h-4 w-4" />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDeleteDialog(
                                        "meal",
                                        dayMeal.id,
                                        dayMeal.meal?.name || "Meal"
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                                  >
                                    <HiTrash className="h-4 w-4" />
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {(!day.meals || day.meals.length === 0) && (
                            <p className="rounded-xl border border-dashed border-slate-200 px-5 py-4 text-center text-sm leading-relaxed text-slate-500">
                              No meals planned for this day. Click "Add meal" to
                              get started.
                            </p>
                          )}
                        </div>
                      </article>
                    ))}
                    {sortedDays.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center">
                        <p className="text-sm leading-relaxed text-slate-500">
                          No days added yet. Click "Add Day" to create the first
                          day of this meal plan.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-6 py-12 text-center">
                  <p className="text-sm leading-relaxed text-rose-700">
                    Meal plan not found or unable to load.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Day Dialog */}
        <Dialog
          visible={dayDialogState.visible}
          onDismiss={() => {
            if (!isDaySaving) {
              setDayDialogState({
                visible: false,
                mode: "create",
                targetDayId: null,
              });
              // Reset form when closing
              setDayForm({
                dayNumber: (mealPlan?.days?.length || 0) + 1,
                label: "",
                notes: "",
              });
            }
          }}
          dismissible={!isDaySaving}
          maxWidth={500}
        >
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">
              {dayDialogState.mode === "create" ? "Add Day" : "Edit Day"}
            </h3>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Day Number
              </label>
              <input
                type="number"
                min="1"
                value={dayForm.dayNumber}
                readOnly
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Label
              </label>
              <input
                type="text"
                value={dayForm.label}
                onChange={(e) =>
                  setDayForm({ ...dayForm, label: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="e.g., Rest Day, High Protein Day"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                value={dayForm.notes}
                onChange={(e) =>
                  setDayForm({ ...dayForm, notes: e.target.value })
                }
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Additional notes for this day"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() =>
                  setDayDialogState({
                    visible: false,
                    mode: "create",
                    targetDayId: null,
                  })
                }
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDaySave}
                disabled={isDaySaving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {isDaySaving
                  ? "Saving..."
                  : dayDialogState.mode === "create"
                  ? "Add"
                  : "Update"}
              </button>
            </div>
          </div>
        </Dialog>

        {/* Meal Dialog */}
        <Dialog
          visible={mealDialogState.visible}
          onDismiss={() => {
            if (!isMealSaving) {
              setMealDialogState({
                visible: false,
                mode: "create",
                targetMealId: null,
              });
              // Reset form when closing
              setMealForm({
                dayId: mealPlan?.days?.[0]?.id || "",
                mealId: "",
                mealNumber: 1,
                typicalTimeOfDay: "",
                plannedTime: "",
                variantLabel: "",
                notes: "",
              });
            }
          }}
          dismissible={!isMealSaving}
          maxWidth={600}
        >
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">
              {mealDialogState.mode === "create" ? "Add Meal" : "Edit Meal"}
            </h3>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Day <span className="text-rose-500">*</span>
              </label>
              <SelectBox
                value={mealForm.dayId}
                onChange={(e) =>
                  setMealForm({ ...mealForm, dayId: e.target.value })
                }
                className="mt-1"
              >
                <option value="">Select a day</option>
                {mealPlan?.days?.map((day) => (
                  <option key={day.id} value={day.id}>
                    Day {day.day_number} {day.label ? `- ${day.label}` : ""}
                  </option>
                ))}
              </SelectBox>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Meal <span className="text-rose-500">*</span>
              </label>
              <SelectBox
                value={mealForm.mealId}
                onChange={(e) => {
                  const selectedMeal = mealsCatalog.find(
                    (m) => m.id === e.target.value
                  );
                  setMealForm({
                    ...mealForm,
                    mealId: e.target.value,
                    typicalTimeOfDay:
                      selectedMeal?.typical_time_of_day ||
                      mealForm.typicalTimeOfDay,
                  });
                }}
                className="mt-1"
              >
                <option value="">Select a meal</option>
                {mealsCatalog.map((meal) => (
                  <option key={meal.id} value={meal.id}>
                    {meal.name}
                  </option>
                ))}
              </SelectBox>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Meal Number
                </label>
                <input
                  type="number"
                  min="1"
                  value={mealForm.mealNumber}
                  onChange={(e) =>
                    setMealForm({
                      ...mealForm,
                      mealNumber: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Typical Time of Day
                </label>
                <input
                  type="text"
                  value={mealForm.typicalTimeOfDay}
                  onChange={(e) =>
                    setMealForm({
                      ...mealForm,
                      typicalTimeOfDay: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g., Breakfast, Lunch, Dinner"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Planned Time
              </label>
              <input
                type="time"
                value={mealForm.plannedTime}
                onChange={(e) =>
                  setMealForm({ ...mealForm, plannedTime: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Variant Label
              </label>
              <input
                type="text"
                value={mealForm.variantLabel}
                onChange={(e) =>
                  setMealForm({ ...mealForm, variantLabel: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="e.g., Large portion, Vegetarian option"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                value={mealForm.notes}
                onChange={(e) =>
                  setMealForm({ ...mealForm, notes: e.target.value })
                }
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Additional notes for this meal"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() =>
                  setMealDialogState({
                    visible: false,
                    mode: "create",
                    targetMealId: null,
                  })
                }
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMealSave}
                disabled={isMealSaving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {isMealSaving
                  ? "Saving..."
                  : mealDialogState.mode === "create"
                  ? "Add"
                  : "Update"}
              </button>
            </div>
          </div>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog
          visible={deleteState.visible}
          onDismiss={() => {
            if (!isDeleting) {
              setDeleteState({
                visible: false,
                type: "day",
                id: null,
                name: null,
              });
            }
          }}
          dismissible={!isDeleting}
          maxWidth={500}
        >
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">
              Delete {deleteState.type === "day" ? "Day" : "Meal"}
            </h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-900">
                {deleteState.name}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() =>
                  setDeleteState({
                    visible: false,
                    type: "day",
                    id: null,
                    name: null,
                  })
                }
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </Dialog>

        {/* Toast Notifications */}
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              type={toast.type}
              title={toast.title}
              message={toast.message}
              onDismiss={() => dismissToast(toast.id)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { HiArrowLeft, HiPencil, HiTrash, HiPlus } from "react-icons/hi2";
import Loader from "@/components/Loader";
import Dialog from "@/components/Dialog";
import Toast, { ToastProps } from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useGeneralMealPlanData } from "@/hooks/useGeneralMealPlanData";
import { GeneralMealPlan } from "@/types/GeneralMealPlan";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

interface MealPlanFormData {
  name: string;
  description: string;
  goal: string;
  duration_days: number;
  estimated_daily_calories: number | null;
  is_public: boolean;
}

export default function GeneralMealPlansPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const { fetchMealPlans, createMealPlan, updateMealPlan, deleteMealPlan } =
    useGeneralMealPlanData();
  const hasCheckedAuth = useRef(false);
  const [mealPlans, setMealPlans] = useState<GeneralMealPlan[]>([]);
  const [isLoadingMealPlans, setIsLoadingMealPlans] = useState<boolean>(false);
  const [mealPlansError, setMealPlansError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const [editingPlan, setEditingPlan] = useState<GeneralMealPlan | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<{
    visible: boolean;
    planId: string | null;
    planName: string | null;
  }>({
    visible: false,
    planId: null,
    planName: null,
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [formData, setFormData] = useState<MealPlanFormData>({
    name: "",
    description: "",
    goal: "",
    duration_days: 1,
    estimated_daily_calories: null,
    is_public: true,
  });

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

  useEffect(() => {
    let isMounted = true;
    const loadPlans = async () => {
      setIsLoadingMealPlans(true);
      const result = await fetchMealPlans();
      if (!isMounted) {
        return;
      }
      if (result.success && result.data) {
        setMealPlans(result.data);
        setMealPlansError(null);
      } else {
        setMealPlans([]);
        setMealPlansError(result.error || "Unable to load meal plans");
      }
      setIsLoadingMealPlans(false);
    };
    if (isAuthenticated && isAdmin) {
      loadPlans();
    }
    return () => {
      isMounted = false;
    };
  }, [fetchMealPlans, isAdmin, isAuthenticated]);

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

  const handleCreateClick = () => {
    setFormData({
      name: "",
      description: "",
      goal: "",
      duration_days: 1,
      estimated_daily_calories: null,
      is_public: true,
    });
    setEditingPlan(null);
    setShowCreateDialog(true);
  };

  const handleEditClick = (plan: GeneralMealPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData({
      name: plan.name,
      description: plan.description || "",
      goal: plan.goal || "",
      duration_days: plan.duration_days,
      estimated_daily_calories: plan.estimated_daily_calories,
      is_public: plan.is_public,
    });
    setEditingPlan(plan);
    setShowCreateDialog(true);
  };

  const handleDeleteClick = (plan: GeneralMealPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog({
      visible: true,
      planId: plan.id,
      planName: plan.name,
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast("error", "Validation Error", "Meal plan name is required");
      return;
    }

    if (formData.duration_days < 1) {
      showToast("error", "Validation Error", "Duration must be at least 1 day");
      return;
    }

    if (
      formData.estimated_daily_calories !== null &&
      formData.estimated_daily_calories < 0
    ) {
      showToast(
        "error",
        "Validation Error",
        "Estimated daily calories cannot be negative"
      );
      return;
    }

    setIsSaving(true);
    try {
      if (editingPlan) {
        const result = await updateMealPlan(editingPlan.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          goal: formData.goal.trim() || null,
          duration_days: formData.duration_days,
          estimated_daily_calories: formData.estimated_daily_calories,
          is_public: formData.is_public,
        });

        if (result.success) {
          showToast("success", "Success", "Meal plan updated successfully");
          setShowCreateDialog(false);
          setEditingPlan(null);
          // Reset form
          setFormData({
            name: "",
            description: "",
            goal: "",
            duration_days: 1,
            estimated_daily_calories: null,
            is_public: true,
          });
          const loadResult = await fetchMealPlans();
          if (loadResult.success && loadResult.data) {
            setMealPlans(loadResult.data);
          }
        } else {
          showToast(
            "error",
            "Error",
            result.error || "Failed to update meal plan"
          );
        }
      } else {
        const result = await createMealPlan({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          goal: formData.goal.trim() || null,
          duration_days: formData.duration_days,
          estimated_daily_calories: formData.estimated_daily_calories,
          is_public: formData.is_public,
          created_by: user?.id || null,
        });

        if (result.success && result.data) {
          showToast("success", "Success", "Meal plan created successfully");
          setShowCreateDialog(false);
          setEditingPlan(null);
          // Reset form
          setFormData({
            name: "",
            description: "",
            goal: "",
            duration_days: 1,
            estimated_daily_calories: null,
            is_public: true,
          });
          // Refresh the list
          const loadResult = await fetchMealPlans();
          if (loadResult.success && loadResult.data) {
            setMealPlans(loadResult.data);
          }
        } else {
          const errorMessage =
            result.error || "Failed to create meal plan. Please try again.";
          showToast("error", "Error", errorMessage);
        }
      }
    } catch (error: any) {
      showToast(
        "error",
        "Error",
        error.message || "An unexpected error occurred"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteDialog.planId) return;

    setIsDeleting(true);
    try {
      const result = await deleteMealPlan(showDeleteDialog.planId);
      if (result.success) {
        showToast("success", "Success", "Meal plan deleted successfully");
        setShowDeleteDialog({ visible: false, planId: null, planName: null });
        const loadResult = await fetchMealPlans();
        if (loadResult.success && loadResult.data) {
          setMealPlans(loadResult.data);
        }
      } else {
        showToast(
          "error",
          "Error",
          result.error || "Failed to delete meal plan"
        );
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

  const formatCalories = (value: number | null) => {
    if (!value || Number.isNaN(value)) {
      return "—";
    }
    return new Intl.NumberFormat("en-US").format(value);
  };

  const formatDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  if (!isAuthenticated || !isAdmin) {
    if (!isLoading && !isLoadingRole) {
      return null;
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <main className="mx-auto max-w-6xl px-6 py-8">
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
                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => router.push("/admin/general/nutrition")}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                  >
                    <HiArrowLeft className="h-5 w-5" />
                  </button>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
                  General Meal Plans
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  Manage meal plans with daily meal schedules and nutritional
                  goals
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Role: Admin</span>
                </div>
              </div>
              <div className="h-1 bg-[#f59e0b] rounded-full w-16 mt-1" />
            </div>
            <div className="mt-2 flex items-center gap-3 mb-4 ">
              <button
                type="button"
                onClick={handleCreateClick}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md"
              >
                <HiPlus className="h-4 w-4" />
                Create Meal Plan
              </button>
              <div className="flex items-center gap-2 text-xs text-slate-500 sm:text-sm">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                <span>{mealPlans.length} plans available</span>
              </div>
            </div>

            {/* Base Nutrition Card */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => router.push("/admin/general/nutrition")}
                className="group w-full flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                      Base Data
                    </span>
                    <h3 className="mt-3 text-lg font-semibold text-slate-900">
                      Base Nutrition Library
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Manage base foods, recipes, and meals that can be used in
                      meal plans.
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl">
                    📚
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-700">
                  <span className="transition-transform group-hover:translate-x-1">
                    View Base Foods, Recipes & Meals
                  </span>
                  <span aria-hidden>&rarr;</span>
                </div>
              </button>
            </div>

            {mealPlansError && (
              <p className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {mealPlansError}
              </p>
            )}
            {isLoadingMealPlans ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`plan-skeleton-${index}`}
                    className="animate-pulse rounded-2xl border border-slate-100 bg-white/60 p-5 shadow-inner"
                  >
                    <div className="h-4 w-1/3 rounded bg-slate-200" />
                    <div className="mt-3 h-6 w-2/3 rounded bg-slate-200" />
                    <div className="mt-4 space-y-2">
                      <div className="h-3 w-full rounded bg-slate-100" />
                      <div className="h-3 w-3/4 rounded bg-slate-100" />
                      <div className="h-3 w-1/2 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : mealPlans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center">
                <p className="text-sm text-slate-500">
                  No meal plans available. Create your first meal plan to get
                  started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {mealPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="group relative flex h-full flex-col justify-between rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/admin/general/nutrition/plans/${plan.id}`)
                      }
                      className="flex h-full flex-col justify-between text-left"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            {plan.goal || "General"}
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {plan.duration_days}d
                          </span>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-slate-900">
                          {plan.name}
                        </h3>
                        <p className="mt-2 text-sm text-slate-600 line-clamp-3">
                          {plan.description || "No description provided."}
                        </p>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                          🔥 {formatCalories(plan.estimated_daily_calories)}{" "}
                          kcal/day
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                          🗓️ {plan.duration_days} days
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                          📅 {formatDate(plan.created_at)}
                        </span>
                      </div>
                    </button>
                    <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => handleEditClick(plan, e)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 transition hover:bg-amber-200"
                        title="Edit meal plan"
                      >
                        <HiPencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(plan, e)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-700 transition hover:bg-rose-200"
                        title="Delete meal plan"
                      >
                        <HiTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Create/Edit Dialog */}
      <Dialog
        visible={showCreateDialog}
        onDismiss={() => {
          if (!isSaving) {
            setShowCreateDialog(false);
            setEditingPlan(null);
            // Reset form when closing
            setFormData({
              name: "",
              description: "",
              goal: "",
              duration_days: 1,
              estimated_daily_calories: null,
              is_public: true,
            });
          }
        }}
        dismissible={!isSaving}
        maxWidth={600}
      >
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            {editingPlan ? "Edit Meal Plan" : "Create Meal Plan"}
          </h3>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Enter meal plan name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Enter meal plan description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Goal
            </label>
            <input
              type="text"
              value={formData.goal}
              onChange={(e) =>
                setFormData({ ...formData, goal: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="e.g., Weight Loss, Muscle Gain"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Duration (days)
              </label>
              <input
                type="number"
                min="1"
                value={formData.duration_days}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    duration_days: parseInt(e.target.value) || 1,
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Daily Calories
              </label>
              <input
                type="number"
                min="0"
                value={formData.estimated_daily_calories || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    estimated_daily_calories: e.target.value
                      ? parseInt(e.target.value)
                      : null,
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                if (!isSaving) {
                  setShowCreateDialog(false);
                  setEditingPlan(null);
                  setFormData({
                    name: "",
                    description: "",
                    goal: "",
                    duration_days: 1,
                    estimated_daily_calories: null,
                    is_public: true,
                  });
                }
              }}
              disabled={isSaving}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !formData.name.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : editingPlan ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        visible={showDeleteDialog.visible}
        onDismiss={() => {
          if (!isDeleting) {
            setShowDeleteDialog({
              visible: false,
              planId: null,
              planName: null,
            });
          }
        }}
        dismissible={!isDeleting}
        maxWidth={500}
      >
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            Delete Meal Plan
          </h3>
          <p className="text-sm text-slate-600">
            Are you sure you want to delete the meal plan{" "}
            <span className="font-semibold text-slate-900">
              {showDeleteDialog.planName}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() =>
                setShowDeleteDialog({
                  visible: false,
                  planId: null,
                  planName: null,
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
    </div>
  );
}

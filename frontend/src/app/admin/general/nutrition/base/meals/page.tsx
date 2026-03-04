"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminSupabase } from "@/hooks/useAdminSupabase";
import { useCoachMealData } from "@/hooks/useCoachMealData";
import Image from "next/image";
import Loader from "@/components/Loader";
import Dialog from "@/components/Dialog";
import Toast, { ToastProps } from "@/components/Toast";
import { HiArrowLeft, HiEye, HiPlus, HiTrash, HiPencil } from "react-icons/hi2";
import {
  CoachMeal,
  CoachMealFull,
  CoachMealItemWithDetails,
} from "@/types/CoachMeal";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

interface MealFormData {
  name: string;
  description: string | null;
  typical_time_of_day: string | null;
  goal: string | null;
  is_public: boolean;
}

export default function BaseMealsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const adminClient = useAdminSupabase();
  const { fetchMeals, fetchMealFull } = useCoachMealData();
  const [meals, setMeals] = useState<CoachMeal[]>([]);
  const [mealsWithItems, setMealsWithItems] = useState<CoachMealFull[]>([]);
  const [isLoadingMeals, setIsLoadingMeals] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const [editingMeal, setEditingMeal] = useState<CoachMeal | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<{
    visible: boolean;
    mealId: string | null;
    mealName: string | null;
    mealIds: string[] | null;
  }>({
    visible: false,
    mealId: null,
    mealName: null,
    mealIds: null,
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [selectedMeals, setSelectedMeals] = useState<string[]>([]);
  const [formData, setFormData] = useState<MealFormData>({
    name: "",
    description: null,
    typical_time_of_day: null,
    goal: null,
    is_public: true,
  });
  const hasCheckedAuth = useRef(false);

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

  const loadMeals = async () => {
    try {
      setIsLoadingMeals(true);
      setError(null);

      // Fetch all meals
      const mealsResult = await fetchMeals();
      if (!mealsResult.success || !mealsResult.data) {
        throw new Error(mealsResult.error || "Failed to fetch meals");
      }

      setMeals(mealsResult.data);

      // Fetch full details (with items) for each meal
      const mealsFullPromises = mealsResult.data.map((meal) =>
        fetchMealFull(meal.id)
      );
      const mealsFullResults = await Promise.all(mealsFullPromises);

      const mealsWithItemsData = mealsFullResults
        .filter((result) => result.success && result.data)
        .map((result) => result.data!);

      setMealsWithItems(mealsWithItemsData);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading meals");
      console.error("Error loading meals:", err);
    } finally {
      setIsLoadingMeals(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      loadMeals();
    }
  }, [isAuthenticated, isAdmin, fetchMeals, fetchMealFull]);

  const showToast = (
    type: "success" | "error",
    title: string,
    message: string
  ) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const handleCreateClick = () => {
    setFormData({
      name: "",
      description: null,
      typical_time_of_day: null,
      goal: null,
      is_public: true,
    });
    setEditingMeal(null);
    setShowCreateDialog(true);
  };

  const handleEditClick = (meal: CoachMeal) => {
    setFormData({
      name: meal.name,
      description: meal.description,
      typical_time_of_day: meal.typical_time_of_day,
      goal: meal.goal,
      is_public: meal.is_public,
    });
    setEditingMeal(meal);
    setShowCreateDialog(true);
  };

  const handleSave = async () => {
    if (!adminClient) {
      showToast("error", "Error", "Admin client not available");
      return;
    }

    if (!formData.name.trim()) {
      showToast("error", "Validation Error", "Meal name is required");
      return;
    }

    try {
      setIsSaving(true);

      if (editingMeal) {
        // Update existing meal
        const { error: updateError } = await adminClient
          .from("base_meals")
          .update({
            name: formData.name.trim(),
            description: formData.description?.trim() || null,
            typical_time_of_day: formData.typical_time_of_day?.trim() || null,
            goal: formData.goal?.trim() || null,
            is_public: formData.is_public,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingMeal.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new meal
        const { error: insertError } = await adminClient
          .from("base_meals")
          .insert({
            name: formData.name.trim(),
            description: formData.description?.trim() || null,
            typical_time_of_day: formData.typical_time_of_day?.trim() || null,
            goal: formData.goal?.trim() || null,
            is_public: formData.is_public,
          });

        if (insertError) {
          throw insertError;
        }
      }

      // Refresh data
      await loadMeals();

      const wasEditing = !!editingMeal;

      // Close dialog first
      setShowCreateDialog(false);
      setEditingMeal(null);

      // Show success toast after dialog closes fully
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (wasEditing) {
            showToast("success", "Success", "Meal updated successfully");
          } else {
            showToast("success", "Success", "Meal created successfully");
          }
        }, 500);
      });
    } catch (err: any) {
      console.error("Error saving meal:", err);
      const errorMessage =
        err?.message || err?.details || err?.hint || "Failed to save meal";

      // Close dialog first if it's still open
      if (showCreateDialog) {
        setShowCreateDialog(false);
        setEditingMeal(null);

        // Show error toast after dialog closes fully
        requestAnimationFrame(() => {
          setTimeout(() => {
            showToast("error", "Error", errorMessage);
          }, 500);
        });
      } else {
        // Dialog already closed, show toast immediately
        showToast("error", "Error", errorMessage);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (meal: CoachMeal) => {
    setShowDeleteDialog({
      visible: true,
      mealId: meal.id,
      mealName: meal.name,
      mealIds: null,
    });
  };

  const handleDeleteSelectedClick = () => {
    if (selectedMeals.length === 0) return;
    setShowDeleteDialog({
      visible: true,
      mealId: null,
      mealName: null,
      mealIds: selectedMeals,
    });
  };

  const handleDelete = async () => {
    if (!adminClient) {
      return;
    }

    const mealIdsToDelete =
      showDeleteDialog.mealIds ||
      (showDeleteDialog.mealId ? [showDeleteDialog.mealId] : []);

    if (mealIdsToDelete.length === 0) {
      return;
    }

    try {
      setIsDeleting(true);

      const { error: deleteError } = await adminClient
        .from("base_meals")
        .delete()
        .in("id", mealIdsToDelete);

      if (deleteError) {
        throw deleteError;
      }

      // Clear selections
      setSelectedMeals([]);

      // Refresh data
      await loadMeals();

      const count = mealIdsToDelete.length;

      // Close dialog first
      setShowDeleteDialog({
        visible: false,
        mealId: null,
        mealName: null,
        mealIds: null,
      });

      // Show success toast after dialog closes fully
      requestAnimationFrame(() => {
        setTimeout(() => {
          showToast(
            "success",
            "Success",
            `${count} meal${count > 1 ? "s" : ""} deleted successfully`
          );
        }, 500);
      });
    } catch (err: any) {
      console.error("Error deleting meal:", err);
      const errorMessage =
        err?.message || err?.details || err?.hint || "Failed to delete meal";

      // Close dialog first
      setShowDeleteDialog({
        visible: false,
        mealId: null,
        mealName: null,
        mealIds: null,
      });

      // Show error toast after dialog closes fully
      requestAnimationFrame(() => {
        setTimeout(() => {
          showToast("error", "Error", errorMessage);
        }, 500);
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleMealSelection = (mealId: string) => {
    setSelectedMeals((prev) =>
      prev.includes(mealId)
        ? prev.filter((id) => id !== mealId)
        : [...prev, mealId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedMeals.length === meals.length) {
      setSelectedMeals([]);
    } else {
      setSelectedMeals(meals.map((meal) => meal.id));
    }
  };

  if (!isAuthenticated || !isAdmin) {
    if (!isLoading && !isLoadingRole) {
      return null; // Will redirect
    }
  }

  const formatMealItem = (item: CoachMealItemWithDetails): string => {
    if (item.item_type === "recipe" && item.recipe) {
      const quantity = item.quantity ? `${item.quantity} ` : "";
      const unit = item.unit ? item.unit : "";
      return `${quantity}${unit} ${item.recipe.name}`.trim();
    } else if (item.item_type === "food" && item.food) {
      const quantity = item.quantity ? `${item.quantity} ` : "";
      const unit = item.unit ? item.unit : "";
      return `${quantity}${unit} ${item.food.name}`.trim();
    }
    return "Unknown item";
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading || isLoadingRole || isLoadingMeals ? (
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
                  Base Meal Management
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  Browse and manage meal templates combining foods and recipes
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Role: Admin</span>
                </div>
              </div>
              <div className="h-1 bg-[#f59e0b] rounded-full w-16 mt-1" />
            </div>

            {/* Actions Bar */}
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={
                    meals.length > 0 && selectedMeals.length === meals.length
                  }
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-sm text-slate-600">
                  Select All ({selectedMeals.length} selected)
                </span>
              </div>
              <div className="flex gap-2">
                {selectedMeals.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteSelectedClick}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white shadow-md transition-colors hover:bg-red-700"
                  >
                    <HiTrash className="text-lg" />
                    Delete Selected ({selectedMeals.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCreateClick}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 font-medium text-white shadow-md transition-all hover:from-violet-600 hover:to-purple-700"
                >
                  <HiPlus className="text-lg" />
                  Add New Meal
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                {error}
              </div>
            )}

            {/* Meals Grid */}
            {mealsWithItems.length === 0 ? (
              <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
                <p className="text-slate-500">
                  No meals found. Create meals to get started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {mealsWithItems.map((meal) => (
                  <div
                    key={meal.id}
                    className="group flex flex-col rounded-2xl border border-violet-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg"
                  >
                    {/* Meal Header */}
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedMeals.includes(meal.id)}
                            onChange={() => toggleMealSelection(meal.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                          />
                          <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                            {meal.typical_time_of_day || "Meal"}
                          </span>
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-slate-900">
                          {meal.name}
                        </h3>
                        {meal.description && (
                          <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                            {meal.description}
                          </p>
                        )}
                        {meal.goal && (
                          <p className="mt-2 text-xs text-slate-500">
                            Goal: {meal.goal}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(meal);
                            }}
                            className="text-violet-600 transition-colors hover:text-violet-900"
                            title="Edit"
                          >
                            <HiPencil className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(meal);
                            }}
                            className="text-red-600 transition-colors hover:text-red-900"
                            title="Delete"
                          >
                            <HiTrash className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Meal Items */}
                    <div className="mb-4 flex-1">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Meal Items ({meal.items?.length || 0})
                      </h4>
                      {meal.items && meal.items.length > 0 ? (
                        <ul className="space-y-1.5">
                          {meal.items.slice(0, 5).map((item, index) => (
                            <li
                              key={item.id}
                              className="flex items-center gap-2 text-sm text-slate-700"
                            >
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-xs font-medium text-violet-700">
                                {index + 1}
                              </span>
                              <span className="flex-1 truncate">
                                {formatMealItem(item)}
                              </span>
                            </li>
                          ))}
                          {meal.items.length > 5 && (
                            <li className="pl-7 text-xs text-slate-500">
                              +{meal.items.length - 5} more item
                              {meal.items.length - 5 > 1 ? "s" : ""}
                            </li>
                          )}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-400">
                          No items in this meal
                        </p>
                      )}
                    </div>

                    {/* View Meal Button */}
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/admin/general/nutrition/base/meals/${meal.id}`
                        )
                      }
                      className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-violet-600 hover:to-purple-700"
                    >
                      <HiEye className="text-lg" />
                      View Meal
                    </button>
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
            setEditingMeal(null);
            setFormData({
              name: "",
              description: null,
              typical_time_of_day: null,
              goal: null,
              is_public: true,
            });
          }
        }}
        dismissible={!isSaving}
        maxWidth="80vw"
      >
        <div>
          <h3 className="mb-4 text-2xl font-bold text-slate-900">
            {editingMeal ? "Edit Meal" : "Create New Meal"}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-violet-500"
                placeholder="Enter meal name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    description: e.target.value || null,
                  })
                }
                rows={3}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-violet-500"
                placeholder="Enter meal description (optional)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Typical Time of Day
                </label>
                <input
                  type="text"
                  value={formData.typical_time_of_day || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      typical_time_of_day: e.target.value || null,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-violet-500"
                  placeholder="e.g., Breakfast, Lunch, Dinner"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Goal
                </label>
                <input
                  type="text"
                  value={formData.goal || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      goal: e.target.value || null,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-violet-500"
                  placeholder="e.g., Weight Loss, Muscle Gain"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_public"
                checked={formData.is_public}
                onChange={(e) =>
                  setFormData({ ...formData, is_public: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <label
                htmlFor="is_public"
                className="ml-2 block text-sm font-medium text-slate-700"
              >
                Public
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingMeal(null);
                setFormData({
                  name: "",
                  description: null,
                  typical_time_of_day: null,
                  goal: null,
                  is_public: true,
                });
              }}
              disabled={isSaving}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-violet-600 hover:to-purple-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : editingMeal ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        visible={showDeleteDialog.visible}
        onDismiss={() =>
          !isDeleting &&
          setShowDeleteDialog({
            visible: false,
            mealId: null,
            mealName: null,
            mealIds: null,
          })
        }
        dismissible={!isDeleting}
        maxWidth="80vw"
      >
        <div>
          <h3 className="mb-4 text-2xl font-bold text-slate-900">
            Delete Meal
            {showDeleteDialog.mealIds && showDeleteDialog.mealIds.length > 1
              ? "s"
              : ""}
          </h3>
          <p className="mb-6 text-slate-700">
            Are you sure you want to delete
            {showDeleteDialog.mealIds && showDeleteDialog.mealIds.length > 1
              ? ` these ${showDeleteDialog.mealIds.length} meals`
              : showDeleteDialog.mealName
              ? ` "${showDeleteDialog.mealName}"`
              : " this meal"}
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setShowDeleteDialog({
                  visible: false,
                  mealId: null,
                  mealName: null,
                  mealIds: null,
                })
              }
              disabled={isDeleting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-red-700 disabled:opacity-50"
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

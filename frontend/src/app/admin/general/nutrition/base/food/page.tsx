"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminSupabase } from "@/hooks/useAdminSupabase";
import Image from "next/image";
import Loader from "@/components/Loader";
import Dialog from "@/components/Dialog";
import Toast, { ToastProps } from "@/components/Toast";
import { HiArrowLeft, HiPencil, HiTrash, HiPlus } from "react-icons/hi2";
import { CoachFood } from "@/types/CoachMeal";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

interface FoodFormData {
  name: string;
  brand: string | null;
  serving_size: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  is_active: boolean;
}

export default function BaseFoodPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const adminClient = useAdminSupabase();
  const [foods, setFoods] = useState<CoachFood[]>([]);
  const [isLoadingFoods, setIsLoadingFoods] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const [editingFood, setEditingFood] = useState<CoachFood | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<{
    visible: boolean;
    foodId: string | null;
    foodName: string | null;
    foodIds: string[] | null;
  }>({
    visible: false,
    foodId: null,
    foodName: null,
    foodIds: null,
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [selectedFoods, setSelectedFoods] = useState<string[]>([]);
  const [formData, setFormData] = useState<FoodFormData>({
    name: "",
    brand: null,
    serving_size: null,
    calories: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    is_active: true,
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

  useEffect(() => {
    const fetchData = async () => {
      if (!adminClient) {
        setIsLoadingFoods(false);
        return;
      }

      try {
        setIsLoadingFoods(true);
        setError(null);

        const { data: foodsData, error: foodsError } = await adminClient
          .from("base_foods")
          .select("*")
          .order("name", { ascending: true });

        if (foodsError) {
          throw foodsError;
        }

        setFoods(foodsData || []);
      } catch (err: any) {
        console.error("Error fetching foods:", err);
        setError(err.message || "Failed to fetch foods");
        showToast("error", "Error", err.message || "Failed to fetch foods");
      } finally {
        setIsLoadingFoods(false);
      }
    };

    if (adminClient && isAdmin) {
      fetchData();
    }
  }, [adminClient, isAdmin]);

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
      brand: null,
      serving_size: null,
      calories: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      is_active: true,
    });
    setEditingFood(null);
    setShowCreateDialog(true);
  };

  const handleEditClick = (food: CoachFood) => {
    setFormData({
      name: food.name,
      brand: food.brand,
      serving_size: food.serving_size,
      calories: food.calories,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
      is_active: food.is_active,
    });
    setEditingFood(food);
    setShowCreateDialog(true);
  };

  const handleDeleteClick = (food: CoachFood) => {
    setShowDeleteDialog({
      visible: true,
      foodId: food.id,
      foodName: food.name,
      foodIds: null,
    });
  };

  const handleDeleteSelectedClick = () => {
    if (selectedFoods.length === 0) return;
    setShowDeleteDialog({
      visible: true,
      foodId: null,
      foodName:
        selectedFoods.length === 1
          ? foods.find((f) => f.id === selectedFoods[0])?.name || null
          : null,
      foodIds: selectedFoods,
    });
  };

  const toggleFoodSelection = (foodId: string) => {
    setSelectedFoods((prev) =>
      prev.includes(foodId)
        ? prev.filter((id) => id !== foodId)
        : [...prev, foodId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedFoods.length === foods.length) {
      setSelectedFoods([]);
    } else {
      setSelectedFoods(foods.map((f) => f.id));
    }
  };

  const handleSave = async () => {
    if (!adminClient) {
      showToast("error", "Error", "Admin client not available");
      return;
    }

    if (!formData.name.trim()) {
      showToast("error", "Validation Error", "Name is required");
      return;
    }

    try {
      setIsSaving(true);

      if (editingFood) {
        // Update existing food
        const { error: updateError } = await adminClient
          .from("base_foods")
          .update({
            name: formData.name.trim(),
            brand: formData.brand?.trim() || null,
            serving_size: formData.serving_size?.trim() || null,
            calories: formData.calories ? Number(formData.calories) : null,
            protein_g: formData.protein_g ? Number(formData.protein_g) : null,
            carbs_g: formData.carbs_g ? Number(formData.carbs_g) : null,
            fat_g: formData.fat_g ? Number(formData.fat_g) : null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingFood.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new food
        const { error: insertError } = await adminClient
          .from("base_foods")
          .insert({
            name: formData.name.trim(),
            brand: formData.brand?.trim() || null,
            serving_size: formData.serving_size?.trim() || null,
            calories: formData.calories ? Number(formData.calories) : null,
            protein_g: formData.protein_g ? Number(formData.protein_g) : null,
            carbs_g: formData.carbs_g ? Number(formData.carbs_g) : null,
            fat_g: formData.fat_g ? Number(formData.fat_g) : null,
            is_active: formData.is_active,
          });

        if (insertError) {
          throw insertError;
        }
      }

      // Refresh data
      const { data: foodsData, error: foodsError } = await adminClient
        .from("base_foods")
        .select("*")
        .order("name", { ascending: true });

      if (foodsError) {
        throw foodsError;
      }

      setFoods(foodsData || []);
      const wasEditing = !!editingFood;

      // Close dialog first
      setShowCreateDialog(false);
      setEditingFood(null);

      // Show success toast after dialog closes fully
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (wasEditing) {
            showToast("success", "Success", "Food updated successfully");
          } else {
            showToast("success", "Success", "Food created successfully");
          }
        }, 500);
      });
    } catch (err: any) {
      console.error("Error saving food:", err);
      const errorMessage =
        err?.message || err?.details || err?.hint || "Failed to save food";

      // Close dialog first if it's still open
      if (showCreateDialog) {
        setShowCreateDialog(false);
        setEditingFood(null);

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

  const handleDelete = async () => {
    if (!adminClient) {
      return;
    }

    const foodIdsToDelete =
      showDeleteDialog.foodIds ||
      (showDeleteDialog.foodId ? [showDeleteDialog.foodId] : []);

    if (foodIdsToDelete.length === 0) {
      return;
    }

    try {
      setIsDeleting(true);

      const { error: deleteError } = await adminClient
        .from("base_foods")
        .delete()
        .in("id", foodIdsToDelete);

      if (deleteError) {
        throw deleteError;
      }

      // Clear selections
      setSelectedFoods([]);

      // Refresh data
      const { data: foodsData, error: foodsError } = await adminClient
        .from("base_foods")
        .select("*")
        .order("name", { ascending: true });

      if (!foodsError && foodsData) {
        setFoods(foodsData);
      }

      const count = foodIdsToDelete.length;

      // Close dialog first
      setShowDeleteDialog({
        visible: false,
        foodId: null,
        foodName: null,
        foodIds: null,
      });

      // Show success toast after dialog closes fully
      requestAnimationFrame(() => {
        setTimeout(() => {
          showToast(
            "success",
            "Success",
            `${count} food${count > 1 ? "s" : ""} deleted successfully`
          );
        }, 500);
      });
    } catch (err: any) {
      console.error("Error deleting food:", err);
      const errorMessage = formatConstraintError(err, "food");

      // Close dialog first
      setShowDeleteDialog({
        visible: false,
        foodId: null,
        foodName: null,
        foodIds: null,
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

  const formatConstraintError = (err: any, entityName: string): string => {
    const errorMessage = err?.message || err?.details || err?.hint || "";

    // Check if it's a foreign key constraint error
    if (
      errorMessage.includes("foreign key") ||
      errorMessage.includes("violates foreign key") ||
      errorMessage.includes("constraint") ||
      err?.code === "23503" ||
      err?.code === "23505"
    ) {
      // Try to extract referenced table/entity from error message
      let referencedEntity = "";

      const tableMatch =
        errorMessage.match(/table\s+["']?(\w+)["']?/i) ||
        errorMessage.match(/from\s+["']?(\w+)["']?/i) ||
        errorMessage.match(/in\s+["']?(\w+)["']?/i);

      if (tableMatch && tableMatch[1]) {
        const tableName = tableMatch[1];
        referencedEntity = tableName
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l: string) => l.toUpperCase());
      } else {
        referencedEntity = "recipes or meals";
      }

      return `Delete not allowed at this time, ${entityName} is associated with ${referencedEntity}`;
    }

    return errorMessage || `Failed to delete ${entityName}`;
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
        {isLoading || isLoadingRole || isLoadingFoods ? (
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
                  Base Food Management
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  Manage base food items with nutritional information
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Role: Admin</span>
                </div>
              </div>
              <div className="h-1 bg-[#f59e0b] rounded-full w-16 mt-1" />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                {error}
              </div>
            )}

            {/* Actions Bar */}
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={
                    foods.length > 0 && selectedFoods.length === foods.length
                  }
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-slate-600">
                  Select All ({selectedFoods.length} selected)
                </span>
              </div>
              <div className="flex gap-2">
                {selectedFoods.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteSelectedClick}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white shadow-md transition-colors hover:bg-red-700"
                  >
                    <HiTrash className="text-lg" />
                    Delete Selected ({selectedFoods.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCreateClick}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#00b3b3] to-[#009898] px-4 py-2 font-medium text-white shadow-md transition-all hover:from-[#00a1a1] hover:to-[#008787]"
                >
                  <HiPlus className="text-lg" />
                  Add New Food
                </button>
              </div>
            </div>

            {/* Foods Table */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Select
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Brand
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Serving Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Calories
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Protein (g)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Carbs (g)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Fat (g)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {foods.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-6 py-8 text-center text-slate-500"
                        >
                          No foods found. Click "Add New Food" to create one.
                        </td>
                      </tr>
                    ) : (
                      foods.map((food) => (
                        <tr
                          key={food.id}
                          className="transition-colors hover:bg-slate-50"
                        >
                          <td className="whitespace-nowrap px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedFoods.includes(food.id)}
                              onChange={() => toggleFoodSelection(food.id)}
                              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                            {food.name}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                            {food.brand || "-"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                            {food.serving_size || "-"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                            {food.calories !== null ? food.calories : "-"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                            {food.protein_g !== null ? food.protein_g : "-"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                            {food.carbs_g !== null ? food.carbs_g : "-"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                            {food.fat_g !== null ? food.fat_g : "-"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                food.is_active
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-100 text-slate-800"
                              }`}
                            >
                              {food.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditClick(food)}
                                className="text-teal-600 transition-colors hover:text-teal-900"
                                title="Edit"
                              >
                                <HiPencil className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(food)}
                                className="text-red-600 transition-colors hover:text-red-900"
                                title="Delete"
                              >
                                <HiTrash className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Create/Edit Dialog */}
      <Dialog
        visible={showCreateDialog}
        onDismiss={() => {
          if (!isSaving) {
            setShowCreateDialog(false);
            setEditingFood(null);
            // Reset form when closing
            setFormData({
              name: "",
              brand: null,
              serving_size: null,
              calories: null,
              protein_g: null,
              carbs_g: null,
              fat_g: null,
              is_active: true,
            });
          }
        }}
        dismissible={!isSaving}
        maxWidth="80vw"
      >
        <div>
          <h3 className="mb-4 text-2xl font-bold text-slate-900">
            {editingFood ? "Edit Food" : "Create New Food"}
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
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-teal-500"
                placeholder="Enter food name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Brand
              </label>
              <input
                type="text"
                value={formData.brand || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    brand: e.target.value || null,
                  })
                }
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-teal-500"
                placeholder="Enter brand name (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Serving Size
              </label>
              <input
                type="text"
                value={formData.serving_size || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    serving_size: e.target.value || null,
                  })
                }
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-teal-500"
                placeholder="e.g., 100g, 1 cup (optional)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Calories
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.calories || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      calories: e.target.value
                        ? parseFloat(e.target.value)
                        : null,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-teal-500"
                  placeholder="Calories"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Protein (g)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.protein_g || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      protein_g: e.target.value
                        ? parseFloat(e.target.value)
                        : null,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-teal-500"
                  placeholder="Protein (g)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Carbs (g)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.carbs_g || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      carbs_g: e.target.value
                        ? parseFloat(e.target.value)
                        : null,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-teal-500"
                  placeholder="Carbs (g)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Fat (g)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.fat_g || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fat_g: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-teal-500"
                  placeholder="Fat (g)"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <label
                htmlFor="is_active"
                className="ml-2 block text-sm font-medium text-slate-700"
              >
                Active
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingFood(null);
                // Reset form when canceling
                setFormData({
                  name: "",
                  brand: null,
                  serving_size: null,
                  calories: null,
                  protein_g: null,
                  carbs_g: null,
                  fat_g: null,
                  is_active: true,
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
              className="rounded-lg bg-gradient-to-r from-[#00b3b3] to-[#009898] px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-[#00a1a1] hover:to-[#008787] disabled:opacity-50"
            >
              {isSaving ? "Saving..." : editingFood ? "Update" : "Create"}
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
            foodId: null,
            foodName: null,
            foodIds: null,
          })
        }
        dismissible={!isDeleting}
        maxWidth="80vw"
      >
        <div>
          <h3 className="mb-4 text-2xl font-bold text-slate-900">
            Delete Food
            {showDeleteDialog.foodIds && showDeleteDialog.foodIds.length > 1
              ? "s"
              : ""}
          </h3>
          <p className="mb-6 text-slate-700">
            Are you sure you want to delete
            {showDeleteDialog.foodIds && showDeleteDialog.foodIds.length > 1
              ? ` these ${showDeleteDialog.foodIds.length} foods`
              : showDeleteDialog.foodName
              ? ` "${showDeleteDialog.foodName}"`
              : " this food"}
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setShowDeleteDialog({
                  visible: false,
                  foodId: null,
                  foodName: null,
                  foodIds: null,
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

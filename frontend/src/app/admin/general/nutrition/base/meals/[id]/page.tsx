"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminSupabase } from "@/hooks/useAdminSupabase";
import { useCoachMealData } from "@/hooks/useCoachMealData";
import Image from "next/image";
import Loader from "@/components/Loader";
import Toast, { ToastProps } from "@/components/Toast";
import Dialog from "@/components/Dialog";
import SelectBox from "@/components/SelectBox";
import {
  HiArrowLeft,
  HiPencil,
  HiXMark,
  HiCheck,
  HiPlus,
  HiTrash,
} from "react-icons/hi2";
import {
  CoachMeal,
  CoachMealFull,
  CoachMealItemWithDetails,
  CoachFood,
  CoachRecipe,
  MealItemType,
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

interface MealItemFormData {
  item_type: MealItemType;
  recipe_id: string | null;
  food_id: string | null;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  position: number;
}

export default function MealDetailPage() {
  const router = useRouter();
  const params = useParams();
  const mealId = params.id as string;
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const adminClient = useAdminSupabase();
  const { fetchMealFull, fetchFoods, fetchRecipes } = useCoachMealData();
  const [meal, setMeal] = useState<CoachMealFull | null>(null);
  const [foods, setFoods] = useState<CoachFood[]>([]);
  const [recipes, setRecipes] = useState<CoachRecipe[]>([]);
  const [isLoadingMeal, setIsLoadingMeal] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formData, setFormData] = useState<MealFormData>({
    name: "",
    description: null,
    typical_time_of_day: null,
    goal: null,
    is_public: true,
  });
  const [editingItem, setEditingItem] =
    useState<CoachMealItemWithDetails | null>(null);
  const [showItemDialog, setShowItemDialog] = useState<boolean>(false);
  const [isSavingItem, setIsSavingItem] = useState<boolean>(false);
  const [showDeleteItemDialog, setShowDeleteItemDialog] = useState<{
    visible: boolean;
    item: CoachMealItemWithDetails | null;
  }>({ visible: false, item: null });
  const [isDeletingItem, setIsDeletingItem] = useState<boolean>(false);
  const [itemFormData, setItemFormData] = useState<MealItemFormData>({
    item_type: "food",
    recipe_id: null,
    food_id: null,
    quantity: null,
    unit: null,
    notes: null,
    position: 1,
  });
  const [showFoodDropdown, setShowFoodDropdown] = useState<boolean>(false);
  const [showRecipeDropdown, setShowRecipeDropdown] = useState<boolean>(false);
  const [foodSearchTerm, setFoodSearchTerm] = useState<string>("");
  const [recipeSearchTerm, setRecipeSearchTerm] = useState<string>("");
  const foodDropdownRef = useRef<HTMLDivElement>(null);
  const recipeDropdownRef = useRef<HTMLDivElement>(null);
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
    const loadData = async () => {
      if (!adminClient || !mealId) {
        setIsLoadingMeal(false);
        return;
      }

      try {
        setIsLoadingMeal(true);
        setError(null);

        // Fetch meal with full details
        const mealResult = await fetchMealFull(mealId);
        if (!mealResult.success || !mealResult.data) {
          throw new Error(mealResult.error || "Meal not found");
        }

        setMeal(mealResult.data);
        setFormData({
          name: mealResult.data.name,
          description: mealResult.data.description,
          typical_time_of_day: mealResult.data.typical_time_of_day,
          goal: mealResult.data.goal,
          is_public: mealResult.data.is_public,
        });

        // Fetch foods and recipes for dropdowns
        const foodsResult = await fetchFoods();
        if (foodsResult.success && foodsResult.data) {
          setFoods(foodsResult.data);
        }

        const recipesResult = await fetchRecipes();
        if (recipesResult.success && recipesResult.data) {
          setRecipes(recipesResult.data);
        }
      } catch (err: any) {
        setError(err.message || "An error occurred while loading meal");
        console.error("Error loading meal:", err);
      } finally {
        setIsLoadingMeal(false);
      }
    };

    if (isAuthenticated && isAdmin && mealId) {
      loadData();
    }
  }, [
    isAuthenticated,
    isAdmin,
    mealId,
    adminClient,
    fetchMealFull,
    fetchFoods,
    fetchRecipes,
  ]);

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

  const handleSave = async () => {
    if (!adminClient || !mealId) return;

    if (!formData.name.trim()) {
      showToast("error", "Validation Error", "Meal name is required");
      return;
    }

    try {
      setIsSaving(true);

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
        .eq("id", mealId);

      if (updateError) {
        throw updateError;
      }

      // Refresh meal data
      const mealResult = await fetchMealFull(mealId);
      if (mealResult.success && mealResult.data) {
        setMeal(mealResult.data);
      }

      setIsEditing(false);
      showToast("success", "Success", "Meal updated successfully");
    } catch (err: any) {
      console.error("Error saving meal:", err);
      showToast("error", "Error", err.message || "Failed to update meal");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (meal) {
      setFormData({
        name: meal.name,
        description: meal.description,
        typical_time_of_day: meal.typical_time_of_day,
        goal: meal.goal,
        is_public: meal.is_public,
      });
    }
    setIsEditing(false);
  };

  const handleAddItemClick = () => {
    setEditingItem(null);
    setItemFormData({
      item_type: "food",
      recipe_id: null,
      food_id: null,
      quantity: null,
      unit: null,
      notes: null,
      position: meal?.items ? meal.items.length + 1 : 1,
    });
    setShowItemDialog(true);
  };

  const handleEditItemClick = (item: CoachMealItemWithDetails) => {
    setEditingItem(item);
    setItemFormData({
      item_type: item.item_type,
      recipe_id: item.recipe_id,
      food_id: item.food_id,
      quantity: item.quantity,
      unit: item.unit,
      notes: item.notes,
      position: item.position,
    });
    setShowItemDialog(true);
  };

  const handleSaveItem = async () => {
    if (!adminClient || !mealId) return;

    if (itemFormData.item_type === "food" && !itemFormData.food_id) {
      showToast("error", "Validation Error", "Please select a food");
      return;
    }

    if (itemFormData.item_type === "recipe" && !itemFormData.recipe_id) {
      showToast("error", "Validation Error", "Please select a recipe");
      return;
    }

    try {
      setIsSavingItem(true);

      if (editingItem) {
        // Update existing item
        const { error: updateError } = await adminClient
          .from("base_meal_items")
          .update({
            item_type: itemFormData.item_type,
            recipe_id:
              itemFormData.item_type === "recipe"
                ? itemFormData.recipe_id
                : null,
            food_id:
              itemFormData.item_type === "food" ? itemFormData.food_id : null,
            quantity: itemFormData.quantity,
            unit: itemFormData.unit?.trim() || null,
            notes: itemFormData.notes?.trim() || null,
            position: itemFormData.position,
          })
          .eq("id", editingItem.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new item
        const { error: insertError } = await adminClient
          .from("base_meal_items")
          .insert({
            meal_id: mealId,
            item_type: itemFormData.item_type,
            recipe_id:
              itemFormData.item_type === "recipe"
                ? itemFormData.recipe_id
                : null,
            food_id:
              itemFormData.item_type === "food" ? itemFormData.food_id : null,
            quantity: itemFormData.quantity,
            unit: itemFormData.unit?.trim() || null,
            notes: itemFormData.notes?.trim() || null,
            position: itemFormData.position,
          });

        if (insertError) {
          throw insertError;
        }
      }

      // Refresh meal data
      const mealResult = await fetchMealFull(mealId);
      if (mealResult.success && mealResult.data) {
        setMeal(mealResult.data);
      }

      setShowItemDialog(false);
      setEditingItem(null);
      showToast(
        "success",
        "Success",
        editingItem
          ? "Meal item updated successfully"
          : "Meal item added successfully"
      );
    } catch (err: any) {
      console.error("Error saving meal item:", err);
      showToast("error", "Error", err.message || "Failed to save meal item");
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleDeleteItemClick = (item: CoachMealItemWithDetails) => {
    setShowDeleteItemDialog({ visible: true, item });
  };

  const handleDeleteItem = async () => {
    if (!adminClient || !showDeleteItemDialog.item) return;

    try {
      setIsDeletingItem(true);

      const { error: deleteError } = await adminClient
        .from("base_meal_items")
        .delete()
        .eq("id", showDeleteItemDialog.item.id);

      if (deleteError) {
        throw deleteError;
      }

      // Refresh meal data
      const mealResult = await fetchMealFull(mealId);
      if (mealResult.success && mealResult.data) {
        setMeal(mealResult.data);
      }

      setShowDeleteItemDialog({ visible: false, item: null });
      showToast("success", "Success", "Meal item deleted successfully");
    } catch (err: any) {
      console.error("Error deleting meal item:", err);
      showToast("error", "Error", err.message || "Failed to delete meal item");
    } finally {
      setIsDeletingItem(false);
    }
  };

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

  const filteredFoods = foods.filter((food) => {
    if (!foodSearchTerm.trim()) return true;
    const searchLower = foodSearchTerm.toLowerCase();
    return (
      food.name.toLowerCase().includes(searchLower) ||
      (food.brand && food.brand.toLowerCase().includes(searchLower))
    );
  });

  const filteredRecipes = recipes.filter((recipe) => {
    if (!recipeSearchTerm.trim()) return true;
    const searchLower = recipeSearchTerm.toLowerCase();
    return recipe.name.toLowerCase().includes(searchLower);
  });

  if (!isAuthenticated || !isAdmin) {
    if (!isLoading && !isLoadingRole) {
      return null; // Will redirect
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading || isLoadingRole || isLoadingMeal ? (
          <div className="flex min-h-[calc(100vh-140px)] items-center justify-center">
            <Loader
              size="lg"
              text="Loading..."
              color="green"
              textColor="slate"
            />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        ) : !meal ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
            Meal not found
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
                      router.push("/admin/general/nutrition/base/meals")
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                  >
                    <HiArrowLeft className="h-5 w-5" />
                  </button>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
                  {meal.name}
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  View and manage meal details
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Role: Admin</span>
                </div>
              </div>
              <div className="h-1 bg-[#f59e0b] rounded-full w-16 mt-1" />
            </div>

            {/* Meal Header */}
            <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {isEditing ? (
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
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={isSaving}
                          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-violet-600 hover:to-purple-700 disabled:opacity-50"
                        >
                          <HiCheck className="text-lg" />
                          {isSaving ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                          <HiXMark className="text-lg" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-3">
                            <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                              {meal.typical_time_of_day || "Meal"}
                            </span>
                          </div>
                          <h2 className="mb-2 text-3xl font-extrabold text-slate-900">
                            {meal.name}
                          </h2>
                          {meal.description && (
                            <p className="mb-2 text-slate-600">
                              {meal.description}
                            </p>
                          )}
                          {meal.goal && (
                            <p className="text-sm text-slate-500">
                              Goal: {meal.goal}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="flex items-center gap-2 rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-medium text-violet-700 shadow-sm transition-colors hover:bg-violet-50"
                        >
                          <HiPencil className="text-lg" />
                          Edit Meal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Meal Items Section */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">
                  Meal Items ({meal.items?.length || 0})
                </h3>
                <button
                  type="button"
                  onClick={handleAddItemClick}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-violet-600 hover:to-purple-700"
                >
                  <HiPlus className="text-lg" />
                  Add Item
                </button>
              </div>

              {meal.items && meal.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                          Position
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                          Item
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                          Unit
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                          Notes
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {meal.items.map((item) => (
                        <tr
                          key={item.id}
                          className="transition-colors hover:bg-slate-50"
                        >
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                            {item.position}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                item.item_type === "recipe"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-teal-100 text-teal-800"
                              }`}
                            >
                              {item.item_type === "recipe" ? "Recipe" : "Food"}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm font-medium text-slate-900">
                            {item.item_type === "recipe" && item.recipe
                              ? item.recipe.name
                              : item.item_type === "food" && item.food
                              ? item.food.name
                              : "Unknown"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                            {item.quantity !== null ? item.quantity : "-"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                            {item.unit || "-"}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-600">
                            <div className="max-w-xs truncate">
                              {item.notes || "-"}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditItemClick(item)}
                                className="text-violet-600 transition-colors hover:text-violet-900"
                                title="Edit"
                              >
                                <HiPencil className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItemClick(item)}
                                className="text-red-600 transition-colors hover:text-red-900"
                                title="Delete"
                              >
                                <HiTrash className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                  No items in this meal. Click "Add Item" to get started.
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Add/Edit Meal Item Dialog */}
      <Dialog
        visible={showItemDialog}
        onDismiss={() => {
          if (!isSavingItem) {
            setShowItemDialog(false);
            setEditingItem(null);
            setItemFormData({
              item_type: "food",
              recipe_id: null,
              food_id: null,
              quantity: null,
              unit: null,
              notes: null,
              position: 1,
            });
            setFoodSearchTerm("");
            setRecipeSearchTerm("");
            setShowFoodDropdown(false);
            setShowRecipeDropdown(false);
          }
        }}
        dismissible={!isSavingItem}
        maxWidth="80vw"
      >
        <div>
          <h3 className="mb-4 text-2xl font-bold text-slate-900">
            {editingItem ? "Edit Meal Item" : "Add Meal Item"}
          </h3>
          <div className="space-y-4">
            <SelectBox
              label="Item Type"
              value={itemFormData.item_type}
              onChange={(event) => {
                const newType = event.target.value as MealItemType;
                setItemFormData({
                  ...itemFormData,
                  item_type: newType,
                  recipe_id:
                    newType === "recipe" ? itemFormData.recipe_id : null,
                  food_id: newType === "food" ? itemFormData.food_id : null,
                });
                setShowFoodDropdown(false);
                setShowRecipeDropdown(false);
              }}
              isRequired
            >
              <option value="food">Food</option>
              <option value="recipe">Recipe</option>
            </SelectBox>

            {itemFormData.item_type === "food" ? (
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Food <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={foodDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFoodDropdown(!showFoodDropdown);
                      setShowRecipeDropdown(false);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left shadow-sm focus:border-violet-500 focus:outline-none focus:ring-violet-500"
                  >
                    <span
                      className={
                        itemFormData.food_id
                          ? "text-slate-700"
                          : "text-slate-500"
                      }
                    >
                      {itemFormData.food_id
                        ? foods.find((f) => f.id === itemFormData.food_id)
                            ?.name || "Select a food"
                        : "Select a food"}
                    </span>
                    <span className="float-right text-slate-400">▼</span>
                  </button>
                  {showFoodDropdown && (
                    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-300 bg-white shadow-lg">
                      <div className="p-2">
                        <input
                          type="text"
                          value={foodSearchTerm}
                          onChange={(e) => setFoodSearchTerm(e.target.value)}
                          placeholder="Search foods..."
                          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-violet-500"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredFoods.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-slate-500">
                            No foods found
                          </div>
                        ) : (
                          filteredFoods.map((food) => (
                            <button
                              key={food.id}
                              type="button"
                              onClick={() => {
                                setItemFormData({
                                  ...itemFormData,
                                  food_id: food.id,
                                });
                                setShowFoodDropdown(false);
                                setFoodSearchTerm("");
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-violet-50"
                            >
                              {food.name}
                              {food.brand && (
                                <span className="ml-2 text-xs text-slate-500">
                                  ({food.brand})
                                </span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Recipe <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={recipeDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecipeDropdown(!showRecipeDropdown);
                      setShowFoodDropdown(false);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left shadow-sm focus:border-violet-500 focus:outline-none focus:ring-violet-500"
                  >
                    <span
                      className={
                        itemFormData.recipe_id
                          ? "text-slate-700"
                          : "text-slate-500"
                      }
                    >
                      {itemFormData.recipe_id
                        ? recipes.find((r) => r.id === itemFormData.recipe_id)
                            ?.name || "Select a recipe"
                        : "Select a recipe"}
                    </span>
                    <span className="float-right text-slate-400">▼</span>
                  </button>
                  {showRecipeDropdown && (
                    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-300 bg-white shadow-lg">
                      <div className="p-2">
                        <input
                          type="text"
                          value={recipeSearchTerm}
                          onChange={(e) => setRecipeSearchTerm(e.target.value)}
                          placeholder="Search recipes..."
                          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-violet-500"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredRecipes.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-slate-500">
                            No recipes found
                          </div>
                        ) : (
                          filteredRecipes.map((recipe) => (
                            <button
                              key={recipe.id}
                              type="button"
                              onClick={() => {
                                setItemFormData({
                                  ...itemFormData,
                                  recipe_id: recipe.id,
                                });
                                setShowRecipeDropdown(false);
                                setRecipeSearchTerm("");
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-violet-50"
                            >
                              {recipe.name}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Quantity
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={itemFormData.quantity || ""}
                  onChange={(e) =>
                    setItemFormData({
                      ...itemFormData,
                      quantity: e.target.value
                        ? parseFloat(e.target.value)
                        : null,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-violet-500"
                  placeholder="Quantity"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Unit
                </label>
                <input
                  type="text"
                  value={itemFormData.unit || ""}
                  onChange={(e) =>
                    setItemFormData({
                      ...itemFormData,
                      unit: e.target.value || null,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-violet-500"
                  placeholder="e.g., g, ml, cup"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Position
                </label>
                <input
                  type="number"
                  min="1"
                  value={itemFormData.position}
                  disabled
                  readOnly
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 shadow-sm text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                value={itemFormData.notes || ""}
                onChange={(e) =>
                  setItemFormData({
                    ...itemFormData,
                    notes: e.target.value || null,
                  })
                }
                rows={3}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-violet-500"
                placeholder="Optional notes about this item"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowItemDialog(false);
                setEditingItem(null);
                setItemFormData({
                  item_type: "food",
                  recipe_id: null,
                  food_id: null,
                  quantity: null,
                  unit: null,
                  notes: null,
                  position: 1,
                });
                setFoodSearchTerm("");
                setRecipeSearchTerm("");
                setShowFoodDropdown(false);
                setShowRecipeDropdown(false);
              }}
              disabled={isSavingItem}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveItem}
              disabled={isSavingItem}
              className="rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-violet-600 hover:to-purple-700 disabled:opacity-50"
            >
              {isSavingItem ? "Saving..." : editingItem ? "Update" : "Add"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete Item Confirmation Dialog */}
      <Dialog
        visible={showDeleteItemDialog.visible}
        onDismiss={() =>
          !isDeletingItem &&
          setShowDeleteItemDialog({ visible: false, item: null })
        }
        dismissible={!isDeletingItem}
        maxWidth="80vw"
      >
        <div>
          <h3 className="mb-4 text-2xl font-bold text-slate-900">
            Delete Meal Item
          </h3>
          <p className="mb-6 text-slate-700">
            Are you sure you want to delete this meal item? This action cannot
            be undone.
          </p>
          {showDeleteItemDialog.item && (
            <div className="mb-4 rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">
                {formatMealItem(showDeleteItemDialog.item)}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setShowDeleteItemDialog({ visible: false, item: null })
              }
              disabled={isDeletingItem}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteItem}
              disabled={isDeletingItem}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {isDeletingItem ? "Deleting..." : "Delete"}
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

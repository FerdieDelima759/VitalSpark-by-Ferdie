"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminSupabase } from "@/hooks/useAdminSupabase";
import { useCoachMealData } from "@/hooks/useCoachMealData";
import Image from "next/image";
import Loader from "@/components/Loader";
import Toast, { ToastProps } from "@/components/Toast";
import Dialog from "@/components/Dialog";
import {
  HiArrowLeft,
  HiPencil,
  HiXMark,
  HiCheck,
  HiPlus,
  HiTrash,
} from "react-icons/hi2";
import {
  CoachRecipe,
  CoachRecipeFull,
  CoachRecipeIngredientWithFood,
  CoachFood,
} from "@/types/CoachMeal";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

interface RecipeFormData {
  name: string;
  description: string | null;
  instructions: string | null;
  estimated_prep_minutes: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  is_public: boolean;
}

interface IngredientFormData {
  food_id: string;
  quantity: number;
  unit: string;
}

export default function RecipeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const recipeId = params.id as string;
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const adminClient = useAdminSupabase();
  const { fetchRecipeFull, fetchFoods } = useCoachMealData();
  const [recipe, setRecipe] = useState<CoachRecipeFull | null>(null);
  const [foods, setFoods] = useState<CoachFood[]>([]);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formData, setFormData] = useState<RecipeFormData>({
    name: "",
    description: null,
    instructions: null,
    estimated_prep_minutes: null,
    calories: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    is_public: true,
  });
  const [editingIngredient, setEditingIngredient] =
    useState<CoachRecipeIngredientWithFood | null>(null);
  const [showIngredientDialog, setShowIngredientDialog] =
    useState<boolean>(false);
  const [isSavingIngredient, setIsSavingIngredient] = useState<boolean>(false);
  const [showDeleteIngredientDialog, setShowDeleteIngredientDialog] = useState<{
    visible: boolean;
    ingredient: CoachRecipeIngredientWithFood | null;
  }>({ visible: false, ingredient: null });
  const [isDeletingIngredient, setIsDeletingIngredient] =
    useState<boolean>(false);
  const [ingredientFormData, setIngredientFormData] =
    useState<IngredientFormData>({
      food_id: "",
      quantity: 1,
      unit: "",
    });
  const [showFoodDropdown, setShowFoodDropdown] = useState<boolean>(false);
  const [foodSearchTerm, setFoodSearchTerm] = useState<string>("");
  const foodDropdownRef = useRef<HTMLDivElement>(null);
  const foodInputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
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
      if (!adminClient || !recipeId) {
        setIsLoadingRecipe(false);
        return;
      }

      try {
        setIsLoadingRecipe(true);
        setError(null);

        // Fetch recipe with full details
        const recipeResult = await fetchRecipeFull(recipeId);
        if (!recipeResult.success || !recipeResult.data) {
          throw new Error(recipeResult.error || "Recipe not found");
        }

        setRecipe(recipeResult.data);
        setFormData({
          name: recipeResult.data.name,
          description: recipeResult.data.description,
          instructions: recipeResult.data.instructions,
          estimated_prep_minutes: recipeResult.data.estimated_prep_minutes,
          calories: recipeResult.data.calories,
          protein_g: recipeResult.data.protein_g,
          carbs_g: recipeResult.data.carbs_g,
          fat_g: recipeResult.data.fat_g,
          is_public: recipeResult.data.is_public,
        });

        // Fetch foods for dropdown
        const foodsResult = await fetchFoods();
        if (foodsResult.success && foodsResult.data) {
          setFoods(foodsResult.data);
        }
      } catch (err: any) {
        setError(err.message || "An error occurred while loading recipe");
        console.error("Error loading recipe:", err);
      } finally {
        setIsLoadingRecipe(false);
      }
    };

    if (isAuthenticated && isAdmin && recipeId) {
      loadData();
    }
  }, [
    isAuthenticated,
    isAdmin,
    recipeId,
    adminClient,
    fetchRecipeFull,
    fetchFoods,
  ]);

  // Calculate dropdown position and close when clicking outside
  useEffect(() => {
    const updateDropdownPosition = () => {
      if (foodInputRef.current && showFoodDropdown) {
        const rect = foodInputRef.current.getBoundingClientRect();
        // Position dropdown just below the input field (4px gap, approximately 1cm)
        // getBoundingClientRect() returns viewport coordinates, perfect for fixed positioning
        setDropdownPosition({
          top: rect.bottom + 4, // 4px gap (approximately 1cm at normal zoom)
          left: rect.left,
          width: rect.width,
        });
      }
    };

    if (showFoodDropdown) {
      // Initial position calculation
      updateDropdownPosition();

      // Update on scroll (both window and dialog content)
      const handleScroll = () => updateDropdownPosition();
      window.addEventListener("scroll", handleScroll, true);

      // Update on resize
      window.addEventListener("resize", updateDropdownPosition);

      // Also update when dialog content scrolls
      const dialogContent = document.querySelector(
        '[class*="overflow-y-auto"]'
      );
      if (dialogContent) {
        dialogContent.addEventListener("scroll", handleScroll, true);
      }

      const handleClickOutside = (event: MouseEvent) => {
        if (
          foodInputRef.current &&
          !foodInputRef.current.contains(event.target as Node) &&
          foodDropdownRef.current &&
          !foodDropdownRef.current.contains(event.target as Node)
        ) {
          setShowFoodDropdown(false);
        }
      };

      // Use a small delay to ensure the click event is processed correctly
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 0);

      return () => {
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", updateDropdownPosition);
        if (dialogContent) {
          dialogContent.removeEventListener("scroll", handleScroll, true);
        }
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showFoodDropdown]);

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
    if (!adminClient || !recipeId) return;

    if (!formData.name.trim()) {
      showToast("error", "Validation Error", "Recipe name is required");
      return;
    }

    try {
      setIsSaving(true);

      const { error: updateError } = await adminClient
        .from("base_recipes")
        .update({
          name: formData.name.trim(),
          description: formData.description?.trim() || null,
          instructions: formData.instructions?.trim() || null,
          estimated_prep_minutes: formData.estimated_prep_minutes
            ? Number(formData.estimated_prep_minutes)
            : null,
          calories: formData.calories ? Number(formData.calories) : null,
          protein_g: formData.protein_g ? Number(formData.protein_g) : null,
          carbs_g: formData.carbs_g ? Number(formData.carbs_g) : null,
          fat_g: formData.fat_g ? Number(formData.fat_g) : null,
          is_public: formData.is_public,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recipeId);

      if (updateError) {
        throw updateError;
      }

      // Refresh recipe data
      const recipeResult = await fetchRecipeFull(recipeId);
      if (recipeResult.success && recipeResult.data) {
        setRecipe(recipeResult.data);
      }

      setIsEditing(false);
      showToast("success", "Success", "Recipe updated successfully");
    } catch (err: any) {
      console.error("Error saving recipe:", err);
      showToast("error", "Error", err.message || "Failed to update recipe");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (recipe) {
      setFormData({
        name: recipe.name,
        description: recipe.description,
        instructions: recipe.instructions,
        estimated_prep_minutes: recipe.estimated_prep_minutes,
        calories: recipe.calories,
        protein_g: recipe.protein_g,
        carbs_g: recipe.carbs_g,
        fat_g: recipe.fat_g,
        is_public: recipe.is_public,
      });
    }
    setIsEditing(false);
  };

  const handleAddIngredientClick = () => {
    setEditingIngredient(null);
    setIngredientFormData({
      food_id: "",
      quantity: 1,
      unit: "",
    });
    setFoodSearchTerm("");
    setShowIngredientDialog(true);
  };

  const handleEditIngredientClick = (
    ingredient: CoachRecipeIngredientWithFood
  ) => {
    setEditingIngredient(ingredient);
    setIngredientFormData({
      food_id: ingredient.food_id,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
    });
    // Set search term to show the selected food name
    if (ingredient.food) {
      setFoodSearchTerm(
        `${ingredient.food.name}${
          ingredient.food.brand ? ` (${ingredient.food.brand})` : ""
        }`
      );
    } else {
      setFoodSearchTerm("");
    }
    setShowIngredientDialog(true);
  };

  const handleSaveIngredient = async () => {
    if (!adminClient || !recipeId) return;

    if (!ingredientFormData.food_id) {
      showToast("error", "Validation Error", "Please select a food");
      return;
    }

    if (!ingredientFormData.quantity || ingredientFormData.quantity <= 0) {
      showToast("error", "Validation Error", "Quantity must be greater than 0");
      return;
    }

    if (!ingredientFormData.unit.trim()) {
      showToast("error", "Validation Error", "Unit is required");
      return;
    }

    try {
      setIsSavingIngredient(true);

      if (editingIngredient) {
        // Update existing ingredient
        const { error: updateError } = await adminClient
          .from("base_recipe_ingredients")
          .update({
            food_id: ingredientFormData.food_id,
            quantity: Number(ingredientFormData.quantity),
            unit: ingredientFormData.unit.trim(),
          })
          .eq("id", editingIngredient.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new ingredient
        const { error: insertError } = await adminClient
          .from("base_recipe_ingredients")
          .insert({
            recipe_id: recipeId,
            food_id: ingredientFormData.food_id,
            quantity: Number(ingredientFormData.quantity),
            unit: ingredientFormData.unit.trim(),
          });

        if (insertError) {
          throw insertError;
        }
      }

      // Refresh recipe data
      const recipeResult = await fetchRecipeFull(recipeId);
      if (recipeResult.success && recipeResult.data) {
        setRecipe(recipeResult.data);
      }

      setShowIngredientDialog(false);
      setEditingIngredient(null);
      showToast(
        "success",
        "Success",
        editingIngredient
          ? "Ingredient updated successfully"
          : "Ingredient added successfully"
      );
    } catch (err: any) {
      console.error("Error saving ingredient:", err);
      showToast("error", "Error", err.message || "Failed to save ingredient");
    } finally {
      setIsSavingIngredient(false);
    }
  };

  const handleDeleteIngredientClick = (
    ingredient: CoachRecipeIngredientWithFood
  ) => {
    setShowDeleteIngredientDialog({ visible: true, ingredient });
  };

  const handleDeleteIngredient = async () => {
    if (!adminClient || !showDeleteIngredientDialog.ingredient) return;

    try {
      setIsDeletingIngredient(true);

      const { error: deleteError } = await adminClient
        .from("base_recipe_ingredients")
        .delete()
        .eq("id", showDeleteIngredientDialog.ingredient!.id);

      if (deleteError) {
        throw deleteError;
      }

      // Refresh recipe data
      const recipeResult = await fetchRecipeFull(recipeId);
      if (recipeResult.success && recipeResult.data) {
        setRecipe(recipeResult.data);
      }

      setShowDeleteIngredientDialog({ visible: false, ingredient: null });
      showToast("success", "Success", "Ingredient deleted successfully");
    } catch (err: any) {
      console.error("Error deleting ingredient:", err);
      showToast("error", "Error", err.message || "Failed to delete ingredient");
    } finally {
      setIsDeletingIngredient(false);
    }
  };

  const filteredFoods = foods.filter((food) => {
    if (!foodSearchTerm.trim()) return true;
    const searchLower = foodSearchTerm.toLowerCase();
    return (
      food.name.toLowerCase().includes(searchLower) ||
      (food.brand && food.brand.toLowerCase().includes(searchLower))
    );
  });

  const selectedFood = foods.find((f) => f.id === ingredientFormData.food_id);

  if (!isAuthenticated || !isAdmin) {
    if (!isLoading && !isLoadingRole) {
      return null; // Will redirect
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading || isLoadingRole || isLoadingRecipe ? (
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
        ) : !recipe ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
            Recipe not found
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
                router.push("/admin/general/nutrition/base/recipes")
              }
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
            >
                    <HiArrowLeft className="h-5 w-5" />
            </button>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
                  {recipe.name}
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  View and manage recipe details
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Role: Admin</span>
                </div>
              </div>
              <div className="h-1 bg-[#f59e0b] rounded-full w-16 mt-1" />
            </div>

            {/* Recipe Header */}
            <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between">
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
                          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
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
                          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">
                          Instructions
                        </label>
                        <textarea
                          value={formData.instructions || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              instructions: e.target.value || null,
                            })
                          }
                          rows={6}
                          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700">
                            Prep Time (minutes)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.estimated_prep_minutes || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                estimated_prep_minutes: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4">
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
                            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
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
                            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
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
                            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
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
                                fat_g: e.target.value
                                  ? parseFloat(e.target.value)
                                  : null,
                              })
                            }
                            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
                          />
                        </div>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="is_public"
                          checked={formData.is_public}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              is_public: e.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <label
                          htmlFor="is_public"
                          className="ml-2 block text-sm font-medium text-slate-700"
                        >
                          Public
                        </label>
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={isSaving}
                          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-amber-600 hover:to-orange-700 disabled:opacity-50"
                        >
                          {isSaving ? (
                            "Saving..."
                          ) : (
                            <>
                              <HiCheck className="text-lg" />
                              Save Changes
                            </>
                          )}
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
                    <>
                      <div className="mb-4 flex items-center gap-3">
                        <h2 className="text-3xl font-extrabold text-slate-900">
                          {recipe.name}
                        </h2>
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="text-amber-600 transition-colors hover:text-amber-900"
                          title="Edit Recipe"
                        >
                          <HiPencil className="h-5 w-5" />
                        </button>
                      </div>
                      {recipe.description && (
                        <p className="mb-4 text-slate-600">
                          {recipe.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        {recipe.estimated_prep_minutes && (
                          <span>
                            <strong>Prep Time:</strong>{" "}
                            {recipe.estimated_prep_minutes} minutes
                          </span>
                        )}
                        {recipe.calories !== null && (
                          <span>
                            <strong>Calories:</strong> {recipe.calories}
                          </span>
                        )}
                        {recipe.protein_g !== null && (
                          <span>
                            <strong>Protein:</strong> {recipe.protein_g}g
                          </span>
                        )}
                        {recipe.carbs_g !== null && (
                          <span>
                            <strong>Carbs:</strong> {recipe.carbs_g}g
                          </span>
                        )}
                        {recipe.fat_g !== null && (
                          <span>
                            <strong>Fat:</strong> {recipe.fat_g}g
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Instructions */}
              {!isEditing && recipe.instructions && (
                <div className="mt-6 border-t border-slate-200 pt-6">
                  <h3 className="mb-3 text-lg font-semibold text-slate-900">
                    Instructions
                  </h3>
                  <div className="whitespace-pre-wrap text-slate-700">
                    {recipe.instructions}
                  </div>
                </div>
              )}
            </div>

            {/* Ingredients Section */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">
                  Ingredients ({recipe.ingredients?.length || 0})
                </h3>
                <button
                  type="button"
                  onClick={handleAddIngredientClick}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-amber-600 hover:to-orange-700"
                >
                  <HiPlus className="text-lg" />
                  Add Ingredient
                </button>
              </div>

              {recipe.ingredients && recipe.ingredients.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                          Food
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                          Unit
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {recipe.ingredients.map((ingredient, index) => (
                        <tr
                          key={ingredient.id}
                          className="transition-colors hover:bg-slate-50"
                        >
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                            {index + 1}
                          </td>
                          <td className="px-4 py-4 text-sm font-medium text-slate-900">
                            {ingredient.food?.name || "Unknown"}
                            {ingredient.food?.brand && (
                              <span className="ml-2 text-xs text-slate-500">
                                ({ingredient.food.brand})
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                            {ingredient.quantity}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                            {ingredient.unit}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleEditIngredientClick(ingredient)
                                }
                                className="text-amber-600 transition-colors hover:text-amber-900"
                                title="Edit"
                              >
                                <HiPencil className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteIngredientClick(ingredient)
                                }
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
                  No ingredients added yet. Click "Add Ingredient" to get
                  started.
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Ingredient Dialog */}
      <Dialog
        visible={showIngredientDialog}
        onDismiss={() => {
          if (!isSavingIngredient) {
            setShowIngredientDialog(false);
            setEditingIngredient(null);
            setIngredientFormData({
              food_id: "",
              quantity: 1,
              unit: "",
            });
          }
        }}
        dismissible={!isSavingIngredient}
        maxWidth="80vw"
      >
        <div>
          <h3 className="mb-4 text-2xl font-bold text-slate-900">
            {editingIngredient ? "Edit Ingredient" : "Add Ingredient"}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Food <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  ref={foodInputRef}
                  type="text"
                  value={foodSearchTerm}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setFoodSearchTerm(newValue);
                    setShowFoodDropdown(true);
                    // Clear selection if user is typing something different
                    if (selectedFood) {
                      const selectedFoodDisplay = `${selectedFood.name}${
                        selectedFood.brand ? ` (${selectedFood.brand})` : ""
                      }`;
                      if (newValue !== selectedFoodDisplay) {
                        setIngredientFormData({
                          ...ingredientFormData,
                          food_id: "",
                        });
                      }
                    }
                  }}
                  onFocus={() => {
                    setShowFoodDropdown(true);
                    // When focusing, if a food is selected but search term is empty, populate it
                    if (selectedFood && !foodSearchTerm) {
                      setFoodSearchTerm(
                        `${selectedFood.name}${
                          selectedFood.brand ? ` (${selectedFood.brand})` : ""
                        }`
                      );
                    }
                  }}
                  placeholder="Search and select a food"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={ingredientFormData.quantity}
                  onChange={(e) =>
                    setIngredientFormData({
                      ...ingredientFormData,
                      quantity: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Unit <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={ingredientFormData.unit}
                  onChange={(e) =>
                    setIngredientFormData({
                      ...ingredientFormData,
                      unit: e.target.value,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
                  placeholder="e.g., cups, oz, g"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowIngredientDialog(false);
                setEditingIngredient(null);
                setIngredientFormData({
                  food_id: "",
                  quantity: 1,
                  unit: "",
                });
                setFoodSearchTerm("");
              }}
              disabled={isSavingIngredient}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveIngredient}
              disabled={isSavingIngredient}
              className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-amber-600 hover:to-orange-700 disabled:opacity-50"
            >
              {isSavingIngredient
                ? "Saving..."
                : editingIngredient
                ? "Update"
                : "Add"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete Ingredient Dialog */}
      <Dialog
        visible={showDeleteIngredientDialog.visible}
        onDismiss={() =>
          !isDeletingIngredient &&
          setShowDeleteIngredientDialog({ visible: false, ingredient: null })
        }
        dismissible={!isDeletingIngredient}
        maxWidth="80vw"
      >
        <div>
          <h3 className="mb-4 text-2xl font-bold text-slate-900">
            Delete Ingredient
          </h3>
          <p className="mb-6 text-slate-700">
            Are you sure you want to delete this ingredient? This action cannot
            be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setShowDeleteIngredientDialog({
                  visible: false,
                  ingredient: null,
                })
              }
              disabled={isDeletingIngredient}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteIngredient}
              disabled={isDeletingIngredient}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {isDeletingIngredient ? "Deleting..." : "Delete"}
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

      {/* Food Dropdown Portal - Rendered outside Dialog */}
      {showFoodDropdown &&
        dropdownPosition &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            ref={foodDropdownRef}
            className="fixed max-h-60 overflow-auto rounded-lg border border-slate-300 bg-white shadow-lg z-[9999999]"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
            }}
          >
            {filteredFoods.length > 0 ? (
              filteredFoods.map((food) => (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => {
                    setIngredientFormData({
                      ...ingredientFormData,
                      food_id: food.id,
                    });
                    setShowFoodDropdown(false);
                    setFoodSearchTerm(
                      `${food.name}${food.brand ? ` (${food.brand})` : ""}`
                    );
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-amber-50"
                >
                  {food.name}
                  {food.brand && (
                    <span className="ml-2 text-xs text-slate-500">
                      ({food.brand})
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="px-4 py-2 text-sm text-slate-500">
                No foods found
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

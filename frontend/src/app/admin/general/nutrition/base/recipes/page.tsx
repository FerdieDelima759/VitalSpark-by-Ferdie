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
import { CoachRecipe, CoachRecipeFull } from "@/types/CoachMeal";

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

export default function BaseRecipesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const adminClient = useAdminSupabase();
  const { fetchRecipes, fetchRecipeFull } = useCoachMealData();
  const [recipes, setRecipes] = useState<CoachRecipe[]>([]);
  const [recipesWithIngredients, setRecipesWithIngredients] = useState<
    CoachRecipeFull[]
  >([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const [editingRecipe, setEditingRecipe] = useState<CoachRecipe | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<{
    visible: boolean;
    recipeId: string | null;
    recipeName: string | null;
    recipeIds: string[] | null;
  }>({
    visible: false,
    recipeId: null,
    recipeName: null,
    recipeIds: null,
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [selectedRecipes, setSelectedRecipes] = useState<string[]>([]);
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

  const loadRecipes = async () => {
    try {
      setIsLoadingRecipes(true);
      setError(null);

      // Fetch all recipes
      const recipesResult = await fetchRecipes();
      if (!recipesResult.success || !recipesResult.data) {
        throw new Error(recipesResult.error || "Failed to fetch recipes");
      }

      setRecipes(recipesResult.data);

      // Fetch full details (with ingredients) for each recipe
      const recipesFullPromises = recipesResult.data.map((recipe) =>
        fetchRecipeFull(recipe.id)
      );
      const recipesFullResults = await Promise.all(recipesFullPromises);

      const recipesWithIngredientsData = recipesFullResults
        .filter((result) => result.success && result.data)
        .map((result) => result.data!);

      setRecipesWithIngredients(recipesWithIngredientsData);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading recipes");
      console.error("Error loading recipes:", err);
    } finally {
      setIsLoadingRecipes(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      loadRecipes();
    }
  }, [isAuthenticated, isAdmin, fetchRecipes, fetchRecipeFull]);

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
      instructions: null,
      estimated_prep_minutes: null,
      calories: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      is_public: true,
    });
    setEditingRecipe(null);
    setShowCreateDialog(true);
  };

  const handleEditClick = (recipe: CoachRecipe) => {
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
    setEditingRecipe(recipe);
    setShowCreateDialog(true);
  };

  const handleSave = async () => {
    if (!adminClient) {
      showToast("error", "Error", "Admin client not available");
      return;
    }

    if (!formData.name.trim()) {
      showToast("error", "Validation Error", "Recipe name is required");
      return;
    }

    try {
      setIsSaving(true);

      if (editingRecipe) {
        // Update existing recipe
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
          .eq("id", editingRecipe.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new recipe
        const { error: insertError } = await adminClient
          .from("base_recipes")
          .insert({
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
          });

        if (insertError) {
          throw insertError;
        }
      }

      // Refresh data
      await loadRecipes();

      const wasEditing = !!editingRecipe;

      // Close dialog first
      setShowCreateDialog(false);
      setEditingRecipe(null);

      // Show success toast after dialog closes fully
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (wasEditing) {
            showToast("success", "Success", "Recipe updated successfully");
          } else {
            showToast("success", "Success", "Recipe created successfully");
          }
        }, 500);
      });
    } catch (err: any) {
      console.error("Error saving recipe:", err);
      const errorMessage =
        err?.message || err?.details || err?.hint || "Failed to save recipe";

      // Close dialog first if it's still open
      if (showCreateDialog) {
        setShowCreateDialog(false);
        setEditingRecipe(null);

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

  const handleDeleteClick = (recipe: CoachRecipe) => {
    setShowDeleteDialog({
      visible: true,
      recipeId: recipe.id,
      recipeName: recipe.name,
      recipeIds: null,
    });
  };

  const handleDeleteSelectedClick = () => {
    if (selectedRecipes.length === 0) return;
    setShowDeleteDialog({
      visible: true,
      recipeId: null,
      recipeName: null,
      recipeIds: selectedRecipes,
    });
  };

  const handleDelete = async () => {
    if (!adminClient) {
      return;
    }

    const recipeIdsToDelete =
      showDeleteDialog.recipeIds ||
      (showDeleteDialog.recipeId ? [showDeleteDialog.recipeId] : []);

    if (recipeIdsToDelete.length === 0) {
      return;
    }

    try {
      setIsDeleting(true);

      const { error: deleteError } = await adminClient
        .from("base_recipes")
        .delete()
        .in("id", recipeIdsToDelete);

      if (deleteError) {
        throw deleteError;
      }

      // Clear selections
      setSelectedRecipes([]);

      // Refresh data
      await loadRecipes();

      const count = recipeIdsToDelete.length;

      // Close dialog first
      setShowDeleteDialog({
        visible: false,
        recipeId: null,
        recipeName: null,
        recipeIds: null,
      });

      // Show success toast after dialog closes fully
      requestAnimationFrame(() => {
        setTimeout(() => {
          showToast(
            "success",
            "Success",
            `${count} recipe${count > 1 ? "s" : ""} deleted successfully`
          );
        }, 500);
      });
    } catch (err: any) {
      console.error("Error deleting recipe:", err);
      const errorMessage =
        err?.message || err?.details || err?.hint || "Failed to delete recipe";

      // Close dialog first
      setShowDeleteDialog({
        visible: false,
        recipeId: null,
        recipeName: null,
        recipeIds: null,
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

  const toggleRecipeSelection = (recipeId: string) => {
    setSelectedRecipes((prev) =>
      prev.includes(recipeId)
        ? prev.filter((id) => id !== recipeId)
        : [...prev, recipeId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRecipes.length === recipes.length) {
      setSelectedRecipes([]);
    } else {
      setSelectedRecipes(recipes.map((recipe) => recipe.id));
    }
  };

  if (!isAuthenticated || !isAdmin) {
    if (!isLoading && !isLoadingRole) {
      return null; // Will redirect
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading || isLoadingRole || isLoadingRecipes ? (
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
                  Base Recipe Management
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  Browse and manage recipe templates with ingredients and
                  instructions
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
                    recipes.length > 0 &&
                    selectedRecipes.length === recipes.length
                  }
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm text-slate-600">
                  Select All ({selectedRecipes.length} selected)
                </span>
              </div>
              <div className="flex gap-2">
                {selectedRecipes.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteSelectedClick}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white shadow-md transition-colors hover:bg-red-700"
                  >
                    <HiTrash className="text-lg" />
                    Delete Selected ({selectedRecipes.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCreateClick}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 font-medium text-white shadow-md transition-all hover:from-amber-600 hover:to-orange-700"
                >
                  <HiPlus className="text-lg" />
                  Add New Recipe
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                {error}
              </div>
            )}

            {/* Recipes Grid */}
            {recipesWithIngredients.length === 0 ? (
              <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
                <p className="text-slate-500">
                  No recipes found. Create recipes to get started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {recipesWithIngredients.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="group flex flex-col rounded-2xl border border-amber-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg"
                  >
                    {/* Recipe Header */}
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedRecipes.includes(recipe.id)}
                            onChange={() => toggleRecipeSelection(recipe.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Recipe
                          </span>
                          {recipe.estimated_prep_minutes && (
                            <span className="text-xs text-slate-500">
                              {recipe.estimated_prep_minutes} min
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-slate-900">
                          {recipe.name}
                        </h3>
                        {recipe.description && (
                          <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                            {recipe.description}
                          </p>
                        )}
                        {(recipe.calories !== null ||
                          recipe.protein_g !== null) && (
                          <div className="mt-2 flex gap-3 text-xs text-slate-500">
                            {recipe.calories !== null && (
                              <span>Cal: {recipe.calories}</span>
                            )}
                            {recipe.protein_g !== null && (
                              <span>P: {recipe.protein_g}g</span>
                            )}
                            {recipe.carbs_g !== null && (
                              <span>C: {recipe.carbs_g}g</span>
                            )}
                            {recipe.fat_g !== null && (
                              <span>F: {recipe.fat_g}g</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(recipe);
                            }}
                            className="text-amber-600 transition-colors hover:text-amber-900"
                            title="Edit"
                          >
                            <HiPencil className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(recipe);
                            }}
                            className="text-red-600 transition-colors hover:text-red-900"
                            title="Delete"
                          >
                            <HiTrash className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Recipe Ingredients */}
                    <div className="mb-4 flex-1">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Ingredients ({recipe.ingredients?.length || 0})
                      </h4>
                      {recipe.ingredients && recipe.ingredients.length > 0 ? (
                        <ul className="space-y-1.5">
                          {recipe.ingredients
                            .slice(0, 5)
                            .map((ingredient, index) => (
                              <li
                                key={ingredient.id}
                                className="flex items-center gap-2 text-sm text-slate-700"
                              >
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-xs font-medium text-amber-700">
                                  {index + 1}
                                </span>
                                <span className="flex-1 truncate">
                                  {ingredient.quantity} {ingredient.unit}{" "}
                                  {ingredient.food?.name || "Unknown"}
                                </span>
                              </li>
                            ))}
                          {recipe.ingredients.length > 5 && (
                            <li className="pl-7 text-xs text-slate-500">
                              +{recipe.ingredients.length - 5} more ingredient
                              {recipe.ingredients.length - 5 > 1 ? "s" : ""}
                            </li>
                          )}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-400">
                          No ingredients in this recipe
                        </p>
                      )}
                    </div>

                    {/* View Recipe Button */}
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/admin/general/nutrition/base/recipes/${recipe.id}`
                        )
                      }
                      className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-amber-600 hover:to-orange-700"
                    >
                      <HiEye className="text-lg" />
                      View Recipe
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
            setEditingRecipe(null);
            setFormData({
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
          }
        }}
        dismissible={!isSaving}
        maxWidth="80vw"
      >
        <div>
          <h3 className="mb-4 text-2xl font-bold text-slate-900">
            {editingRecipe ? "Edit Recipe" : "Create New Recipe"}
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
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
                placeholder="Enter recipe name"
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
                placeholder="Enter recipe description (optional)"
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
                rows={4}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
                placeholder="Enter cooking instructions (optional)"
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
                  placeholder="Minutes"
                />
              </div>
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
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
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
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
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
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
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
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-500"
                  placeholder="Fat (g)"
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
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
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
                setEditingRecipe(null);
                setFormData({
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
              className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-amber-600 hover:to-orange-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : editingRecipe ? "Update" : "Create"}
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
            recipeId: null,
            recipeName: null,
            recipeIds: null,
          })
        }
        dismissible={!isDeleting}
        maxWidth="80vw"
      >
        <div>
          <h3 className="mb-4 text-2xl font-bold text-slate-900">
            Delete Recipe
            {showDeleteDialog.recipeIds && showDeleteDialog.recipeIds.length > 1
              ? "s"
              : ""}
          </h3>
          <p className="mb-6 text-slate-700">
            Are you sure you want to delete
            {showDeleteDialog.recipeIds && showDeleteDialog.recipeIds.length > 1
              ? ` these ${showDeleteDialog.recipeIds.length} recipes`
              : showDeleteDialog.recipeName
              ? ` "${showDeleteDialog.recipeName}"`
              : " this recipe"}
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setShowDeleteDialog({
                  visible: false,
                  recipeId: null,
                  recipeName: null,
                  recipeIds: null,
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

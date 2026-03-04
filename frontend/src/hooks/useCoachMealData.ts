import { useState, useCallback } from "react";
import { supabase } from "../lib/api/supabase";
import {
  CoachFood,
  CoachRecipe,
  CoachRecipeIngredient,
  CoachMeal,
  CoachMealItem,
  CoachMealPlan,
  CoachMealPlanDay,
  CoachMealPlanDayMeal,
  CoachRecipeFull,
  CoachMealFull,
  CoachMealPlanDayFull,
  CoachMealPlanFull,
  CoachMealDataResponse,
  CoachWorkoutMealPlanLink,
  CoachWorkoutMealPlanLinkWithDetails,
} from "../types/CoachMeal";

// ===========================
// Hook Interface
// ===========================

interface UseCoachMealDataReturn {
  // Foods
  fetchFoods: () => Promise<CoachMealDataResponse<CoachFood[]>>;
  fetchFoodById: (foodId: string) => Promise<CoachMealDataResponse<CoachFood>>;
  fetchFoodsByActive: (
    isActive: boolean
  ) => Promise<CoachMealDataResponse<CoachFood[]>>;

  // Recipes
  fetchRecipes: () => Promise<CoachMealDataResponse<CoachRecipe[]>>;
  fetchRecipeById: (
    recipeId: string
  ) => Promise<CoachMealDataResponse<CoachRecipe>>;
  fetchRecipesByCreator: (
    createdBy: string
  ) => Promise<CoachMealDataResponse<CoachRecipe[]>>;
  fetchRecipesByPublic: (
    isPublic: boolean
  ) => Promise<CoachMealDataResponse<CoachRecipe[]>>;
  fetchRecipeFull: (
    recipeId: string
  ) => Promise<CoachMealDataResponse<CoachRecipeFull>>;
  fetchRecipeIngredients: (
    recipeId: string
  ) => Promise<CoachMealDataResponse<CoachRecipeIngredient[]>>;

  // Meals
  fetchMeals: () => Promise<CoachMealDataResponse<CoachMeal[]>>;
  fetchMealById: (mealId: string) => Promise<CoachMealDataResponse<CoachMeal>>;
  fetchMealsByCreator: (
    createdBy: string
  ) => Promise<CoachMealDataResponse<CoachMeal[]>>;
  fetchMealsByPublic: (
    isPublic: boolean
  ) => Promise<CoachMealDataResponse<CoachMeal[]>>;
  fetchMealFull: (mealId: string) => Promise<CoachMealDataResponse<CoachMealFull>>;
  fetchMealItems: (
    mealId: string
  ) => Promise<CoachMealDataResponse<CoachMealItem[]>>;

  // Meal Plans
  fetchMealPlans: () => Promise<CoachMealDataResponse<CoachMealPlan[]>>;
  fetchMealPlanById: (
    mealPlanId: string
  ) => Promise<CoachMealDataResponse<CoachMealPlan>>;
  fetchMealPlansByCreator: (
    createdBy: string
  ) => Promise<CoachMealDataResponse<CoachMealPlan[]>>;
  fetchMealPlansByPublic: (
    isPublic: boolean
  ) => Promise<CoachMealDataResponse<CoachMealPlan[]>>;
  fetchMealPlanFull: (
    mealPlanId: string
  ) => Promise<CoachMealDataResponse<CoachMealPlanFull>>;
  fetchDaysForMealPlan: (
    mealPlanId: string
  ) => Promise<CoachMealDataResponse<CoachMealPlanDay[]>>;
  fetchDayById: (
    dayId: string
  ) => Promise<CoachMealDataResponse<CoachMealPlanDay>>;
  fetchDayFull: (
    dayId: string
  ) => Promise<CoachMealDataResponse<CoachMealPlanDayFull>>;
  fetchMealsForDay: (
    dayId: string
  ) => Promise<CoachMealDataResponse<CoachMealPlanDayMeal[]>>;

  // Workout Meal Plan Links
  fetchLinksByWorkoutPlan: (
    planId: string
  ) => Promise<CoachMealDataResponse<CoachWorkoutMealPlanLink[]>>;
  fetchLinksByMealPlan: (
    mealPlanId: string
  ) => Promise<CoachMealDataResponse<CoachWorkoutMealPlanLink[]>>;
  fetchLinkFull: (
    planId: string,
    mealPlanId: string
  ) => Promise<CoachMealDataResponse<CoachWorkoutMealPlanLinkWithDetails>>;
  createLink: (
    planId: string,
    mealPlanId: string
  ) => Promise<CoachMealDataResponse<boolean>>;
  deleteLink: (
    planId: string,
    mealPlanId: string
  ) => Promise<CoachMealDataResponse<boolean>>;

  // State
  isLoading: boolean;
  error: string | null;
}

// ===========================
// Custom Hook
// ===========================

export function useCoachMealData(): UseCoachMealDataReturn {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((error: any): string => {
    console.error("Coach meal data error:", error);
    
    // Handle Supabase PostgREST errors
    if (error?.message) {
      return error.message;
    }
    
    // Handle Supabase error details
    if (error?.details) {
      return error.details;
    }
    
    // Handle error hints
    if (error?.hint) {
      return error.hint;
    }
    
    // Handle error code with custom messages
    if (error?.code) {
      if (error.code === "23505") {
        return "This record already exists.";
      }
      if (error.code === "23503") {
        return "Referenced record does not exist.";
      }
      if (error.code === "23502") {
        return "Required field is missing.";
      }
    }
    
    // Fallback
    if (typeof error === "string") {
      return error;
    }
    
    return "An unexpected error occurred";
  }, []);

  // ===========================
  // Foods
  // ===========================

  const fetchFoods = useCallback(async (): Promise<
    CoachMealDataResponse<CoachFood[]>
  > => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("base_foods")
        .select("*")
        .order("name", { ascending: true });

      if (fetchError) {
        const errorMsg = handleError(fetchError);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      return { success: true, data: data || [] };
    } catch (err: any) {
      const errorMsg = handleError(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const fetchFoodById = useCallback(
    async (foodId: string): Promise<CoachMealDataResponse<CoachFood>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!foodId.trim()) {
          return { success: false, error: "Food ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("base_foods")
          .select("*")
          .eq("id", foodId)
          .single();

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as CoachFood };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchFoodsByActive = useCallback(
    async (
      isActive: boolean
    ): Promise<CoachMealDataResponse<CoachFood[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("base_foods")
          .select("*")
          .eq("is_active", isActive)
          .order("name", { ascending: true });

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ===========================
  // Recipes
  // ===========================

  const fetchRecipes = useCallback(async (): Promise<
    CoachMealDataResponse<CoachRecipe[]>
  > => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("base_recipes")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        const errorMsg = handleError(fetchError);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      return { success: true, data: data || [] };
    } catch (err: any) {
      const errorMsg = handleError(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const fetchRecipeById = useCallback(
    async (recipeId: string): Promise<CoachMealDataResponse<CoachRecipe>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!recipeId.trim()) {
          return { success: false, error: "Recipe ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("base_recipes")
          .select("*")
          .eq("id", recipeId)
          .single();

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as CoachRecipe };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchRecipesByCreator = useCallback(
    async (
      createdBy: string
    ): Promise<CoachMealDataResponse<CoachRecipe[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!createdBy.trim()) {
          return { success: false, error: "Creator ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("base_recipes")
          .select("*")
          .eq("created_by", createdBy)
          .order("created_at", { ascending: false });

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchRecipesByPublic = useCallback(
    async (
      isPublic: boolean
    ): Promise<CoachMealDataResponse<CoachRecipe[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("base_recipes")
          .select("*")
          .eq("is_public", isPublic)
          .order("created_at", { ascending: false });

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchRecipeIngredients = useCallback(
    async (
      recipeId: string
    ): Promise<CoachMealDataResponse<CoachRecipeIngredient[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!recipeId.trim()) {
          return { success: false, error: "Recipe ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("base_recipe_ingredients")
          .select("*")
          .eq("recipe_id", recipeId)
          .order("created_at", { ascending: true });

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchRecipeFull = useCallback(
    async (recipeId: string): Promise<CoachMealDataResponse<CoachRecipeFull>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!recipeId.trim()) {
          return { success: false, error: "Recipe ID is required" };
        }

        // Fetch recipe
        const recipeResult = await fetchRecipeById(recipeId);
        if (!recipeResult.success || !recipeResult.data) {
          return {
            success: false,
            error: recipeResult.error || "Failed to fetch recipe",
          };
        }

        // Fetch ingredients
        const ingredientsResult = await fetchRecipeIngredients(recipeId);
        if (!ingredientsResult.success) {
          return {
            success: false,
            error: ingredientsResult.error || "Failed to fetch ingredients",
          };
        }

        // Fetch food details for each ingredient
        const ingredientIds =
          ingredientsResult.data?.map((ing) => ing.food_id) || [];
        const foodsMap = new Map<string, CoachFood>();

        if (ingredientIds.length > 0) {
          const { data: foodsData } = await supabase
            .from("base_foods")
            .select("*")
            .in("id", ingredientIds);

          foodsData?.forEach((food) => {
            foodsMap.set(food.id, food);
          });
        }

        const ingredientsWithFoods =
          ingredientsResult.data?.map((ingredient) => ({
            ...ingredient,
            food: foodsMap.get(ingredient.food_id),
          })) || [];

        return {
          success: true,
          data: {
            ...recipeResult.data,
            ingredients: ingredientsWithFoods,
          },
        };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError, fetchRecipeById, fetchRecipeIngredients]
  );

  // ===========================
  // Meals
  // ===========================

  const fetchMeals = useCallback(async (): Promise<
    CoachMealDataResponse<CoachMeal[]>
  > => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("base_meals")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        const errorMsg = handleError(fetchError);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      return { success: true, data: data || [] };
    } catch (err: any) {
      const errorMsg = handleError(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const fetchMealById = useCallback(
    async (mealId: string): Promise<CoachMealDataResponse<CoachMeal>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!mealId.trim()) {
          return { success: false, error: "Meal ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("base_meals")
          .select("*")
          .eq("id", mealId)
          .single();

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as CoachMeal };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchMealsByCreator = useCallback(
    async (
      createdBy: string
    ): Promise<CoachMealDataResponse<CoachMeal[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!createdBy.trim()) {
          return { success: false, error: "Creator ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("base_meals")
          .select("*")
          .eq("created_by", createdBy)
          .order("created_at", { ascending: false });

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchMealsByPublic = useCallback(
    async (
      isPublic: boolean
    ): Promise<CoachMealDataResponse<CoachMeal[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("base_meals")
          .select("*")
          .eq("is_public", isPublic)
          .order("created_at", { ascending: false });

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchMealItems = useCallback(
    async (mealId: string): Promise<CoachMealDataResponse<CoachMealItem[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!mealId.trim()) {
          return { success: false, error: "Meal ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("base_meal_items")
          .select("*")
          .eq("meal_id", mealId)
          .order("position", { ascending: true });

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchMealFull = useCallback(
    async (mealId: string): Promise<CoachMealDataResponse<CoachMealFull>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!mealId.trim()) {
          return { success: false, error: "Meal ID is required" };
        }

        // Fetch meal
        const mealResult = await fetchMealById(mealId);
        if (!mealResult.success || !mealResult.data) {
          return {
            success: false,
            error: mealResult.error || "Failed to fetch meal",
          };
        }

        // Fetch items
        const itemsResult = await fetchMealItems(mealId);
        if (!itemsResult.success) {
          return {
            success: false,
            error: itemsResult.error || "Failed to fetch meal items",
          };
        }

        // Fetch details for each item
        const itemsWithDetails = await Promise.all(
          (itemsResult.data || []).map(async (item) => {
            if (item.item_type === "recipe" && item.recipe_id) {
              const recipeFullResult = await fetchRecipeFull(item.recipe_id);
              return {
                ...item,
                recipe: recipeFullResult.success
                  ? recipeFullResult.data
                  : undefined,
              };
            } else if (item.item_type === "food" && item.food_id) {
              const foodResult = await fetchFoodById(item.food_id);
              return {
                ...item,
                food: foodResult.success ? foodResult.data : undefined,
              };
            }
            return item;
          })
        );

        return {
          success: true,
          data: {
            ...mealResult.data,
            items: itemsWithDetails,
          },
        };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError, fetchMealById, fetchMealItems, fetchRecipeFull, fetchFoodById]
  );

  // ===========================
  // Meal Plans
  // ===========================

  const fetchMealPlans = useCallback(async (): Promise<
    CoachMealDataResponse<CoachMealPlan[]>
  > => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("coach_meal_plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        const errorMsg = handleError(fetchError);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      return { success: true, data: data || [] };
    } catch (err: any) {
      const errorMsg = handleError(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const fetchMealPlanById = useCallback(
    async (
      mealPlanId: string
    ): Promise<CoachMealDataResponse<CoachMealPlan>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!mealPlanId.trim()) {
          return { success: false, error: "Meal Plan ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_meal_plans")
          .select("*")
          .eq("id", mealPlanId)
          .single();

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as CoachMealPlan };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchMealPlansByCreator = useCallback(
    async (
      createdBy: string
    ): Promise<CoachMealDataResponse<CoachMealPlan[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!createdBy.trim()) {
          return { success: false, error: "Creator ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_meal_plans")
          .select("*")
          .eq("created_by", createdBy)
          .order("created_at", { ascending: false });

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchMealPlansByPublic = useCallback(
    async (
      isPublic: boolean
    ): Promise<CoachMealDataResponse<CoachMealPlan[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("coach_meal_plans")
          .select("*")
          .eq("is_public", isPublic)
          .order("created_at", { ascending: false });

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchDaysForMealPlan = useCallback(
    async (
      mealPlanId: string
    ): Promise<CoachMealDataResponse<CoachMealPlanDay[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!mealPlanId.trim()) {
          return { success: false, error: "Meal Plan ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_meal_plan_days")
          .select("*")
          .eq("meal_plan_id", mealPlanId)
          .order("day_number", { ascending: true });

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchDayById = useCallback(
    async (
      dayId: string
    ): Promise<CoachMealDataResponse<CoachMealPlanDay>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!dayId.trim()) {
          return { success: false, error: "Day ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_meal_plan_days")
          .select("*")
          .eq("id", dayId)
          .single();

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as CoachMealPlanDay };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchMealsForDay = useCallback(
    async (
      dayId: string
    ): Promise<CoachMealDataResponse<CoachMealPlanDayMeal[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!dayId.trim()) {
          return { success: false, error: "Day ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_meal_plan_day_meals")
          .select("*")
          .eq("meal_plan_day_id", dayId)
          .order("meal_number", { ascending: true });

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchDayFull = useCallback(
    async (
      dayId: string
    ): Promise<CoachMealDataResponse<CoachMealPlanDayFull>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!dayId.trim()) {
          return { success: false, error: "Day ID is required" };
        }

        // Fetch day
        const dayResult = await fetchDayById(dayId);
        if (!dayResult.success || !dayResult.data) {
          return {
            success: false,
            error: dayResult.error || "Failed to fetch day",
          };
        }

        // Fetch meals for this day
        const mealsResult = await fetchMealsForDay(dayId);
        if (!mealsResult.success) {
          return {
            success: false,
            error: mealsResult.error || "Failed to fetch day meals",
          };
        }

        // Fetch full meal details for each day meal
        const mealsWithDetails = await Promise.all(
          (mealsResult.data || []).map(async (dayMeal) => {
            const mealFullResult = await fetchMealFull(dayMeal.meal_id);
            return {
              ...dayMeal,
              meal: mealFullResult.success ? mealFullResult.data : undefined,
            };
          })
        );

        return {
          success: true,
          data: {
            ...dayResult.data,
            meals: mealsWithDetails,
          },
        };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError, fetchDayById, fetchMealsForDay, fetchMealFull]
  );

  const fetchMealPlanFull = useCallback(
    async (
      mealPlanId: string
    ): Promise<CoachMealDataResponse<CoachMealPlanFull>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!mealPlanId.trim()) {
          return { success: false, error: "Meal Plan ID is required" };
        }

        // Fetch plan
        const planResult = await fetchMealPlanById(mealPlanId);
        if (!planResult.success || !planResult.data) {
          return {
            success: false,
            error: planResult.error || "Failed to fetch meal plan",
          };
        }

        // Fetch days for this plan
        const daysResult = await fetchDaysForMealPlan(mealPlanId);
        if (!daysResult.success) {
          return {
            success: false,
            error: daysResult.error || "Failed to fetch meal plan days",
          };
        }

        // Fetch full details for each day
        const daysFull = await Promise.all(
          (daysResult.data || []).map(async (day) => {
            const dayFullResult = await fetchDayFull(day.id);
            return dayFullResult.success ? dayFullResult.data : day;
          })
        );

        return {
          success: true,
          data: {
            ...planResult.data,
            days: daysFull as CoachMealPlanDayFull[],
          },
        };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [
      handleError,
      fetchMealPlanById,
      fetchDaysForMealPlan,
      fetchDayFull,
    ]
  );

  // ===========================
  // Workout Meal Plan Links
  // ===========================

  const fetchLinksByWorkoutPlan = useCallback(
    async (
      planId: string
    ): Promise<CoachMealDataResponse<CoachWorkoutMealPlanLink[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim()) {
          return { success: false, error: "Plan ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_workout_meal_plan_link")
          .select("*")
          .eq("plan_id", planId);

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchLinksByMealPlan = useCallback(
    async (
      mealPlanId: string
    ): Promise<CoachMealDataResponse<CoachWorkoutMealPlanLink[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!mealPlanId.trim()) {
          return { success: false, error: "Meal Plan ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_workout_meal_plan_link")
          .select("*")
          .eq("meal_plan_id", mealPlanId);

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchLinkFull = useCallback(
    async (
      planId: string,
      mealPlanId: string
    ): Promise<CoachMealDataResponse<CoachWorkoutMealPlanLinkWithDetails>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim() || !mealPlanId.trim()) {
          return {
            success: false,
            error: "Plan ID and Meal Plan ID are required",
          };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_workout_meal_plan_link")
          .select("*")
          .eq("plan_id", planId)
          .eq("meal_plan_id", mealPlanId)
          .single();

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        if (!data) {
          return { success: false, error: "Link not found" };
        }

        // Fetch meal plan details
        const mealPlanResult = await fetchMealPlanFull(mealPlanId);

        return {
          success: true,
          data: {
            ...data,
            meal_plan: mealPlanResult.success
              ? mealPlanResult.data
              : undefined,
          },
        };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError, fetchMealPlanFull]
  );

  const createLink = useCallback(
    async (
      planId: string,
      mealPlanId: string
    ): Promise<CoachMealDataResponse<boolean>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim() || !mealPlanId.trim()) {
          return {
            success: false,
            error: "Plan ID and Meal Plan ID are required",
          };
        }

        // Check if link already exists
        const { data: existingLink, error: checkError } = await supabase
          .from("coach_workout_meal_plan_link")
          .select("*")
          .eq("plan_id", planId)
          .eq("meal_plan_id", mealPlanId)
          .maybeSingle();

        if (checkError) {
          const errorMsg = handleError(checkError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        if (existingLink) {
          return {
            success: false,
            error: "This meal plan is already linked to the selected workout plan.",
          };
        }

        const { error: insertError } = await supabase
          .from("coach_workout_meal_plan_link")
          .insert({ plan_id: planId, meal_plan_id: mealPlanId });

        if (insertError) {
          let errorMsg = handleError(insertError);
          // Provide more specific error messages
          if (insertError.code === "23505") {
            errorMsg = "This meal plan is already linked to the selected workout plan.";
          } else if (insertError.code === "23503") {
            errorMsg = "Invalid workout plan or meal plan ID.";
          } else if (!errorMsg || errorMsg === "{}" || errorMsg.trim() === "") {
            errorMsg = insertError.message || "Unable to create link. Please try again.";
          }
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: true };
      } catch (err: any) {
        let errorMsg = handleError(err);
        if (!errorMsg || errorMsg === "{}" || errorMsg.trim() === "") {
          errorMsg = err?.message || "An unexpected error occurred while creating the link.";
        }
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const deleteLink = useCallback(
    async (
      planId: string,
      mealPlanId: string
    ): Promise<CoachMealDataResponse<boolean>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim() || !mealPlanId.trim()) {
          return {
            success: false,
            error: "Plan ID and Meal Plan ID are required",
          };
        }

        const { error: deleteError } = await supabase
          .from("coach_workout_meal_plan_link")
          .delete()
          .eq("plan_id", planId)
          .eq("meal_plan_id", mealPlanId);

        if (deleteError) {
          const errorMsg = handleError(deleteError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: true };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  return {
    // Foods
    fetchFoods,
    fetchFoodById,
    fetchFoodsByActive,

    // Recipes
    fetchRecipes,
    fetchRecipeById,
    fetchRecipesByCreator,
    fetchRecipesByPublic,
    fetchRecipeFull,
    fetchRecipeIngredients,

    // Meals
    fetchMeals,
    fetchMealById,
    fetchMealsByCreator,
    fetchMealsByPublic,
    fetchMealFull,
    fetchMealItems,

    // Meal Plans
    fetchMealPlans,
    fetchMealPlanById,
    fetchMealPlansByCreator,
    fetchMealPlansByPublic,
    fetchMealPlanFull,
    fetchDaysForMealPlan,
    fetchDayById,
    fetchDayFull,
    fetchMealsForDay,

    // Workout Meal Plan Links
    fetchLinksByWorkoutPlan,
    fetchLinksByMealPlan,
    fetchLinkFull,
    createLink,
    deleteLink,

    // State
    isLoading,
    error,
  };
}


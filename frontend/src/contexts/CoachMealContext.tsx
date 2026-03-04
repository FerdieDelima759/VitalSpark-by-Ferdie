"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
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
  CoachMealLoadingState,
  CoachWorkoutMealPlanLink,
  CoachWorkoutMealPlanLinkWithDetails,
} from "../types/CoachMeal";

// ===========================
// Context Type
// ===========================

interface CoachMealContextType {
  // Data
  coachFoods: CoachFood[];
  coachRecipes: CoachRecipe[];
  coachMeals: CoachMeal[];
  coachMealPlans: CoachMealPlan[];

  // Loading states
  loadingState: CoachMealLoadingState;

  // Methods - Foods
  refreshCoachMealData: () => Promise<void>;
  getFoodById: (foodId: string) => CoachFood | undefined;
  getFoodsByActive: (isActive: boolean) => CoachFood[];

  // Methods - Recipes
  getRecipeById: (recipeId: string) => CoachRecipe | undefined;
  getRecipesByCreator: (createdBy: string) => CoachRecipe[];
  getRecipesByPublic: (isPublic: boolean) => CoachRecipe[];
  getRecipeFull: (recipeId: string) => Promise<CoachRecipeFull | null>;

  // Methods - Meals
  getMealById: (mealId: string) => CoachMeal | undefined;
  getMealsByCreator: (createdBy: string) => CoachMeal[];
  getMealsByPublic: (isPublic: boolean) => CoachMeal[];
  getMealFull: (mealId: string) => Promise<CoachMealFull | null>;

  // Methods - Meal Plans
  getMealPlanById: (mealPlanId: string) => CoachMealPlan | undefined;
  getMealPlansByCreator: (createdBy: string) => CoachMealPlan[];
  getMealPlansByPublic: (isPublic: boolean) => CoachMealPlan[];
  getMealPlanFull: (mealPlanId: string) => Promise<CoachMealPlanFull | null>;
  getDaysForMealPlan: (
    mealPlanId: string
  ) => Promise<CoachMealPlanDay[]>;
  getDayFull: (
    dayId: string
  ) => Promise<CoachMealPlanDayFull | null>;

  // Methods - Workout Meal Plan Links
  getLinksByWorkoutPlan: (
    planId: string
  ) => Promise<CoachWorkoutMealPlanLink[]>;
  getLinksByMealPlan: (
    mealPlanId: string
  ) => Promise<CoachWorkoutMealPlanLink[]>;
  getLinkFull: (
    planId: string,
    mealPlanId: string
  ) => Promise<CoachWorkoutMealPlanLinkWithDetails | null>;
  createLink: (
    planId: string,
    mealPlanId: string
  ) => Promise<boolean>;
  deleteLink: (
    planId: string,
    mealPlanId: string
  ) => Promise<boolean>;
}

// ===========================
// Context Creation
// ===========================

const CoachMealContext = createContext<CoachMealContextType | undefined>(
  undefined
);

// ===========================
// Provider Props
// ===========================

interface CoachMealProviderProps {
  children: ReactNode;
}

// ===========================
// Provider Component
// ===========================

export function CoachMealProvider({
  children,
}: CoachMealProviderProps): React.ReactElement {
  const [coachFoods, setCoachFoods] = useState<CoachFood[]>([]);
  const [coachRecipes, setCoachRecipes] = useState<CoachRecipe[]>([]);
  const [coachMeals, setCoachMeals] = useState<CoachMeal[]>([]);
  const [coachMealPlans, setCoachMealPlans] = useState<CoachMealPlan[]>([]);
  const [loadingState, setLoadingState] = useState<CoachMealLoadingState>({
    isLoading: true,
    error: null,
  });

  const fetchCoachMealData = async (): Promise<void> => {
    try {
      setLoadingState({ isLoading: true, error: null });

      // Fetch all foods
      const { data: foodsData, error: foodsError } = await supabase
        .from("base_foods")
        .select("*")
        .order("name", { ascending: true });

      if (foodsError) {
        throw foodsError;
      }

      // Fetch all recipes
      const { data: recipesData, error: recipesError } = await supabase
        .from("base_recipes")
        .select("*")
        .order("created_at", { ascending: false });

      if (recipesError) {
        throw recipesError;
      }

      // Fetch all meals
      const { data: mealsData, error: mealsError } = await supabase
        .from("base_meals")
        .select("*")
        .order("created_at", { ascending: false });

      if (mealsError) {
        throw mealsError;
      }

      // Fetch all meal plans
      const { data: mealPlansData, error: mealPlansError } = await supabase
        .from("coach_meal_plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (mealPlansError) {
        throw mealPlansError;
      }

      setCoachFoods(foodsData || []);
      setCoachRecipes(recipesData || []);
      setCoachMeals(mealsData || []);
      setCoachMealPlans(mealPlansData || []);
      setLoadingState({ isLoading: false, error: null });
    } catch (error: any) {
      console.error("Error fetching coach meal data:", error);
      setLoadingState({
        isLoading: false,
        error: error.message || "Failed to fetch coach meal data",
      });
    }
  };

  const refreshCoachMealData = async (): Promise<void> => {
    await fetchCoachMealData();
  };

  // ===========================
  // Food Methods
  // ===========================

  const getFoodById = (foodId: string): CoachFood | undefined => {
    return coachFoods.find((food) => food.id === foodId);
  };

  const getFoodsByActive = (isActive: boolean): CoachFood[] => {
    return coachFoods.filter((food) => food.is_active === isActive);
  };

  // ===========================
  // Recipe Methods
  // ===========================

  const getRecipeById = (recipeId: string): CoachRecipe | undefined => {
    return coachRecipes.find((recipe) => recipe.id === recipeId);
  };

  const getRecipesByCreator = (createdBy: string): CoachRecipe[] => {
    return coachRecipes.filter((recipe) => recipe.created_by === createdBy);
  };

  const getRecipesByPublic = (isPublic: boolean): CoachRecipe[] => {
    return coachRecipes.filter((recipe) => recipe.is_public === isPublic);
  };

  const getRecipeFull = async (
    recipeId: string
  ): Promise<CoachRecipeFull | null> => {
    try {
      const recipe = getRecipeById(recipeId);
      if (!recipe) return null;

      // Fetch ingredients for this recipe
      const { data: ingredientsData, error: ingredientsError } = await supabase
        .from("base_recipe_ingredients")
        .select("*")
        .eq("recipe_id", recipeId)
        .order("created_at", { ascending: true });

      if (ingredientsError) {
        console.error("Error fetching recipe ingredients:", ingredientsError);
        return { ...recipe, ingredients: [] };
      }

      // Fetch food details for each ingredient
      const ingredientsWithFoods = await Promise.all(
        (ingredientsData || []).map(async (ingredient) => {
          const food = getFoodById(ingredient.food_id);
          return {
            ...ingredient,
            food: food || undefined,
          };
        })
      );

      return {
        ...recipe,
        ingredients: ingredientsWithFoods,
      };
    } catch (error) {
      console.error("Error getting full recipe:", error);
      return null;
    }
  };

  // ===========================
  // Meal Methods
  // ===========================

  const getMealById = (mealId: string): CoachMeal | undefined => {
    return coachMeals.find((meal) => meal.id === mealId);
  };

  const getMealsByCreator = (createdBy: string): CoachMeal[] => {
    return coachMeals.filter((meal) => meal.created_by === createdBy);
  };

  const getMealsByPublic = (isPublic: boolean): CoachMeal[] => {
    return coachMeals.filter((meal) => meal.is_public === isPublic);
  };

  const getMealFull = async (mealId: string): Promise<CoachMealFull | null> => {
    try {
      const meal = getMealById(mealId);
      if (!meal) return null;

      // Fetch items for this meal
      const { data: itemsData, error: itemsError } = await supabase
        .from("base_meal_items")
        .select("*")
        .eq("meal_id", mealId)
        .order("position", { ascending: true });

      if (itemsError) {
        console.error("Error fetching meal items:", itemsError);
        return { ...meal, items: [] };
      }

      // Fetch details for each item
      const itemsWithDetails = await Promise.all(
        (itemsData || []).map(async (item) => {
          if (item.item_type === "recipe" && item.recipe_id) {
            const recipeFull = await getRecipeFull(item.recipe_id);
            return {
              ...item,
              recipe: recipeFull || undefined,
            };
          } else if (item.item_type === "food" && item.food_id) {
            const food = getFoodById(item.food_id);
            return {
              ...item,
              food: food || undefined,
            };
          }
          return item;
        })
      );

      return {
        ...meal,
        items: itemsWithDetails,
      };
    } catch (error) {
      console.error("Error getting full meal:", error);
      return null;
    }
  };

  // ===========================
  // Meal Plan Methods
  // ===========================

  const getMealPlanById = (mealPlanId: string): CoachMealPlan | undefined => {
    return coachMealPlans.find((plan) => plan.id === mealPlanId);
  };

  const getMealPlansByCreator = (createdBy: string): CoachMealPlan[] => {
    return coachMealPlans.filter((plan) => plan.created_by === createdBy);
  };

  const getMealPlansByPublic = (isPublic: boolean): CoachMealPlan[] => {
    return coachMealPlans.filter((plan) => plan.is_public === isPublic);
  };

  const getDaysForMealPlan = async (
    mealPlanId: string
  ): Promise<CoachMealPlanDay[]> => {
    try {
      const { data: daysData, error: daysError } = await supabase
        .from("coach_meal_plan_days")
        .select("*")
        .eq("meal_plan_id", mealPlanId)
        .order("day_number", { ascending: true });

      if (daysError) {
        console.error("Error fetching meal plan days:", daysError);
        return [];
      }

      return daysData || [];
    } catch (error) {
      console.error("Error getting days for meal plan:", error);
      return [];
    }
  };

  const getDayFull = async (
    dayId: string
  ): Promise<CoachMealPlanDayFull | null> => {
    try {
      // Fetch day
      const { data: day, error: dayError } = await supabase
        .from("coach_meal_plan_days")
        .select("*")
        .eq("id", dayId)
        .single();

      if (dayError) {
        console.error("Error fetching meal plan day:", dayError);
        return null;
      }

      // Fetch meals for this day
      const { data: dayMealsData, error: dayMealsError } = await supabase
        .from("coach_meal_plan_day_meals")
        .select("*")
        .eq("meal_plan_day_id", dayId)
        .order("meal_number", { ascending: true });

      if (dayMealsError) {
        console.error("Error fetching day meals:", dayMealsError);
        return { ...day, meals: [] };
      }

      // Fetch full meal details for each day meal
      const mealsWithDetails = await Promise.all(
        (dayMealsData || []).map(async (dayMeal) => {
          const mealFull = await getMealFull(dayMeal.meal_id);
          return {
            ...dayMeal,
            meal: mealFull || undefined,
          };
        })
      );

      return {
        ...day,
        meals: mealsWithDetails,
      };
    } catch (error) {
      console.error("Error getting full day:", error);
      return null;
    }
  };

  const getMealPlanFull = async (
    mealPlanId: string
  ): Promise<CoachMealPlanFull | null> => {
    try {
      const plan = getMealPlanById(mealPlanId);
      if (!plan) return null;

      // Fetch days for this plan
      const days = await getDaysForMealPlan(mealPlanId);

      // Fetch full details for each day
      const daysFull = await Promise.all(
        days.map(async (day) => {
          const dayFull = await getDayFull(day.id);
          return dayFull || day;
        })
      );

      return {
        ...plan,
        days: daysFull as CoachMealPlanDayFull[],
      };
    } catch (error) {
      console.error("Error getting full meal plan:", error);
      return null;
    }
  };

  // ===========================
  // Workout Meal Plan Link Methods
  // ===========================

  const getLinksByWorkoutPlan = async (
    planId: string
  ): Promise<CoachWorkoutMealPlanLink[]> => {
    try {
      const { data: linksData, error: linksError } = await supabase
        .from("coach_workout_meal_plan_link")
        .select("*")
        .eq("plan_id", planId);

      if (linksError) {
        console.error("Error fetching workout plan links:", linksError);
        return [];
      }

      return linksData || [];
    } catch (error) {
      console.error("Error getting links by workout plan:", error);
      return [];
    }
  };

  const getLinksByMealPlan = async (
    mealPlanId: string
  ): Promise<CoachWorkoutMealPlanLink[]> => {
    try {
      const { data: linksData, error: linksError } = await supabase
        .from("coach_workout_meal_plan_link")
        .select("*")
        .eq("meal_plan_id", mealPlanId);

      if (linksError) {
        console.error("Error fetching meal plan links:", linksError);
        return [];
      }

      return linksData || [];
    } catch (error) {
      console.error("Error getting links by meal plan:", error);
      return [];
    }
  };

  const getLinkFull = async (
    planId: string,
    mealPlanId: string
  ): Promise<CoachWorkoutMealPlanLinkWithDetails | null> => {
    try {
      const { data: linkData, error: linkError } = await supabase
        .from("coach_workout_meal_plan_link")
        .select("*")
        .eq("plan_id", planId)
        .eq("meal_plan_id", mealPlanId)
        .single();

      if (linkError) {
        console.error("Error fetching link:", linkError);
        return null;
      }

      if (!linkData) return null;

      // Fetch meal plan details
      const mealPlan = await getMealPlanFull(mealPlanId);

      // Note: We would need to import CoachWorkoutPlan type and fetch it
      // For now, we'll just include the meal plan
      return {
        ...linkData,
        meal_plan: mealPlan || undefined,
      };
    } catch (error) {
      console.error("Error getting full link:", error);
      return null;
    }
  };

  const createLink = async (
    planId: string,
    mealPlanId: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("coach_workout_meal_plan_link")
        .insert({ plan_id: planId, meal_plan_id: mealPlanId });

      if (error) {
        console.error("Error creating link:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error creating link:", error);
      return false;
    }
  };

  const deleteLink = async (
    planId: string,
    mealPlanId: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("coach_workout_meal_plan_link")
        .delete()
        .eq("plan_id", planId)
        .eq("meal_plan_id", mealPlanId);

      if (error) {
        console.error("Error deleting link:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error deleting link:", error);
      return false;
    }
  };

  useEffect(() => {
    fetchCoachMealData();
  }, []);

  const contextValue: CoachMealContextType = {
    coachFoods,
    coachRecipes,
    coachMeals,
    coachMealPlans,
    loadingState,
    refreshCoachMealData,
    getFoodById,
    getFoodsByActive,
    getRecipeById,
    getRecipesByCreator,
    getRecipesByPublic,
    getRecipeFull,
    getMealById,
    getMealsByCreator,
    getMealsByPublic,
    getMealFull,
    getMealPlanById,
    getMealPlansByCreator,
    getMealPlansByPublic,
    getMealPlanFull,
    getDaysForMealPlan,
    getDayFull,
    getLinksByWorkoutPlan,
    getLinksByMealPlan,
    getLinkFull,
    createLink,
    deleteLink,
  };

  return (
    <CoachMealContext.Provider value={contextValue}>
      {children}
    </CoachMealContext.Provider>
  );
}

// ===========================
// Custom Hook
// ===========================

export function useCoachMealContext(): CoachMealContextType {
  const context = useContext(CoachMealContext);
  if (context === undefined) {
    throw new Error(
      "useCoachMealContext must be used within a CoachMealProvider"
    );
  }
  return context;
}


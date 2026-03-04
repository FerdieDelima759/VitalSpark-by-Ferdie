"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "../utils/supabase";
import {
  BaseFood,
  BaseRecipe,
  BaseRecipeIngredient,
  BaseMeal,
  BaseMealItem,
  GeneralMealPlan,
  GeneralMealPlanDay,
  GeneralMealPlanDayMeal,
  BaseRecipeFull,
  BaseMealFull,
  GeneralMealPlanDayFull,
  GeneralMealPlanFull,
  BaseNutritionLoadingState,
} from "../types/BaseNutrition";

// ===========================
// Context Type
// ===========================

interface BaseNutritionContextType {
  // Data
  baseFoods: BaseFood[];
  baseRecipes: BaseRecipe[];
  baseMeals: BaseMeal[];
  generalMealPlans: GeneralMealPlan[];

  // Loading states
  loadingState: BaseNutritionLoadingState;

  // Methods - Foods
  refreshBaseNutritionData: () => Promise<void>;
  getFoodById: (foodId: string) => BaseFood | undefined;
  getFoodsByActive: (isActive: boolean) => BaseFood[];

  // Methods - Recipes
  getRecipeById: (recipeId: string) => BaseRecipe | undefined;
  getRecipesByCreator: (createdBy: string) => BaseRecipe[];
  getRecipesByPublic: (isPublic: boolean) => BaseRecipe[];
  getRecipeFull: (recipeId: string) => Promise<BaseRecipeFull | null>;

  // Methods - Meals
  getMealById: (mealId: string) => BaseMeal | undefined;
  getMealsByCreator: (createdBy: string) => BaseMeal[];
  getMealsByPublic: (isPublic: boolean) => BaseMeal[];
  getMealFull: (mealId: string) => Promise<BaseMealFull | null>;

  // Methods - General Meal Plans
  getGeneralMealPlanById: (mealPlanId: string) => GeneralMealPlan | undefined;
  getGeneralMealPlansByCreator: (createdBy: string) => GeneralMealPlan[];
  getGeneralMealPlansByPublic: (isPublic: boolean) => GeneralMealPlan[];
  getGeneralMealPlanFull: (
    mealPlanId: string
  ) => Promise<GeneralMealPlanFull | null>;
  getDaysForGeneralMealPlan: (
    mealPlanId: string
  ) => Promise<GeneralMealPlanDay[]>;
  getGeneralMealPlanDayFull: (
    dayId: string
  ) => Promise<GeneralMealPlanDayFull | null>;
}

// ===========================
// Context Creation
// ===========================

const BaseNutritionContext = createContext<
  BaseNutritionContextType | undefined
>(undefined);

// ===========================
// Provider Props
// ===========================

interface BaseNutritionProviderProps {
  children: ReactNode;
}

// ===========================
// Provider Component
// ===========================

export function BaseNutritionProvider({
  children,
}: BaseNutritionProviderProps): React.ReactElement {
  const [baseFoods, setBaseFoods] = useState<BaseFood[]>([]);
  const [baseRecipes, setBaseRecipes] = useState<BaseRecipe[]>([]);
  const [baseMeals, setBaseMeals] = useState<BaseMeal[]>([]);
  const [generalMealPlans, setGeneralMealPlans] = useState<GeneralMealPlan[]>(
    []
  );
  const [loadingState, setLoadingState] = useState<BaseNutritionLoadingState>({
    isLoading: true,
    error: null,
  });

  const fetchBaseNutritionData = async (): Promise<void> => {
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

      // Fetch all general meal plans
      const { data: mealPlansData, error: mealPlansError } = await supabase
        .from("general_meal_plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (mealPlansError) {
        throw mealPlansError;
      }

      setBaseFoods(foodsData || []);
      setBaseRecipes(recipesData || []);
      setBaseMeals(mealsData || []);
      setGeneralMealPlans(mealPlansData || []);
      setLoadingState({ isLoading: false, error: null });
    } catch (error: any) {
      console.error("Error fetching base nutrition data:", error);
      setLoadingState({
        isLoading: false,
        error: error.message || "Failed to fetch base nutrition data",
      });
    }
  };

  const refreshBaseNutritionData = async (): Promise<void> => {
    await fetchBaseNutritionData();
  };

  // ===========================
  // Food Methods
  // ===========================

  const getFoodById = (foodId: string): BaseFood | undefined => {
    return baseFoods.find((food) => food.id === foodId);
  };

  const getFoodsByActive = (isActive: boolean): BaseFood[] => {
    return baseFoods.filter((food) => food.is_active === isActive);
  };

  // ===========================
  // Recipe Methods
  // ===========================

  const getRecipeById = (recipeId: string): BaseRecipe | undefined => {
    return baseRecipes.find((recipe) => recipe.id === recipeId);
  };

  const getRecipesByCreator = (createdBy: string): BaseRecipe[] => {
    return baseRecipes.filter((recipe) => recipe.created_by === createdBy);
  };

  const getRecipesByPublic = (isPublic: boolean): BaseRecipe[] => {
    return baseRecipes.filter((recipe) => recipe.is_public === isPublic);
  };

  const getRecipeFull = async (
    recipeId: string
  ): Promise<BaseRecipeFull | null> => {
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

  const getMealById = (mealId: string): BaseMeal | undefined => {
    return baseMeals.find((meal) => meal.id === mealId);
  };

  const getMealsByCreator = (createdBy: string): BaseMeal[] => {
    return baseMeals.filter((meal) => meal.created_by === createdBy);
  };

  const getMealsByPublic = (isPublic: boolean): BaseMeal[] => {
    return baseMeals.filter((meal) => meal.is_public === isPublic);
  };

  const getMealFull = async (mealId: string): Promise<BaseMealFull | null> => {
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
  // General Meal Plan Methods
  // ===========================

  const getGeneralMealPlanById = (
    mealPlanId: string
  ): GeneralMealPlan | undefined => {
    return generalMealPlans.find((plan) => plan.id === mealPlanId);
  };

  const getGeneralMealPlansByCreator = (
    createdBy: string
  ): GeneralMealPlan[] => {
    return generalMealPlans.filter((plan) => plan.created_by === createdBy);
  };

  const getGeneralMealPlansByPublic = (
    isPublic: boolean
  ): GeneralMealPlan[] => {
    return generalMealPlans.filter((plan) => plan.is_public === isPublic);
  };

  const getDaysForGeneralMealPlan = async (
    mealPlanId: string
  ): Promise<GeneralMealPlanDay[]> => {
    try {
      const { data: daysData, error: daysError } = await supabase
        .from("general_meal_plan_days")
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

  const getGeneralMealPlanDayFull = async (
    dayId: string
  ): Promise<GeneralMealPlanDayFull | null> => {
    try {
      // Fetch day
      const { data: day, error: dayError } = await supabase
        .from("general_meal_plan_days")
        .select("*")
        .eq("id", dayId)
        .single();

      if (dayError) {
        console.error("Error fetching meal plan day:", dayError);
        return null;
      }

      // Fetch meals for this day
      const { data: dayMealsData, error: dayMealsError } = await supabase
        .from("general_meal_plan_day_meals")
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

  const getGeneralMealPlanFull = async (
    mealPlanId: string
  ): Promise<GeneralMealPlanFull | null> => {
    try {
      const plan = getGeneralMealPlanById(mealPlanId);
      if (!plan) return null;

      // Fetch days for this plan
      const days = await getDaysForGeneralMealPlan(mealPlanId);

      // Fetch full details for each day
      const daysFull = await Promise.all(
        days.map(async (day) => {
          const dayFull = await getGeneralMealPlanDayFull(day.id);
          return dayFull || day;
        })
      );

      return {
        ...plan,
        days: daysFull as GeneralMealPlanDayFull[],
      };
    } catch (error) {
      console.error("Error getting full meal plan:", error);
      return null;
    }
  };

  useEffect(() => {
    fetchBaseNutritionData();
  }, []);

  const contextValue: BaseNutritionContextType = {
    baseFoods,
    baseRecipes,
    baseMeals,
    generalMealPlans,
    loadingState,
    refreshBaseNutritionData,
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
    getGeneralMealPlanById,
    getGeneralMealPlansByCreator,
    getGeneralMealPlansByPublic,
    getGeneralMealPlanFull,
    getDaysForGeneralMealPlan,
    getGeneralMealPlanDayFull,
  };

  return (
    <BaseNutritionContext.Provider value={contextValue}>
      {children}
    </BaseNutritionContext.Provider>
  );
}

// ===========================
// Custom Hook
// ===========================

export function useBaseNutritionContext(): BaseNutritionContextType {
  const context = useContext(BaseNutritionContext);
  if (context === undefined) {
    throw new Error(
      "useBaseNutritionContext must be used within a BaseNutritionProvider"
    );
  }
  return context;
}

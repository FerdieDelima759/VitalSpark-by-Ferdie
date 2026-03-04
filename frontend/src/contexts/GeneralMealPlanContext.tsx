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
  GeneralMealPlan,
  GeneralMealPlanDay,
  GeneralMealPlanDayMeal,
  GeneralMealPlanDayFull,
  GeneralMealPlanFull,
  GeneralMealPlanLoadingState,
} from "../types/GeneralMealPlan";
import { CoachMealFull } from "../types/CoachMeal";

// ===========================
// Context Type
// ===========================

interface GeneralMealPlanContextType {
  // Data
  generalMealPlans: GeneralMealPlan[];

  // Loading states
  loadingState: GeneralMealPlanLoadingState;

  // Methods - Meal Plans
  refreshGeneralMealPlanData: () => Promise<void>;
  getMealPlanById: (mealPlanId: string) => GeneralMealPlan | undefined;
  getMealPlansByCreator: (createdBy: string) => GeneralMealPlan[];
  getMealPlansByPublic: (isPublic: boolean) => GeneralMealPlan[];
  getMealPlanFull: (
    mealPlanId: string
  ) => Promise<GeneralMealPlanFull | null>;
  getDaysForMealPlan: (
    mealPlanId: string
  ) => Promise<GeneralMealPlanDay[]>;
  getDayFull: (
    dayId: string
  ) => Promise<GeneralMealPlanDayFull | null>;
}

// ===========================
// Context Creation
// ===========================

const GeneralMealPlanContext = createContext<
  GeneralMealPlanContextType | undefined
>(undefined);

// ===========================
// Provider Props
// ===========================

interface GeneralMealPlanProviderProps {
  children: ReactNode;
}

// ===========================
// Provider Component
// ===========================

export function GeneralMealPlanProvider({
  children,
}: GeneralMealPlanProviderProps): React.ReactElement {
  const [generalMealPlans, setGeneralMealPlans] = useState<GeneralMealPlan[]>(
    []
  );
  const [loadingState, setLoadingState] =
    useState<GeneralMealPlanLoadingState>({
      isLoading: true,
      error: null,
    });

  const fetchGeneralMealPlanData = async (): Promise<void> => {
    try {
      setLoadingState({ isLoading: true, error: null });

      // Fetch all meal plans
      const { data: mealPlansData, error: mealPlansError } = await supabase
        .from("general_meal_plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (mealPlansError) {
        throw mealPlansError;
      }

      setGeneralMealPlans(mealPlansData || []);
      setLoadingState({ isLoading: false, error: null });
    } catch (error: any) {
      console.error("Error fetching general meal plan data:", error);
      setLoadingState({
        isLoading: false,
        error: error.message || "Failed to fetch general meal plan data",
      });
    }
  };

  const refreshGeneralMealPlanData = async (): Promise<void> => {
    await fetchGeneralMealPlanData();
  };

  // ===========================
  // Meal Plan Methods
  // ===========================

  const getMealPlanById = (
    mealPlanId: string
  ): GeneralMealPlan | undefined => {
    return generalMealPlans.find((plan) => plan.id === mealPlanId);
  };

  const getMealPlansByCreator = (createdBy: string): GeneralMealPlan[] => {
    return generalMealPlans.filter((plan) => plan.created_by === createdBy);
  };

  const getMealPlansByPublic = (isPublic: boolean): GeneralMealPlan[] => {
    return generalMealPlans.filter((plan) => plan.is_public === isPublic);
  };

  const getDaysForMealPlan = async (
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

  const getMealFullHelper = async (
    mealId: string
  ): Promise<CoachMealFull | null> => {
    try {
      // Fetch meal
      const { data: mealData, error: mealError } = await supabase
        .from("base_meals")
        .select("*")
        .eq("id", mealId)
        .single();

      if (mealError || !mealData) {
        return null;
      }

      // Fetch meal items
      const { data: itemsData, error: itemsError } = await supabase
        .from("base_meal_items")
        .select("*")
        .eq("meal_id", mealId)
        .order("position", { ascending: true });

      if (itemsError) {
        console.error("Error fetching meal items:", itemsError);
        return { ...mealData, items: [] };
      }

      // Fetch details for each item
      const itemsWithDetails = await Promise.all(
        (itemsData || []).map(async (item) => {
          if (item.item_type === "recipe" && item.recipe_id) {
            // Fetch recipe
            const { data: recipeData } = await supabase
              .from("base_recipes")
              .select("*")
              .eq("id", item.recipe_id)
              .single();

            // Fetch recipe ingredients
            const { data: ingredientsData } = await supabase
              .from("base_recipe_ingredients")
              .select("*")
              .eq("recipe_id", item.recipe_id)
              .order("created_at", { ascending: true });

            // Fetch food details for ingredients
            const ingredientIds =
              ingredientsData?.map((ing) => ing.food_id) || [];
            const foodsMap = new Map();

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
              ingredientsData?.map((ingredient) => ({
                ...ingredient,
                food: foodsMap.get(ingredient.food_id),
              })) || [];

            return {
              ...item,
              recipe: recipeData
                ? {
                    ...recipeData,
                    ingredients: ingredientsWithFoods,
                  }
                : undefined,
            };
          } else if (item.item_type === "food" && item.food_id) {
            const { data: foodData } = await supabase
              .from("base_foods")
              .select("*")
              .eq("id", item.food_id)
              .single();

            return {
              ...item,
              food: foodData || undefined,
            };
          }
          return item;
        })
      );

      return {
        ...mealData,
        items: itemsWithDetails,
      };
    } catch (error) {
      console.error("Error getting full meal:", error);
      return null;
    }
  };

  const getDayFull = async (
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
          const mealFull = await getMealFullHelper(dayMeal.meal_id);
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
  ): Promise<GeneralMealPlanFull | null> => {
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
        days: daysFull as GeneralMealPlanDayFull[],
      };
    } catch (error) {
      console.error("Error getting full meal plan:", error);
      return null;
    }
  };

  useEffect(() => {
    fetchGeneralMealPlanData();
  }, []);

  const contextValue: GeneralMealPlanContextType = {
    generalMealPlans,
    loadingState,
    refreshGeneralMealPlanData,
    getMealPlanById,
    getMealPlansByCreator,
    getMealPlansByPublic,
    getMealPlanFull,
    getDaysForMealPlan,
    getDayFull,
  };

  return (
    <GeneralMealPlanContext.Provider value={contextValue}>
      {children}
    </GeneralMealPlanContext.Provider>
  );
}

// ===========================
// Custom Hook
// ===========================

export function useGeneralMealPlanContext(): GeneralMealPlanContextType {
  const context = useContext(GeneralMealPlanContext);
  if (context === undefined) {
    throw new Error(
      "useGeneralMealPlanContext must be used within a GeneralMealPlanProvider"
    );
  }
  return context;
}


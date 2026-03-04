// ===========================
// Base Nutrition Types
// ===========================

// ===========================
// Base Types
// ===========================

export interface BaseFood {
  id: string;
  name: string;
  brand: string | null;
  serving_size: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BaseRecipe {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  estimated_prep_minutes: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BaseRecipeIngredient {
  id: string;
  recipe_id: string;
  food_id: string;
  quantity: number;
  unit: string;
  created_at: string;
}

export interface BaseMeal {
  id: string;
  name: string;
  description: string | null;
  typical_time_of_day: string | null;
  goal: string | null;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type MealItemType = "recipe" | "food";

export interface BaseMealItem {
  id: string;
  meal_id: string;
  item_type: MealItemType;
  recipe_id: string | null;
  food_id: string | null;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  position: number;
  created_at: string;
}

export interface GeneralMealPlan {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  duration_days: number;
  estimated_daily_calories: number | null;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeneralMealPlanDay {
  id: string;
  meal_plan_id: string;
  day_number: number;
  label: string | null;
  notes: string | null;
  created_at: string;
}

export interface GeneralMealPlanDayMeal {
  id: string;
  meal_plan_day_id: string;
  meal_id: string;
  meal_number: number;
  typical_time_of_the_day: string | null;
  variant_label: string | null;
  planned_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

// ===========================
// Extended Types with Relations
// ===========================

export interface BaseRecipeIngredientWithFood extends BaseRecipeIngredient {
  food?: BaseFood;
}

export interface BaseRecipeFull extends BaseRecipe {
  ingredients?: BaseRecipeIngredientWithFood[];
}

export interface BaseMealItemWithDetails extends BaseMealItem {
  recipe?: BaseRecipeFull;
  food?: BaseFood;
}

export interface BaseMealFull extends BaseMeal {
  items?: BaseMealItemWithDetails[];
}

export interface GeneralMealPlanDayMealWithMeal extends GeneralMealPlanDayMeal {
  meal?: BaseMealFull;
}

export interface GeneralMealPlanDayFull extends GeneralMealPlanDay {
  meals?: GeneralMealPlanDayMealWithMeal[];
}

export interface GeneralMealPlanFull extends GeneralMealPlan {
  days?: GeneralMealPlanDayFull[];
}

// ===========================
// API Response Types
// ===========================

export interface BaseNutritionDataResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface BaseNutritionLoadingState {
  isLoading: boolean;
  error: string | null;
}


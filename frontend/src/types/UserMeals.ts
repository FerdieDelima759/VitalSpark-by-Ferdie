// ===========================
// User Meals Types
// Based on public.user_meal_* and user_workout_meal_plan_link tables
// ===========================

// ===========================
// Link table: workout plan <-> meal plan
// ===========================

export interface UserWorkoutMealPlanLink {
  meal_plan_id: string;
  workout_plan_id: string;
}

// ===========================
// user_meal_plans
// ===========================

export interface UserMealPlan {
  id: string;
  created_at: string;
  plan_name: string | null;
  duration_dayss: number | null;
  completed: boolean | null;
  image_path: string | null;
  image_alt: string | null;
  user_id: string | null;
}

// ===========================
// user_meal_weekly_plan
// ===========================

export interface UserMealWeeklyPlan {
  id: string;
  created_at: string;
  plan_id: string | null;
  week_number: number | null;
  remaining_days: number | null;
}

// ===========================
// user_meal_weekly_day_plan
// ===========================

export interface UserMealWeeklyDayPlan {
  id: string;
  created_at: string;
  week_plan_id: string | null;
  day_name: string | null;
  day_theme: string | null;
  daily_budget: string | null;
  calorie_target: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
}

// ===========================
// user_meals
// ===========================

export interface UserMeal {
  id: string;
  created_at: string;
  meal_name: string | null;
  best_time_to_eat: string | null;
  meal_day_plan_id: string | null;
  meal_time: string | null;
  est_cost: number | null;
  cooking_instructions: string[] | null;
}

// ===========================
// user_meals_ingredients
// ===========================

export interface UserMealIngredient {
  id: string;
  created_at: string;
  item_name: string | null;
  measurement: string | null;
  price: string | null;
}

// ===========================
// user_meal_ingredients_link
// ===========================

export interface UserMealIngredientLink {
  id: string;
  meal_id: string | null;
  ingredient_id: string | null;
}

// ===========================
// API response
// ===========================

export interface UserMealsDataResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UserMealsLoadingState {
  isLoading: boolean;
  error: string | null;
}

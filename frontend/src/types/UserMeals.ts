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
// user_meal_records
// ===========================

export interface UserMealRecord {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  record_date: string;
  consumed_at: string | null;
  planned_meal_id: string | null;
  meal_plan_id: string | null;
  week_plan_id: string | null;
  day_plan_id: string | null;
  source: "planned" | "manual" | "quick_add";
  status: "eaten" | "skipped" | "partial" | "missed";
  meal_time: string | null;
  meal_name_snapshot: string | null;
  best_time_to_eat_snapshot: string | null;
  portion_multiplier: number | null;
  completion_percent: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fats_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  notes: string | null;
  photo_url: string | null;
  hunger_before: number | null;
  fullness_after: number | null;
}

// ===========================
// user_meal_daily_logs
// ===========================

export interface UserMealDailyLog {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  log_date: string;
  meal_plan_id: string | null;
  total_calories: number | null;
  total_protein_g: number | null;
  total_carbs_g: number | null;
  total_fats_g: number | null;
  water_ml: number | null;
  adherence_score: number | null;
  is_cheat_day: boolean | null;
  notes: string | null;
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

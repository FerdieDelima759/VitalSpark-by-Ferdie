// ===========================
// General Meal Plan Types
// ===========================

// ===========================
// Base Types
// ===========================

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

import { CoachMealFull } from "./CoachMeal";

export interface GeneralMealPlanDayMealWithMeal extends GeneralMealPlanDayMeal {
  meal?: CoachMealFull;
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

export interface GeneralMealPlanDataResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface GeneralMealPlanLoadingState {
  isLoading: boolean;
  error: string | null;
}


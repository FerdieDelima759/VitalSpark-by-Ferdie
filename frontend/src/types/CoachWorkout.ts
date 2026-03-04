// ===========================
// Coach Workout Types
// ===========================

export interface CoachWorkoutPlanTag {
  plan_id: string;
  tag_id: string;
}

export interface CoachWorkoutPlan {
  id: string;
  created_by: string;
  name: string;
  description: string | null;
  motivation: string | null;
  level: string;
  total_minutes: number | null;
  total_calories: number | null;
  image_path: string | null;
  image_alt: string | null;
  created_at: string;
  number_of_weeks: number | null;
  duration_days: number | null;
  tier_code: string | null;
  category: string | null;
  total_exercises: number | null;
}

export interface CoachWorkoutPlanExerciseDetails {
  id: string;
  name: string;
  default_safety_tip: string | null;
  primary_muscle: string | null;
  image_path: string | null;
  image_alt: string | null;
  created_at: string;
  image_slug: string | null;
  section: string | null;
}

export interface CoachWorkoutDailyPlan {
  id: string;
  plan_id: string;
  day_number: number;
  number_of_exercises: number;
  total_minutes: number | null;
  total_calories: number | null;
  created_at: string;
  daily_motivation: string | null;
  reminder: string | null;
  plan_goal: string | null;
}

export interface CoachWorkoutDailyPlanExercise {
  id: string;
  daily_plan_id: string;
  day_number: number;
  exercise_id: string;
  position: number;
  section: string;
  safety_tip: string | null;
  sets: number | null;
  reps: number | null;
  duration_seconds: number | null;
  rest_seconds: number;
  per_side: boolean;
}

// ===========================
// Extended Types with Relations
// ===========================

export interface CoachWorkoutDailyPlanExerciseWithDetails
  extends CoachWorkoutDailyPlanExercise {
  exercise_details?: CoachWorkoutPlanExerciseDetails;
}

export interface CoachWorkoutDailyPlanFull extends CoachWorkoutDailyPlan {
  exercises?: CoachWorkoutDailyPlanExerciseWithDetails[];
}

export interface CoachWorkoutPlanWithTags extends CoachWorkoutPlan {
  tags?: import("./Workout").WorkoutTag[];
}

export interface CoachWorkoutPlanFull extends CoachWorkoutPlan {
  tags?: import("./Workout").WorkoutTag[];
  daily_plans?: CoachWorkoutDailyPlanFull[];
}

// ===========================
// API Response Types
// ===========================

export interface CoachWorkoutDataResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CoachWorkoutLoadingState {
  isLoading: boolean;
  error: string | null;
}


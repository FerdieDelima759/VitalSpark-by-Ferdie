// ===========================
// User Workout Plan Types
// ===========================

export interface UserWorkoutPlan {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  image_path: string | null;
  image_alt: string | null;
  created_at: string;
  duration_days: number | null;
  category: string | null;
  user_id: string | null;
  is_finished?: boolean | null;
}

// ===========================
// API Response Types
// ===========================

export interface UserWorkoutDataResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UserWorkoutLoadingState {
  isLoading: boolean;
  error: string | null;
}

// ===========================
// Create/Update Payload Types
// ===========================

export interface CreateUserWorkoutPlanPayload {
  name: string;
  description?: string | null;
  tags?: string[] | null;
  image_path?: string | null;
  image_alt?: string | null;
  duration_days?: number | null;
  category?: string | null;
  user_id: string;
  // Used for image path generation if image_path is not provided
  gender?: string;
  location?: string;
}

export interface UpdateUserWorkoutPlanPayload {
  name?: string;
  description?: string | null;
  tags?: string[] | null;
  image_path?: string | null;
  image_alt?: string | null;
  duration_days?: number | null;
  category?: string | null;
}

// ===========================
// User Workout Week Plan Types (Parent)
// Based on public.user_workout_weekly_plan table
// ===========================

export interface UserWorkoutWeekPlan {
  id: string;
  created_at: string;
  week_number: number | null;
  plan_id: string; // FK to user_workout_plans
  rest_days: string[] | null;
  remaining_days: number | null;
  status?: "Not Started" | "In Progress" | "Completed" | null;
}

export interface CreateUserWorkoutWeekPlanPayload {
  week_number: number | null;
  plan_id: string; // FK to user_workout_plans
  rest_days: string[] | null;
  remaining_days: number | null;
}

// ===========================
// User Workout Weekly Daily Plan Types (Child)
// Based on public.user_workout_weekly_day_plan table
// ===========================

export interface UserWorkoutWeeklyPlan {
  id?: string;
  day: string | null;
  title: string | null;
  focus: string[] | null;
  motivation: string | null;
  week_plan_id: string; // FK to user_workout_weekly_plan
  total_calories: string | null; // e.g., "350 kCal"
  total_minutes: number | null;
  rpe_record?: number | null; // Session difficulty rating (1-10)
  isCompleted?: boolean | null; // Marked true after workout completion + rating
  is_completed?: boolean | null; // Fallback for snake_case schema
  created_at?: string;
}

export interface CreateUserWorkoutWeeklyPlanPayload {
  day: string | null;
  title: string | null;
  focus: string[] | null;
  motivation: string | null;
  week_plan_id: string; // FK to user_workout_weekly_plan
  total_calories: string | null; // e.g., "350 kCal"
  total_minutes: number | null;
  rpe_record?: number | null;
}

// ===========================
// User Exercise Details Types
// Based on public.user_exercises_details table
// ===========================

export type ExerciseSection = "warmup" | "main" | "cooldown";

export interface UserExerciseDetails {
  id: string;
  name: string; // from prompt pmpt_696b4c297ebc8193ab67088cd5e034c10a70cda92773d275
  safety_cue: string | null; // from prompt pmpt_696b4c297ebc8193ab67088cd5e034c10a70cda92773d275
  created_at: string; // auto-generated
  image_slug: string | null; // format: "section/word-word-word" (e.g., "warmup/jumping-jacks")
  section: ExerciseSection | null; // "warmup" | "main" | "cooldown"
  equipment: string[] | null; // from prompt pmpt_696b4c297ebc8193ab67088cd5e034c10a70cda92773d275
}

export interface CreateUserExerciseDetailsPayload {
  name: string; // required - from prompt
  safety_cue?: string | null; // from prompt
  image_slug?: string | null; // auto-generated from section + name if not provided
  section: ExerciseSection; // required - "warmup" | "main" | "cooldown"
  equipment?: string[] | null; // from prompt
}

export interface UpdateUserExerciseDetailsPayload {
  name?: string;
  safety_cue?: string | null;
  image_slug?: string | null;
  section?: ExerciseSection;
  equipment?: string[] | null;
}

// ===========================
// User Workout Plan Exercises Types
// Based on public.user_workout_plan_exercises table
// ===========================

export interface UserWorkoutPlanExercise {
  id: string; // UUID - part of composite primary key (id, position)
  weekly_plan_id: string; // FK to user_workout_weekly_day_plan
  exercise_id: string; // FK to user_exercises_details
  position: number; // warmup: 101++, main: 1++, cooldown: 201++
  section: ExerciseSection; // "warmup" | "main" | "cooldown"
  sets: number | null; // Parsed from sets_reps_duration_seconds_rest
  reps: number | null; // Parsed from sets_reps_duration_seconds_rest
  duration_seconds: number | null; // Parsed from sets_reps_duration_seconds_rest
  rest_seconds: number; // Parsed from sets_reps_duration_seconds_rest (default: 30)
  per_side: boolean; // from prompt: "yes" -> true, "no" -> false
  image_path: string | null; // https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/exercises/[gender]/[image_slug].png
  image_alt: string | null; // Generated from exercise name
  description: string | null; // From prompt pmpt_69d7d7aad26c8190ac376c8997bcf4c20f277dac9c469df0
  is_image_generated: boolean | null; // Background image generation status
}

// Exercise with joined details from user_exercises_details
export interface UserWorkoutPlanExerciseWithDetails extends UserWorkoutPlanExercise {
  exercise_details: UserExerciseDetails | null;
}

export interface CreateUserWorkoutPlanExercisePayload {
  id?: string; // optional - auto-generated UUID if not provided
  weekly_plan_id: string; // required - FK to user_workout_weekly_day_plan
  exercise_id: string; // required - FK to user_exercises_details
  position: number; // required - warmup: 101++, main: 1++, cooldown: 201++
  section: ExerciseSection; // required - "warmup" | "main" | "cooldown"
  sets?: number | null; // Parsed from sets_reps_duration_seconds_rest
  reps?: number | null; // Parsed from sets_reps_duration_seconds_rest
  duration_seconds?: number | null; // Parsed from sets_reps_duration_seconds_rest
  rest_seconds?: number; // Parsed from sets_reps_duration_seconds_rest (default: 30)
  per_side?: boolean; // from prompt: "yes" -> true, "no" -> false (default: false)
  image_path?: string | null; // Generated from gender + image_slug
  image_alt?: string | null; // Generated from exercise name
  description?: string | null; // From prompt pmpt_69d7d7aad26c8190ac376c8997bcf4c20f277dac9c469df0
  is_image_generated?: boolean | null; // Background image generation status
}

// Helper type for batch creation with exercise details
export interface CreatePlanExerciseWithDetails {
  exerciseName: string;
  exerciseId: string; // From saved user_exercises_details
  section: ExerciseSection;
  setsRepsDurationRest: string; // Raw string from prompt
  perSide: string; // "yes" | "no"
  description: string | null;
  imageSlug: string | null; // From user_exercises_details
  gender: string; // For image path generation
}

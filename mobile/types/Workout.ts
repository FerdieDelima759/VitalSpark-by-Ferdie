// ===========================
// Workout Types
// ===========================

export interface WorkoutTag {
    id: string;
    name: string;
}

export interface WorkoutPlanTag {
    plan_id: string;
    tag_id: string;
}

export interface WorkoutPlan {
    id: string;
    name: string;
    description: string | null;
    motivation: string | null;
    level: string;
    total_minutes: number | null;
    total_calories: number | null;
    is_free: boolean;
    image_path: string | null;
    image_alt: string | null;
    created_at: string;
    duration_days: number | null;
    tier_code: string | null;
    category: string | null;
    total_exercises: number | null;
}

export interface WorkoutPlanExerciseDetails {
    id: string;
    name: string;
    default_safety_tip: string | null;
    primary_muscle: string | null;
    image_path: string | null;
    image_alt: string | null;
    created_at: string;
    image_slug: string | null;
}

export interface WorkoutPlanExercise {
    plan_id: string;
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

export interface WorkoutPlanWithTags extends WorkoutPlan {
    tags?: WorkoutTag[];
}

export interface WorkoutPlanExerciseWithDetails extends WorkoutPlanExercise {
    exercise_details?: WorkoutPlanExerciseDetails;
}

export interface WorkoutPlanFull extends WorkoutPlan {
    tags?: WorkoutTag[];
    exercises?: WorkoutPlanExerciseWithDetails[];
}

// ===========================
// API Response Types
// ===========================

export interface WorkoutDataResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface WorkoutLoadingState {
    isLoading: boolean;
    error: string | null;
}


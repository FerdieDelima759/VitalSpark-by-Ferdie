// ===========================
// User Workout Types
// ===========================

export interface UserWorkoutTag {
    id: string;
    name: string;
}

export interface UserWorkoutPlan {
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
    user_id: string | null;
}

export interface UserWorkoutPlanTag {
    user_plan_id: string;
    tag_id: string;
}

export interface UserWorkoutPlanExerciseDetails {
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

export interface UserWorkoutPlanExercise {
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

export interface UserWorkoutPlanWithTags extends UserWorkoutPlan {
    tags?: UserWorkoutTag[];
}

export interface UserWorkoutPlanExerciseWithDetails extends UserWorkoutPlanExercise {
    exercise_details?: UserWorkoutPlanExerciseDetails;
}

export interface UserWorkoutPlanFull extends UserWorkoutPlan {
    tags?: UserWorkoutTag[];
    exercises?: UserWorkoutPlanExerciseWithDetails[];
}

// ===========================
// Payload Types
// ===========================

export interface UserWorkoutPlanCreatePayload {
    name: string;
    description?: string | null;
    motivation?: string | null;
    level?: string;
    total_minutes?: number | null;
    total_calories?: number | null;
    is_free?: boolean;
    image_path?: string | null;
    image_alt?: string | null;
    duration_days?: number | null;
    tier_code?: string | null;
    category?: string | null;
    total_exercises?: number | null;
    user_id: string;
}

export interface UserWorkoutPlanUpdatePayload {
    name?: string;
    description?: string | null;
    motivation?: string | null;
    level?: string;
    total_minutes?: number | null;
    total_calories?: number | null;
    is_free?: boolean;
    image_path?: string | null;
    image_alt?: string | null;
    duration_days?: number | null;
    tier_code?: string | null;
    category?: string | null;
    total_exercises?: number | null;
}

export interface UserWorkoutPlanExerciseCreatePayload {
    plan_id: string;
    exercise_id: string;
    position: number;
    section?: string;
    safety_tip?: string | null;
    sets?: number | null;
    reps?: number | null;
    duration_seconds?: number | null;
    rest_seconds?: number;
    per_side?: boolean;
}

export interface UserWorkoutPlanExerciseUpdatePayload {
    position?: number;
    section?: string;
    safety_tip?: string | null;
    sets?: number | null;
    reps?: number | null;
    duration_seconds?: number | null;
    rest_seconds?: number;
    per_side?: boolean;
}

export interface UserWorkoutPlanExerciseDetailsCreatePayload {
    name: string;
    default_safety_tip?: string | null;
    primary_muscle?: string | null;
    image_path?: string | null;
    image_alt?: string | null;
    image_slug?: string | null;
    section?: string | null;
}

export interface UserWorkoutPlanExerciseDetailsUpdatePayload {
    name?: string;
    default_safety_tip?: string | null;
    primary_muscle?: string | null;
    image_path?: string | null;
    image_alt?: string | null;
    image_slug?: string | null;
    section?: string | null;
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
    isUpdating: boolean;
    isSaving: boolean;
    error: string | null;
}

export interface ApiError {
    message: string;
    code?: string;
    statusCode?: number;
}


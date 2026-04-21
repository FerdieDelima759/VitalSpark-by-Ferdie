// ===========================
// Workout Session Types
// ===========================

export interface UserWorkoutSession {
    id: string;
    user_id: string;
    plan_id: string | null;
    day_plan_id: string | null;
    started_at: string;
    ended_at: string | null;
    timezone: string | null;
    notes: string | null;
    device_info: Record<string, any>;
    total_sets: number | null;
    total_reps: number | null;
    total_duration_seconds: number | null;
    total_rest_seconds: number | null;
    total_calories: number | null;
    created_at: string;
    updated_at: string;
}

export interface UserWorkoutSessionExercise {
    id: string;
    session_id: string;
    user_id: string;
    exercise_id: string;
    plan_id: string | null;
    plan_position: number | null;
    order_in_session: number;
    exercise_name_snapshot: string | null;
    section_snapshot: string | null;
    safety_tip_snapshot: string | null;
    target_sets: number | null;
    target_reps: number | null;
    target_duration_seconds: number | null;
    actual_sets: number | null;
    actual_reps: number | null;
    actual_duration_seconds: number | null;
    actual_rest_seconds: number | null;
    notes: string | null;
    meta: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface UserWorkoutSessionSet {
    id: string;
    session_exercise_id: string;
    user_id: string;
    set_number: number;
    side: string | null;
    reps: number | null;
    duration_seconds: number | null;
    weight_kg: number | null;
    distance_meters: number | null;
    rpe: number | null;
    tempo: string | null;
    rest_seconds: number | null;
    completed: boolean;
    notes: string | null;
    meta: Record<string, any>;
    created_at: string;
    updated_at: string;
}

// ===========================
// Extended Types with Relations
// ===========================

export interface UserWorkoutSessionExerciseWithSets extends UserWorkoutSessionExercise {
    sets?: UserWorkoutSessionSet[];
}

export interface UserWorkoutSessionFull extends UserWorkoutSession {
    exercises?: UserWorkoutSessionExerciseWithSets[];
}

// ===========================
// Payload Types - Create
// ===========================

export interface UserWorkoutSessionCreatePayload {
    user_id: string;
    plan_id?: string | null;
    day_plan_id?: string | null;
    started_at?: string;
    timezone?: string | null;
    notes?: string | null;
    device_info?: Record<string, any>;
}

export interface UserWorkoutSessionExerciseCreatePayload {
    session_id: string;
    user_id: string;
    exercise_id: string;
    plan_id?: string | null;
    plan_position?: number | null;
    order_in_session: number;
    exercise_name_snapshot?: string | null;
    section_snapshot?: string | null;
    safety_tip_snapshot?: string | null;
    target_sets?: number | null;
    target_reps?: number | null;
    target_duration_seconds?: number | null;
    notes?: string | null;
    meta?: Record<string, any>;
}

export interface UserWorkoutSessionSetCreatePayload {
    session_exercise_id: string;
    user_id: string;
    set_number: number;
    side?: string | null;
    reps?: number | null;
    duration_seconds?: number | null;
    weight_kg?: number | null;
    distance_meters?: number | null;
    rpe?: number | null;
    tempo?: string | null;
    rest_seconds?: number | null;
    completed?: boolean;
    notes?: string | null;
    meta?: Record<string, any>;
}

// ===========================
// Payload Types - Update
// ===========================

export interface UserWorkoutSessionUpdatePayload {
    ended_at?: string | null;
    timezone?: string | null;
    notes?: string | null;
    device_info?: Record<string, any>;
    total_sets?: number | null;
    total_reps?: number | null;
    total_duration_seconds?: number | null;
    total_rest_seconds?: number | null;
    total_calories?: number | null;
}

export interface UserWorkoutSessionExerciseUpdatePayload {
    order_in_session?: number;
    actual_sets?: number | null;
    actual_reps?: number | null;
    actual_duration_seconds?: number | null;
    actual_rest_seconds?: number | null;
    notes?: string | null;
    meta?: Record<string, any>;
}

export interface UserWorkoutSessionSetUpdatePayload {
    side?: string | null;
    reps?: number | null;
    duration_seconds?: number | null;
    weight_kg?: number | null;
    distance_meters?: number | null;
    rpe?: number | null;
    tempo?: string | null;
    rest_seconds?: number | null;
    completed?: boolean;
    notes?: string | null;
    meta?: Record<string, any>;
}

// ===========================
// API Response Types
// ===========================

export interface UserWorkoutSessionDataResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface UserWorkoutSessionLoadingState {
    isLoading: boolean;
    isUpdating: boolean;
    isSaving: boolean;
    error: string | null;
}

export interface UserWorkoutSessionApiError {
    message: string;
    code?: string;
    statusCode?: number;
}

// ===========================
// Query Filter Types
// ===========================

export interface UserWorkoutSessionFilters {
    userId?: string;
    planId?: string | null;
    startDate?: string;
    endDate?: string;
    isCompleted?: boolean;
}

export interface UserWorkoutSessionStats {
    total_sessions: number;
    total_duration_seconds: number;
    total_calories: number;
    total_exercises: number;
    total_sets: number;
    total_reps: number;
    average_session_duration: number;
}


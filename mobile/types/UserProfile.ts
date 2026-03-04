// ===========================
// Core Types
// ===========================

export interface UserProfile {
    // Core identification
    id?: string;
    created_at?: string;
    user_id: string;
    updated_at?: string;

    // Personal information
    current_mood?: string;
    full_name?: string;
    nickname?: string;
    age_range?: string;
    gender?: string;

    // Onboarding status
    current_step?: number;
    is_onboarding_complete?: boolean;

    // Localization
    preferred_language?: string;

    // Physical measurements
    height?: number;
    weight?: number;
    height_unit?: string;
    weight_unit?: string;

    // Location
    country?: string;
    region_province?: string;

    // Fitness preferences
    fitness_goal?: string;
    fitness_level?: string;
    workout_location?: string;
    equipment_list?: string[];
    workout_duration_minutes?: number;
    weekly_frequency?: string[];
    target_muscle_groups?: string[];

    // Nutrition preferences
    dietary_preference?: string;
    meal_plan_duration?: string[];

    // Health information
    health_conditions?: string[];

    // Security
    biometrics_enabled?: boolean;

    // Financial
    weekly_budget?: number;
    weekly_budget_currency?: string;

    // Subscription
    plan_code?: string;
}

export interface UserRole {
    user_id: string;
    role: string;
}

// ===========================
// Helper Types for Profile Sections
// ===========================

export interface PersonalInfo {
    current_mood?: string;
    full_name?: string;
    nickname?: string;
    age_range?: string;
    gender?: string;
}

export interface PhysicalMeasurements {
    height?: number;
    weight?: number;
    height_unit?: string;
    weight_unit?: string;
}

export interface LocationInfo {
    country?: string;
    region_province?: string;
}

export interface FitnessPreferences {
    fitness_goal?: string;
    fitness_level?: string;
    workout_location?: string;
    equipment_list?: string[];
    workout_duration_minutes?: number;
    weekly_frequency?: string[];
    target_muscle_groups?: string[];
}

export interface NutritionPreferences {
    dietary_preference?: string;
    meal_plan_duration?: string[];
}

export interface HealthInfo {
    health_conditions?: string[];
}

export interface SecuritySettings {
    biometrics_enabled?: boolean;
}

export interface FinancialInfo {
    weekly_budget?: number;
    weekly_budget_currency?: string;
}

export interface SubscriptionInfo {
    plan_code?: string;
}

export interface OnboardingStatus {
    current_step?: number;
    is_onboarding_complete?: boolean;
}

export interface LanguageSettings {
    preferred_language?: string;
}

// ===========================
// Update Payload Types
// ===========================

export type ProfileUpdatePayload = Partial<UserProfile>;

export type PersonalInfoUpdate = Partial<PersonalInfo>;
export type PhysicalMeasurementsUpdate = Partial<PhysicalMeasurements>;
export type LocationInfoUpdate = Partial<LocationInfo>;
export type FitnessPreferencesUpdate = Partial<FitnessPreferences>;
export type NutritionPreferencesUpdate = Partial<NutritionPreferences>;
export type HealthInfoUpdate = Partial<HealthInfo>;
export type SecuritySettingsUpdate = Partial<SecuritySettings>;
export type FinancialInfoUpdate = Partial<FinancialInfo>;
export type SubscriptionInfoUpdate = Partial<SubscriptionInfo>;
export type OnboardingStatusUpdate = Partial<OnboardingStatus>;
export type LanguageSettingsUpdate = Partial<LanguageSettings>;

// ===========================
// Validation Types
// ===========================

export interface ProfileValidation {
    isValid: boolean;
    errors: Record<string, string>;
}

// ===========================
// State Types
// ===========================

export interface ProfileLoadingState {
    isLoading: boolean;
    isUpdating: boolean;
    isSaving: boolean;
    error: string | null;
}

// ===========================
// Response Types
// ===========================

export interface ProfileDataResponse {
    data: UserProfile | null;
    error: string | null;
    isLoading: boolean;
}

export interface ProfileUpdateResponse {
    success: boolean;
    error: string | null;
    data?: UserProfile;
}

export interface RoleDataResponse {
    data: UserRole | null;
    error: string | null;
    isLoading: boolean;
}

export interface ApiError {
    message: string;
    code?: string;
    statusCode?: number;
}


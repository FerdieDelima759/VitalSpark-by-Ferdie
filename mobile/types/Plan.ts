// ===========================
// Core Plan Types
// ===========================

export interface Plan {
    code: string;
    name: string;
    price_usd: number;
    features: PlanFeatures;
    stripe_price_id?: string | null;
    is_active: boolean;
    created_at?: string;
}

export interface PlanFeatures {
    ai?: {
        recommendations?: boolean;
        coach_chat_messages_per_day?: number;
    };
    limits?: {
        saved_plans?: number;
        workouts_per_day?: number;
        nutrition_logs_per_day?: number;
    };
    modules?: {
        ai_coach?: boolean;
        training?: boolean;
        analytics?: boolean | string;
        community?: boolean;
        nutrition?: boolean;
    };
    // Legacy support
    features_list?: string[];
}

// ===========================
// Plan Tier Types
// ===========================

export type PlanTier = "free" | "pro" | "premium";

export interface PlanTierInfo {
    tier: PlanTier;
    code: string;
    name: string;
    displayName: string;
    description: string;
    badge?: string;
    color: string;
    gradientColors: readonly [string, string];
    icon: string;
}

// ===========================
// State Types
// ===========================

export interface PlansLoadingState {
    isLoading: boolean;
    isUpdating: boolean;
    error: string | null;
}

// ===========================
// Response Types
// ===========================

export interface PlansResponse {
    data: Plan[];
    error: string | null;
    isLoading: boolean;
}

export interface PlanResponse {
    data: Plan | null;
    error: string | null;
    isLoading: boolean;
}

// ===========================
// Helper Types
// ===========================

export interface PlanComparison {
    feature: string;
    free: boolean | string;
    pro: boolean | string;
    premium: boolean | string;
}

export interface SubscriptionInfo {
    currentPlan: PlanTier;
    canUpgrade: boolean;
    canDowngrade: boolean;
    nextPlan?: PlanTier;
}


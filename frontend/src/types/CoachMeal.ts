// ===========================
// Coach Meal Types
// ===========================

// ===========================
// Base Types
// ===========================

export interface CoachFood {
    id: string;
    name: string;
    brand: string | null;
    serving_size: string | null;
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CoachRecipe {
    id: string;
    name: string;
    description: string | null;
    instructions: string | null;
    estimated_prep_minutes: number | null;
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    is_public: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface CoachRecipeIngredient {
    id: string;
    recipe_id: string;
    food_id: string;
    quantity: number;
    unit: string;
    created_at: string;
}

export interface CoachMeal {
    id: string;
    name: string;
    description: string | null;
    typical_time_of_day: string | null;
    goal: string | null;
    is_public: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export type MealItemType = "recipe" | "food";

export interface CoachMealItem {
    id: string;
    meal_id: string;
    item_type: MealItemType;
    recipe_id: string | null;
    food_id: string | null;
    quantity: number | null;
    unit: string | null;
    notes: string | null;
    position: number;
    created_at: string;
}

export interface CoachMealPlan {
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

export interface CoachMealPlanDay {
    id: string;
    meal_plan_id: string;
    day_number: number;
    label: string | null;
    notes: string | null;
    created_at: string;
}

export interface CoachMealPlanDayMeal {
    id: string;
    meal_plan_day_id: string;
    meal_id: string;
    meal_number: number;
    variant_label: string | null;
    planned_time: string | null;
    notes: string | null;
    created_at: string;
}

export interface CoachWorkoutMealPlanLink {
    plan_id: string;
    meal_plan_id: string;
}

// ===========================
// Extended Types with Relations
// ===========================

export interface CoachRecipeIngredientWithFood extends CoachRecipeIngredient {
    food?: CoachFood;
}

export interface CoachRecipeFull extends CoachRecipe {
    ingredients?: CoachRecipeIngredientWithFood[];
}

export interface CoachMealItemWithDetails extends CoachMealItem {
    recipe?: CoachRecipeFull;
    food?: CoachFood;
}

export interface CoachMealFull extends CoachMeal {
    items?: CoachMealItemWithDetails[];
}

export interface CoachMealPlanDayMealWithMeal extends CoachMealPlanDayMeal {
    meal?: CoachMealFull;
}

export interface CoachMealPlanDayFull extends CoachMealPlanDay {
    meals?: CoachMealPlanDayMealWithMeal[];
}

export interface CoachMealPlanFull extends CoachMealPlan {
    days?: CoachMealPlanDayFull[];
}

export interface CoachWorkoutMealPlanLinkWithDetails
    extends CoachWorkoutMealPlanLink {
    meal_plan?: CoachMealPlanFull;
    workout_plan?: import("./CoachWorkout").CoachWorkoutPlan;
}

// ===========================
// API Response Types
// ===========================

export interface CoachMealDataResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface CoachMealLoadingState {
    isLoading: boolean;
    error: string | null;
}


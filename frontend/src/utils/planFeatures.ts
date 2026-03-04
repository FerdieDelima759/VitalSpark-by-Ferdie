import { PlanFeatures } from "../types/Plan";

/**
 * Helper function to capitalize first letter (sentence case)
 */
function toSentenceCase(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Converts JSONB plan features into human-readable feature list
 */
export function formatPlanFeatures(features: PlanFeatures): string[] {
  const featureList: string[] = [];

  // If legacy features_list exists, use it (with sentence case)
  if (features.features_list && features.features_list.length > 0) {
    return features.features_list.map(toSentenceCase);
  }

  // AI Features
  if (features.ai) {
    if (features.ai.recommendations) {
      featureList.push("AI-powered workout recommendations");
    }
    if (features.ai.coach_chat_messages_per_day) {
      const messages = features.ai.coach_chat_messages_per_day;
      if (messages === -1 || messages === 999999) {
        featureList.push("Unlimited AI coach chat messages");
      } else {
        featureList.push(`${messages} AI coach messages per day`);
      }
    }
  }

  // Modules
  if (features.modules) {
    if (features.modules.ai_coach) {
      featureList.push("AI coach assistant");
    }
    if (features.modules.training) {
      featureList.push("Advanced training programs");
    }
    if (features.modules.analytics) {
      if (typeof features.modules.analytics === "string") {
        const analyticsType = features.modules.analytics.toLowerCase();
        featureList.push(`${toSentenceCase(analyticsType)} analytics`);
      } else {
        featureList.push("Progress analytics & insights");
      }
    }
    if (features.modules.community) {
      featureList.push("Community access");
    }
    if (features.modules.nutrition) {
      featureList.push("Nutrition tracking & meal plans");
    }
  }

  // Limits
  if (features.limits) {
    if (features.limits.saved_plans) {
      const plans = features.limits.saved_plans;
      if (plans === -1 || plans === 999999) {
        featureList.push("Unlimited saved workout plans");
      } else {
        featureList.push(`${plans} saved workout ${plans === 1 ? "plan" : "plans"}`);
      }
    }
    if (features.limits.workouts_per_day) {
      const workouts = features.limits.workouts_per_day;
      if (workouts === -1 || workouts === 999999) {
        featureList.push("Unlimited workouts per day");
      } else {
        featureList.push(`${workouts} workout${workouts === 1 ? "" : "s"} per day`);
      }
    }
    if (features.limits.nutrition_logs_per_day) {
      const logs = features.limits.nutrition_logs_per_day;
      if (logs === -1 || logs === 999999) {
        featureList.push("Unlimited nutrition logs");
      } else {
        featureList.push(`${logs} nutrition log${logs === 1 ? "" : "s"} per day`);
      }
    }
  }

  return featureList;
}

/**
 * Get a short summary of key features for a plan
 */
export function getKeyFeatures(features: PlanFeatures): string[] {
  const allFeatures = formatPlanFeatures(features);
  // Return first 5 most important features
  return allFeatures.slice(0, 5);
}

/**
 * Check if a plan has a specific module enabled
 */
export function hasModule(
  features: PlanFeatures,
  module: "ai_coach" | "training" | "analytics" | "community" | "nutrition"
): boolean {
  return features.modules?.[module] === true;
}

/**
 * Get the limit value for a specific feature
 */
export function getLimit(
  features: PlanFeatures,
  limitType: "saved_plans" | "workouts_per_day" | "nutrition_logs_per_day"
): number {
  return features.limits?.[limitType] || 0;
}

/**
 * Check if a limit is unlimited
 */
export function isUnlimited(value: number): boolean {
  return value === -1 || value >= 999999;
}


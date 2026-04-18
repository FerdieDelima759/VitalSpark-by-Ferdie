"use client";

import { supabase } from "@/lib/api/supabase";

export interface SavedPersonalizedWorkoutPlanResult {
  success: boolean;
  hasSavedPlan: boolean;
  planId?: string;
  error?: string;
}

export const getSavedPersonalizedWorkoutPlan = async (
  userId: string,
): Promise<SavedPersonalizedWorkoutPlanResult> => {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    return {
      success: false,
      hasSavedPlan: false,
      error: "User ID is required",
    };
  }

  try {
    const { data: plans, error: plansError } = await supabase
      .from("user_workout_plans")
      .select("id")
      .eq("user_id", normalizedUserId)
      .order("created_at", { ascending: false });

    if (plansError) {
      return {
        success: false,
        hasSavedPlan: false,
        error: plansError.message,
      };
    }

    const planIds = plans?.map((plan) => plan.id).filter(Boolean) || [];
    if (planIds.length === 0) {
      return { success: true, hasSavedPlan: false };
    }

    const { data: weekPlans, error: weekPlansError } = await supabase
      .from("user_workout_weekly_plan")
      .select("id, plan_id")
      .in("plan_id", planIds);

    if (weekPlansError) {
      return {
        success: false,
        hasSavedPlan: false,
        error: weekPlansError.message,
      };
    }

    const weekPlanIds =
      weekPlans?.map((weekPlan) => weekPlan.id).filter(Boolean) || [];
    if (weekPlanIds.length === 0) {
      return { success: true, hasSavedPlan: false };
    }

    const weekPlanToPlanId = new Map(
      (weekPlans || []).map((weekPlan) => [weekPlan.id, weekPlan.plan_id]),
    );

    const { data: dayPlans, error: dayPlansError } = await supabase
      .from("user_workout_weekly_day_plan")
      .select("week_plan_id")
      .in("week_plan_id", weekPlanIds)
      .limit(1);

    if (dayPlansError) {
      return {
        success: false,
        hasSavedPlan: false,
        error: dayPlansError.message,
      };
    }

    const validWeekPlanId = dayPlans?.[0]?.week_plan_id;
    const validPlanId = validWeekPlanId
      ? weekPlanToPlanId.get(validWeekPlanId)
      : null;

    if (!validPlanId) {
      return { success: true, hasSavedPlan: false };
    }

    return {
      success: true,
      hasSavedPlan: true,
      planId: validPlanId,
    };
  } catch (error: unknown) {
    return {
      success: false,
      hasSavedPlan: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to verify saved workout plan.",
    };
  }
};

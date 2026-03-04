import { useState, useCallback } from "react";
import { supabase } from "../lib/api/supabase";
import {
  GeneralMealPlan,
  GeneralMealPlanDay,
  GeneralMealPlanDayMeal,
  GeneralMealPlanDayFull,
  GeneralMealPlanFull,
  GeneralMealPlanDataResponse,
} from "../types/GeneralMealPlan";
import { CoachMealFull } from "../types/CoachMeal";
import { useCoachMealData } from "./useCoachMealData";

// ===========================
// Hook Interface
// ===========================

interface UseGeneralMealPlanDataReturn {
  // Meal Plans
  fetchMealPlans: () => Promise<GeneralMealPlanDataResponse<GeneralMealPlan[]>>;
  fetchMealPlanById: (
    mealPlanId: string
  ) => Promise<GeneralMealPlanDataResponse<GeneralMealPlan>>;
  fetchMealPlansByCreator: (
    createdBy: string
  ) => Promise<GeneralMealPlanDataResponse<GeneralMealPlan[]>>;
  fetchMealPlansByPublic: (
    isPublic: boolean
  ) => Promise<GeneralMealPlanDataResponse<GeneralMealPlan[]>>;
  fetchMealPlanFull: (
    mealPlanId: string
  ) => Promise<GeneralMealPlanDataResponse<GeneralMealPlanFull>>;
  createMealPlan: (
    planData: {
      name: string;
      description?: string | null;
      goal?: string | null;
      duration_days?: number;
      estimated_daily_calories?: number | null;
      is_public?: boolean;
      created_by?: string | null;
    }
  ) => Promise<GeneralMealPlanDataResponse<GeneralMealPlan>>;
  updateMealPlan: (
    mealPlanId: string,
    planData: {
      name?: string;
      description?: string | null;
      goal?: string | null;
      duration_days?: number;
      estimated_daily_calories?: number | null;
      is_public?: boolean;
    }
  ) => Promise<GeneralMealPlanDataResponse<GeneralMealPlan>>;
  deleteMealPlan: (
    mealPlanId: string
  ) => Promise<GeneralMealPlanDataResponse<boolean>>;
  fetchDaysForMealPlan: (
    mealPlanId: string
  ) => Promise<GeneralMealPlanDataResponse<GeneralMealPlanDay[]>>;
  fetchDayById: (
    dayId: string
  ) => Promise<GeneralMealPlanDataResponse<GeneralMealPlanDay>>;
  fetchDayFull: (
    dayId: string
  ) => Promise<GeneralMealPlanDataResponse<GeneralMealPlanDayFull>>;
  createDay: (
    mealPlanId: string,
    dayData: {
      day_number: number;
      label?: string | null;
      notes?: string | null;
    }
  ) => Promise<GeneralMealPlanDataResponse<GeneralMealPlanDay>>;
  updateDay: (
    dayId: string,
    dayData: {
      day_number?: number;
      label?: string | null;
      notes?: string | null;
    }
  ) => Promise<GeneralMealPlanDataResponse<GeneralMealPlanDay>>;
  deleteDay: (
    dayId: string
  ) => Promise<GeneralMealPlanDataResponse<boolean>>;
  fetchMealsForDay: (
    dayId: string
  ) => Promise<GeneralMealPlanDataResponse<GeneralMealPlanDayMeal[]>>;
  createDayMeal: (
    dayId: string,
    mealData: {
      meal_id: string;
      meal_number: number;
      typical_time_of_the_day?: string | null;
      variant_label?: string | null;
      planned_time?: string | null;
      notes?: string | null;
    }
  ) => Promise<GeneralMealPlanDataResponse<GeneralMealPlanDayMeal>>;
  updateDayMeal: (
    dayMealId: string,
    mealData: {
      meal_id?: string;
      meal_number?: number;
      typical_time_of_the_day?: string | null;
      variant_label?: string | null;
      planned_time?: string | null;
      notes?: string | null;
    }
  ) => Promise<GeneralMealPlanDataResponse<GeneralMealPlanDayMeal>>;
  deleteDayMeal: (
    dayMealId: string
  ) => Promise<GeneralMealPlanDataResponse<boolean>>;

  // State
  isLoading: boolean;
  error: string | null;
}

// ===========================
// Custom Hook
// ===========================

export function useGeneralMealPlanData(): UseGeneralMealPlanDataReturn {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { fetchMealFull } = useCoachMealData();

  const handleError = useCallback((error: any): string => {
    console.error("General meal plan data error:", error);

    // Handle Supabase PostgREST errors
    if (error?.message) {
      return error.message;
    }

    // Handle Supabase error details
    if (error?.details) {
      return error.details;
    }

    // Handle error hints
    if (error?.hint) {
      return error.hint;
    }

    // Handle error code with custom messages
    if (error?.code) {
      if (error.code === "23505") {
        return "This record already exists.";
      }
      if (error.code === "23503") {
        return "Referenced record does not exist.";
      }
      if (error.code === "23502") {
        return "Required field is missing.";
      }
    }

    // Fallback
    if (typeof error === "string") {
      return error;
    }

    return "An unexpected error occurred";
  }, []);

  // ===========================
  // Meal Plans
  // ===========================

  const fetchMealPlans = useCallback(async (): Promise<
    GeneralMealPlanDataResponse<GeneralMealPlan[]>
  > => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("general_meal_plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        const errorMsg = handleError(fetchError);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      return { success: true, data: data || [] };
    } catch (err: any) {
      const errorMsg = handleError(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const fetchMealPlanById = useCallback(
    async (
      mealPlanId: string
    ): Promise<GeneralMealPlanDataResponse<GeneralMealPlan>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!mealPlanId.trim()) {
          return { success: false, error: "Meal Plan ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("general_meal_plans")
          .select("*")
          .eq("id", mealPlanId)
          .single();

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as GeneralMealPlan };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchMealPlansByCreator = useCallback(
    async (
      createdBy: string
    ): Promise<GeneralMealPlanDataResponse<GeneralMealPlan[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!createdBy.trim()) {
          return { success: false, error: "Creator ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("general_meal_plans")
          .select("*")
          .eq("created_by", createdBy)
          .order("created_at", { ascending: false });

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchMealPlansByPublic = useCallback(
    async (
      isPublic: boolean
    ): Promise<GeneralMealPlanDataResponse<GeneralMealPlan[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("general_meal_plans")
          .select("*")
          .eq("is_public", isPublic)
          .order("created_at", { ascending: false });

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchDaysForMealPlan = useCallback(
    async (
      mealPlanId: string
    ): Promise<GeneralMealPlanDataResponse<GeneralMealPlanDay[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!mealPlanId.trim()) {
          return { success: false, error: "Meal Plan ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("general_meal_plan_days")
          .select("*")
          .eq("meal_plan_id", mealPlanId)
          .order("day_number", { ascending: true });

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchDayById = useCallback(
    async (
      dayId: string
    ): Promise<GeneralMealPlanDataResponse<GeneralMealPlanDay>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!dayId.trim()) {
          return { success: false, error: "Day ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("general_meal_plan_days")
          .select("*")
          .eq("id", dayId)
          .single();

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as GeneralMealPlanDay };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchMealsForDay = useCallback(
    async (
      dayId: string
    ): Promise<GeneralMealPlanDataResponse<GeneralMealPlanDayMeal[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!dayId.trim()) {
          return { success: false, error: "Day ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("general_meal_plan_day_meals")
          .select("*")
          .eq("meal_plan_day_id", dayId)
          .order("meal_number", { ascending: true });

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchDayFull = useCallback(
    async (
      dayId: string
    ): Promise<GeneralMealPlanDataResponse<GeneralMealPlanDayFull>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!dayId.trim()) {
          return { success: false, error: "Day ID is required" };
        }

        // Fetch day
        const dayResult = await fetchDayById(dayId);
        if (!dayResult.success || !dayResult.data) {
          return {
            success: false,
            error: dayResult.error || "Failed to fetch day",
          };
        }

        // Fetch meals for this day
        const mealsResult = await fetchMealsForDay(dayId);
        if (!mealsResult.success) {
          return {
            success: false,
            error: mealsResult.error || "Failed to fetch day meals",
          };
        }

        // Fetch full meal details for each day meal
        const mealsWithDetails = await Promise.all(
          (mealsResult.data || []).map(async (dayMeal) => {
            const mealFullResult = await fetchMealFull(dayMeal.meal_id);
            return {
              ...dayMeal,
              meal: mealFullResult.success ? mealFullResult.data : undefined,
            };
          })
        );

        return {
          success: true,
          data: {
            ...dayResult.data,
            meals: mealsWithDetails,
          },
        };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError, fetchDayById, fetchMealsForDay, fetchMealFull]
  );

  const fetchMealPlanFull = useCallback(
    async (
      mealPlanId: string
    ): Promise<GeneralMealPlanDataResponse<GeneralMealPlanFull>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!mealPlanId.trim()) {
          return { success: false, error: "Meal Plan ID is required" };
        }

        // Fetch plan
        const planResult = await fetchMealPlanById(mealPlanId);
        if (!planResult.success || !planResult.data) {
          return {
            success: false,
            error: planResult.error || "Failed to fetch meal plan",
          };
        }

        // Fetch days for this plan
        const daysResult = await fetchDaysForMealPlan(mealPlanId);
        if (!daysResult.success) {
          return {
            success: false,
            error: daysResult.error || "Failed to fetch meal plan days",
          };
        }

        // Fetch full details for each day
        const daysFull = await Promise.all(
          (daysResult.data || []).map(async (day) => {
            const dayFullResult = await fetchDayFull(day.id);
            return dayFullResult.success ? dayFullResult.data : day;
          })
        );

        return {
          success: true,
          data: {
            ...planResult.data,
            days: daysFull as GeneralMealPlanDayFull[],
          },
        };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [
      handleError,
      fetchMealPlanById,
      fetchDaysForMealPlan,
      fetchDayFull,
    ]
  );

  const createMealPlan = useCallback(
    async (
      planData: {
        name: string;
        description?: string | null;
        goal?: string | null;
        duration_days?: number;
        estimated_daily_calories?: number | null;
        is_public?: boolean;
        created_by?: string | null;
      }
    ): Promise<GeneralMealPlanDataResponse<GeneralMealPlan>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planData.name.trim()) {
          return { success: false, error: "Meal plan name is required" };
        }

        const insertPayload: any = {
          name: planData.name.trim(),
          description: planData.description?.trim() || null,
          goal: planData.goal?.trim() || null,
          duration_days: planData.duration_days ?? 1,
          is_public: planData.is_public ?? true,
        };

        // Handle estimated_daily_calories - allow 0 as a valid value
        if (planData.estimated_daily_calories !== undefined && planData.estimated_daily_calories !== null) {
          insertPayload.estimated_daily_calories = planData.estimated_daily_calories;
        } else {
          insertPayload.estimated_daily_calories = null;
        }

        // Handle created_by
        if (planData.created_by) {
          insertPayload.created_by = planData.created_by;
        } else {
          insertPayload.created_by = null;
        }

        const { data, error: insertError } = await supabase
          .from("general_meal_plans")
          .insert(insertPayload)
          .select()
          .single();

        if (insertError) {
          const errorMsg = handleError(insertError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as GeneralMealPlan };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const updateMealPlan = useCallback(
    async (
      mealPlanId: string,
      planData: {
        name?: string;
        description?: string | null;
        goal?: string | null;
        duration_days?: number;
        estimated_daily_calories?: number | null;
        is_public?: boolean;
      }
    ): Promise<GeneralMealPlanDataResponse<GeneralMealPlan>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!mealPlanId.trim()) {
          return { success: false, error: "Meal Plan ID is required" };
        }

        const updatePayload: any = {};
        if (planData.name !== undefined) updatePayload.name = planData.name;
        if (planData.description !== undefined)
          updatePayload.description = planData.description;
        if (planData.goal !== undefined) updatePayload.goal = planData.goal;
        if (planData.duration_days !== undefined)
          updatePayload.duration_days = planData.duration_days;
        if (planData.estimated_daily_calories !== undefined)
          updatePayload.estimated_daily_calories =
            planData.estimated_daily_calories;
        if (planData.is_public !== undefined)
          updatePayload.is_public = planData.is_public;

        updatePayload.updated_at = new Date().toISOString();

        const { data, error: updateError } = await supabase
          .from("general_meal_plans")
          .update(updatePayload)
          .eq("id", mealPlanId)
          .select()
          .single();

        if (updateError) {
          const errorMsg = handleError(updateError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as GeneralMealPlan };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const deleteMealPlan = useCallback(
    async (
      mealPlanId: string
    ): Promise<GeneralMealPlanDataResponse<boolean>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!mealPlanId.trim()) {
          return { success: false, error: "Meal Plan ID is required" };
        }

        const { error: deleteError } = await supabase
          .from("general_meal_plans")
          .delete()
          .eq("id", mealPlanId);

        if (deleteError) {
          const errorMsg = handleError(deleteError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: true };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const createDay = useCallback(
    async (
      mealPlanId: string,
      dayData: {
        day_number: number;
        label?: string | null;
        notes?: string | null;
      }
    ): Promise<GeneralMealPlanDataResponse<GeneralMealPlanDay>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!mealPlanId.trim()) {
          return { success: false, error: "Meal Plan ID is required" };
        }

        const { data, error: insertError } = await supabase
          .from("general_meal_plan_days")
          .insert({
            meal_plan_id: mealPlanId,
            day_number: dayData.day_number,
            label: dayData.label || null,
            notes: dayData.notes || null,
          })
          .select()
          .single();

        if (insertError) {
          const errorMsg = handleError(insertError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as GeneralMealPlanDay };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const updateDay = useCallback(
    async (
      dayId: string,
      dayData: {
        day_number?: number;
        label?: string | null;
        notes?: string | null;
      }
    ): Promise<GeneralMealPlanDataResponse<GeneralMealPlanDay>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!dayId.trim()) {
          return { success: false, error: "Day ID is required" };
        }

        const updatePayload: any = {};
        if (dayData.day_number !== undefined)
          updatePayload.day_number = dayData.day_number;
        if (dayData.label !== undefined) updatePayload.label = dayData.label;
        if (dayData.notes !== undefined) updatePayload.notes = dayData.notes;

        const { data, error: updateError } = await supabase
          .from("general_meal_plan_days")
          .update(updatePayload)
          .eq("id", dayId)
          .select()
          .single();

        if (updateError) {
          const errorMsg = handleError(updateError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as GeneralMealPlanDay };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const deleteDay = useCallback(
    async (dayId: string): Promise<GeneralMealPlanDataResponse<boolean>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!dayId.trim()) {
          return { success: false, error: "Day ID is required" };
        }

        const { error: deleteError } = await supabase
          .from("general_meal_plan_days")
          .delete()
          .eq("id", dayId);

        if (deleteError) {
          const errorMsg = handleError(deleteError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: true };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const createDayMeal = useCallback(
    async (
      dayId: string,
      mealData: {
        meal_id: string;
        meal_number: number;
        typical_time_of_the_day?: string | null;
        variant_label?: string | null;
        planned_time?: string | null;
        notes?: string | null;
      }
    ): Promise<GeneralMealPlanDataResponse<GeneralMealPlanDayMeal>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!dayId.trim()) {
          return { success: false, error: "Day ID is required" };
        }

        if (!mealData.meal_id.trim()) {
          return { success: false, error: "Meal ID is required" };
        }

        const { data, error: insertError } = await supabase
          .from("general_meal_plan_day_meals")
          .insert({
            meal_plan_day_id: dayId,
            meal_id: mealData.meal_id,
            meal_number: mealData.meal_number,
            typical_time_of_the_day: mealData.typical_time_of_the_day || null,
            variant_label: mealData.variant_label || null,
            planned_time: mealData.planned_time || null,
            notes: mealData.notes || null,
          })
          .select()
          .single();

        if (insertError) {
          const errorMsg = handleError(insertError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as GeneralMealPlanDayMeal };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const updateDayMeal = useCallback(
    async (
      dayMealId: string,
      mealData: {
        meal_id?: string;
        meal_number?: number;
        typical_time_of_the_day?: string | null;
        variant_label?: string | null;
        planned_time?: string | null;
        notes?: string | null;
      }
    ): Promise<GeneralMealPlanDataResponse<GeneralMealPlanDayMeal>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!dayMealId.trim()) {
          return { success: false, error: "Day Meal ID is required" };
        }

        const updatePayload: any = {};
        if (mealData.meal_id !== undefined)
          updatePayload.meal_id = mealData.meal_id;
        if (mealData.meal_number !== undefined)
          updatePayload.meal_number = mealData.meal_number;
        if (mealData.typical_time_of_the_day !== undefined)
          updatePayload.typical_time_of_the_day = mealData.typical_time_of_the_day;
        if (mealData.variant_label !== undefined)
          updatePayload.variant_label = mealData.variant_label;
        if (mealData.planned_time !== undefined)
          updatePayload.planned_time = mealData.planned_time;
        if (mealData.notes !== undefined) updatePayload.notes = mealData.notes;

        updatePayload.updated_at = new Date().toISOString();

        const { data, error: updateError } = await supabase
          .from("general_meal_plan_day_meals")
          .update(updatePayload)
          .eq("id", dayMealId)
          .select()
          .single();

        if (updateError) {
          const errorMsg = handleError(updateError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as GeneralMealPlanDayMeal };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const deleteDayMeal = useCallback(
    async (
      dayMealId: string
    ): Promise<GeneralMealPlanDataResponse<boolean>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!dayMealId.trim()) {
          return { success: false, error: "Day Meal ID is required" };
        }

        const { error: deleteError } = await supabase
          .from("general_meal_plan_day_meals")
          .delete()
          .eq("id", dayMealId);

        if (deleteError) {
          const errorMsg = handleError(deleteError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: true };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  return {
    // Meal Plans
    fetchMealPlans,
    fetchMealPlanById,
    fetchMealPlansByCreator,
    fetchMealPlansByPublic,
    fetchMealPlanFull,
    createMealPlan,
    updateMealPlan,
    deleteMealPlan,
    fetchDaysForMealPlan,
    fetchDayById,
    fetchDayFull,
    createDay,
    updateDay,
    deleteDay,
    fetchMealsForDay,
    createDayMeal,
    updateDayMeal,
    deleteDayMeal,

    // State
    isLoading,
    error,
  };
}


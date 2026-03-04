import { useState, useCallback } from "react";
import { supabase } from "../lib/api/supabase";
import {
  CoachWorkoutPlan,
  CoachWorkoutPlanTag,
  CoachWorkoutPlanExerciseDetails,
  CoachWorkoutDailyPlan,
  CoachWorkoutDailyPlanExercise,
  CoachWorkoutDailyPlanFull,
  CoachWorkoutPlanFull,
  CoachWorkoutDataResponse,
} from "../types/CoachWorkout";
import { WorkoutTag } from "../types/Workout";

// ===========================
// Hook Interface
// ===========================

interface UseCoachWorkoutDataReturn {
  // Coach Workout Plans
  fetchCoachWorkoutPlans: () => Promise<
    CoachWorkoutDataResponse<CoachWorkoutPlan[]>
  >;
  fetchCoachWorkoutPlanById: (
    planId: string
  ) => Promise<CoachWorkoutDataResponse<CoachWorkoutPlan>>;
  fetchCoachWorkoutPlansByCreator: (
    createdBy: string
  ) => Promise<CoachWorkoutDataResponse<CoachWorkoutPlan[]>>;
  fetchCoachWorkoutPlansByLevel: (
    level: string
  ) => Promise<CoachWorkoutDataResponse<CoachWorkoutPlan[]>>;
  fetchCoachWorkoutPlansByCategory: (
    category: string
  ) => Promise<CoachWorkoutDataResponse<CoachWorkoutPlan[]>>;
  fetchCoachWorkoutPlanFull: (
    planId: string
  ) => Promise<CoachWorkoutDataResponse<CoachWorkoutPlanFull>>;

  // Exercise Details
  fetchCoachExerciseDetails: () => Promise<
    CoachWorkoutDataResponse<CoachWorkoutPlanExerciseDetails[]>
  >;
  fetchCoachExerciseById: (
    exerciseId: string
  ) => Promise<CoachWorkoutDataResponse<CoachWorkoutPlanExerciseDetails>>;
  fetchCoachExercisesBySection: (
    section: string
  ) => Promise<CoachWorkoutDataResponse<CoachWorkoutPlanExerciseDetails[]>>;

  // Daily Plans
  fetchDailyPlansForPlan: (
    planId: string
  ) => Promise<CoachWorkoutDataResponse<CoachWorkoutDailyPlan[]>>;
  fetchDailyPlanById: (
    dailyPlanId: string
  ) => Promise<CoachWorkoutDataResponse<CoachWorkoutDailyPlan>>;
  fetchDailyPlanFull: (
    dailyPlanId: string
  ) => Promise<CoachWorkoutDataResponse<CoachWorkoutDailyPlanFull>>;

  // Daily Plan Exercises
  fetchExercisesForDailyPlan: (
    dailyPlanId: string
  ) => Promise<CoachWorkoutDataResponse<CoachWorkoutDailyPlanExercise[]>>;
  fetchExercisesForDailyPlanWithDetails: (
    dailyPlanId: string
  ) => Promise<
    CoachWorkoutDataResponse<CoachWorkoutDailyPlanExercise[]>
  >;

  // Tags
  fetchWorkoutTags: () => Promise<CoachWorkoutDataResponse<WorkoutTag[]>>;
  fetchTagsForPlan: (
    planId: string
  ) => Promise<CoachWorkoutDataResponse<WorkoutTag[]>>;
  addTagToPlan: (
    planId: string,
    tagId: string
  ) => Promise<CoachWorkoutDataResponse<boolean>>;
  removeTagFromPlan: (
    planId: string,
    tagId: string
  ) => Promise<CoachWorkoutDataResponse<boolean>>;
  setPlanTags: (
    planId: string,
    tagIds: string[]
  ) => Promise<CoachWorkoutDataResponse<boolean>>;

  // State
  isLoading: boolean;
  error: string | null;
}

// ===========================
// Custom Hook
// ===========================

export function useCoachWorkoutData(): UseCoachWorkoutDataReturn {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((error: any): string => {
    console.error("Coach workout data error:", error);
    return error?.message || "An unexpected error occurred";
  }, []);

  // ===========================
  // Coach Workout Plans
  // ===========================

  const fetchCoachWorkoutPlans = useCallback(async (): Promise<
    CoachWorkoutDataResponse<CoachWorkoutPlan[]>
  > => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("coach_workout_plans")
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

  const fetchCoachWorkoutPlanById = useCallback(
    async (
      planId: string
    ): Promise<CoachWorkoutDataResponse<CoachWorkoutPlan>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim()) {
          return { success: false, error: "Plan ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_workout_plans")
          .select("*")
          .eq("id", planId)
          .single();

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as CoachWorkoutPlan };
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

  const fetchCoachWorkoutPlansByCreator = useCallback(
    async (
      createdBy: string
    ): Promise<CoachWorkoutDataResponse<CoachWorkoutPlan[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!createdBy.trim()) {
          return { success: false, error: "Creator ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_workout_plans")
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

  const fetchCoachWorkoutPlansByLevel = useCallback(
    async (
      level: string
    ): Promise<CoachWorkoutDataResponse<CoachWorkoutPlan[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!level.trim()) {
          return { success: false, error: "Level is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_workout_plans")
          .select("*")
          .eq("level", level.toLowerCase())
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

  const fetchCoachWorkoutPlansByCategory = useCallback(
    async (
      category: string
    ): Promise<CoachWorkoutDataResponse<CoachWorkoutPlan[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!category.trim()) {
          return { success: false, error: "Category is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_workout_plans")
          .select("*")
          .eq("category", category)
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

  const fetchExercisesForDailyPlanWithDetails = useCallback(
    async (
      dailyPlanId: string
    ): Promise<CoachWorkoutDataResponse<CoachWorkoutDailyPlanExercise[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!dailyPlanId.trim()) {
          return { success: false, error: "Daily Plan ID is required" };
        }

        // Fetch exercises
        const { data: exercises, error: exercisesError } = await supabase
          .from("coach_workout_daily_plan_exercises")
          .select("*")
          .eq("daily_plan_id", dailyPlanId)
          .order("position", { ascending: true });

        if (exercisesError) {
          const errorMsg = handleError(exercisesError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        const exerciseIds = exercises?.map((ex) => ex.exercise_id) || [];

        if (exerciseIds.length === 0) {
          return { success: true, data: [] };
        }

        // Fetch exercise details
        const { data: details, error: detailsError } = await supabase
          .from("coach_workout_plan_exercises_details")
          .select("*")
          .in("id", exerciseIds);

        if (detailsError) {
          console.error("Error fetching exercise details:", detailsError);
        }

        // Create a map of details
        const detailsMap = new Map<string, CoachWorkoutPlanExerciseDetails>();
        details?.forEach((detail) => {
          detailsMap.set(detail.id, detail);
        });

        // Combine exercises with details
        const exercisesWithDetails = exercises?.map((exercise) => ({
          ...exercise,
          exercise_details: detailsMap.get(exercise.exercise_id),
        }));

        return { success: true, data: exercisesWithDetails || [] };
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

  // ===========================
  // Exercise Details
  // ===========================

  const fetchCoachExerciseDetails = useCallback(async (): Promise<
    CoachWorkoutDataResponse<CoachWorkoutPlanExerciseDetails[]>
  > => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("coach_workout_plan_exercises_details")
        .select("*")
        .order("name", { ascending: true });

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

  const fetchCoachExerciseById = useCallback(
    async (
      exerciseId: string
    ): Promise<CoachWorkoutDataResponse<CoachWorkoutPlanExerciseDetails>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!exerciseId.trim()) {
          return { success: false, error: "Exercise ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_workout_plan_exercises_details")
          .select("*")
          .eq("id", exerciseId)
          .single();

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return {
          success: true,
          data: data as CoachWorkoutPlanExerciseDetails,
        };
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

  const fetchCoachExercisesBySection = useCallback(
    async (
      section: string
    ): Promise<CoachWorkoutDataResponse<CoachWorkoutPlanExerciseDetails[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!section.trim()) {
          return { success: false, error: "Section is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_workout_plan_exercises_details")
          .select("*")
          .eq("section", section)
          .order("name", { ascending: true });

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

  // ===========================
  // Daily Plans
  // ===========================

  const fetchDailyPlansForPlan = useCallback(
    async (
      planId: string
    ): Promise<CoachWorkoutDataResponse<CoachWorkoutDailyPlan[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim()) {
          return { success: false, error: "Plan ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_workout_daily_plan")
          .select("*")
          .eq("plan_id", planId)
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

  const fetchDailyPlanById = useCallback(
    async (
      dailyPlanId: string
    ): Promise<CoachWorkoutDataResponse<CoachWorkoutDailyPlan>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!dailyPlanId.trim()) {
          return { success: false, error: "Daily Plan ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_workout_daily_plan")
          .select("*")
          .eq("id", dailyPlanId)
          .single();

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as CoachWorkoutDailyPlan };
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

  const fetchDailyPlanFull = useCallback(
    async (
      dailyPlanId: string
    ): Promise<CoachWorkoutDataResponse<CoachWorkoutDailyPlanFull>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!dailyPlanId.trim()) {
          return { success: false, error: "Daily Plan ID is required" };
        }

        // Fetch daily plan
        const dailyPlanResult = await fetchDailyPlanById(dailyPlanId);
        if (!dailyPlanResult.success || !dailyPlanResult.data) {
          return {
            success: false,
            error: dailyPlanResult.error || "Failed to fetch daily plan",
          };
        }

        // Fetch exercises for this daily plan
        const exercisesResult = await fetchExercisesForDailyPlanWithDetails(
          dailyPlanId
        );
        if (!exercisesResult.success) {
          return {
            success: false,
            error: exercisesResult.error || "Failed to fetch exercises",
          };
        }

        return {
          success: true,
          data: {
            ...dailyPlanResult.data,
            exercises: exercisesResult.data || [],
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
    [handleError, fetchDailyPlanById, fetchExercisesForDailyPlanWithDetails]
  );

  // ===========================
  // Daily Plan Exercises
  // ===========================

  const fetchExercisesForDailyPlan = useCallback(
    async (
      dailyPlanId: string
    ): Promise<CoachWorkoutDataResponse<CoachWorkoutDailyPlanExercise[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!dailyPlanId.trim()) {
          return { success: false, error: "Daily Plan ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("coach_workout_daily_plan_exercises")
          .select("*")
          .eq("daily_plan_id", dailyPlanId)
          .order("position", { ascending: true });

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

  // ===========================
  // Tags
  // ===========================

  const fetchWorkoutTags = useCallback(async (): Promise<
    CoachWorkoutDataResponse<WorkoutTag[]>
  > => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("workout_tags")
        .select("*")
        .order("name", { ascending: true });

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

  const fetchTagsForPlan = useCallback(
    async (
      planId: string
    ): Promise<CoachWorkoutDataResponse<WorkoutTag[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim()) {
          return { success: false, error: "Plan ID is required" };
        }

        // Fetch plan tags
        const { data: planTagsData, error: planTagsError } = await supabase
          .from("coach_workout_plan_tags")
          .select("tag_id")
          .eq("plan_id", planId);

        if (planTagsError) {
          const errorMsg = handleError(planTagsError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        const tagIds = planTagsData?.map((pt) => pt.tag_id) || [];

        if (tagIds.length === 0) {
          return { success: true, data: [] };
        }

        // Fetch tag details
        const { data: tagsData, error: tagsError } = await supabase
          .from("workout_tags")
          .select("*")
          .in("id", tagIds)
          .order("name", { ascending: true });

        if (tagsError) {
          const errorMsg = handleError(tagsError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: tagsData || [] };
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

  const addTagToPlan = useCallback(
    async (
      planId: string,
      tagId: string
    ): Promise<CoachWorkoutDataResponse<boolean>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim() || !tagId.trim()) {
          return {
            success: false,
            error: "Plan ID and Tag ID are required",
          };
        }

        const { error: insertError } = await supabase
          .from("coach_workout_plan_tags")
          .insert({ plan_id: planId, tag_id: tagId });

        if (insertError) {
          const errorMsg = handleError(insertError);
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

  const removeTagFromPlan = useCallback(
    async (
      planId: string,
      tagId: string
    ): Promise<CoachWorkoutDataResponse<boolean>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim() || !tagId.trim()) {
          return {
            success: false,
            error: "Plan ID and Tag ID are required",
          };
        }

        const { error: deleteError } = await supabase
          .from("coach_workout_plan_tags")
          .delete()
          .eq("plan_id", planId)
          .eq("tag_id", tagId);

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

  const setPlanTags = useCallback(
    async (
      planId: string,
      tagIds: string[]
    ): Promise<CoachWorkoutDataResponse<boolean>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim()) {
          return { success: false, error: "Plan ID is required" };
        }

        // Delete existing tags
        const { error: deleteError } = await supabase
          .from("coach_workout_plan_tags")
          .delete()
          .eq("plan_id", planId);

        if (deleteError) {
          const errorMsg = handleError(deleteError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        // Insert new tags
        if (tagIds.length > 0) {
          const tagInserts = tagIds.map((tagId) => ({
            plan_id: planId,
            tag_id: tagId,
          }));

          const { error: insertError } = await supabase
            .from("coach_workout_plan_tags")
            .insert(tagInserts);

          if (insertError) {
            const errorMsg = handleError(insertError);
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }
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

  const fetchCoachWorkoutPlanFull = useCallback(
    async (
      planId: string
    ): Promise<CoachWorkoutDataResponse<CoachWorkoutPlanFull>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim()) {
          return { success: false, error: "Plan ID is required" };
        }

        // Fetch plan
        const planResult = await fetchCoachWorkoutPlanById(planId);
        if (!planResult.success || !planResult.data) {
          return {
            success: false,
            error: planResult.error || "Failed to fetch plan",
          };
        }

        // Fetch daily plans for this plan
        const dailyPlansResult = await fetchDailyPlansForPlan(planId);
        if (!dailyPlansResult.success) {
          return {
            success: false,
            error: dailyPlansResult.error || "Failed to fetch daily plans",
          };
        }

        // Fetch full details for each daily plan
        const dailyPlansFull = await Promise.all(
          (dailyPlansResult.data || []).map(async (dailyPlan) => {
            const dailyPlanFullResult = await fetchDailyPlanFull(dailyPlan.id);
            return dailyPlanFullResult.data || dailyPlan;
          })
        );

        // Fetch tags for this plan
        const tagsResult = await fetchTagsForPlan(planId);
        const tags = tagsResult.success ? tagsResult.data || [] : [];

        return {
          success: true,
          data: {
            ...planResult.data,
            tags,
            daily_plans: dailyPlansFull as CoachWorkoutDailyPlanFull[],
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
      fetchCoachWorkoutPlanById,
      fetchDailyPlansForPlan,
      fetchDailyPlanFull,
      fetchTagsForPlan,
    ]
  );

  return {
    // Coach Workout Plans
    fetchCoachWorkoutPlans,
    fetchCoachWorkoutPlanById,
    fetchCoachWorkoutPlansByCreator,
    fetchCoachWorkoutPlansByLevel,
    fetchCoachWorkoutPlansByCategory,
    fetchCoachWorkoutPlanFull,

    // Exercise Details
    fetchCoachExerciseDetails,
    fetchCoachExerciseById,
    fetchCoachExercisesBySection,

    // Daily Plans
    fetchDailyPlansForPlan,
    fetchDailyPlanById,
    fetchDailyPlanFull,

    // Daily Plan Exercises
    fetchExercisesForDailyPlan,
    fetchExercisesForDailyPlanWithDetails,

    // Tags
    fetchWorkoutTags,
    fetchTagsForPlan,
    addTagToPlan,
    removeTagFromPlan,
    setPlanTags,

    // State
    isLoading,
    error,
  };
}


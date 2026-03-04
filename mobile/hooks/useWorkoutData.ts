import { useState, useCallback } from "react";
import { supabase } from "../utils/supabase";
import {
  WorkoutTag,
  WorkoutPlan,
  WorkoutPlanExercise,
  WorkoutPlanExerciseDetails,
  WorkoutPlanWithTags,
  WorkoutPlanFull,
  WorkoutDataResponse,
} from "../types/Workout";

// ===========================
// Hook Interface
// ===========================

interface UseWorkoutDataReturn {
  // Workout Plans
  fetchWorkoutPlans: () => Promise<WorkoutDataResponse<WorkoutPlan[]>>;
  fetchWorkoutPlanById: (planId: string) => Promise<WorkoutDataResponse<WorkoutPlan>>;
  fetchWorkoutPlanWithTags: (planId: string) => Promise<WorkoutDataResponse<WorkoutPlanWithTags>>;
  fetchWorkoutPlanFull: (planId: string) => Promise<WorkoutDataResponse<WorkoutPlanFull>>;
  fetchWorkoutPlansByLevel: (level: string) => Promise<WorkoutDataResponse<WorkoutPlan[]>>;
  fetchWorkoutPlansByCategory: (category: string) => Promise<WorkoutDataResponse<WorkoutPlan[]>>;
  fetchFreeWorkoutPlans: () => Promise<WorkoutDataResponse<WorkoutPlan[]>>;

  // Workout Tags
  fetchWorkoutTags: () => Promise<WorkoutDataResponse<WorkoutTag[]>>;
  fetchTagsForPlan: (planId: string) => Promise<WorkoutDataResponse<WorkoutTag[]>>;

  // Exercises
  fetchExerciseDetails: () => Promise<WorkoutDataResponse<WorkoutPlanExerciseDetails[]>>;
  fetchExerciseById: (exerciseId: string) => Promise<WorkoutDataResponse<WorkoutPlanExerciseDetails>>;
  fetchExercisesForPlan: (planId: string) => Promise<WorkoutDataResponse<WorkoutPlanExercise[]>>;
  fetchExercisesForPlanWithDetails: (planId: string) => Promise<WorkoutDataResponse<WorkoutPlanExercise[]>>;

  // State
  isLoading: boolean;
  error: string | null;
}

// ===========================
// Custom Hook
// ===========================

export function useWorkoutData(): UseWorkoutDataReturn {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((error: any): string => {
    console.error("Workout data error:", error);
    return error?.message || "An unexpected error occurred";
  }, []);

  // ===========================
  // Workout Plans
  // ===========================

  const fetchWorkoutPlans = useCallback(async (): Promise<
    WorkoutDataResponse<WorkoutPlan[]>
  > => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("workout_plans")
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

  const fetchWorkoutPlanById = useCallback(
    async (planId: string): Promise<WorkoutDataResponse<WorkoutPlan>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim()) {
          return { success: false, error: "Plan ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("workout_plans")
          .select("*")
          .eq("id", planId)
          .single();

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as WorkoutPlan };
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

  const fetchWorkoutPlanWithTags = useCallback(
    async (planId: string): Promise<WorkoutDataResponse<WorkoutPlanWithTags>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim()) {
          return { success: false, error: "Plan ID is required" };
        }

        // Fetch the plan
        const { data: plan, error: planError } = await supabase
          .from("workout_plans")
          .select("*")
          .eq("id", planId)
          .single();

        if (planError) {
          const errorMsg = handleError(planError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        // Fetch plan tags
        const { data: planTags, error: planTagsError } = await supabase
          .from("workout_plan_tags")
          .select("tag_id")
          .eq("plan_id", planId);

        if (planTagsError) {
          console.error("Error fetching plan tags:", planTagsError);
        }

        const tagIds = planTags?.map((pt) => pt.tag_id) || [];

        // Fetch tag details
        let tags: WorkoutTag[] = [];
        if (tagIds.length > 0) {
          const { data: tagsData, error: tagsError } = await supabase
            .from("workout_tags")
            .select("*")
            .in("id", tagIds);

          if (tagsError) {
            console.error("Error fetching tags:", tagsError);
          } else {
            tags = tagsData || [];
          }
        }

        return { success: true, data: { ...plan, tags } };
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

  const fetchWorkoutPlanFull = useCallback(
    async (planId: string): Promise<WorkoutDataResponse<WorkoutPlanFull>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim()) {
          return { success: false, error: "Plan ID is required" };
        }

        // Fetch plan with tags
        const planWithTagsResult = await fetchWorkoutPlanWithTags(planId);
        if (!planWithTagsResult.success || !planWithTagsResult.data) {
          return {
            success: false,
            error: planWithTagsResult.error || "Failed to fetch plan",
          };
        }

        // Fetch exercises for plan
        const { data: planExercises, error: exercisesError } = await supabase
          .from("workout_plan_exercises")
          .select("*")
          .eq("plan_id", planId)
          .order("position", { ascending: true });

        if (exercisesError) {
          console.error("Error fetching exercises:", exercisesError);
        }

        // Fetch exercise details
        const exerciseIds =
          planExercises?.map((ex) => ex.exercise_id) || [];
        let exerciseDetailsMap: Map<string, WorkoutPlanExerciseDetails> =
          new Map();

        if (exerciseIds.length > 0) {
          const { data: detailsData, error: detailsError } = await supabase
            .from("workout_plan_exercises_details")
            .select("*")
            .in("id", exerciseIds);

          if (detailsError) {
            console.error("Error fetching exercise details:", detailsError);
          } else {
            detailsData?.forEach((detail) => {
              exerciseDetailsMap.set(detail.id, detail);
            });
          }
        }

        // Combine exercises with their details
        const exercises = planExercises?.map((exercise) => ({
          ...exercise,
          exercise_details: exerciseDetailsMap.get(exercise.exercise_id),
        }));

        return {
          success: true,
          data: { ...planWithTagsResult.data, exercises },
        };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError, fetchWorkoutPlanWithTags]
  );

  const fetchWorkoutPlansByLevel = useCallback(
    async (level: string): Promise<WorkoutDataResponse<WorkoutPlan[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!level.trim()) {
          return { success: false, error: "Level is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("workout_plans")
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

  const fetchWorkoutPlansByCategory = useCallback(
    async (category: string): Promise<WorkoutDataResponse<WorkoutPlan[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!category.trim()) {
          return { success: false, error: "Category is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("workout_plans")
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

  const fetchFreeWorkoutPlans = useCallback(async (): Promise<
    WorkoutDataResponse<WorkoutPlan[]>
  > => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("workout_plans")
        .select("*")
        .eq("is_free", true)
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

  // ===========================
  // Workout Tags
  // ===========================

  const fetchWorkoutTags = useCallback(async (): Promise<
    WorkoutDataResponse<WorkoutTag[]>
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
    async (planId: string): Promise<WorkoutDataResponse<WorkoutTag[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim()) {
          return { success: false, error: "Plan ID is required" };
        }

        // Fetch tag IDs for plan
        const { data: planTags, error: planTagsError } = await supabase
          .from("workout_plan_tags")
          .select("tag_id")
          .eq("plan_id", planId);

        if (planTagsError) {
          const errorMsg = handleError(planTagsError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        const tagIds = planTags?.map((pt) => pt.tag_id) || [];

        if (tagIds.length === 0) {
          return { success: true, data: [] };
        }

        // Fetch tag details
        const { data: tags, error: tagsError } = await supabase
          .from("workout_tags")
          .select("*")
          .in("id", tagIds);

        if (tagsError) {
          const errorMsg = handleError(tagsError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: tags || [] };
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
  // Exercises
  // ===========================

  const fetchExerciseDetails = useCallback(async (): Promise<
    WorkoutDataResponse<WorkoutPlanExerciseDetails[]>
  > => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("workout_plan_exercises_details")
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

  const fetchExerciseById = useCallback(
    async (
      exerciseId: string
    ): Promise<WorkoutDataResponse<WorkoutPlanExerciseDetails>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!exerciseId.trim()) {
          return { success: false, error: "Exercise ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("workout_plan_exercises_details")
          .select("*")
          .eq("id", exerciseId)
          .single();

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data as WorkoutPlanExerciseDetails };
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

  const fetchExercisesForPlan = useCallback(
    async (planId: string): Promise<WorkoutDataResponse<WorkoutPlanExercise[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim()) {
          return { success: false, error: "Plan ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("workout_plan_exercises")
          .select("*")
          .eq("plan_id", planId)
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

  const fetchExercisesForPlanWithDetails = useCallback(
    async (planId: string): Promise<WorkoutDataResponse<WorkoutPlanExercise[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim()) {
          return { success: false, error: "Plan ID is required" };
        }

        // Fetch exercises
        const { data: exercises, error: exercisesError } = await supabase
          .from("workout_plan_exercises")
          .select("*")
          .eq("plan_id", planId)
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
          .from("workout_plan_exercises_details")
          .select("*")
          .in("id", exerciseIds);

        if (detailsError) {
          console.error("Error fetching exercise details:", detailsError);
        }

        // Create a map of details
        const detailsMap = new Map<string, WorkoutPlanExerciseDetails>();
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

  return {
    // Workout Plans
    fetchWorkoutPlans,
    fetchWorkoutPlanById,
    fetchWorkoutPlanWithTags,
    fetchWorkoutPlanFull,
    fetchWorkoutPlansByLevel,
    fetchWorkoutPlansByCategory,
    fetchFreeWorkoutPlans,

    // Workout Tags
    fetchWorkoutTags,
    fetchTagsForPlan,

    // Exercises
    fetchExerciseDetails,
    fetchExerciseById,
    fetchExercisesForPlan,
    fetchExercisesForPlanWithDetails,

    // State
    isLoading,
    error,
  };
}


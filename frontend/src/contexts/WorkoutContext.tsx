"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "../lib/api/supabase";
import {
  WorkoutTag,
  WorkoutPlan,
  WorkoutPlanExerciseDetails,
  WorkoutPlanWithTags,
  WorkoutPlanFull,
  WorkoutLoadingState,
} from "../types/Workout";

// ===========================
// Context Type
// ===========================

interface WorkoutContextType {
  // Data
  workoutPlans: WorkoutPlan[];
  workoutTags: WorkoutTag[];
  exerciseDetails: WorkoutPlanExerciseDetails[];
  
  // Loading states
  loadingState: WorkoutLoadingState;
  
  // Methods
  refreshWorkoutData: () => Promise<void>;
  getWorkoutPlanById: (planId: string) => WorkoutPlan | undefined;
  getWorkoutPlanWithTags: (planId: string) => Promise<WorkoutPlanWithTags | null>;
  getWorkoutPlanFull: (planId: string) => Promise<WorkoutPlanFull | null>;
  getExerciseById: (exerciseId: string) => WorkoutPlanExerciseDetails | undefined;
  filterPlansByLevel: (level: string) => WorkoutPlan[];
  filterPlansByCategory: (category: string) => WorkoutPlan[];
  filterPlansByTag: (tagName: string) => Promise<WorkoutPlan[]>;
}

// ===========================
// Context Creation
// ===========================

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

// ===========================
// Provider Props
// ===========================

interface WorkoutProviderProps {
  children: ReactNode;
}

// ===========================
// Provider Component
// ===========================

export function WorkoutProvider({
  children,
}: WorkoutProviderProps): React.ReactElement {
  const REQUEST_TIMEOUT_MS = 8000;
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [workoutTags, setWorkoutTags] = useState<WorkoutTag[]>([]);
  const [exerciseDetails, setExerciseDetails] = useState<
    WorkoutPlanExerciseDetails[]
  >([]);
  const [loadingState, setLoadingState] = useState<WorkoutLoadingState>({
    isLoading: true,
    error: null,
  });

  const withTimeout = async <T,>(
    promise: PromiseLike<T>,
    label: string,
    timeoutMs: number = REQUEST_TIMEOUT_MS,
  ): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      Promise.resolve(promise)
        .then((value) => {
          clearTimeout(timeoutId);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });

  const fetchWorkoutData = async (): Promise<void> => {
    try {
      setLoadingState({ isLoading: true, error: null });

      const [{ data: plansData, error: plansError }, { data: tagsData, error: tagsError }, { data: exercisesData, error: exercisesError }] =
        await withTimeout(
          Promise.all([
            supabase
              .from("workout_plans")
              .select("*")
              .order("created_at", { ascending: false }),
            supabase
              .from("workout_tags")
              .select("*")
              .order("name", { ascending: true }),
            supabase
              .from("workout_plan_exercises_details")
              .select("*")
              .order("name", { ascending: true }),
          ]),
          "fetchWorkoutData",
        );

      if (plansError) throw plansError;
      if (tagsError) throw tagsError;
      if (exercisesError) throw exercisesError;

      setWorkoutPlans(plansData || []);
      setWorkoutTags(tagsData || []);
      setExerciseDetails(exercisesData || []);
      setLoadingState({ isLoading: false, error: null });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch workout data";
      console.error("Error fetching workout data:", error);
      setLoadingState({
        isLoading: false,
        error: message,
      });
    }
  };

  const refreshWorkoutData = async (): Promise<void> => {
    await fetchWorkoutData();
  };

  const getWorkoutPlanById = (planId: string): WorkoutPlan | undefined => {
    return workoutPlans.find((plan) => plan.id === planId);
  };

  const getWorkoutPlanWithTags = async (
    planId: string
  ): Promise<WorkoutPlanWithTags | null> => {
    try {
      const plan = getWorkoutPlanById(planId);
      if (!plan) return null;

      // Fetch tags for this plan
      const { data: planTagsData, error: planTagsError } = await withTimeout(
        supabase
          .from("workout_plan_tags")
          .select("tag_id")
          .eq("plan_id", planId),
        "getWorkoutPlanWithTags",
      );

      if (planTagsError) {
        console.error("Error fetching plan tags:", planTagsError);
        return { ...plan, tags: [] };
      }

      const tagIds = planTagsData?.map((pt) => pt.tag_id) || [];
      const tags = workoutTags.filter((tag) => tagIds.includes(tag.id));

      return { ...plan, tags };
    } catch (error) {
      console.error("Error getting workout plan with tags:", error);
      return null;
    }
  };

  const getWorkoutPlanFull = async (
    planId: string
  ): Promise<WorkoutPlanFull | null> => {
    try {
      const planWithTags = await getWorkoutPlanWithTags(planId);
      if (!planWithTags) return null;

      // Fetch exercises for this plan
      const { data: planExercisesData, error: planExercisesError } =
        await withTimeout(
          supabase
          .from("workout_plan_exercises")
          .select("*")
          .eq("plan_id", planId)
          .order("position", { ascending: true }),
          "getWorkoutPlanFull",
        );

      if (planExercisesError) {
        console.error("Error fetching plan exercises:", planExercisesError);
        return { ...planWithTags, exercises: [] };
      }

      // Map exercises with their details
      const exercises = planExercisesData?.map((exercise) => {
        const details = exerciseDetails.find(
          (detail) => detail.id === exercise.exercise_id
        );
        return {
          ...exercise,
          exercise_details: details,
        };
      });

      return { ...planWithTags, exercises };
    } catch (error) {
      console.error("Error getting full workout plan:", error);
      return null;
    }
  };

  const getExerciseById = (
    exerciseId: string
  ): WorkoutPlanExerciseDetails | undefined => {
    return exerciseDetails.find((exercise) => exercise.id === exerciseId);
  };

  const filterPlansByLevel = (level: string): WorkoutPlan[] => {
    return workoutPlans.filter(
      (plan) => plan.level.toLowerCase() === level.toLowerCase()
    );
  };

  const filterPlansByCategory = (category: string): WorkoutPlan[] => {
    return workoutPlans.filter(
      (plan) => plan.category?.toLowerCase() === category.toLowerCase()
    );
  };

  const filterPlansByTag = async (tagName: string): Promise<WorkoutPlan[]> => {
    try {
      // Find the tag
      const tag = workoutTags.find(
        (t) => t.name.toLowerCase() === tagName.toLowerCase()
      );
      if (!tag) return [];

      // Fetch plan IDs with this tag
      const { data: planTagsData, error: planTagsError } = await withTimeout(
        supabase
          .from("workout_plan_tags")
          .select("plan_id")
          .eq("tag_id", tag.id),
        "filterPlansByTag",
      );

      if (planTagsError) {
        console.error("Error filtering plans by tag:", planTagsError);
        return [];
      }

      const planIds = planTagsData?.map((pt) => pt.plan_id) || [];
      return workoutPlans.filter((plan) => planIds.includes(plan.id));
    } catch (error) {
      console.error("Error filtering plans by tag:", error);
      return [];
    }
  };

  useEffect(() => {
    fetchWorkoutData();
  }, []);

  const contextValue: WorkoutContextType = {
    workoutPlans,
    workoutTags,
    exerciseDetails,
    loadingState,
    refreshWorkoutData,
    getWorkoutPlanById,
    getWorkoutPlanWithTags,
    getWorkoutPlanFull,
    getExerciseById,
    filterPlansByLevel,
    filterPlansByCategory,
    filterPlansByTag,
  };

  return (
    <WorkoutContext.Provider value={contextValue}>
      {children}
    </WorkoutContext.Provider>
  );
}

// ===========================
// Custom Hook
// ===========================

export function useWorkoutContext(): WorkoutContextType {
  const context = useContext(WorkoutContext);
  if (context === undefined) {
    throw new Error("useWorkoutContext must be used within a WorkoutProvider");
  }
  return context;
}


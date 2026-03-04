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
  CoachWorkoutPlan,
  CoachWorkoutPlanTag,
  CoachWorkoutPlanExerciseDetails,
  CoachWorkoutDailyPlan,
  CoachWorkoutDailyPlanFull,
  CoachWorkoutPlanFull,
  CoachWorkoutPlanWithTags,
  CoachWorkoutLoadingState,
} from "../types/CoachWorkout";
import { WorkoutTag } from "../types/Workout";

// ===========================
// Context Type
// ===========================

interface CoachWorkoutContextType {
  // Data
  coachWorkoutPlans: CoachWorkoutPlanWithTags[];
  exerciseDetails: CoachWorkoutPlanExerciseDetails[];
  workoutTags: WorkoutTag[];

  // Loading states
  loadingState: CoachWorkoutLoadingState;

  // Methods
  refreshCoachWorkoutData: () => Promise<void>;
  getCoachWorkoutPlanById: (
    planId: string
  ) => CoachWorkoutPlanWithTags | undefined;
  getCoachWorkoutPlanFull: (
    planId: string
  ) => Promise<CoachWorkoutPlanFull | null>;
  getExerciseById: (
    exerciseId: string
  ) => CoachWorkoutPlanExerciseDetails | undefined;
  filterPlansByLevel: (level: string) => CoachWorkoutPlanWithTags[];
  filterPlansByCategory: (category: string) => CoachWorkoutPlanWithTags[];
  filterPlansByCreator: (createdBy: string) => CoachWorkoutPlanWithTags[];
  getDailyPlansForPlan: (
    planId: string
  ) => Promise<CoachWorkoutDailyPlan[]>;
  getDailyPlanFull: (
    dailyPlanId: string
  ) => Promise<CoachWorkoutDailyPlanFull | null>;
  // Tag methods
  getTagsForPlan: (planId: string) => Promise<WorkoutTag[]>;
  addTagToPlan: (planId: string, tagId: string) => Promise<boolean>;
  removeTagFromPlan: (planId: string, tagId: string) => Promise<boolean>;
  setPlanTags: (planId: string, tagIds: string[]) => Promise<boolean>;
}

// ===========================
// Context Creation
// ===========================

const CoachWorkoutContext = createContext<
  CoachWorkoutContextType | undefined
>(undefined);

// ===========================
// Provider Props
// ===========================

interface CoachWorkoutProviderProps {
  children: ReactNode;
}

// ===========================
// Provider Component
// ===========================

export function CoachWorkoutProvider({
  children,
}: CoachWorkoutProviderProps): React.ReactElement {
  const [coachWorkoutPlans, setCoachWorkoutPlans] = useState<
    CoachWorkoutPlanWithTags[]
  >([]);
  const [exerciseDetails, setExerciseDetails] = useState<
    CoachWorkoutPlanExerciseDetails[]
  >([]);
  const [workoutTags, setWorkoutTags] = useState<WorkoutTag[]>([]);
  const [loadingState, setLoadingState] =
    useState<CoachWorkoutLoadingState>({
      isLoading: true,
      error: null,
    });

  const fetchCoachWorkoutData = async (): Promise<void> => {
    try {
      setLoadingState({ isLoading: true, error: null });

      // Fetch all coach workout plans
      const { data: plansData, error: plansError } = await supabase
        .from("coach_workout_plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (plansError) {
        throw plansError;
      }

      // Fetch all exercise details
      const { data: exercisesData, error: exercisesError } = await supabase
        .from("coach_workout_plan_exercises_details")
        .select("*")
        .order("name", { ascending: true });

      if (exercisesError) {
        throw exercisesError;
      }

      // Fetch all workout tags
      const { data: tagsData, error: tagsError } = await supabase
        .from("workout_tags")
        .select("*")
        .order("name", { ascending: true });

      if (tagsError) {
        console.error("Error fetching workout tags:", tagsError);
      }

      setWorkoutTags(tagsData || []);

      // Fetch tags for each plan
      const plansWithTags = await Promise.all(
        (plansData || []).map(async (plan) => {
          const { data: planTagsData } = await supabase
            .from("coach_workout_plan_tags")
            .select("tag_id")
            .eq("plan_id", plan.id);

          const tagIds = planTagsData?.map((pt) => pt.tag_id) || [];
          const tags = (tagsData || []).filter((tag) => tagIds.includes(tag.id));

          return { ...plan, tags };
        })
      );

      setCoachWorkoutPlans(plansWithTags);
      setExerciseDetails(exercisesData || []);
      setLoadingState({ isLoading: false, error: null });
    } catch (error: any) {
      console.error("Error fetching coach workout data:", error);
      setLoadingState({
        isLoading: false,
        error: error.message || "Failed to fetch coach workout data",
      });
    }
  };

  const refreshCoachWorkoutData = async (): Promise<void> => {
    await fetchCoachWorkoutData();
  };

  const getCoachWorkoutPlanById = (
    planId: string
  ): CoachWorkoutPlanWithTags | undefined => {
    return coachWorkoutPlans.find((plan) => plan.id === planId);
  };

  const getCoachWorkoutPlanFull = async (
    planId: string
  ): Promise<CoachWorkoutPlanFull | null> => {
    try {
      const plan = getCoachWorkoutPlanById(planId);
      if (!plan) return null;

      // Fetch daily plans for this plan
      const { data: dailyPlansData, error: dailyPlansError } = await supabase
        .from("coach_workout_daily_plan")
        .select("*")
        .eq("plan_id", planId)
        .order("day_number", { ascending: true });

      if (dailyPlansError) {
        console.error("Error fetching daily plans:", dailyPlansError);
        return { ...plan, daily_plans: [] };
      }

      // Fetch full details for each daily plan
      const dailyPlansFull = await Promise.all(
        (dailyPlansData || []).map(async (dailyPlan) => {
          const dailyPlanFull = await getDailyPlanFull(dailyPlan.id);
          return dailyPlanFull || dailyPlan;
        })
      );

      // Fetch tags for this plan
      const tags = await getTagsForPlan(planId);

      return {
        ...plan,
        tags,
        daily_plans: dailyPlansFull as CoachWorkoutDailyPlanFull[],
      };
    } catch (error) {
      console.error("Error getting full coach workout plan:", error);
      return null;
    }
  };

  const getExerciseById = (
    exerciseId: string
  ): CoachWorkoutPlanExerciseDetails | undefined => {
    return exerciseDetails.find((exercise) => exercise.id === exerciseId);
  };

  const filterPlansByLevel = (level: string): CoachWorkoutPlanWithTags[] => {
    return coachWorkoutPlans.filter(
      (plan) => plan.level.toLowerCase() === level.toLowerCase()
    );
  };

  const filterPlansByCategory = (category: string): CoachWorkoutPlanWithTags[] => {
    return coachWorkoutPlans.filter(
      (plan) => plan.category?.toLowerCase() === category.toLowerCase()
    );
  };

  const filterPlansByCreator = (createdBy: string): CoachWorkoutPlanWithTags[] => {
    return coachWorkoutPlans.filter((plan) => plan.created_by === createdBy);
  };

  const getDailyPlansForPlan = async (
    planId: string
  ): Promise<CoachWorkoutDailyPlan[]> => {
    try {
      const { data: dailyPlansData, error: dailyPlansError } = await supabase
        .from("coach_workout_daily_plan")
        .select("*")
        .eq("plan_id", planId)
        .order("day_number", { ascending: true });

      if (dailyPlansError) {
        console.error("Error fetching daily plans:", dailyPlansError);
        return [];
      }

      return dailyPlansData || [];
    } catch (error) {
      console.error("Error getting daily plans for plan:", error);
      return [];
    }
  };

  const getDailyPlanFull = async (
    dailyPlanId: string
  ): Promise<CoachWorkoutDailyPlanFull | null> => {
    try {
      // Fetch daily plan
      const { data: dailyPlan, error: dailyPlanError } = await supabase
        .from("coach_workout_daily_plan")
        .select("*")
        .eq("id", dailyPlanId)
        .single();

      if (dailyPlanError) {
        console.error("Error fetching daily plan:", dailyPlanError);
        return null;
      }

      // Fetch exercises for this daily plan
      const { data: exercisesData, error: exercisesError } = await supabase
        .from("coach_workout_daily_plan_exercises")
        .select("*")
        .eq("daily_plan_id", dailyPlanId)
        .order("position", { ascending: true });

      if (exercisesError) {
        console.error("Error fetching exercises:", exercisesError);
        return { ...dailyPlan, exercises: [] };
      }

      // Map exercises with their details
      const exercises = exercisesData?.map((exercise) => {
        const details = exerciseDetails.find(
          (detail) => detail.id === exercise.exercise_id
        );
        return {
          ...exercise,
          exercise_details: details,
        };
      });

      return { ...dailyPlan, exercises };
    } catch (error) {
      console.error("Error getting full daily plan:", error);
      return null;
    }
  };

  // ===========================
  // Tag Methods
  // ===========================

  const getTagsForPlan = async (planId: string): Promise<WorkoutTag[]> => {
    try {
      const { data: planTagsData, error: planTagsError } = await supabase
        .from("coach_workout_plan_tags")
        .select("tag_id")
        .eq("plan_id", planId);

      if (planTagsError) {
        console.error("Error fetching plan tags:", planTagsError);
        return [];
      }

      const tagIds = planTagsData?.map((pt) => pt.tag_id) || [];
      return workoutTags.filter((tag) => tagIds.includes(tag.id));
    } catch (error) {
      console.error("Error getting tags for plan:", error);
      return [];
    }
  };

  const addTagToPlan = async (
    planId: string,
    tagId: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("coach_workout_plan_tags")
        .insert({ plan_id: planId, tag_id: tagId });

      if (error) {
        console.error("Error adding tag to plan:", error);
        return false;
      }

      // Refresh plan data
      await refreshCoachWorkoutData();
      return true;
    } catch (error) {
      console.error("Error adding tag to plan:", error);
      return false;
    }
  };

  const removeTagFromPlan = async (
    planId: string,
    tagId: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("coach_workout_plan_tags")
        .delete()
        .eq("plan_id", planId)
        .eq("tag_id", tagId);

      if (error) {
        console.error("Error removing tag from plan:", error);
        return false;
      }

      // Refresh plan data
      await refreshCoachWorkoutData();
      return true;
    } catch (error) {
      console.error("Error removing tag from plan:", error);
      return false;
    }
  };

  const setPlanTags = async (
    planId: string,
    tagIds: string[]
  ): Promise<boolean> => {
    try {
      // Delete existing tags
      const { error: deleteError } = await supabase
        .from("coach_workout_plan_tags")
        .delete()
        .eq("plan_id", planId);

      if (deleteError) {
        console.error("Error deleting existing tags:", deleteError);
        return false;
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
          console.error("Error inserting tags:", insertError);
          return false;
        }
      }

      // Refresh plan data
      await refreshCoachWorkoutData();
      return true;
    } catch (error) {
      console.error("Error setting plan tags:", error);
      return false;
    }
  };

  useEffect(() => {
    fetchCoachWorkoutData();
  }, []);

  const contextValue: CoachWorkoutContextType = {
    coachWorkoutPlans,
    exerciseDetails,
    workoutTags,
    loadingState,
    refreshCoachWorkoutData,
    getCoachWorkoutPlanById,
    getCoachWorkoutPlanFull,
    getExerciseById,
    filterPlansByLevel,
    filterPlansByCategory,
    filterPlansByCreator,
    getDailyPlansForPlan,
    getDailyPlanFull,
    getTagsForPlan,
    addTagToPlan,
    removeTagFromPlan,
    setPlanTags,
  };

  return (
    <CoachWorkoutContext.Provider value={contextValue}>
      {children}
    </CoachWorkoutContext.Provider>
  );
}

// ===========================
// Custom Hook
// ===========================

export function useCoachWorkoutContext(): CoachWorkoutContextType {
  const context = useContext(CoachWorkoutContext);
  if (context === undefined) {
    throw new Error(
      "useCoachWorkoutContext must be used within a CoachWorkoutProvider"
    );
  }
  return context;
}


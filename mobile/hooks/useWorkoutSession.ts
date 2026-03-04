import { useState, useCallback } from "react";
import { supabase } from "../utils/supabase";
import {
  WorkoutSession,
  WorkoutSessionFull,
  WorkoutSessionExercise,
  WorkoutSessionExerciseWithSets,
  WorkoutSessionSet,
  WorkoutSessionCreatePayload,
  WorkoutSessionUpdatePayload,
  WorkoutSessionExerciseCreatePayload,
  WorkoutSessionExerciseUpdatePayload,
  WorkoutSessionSetCreatePayload,
  WorkoutSessionSetUpdatePayload,
  WorkoutSessionFilters,
  WorkoutSessionStats,
  WorkoutSessionLoadingState,
} from "../types/WorkoutSession";

// ===========================
// Hook Return Type
// ===========================

interface UseWorkoutSessionReturn {
  loadingState: WorkoutSessionLoadingState;
  createWorkoutSession: (
    payload: WorkoutSessionCreatePayload
  ) => Promise<WorkoutSession | null>;
  updateWorkoutSession: (
    sessionId: string,
    payload: WorkoutSessionUpdatePayload
  ) => Promise<WorkoutSession | null>;
  endWorkoutSession: (sessionId: string) => Promise<WorkoutSession | null>;
  deleteWorkoutSession: (sessionId: string) => Promise<boolean>;
  fetchWorkoutSessionById: (
    sessionId: string
  ) => Promise<WorkoutSessionFull | null>;
  fetchWorkoutSessions: (
    filters: WorkoutSessionFilters
  ) => Promise<WorkoutSession[]>;
  fetchActiveWorkoutSession: (
    userId: string
  ) => Promise<WorkoutSessionFull | null>;
  createWorkoutSessionExercise: (
    payload: WorkoutSessionExerciseCreatePayload
  ) => Promise<WorkoutSessionExercise | null>;
  updateWorkoutSessionExercise: (
    exerciseId: string,
    payload: WorkoutSessionExerciseUpdatePayload
  ) => Promise<WorkoutSessionExercise | null>;
  deleteWorkoutSessionExercise: (exerciseId: string) => Promise<boolean>;
  fetchWorkoutSessionExercises: (
    sessionId: string
  ) => Promise<WorkoutSessionExerciseWithSets[]>;
  createWorkoutSessionSet: (
    payload: WorkoutSessionSetCreatePayload
  ) => Promise<WorkoutSessionSet | null>;
  updateWorkoutSessionSet: (
    setId: string,
    payload: WorkoutSessionSetUpdatePayload
  ) => Promise<WorkoutSessionSet | null>;
  deleteWorkoutSessionSet: (setId: string) => Promise<boolean>;
  fetchWorkoutSessionSets: (
    sessionExerciseId: string
  ) => Promise<WorkoutSessionSet[]>;
  calculateSessionTotals: (sessionId: string) => Promise<boolean>;
  fetchWorkoutSessionStats: (
    userId: string,
    startDate?: string,
    endDate?: string
  ) => Promise<WorkoutSessionStats | null>;
}

// ===========================
// Main Hook
// ===========================

export function useWorkoutSession(): UseWorkoutSessionReturn {
  const [loadingState, setLoadingState] = useState<WorkoutSessionLoadingState>({
    isLoading: false,
    isUpdating: false,
    isSaving: false,
    error: null,
  });

  // ===========================
  // Workout Session Operations
  // ===========================

  const createWorkoutSession = useCallback(
    async (
      payload: WorkoutSessionCreatePayload
    ): Promise<WorkoutSession | null> => {
      try {
        setLoadingState((prev) => ({ ...prev, isSaving: true, error: null }));

        const { data, error } = await supabase
          .from("workout_sessions")
          .insert([payload])
          .select()
          .single();

        if (error) {
          console.error("Error creating workout session:", error);
          setLoadingState((prev) => ({
            ...prev,
            isSaving: false,
            error: error.message,
          }));
          return null;
        }

        setLoadingState((prev) => ({ ...prev, isSaving: false }));
        return data;
      } catch (error: any) {
        console.error("Unexpected error creating workout session:", error);
        setLoadingState((prev) => ({
          ...prev,
          isSaving: false,
          error: error.message || "An unexpected error occurred",
        }));
        return null;
      }
    },
    []
  );

  const updateWorkoutSession = useCallback(
    async (
      sessionId: string,
      payload: WorkoutSessionUpdatePayload
    ): Promise<WorkoutSession | null> => {
      try {
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: true,
          error: null,
        }));

        const { data, error } = await supabase
          .from("workout_sessions")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", sessionId)
          .select()
          .single();

        if (error) {
          console.error("Error updating workout session:", error);
          setLoadingState((prev) => ({
            ...prev,
            isUpdating: false,
            error: error.message,
          }));
          return null;
        }

        setLoadingState((prev) => ({ ...prev, isUpdating: false }));
        return data;
      } catch (error: any) {
        console.error("Unexpected error updating workout session:", error);
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: false,
          error: error.message || "An unexpected error occurred",
        }));
        return null;
      }
    },
    []
  );

  const endWorkoutSession = useCallback(
    async (sessionId: string): Promise<WorkoutSession | null> => {
      try {
        // First, get all exercise IDs for this session
        const { data: exercisesData, error: fetchError } = await supabase
          .from("workout_session_exercises")
          .select("id")
          .eq("session_id", sessionId);

        if (fetchError) {
          console.error("Error fetching exercises to delete:", fetchError);
          return null;
        }

        // Delete all sets for these exercises (must be done first due to foreign key constraints)
        if (exercisesData && exercisesData.length > 0) {
          const exerciseIds = exercisesData.map((ex) => ex.id);
          const { error: setsError } = await supabase
            .from("workout_session_sets")
            .delete()
            .in("session_exercise_id", exerciseIds);

          if (setsError) {
            console.error("Error deleting session sets:", setsError);
          }
        }

        // Then delete all exercises
        const { error: exercisesError } = await supabase
          .from("workout_session_exercises")
          .delete()
          .eq("session_id", sessionId);

        if (exercisesError) {
          console.error("Error deleting session exercises:", exercisesError);
          return null;
        }

        // Finally, delete the session itself
        const { error: sessionError } = await supabase
          .from("workout_sessions")
          .delete()
          .eq("id", sessionId);

        if (sessionError) {
          console.error("Error deleting session:", sessionError);
          return null;
        }

        return { id: sessionId } as WorkoutSession;
      } catch (error: any) {
        console.error("Unexpected error ending workout session:", error);
        return null;
      }
    },
    []
  );

  const deleteWorkoutSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: true,
          error: null,
        }));

        const { error } = await supabase
          .from("workout_sessions")
          .delete()
          .eq("id", sessionId);

        if (error) {
          console.error("Error deleting workout session:", error);
          setLoadingState((prev) => ({
            ...prev,
            isUpdating: false,
            error: error.message,
          }));
          return false;
        }

        setLoadingState((prev) => ({ ...prev, isUpdating: false }));
        return true;
      } catch (error: any) {
        console.error("Unexpected error deleting workout session:", error);
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: false,
          error: error.message || "An unexpected error occurred",
        }));
        return false;
      }
    },
    []
  );

  const fetchWorkoutSessionById = useCallback(
    async (sessionId: string): Promise<WorkoutSessionFull | null> => {
      try {
        setLoadingState((prev) => ({ ...prev, isLoading: true, error: null }));

        const { data: sessionData, error: sessionError } = await supabase
          .from("workout_sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (sessionError) {
          console.error("Error fetching workout session:", sessionError);
          setLoadingState((prev) => ({
            ...prev,
            isLoading: false,
            error: sessionError.message,
          }));
          return null;
        }

        const { data: exercisesData, error: exercisesError } = await supabase
          .from("workout_session_exercises")
          .select("*")
          .eq("session_id", sessionId)
          .order("order_in_session", { ascending: true });

        if (exercisesError) {
          console.error("Error fetching session exercises:", exercisesError);
          setLoadingState((prev) => ({
            ...prev,
            isLoading: false,
            error: exercisesError.message,
          }));
          return null;
        }

        const exercisesWithSets: WorkoutSessionExerciseWithSets[] =
          await Promise.all(
            (exercisesData || []).map(async (exercise) => {
              const { data: setsData, error: setsError } = await supabase
                .from("workout_session_sets")
                .select("*")
                .eq("session_exercise_id", exercise.id)
                .order("set_number", { ascending: true });

              if (setsError) {
                console.error("Error fetching sets:", setsError);
              }

              return {
                ...exercise,
                sets: setsData || [],
              };
            })
          );

        const fullSession: WorkoutSessionFull = {
          ...sessionData,
          exercises: exercisesWithSets,
        };

        setLoadingState((prev) => ({ ...prev, isLoading: false }));
        return fullSession;
      } catch (error: any) {
        console.error("Unexpected error fetching workout session:", error);
        setLoadingState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || "An unexpected error occurred",
        }));
        return null;
      }
    },
    []
  );

  const fetchWorkoutSessions = useCallback(
    async (filters: WorkoutSessionFilters): Promise<WorkoutSession[]> => {
      try {
        setLoadingState((prev) => ({ ...prev, isLoading: true, error: null }));

        let query = supabase.from("workout_sessions").select("*");

        if (filters.userId) {
          query = query.eq("user_id", filters.userId);
        }

        if (filters.planId !== undefined) {
          if (filters.planId === null) {
            query = query.is("plan_id", null);
          } else {
            query = query.eq("plan_id", filters.planId);
          }
        }

        if (filters.startDate) {
          query = query.gte("started_at", filters.startDate);
        }

        if (filters.endDate) {
          query = query.lte("started_at", filters.endDate);
        }

        if (filters.isCompleted !== undefined) {
          if (filters.isCompleted) {
            query = query.not("ended_at", "is", null);
          } else {
            query = query.is("ended_at", null);
          }
        }

        query = query.order("started_at", { ascending: false });

        const { data, error } = await query;

        if (error) {
          console.error("Error fetching workout sessions:", error);
          setLoadingState((prev) => ({
            ...prev,
            isLoading: false,
            error: error.message,
          }));
          return [];
        }

        setLoadingState((prev) => ({ ...prev, isLoading: false }));
        return data || [];
      } catch (error: any) {
        console.error("Unexpected error fetching workout sessions:", error);
        setLoadingState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || "An unexpected error occurred",
        }));
        return [];
      }
    },
    []
  );

  const fetchActiveWorkoutSession = useCallback(
    async (userId: string): Promise<WorkoutSessionFull | null> => {
      try {
        setLoadingState((prev) => ({ ...prev, isLoading: true, error: null }));

        const { data, error } = await supabase
          .from("workout_sessions")
          .select("*")
          .eq("user_id", userId)
          .is("ended_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            setLoadingState((prev) => ({ ...prev, isLoading: false }));
            return null;
          }
          console.error("Error fetching active workout session:", error);
          setLoadingState((prev) => ({
            ...prev,
            isLoading: false,
            error: error.message,
          }));
          return null;
        }

        if (!data) {
          setLoadingState((prev) => ({ ...prev, isLoading: false }));
          return null;
        }

        const fullSession = await fetchWorkoutSessionById(data.id);
        return fullSession;
      } catch (error: any) {
        console.error("Unexpected error fetching active workout session:", error);
        setLoadingState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || "An unexpected error occurred",
        }));
        return null;
      }
    },
    [fetchWorkoutSessionById]
  );

  // ===========================
  // Exercise Operations
  // ===========================

  const createWorkoutSessionExercise = useCallback(
    async (
      payload: WorkoutSessionExerciseCreatePayload
    ): Promise<WorkoutSessionExercise | null> => {
      try {
        setLoadingState((prev) => ({ ...prev, isSaving: true, error: null }));

        // Check if exercise already exists in the current session
        const { data: existingInSession, error: checkError } = await supabase
          .from("workout_session_exercises")
          .select("*")
          .eq("session_id", payload.session_id)
          .eq("exercise_id", payload.exercise_id)
          .eq("plan_position", payload.plan_position || 0)
          .maybeSingle();

        if (checkError) {
          console.error("Error checking for existing exercise:", checkError);
          setLoadingState((prev) => ({
            ...prev,
            isSaving: false,
            error: checkError.message,
          }));
          return null;
        }

        // If exercise already exists in this session, return it
        if (existingInSession) {
          console.log("✅ Exercise already exists in session, returning existing");
          setLoadingState((prev) => ({ ...prev, isSaving: false }));
          return existingInSession;
        }

        // Check for orphaned exercises from other sessions with same plan_position
        // This shouldn't happen if cleanup is done properly, but just in case
        if (payload.plan_id && payload.plan_position != null) {
          const { data: orphanedExercises } = await supabase
            .from("workout_session_exercises")
            .select("id, session_id")
            .eq("user_id", payload.user_id)
            .eq("plan_id", payload.plan_id)
            .eq("plan_position", payload.plan_position)
            .neq("session_id", payload.session_id);

          if (orphanedExercises && orphanedExercises.length > 0) {
            console.warn("⚠️ Found orphaned exercises, cleaning up...");
            const exerciseIds = orphanedExercises.map((ex) => ex.id);

            // Delete sets first
            await supabase
              .from("workout_session_sets")
              .delete()
              .in("session_exercise_id", exerciseIds);

            // Delete exercises
            await supabase
              .from("workout_session_exercises")
              .delete()
              .in("id", exerciseIds);

            // Wait for cleanup to complete
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        // Create new exercise
        const { data, error } = await supabase
          .from("workout_session_exercises")
          .insert([payload])
          .select()
          .single();

        if (error) {
          console.error("Error creating workout session exercise:", error);
          setLoadingState((prev) => ({
            ...prev,
            isSaving: false,
            error: error.message,
          }));
          return null;
        }

        console.log("✅ Exercise created successfully");
        setLoadingState((prev) => ({ ...prev, isSaving: false }));
        return data;
      } catch (error: any) {
        console.error("Unexpected error creating workout session exercise:", error);
        setLoadingState((prev) => ({
          ...prev,
          isSaving: false,
          error: error.message || "An unexpected error occurred",
        }));
        return null;
      }
    },
    []
  );

  const updateWorkoutSessionExercise = useCallback(
    async (
      exerciseId: string,
      payload: WorkoutSessionExerciseUpdatePayload
    ): Promise<WorkoutSessionExercise | null> => {
      try {
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: true,
          error: null,
        }));

        const { data, error } = await supabase
          .from("workout_session_exercises")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", exerciseId)
          .select()
          .single();

        if (error) {
          console.error("Error updating workout session exercise:", error);
          setLoadingState((prev) => ({
            ...prev,
            isUpdating: false,
            error: error.message,
          }));
          return null;
        }

        setLoadingState((prev) => ({ ...prev, isUpdating: false }));
        return data;
      } catch (error: any) {
        console.error("Unexpected error updating workout session exercise:", error);
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: false,
          error: error.message || "An unexpected error occurred",
        }));
        return null;
      }
    },
    []
  );

  const deleteWorkoutSessionExercise = useCallback(
    async (exerciseId: string): Promise<boolean> => {
      try {
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: true,
          error: null,
        }));

        const { error } = await supabase
          .from("workout_session_exercises")
          .delete()
          .eq("id", exerciseId);

        if (error) {
          console.error("Error deleting workout session exercise:", error);
          setLoadingState((prev) => ({
            ...prev,
            isUpdating: false,
            error: error.message,
          }));
          return false;
        }

        setLoadingState((prev) => ({ ...prev, isUpdating: false }));
        return true;
      } catch (error: any) {
        console.error("Unexpected error deleting workout session exercise:", error);
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: false,
          error: error.message || "An unexpected error occurred",
        }));
        return false;
      }
    },
    []
  );

  const fetchWorkoutSessionExercises = useCallback(
    async (sessionId: string): Promise<WorkoutSessionExerciseWithSets[]> => {
      try {
        setLoadingState((prev) => ({ ...prev, isLoading: true, error: null }));

        const { data: exercisesData, error: exercisesError } = await supabase
          .from("workout_session_exercises")
          .select("*")
          .eq("session_id", sessionId)
          .order("order_in_session", { ascending: true });

        if (exercisesError) {
          console.error("Error fetching workout session exercises:", exercisesError);
          setLoadingState((prev) => ({
            ...prev,
            isLoading: false,
            error: exercisesError.message,
          }));
          return [];
        }

        const exercisesWithSets: WorkoutSessionExerciseWithSets[] =
          await Promise.all(
            (exercisesData || []).map(async (exercise) => {
              const { data: setsData, error: setsError } = await supabase
                .from("workout_session_sets")
                .select("*")
                .eq("session_exercise_id", exercise.id)
                .order("set_number", { ascending: true });

              if (setsError) {
                console.error("Error fetching sets:", setsError);
              }

              return {
                ...exercise,
                sets: setsData || [],
              };
            })
          );

        setLoadingState((prev) => ({ ...prev, isLoading: false }));
        return exercisesWithSets;
      } catch (error: any) {
        console.error("Unexpected error fetching workout session exercises:", error);
        setLoadingState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || "An unexpected error occurred",
        }));
        return [];
      }
    },
    []
  );

  // ===========================
  // Set Operations
  // ===========================

  const createWorkoutSessionSet = useCallback(
    async (
      payload: WorkoutSessionSetCreatePayload
    ): Promise<WorkoutSessionSet | null> => {
      try {
        setLoadingState((prev) => ({ ...prev, isSaving: true, error: null }));

        const { data, error } = await supabase
          .from("workout_session_sets")
          .insert([payload])
          .select()
          .single();

        if (error) {
          console.error("Error creating workout session set:", error);
          setLoadingState((prev) => ({
            ...prev,
            isSaving: false,
            error: error.message,
          }));
          return null;
        }

        setLoadingState((prev) => ({ ...prev, isSaving: false }));
        return data;
      } catch (error: any) {
        console.error("Unexpected error creating workout session set:", error);
        setLoadingState((prev) => ({
          ...prev,
          isSaving: false,
          error: error.message || "An unexpected error occurred",
        }));
        return null;
      }
    },
    []
  );

  const updateWorkoutSessionSet = useCallback(
    async (
      setId: string,
      payload: WorkoutSessionSetUpdatePayload
    ): Promise<WorkoutSessionSet | null> => {
      try {
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: true,
          error: null,
        }));

        const { data, error } = await supabase
          .from("workout_session_sets")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", setId)
          .select()
          .single();

        if (error) {
          console.error("Error updating workout session set:", error);
          setLoadingState((prev) => ({
            ...prev,
            isUpdating: false,
            error: error.message,
          }));
          return null;
        }

        setLoadingState((prev) => ({ ...prev, isUpdating: false }));
        return data;
      } catch (error: any) {
        console.error("Unexpected error updating workout session set:", error);
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: false,
          error: error.message || "An unexpected error occurred",
        }));
        return null;
      }
    },
    []
  );

  const deleteWorkoutSessionSet = useCallback(
    async (setId: string): Promise<boolean> => {
      try {
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: true,
          error: null,
        }));

        const { error } = await supabase
          .from("workout_session_sets")
          .delete()
          .eq("id", setId);

        if (error) {
          console.error("Error deleting workout session set:", error);
          setLoadingState((prev) => ({
            ...prev,
            isUpdating: false,
            error: error.message,
          }));
          return false;
        }

        setLoadingState((prev) => ({ ...prev, isUpdating: false }));
        return true;
      } catch (error: any) {
        console.error("Unexpected error deleting workout session set:", error);
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: false,
          error: error.message || "An unexpected error occurred",
        }));
        return false;
      }
    },
    []
  );

  const fetchWorkoutSessionSets = useCallback(
    async (sessionExerciseId: string): Promise<WorkoutSessionSet[]> => {
      try {
        setLoadingState((prev) => ({ ...prev, isLoading: true, error: null }));

        const { data, error } = await supabase
          .from("workout_session_sets")
          .select("*")
          .eq("session_exercise_id", sessionExerciseId)
          .order("set_number", { ascending: true });

        if (error) {
          console.error("Error fetching workout session sets:", error);
          setLoadingState((prev) => ({
            ...prev,
            isLoading: false,
            error: error.message,
          }));
          return [];
        }

        setLoadingState((prev) => ({ ...prev, isLoading: false }));
        return data || [];
      } catch (error: any) {
        console.error("Unexpected error fetching workout session sets:", error);
        setLoadingState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || "An unexpected error occurred",
        }));
        return [];
      }
    },
    []
  );

  // ===========================
  // Calculations & Statistics
  // ===========================

  const calculateSessionTotals = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: true,
          error: null,
        }));

        const exercises = await fetchWorkoutSessionExercises(sessionId);

        let totalSets = 0;
        let totalReps = 0;
        let totalDurationSeconds = 0;
        let totalRestSeconds = 0;

        exercises.forEach((exercise) => {
          const sets = exercise.sets || [];
          totalSets += sets.filter((set) => set.completed).length;
          totalReps += sets.reduce(
            (sum, set) => sum + (set.completed && set.reps ? set.reps : 0),
            0
          );
          totalDurationSeconds += sets.reduce(
            (sum, set) =>
              sum + (set.completed && set.duration_seconds ? set.duration_seconds : 0),
            0
          );
          totalRestSeconds += sets.reduce(
            (sum, set) =>
              sum + (set.completed && set.rest_seconds ? set.rest_seconds : 0),
            0
          );
        });

        const { error } = await supabase
          .from("workout_sessions")
          .update({
            total_sets: totalSets,
            total_reps: totalReps,
            total_duration_seconds: totalDurationSeconds,
            total_rest_seconds: totalRestSeconds,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId);

        if (error) {
          console.error("Error calculating session totals:", error);
          setLoadingState((prev) => ({
            ...prev,
            isUpdating: false,
            error: error.message,
          }));
          return false;
        }

        setLoadingState((prev) => ({ ...prev, isUpdating: false }));
        return true;
      } catch (error: any) {
        console.error("Unexpected error calculating session totals:", error);
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: false,
          error: error.message || "An unexpected error occurred",
        }));
        return false;
      }
    },
    [fetchWorkoutSessionExercises]
  );

  const fetchWorkoutSessionStats = useCallback(
    async (
      userId: string,
      startDate?: string,
      endDate?: string
    ): Promise<WorkoutSessionStats | null> => {
      try {
        setLoadingState((prev) => ({ ...prev, isLoading: true, error: null }));

        let query = supabase
          .from("workout_sessions")
          .select("*")
          .eq("user_id", userId)
          .not("ended_at", "is", null);

        if (startDate) {
          query = query.gte("started_at", startDate);
        }

        if (endDate) {
          query = query.lte("started_at", endDate);
        }

        const { data: sessions, error } = await query;

        if (error) {
          console.error("Error fetching workout session stats:", error);
          setLoadingState((prev) => ({
            ...prev,
            isLoading: false,
            error: error.message,
          }));
          return null;
        }

        if (!sessions || sessions.length === 0) {
          setLoadingState((prev) => ({ ...prev, isLoading: false }));
          return {
            total_sessions: 0,
            total_duration_seconds: 0,
            total_calories: 0,
            total_exercises: 0,
            total_sets: 0,
            total_reps: 0,
            average_session_duration: 0,
          };
        }

        const stats: WorkoutSessionStats = {
          total_sessions: sessions.length,
          total_duration_seconds: sessions.reduce(
            (sum, s) => sum + (s.total_duration_seconds || 0),
            0
          ),
          total_calories: sessions.reduce(
            (sum, s) => sum + (s.total_calories || 0),
            0
          ),
          total_exercises: 0,
          total_sets: sessions.reduce((sum, s) => sum + (s.total_sets || 0), 0),
          total_reps: sessions.reduce((sum, s) => sum + (s.total_reps || 0), 0),
          average_session_duration: 0,
        };

        const { data: exercisesCount, error: exercisesError } = await supabase
          .from("workout_session_exercises")
          .select("id", { count: "exact" })
          .in(
            "session_id",
            sessions.map((s) => s.id)
          );

        if (!exercisesError && exercisesCount) {
          stats.total_exercises = exercisesCount.length;
        }

        const totalDuration = stats.total_duration_seconds;
        const totalSessions = stats.total_sessions;
        stats.average_session_duration =
          totalSessions > 0 ? totalDuration / totalSessions : 0;

        setLoadingState((prev) => ({ ...prev, isLoading: false }));
        return stats;
      } catch (error: any) {
        console.error("Unexpected error fetching workout session stats:", error);
        setLoadingState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || "An unexpected error occurred",
        }));
        return null;
      }
    },
    []
  );

  // ===========================
  // Return Hook Interface
  // ===========================

  return {
    loadingState,
    createWorkoutSession,
    updateWorkoutSession,
    endWorkoutSession,
    deleteWorkoutSession,
    fetchWorkoutSessionById,
    fetchWorkoutSessions,
    fetchActiveWorkoutSession,
    createWorkoutSessionExercise,
    updateWorkoutSessionExercise,
    deleteWorkoutSessionExercise,
    fetchWorkoutSessionExercises,
    createWorkoutSessionSet,
    updateWorkoutSessionSet,
    deleteWorkoutSessionSet,
    fetchWorkoutSessionSets,
    calculateSessionTotals,
    fetchWorkoutSessionStats,
  };
}


import { useState, useCallback } from "react";
import { supabase } from "../utils/supabase";
import {
  UserWorkoutSession,
  UserWorkoutSessionFull,
  UserWorkoutSessionExercise,
  UserWorkoutSessionExerciseWithSets,
  UserWorkoutSessionSet,
  UserWorkoutSessionCreatePayload,
  UserWorkoutSessionUpdatePayload,
  UserWorkoutSessionExerciseUpdatePayload,
  UserWorkoutSessionSetUpdatePayload,
  UserWorkoutSessionFilters,
  UserWorkoutSessionStats,
  UserWorkoutSessionLoadingState,
  UserWorkoutSessionExerciseCreatePayload,
  UserWorkoutSessionSetCreatePayload,
} from "../types/UserWorkoutSession";

// ===========================
// Hook Return Type
// ===========================

interface UseUserWorkoutSessionReturn {
  loadingState: UserWorkoutSessionLoadingState;
  createUserWorkoutSession: (
    payload: UserWorkoutSessionCreatePayload
  ) => Promise<UserWorkoutSession | null>;
  updateUserWorkoutSession: (
    sessionId: string,
    payload: UserWorkoutSessionUpdatePayload
  ) => Promise<UserWorkoutSession | null>;
  endUserWorkoutSession: (sessionId: string) => Promise<UserWorkoutSession | null>;
  deleteUserWorkoutSession: (sessionId: string) => Promise<boolean>;
  fetchUserWorkoutSessionById: (
    sessionId: string
  ) => Promise<UserWorkoutSessionFull | null>;
  fetchUserWorkoutSessions: (
    filters: UserWorkoutSessionFilters
  ) => Promise<UserWorkoutSession[]>;
  fetchActiveUserWorkoutSession: (
    userId: string
  ) => Promise<UserWorkoutSessionFull | null>;
  createUserWorkoutSessionExercise: (
    payload: UserWorkoutSessionExerciseCreatePayload
  ) => Promise<UserWorkoutSessionExercise | null>;
  updateUserWorkoutSessionExercise: (
    exerciseId: string,
    payload: UserWorkoutSessionExerciseUpdatePayload
  ) => Promise<UserWorkoutSessionExercise | null>;
  deleteUserWorkoutSessionExercise: (exerciseId: string) => Promise<boolean>;
  fetchUserWorkoutSessionExercises: (
    sessionId: string
  ) => Promise<UserWorkoutSessionExerciseWithSets[]>;
  createUserWorkoutSessionSet: (
    payload: UserWorkoutSessionSetCreatePayload
  ) => Promise<UserWorkoutSessionSet | null>;
  updateUserWorkoutSessionSet: (
    setId: string,
    payload: UserWorkoutSessionSetUpdatePayload
  ) => Promise<UserWorkoutSessionSet | null>;
  deleteUserWorkoutSessionSet: (setId: string) => Promise<boolean>;
  fetchUserWorkoutSessionSets: (
    sessionExerciseId: string
  ) => Promise<UserWorkoutSessionSet[]>;
  calculateUserWorkoutSessionTotals: (sessionId: string) => Promise<boolean>;
  fetchUserWorkoutSessionStats: (
    userId: string,
    startDate?: string,
    endDate?: string
  ) => Promise<UserWorkoutSessionStats | null>;
}

// ===========================
// Main Hook
// ===========================

export function useUserWorkoutSession(): UseUserWorkoutSessionReturn {
  const [loadingState, setLoadingState] = useState<UserWorkoutSessionLoadingState>({
    isLoading: false,
    isUpdating: false,
    isSaving: false,
    error: null,
  });

  // ===========================
  // Workout Session Operations
  // ===========================

  const createUserWorkoutSession = useCallback(
    async (
      payload: UserWorkoutSessionCreatePayload
    ): Promise<UserWorkoutSession | null> => {
      try {
        setLoadingState((prev) => ({ ...prev, isSaving: true, error: null }));

        const { data, error } = await supabase
          .from("user_workout_sessions")
          .insert([payload])
          .select()
          .single();

        if (error) {
          console.error("Error creating user workout session:", error);
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
        console.error("Unexpected error creating user workout session:", error);
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

  const updateUserWorkoutSession = useCallback(
    async (
      sessionId: string,
      payload: UserWorkoutSessionUpdatePayload
    ): Promise<UserWorkoutSession | null> => {
      try {
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: true,
          error: null,
        }));

        const { data, error } = await supabase
          .from("user_workout_sessions")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", sessionId)
          .select()
          .single();

        if (error) {
          console.error("Error updating user workout session:", error);
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
        console.error("Unexpected error updating user workout session:", error);
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

  const endUserWorkoutSession = useCallback(
    async (sessionId: string): Promise<UserWorkoutSession | null> => {
      try {
        // First, get all exercise IDs for this session
        const { data: exercisesData, error: fetchError } = await supabase
          .from("user_workout_session_exercises")
          .select("id")
          .eq("session_id", sessionId);

        if (fetchError) {
          console.error("Error fetching user exercises to delete:", fetchError);
          return null;
        }

        // Delete all sets for these exercises (must be done first due to foreign key constraints)
        if (exercisesData && exercisesData.length > 0) {
          const exerciseIds = exercisesData.map((ex) => ex.id);
          const { error: setsError } = await supabase
            .from("user_workout_session_sets")
            .delete()
            .in("session_exercise_id", exerciseIds);

          if (setsError) {
            console.error("Error deleting user session sets:", setsError);
          }
        }

        // Then delete all exercises
        const { error: exercisesError } = await supabase
          .from("user_workout_session_exercises")
          .delete()
          .eq("session_id", sessionId);

        if (exercisesError) {
          console.error("Error deleting user session exercises:", exercisesError);
          return null;
        }

        // Finally, delete the session itself
        const { error: sessionError } = await supabase
          .from("user_workout_sessions")
          .delete()
          .eq("id", sessionId);

        if (sessionError) {
          console.error("Error deleting user session:", sessionError);
          return null;
        }

        return { id: sessionId } as UserWorkoutSession;
      } catch (error: any) {
        console.error("Unexpected error ending user workout session:", error);
        return null;
      }
    },
    []
  );

  const deleteUserWorkoutSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: true,
          error: null,
        }));

        const { error } = await supabase
          .from("user_workout_sessions")
          .delete()
          .eq("id", sessionId);

        if (error) {
          console.error("Error deleting user workout session:", error);
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
        console.error("Unexpected error deleting user workout session:", error);
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

  const fetchUserWorkoutSessionById = useCallback(
    async (sessionId: string): Promise<UserWorkoutSessionFull | null> => {
      try {
        setLoadingState((prev) => ({ ...prev, isLoading: true, error: null }));

        const { data: sessionData, error: sessionError } = await supabase
          .from("user_workout_sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (sessionError) {
          console.error("Error fetching user workout session:", sessionError);
          setLoadingState((prev) => ({
            ...prev,
            isLoading: false,
            error: sessionError.message,
          }));
          return null;
        }

        const { data: exercisesData, error: exercisesError } = await supabase
          .from("user_workout_session_exercises")
          .select("*")
          .eq("session_id", sessionId)
          .order("order_in_session", { ascending: true });

        if (exercisesError) {
          console.error("Error fetching user session exercises:", exercisesError);
          setLoadingState((prev) => ({
            ...prev,
            isLoading: false,
            error: exercisesError.message,
          }));
          return null;
        }

        const exercisesWithSets: UserWorkoutSessionExerciseWithSets[] =
          await Promise.all(
            (exercisesData || []).map(async (exercise) => {
              const { data: setsData, error: setsError } = await supabase
                .from("user_workout_session_sets")
                .select("*")
                .eq("session_exercise_id", exercise.id)
                .order("set_number", { ascending: true });

              if (setsError) {
                console.error("Error fetching user sets:", setsError);
              }

              return {
                ...exercise,
                sets: setsData || [],
              };
            })
          );

        const fullSession: UserWorkoutSessionFull = {
          ...sessionData,
          exercises: exercisesWithSets,
        };

        setLoadingState((prev) => ({ ...prev, isLoading: false }));
        return fullSession;
      } catch (error: any) {
        console.error("Unexpected error fetching user workout session:", error);
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

  const fetchUserWorkoutSessions = useCallback(
    async (filters: UserWorkoutSessionFilters): Promise<UserWorkoutSession[]> => {
      try {
        setLoadingState((prev) => ({ ...prev, isLoading: true, error: null }));

        let query = supabase.from("user_workout_sessions").select("*");

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
          console.error("Error fetching user workout sessions:", error);
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
        console.error("Unexpected error fetching user workout sessions:", error);
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

  const fetchActiveUserWorkoutSession = useCallback(
    async (userId: string): Promise<UserWorkoutSessionFull | null> => {
      try {
        setLoadingState((prev) => ({ ...prev, isLoading: true, error: null }));

        const { data, error } = await supabase
          .from("user_workout_sessions")
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
          console.error("Error fetching active user workout session:", error);
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

        const fullSession = await fetchUserWorkoutSessionById(data.id);
        return fullSession;
      } catch (error: any) {
        console.error("Unexpected error fetching active user workout session:", error);
        setLoadingState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || "An unexpected error occurred",
        }));
        return null;
      }
    },
    [fetchUserWorkoutSessionById]
  );

  // ===========================
  // Exercise Operations
  // ===========================

  const createUserWorkoutSessionExercise = useCallback(
    async (
      payload: UserWorkoutSessionExerciseCreatePayload
    ): Promise<UserWorkoutSessionExercise | null> => {
      try {
        setLoadingState((prev) => ({ ...prev, isSaving: true, error: null }));

        let existingExercises = null;
        let checkError = null;

        if (payload.plan_id && payload.plan_position != null) {
          const result = await supabase
            .from("user_workout_session_exercises")
            .select("*")
            .eq("user_id", payload.user_id)
            .eq("plan_id", payload.plan_id)
            .eq("plan_position", payload.plan_position);

          existingExercises = result.data;
          checkError = result.error;
        } else {
          const result = await supabase
            .from("user_workout_session_exercises")
            .select("*")
            .eq("session_id", payload.session_id)
            .eq("exercise_id", payload.exercise_id);

          existingExercises = result.data;
          checkError = result.error;
        }

        if (checkError) {
          console.error("Error checking for existing user exercise:", checkError);
          setLoadingState((prev) => ({
            ...prev,
            isSaving: false,
            error: checkError.message,
          }));
          return null;
        }

        if (existingExercises && existingExercises.length > 0) {
          for (const existing of existingExercises) {
            if (existing.session_id === payload.session_id) {
              setLoadingState((prev) => ({ ...prev, isSaving: false }));
              return existing;
            }
          }

          const exerciseIds = existingExercises.map((ex) => ex.id);

          await supabase
            .from("user_workout_session_sets")
            .delete()
            .in("session_exercise_id", exerciseIds);

          await supabase
            .from("user_workout_session_exercises")
            .delete()
            .in("id", exerciseIds);

          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const { data, error } = await supabase
          .from("user_workout_session_exercises")
          .insert([payload])
          .select()
          .single();

        if (error) {
          console.error("Error creating user workout session exercise:", error);
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
        console.error("Unexpected error creating user workout session exercise:", error);
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

  const updateUserWorkoutSessionExercise = useCallback(
    async (
      exerciseId: string,
      payload: UserWorkoutSessionExerciseUpdatePayload
    ): Promise<UserWorkoutSessionExercise | null> => {
      try {
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: true,
          error: null,
        }));

        const { data, error } = await supabase
          .from("user_workout_session_exercises")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", exerciseId)
          .select()
          .single();

        if (error) {
          console.error("Error updating user workout session exercise:", error);
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
        console.error("Unexpected error updating user workout session exercise:", error);
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

  const deleteUserWorkoutSessionExercise = useCallback(
    async (exerciseId: string): Promise<boolean> => {
      try {
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: true,
          error: null,
        }));

        const { error } = await supabase
          .from("user_workout_session_exercises")
          .delete()
          .eq("id", exerciseId);

        if (error) {
          console.error("Error deleting user workout session exercise:", error);
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
        console.error("Unexpected error deleting user workout session exercise:", error);
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

  const fetchUserWorkoutSessionExercises = useCallback(
    async (sessionId: string): Promise<UserWorkoutSessionExerciseWithSets[]> => {
      try {
        setLoadingState((prev) => ({ ...prev, isLoading: true, error: null }));

        const { data: exercisesData, error: exercisesError } = await supabase
          .from("user_workout_session_exercises")
          .select("*")
          .eq("session_id", sessionId)
          .order("order_in_session", { ascending: true });

        if (exercisesError) {
          console.error("Error fetching user workout session exercises:", exercisesError);
          setLoadingState((prev) => ({
            ...prev,
            isLoading: false,
            error: exercisesError.message,
          }));
          return [];
        }

        const exercisesWithSets: UserWorkoutSessionExerciseWithSets[] =
          await Promise.all(
            (exercisesData || []).map(async (exercise) => {
              const { data: setsData, error: setsError } = await supabase
                .from("user_workout_session_sets")
                .select("*")
                .eq("session_exercise_id", exercise.id)
                .order("set_number", { ascending: true });

              if (setsError) {
                console.error("Error fetching user sets:", setsError);
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
        console.error("Unexpected error fetching user workout session exercises:", error);
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

  const createUserWorkoutSessionSet = useCallback(
    async (
      payload: UserWorkoutSessionSetCreatePayload
    ): Promise<UserWorkoutSessionSet | null> => {
      try {
        setLoadingState((prev) => ({ ...prev, isSaving: true, error: null }));

        const { data, error } = await supabase
          .from("user_workout_session_sets")
          .insert([payload])
          .select()
          .single();

        if (error) {
          console.error("Error creating user workout session set:", error);
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
        console.error("Unexpected error creating user workout session set:", error);
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

  const updateUserWorkoutSessionSet = useCallback(
    async (
      setId: string,
      payload: UserWorkoutSessionSetUpdatePayload
    ): Promise<UserWorkoutSessionSet | null> => {
      try {
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: true,
          error: null,
        }));

        const { data, error } = await supabase
          .from("user_workout_session_sets")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", setId)
          .select()
          .single();

        if (error) {
          console.error("Error updating user workout session set:", error);
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
        console.error("Unexpected error updating user workout session set:", error);
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

  const deleteUserWorkoutSessionSet = useCallback(
    async (setId: string): Promise<boolean> => {
      try {
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: true,
          error: null,
        }));

        const { error } = await supabase
          .from("user_workout_session_sets")
          .delete()
          .eq("id", setId);

        if (error) {
          console.error("Error deleting user workout session set:", error);
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
        console.error("Unexpected error deleting user workout session set:", error);
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

  const fetchUserWorkoutSessionSets = useCallback(
    async (sessionExerciseId: string): Promise<UserWorkoutSessionSet[]> => {
      try {
        setLoadingState((prev) => ({ ...prev, isLoading: true, error: null }));

        const { data, error } = await supabase
          .from("user_workout_session_sets")
          .select("*")
          .eq("session_exercise_id", sessionExerciseId)
          .order("set_number", { ascending: true });

        if (error) {
          console.error("Error fetching user workout session sets:", error);
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
        console.error("Unexpected error fetching user workout session sets:", error);
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

  const calculateUserWorkoutSessionTotals = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: true,
          error: null,
        }));

        const exercises = await fetchUserWorkoutSessionExercises(sessionId);

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
          .from("user_workout_sessions")
          .update({
            total_sets: totalSets,
            total_reps: totalReps,
            total_duration_seconds: totalDurationSeconds,
            total_rest_seconds: totalRestSeconds,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId);

        if (error) {
          console.error("Error calculating user session totals:", error);
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
        console.error("Unexpected error calculating user session totals:", error);
        setLoadingState((prev) => ({
          ...prev,
          isUpdating: false,
          error: error.message || "An unexpected error occurred",
        }));
        return false;
      }
    },
    [fetchUserWorkoutSessionExercises]
  );

  const fetchUserWorkoutSessionStats = useCallback(
    async (
      userId: string,
      startDate?: string,
      endDate?: string
    ): Promise<UserWorkoutSessionStats | null> => {
      try {
        setLoadingState((prev) => ({ ...prev, isLoading: true, error: null }));

        let query = supabase
          .from("user_workout_sessions")
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
          console.error("Error fetching user workout session stats:", error);
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

        const stats: UserWorkoutSessionStats = {
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
          .from("user_workout_session_exercises")
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
        console.error("Unexpected error fetching user workout session stats:", error);
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
    createUserWorkoutSession,
    updateUserWorkoutSession,
    endUserWorkoutSession,
    deleteUserWorkoutSession,
    fetchUserWorkoutSessionById,
    fetchUserWorkoutSessions,
    fetchActiveUserWorkoutSession,
    createUserWorkoutSessionExercise,
    updateUserWorkoutSessionExercise,
    deleteUserWorkoutSessionExercise,
    fetchUserWorkoutSessionExercises,
    createUserWorkoutSessionSet,
    updateUserWorkoutSessionSet,
    deleteUserWorkoutSessionSet,
    fetchUserWorkoutSessionSets,
    calculateUserWorkoutSessionTotals,
    fetchUserWorkoutSessionStats,
  };
}


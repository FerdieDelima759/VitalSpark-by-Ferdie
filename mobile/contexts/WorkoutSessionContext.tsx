import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import {
  WorkoutSession,
  WorkoutSessionFull,
  WorkoutSessionLoadingState,
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
} from "../types/WorkoutSession";
import { supabase } from "../utils/supabase";
import { useWorkoutSession } from "../hooks/useWorkoutSession";

// ===========================
// Context Type Definition
// ===========================

interface WorkoutSessionContextType {
  workoutSessions: WorkoutSession[];
  currentWorkoutSession: WorkoutSessionFull | null;
  activeWorkoutSession: WorkoutSessionFull | null;
  loadingState: WorkoutSessionLoadingState;
  setWorkoutSessions: (sessions: WorkoutSession[]) => void;
  setCurrentWorkoutSession: (session: WorkoutSessionFull | null) => void;
  setActiveWorkoutSession: (session: WorkoutSessionFull | null) => void;
  startNewWorkoutSession: (
    payload: WorkoutSessionCreatePayload
  ) => Promise<WorkoutSessionFull | null>;
  endActiveWorkoutSession: () => Promise<boolean>;
  updateActiveWorkoutSession: (
    payload: WorkoutSessionUpdatePayload
  ) => Promise<boolean>;
  addExerciseToSession: (
    sessionId: string,
    payload: WorkoutSessionExerciseCreatePayload
  ) => Promise<WorkoutSessionExercise | null>;
  updateSessionExercise: (
    exerciseId: string,
    payload: WorkoutSessionExerciseUpdatePayload
  ) => Promise<boolean>;
  removeExerciseFromSession: (exerciseId: string) => Promise<boolean>;
  addSetToExercise: (
    payload: WorkoutSessionSetCreatePayload
  ) => Promise<WorkoutSessionSet | null>;
  updateExerciseSet: (
    setId: string,
    payload: WorkoutSessionSetUpdatePayload
  ) => Promise<boolean>;
  removeSetFromExercise: (setId: string) => Promise<boolean>;
  refreshCurrentSession: (sessionId: string) => Promise<void>;
  refreshActiveSession: (userId: string) => Promise<void>;
  refreshWorkoutSessions: (filters: WorkoutSessionFilters) => Promise<void>;
  fetchSessionStats: (
    userId: string,
    startDate?: string,
    endDate?: string
  ) => Promise<WorkoutSessionStats | null>;
  clearWorkoutSessionData: () => void;
}

// ===========================
// Context Creation
// ===========================

const WorkoutSessionContext = createContext<
  WorkoutSessionContextType | undefined
>(undefined);

// ===========================
// Provider Props
// ===========================

interface WorkoutSessionProviderProps {
  children: ReactNode;
}

// ===========================
// Provider Component
// ===========================

export function WorkoutSessionProvider({
  children,
}: WorkoutSessionProviderProps): React.ReactElement {
  const [workoutSessions, setWorkoutSessions] = useState<WorkoutSession[]>([]);
  const [currentWorkoutSession, setCurrentWorkoutSession] =
    useState<WorkoutSessionFull | null>(null);
  const [activeWorkoutSession, setActiveWorkoutSession] =
    useState<WorkoutSessionFull | null>(null);

  const workoutSessionHook = useWorkoutSession();

  const startNewWorkoutSession = useCallback(
    async (
      payload: WorkoutSessionCreatePayload
    ): Promise<WorkoutSessionFull | null> => {
      const session = await workoutSessionHook.createWorkoutSession(payload);
      if (session) {
        const fullSession = await workoutSessionHook.fetchWorkoutSessionById(
          session.id
        );
        if (fullSession) {
          setActiveWorkoutSession(fullSession);
          setCurrentWorkoutSession(fullSession);
        }
        return fullSession;
      }
      return null;
    },
    [workoutSessionHook]
  );

  const endActiveWorkoutSession = useCallback(async (): Promise<boolean> => {
    if (!activeWorkoutSession) {
      return false;
    }
    const deletedSession = await workoutSessionHook.endWorkoutSession(
      activeWorkoutSession.id
    );
    if (deletedSession) {
      // Session is deleted, so clear all references
      setActiveWorkoutSession(null);
      if (currentWorkoutSession?.id === activeWorkoutSession.id) {
        setCurrentWorkoutSession(null);
      }
      return true;
    }
    return false;
  }, [activeWorkoutSession, currentWorkoutSession, workoutSessionHook]);

  const updateActiveWorkoutSession = useCallback(
    async (payload: WorkoutSessionUpdatePayload): Promise<boolean> => {
      if (!activeWorkoutSession) {
        return false;
      }
      const updatedSession = await workoutSessionHook.updateWorkoutSession(
        activeWorkoutSession.id,
        payload
      );
      if (updatedSession) {
        const refreshed = await workoutSessionHook.fetchWorkoutSessionById(
          activeWorkoutSession.id
        );
        if (refreshed) {
          setActiveWorkoutSession(refreshed);
          if (currentWorkoutSession?.id === activeWorkoutSession.id) {
            setCurrentWorkoutSession(refreshed);
          }
        }
        return true;
      }
      return false;
    },
    [activeWorkoutSession, currentWorkoutSession, workoutSessionHook]
  );

  const addExerciseToSession = useCallback(
    async (
      sessionId: string,
      payload: WorkoutSessionExerciseCreatePayload
    ): Promise<WorkoutSessionExercise | null> => {
      const exercise =
        await workoutSessionHook.createWorkoutSessionExercise(payload);
      // Note: Session state is managed locally in exercise-session.tsx
      // Removed expensive fetchWorkoutSessionById refresh for performance
      return exercise;
    },
    [workoutSessionHook]
  );

  const updateSessionExercise = useCallback(
    async (
      exerciseId: string,
      payload: WorkoutSessionExerciseUpdatePayload
    ): Promise<boolean> => {
      const updatedExercise =
        await workoutSessionHook.updateWorkoutSessionExercise(
          exerciseId,
          payload
        );
      // Note: Session state is managed locally in exercise-session.tsx
      // Removed expensive fetchWorkoutSessionById refresh for performance
      if (updatedExercise) {
        return true;
      }
      return false;
    },
    [workoutSessionHook]
  );

  const removeExerciseFromSession = useCallback(
    async (exerciseId: string): Promise<boolean> => {
      const success =
        await workoutSessionHook.deleteWorkoutSessionExercise(exerciseId);
      // Note: Session state is managed locally in exercise-session.tsx
      // Removed expensive fetchWorkoutSessionById refresh for performance
      return success;
    },
    [workoutSessionHook]
  );

  const addSetToExercise = useCallback(
    async (
      payload: WorkoutSessionSetCreatePayload
    ): Promise<WorkoutSessionSet | null> => {
      const set = await workoutSessionHook.createWorkoutSessionSet(payload);
      // Note: Session state is managed locally in exercise-session.tsx
      // Removed expensive fetchWorkoutSessionById refresh for performance
      return set;
    },
    [workoutSessionHook]
  );

  const updateExerciseSet = useCallback(
    async (
      setId: string,
      payload: WorkoutSessionSetUpdatePayload
    ): Promise<boolean> => {
      const updatedSet = await workoutSessionHook.updateWorkoutSessionSet(
        setId,
        payload
      );
      // Note: Session state is managed locally in exercise-session.tsx
      // Removed expensive fetchWorkoutSessionById refresh for performance
      if (updatedSet) {
        return true;
      }
      return false;
    },
    [workoutSessionHook]
  );

  const removeSetFromExercise = useCallback(
    async (setId: string): Promise<boolean> => {
      const success = await workoutSessionHook.deleteWorkoutSessionSet(setId);
      // Note: Session state is managed locally in exercise-session.tsx
      // Removed expensive fetchWorkoutSessionById refresh for performance
      return success;
    },
    [workoutSessionHook]
  );

  const refreshCurrentSession = useCallback(
    async (sessionId: string): Promise<void> => {
      const refreshed =
        await workoutSessionHook.fetchWorkoutSessionById(sessionId);
      if (refreshed) {
        setCurrentWorkoutSession(refreshed);
        if (activeWorkoutSession?.id === sessionId) {
          setActiveWorkoutSession(refreshed);
        }
      }
    },
    [activeWorkoutSession, workoutSessionHook]
  );

  const refreshActiveSession = useCallback(
    async (userId: string): Promise<void> => {
      const activeSession =
        await workoutSessionHook.fetchActiveWorkoutSession(userId);
      setActiveWorkoutSession(activeSession);
      if (activeSession && currentWorkoutSession?.id === activeSession.id) {
        setCurrentWorkoutSession(activeSession);
      }
    },
    [currentWorkoutSession, workoutSessionHook]
  );

  const refreshWorkoutSessions = useCallback(
    async (filters: WorkoutSessionFilters): Promise<void> => {
      const sessions = await workoutSessionHook.fetchWorkoutSessions(filters);
      setWorkoutSessions(sessions);
    },
    [workoutSessionHook]
  );

  const fetchSessionStats = useCallback(
    async (
      userId: string,
      startDate?: string,
      endDate?: string
    ): Promise<WorkoutSessionStats | null> => {
      return await workoutSessionHook.fetchWorkoutSessionStats(
        userId,
        startDate,
        endDate
      );
    },
    [workoutSessionHook]
  );

  const clearWorkoutSessionData = useCallback((): void => {
    setWorkoutSessions([]);
    setCurrentWorkoutSession(null);
    setActiveWorkoutSession(null);
  }, []);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          await refreshWorkoutSessions({ userId: session.user.id });
          await refreshActiveSession(session.user.id);
        } else if (event === "SIGNED_OUT") {
          clearWorkoutSessionData();
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [refreshWorkoutSessions, refreshActiveSession, clearWorkoutSessionData]);

  const contextValue: WorkoutSessionContextType = {
    workoutSessions,
    currentWorkoutSession,
    activeWorkoutSession,
    loadingState: workoutSessionHook.loadingState,
    setWorkoutSessions,
    setCurrentWorkoutSession,
    setActiveWorkoutSession,
    startNewWorkoutSession,
    endActiveWorkoutSession,
    updateActiveWorkoutSession,
    addExerciseToSession,
    updateSessionExercise,
    removeExerciseFromSession,
    addSetToExercise,
    updateExerciseSet,
    removeSetFromExercise,
    refreshCurrentSession,
    refreshActiveSession,
    refreshWorkoutSessions,
    fetchSessionStats,
    clearWorkoutSessionData,
  };

  return (
    <WorkoutSessionContext.Provider value={contextValue}>
      {children}
    </WorkoutSessionContext.Provider>
  );
}

// ===========================
// Custom Hook
// ===========================

export function useWorkoutSessionContext(): WorkoutSessionContextType {
  const context = useContext(WorkoutSessionContext);
  if (context === undefined) {
    throw new Error(
      "useWorkoutSessionContext must be used within a WorkoutSessionProvider"
    );
  }
  return context;
}

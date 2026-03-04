import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import {
  UserWorkoutSession,
  UserWorkoutSessionFull,
  UserWorkoutSessionLoadingState,
  UserWorkoutSessionExercise,
  UserWorkoutSessionExerciseWithSets,
  UserWorkoutSessionSet,
  UserWorkoutSessionCreatePayload,
  UserWorkoutSessionUpdatePayload,
  UserWorkoutSessionExerciseUpdatePayload,
  UserWorkoutSessionSetUpdatePayload,
  UserWorkoutSessionFilters,
  UserWorkoutSessionStats,
  UserWorkoutSessionExerciseCreatePayload,
  UserWorkoutSessionSetCreatePayload,
} from "../types/UserWorkoutSession";
import { supabase } from "../utils/supabase";
import { useUserWorkoutSession } from "../hooks/useUserWorkoutSession";
import { WorkoutSessionStats } from "@/types/WorkoutSession";

// ===========================
// Context Type Definition
// ===========================

interface UserWorkoutSessionContextType {
  userWorkoutSessions: UserWorkoutSession[];
  currentUserWorkoutSession: UserWorkoutSessionFull | null;
  activeUserWorkoutSession: UserWorkoutSessionFull | null;
  loadingState: UserWorkoutSessionLoadingState;
  setUserWorkoutSessions: (sessions: UserWorkoutSession[]) => void;
  setCurrentUserWorkoutSession: (
    session: UserWorkoutSessionFull | null
  ) => void;
  setActiveUserWorkoutSession: (session: UserWorkoutSessionFull | null) => void;
  startNewUserWorkoutSession: (
    payload: UserWorkoutSessionCreatePayload
  ) => Promise<UserWorkoutSessionFull | null>;
  endActiveUserWorkoutSession: () => Promise<boolean>;
  updateActiveUserWorkoutSession: (
    payload: UserWorkoutSessionUpdatePayload
  ) => Promise<boolean>;
  addExerciseToSession: (
    sessionId: string,
    payload: UserWorkoutSessionExerciseCreatePayload
  ) => Promise<UserWorkoutSessionExercise | null>;
  updateSessionExercise: (
    exerciseId: string,
    payload: UserWorkoutSessionExerciseUpdatePayload
  ) => Promise<boolean>;
  removeExerciseFromSession: (exerciseId: string) => Promise<boolean>;
  addSetToExercise: (
    payload: UserWorkoutSessionSetCreatePayload
  ) => Promise<UserWorkoutSessionSet | null>;
  updateExerciseSet: (
    setId: string,
    payload: UserWorkoutSessionSetUpdatePayload
  ) => Promise<boolean>;
  removeSetFromExercise: (setId: string) => Promise<boolean>;
  refreshCurrentSession: (sessionId: string) => Promise<void>;
  refreshActiveSession: (userId: string) => Promise<void>;
  refreshUserWorkoutSessions: (
    filters: UserWorkoutSessionFilters
  ) => Promise<void>;
  fetchSessionStats: (
    userId: string,
    startDate?: string,
    endDate?: string
  ) => Promise<UserWorkoutSessionStats | null>;
  clearUserWorkoutSessionData: () => void;
}

// ===========================
// Context Creation
// ===========================

const UserWorkoutSessionContext = createContext<
  UserWorkoutSessionContextType | undefined
>(undefined);

// ===========================
// Provider Props
// ===========================

interface UserWorkoutSessionProviderProps {
  children: ReactNode;
}

// ===========================
// Provider Component
// ===========================

export function UserWorkoutSessionProvider({
  children,
}: UserWorkoutSessionProviderProps): React.ReactElement {
  const [userWorkoutSessions, setUserWorkoutSessions] = useState<
    UserWorkoutSession[]
  >([]);
  const [currentUserWorkoutSession, setCurrentUserWorkoutSession] =
    useState<UserWorkoutSessionFull | null>(null);
  const [activeUserWorkoutSession, setActiveUserWorkoutSession] =
    useState<UserWorkoutSessionFull | null>(null);

  const userWorkoutSessionHook = useUserWorkoutSession();

  const startNewUserWorkoutSession = useCallback(
    async (
      payload: UserWorkoutSessionCreatePayload
    ): Promise<UserWorkoutSessionFull | null> => {
      const session =
        await userWorkoutSessionHook.createUserWorkoutSession(payload);
      if (session) {
        const fullSession =
          await userWorkoutSessionHook.fetchUserWorkoutSessionById(session.id);
        if (fullSession) {
          setActiveUserWorkoutSession(fullSession);
          setCurrentUserWorkoutSession(fullSession);
        }
        return fullSession;
      }
      return null;
    },
    [userWorkoutSessionHook]
  );

  const endActiveUserWorkoutSession =
    useCallback(async (): Promise<boolean> => {
      if (!activeUserWorkoutSession) {
        return false;
      }
      const deletedSession = await userWorkoutSessionHook.endUserWorkoutSession(
        activeUserWorkoutSession.id
      );
      if (deletedSession) {
        // Session is deleted, so clear all references
        setActiveUserWorkoutSession(null);
        if (currentUserWorkoutSession?.id === activeUserWorkoutSession.id) {
          setCurrentUserWorkoutSession(null);
        }
        return true;
      }
      return false;
    }, [
      activeUserWorkoutSession,
      currentUserWorkoutSession,
      userWorkoutSessionHook,
    ]);

  const updateActiveUserWorkoutSession = useCallback(
    async (payload: UserWorkoutSessionUpdatePayload): Promise<boolean> => {
      if (!activeUserWorkoutSession) {
        return false;
      }
      const updatedSession =
        await userWorkoutSessionHook.updateUserWorkoutSession(
          activeUserWorkoutSession.id,
          payload
        );
      if (updatedSession) {
        const refreshed =
          await userWorkoutSessionHook.fetchUserWorkoutSessionById(
            activeUserWorkoutSession.id
          );
        if (refreshed) {
          setActiveUserWorkoutSession(refreshed);
          if (currentUserWorkoutSession?.id === activeUserWorkoutSession.id) {
            setCurrentUserWorkoutSession(refreshed);
          }
        }
        return true;
      }
      return false;
    },
    [
      activeUserWorkoutSession,
      currentUserWorkoutSession,
      userWorkoutSessionHook,
    ]
  );

  const addExerciseToSession = useCallback(
    async (
      sessionId: string,
      payload: UserWorkoutSessionExerciseCreatePayload
    ): Promise<UserWorkoutSessionExercise | null> => {
      const exercise =
        await userWorkoutSessionHook.createUserWorkoutSessionExercise(payload);
      if (exercise) {
        if (activeUserWorkoutSession?.id === sessionId) {
          const refreshed =
            await userWorkoutSessionHook.fetchUserWorkoutSessionById(sessionId);
          if (refreshed) {
            setActiveUserWorkoutSession(refreshed);
          }
        }
        if (currentUserWorkoutSession?.id === sessionId) {
          const refreshed =
            await userWorkoutSessionHook.fetchUserWorkoutSessionById(sessionId);
          if (refreshed) {
            setCurrentUserWorkoutSession(refreshed);
          }
        }
      }
      return exercise;
    },
    [
      activeUserWorkoutSession,
      currentUserWorkoutSession,
      userWorkoutSessionHook,
    ]
  );

  const updateSessionExercise = useCallback(
    async (
      exerciseId: string,
      payload: UserWorkoutSessionExerciseUpdatePayload
    ): Promise<boolean> => {
      const updatedExercise =
        await userWorkoutSessionHook.updateUserWorkoutSessionExercise(
          exerciseId,
          payload
        );
      if (updatedExercise) {
        const sessionId =
          activeUserWorkoutSession?.id || currentUserWorkoutSession?.id;
        if (sessionId) {
          const refreshed =
            await userWorkoutSessionHook.fetchUserWorkoutSessionById(sessionId);
          if (refreshed) {
            if (activeUserWorkoutSession?.id === sessionId) {
              setActiveUserWorkoutSession(refreshed);
            }
            if (currentUserWorkoutSession?.id === sessionId) {
              setCurrentUserWorkoutSession(refreshed);
            }
          }
        }
        return true;
      }
      return false;
    },
    [
      activeUserWorkoutSession,
      currentUserWorkoutSession,
      userWorkoutSessionHook,
    ]
  );

  const removeExerciseFromSession = useCallback(
    async (exerciseId: string): Promise<boolean> => {
      const success =
        await userWorkoutSessionHook.deleteUserWorkoutSessionExercise(
          exerciseId
        );
      if (success) {
        const sessionId =
          activeUserWorkoutSession?.id || currentUserWorkoutSession?.id;
        if (sessionId) {
          const refreshed =
            await userWorkoutSessionHook.fetchUserWorkoutSessionById(sessionId);
          if (refreshed) {
            if (activeUserWorkoutSession?.id === sessionId) {
              setActiveUserWorkoutSession(refreshed);
            }
            if (currentUserWorkoutSession?.id === sessionId) {
              setCurrentUserWorkoutSession(refreshed);
            }
          }
        }
      }
      return success;
    },
    [
      activeUserWorkoutSession,
      currentUserWorkoutSession,
      userWorkoutSessionHook,
    ]
  );

  const addSetToExercise = useCallback(
    async (
      payload: UserWorkoutSessionSetCreatePayload
    ): Promise<UserWorkoutSessionSet | null> => {
      const set =
        await userWorkoutSessionHook.createUserWorkoutSessionSet(payload);
      if (set) {
        const sessionId =
          activeUserWorkoutSession?.id || currentUserWorkoutSession?.id;
        if (sessionId) {
          const refreshed =
            await userWorkoutSessionHook.fetchUserWorkoutSessionById(sessionId);
          if (refreshed) {
            if (activeUserWorkoutSession?.id === sessionId) {
              setActiveUserWorkoutSession(refreshed);
            }
            if (currentUserWorkoutSession?.id === sessionId) {
              setCurrentUserWorkoutSession(refreshed);
            }
          }
        }
      }
      return set;
    },
    [
      activeUserWorkoutSession,
      currentUserWorkoutSession,
      userWorkoutSessionHook,
    ]
  );

  const updateExerciseSet = useCallback(
    async (
      setId: string,
      payload: UserWorkoutSessionSetUpdatePayload
    ): Promise<boolean> => {
      const updatedSet =
        await userWorkoutSessionHook.updateUserWorkoutSessionSet(
          setId,
          payload
        );
      if (updatedSet) {
        const sessionId =
          activeUserWorkoutSession?.id || currentUserWorkoutSession?.id;
        if (sessionId) {
          const refreshed =
            await userWorkoutSessionHook.fetchUserWorkoutSessionById(sessionId);
          if (refreshed) {
            if (activeUserWorkoutSession?.id === sessionId) {
              setActiveUserWorkoutSession(refreshed);
            }
            if (currentUserWorkoutSession?.id === sessionId) {
              setCurrentUserWorkoutSession(refreshed);
            }
          }
        }
        return true;
      }
      return false;
    },
    [
      activeUserWorkoutSession,
      currentUserWorkoutSession,
      userWorkoutSessionHook,
    ]
  );

  const removeSetFromExercise = useCallback(
    async (setId: string): Promise<boolean> => {
      const success =
        await userWorkoutSessionHook.deleteUserWorkoutSessionSet(setId);
      if (success) {
        const sessionId =
          activeUserWorkoutSession?.id || currentUserWorkoutSession?.id;
        if (sessionId) {
          const refreshed =
            await userWorkoutSessionHook.fetchUserWorkoutSessionById(sessionId);
          if (refreshed) {
            if (activeUserWorkoutSession?.id === sessionId) {
              setActiveUserWorkoutSession(refreshed);
            }
            if (currentUserWorkoutSession?.id === sessionId) {
              setCurrentUserWorkoutSession(refreshed);
            }
          }
        }
      }
      return success;
    },
    [
      activeUserWorkoutSession,
      currentUserWorkoutSession,
      userWorkoutSessionHook,
    ]
  );

  const refreshCurrentSession = useCallback(
    async (sessionId: string): Promise<void> => {
      const refreshed =
        await userWorkoutSessionHook.fetchUserWorkoutSessionById(sessionId);
      if (refreshed) {
        setCurrentUserWorkoutSession(refreshed);
        if (activeUserWorkoutSession?.id === sessionId) {
          setActiveUserWorkoutSession(refreshed);
        }
      }
    },
    [activeUserWorkoutSession, userWorkoutSessionHook]
  );

  const refreshActiveSession = useCallback(
    async (userId: string): Promise<void> => {
      const activeSession =
        await userWorkoutSessionHook.fetchActiveUserWorkoutSession(userId);
      setActiveUserWorkoutSession(activeSession);
      if (activeSession && currentUserWorkoutSession?.id === activeSession.id) {
        setCurrentUserWorkoutSession(activeSession);
      }
    },
    [currentUserWorkoutSession, userWorkoutSessionHook]
  );

  const refreshUserWorkoutSessionsHook = useCallback(
    async (filters: UserWorkoutSessionFilters): Promise<void> => {
      const sessions =
        await userWorkoutSessionHook.fetchUserWorkoutSessions(filters);
      setUserWorkoutSessions(sessions);
    },
    [userWorkoutSessionHook]
  );

  const fetchSessionStats = useCallback(
    async (
      userId: string,
      startDate?: string,
      endDate?: string
    ): Promise<WorkoutSessionStats | null> => {
      return await userWorkoutSessionHook.fetchUserWorkoutSessionStats(
        userId,
        startDate,
        endDate
      );
    },
    [userWorkoutSessionHook]
  );

  const clearUserWorkoutSessionDataHook = useCallback((): void => {
    setUserWorkoutSessions([]);
    setCurrentUserWorkoutSession(null);
    setActiveUserWorkoutSession(null);
  }, []);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          await refreshUserWorkoutSessionsHook({ userId: session.user.id });
          await refreshActiveSession(session.user.id);
        } else if (event === "SIGNED_OUT") {
          clearUserWorkoutSessionDataHook();
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [
    refreshUserWorkoutSessionsHook,
    refreshActiveSession,
    clearUserWorkoutSessionDataHook,
  ]);

  const contextValue: UserWorkoutSessionContextType = {
    userWorkoutSessions,
    currentUserWorkoutSession,
    activeUserWorkoutSession,
    loadingState: userWorkoutSessionHook.loadingState,
    setUserWorkoutSessions,
    setCurrentUserWorkoutSession,
    setActiveUserWorkoutSession,
    startNewUserWorkoutSession,
    endActiveUserWorkoutSession,
    updateActiveUserWorkoutSession,
    addExerciseToSession,
    updateSessionExercise,
    removeExerciseFromSession,
    addSetToExercise,
    updateExerciseSet,
    removeSetFromExercise,
    refreshCurrentSession,
    refreshActiveSession,
    refreshUserWorkoutSessions: refreshUserWorkoutSessionsHook,
    fetchSessionStats,
    clearUserWorkoutSessionData: clearUserWorkoutSessionDataHook,
  };

  return (
    <UserWorkoutSessionContext.Provider value={contextValue}>
      {children}
    </UserWorkoutSessionContext.Provider>
  );
}

// ===========================
// Custom Hook
// ===========================

export function useUserWorkoutSessionContext(): UserWorkoutSessionContextType {
  const context = useContext(UserWorkoutSessionContext);
  if (context === undefined) {
    throw new Error(
      "useUserWorkoutSessionContext must be used within a UserWorkoutSessionProvider"
    );
  }
  return context;
}

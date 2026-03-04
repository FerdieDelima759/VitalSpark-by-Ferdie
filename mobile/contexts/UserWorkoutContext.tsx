import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import {
  UserWorkoutPlan,
  UserWorkoutPlanFull,
  UserWorkoutLoadingState,
} from "../types/UserWorkout";
import { supabase } from "../utils/supabase";

// ===========================
// Context Type Definition
// ===========================

interface UserWorkoutContextType {
  userWorkoutPlans: UserWorkoutPlan[];
  currentUserWorkoutPlan: UserWorkoutPlanFull | null;
  loadingState: UserWorkoutLoadingState;
  setUserWorkoutPlans: (plans: UserWorkoutPlan[]) => void;
  setCurrentUserWorkoutPlan: (plan: UserWorkoutPlanFull | null) => void;
  refreshUserWorkoutPlans: (userId: string) => Promise<void>;
  clearUserWorkoutData: () => void;
}

// ===========================
// Context Creation
// ===========================

const UserWorkoutContext = createContext<UserWorkoutContextType | undefined>(
  undefined
);

// ===========================
// Provider Props
// ===========================

interface UserWorkoutProviderProps {
  children: ReactNode;
}

// ===========================
// Provider Component
// ===========================

export function UserWorkoutProvider({
  children,
}: UserWorkoutProviderProps): React.ReactElement {
  const [userWorkoutPlans, setUserWorkoutPlans] = useState<UserWorkoutPlan[]>(
    []
  );
  const [currentUserWorkoutPlan, setCurrentUserWorkoutPlan] =
    useState<UserWorkoutPlanFull | null>(null);
  const [loadingState, setLoadingState] = useState<UserWorkoutLoadingState>({
    isLoading: false,
    isUpdating: false,
    isSaving: false,
    error: null,
  });

  const fetchUserWorkoutPlans = useCallback(
    async (userId: string): Promise<void> => {
      if (!userId) {
        return;
      }
      try {
        setLoadingState((prev) => ({ ...prev, isLoading: true, error: null }));

        const { data, error } = await supabase
          .from("user_workout_plans")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching user workout plans:", error);
          setLoadingState((prev) => ({
            ...prev,
            isLoading: false,
            error: error.message,
          }));
          return;
        }

        setUserWorkoutPlans(data || []);
        setLoadingState({
          isLoading: false,
          isUpdating: false,
          isSaving: false,
          error: null,
        });
      } catch (error: any) {
        console.error("Unexpected error fetching user workout plans:", error);
        setLoadingState({
          isLoading: false,
          isUpdating: false,
          isSaving: false,
          error: error.message || "An unexpected error occurred",
        });
      }
    },
    []
  );

  const refreshUserWorkoutPlans = useCallback(
    async (userId: string): Promise<void> => {
      await fetchUserWorkoutPlans(userId);
    },
    [fetchUserWorkoutPlans]
  );

  const clearUserWorkoutData = useCallback((): void => {
    setUserWorkoutPlans([]);
    setCurrentUserWorkoutPlan(null);
    setLoadingState({
      isLoading: false,
      isUpdating: false,
      isSaving: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          await fetchUserWorkoutPlans(session.user.id);
        } else if (event === "SIGNED_OUT") {
          clearUserWorkoutData();
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchUserWorkoutPlans, clearUserWorkoutData]);

  const contextValue: UserWorkoutContextType = {
    userWorkoutPlans,
    currentUserWorkoutPlan,
    loadingState,
    setUserWorkoutPlans,
    setCurrentUserWorkoutPlan,
    refreshUserWorkoutPlans,
    clearUserWorkoutData,
  };

  return (
    <UserWorkoutContext.Provider value={contextValue}>
      {children}
    </UserWorkoutContext.Provider>
  );
}

// ===========================
// Custom Hook
// ===========================

export function useUserWorkoutContext(): UserWorkoutContextType {
  const context = useContext(UserWorkoutContext);
  if (context === undefined) {
    throw new Error(
      "useUserWorkoutContext must be used within a UserWorkoutProvider"
    );
  }
  return context;
}


"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  UserExerciseDetails,
  CreateUserExerciseDetailsPayload,
  UserWorkoutDataResponse,
  ExerciseSection,
} from "../types/UserWorkout";
import { useUserWorkoutData } from "../hooks/useUserWorkoutData";

// ===========================
// Context Type Definition
// ===========================

export interface ExercisesLoadingState {
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

interface UserExercisesContextType {
  // State
  exerciseDetails: UserExerciseDetails[];
  loadingState: ExercisesLoadingState;

  // Actions
  saveExerciseDetails: (
    payload: CreateUserExerciseDetailsPayload,
  ) => Promise<UserWorkoutDataResponse<UserExerciseDetails>>;
  saveExerciseDetailsBatch: (
    payloads: CreateUserExerciseDetailsPayload[],
  ) => Promise<UserWorkoutDataResponse<UserExerciseDetails[]>>;
  clearExerciseDetails: () => void;
  setExerciseDetails: (details: UserExerciseDetails[]) => void;

  // Helpers
  generateImageSlug: (section: ExerciseSection, name: string) => string;
}

// ===========================
// Context Creation
// ===========================

const UserExercisesContext = createContext<
  UserExercisesContextType | undefined
>(undefined);

// ===========================
// Provider Props
// ===========================

interface UserExercisesProviderProps {
  children: ReactNode;
}

// ===========================
// Provider Component
// ===========================

export function UserExercisesProvider({
  children,
}: UserExercisesProviderProps): React.ReactElement {
  const {
    createUserExerciseDetails,
    createUserExerciseDetailsBatch,
    generateImageSlug,
    isLoading: hookIsLoading,
    error: hookError,
  } = useUserWorkoutData();

  const [exerciseDetails, setExerciseDetails] = useState<UserExerciseDetails[]>(
    [],
  );
  const [loadingState, setLoadingState] = useState<ExercisesLoadingState>({
    isLoading: false,
    isSaving: false,
    error: null,
  });

  // ===========================
  // Save Single Exercise Detail
  // ===========================

  const saveExerciseDetails = useCallback(
    async (
      payload: CreateUserExerciseDetailsPayload,
    ): Promise<UserWorkoutDataResponse<UserExerciseDetails>> => {
      try {
        setLoadingState((prev) => ({ ...prev, isSaving: true, error: null }));

        const result = await createUserExerciseDetails(payload);

        if (result.success && result.data) {
          // Add to local state
          setExerciseDetails((prev) => [...prev, result.data!]);
        } else {
          setLoadingState((prev) => ({
            ...prev,
            error: result.error || "Failed to save exercise details",
          }));
        }

        return result;
      } catch (error: any) {
        const errorMsg = error?.message || "An unexpected error occurred";
        setLoadingState((prev) => ({ ...prev, error: errorMsg }));
        return { success: false, error: errorMsg };
      } finally {
        setLoadingState((prev) => ({ ...prev, isSaving: false }));
      }
    },
    [createUserExerciseDetails],
  );

  // ===========================
  // Save Batch Exercise Details
  // ===========================

  const saveExerciseDetailsBatch = useCallback(
    async (
      payloads: CreateUserExerciseDetailsPayload[],
    ): Promise<UserWorkoutDataResponse<UserExerciseDetails[]>> => {
      try {
        setLoadingState((prev) => ({ ...prev, isSaving: true, error: null }));

        const result = await createUserExerciseDetailsBatch(payloads);

        if (result.success && result.data) {
          // Add all to local state
          setExerciseDetails((prev) => [...prev, ...result.data!]);
        } else {
          setLoadingState((prev) => ({
            ...prev,
            error: result.error || "Failed to save exercise details",
          }));
        }

        return result;
      } catch (error: any) {
        const errorMsg = error?.message || "An unexpected error occurred";
        setLoadingState((prev) => ({ ...prev, error: errorMsg }));
        return { success: false, error: errorMsg };
      } finally {
        setLoadingState((prev) => ({ ...prev, isSaving: false }));
      }
    },
    [createUserExerciseDetailsBatch],
  );

  // ===========================
  // Clear Exercise Details
  // ===========================

  const clearExerciseDetails = useCallback(() => {
    setExerciseDetails([]);
    setLoadingState({
      isLoading: false,
      isSaving: false,
      error: null,
    });
  }, []);

  // ===========================
  // Context Value
  // ===========================

  const contextValue: UserExercisesContextType = {
    exerciseDetails,
    loadingState: {
      ...loadingState,
      isLoading: loadingState.isLoading || hookIsLoading,
      error: loadingState.error || hookError,
    },
    saveExerciseDetails,
    saveExerciseDetailsBatch,
    clearExerciseDetails,
    setExerciseDetails,
    generateImageSlug,
  };

  return (
    <UserExercisesContext.Provider value={contextValue}>
      {children}
    </UserExercisesContext.Provider>
  );
}

// ===========================
// Custom Hook
// ===========================

export function useUserExercisesContext(): UserExercisesContextType {
  const context = useContext(UserExercisesContext);
  if (context === undefined) {
    throw new Error(
      "useUserExercisesContext must be used within a UserExercisesProvider",
    );
  }
  return context;
}

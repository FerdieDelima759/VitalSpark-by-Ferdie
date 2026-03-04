import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Svg, { Line } from "react-native-svg";
import { supabase } from "@/utils/supabase";
import { useUserContext } from "@/contexts/UserContext";
import { useWorkoutSessionContext } from "@/contexts/WorkoutSessionContext";
import {
  WorkoutSessionExercise,
  WorkoutSessionSet,
  WorkoutSessionSetCreatePayload,
  WorkoutSessionExerciseCreatePayload,
} from "@/types/WorkoutSession";
import { useMobileWebRedirect } from "@/hooks/useMobileWebRedirect";

interface ExerciseDetails {
  id: string;
  name: string;
  image_slug: string | null;
  default_safety_tip: string | null;
  primary_muscle: string | null;
}

interface Exercise {
  exercise_id: string;
  position: number;
  section: string;
  sets: number | null;
  reps: number | null;
  duration_seconds: number | null;
  rest_seconds: number;
  safety_tip: string | null;
  per_side: boolean;
  details: ExerciseDetails | null;
}

// Expanded workout flow item - each set becomes a separate item
interface WorkoutFlowItem {
  exercise: Exercise;
  setNumber: number; // Which set this is (1, 2, 3, etc.)
  totalSets: number; // Total sets for this exercise
  orderInSession: number; // Order in the entire workout flow (1-based, includes all sets)
  exerciseOrder: number; // Unique exercise order (1-based, increments per exercise not set)
  isRestAfter: boolean; // Whether there's rest after this set
  side: "left" | "right" | "both"; // Which side this set is for (for per_side exercises)
}

interface WorkoutPlan {
  id: string;
  name: string;
  level: string;
  total_exercises: number | null;
}

export default function ExerciseSession() {
  const insets = useSafeAreaInsets();
  const { planId } = useLocalSearchParams();
  const { userProfile } = useUserContext();
  const workoutSessionContext = useWorkoutSessionContext();
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutFlow, setWorkoutFlow] = useState<WorkoutFlowItem[]>([]);
  const [currentFlowIndex, setCurrentFlowIndex] = useState<number>(0);
  const [userGender, setUserGender] = useState<string>("male");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(0);
  const [isResting, setIsResting] = useState<boolean>(false);
  const [showExitConfirmation, setShowExitConfirmation] =
    useState<boolean>(false);
  const [isSkipping, setIsSkipping] = useState<boolean>(false);
  const [isGoingNext, setIsGoingNext] = useState<boolean>(false);
  const [isGoingPrevious, setIsGoingPrevious] = useState<boolean>(false);
  const [isQuitting, setIsQuitting] = useState<boolean>(false);
  const [isRestarting, setIsRestarting] = useState<boolean>(false);
  const [isStartingWorkout, setIsStartingWorkout] = useState<boolean>(false);
  const [startCountdown, setStartCountdown] = useState<number>(3);
  const [dimensions, setDimensions] = useState(Dimensions.get("window"));
  const [windowWidth, setWindowWidth] = useState<number>(
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.innerWidth
      : Dimensions.get("window").width
  );
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<boolean>(false);
  const loadingTimeoutRef = useRef<any>(null);
  const processingTimeoutRef = useRef<any>(null);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionExercises, setSessionExercises] = useState<
    Map<string, WorkoutSessionExercise>
  >(new Map());
  const [sessionSets, setSessionSets] = useState<
    Map<string, WorkoutSessionSet>
  >(new Map());
  const sessionStartTimeRef = useRef<Date | null>(null);
  const exerciseStartTimeRef = useRef<Date | null>(null);
  const setStartTimeRef = useRef<Date | null>(null);
  const restStartTimeRef = useRef<Date | null>(null);
  const totalWorkoutTimeRef = useRef<number>(0);
  const totalRestTimeRef = useRef<number>(0);

  // Optimization: Track if session has been initialized to prevent redundant checks
  const sessionInitializedRef = useRef<boolean>(false);
  const exercisesAddedRef = useRef<Set<string>>(new Set());
  const shouldAutoAdvanceRef = useRef<boolean>(false);
  const isClearingSessionRef = useRef<boolean>(false);
  const clearSessionPromiseRef = useRef<Promise<boolean> | null>(null);
  // Web-specific refs removed

  useMobileWebRedirect(true);

  const isSmallScreen = useMemo(() => {
    if (Platform.OS !== "web") return false;
    return dimensions.width < 1280 || dimensions.height < 800;
  }, [dimensions]);

  const isLargeScreen = useMemo(() => {
    if (Platform.OS !== "web") return false;
    return dimensions.width > 1240;
  }, [dimensions]);

  const scale = useMemo(() => {
    if (Platform.OS !== "web") return 1;
    if (isSmallScreen) {
      const widthScale = Math.min(dimensions.width / 1280, 1);
      const heightScale = Math.min(dimensions.height / 800, 1);
      return Math.max(Math.min(widthScale, heightScale), 0.65);
    }
    if (isLargeScreen) {
      const widthScale = dimensions.width / 1280;
      const heightScale = dimensions.height / 800;
      // Increased max scale to 6.0 for much more scaling on very large screens
      return Math.min(widthScale, heightScale, 6.0);
    }

    return 1;
  }, [isSmallScreen, isLargeScreen, dimensions]);

  const showToast = useCallback(
    (type: "success" | "error" | "info", message: string) => {
      // Toast functionality removed - web-specific
    },
    []
  );

  const setToast = useCallback(
    (toast: { type: "success" | "error" | "info"; message: string } | null) => {
      setToastMessage(toast);
      if (toast) {
        setTimeout(() => setToastMessage(null), 3000);
      }
    },
    []
  );
  const retryDatabaseOperation = async <T,>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 2
  ): Promise<T | null> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          operation(),
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error("Operation timeout")), 5000)
          ),
        ]);
        return result;
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries;
        const isNetworkError =
          error?.message?.includes("network") ||
          error?.message?.includes("fetch") ||
          error?.message?.includes("timeout") ||
          error?.code === "ECONNREFUSED" ||
          error?.code === "ETIMEDOUT";

        // Log error only on last attempt
        if (isLastAttempt) {
          console.error(
            `${operationName} failed after ${maxRetries} attempts:`,
            error?.message || error
          );
        }

        if (isLastAttempt) {
          return null;
        }

        const delay = Math.min(200 * Math.pow(2, attempt - 1), 1000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return null;
  };

  const checkNetworkConnectivity = (): boolean => {
    return true;
  };

  const createWorkoutFlow = useCallback(
    (exerciseList: Exercise[]): WorkoutFlowItem[] => {
      // Ensure exercises are properly organized by section in correct order
      const sections = ["warmup", "main", "cooldown"];
      const flow: WorkoutFlowItem[] = [];
      let setOrderCounter = 1; // Counts all sets
      let exerciseOrderCounter = 1; // Counts unique exercises

      // Track section stats for logging
      const sectionStats: { [key: string]: number } = {
        warmup: 0,
        main: 0,
        cooldown: 0,
      };

      sections.forEach((sectionName) => {
        const sectionExercises = exerciseList
          .filter(
            (ex) => ex.section.toLowerCase() === sectionName.toLowerCase()
          )
          .sort((a, b) => a.position - b.position);

        sectionExercises.forEach((exercise, idx) => {
          const totalSets = exercise.sets || 1;
          const currentExerciseOrder = exerciseOrderCounter;
          const isLastExerciseInSection = idx === sectionExercises.length - 1;
          const isLastSection = sectionName === "cooldown";
          const isVeryLastExercise = isLastExerciseInSection && isLastSection;

          if (exercise.per_side) {
            // For per_side exercises
            if (totalSets === 1) {
              // Single set: treated as "both" sides in one flow item

              const isRestAfterSet =
                !isVeryLastExercise && exercise.rest_seconds > 0;

              flow.push({
                exercise,
                setNumber: 1,
                totalSets: 1,
                orderInSession: setOrderCounter,
                exerciseOrder: currentExerciseOrder,
                isRestAfter: isRestAfterSet,
                side: "both",
              });
              setOrderCounter++;
              sectionStats[sectionName]++;
            } else {
              // Multiple sets: alternate between left and right, full duration
              for (let setNum = 1; setNum <= totalSets; setNum++) {
                const isLastSet = setNum === totalSets;
                const isLastSetOfLastExercise = isLastSet && isVeryLastExercise;
                const isRestAfter =
                  !isLastSetOfLastExercise && exercise.rest_seconds > 0;
                // Alternate: odd sets = left, even sets = right
                const side = setNum % 2 === 1 ? "left" : "right";

                flow.push({
                  exercise,
                  setNumber: setNum,
                  totalSets,
                  orderInSession: setOrderCounter,
                  exerciseOrder: currentExerciseOrder,
                  isRestAfter,
                  side,
                });

                setOrderCounter++;
                sectionStats[sectionName]++;
              }
            }
          } else {
            // Normal exercises (not per-side, side will be null)
            for (let setNum = 1; setNum <= totalSets; setNum++) {
              const isLastSet = setNum === totalSets;
              const isLastSetOfLastExercise = isLastSet && isVeryLastExercise;
              const isRestAfter =
                !isLastSetOfLastExercise && exercise.rest_seconds > 0;

              flow.push({
                exercise,
                setNumber: setNum,
                totalSets,
                orderInSession: setOrderCounter,
                exerciseOrder: currentExerciseOrder,
                isRestAfter,
                side: "both", // Will be converted to null in recordCompletedSet for non-per_side
              });

              setOrderCounter++;
              sectionStats[sectionName]++;
            }
          }

          // Increment exercise order once per unique exercise
          exerciseOrderCounter++;
        });
      });

      // Verify consecutive ordering
      const isConsecutive = flow.every((item, idx) => {
        if (idx === 0) return true;
        return item.orderInSession === flow[idx - 1].orderInSession + 1;
      });

      if (!isConsecutive) {
        console.error(
          "⚠️ WARNING: Flow is not consecutive! Check exercise ordering."
        );
      }

      return flow;
    },
    []
  );

  // Web-specific resize handler removed

  // Web-specific network connectivity monitoring removed

  // Web-specific: Handle page reload behavior and keyboard shortcuts removed

  // Web-specific: Keep keyboard state ref in sync removed

  // Normalize gender for image paths (only male/female images available)
  const normalizedGender = useMemo(() => {
    const gender = userGender.toLowerCase();
    if (gender === "female") return "female";
    // Default to male for: male, non-binary, other, prefer not to say, etc.
    return "male";
  }, [userGender]);

  // Track if we've already fetched data to prevent double initialization
  const hasInitializedRef = useRef<boolean>(false);

  // Reset state when planId changes (starting a new workout)
  useEffect(() => {
    if (planId) {
      console.log("🔄 RESET: Resetting state for new workout session", {
        planId,
      });
      // Reset all state flags
      setIsQuitting(false);
      setIsRestarting(false);
      setIsSkipping(false);
      setIsGoingNext(false);
      setIsGoingPrevious(false);
      setIsStartingWorkout(false);
      setIsPaused(false);
      setIsResting(false);
      setShowExitConfirmation(false);
      setIsLoading(true);

      // Clear session state
      setActiveSessionId(null);
      exercisesAddedRef.current.clear();
      setSessionExercises(new Map());
      setSessionSets(new Map());
      sessionInitializedRef.current = false;

      // Clear context
      workoutSessionContext.setActiveWorkoutSession(null);

      // Reset refs
      exerciseStartTimeRef.current = null;
      setStartTimeRef.current = null;
      restStartTimeRef.current = null;
      sessionStartTimeRef.current = null;
      totalWorkoutTimeRef.current = 0;
      totalRestTimeRef.current = 0;
      shouldAutoAdvanceRef.current = false;
      hasInitializedRef.current = false;

      // Reset flow
      setCurrentFlowIndex(0);
      setTimer(0);
    }
  }, [planId]);

  // Main initialization effect - triggers when planId or userProfile loads
  useEffect(() => {
    // Wait for both planId and userProfile to be available
    if (planId && userProfile?.user_id) {
      // Check if we have an active session - if not, we should initialize
      const hasActiveSession =
        activeSessionId || workoutSessionContext.activeWorkoutSession?.id;

      // Initialize if:
      // 1. Not yet initialized, OR
      // 2. No active session AND we're not currently loading (user quit and came back)
      const shouldInitialize =
        !hasInitializedRef.current || (!hasActiveSession && !isLoading);

      if (shouldInitialize) {
        console.log("🚀 INIT: Starting workout initialization", {
          planId,
          userId: userProfile.user_id,
          hasInitialized: hasInitializedRef.current,
          hasActiveSession: !!hasActiveSession,
          isLoading,
          activeSessionId,
          contextSessionId: workoutSessionContext.activeWorkoutSession?.id,
        });

        // Reset initialization flag if we're re-initializing after quit
        if (hasInitializedRef.current && !hasActiveSession) {
          console.log("🔄 INIT: Resetting initialization flag for fresh start");
          hasInitializedRef.current = false;
        }

        hasInitializedRef.current = true;

        // Immediate initialization - no delay needed
        // This will fetch workout data and create a new session
        fetchWorkoutData();
      } else {
        console.log(
          "⚠️ INIT: Already initialized with active session, skipping",
          {
            activeSessionId,
            contextSessionId: workoutSessionContext.activeWorkoutSession?.id,
            isLoading,
          }
        );
      }
    }
  }, [planId, userProfile]);

  // Clear loading timeout when loading completes
  useEffect(() => {
    if (!isLoading && loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, [isLoading]);

  // Web-specific: Safety timeout for loading states removed

  // Create workout flow when exercises are loaded
  useEffect(() => {
    if (exercises.length > 0) {
      const flow = createWorkoutFlow(exercises);
      setWorkoutFlow(flow);

      // Verify section transitions
      let previousSection = "";
      let sectionTransitions: string[] = [];

      flow.forEach((item, idx) => {
        if (item.exercise.section !== previousSection) {
          sectionTransitions.push(
            `${idx + 1}: ${item.exercise.section.toUpperCase()} starts`
          );
          previousSection = item.exercise.section;
        }
      });
    }
  }, [exercises, createWorkoutFlow]);

  // Web-specific: Periodic session validation removed

  // No need for automatic session restoration - we start fresh each time
  // The cleanup happens in startWorkoutSession() before creating new session

  useEffect(() => {
    const currentItem = workoutFlow[currentFlowIndex];
    if (!currentItem) return;

    if (isResting) {
      if (currentItem.exercise.rest_seconds > 0) {
        setTimer(currentItem.exercise.rest_seconds);
        shouldAutoAdvanceRef.current = true;
      } else {
        setTimer(0);
        shouldAutoAdvanceRef.current = false;
      }
    } else {
      if (
        currentItem.exercise.duration_seconds &&
        currentItem.exercise.duration_seconds > 0
      ) {
        setTimer(currentItem.exercise.duration_seconds);
        shouldAutoAdvanceRef.current = true;
      } else {
        setTimer(0);
        shouldAutoAdvanceRef.current = false;
      }
    }
  }, [currentFlowIndex, workoutFlow, isResting]);

  useEffect(() => {
    let interval: any;
    if (!isPaused && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPaused, timer]);

  // State to trigger auto-advance when timer reaches 0
  const [shouldTriggerNext, setShouldTriggerNext] = useState<boolean>(false);

  useEffect(() => {
    // Auto-proceed when timer reaches 0 (only if it was counting down)
    if (timer === 0 && !isPaused && shouldAutoAdvanceRef.current) {
      shouldAutoAdvanceRef.current = false; // Reset flag
      setShouldTriggerNext(true);
    }
  }, [timer, isPaused]);

  /**
   * MASTER CLEANUP FUNCTION
   * Removes ACTIVE workout sessions (ended_at = NULL) and exercises for the current user and plan.
   * This ensures NO "Continue Exercise" feature - users always start fresh.
   * Called on: page load, navigation, and before creating new sessions.
   *
   * What gets deleted:
   * - Active sessions (ended_at = NULL) for user_id + plan_id
   * - ALL exercises for user_id + plan_id (orphaned or not)
   * - ALL sets related to those exercises
   *
   * @returns {Promise<boolean>} True if cleanup successful, false otherwise
   */
  const cleanupAllSessionsAndExercises = async (): Promise<boolean> => {
    if (!userProfile?.user_id || !planId) {
      return false;
    }

    try {
      // STEP 1: Find and delete ONLY ACTIVE sessions (ended_at = NULL) for this user+plan
      const { data: activeSessions, error: sessionsError } = await supabase
        .from("workout_sessions")
        .select("id, started_at, ended_at")
        .eq("user_id", userProfile.user_id)
        .eq("plan_id", planId)
        .is("ended_at", null); // Only get active sessions

      if (sessionsError) {
        console.error("❌ Error fetching active sessions:", sessionsError);
      } else if (activeSessions && activeSessions.length > 0) {
        for (const session of activeSessions) {
          await deleteSession(session.id);
        }
      }

      // STEP 2: Delete ALL exercises for this user+plan (orphaned or not)
      const { data: allExercises, error: exercisesError } = await supabase
        .from("workout_session_exercises")
        .select("id, exercise_id, plan_position, session_id")
        .eq("user_id", userProfile.user_id)
        .eq("plan_id", planId);

      if (exercisesError) {
        console.error("❌ Error fetching exercises:", exercisesError);
      } else if (allExercises && allExercises.length > 0) {
        // Delete sets first (foreign key constraint)
        const exerciseIds = allExercises.map((ex) => ex.id);
        const { error: setsError } = await supabase
          .from("workout_session_sets")
          .delete()
          .in("session_exercise_id", exerciseIds);

        if (setsError) {
          console.error("❌ Error deleting sets:", setsError);
        }

        // Delete exercises
        const { error: deleteError } = await supabase
          .from("workout_session_exercises")
          .delete()
          .eq("user_id", userProfile.user_id)
          .eq("plan_id", planId);

        if (deleteError) {
          console.error("❌ Error deleting exercises:", deleteError);
        }
      }

      // Clear local state immediately (no delay for better performance)
      exercisesAddedRef.current.clear();
      setSessionExercises(new Map());
      setSessionSets(new Map());

      return true;
    } catch (error) {
      console.error("❌ CLEANUP ERROR:", error);
      return false;
    }
  };

  /**
   * Completely deletes a session including all exercises, sets, and the session record itself.
   * Used when we want to remove a session entirely from the database.
   *
   * @param {string} sessionId - The ID of the session to delete
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  const deleteSession = async (sessionId: string): Promise<boolean> => {
    try {
      console.log("🗑️ Starting deletion of session:", sessionId);

      // First, get all exercise IDs for this session
      const { data: exercisesData, error: fetchError } = await supabase
        .from("workout_session_exercises")
        .select("id")
        .eq("session_id", sessionId);

      if (fetchError) {
        console.error("Error fetching exercises to delete:", fetchError);
        return false;
      }

      // Delete all sets for these exercises (must be done first due to foreign key constraints)
      if (exercisesData && exercisesData.length > 0) {
        const exerciseIds = exercisesData.map((ex) => ex.id);
        console.log(
          `🗑️ Deleting ${exerciseIds.length} sets for ${exercisesData.length} exercises`
        );

        const { error: setsError } = await supabase
          .from("workout_session_sets")
          .delete()
          .in("session_exercise_id", exerciseIds);

        if (setsError) {
          console.error("Error deleting session sets:", setsError);
        } else {
          console.log("✅ Successfully deleted all sets");
        }
      }

      // Then delete all exercises
      const { error: exercisesError } = await supabase
        .from("workout_session_exercises")
        .delete()
        .eq("session_id", sessionId);

      if (exercisesError) {
        console.error("Error deleting session exercises:", exercisesError);
        return false;
      } else if (exercisesData && exercisesData.length > 0) {
        console.log("✅ Successfully deleted all exercises");
      }

      // Finally, delete the session itself
      console.log("🗑️ Deleting session record:", sessionId);
      const { error: sessionError } = await supabase
        .from("workout_sessions")
        .delete()
        .eq("id", sessionId);

      if (sessionError) {
        console.error("Error deleting session:", sessionError);
        return false;
      }

      console.log("✅ Successfully deleted session:", sessionId);
      return true;
    } catch (error) {
      console.error("Error deleting session:", error);
      return false;
    }
  };

  const clearSessionData = async (sessionId: string): Promise<boolean> => {
    // If already clearing, wait for that operation to complete
    if (isClearingSessionRef.current && clearSessionPromiseRef.current) {
      return await clearSessionPromiseRef.current;
    }

    // Set the lock and create the promise
    isClearingSessionRef.current = true;

    const clearPromise = (async (): Promise<boolean> => {
      try {
        if (!userProfile?.user_id || !planId) {
          console.error("Cannot clear session data: missing user or plan ID");
          return false;
        }

        // Delete ALL exercises for this user+plan (not just this session)
        // This is necessary because the unique constraint is on (user_id, plan_id, plan_position)
        const { data: allExercises, error: fetchError } = await supabase
          .from("workout_session_exercises")
          .select("id, exercise_id, plan_position, session_id")
          .eq("user_id", userProfile.user_id)
          .eq("plan_id", planId);

        if (fetchError) {
          console.error("Error fetching exercises to delete:", fetchError);
          return false;
        }

        if (allExercises && allExercises.length > 0) {
          // Delete all sets for these exercises (must be done first due to foreign key constraints)
          const exerciseIds = allExercises.map((ex) => ex.id);
          const { error: setsError } = await supabase
            .from("workout_session_sets")
            .delete()
            .in("session_exercise_id", exerciseIds);

          if (setsError) {
            console.error("Error deleting session sets:", setsError);
            // Continue anyway to try deleting exercises
          }

          // Then delete all exercises for this user+plan
          const { error: exercisesError } = await supabase
            .from("workout_session_exercises")
            .delete()
            .eq("user_id", userProfile.user_id)
            .eq("plan_id", planId);

          if (exercisesError) {
            console.error("Error deleting session exercises:", exercisesError);
            return false;
          }
        }

        // Clear local state immediately (no delay for better performance)
        exercisesAddedRef.current.clear();
        setSessionExercises(new Map());
        setSessionSets(new Map());

        return true;
      } catch (error) {
        console.error("Error clearing session data:", error);
        return false;
      } finally {
        // Release the lock
        isClearingSessionRef.current = false;
        clearSessionPromiseRef.current = null;
      }
    })();

    clearSessionPromiseRef.current = clearPromise;
    return await clearPromise;
  };

  const startWorkoutSession = async () => {
    if (!userProfile?.user_id || !planId) {
      const errorMsg = `Missing ${!userProfile?.user_id ? "user profile" : "plan ID"}`;
      console.error(`❌ Cannot start session: ${errorMsg}`);

      return null;
    }

    try {
      console.log("🚀 Starting new workout session for plan:", planId);

      // STEP 1: Delete ALL active sessions for this user+plan first
      console.log("🧹 Cleaning up any existing active sessions");
      const { data: activeSessions } = await supabase
        .from("workout_sessions")
        .select("id")
        .eq("user_id", userProfile.user_id)
        .eq("plan_id", planId)
        .is("ended_at", null);

      if (activeSessions && activeSessions.length > 0) {
        console.log(
          `🧹 Found ${activeSessions.length} active sessions to delete`
        );
        for (const session of activeSessions) {
          await deleteSession(session.id);
        }
        console.log("✅ All active sessions deleted");
      }

      // STEP 2: Fast cleanup of existing exercises for this user+plan
      const { data: existingExercises } = await supabase
        .from("workout_session_exercises")
        .select("id")
        .eq("user_id", userProfile.user_id)
        .eq("plan_id", planId);

      if (existingExercises && existingExercises.length > 0) {
        const exerciseIds = existingExercises.map((ex) => ex.id);
        console.log(`🧹 Cleaning up ${exerciseIds.length} existing exercises`);

        // Sequential delete for reliability (sets first due to foreign key)
        await supabase
          .from("workout_session_sets")
          .delete()
          .in("session_exercise_id", exerciseIds);

        await supabase
          .from("workout_session_exercises")
          .delete()
          .in("id", exerciseIds);

        console.log("✅ Cleanup complete");
      }

      // Clear context and local state to ensure fresh start
      console.log("🧹 Clearing context and local state");
      workoutSessionContext.setActiveWorkoutSession(null);
      exercisesAddedRef.current.clear();
      setSessionExercises(new Map());
      setSessionSets(new Map());
      setActiveSessionId(null);
      setCurrentFlowIndex(0);
      setIsResting(false);
      setIsPaused(false);
      setTimer(0);

      // STEP 3: Ensure we start from the first exercise (index 0)
      console.log("🔄 Resetting to first exercise");
      setCurrentFlowIndex(0);
      setIsResting(false);
      setIsPaused(false);
      setTimer(0);
      totalWorkoutTimeRef.current = 0;
      totalRestTimeRef.current = 0;
      exerciseStartTimeRef.current = null;
      setStartTimeRef.current = null;
      restStartTimeRef.current = null;
      shouldAutoAdvanceRef.current = false;

      // STEP 4: Create new workout session immediately
      console.log("🔄 Creating new workout session...");
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version?.toString() || "unknown",
        screenWidth: windowWidth,
      };

      // Create session with retry logic
      const session = await retryDatabaseOperation(
        async () => {
          return await workoutSessionContext.startNewWorkoutSession({
            user_id: userProfile.user_id,
            plan_id: planId as string,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            device_info: deviceInfo,
          });
        },
        "startNewWorkoutSession",
        3
      );

      if (session) {
        console.log("✅ New workout session created:", session.id);

        // Update context with new session to ensure session ID is properly propagated
        workoutSessionContext.setActiveWorkoutSession(session);

        // Update local state
        sessionInitializedRef.current = true;
        setActiveSessionId(session.id);
        sessionStartTimeRef.current = new Date();
        setCurrentFlowIndex(0); // Ensure we start from first exercise

        console.log("✅ Session ID set in state and context:", session.id);
        console.log(
          "✅ Starting from first exercise (index 0) with empty state"
        );

        // Wait a brief moment to ensure state is updated before proceeding
        await new Promise((resolve) => setTimeout(resolve, 100));

        return session.id;
      } else {
        console.error("❌ Failed to create workout session after retries");
      }
    } catch (error) {
      console.error("❌ Error starting workout session:", error);
    }
    return null;
  };

  /**
   * Ensures an exercise exists in the session and is available in state.
   * Returns the exercise ID if successful, null otherwise.
   * This function waits for the exercise to be fully created and available.
   */
  const ensureExerciseExists = async (
    exercise: Exercise,
    exerciseOrder: number,
    maxWaitMs: number = 2000
  ): Promise<string | null> => {
    // Get session ID from state or context (context is more reliable during state updates)
    let sessionId = activeSessionId;

    // If state doesn't have it, check context
    if (!sessionId) {
      const contextSession = workoutSessionContext.activeWorkoutSession;
      if (contextSession?.id) {
        sessionId = contextSession.id;
        // Update state to keep them in sync
        setActiveSessionId(sessionId);
      }
    }

    // Wait for sessionId to be available (in case it's being set)
    let waitCount = 0;
    const maxWaitCount = 20; // Wait up to 1 second (20 * 50ms)
    while (!sessionId && waitCount < maxWaitCount) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      // Check again
      const contextSessionId = workoutSessionContext.activeWorkoutSession?.id;
      sessionId =
        activeSessionId || (contextSessionId ? contextSessionId : null);
      if (sessionId && !activeSessionId) {
        setActiveSessionId(sessionId);
      }
      waitCount++;
    }

    if (!sessionId) {
      console.error(
        "❌ ensureExerciseExists: No active session ID after waiting",
        {
          stateSessionId: activeSessionId,
          contextSessionId: workoutSessionContext.activeWorkoutSession?.id,
        }
      );
      return null;
    }

    if (!userProfile?.user_id) {
      console.error("❌ ensureExerciseExists: No user profile");
      return null;
    }

    const exerciseKey = `${exercise.exercise_id}_${exercise.position}`;
    console.log("🔍 ensureExerciseExists: Checking for exercise:", exerciseKey);

    // Fast path: Already added and in state
    if (exercisesAddedRef.current.has(exerciseKey)) {
      const fromState = sessionExercises.get(exerciseKey);
      if (fromState?.id && fromState?.session_id) {
        console.log(
          "✅ ensureExerciseExists: Exercise already in state:",
          fromState.id
        );
        return fromState.id;
      }
    }

    // Try to get from database first
    console.log("🔍 ensureExerciseExists: Checking database for exercise");
    try {
      const { data: dbExercise, error: dbError } = await supabase
        .from("workout_session_exercises")
        .select("*")
        .eq("session_id", sessionId)
        .eq("exercise_id", exercise.exercise_id)
        .eq("plan_position", exercise.position)
        .maybeSingle();

      if (dbExercise && !dbError) {
        // Exercise exists in database, update state
        console.log(
          "✅ ensureExerciseExists: Exercise found in database:",
          dbExercise.id
        );
        exercisesAddedRef.current.add(exerciseKey);
        setSessionExercises((prev) => {
          const newMap = new Map(prev);
          newMap.set(exerciseKey, dbExercise);
          return newMap;
        });
        exerciseStartTimeRef.current = new Date();
        return dbExercise.id;
      }

      if (dbError) {
        console.error(
          "❌ ensureExerciseExists: Database check error:",
          dbError
        );
      }
    } catch (dbCheckError) {
      console.error(
        "❌ ensureExerciseExists: Database check exception:",
        dbCheckError
      );
      // Continue to creation if check fails
    }

    // Create the exercise
    const sessionExerciseId = await addExerciseToSession(
      exercise,
      exerciseOrder
    );

    if (!sessionExerciseId) {
      console.error(
        "❌ ensureExerciseExists: addExerciseToSession returned null",
        {
          exerciseKey,
          exerciseId: exercise.exercise_id,
          position: exercise.position,
          sessionId: activeSessionId,
        }
      );
      return null;
    }

    // Wait for exercise to be available in state (with timeout)
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const exerciseInState = sessionExercises.get(exerciseKey);
      if (exerciseInState?.id && exerciseInState?.session_id) {
        return exerciseInState.id;
      }
      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // If still not in state after waiting, verify it exists in database
    try {
      const { data: dbExercise, error: dbError } = await supabase
        .from("workout_session_exercises")
        .select("*")
        .eq("id", sessionExerciseId)
        .maybeSingle();

      if (dbExercise && !dbError) {
        // Update state with the exercise
        exercisesAddedRef.current.add(exerciseKey);
        setSessionExercises((prev) => {
          const newMap = new Map(prev);
          newMap.set(exerciseKey, dbExercise);
          return newMap;
        });
        return dbExercise.id;
      }

      if (dbError) {
        console.error(
          "❌ ensureExerciseExists: Final database check error:",
          dbError
        );
      }
    } catch (finalCheckError) {
      console.error(
        "❌ ensureExerciseExists: Final check exception:",
        finalCheckError
      );
    }

    // If we have the ID but it's not in state, return it anyway (it exists in DB)
    return sessionExerciseId;
  };

  const addExerciseToSession = async (
    exercise: Exercise,
    exerciseOrder: number
  ): Promise<string | null> => {
    // Get session ID from state or context (context is more reliable during state updates)
    let sessionId = activeSessionId;
    if (!sessionId) {
      const contextSession = workoutSessionContext.activeWorkoutSession;
      if (contextSession?.id) {
        sessionId = contextSession.id;
        // Update state to keep them in sync
        setActiveSessionId(sessionId);
      }
    }

    if (!sessionId || !userProfile?.user_id) {
      if (!sessionId) {
        console.error("❌ addExerciseToSession: No active session ID");
      }
      return null;
    }

    const exerciseKey = `${exercise.exercise_id}_${exercise.position}`;
    console.log(
      "🔄 addExerciseToSession: Adding exercise to session:",
      exerciseKey
    );

    // Fast path: Already added and in state
    if (exercisesAddedRef.current.has(exerciseKey)) {
      const fromState = sessionExercises.get(exerciseKey);
      if (fromState?.id) {
        console.log(
          "✅ addExerciseToSession: Exercise already in state:",
          fromState.id
        );
        return fromState.id;
      }
    }

    // Check database first to prevent duplicate key errors
    console.log(
      "🔍 addExerciseToSession: Checking database for existing exercise"
    );
    try {
      const { data: dbExercise, error: dbError } = await supabase
        .from("workout_session_exercises")
        .select("*")
        .eq("session_id", sessionId)
        .eq("exercise_id", exercise.exercise_id)
        .eq("plan_position", exercise.position)
        .maybeSingle();

      if (dbExercise && !dbError) {
        // Exercise already exists in database
        console.log(
          "✅ addExerciseToSession: Exercise found in database:",
          dbExercise.id
        );
        exercisesAddedRef.current.add(exerciseKey);
        setSessionExercises((prev) => {
          const newMap = new Map(prev);
          newMap.set(exerciseKey, dbExercise);
          return newMap;
        });
        exerciseStartTimeRef.current = new Date();
        return dbExercise.id;
      }
    } catch (dbCheckError) {
      console.error(
        "❌ addExerciseToSession: Error checking database:",
        dbCheckError
      );
      // Continue to creation if check fails
    }

    const exercisePayload: WorkoutSessionExerciseCreatePayload = {
      session_id: sessionId,
      user_id: userProfile.user_id,
      exercise_id: exercise.exercise_id,
      plan_id: planId as string,
      plan_position: exercise.position,
      order_in_session: exerciseOrder,
      exercise_name_snapshot: exercise.details?.name || null,
      section_snapshot: exercise.section,
      safety_tip_snapshot:
        exercise.safety_tip || exercise.details?.default_safety_tip || null,
      target_sets: exercise.sets,
      target_reps: exercise.reps,
      target_duration_seconds: exercise.duration_seconds,
    };

    console.log("🔄 addExerciseToSession: Creating exercise in database");
    // Use retry logic for adding exercise
    let sessionExercise: WorkoutSessionExercise | null = null;
    let lastError: any = null;

    try {
      sessionExercise = await retryDatabaseOperation(
        async () => {
          const result = await workoutSessionContext.addExerciseToSession(
            sessionId,
            exercisePayload
          );
          if (!result) {
            throw new Error("Context function returned null");
          }
          return result;
        },
        "addExerciseToSession",
        3
      );
    } catch (error: any) {
      lastError = error;

      // Handle duplicate key error (23505) - exercise already exists
      if (
        error?.code === "23505" ||
        error?.message?.includes("duplicate key")
      ) {
        console.log(
          "⚠️ addExerciseToSession: Duplicate key detected, fetching existing exercise"
        );
        // Immediately check database for existing exercise
        try {
          const { data: dbExercise, error: dbError } = await supabase
            .from("workout_session_exercises")
            .select("*")
            .eq("session_id", sessionId)
            .eq("exercise_id", exercise.exercise_id)
            .eq("plan_position", exercise.position)
            .maybeSingle();

          if (dbExercise && !dbError) {
            console.log(
              "✅ addExerciseToSession: Found existing exercise after duplicate key error:",
              dbExercise.id
            );
            exercisesAddedRef.current.add(exerciseKey);
            setSessionExercises((prev) => {
              const newMap = new Map(prev);
              newMap.set(exerciseKey, dbExercise);
              return newMap;
            });
            exerciseStartTimeRef.current = new Date();
            return dbExercise.id;
          }
        } catch (fetchError) {
          console.error(
            "❌ addExerciseToSession: Error fetching after duplicate key:",
            fetchError
          );
        }
      }
    }

    if (sessionExercise) {
      console.log(
        "✅ addExerciseToSession: Exercise created in database:",
        sessionExercise.id
      );
      exercisesAddedRef.current.add(exerciseKey);
      setSessionExercises((prev) => {
        const newMap = new Map(prev);
        newMap.set(exerciseKey, sessionExercise!);
        return newMap;
      });
      exerciseStartTimeRef.current = new Date();

      return sessionExercise.id;
    }

    // If creation failed, check database one more time (might have been created by another call or duplicate key was handled)
    try {
      const { data: dbExercise, error: dbError } = await supabase
        .from("workout_session_exercises")
        .select("*")
        .eq("session_id", sessionId)
        .eq("exercise_id", exercise.exercise_id)
        .eq("plan_position", exercise.position)
        .maybeSingle();

      if (dbExercise && !dbError) {
        // Exercise was created by another call or duplicate key was handled - use it
        console.log(
          "✅ addExerciseToSession: Found existing exercise in final check:",
          dbExercise.id
        );
        exercisesAddedRef.current.add(exerciseKey);
        setSessionExercises((prev) => {
          const newMap = new Map(prev);
          newMap.set(exerciseKey, dbExercise);
          return newMap;
        });
        exerciseStartTimeRef.current = new Date();
        return dbExercise.id;
      }

      // If still not found, log detailed error
      console.error("❌ Failed to add exercise to session after retries", {
        exerciseKey,
        exerciseId: exercise.exercise_id,
        position: exercise.position,
        sessionId: sessionId,
        lastError: lastError?.message || lastError,
        dbError: dbError?.message,
      });
    } catch (finalCheckError) {
      console.error("Error in final check for exercise:", finalCheckError);
      console.error("❌ Failed to add exercise to session", {
        exerciseKey,
        exerciseId: exercise.exercise_id,
        position: exercise.position,
        sessionId: sessionId,
        lastError: lastError?.message || lastError,
        finalCheckError,
      });
    }

    return null;
  };

  /**
   * Records a completed set for an exercise in the current session.
   * Updates both the session exercise (cumulative values) and creates/updates individual set records.
   *
   * Side handling logic:
   * - Normal exercises (per_side = false): side = null
   * - Per-side exercises with 1 set: side = 'both' (1 record)
   * - Per-side exercises with multiple sets: side = 'left' or 'right' alternating (1 record per set)
   *
   * @param {Exercise} exercise - The exercise being performed
   * @param {number} setNumber - The set number (1-based)
   * @param {number} [actualDuration] - Optional actual duration in seconds
   * @param {number} [actualRest] - Optional actual rest time in seconds
   * @param {string} [side] - Side from flow item ('left', 'right', or 'both')
   * @returns {Promise<boolean>} True if set was recorded successfully, false otherwise
   */
  const recordCompletedSet = async (
    exercise: Exercise,
    setNumber: number,
    actualDuration?: number,
    actualRest?: number,
    side: "left" | "right" | "both" = "both"
  ): Promise<boolean> => {
    if (!activeSessionId || !userProfile?.user_id) return false;

    return recordCompletedSetCore(
      exercise,
      setNumber,
      actualDuration,
      actualRest,
      side
    );
  };

  const recordCompletedSetCore = async (
    exercise: Exercise,
    setNumber: number,
    actualDuration?: number,
    actualRest?: number,
    side: "left" | "right" | "both" = "both"
  ): Promise<boolean> => {
    if (!activeSessionId || !userProfile?.user_id) return false;

    console.log(
      `📝 recordCompletedSetCore: Recording set ${setNumber} for exercise ${exercise.exercise_id}`
    );

    const exerciseKey = `${exercise.exercise_id}_${exercise.position}`;
    let sessionExercise = sessionExercises.get(exerciseKey);

    // Ensure session exercise exists - create if not found
    if (!sessionExercise) {
      // First try to get from database
      try {
        const { data: dbExercise, error: dbError } = await supabase
          .from("workout_session_exercises")
          .select("*")
          .eq("session_id", activeSessionId)
          .eq("exercise_id", exercise.exercise_id)
          .eq("plan_position", exercise.position)
          .maybeSingle();

        if (dbExercise && !dbError) {
          sessionExercise = dbExercise;
          setSessionExercises((prev) => {
            const newMap = new Map(prev);
            newMap.set(exerciseKey, dbExercise);
            return newMap;
          });
        }
      } catch (dbQueryError) {
        console.error("Error querying database for exercise:", dbQueryError);
      }

      // If still not found, create it
      if (!sessionExercise) {
        // Find exercise order from current flow item
        const currentItem = workoutFlow[currentFlowIndex];
        if (!currentItem) {
          console.error(
            "❌ Cannot find current flow item to get exercise order"
          );
          return false;
        }

        const sessionExerciseId = await addExerciseToSession(
          exercise,
          currentItem.exerciseOrder
        );

        if (!sessionExerciseId) {
          console.error(
            "❌ Failed to create session exercise before recording set"
          );
          return false;
        }

        // Get the created exercise - check state first, then database
        sessionExercise = sessionExercises.get(exerciseKey);

        if (!sessionExercise) {
          // Wait a brief moment for state to update (React state is async)
          await new Promise((resolve) => setTimeout(resolve, 50));
          sessionExercise = sessionExercises.get(exerciseKey);
        }

        if (!sessionExercise) {
          // Query database directly using the ID we got back
          const { data: dbExercise, error: dbError } = await supabase
            .from("workout_session_exercises")
            .select("*")
            .eq("id", sessionExerciseId)
            .maybeSingle();

          if (dbExercise && !dbError) {
            sessionExercise = dbExercise;
            setSessionExercises((prev) => {
              const newMap = new Map(prev);
              newMap.set(exerciseKey, dbExercise);
              return newMap;
            });
            exercisesAddedRef.current.add(exerciseKey);
          } else {
            console.error(
              "❌ Failed to fetch created exercise from database:",
              dbError
            );
          }
        }

        if (!sessionExercise) {
          console.error(
            `❌ Session exercise still not found after creation. ID was: ${sessionExerciseId}`
          );
          return false;
        }

        // Validate the exercise has all required fields
        if (!sessionExercise.id || !sessionExercise.session_id) {
          console.error(
            "❌ Created session exercise missing required fields:",
            sessionExercise
          );
          return false;
        }
      }
    }

    // Validate session exercise has required fields
    if (!sessionExercise.id || !sessionExercise.session_id) {
      console.error(
        `❌ Session exercise missing required fields:`,
        sessionExercise
      );
      return false;
    }

    try {
      // Duration fallback if needed
      let finalDuration = actualDuration;
      if (
        !finalDuration &&
        exercise.duration_seconds &&
        setStartTimeRef.current
      ) {
        const elapsed = Math.floor(
          (new Date().getTime() - setStartTimeRef.current.getTime()) / 1000
        );
        finalDuration = elapsed;
      }

      // Correct side value
      const finalSide = !exercise.per_side ? null : side;

      // Reps for this set
      const setReps = exercise.reps || null;

      // Totals tracking
      if (finalDuration) totalWorkoutTimeRef.current += finalDuration;
      if (actualRest) totalRestTimeRef.current += actualRest;

      // Upsert set record
      const setKey = `${exerciseKey}_${setNumber}_${finalSide ?? "null"}`;
      let existingSet = sessionSets.get(setKey);

      // If not in local state, check database to avoid duplicates
      if (!existingSet) {
        try {
          const { data: dbSet, error: dbError } = await supabase
            .from("workout_session_sets")
            .select("*")
            .eq("session_exercise_id", sessionExercise.id)
            .eq("set_number", setNumber)
            .eq("side", finalSide)
            .maybeSingle();

          if (dbSet && !dbError) {
            existingSet = dbSet;
            setSessionSets((prev) => {
              const copy = new Map(prev);
              copy.set(setKey, dbSet);
              return copy;
            });
          }
        } catch (dbCheckError) {
          // Continue if check fails
        }
      }

      // Validate session exercise ID before creating payload
      if (!sessionExercise.id) {
        console.error("❌ Session exercise missing ID:", sessionExercise);
        return false;
      }

      const setPayload: WorkoutSessionSetCreatePayload = {
        session_exercise_id: sessionExercise.id,
        user_id: userProfile.user_id,
        set_number: setNumber,
        side: finalSide,
        reps: setReps,
        duration_seconds: finalDuration || null,
        rest_seconds: actualRest || null,
        completed: true,
      };

      // Validate payload before saving
      if (!setPayload.session_exercise_id || !setPayload.user_id) {
        console.error(
          "❌ recordCompletedSetCore: Invalid set payload:",
          setPayload
        );
        return false;
      }

      console.log(
        `📝 recordCompletedSetCore: Saving set ${setNumber} - Reps: ${setReps}, Duration: ${finalDuration}s, Rest: ${actualRest}s`
      );

      // Save set record with retry logic
      let savedSet: WorkoutSessionSet | null = null;

      if (existingSet) {
        console.log(
          "📝 recordCompletedSetCore: Updating existing set in database"
        );
        // Update existing set with retry
        const updateResult = await retryDatabaseOperation(
          async () => {
            const success = await workoutSessionContext.updateExerciseSet(
              existingSet.id,
              {
                reps: setReps,
                duration_seconds: finalDuration || null,
                rest_seconds: actualRest || null,
                completed: true,
              }
            );
            if (!success) {
              throw new Error("Failed to update set");
            }
            // Return updated set with new values
            return {
              ...existingSet,
              reps: setReps,
              duration_seconds: finalDuration || null,
              rest_seconds: actualRest || null,
              completed: true,
            };
          },
          "updateExerciseSet",
          3
        );

        if (!updateResult) {
          console.error(
            "❌ recordCompletedSetCore: Failed to update set after retries"
          );
          console.error("Set ID was:", existingSet.id);
          return false;
        }
        savedSet = updateResult;
        console.log(
          "✅ recordCompletedSetCore: Set updated in database:",
          savedSet.id
        );

        // Update local state for updated set
        setSessionSets((prev) => {
          const copy = new Map(prev);
          copy.set(setKey, savedSet!);
          return copy;
        });
      } else {
        // Check database first to prevent duplicate key errors
        try {
          const { data: dbSet, error: dbError } = await supabase
            .from("workout_session_sets")
            .select("*")
            .eq("session_exercise_id", setPayload.session_exercise_id)
            .eq("set_number", setPayload.set_number)
            .eq("side", setPayload.side)
            .maybeSingle();

          if (dbSet && !dbError) {
            // Set already exists in database
            savedSet = dbSet;
            setSessionSets((prev) => {
              const copy = new Map(prev);
              copy.set(setKey, dbSet);
              return copy;
            });
          }
        } catch (dbCheckError) {
          // Continue to creation if check fails
        }

        // If not found in database, create it
        if (!savedSet) {
          console.log(
            "📝 recordCompletedSetCore: Creating new set in database"
          );
          const createResult = await retryDatabaseOperation(
            async () => {
              return await workoutSessionContext.addSetToExercise(setPayload);
            },
            "addSetToExercise",
            3
          );

          if (!createResult) {
            console.error(
              "❌ recordCompletedSetCore: Failed to create set after retries"
            );
            // If creation failed, check database one more time (might have been created by another call)
            try {
              const { data: dbSet, error: dbError } = await supabase
                .from("workout_session_sets")
                .select("*")
                .eq("session_exercise_id", setPayload.session_exercise_id)
                .eq("set_number", setPayload.set_number)
                .eq("side", setPayload.side)
                .maybeSingle();

              if (dbSet && !dbError) {
                savedSet = dbSet;
                setSessionSets((prev) => {
                  const copy = new Map(prev);
                  copy.set(setKey, dbSet);
                  return copy;
                });
              } else {
                console.error("❌ Failed to create set after retries");
                console.error("Set payload was:", setPayload);
                return false;
              }
            } catch (finalCheckError) {
              console.error("Error in final check for set:", finalCheckError);
              return false;
            }
          } else {
            savedSet = createResult;
            console.log(
              "✅ recordCompletedSetCore: Set created in database:",
              createResult.id
            );
          }
        }

        // Validate created set has required fields
        if (!savedSet) {
          console.error(
            "❌ recordCompletedSetCore: Set was not created or found"
          );
          return false;
        }

        if (!savedSet.id || !savedSet.session_exercise_id) {
          console.error(
            "❌ recordCompletedSetCore: Created set missing required fields:",
            savedSet
          );
          return false;
        }

        const finalSavedSet = savedSet; // Type narrowing

        // Update local state only after successful save
        setSessionSets((prev) => {
          const copy = new Map(prev);
          copy.set(setKey, finalSavedSet);
          return copy;
        });
        console.log("✅ recordCompletedSetCore: Set added to local state");
      }

      // Update cumulative on session exercise with retry
      console.log(
        "📝 recordCompletedSetCore: Updating exercise cumulative values"
      );
      const currentActualSets = sessionExercise.actual_sets || 0;
      const currentActualDuration =
        sessionExercise.actual_duration_seconds || 0;
      const currentActualReps = sessionExercise.actual_reps || 0;
      const currentActualRest = sessionExercise.actual_rest_seconds || 0;

      const updateExerciseResult = await retryDatabaseOperation(
        async () => {
          const success = await workoutSessionContext.updateSessionExercise(
            sessionExercise.id,
            {
              actual_sets: currentActualSets + 1,
              actual_duration_seconds:
                currentActualDuration + (finalDuration || 0),
              actual_reps: setReps
                ? currentActualReps + setReps
                : currentActualReps,
              actual_rest_seconds: currentActualRest + (actualRest || 0),
            }
          );
          if (!success) {
            throw new Error("Failed to update session exercise");
          }
          return true;
        },
        "updateSessionExercise",
        3
      );

      if (!updateExerciseResult) {
        console.error(
          "❌ recordCompletedSetCore: Failed to update session exercise after retries"
        );
        // Set was saved but exercise update failed - this is inconsistent state
        // We should still return true since the set was saved, but log the issue
      } else {
        console.log(
          "✅ recordCompletedSetCore: Exercise cumulative values updated"
        );
      }

      // Update local state only after successful database operations
      setSessionExercises((prev) => {
        const newMap = new Map(prev);
        const updated = {
          ...sessionExercise!,
          actual_sets: currentActualSets + 1,
          actual_duration_seconds: currentActualDuration + (finalDuration || 0),
          actual_reps: setReps
            ? currentActualReps + setReps
            : currentActualReps,
          actual_rest_seconds: currentActualRest + (actualRest || 0),
        };
        newMap.set(exerciseKey, updated);
        return newMap;
      });

      console.log(
        "✅ recordCompletedSetCore: Set record complete - Exercise and Set saved to database"
      );
      return true;
    } catch (error) {
      console.error("❌ recordCompletedSetCore: Error recording set:", error);
      return false;
    }
  };

  /**
   * Prints the current session state for debugging.
   */
  const logSessionSummary = () => {};

  const restoreSessionProgress = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        // Query database directly for session with exercises and sets
        const { data: sessionData, error: sessionError } = await supabase
          .from("workout_sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (sessionError || !sessionData) {
          sessionInitializedRef.current = false;
          setActiveSessionId(null);
          return;
        }

        // Fetch exercises for this session
        const { data: exercisesData, error: exercisesError } = await supabase
          .from("workout_session_exercises")
          .select("*")
          .eq("session_id", sessionId)
          .order("order_in_session", { ascending: true });

        if (exercisesError) {
          console.error("Error fetching exercises:", exercisesError);
          setCurrentFlowIndex(0);
          return;
        }

        if (!exercisesData || exercisesData.length === 0) {
          setCurrentFlowIndex(0);
          return;
        }

        // Fetch all sets for these exercises
        const exerciseIds = exercisesData.map((ex) => ex.id);
        const { data: setsData, error: setsError } = await supabase
          .from("workout_session_sets")
          .select("*")
          .in("session_exercise_id", exerciseIds)
          .order("created_at", { ascending: true });

        if (setsError) {
          console.error("Error fetching sets:", setsError);
        }

        // Restore session exercises map and sets map
        const exercisesMap = new Map<string, WorkoutSessionExercise>();
        const setsMap = new Map<string, WorkoutSessionSet>();
        let lastCreatedExercise: WorkoutSessionExercise | null = null;
        let lastCreatedSet: WorkoutSessionSet | null = null;

        exercisesData.forEach((sessionExercise) => {
          // Use composite key for exercises
          const exerciseKey = `${sessionExercise.exercise_id}_${sessionExercise.plan_position}`;
          exercisesMap.set(exerciseKey, sessionExercise);

          // Mark as already added to prevent re-adding
          exercisesAddedRef.current.add(exerciseKey);

          // Track the last created exercise by created_at
          if (
            !lastCreatedExercise ||
            new Date(sessionExercise.created_at) >
              new Date(lastCreatedExercise.created_at)
          ) {
            lastCreatedExercise = sessionExercise;
          }

          // Calculate total workout and rest time from actual values
          if (sessionExercise.actual_duration_seconds) {
            totalWorkoutTimeRef.current +=
              sessionExercise.actual_duration_seconds;
          }
          if (sessionExercise.actual_rest_seconds) {
            totalRestTimeRef.current += sessionExercise.actual_rest_seconds;
          }
        });

        // Process all sets
        if (setsData && setsData.length > 0) {
          setsData.forEach((set) => {
            // Find which exercise this set belongs to
            const parentExercise = exercisesData.find(
              (ex) => ex.id === set.session_exercise_id
            );

            if (parentExercise) {
              const exerciseKey = `${parentExercise.exercise_id}_${parentExercise.plan_position}`;
              const setKey = `${exerciseKey}_${set.set_number}_${set.side ?? "null"}`;
              setsMap.set(setKey, set);

              // Track the last created set by created_at
              if (
                !lastCreatedSet ||
                new Date(set.created_at) > new Date(lastCreatedSet.created_at)
              ) {
                lastCreatedSet = set;
              }
            }
          });
        }

        setSessionExercises(exercisesMap);
        setSessionSets(setsMap);

        // Check if there's any actual progress
        const hasAnyProgress =
          lastCreatedSet !== null || lastCreatedExercise !== null;

        if (!hasAnyProgress) {
          setCurrentFlowIndex(0);
          return;
        }

        // Note: We're restoring progress but not showing "Continue" badge

        // Find the resumption point based on the last created set
        let resumeFlowIndex = 0;
        let foundResume = false;

        if (lastCreatedSet) {
          // Find the exercise this set belongs to
          const lastExercise = exercisesData.find(
            (ex) => ex.id === lastCreatedSet!.session_exercise_id
          );

          if (lastExercise) {
            const currentSet = lastCreatedSet as WorkoutSessionSet;
            const setInfo = {
              number: currentSet.set_number,
              side: currentSet.side,
              completed: currentSet.completed,
              createdAt: currentSet.created_at,
            };

            // Find this exact set in the workout flow
            for (let i = 0; i < workoutFlow.length; i++) {
              const flowItem = workoutFlow[i];
              const flowExerciseKey = `${flowItem.exercise.exercise_id}_${flowItem.exercise.position}`;
              const lastExerciseKey = `${lastExercise.exercise_id}_${lastExercise.plan_position}`;

              if (
                flowExerciseKey === lastExerciseKey &&
                flowItem.setNumber === setInfo.number
              ) {
                const flowSide = !flowItem.exercise.per_side
                  ? null
                  : flowItem.side;

                if (flowSide === setInfo.side) {
                  // Found the exact set that was last worked on
                  if (setInfo.completed) {
                    // Last set was completed, resume at NEXT set
                    resumeFlowIndex = Math.min(i + 1, workoutFlow.length - 1);
                  } else {
                    // Last set was skipped/incomplete, retry it
                    resumeFlowIndex = i;
                  }
                  foundResume = true;
                  break;
                }
              }
            }
          }
        }

        if (!foundResume && lastCreatedExercise) {
          // Fallback: find exercise by plan_position
          const currentExercise = lastCreatedExercise as WorkoutSessionExercise;
          const exerciseInfo = {
            name: currentExercise.exercise_name_snapshot,
            id: currentExercise.exercise_id,
            position: currentExercise.plan_position,
          };

          for (let i = 0; i < workoutFlow.length; i++) {
            const flowItem = workoutFlow[i];
            if (
              flowItem.exercise.exercise_id === exerciseInfo.id &&
              flowItem.exercise.position === exerciseInfo.position
            ) {
              resumeFlowIndex = i;
              foundResume = true;
              break;
            }
          }
        }

        if (!foundResume) {
          resumeFlowIndex = 0;
        }

        const resumeItem = workoutFlow[resumeFlowIndex];

        setCurrentFlowIndex(resumeFlowIndex);
        setStartTimeRef.current = new Date();
      } catch (error) {
        console.error("Error restoring session progress:", error);
      }
    },
    [workoutFlow, workoutSessionContext]
  );

  /**
   * Ends and deletes the current workout session.
   * Removes all session data including exercises and sets from the database.
   * Cleans up all tracking references and local state.
   *
   * @returns {Promise<boolean>} True if session deleted successfully, false otherwise
   */
  const endWorkoutSession = async () => {
    if (!activeSessionId) {
      return false;
    }

    try {
      // Calculate session duration
      const sessionDuration = sessionStartTimeRef.current
        ? Math.floor(
            (new Date().getTime() - sessionStartTimeRef.current.getTime()) /
              1000
          )
        : null;

      // Update session with notes before ending (with retry)
      if (sessionDuration) {
        await retryDatabaseOperation(
          async () => {
            const success =
              await workoutSessionContext.updateActiveWorkoutSession({
                total_duration_seconds: totalWorkoutTimeRef.current,
                notes: `Workout completed. Total workout time: ${totalWorkoutTimeRef.current}s, Rest time: ${totalRestTimeRef.current}s`,
              });
            if (!success) {
              throw new Error("Failed to update workout session");
            }
            return true;
          },
          "updateActiveWorkoutSession",
          3
        );
      }

      // End session with retry
      const success = await retryDatabaseOperation(
        async () => {
          const result = await workoutSessionContext.endActiveWorkoutSession();
          if (!result) {
            throw new Error("Failed to end workout session");
          }
          return result;
        },
        "endActiveWorkoutSession",
        3
      );
      if (success) {
        // Clean up refs
        sessionStartTimeRef.current = null;
        exerciseStartTimeRef.current = null;
        setStartTimeRef.current = null;
        restStartTimeRef.current = null;
        return true;
      } else {
        console.error("Failed to delete workout session");
        return false;
      }
    } catch (error) {
      console.error("Error ending workout session:", error);
      return false;
    }
  };

  const fetchWorkoutData = async () => {
    try {
      console.log("📥 fetchWorkoutData: Starting workout data fetch", {
        planId,
        userId: userProfile?.user_id,
      });
      setIsLoading(true);

      // Validate required data before proceeding
      if (!userProfile?.user_id || !planId) {
        console.error(
          "❌ Cannot fetch workout: missing user profile or plan ID"
        );
        setIsLoading(false);
        return;
      }

      // Get user gender from context
      if (userProfile?.gender) {
        setUserGender(userProfile.gender.toLowerCase());
      }

      // Optimized: Fetch plan and exercises in parallel for faster loading
      const [planDataResult, exercisesResult] = await Promise.all([
        supabase
          .from("workout_plans")
          .select("id, name, level, total_exercises")
          .eq("id", planId)
          .maybeSingle(),
        supabase
          .from("workout_plan_exercises")
          .select(
            `
          exercise_id,
          position,
          section,
          sets,
          reps,
          duration_seconds,
          rest_seconds,
          safety_tip,
          per_side,
          workout_plan_exercises_details (
            id,
            name,
            image_slug,
            default_safety_tip,
            primary_muscle
          )
        `
          )
          .eq("plan_id", planId)
          .order("position", { ascending: true }),
      ]);

      // Validate plan data
      if (planDataResult?.data) {
        setWorkoutPlan(planDataResult.data);
      } else {
        console.error("❌ Workout plan not found");
        setIsLoading(false);
        return;
      }

      const exercisesData = exercisesResult?.data;

      if (exercisesData && exercisesData.length > 0) {
        const formattedExercises: Exercise[] = exercisesData.map((ex: any) => ({
          exercise_id: ex.exercise_id,
          position: ex.position,
          section: ex.section,
          sets: ex.sets,
          reps: ex.reps,
          duration_seconds: ex.duration_seconds,
          rest_seconds: ex.rest_seconds,
          safety_tip: ex.safety_tip,
          per_side: ex.per_side,
          details: ex.workout_plan_exercises_details || null,
        }));
        setExercises(formattedExercises);

        setIsLoading(false);

        // Show countdown before starting session
        console.log(
          "📥 fetchWorkoutData: Showing countdown before starting session"
        );
        await showStartCountdown();

        // Start workout session after countdown - this will create a NEW session
        console.log("📥 fetchWorkoutData: Starting new workout session");
        const newSessionId = await startWorkoutSession();
        if (newSessionId) {
          console.log(
            "✅ fetchWorkoutData: New workout session created successfully:",
            newSessionId
          );
        } else {
          console.error(
            "❌ fetchWorkoutData: Failed to create new workout session"
          );
        }
      } else {
        console.error("❌ No exercises found for this workout plan");
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error("Error fetching workout data:", error);
      setIsLoading(false);
    }
  };

  const showStartCountdown = async (): Promise<void> => {
    // Show 3-second countdown
    return new Promise((resolve) => {
      setIsStartingWorkout(true);
      setStartCountdown(3);

      let countdown = 3;
      const countdownInterval = setInterval(() => {
        countdown--;
        setStartCountdown(countdown);

        if (countdown <= 0) {
          clearInterval(countdownInterval);
          setIsStartingWorkout(false);
          resolve();
        }
      }, 1000);
    });
  };

  /**
   * When the flow item changes, ensure the exercise is created first.
   * This ensures Skip/Next can safely reference it.
   */
  useEffect(() => {
    const currentItem = workoutFlow[currentFlowIndex];
    if (!currentItem || !activeSessionId || !userProfile?.user_id) return;

    if (isClearingSessionRef.current) return;
    if (isRestarting) return; // Don't create exercises during restart

    const { exercise, exerciseOrder, setNumber } = currentItem;
    const exerciseKey = `${exercise.exercise_id}_${exercise.position}`;

    // Ensure exercise is created for set 1 (first set of each exercise)
    if (setNumber === 1 && !exercisesAddedRef.current.has(exerciseKey)) {
      ensureExerciseExists(exercise, exerciseOrder).catch((error) => {
        console.error("Error ensuring exercise exists in session:", error);
      });
    }

    if (!isResting) {
      setStartTimeRef.current = new Date();
    }
  }, [
    currentFlowIndex,
    activeSessionId,
    userProfile?.user_id,
    workoutFlow,
    isResting,
    isRestarting,
  ]);

  const getExerciseImageUrl = (section: string, imageSlug: string): string => {
    const baseUrl =
      "https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/exercises/";
    return `${baseUrl}${normalizedGender}/${section}/${imageSlug}.png`;
  };

  /**
   * NEXT
   * Always ensure the exercise exists, then record set or skip rest.
   */
  const handleNext = useCallback(
    async (isAutoAdvance: boolean = false) => {
      if (isGoingNext || isSkipping || isGoingPrevious || isRestarting) return;

      // Get session ID from state or context (context is more reliable during state updates)
      let sessionId = activeSessionId;
      if (!sessionId) {
        const contextSession = workoutSessionContext.activeWorkoutSession;
        if (contextSession?.id) {
          sessionId = contextSession.id;
          // Update state to keep them in sync
          setActiveSessionId(sessionId);
          console.log("🔄 handleNext: Got session ID from context:", sessionId);
        }
      }

      // Validate session is active
      if (!sessionId) {
        console.error("❌ handleNext: No active session ID", {
          stateSessionId: activeSessionId,
          contextSessionId: workoutSessionContext.activeWorkoutSession?.id,
        });
        setToast({ type: "error", message: "No active workout session" });
        return;
      }

      if (!userProfile?.user_id) {
        console.error("❌ handleNext: No user profile");
        return;
      }

      const currentItem = workoutFlow[currentFlowIndex];
      if (!currentItem) {
        console.error("❌ No current item found");
        return;
      }

      if (!isAutoAdvance) setIsGoingNext(true);

      try {
        const { exercise, setNumber, isRestAfter } = currentItem;

        // If we are in rest, just move forward and capture actual rest
        if (isResting) {
          let actualRest: number | undefined;
          if (exercise.rest_seconds && restStartTimeRef.current) {
            const elapsed = Math.floor(
              (new Date().getTime() - restStartTimeRef.current.getTime()) / 1000
            );
            actualRest = elapsed;
          }

          // Ensure session exercise exists and is available before recording
          console.log("⏭️ NEXT (Rest): Ensuring exercise exists in database");
          const sessionExerciseId = await ensureExerciseExists(
            exercise,
            currentItem.exerciseOrder
          );

          if (!sessionExerciseId) {
            console.error(
              "❌ NEXT (Rest): Failed to create exercise before recording rest"
            );
            setToast({ type: "error", message: "Failed to create exercise" });
            setIsGoingNext(false);
            return;
          }

          console.log(
            "✅ NEXT (Rest): Exercise record exists:",
            sessionExerciseId
          );

          // Record the rest as part of the same set (duration handled in record)
          console.log(
            `⏭️ NEXT (Rest): Recording rest time for set ${setNumber}`
          );
          const restRecorded = await recordCompletedSet(
            exercise,
            setNumber,
            undefined,
            actualRest,
            currentItem.side
          );

          if (restRecorded) {
            console.log("✅ NEXT (Rest): Rest time recorded successfully");
          } else {
            console.error("❌ NEXT (Rest): Failed to record rest time");
          }

          setIsResting(false);
          setCurrentFlowIndex((i) => Math.min(i + 1, workoutFlow.length - 1));
          setIsGoingNext(false);
          return;
        }

        // Ensure session exercise exists and is available before proceeding
        console.log("⏭️ NEXT: Ensuring exercise exists in database");
        const sessionExerciseId = await ensureExerciseExists(
          exercise,
          currentItem.exerciseOrder
        );

        if (!sessionExerciseId) {
          console.error(
            "❌ NEXT: Failed to create exercise before recording set"
          );
          setToast({ type: "error", message: "Failed to create exercise" });
          setIsGoingNext(false);
          return;
        }

        console.log(
          "✅ NEXT: Exercise record created in database:",
          sessionExerciseId
        );

        // Compute actual duration if needed
        let actualDuration: number | undefined;
        if (exercise.duration_seconds && setStartTimeRef.current) {
          const elapsed = Math.floor(
            (new Date().getTime() - setStartTimeRef.current.getTime()) / 1000
          );
          actualDuration = elapsed;
        }

        // Record this set
        console.log(`⏭️ NEXT: Recording set ${setNumber} for exercise`);
        const setRecorded = await recordCompletedSet(
          exercise,
          setNumber,
          actualDuration,
          undefined,
          currentItem.side
        );

        if (setRecorded) {
          console.log("✅ NEXT: Set record created in database successfully");
        } else {
          console.error("❌ NEXT: Failed to create set record");
        }

        // If rest follows, enter rest state; else advance
        if (isRestAfter && exercise.rest_seconds) {
          setIsResting(true);
          restStartTimeRef.current = new Date();
          setTimer(exercise.rest_seconds);
        } else {
          setCurrentFlowIndex((i) => Math.min(i + 1, workoutFlow.length - 1));
        }
      } catch (err) {
        console.error("Error in handleNext:", err);
      } finally {
        if (!isAutoAdvance) setIsGoingNext(false);
      }
    },
    [
      isGoingNext,
      isSkipping,
      isGoingPrevious,
      isRestarting,
      workoutFlow,
      currentFlowIndex,
      isResting,
      activeSessionId,
      userProfile?.user_id,
      setToast,
    ]
  );

  // Handle auto-advance when timer reaches 0
  useEffect(() => {
    // Only trigger auto-advance if we have an active session
    if (shouldTriggerNext && activeSessionId && !isRestarting) {
      setShouldTriggerNext(false);
      handleNext(true); // Pass true to indicate auto-advance (no loader)
    } else if (shouldTriggerNext && !activeSessionId) {
      // If no session, just clear the flag
      setShouldTriggerNext(false);
    }
  }, [shouldTriggerNext, handleNext, activeSessionId, isRestarting]);

  /**
   * PREVIOUS
   * - If going back within same exercise and set >= 2: delete only the current set record
   * - If going back to set 1 of same exercise: delete exercise and all its sets
   * - If going back across exercises: delete all succeeding sets/exercises
   */
  const handlePrevious = async () => {
    if (
      currentFlowIndex === 0 ||
      isGoingPrevious ||
      isSkipping ||
      isGoingNext
    ) {
      return;
    }

    console.log("⏮️ PREVIOUS: Starting previous action");
    setIsGoingPrevious(true);

    try {
      const currentItem = workoutFlow[currentFlowIndex];
      const currentExerciseId = currentItem.exercise.exercise_id;
      const currentExercisePosition = currentItem.exercise.position;
      const currentSetNumber = currentItem.setNumber;

      // Check if previous item is same exercise
      const previousItem = workoutFlow[currentFlowIndex - 1];
      const isSameExercise =
        previousItem &&
        previousItem.exercise.exercise_id === currentExerciseId &&
        previousItem.exercise.position === currentExercisePosition;

      // Case 1: Same exercise, set >= 2 -> delete only current set
      if (isSameExercise && currentSetNumber >= 2) {
        console.log(
          `⏮️ PREVIOUS: Same exercise, set ${currentSetNumber} -> deleting only current set`
        );

        const exerciseKey = `${currentExerciseId}_${currentExercisePosition}`;
        const sessionExercise = sessionExercises.get(exerciseKey);

        if (sessionExercise) {
          // Find and delete only the current set
          const setKey = `${exerciseKey}_${currentSetNumber}_${currentItem.side ?? "null"}`;
          const currentSet = sessionSets.get(setKey);

          if (currentSet) {
            console.log(
              `🗑️ PREVIOUS: Deleting set ${currentSetNumber} from database`
            );
            const { error: deleteError } = await supabase
              .from("workout_session_sets")
              .delete()
              .eq("id", currentSet.id);

            if (deleteError) {
              console.error("❌ PREVIOUS: Error deleting set:", deleteError);
            } else {
              console.log("✅ PREVIOUS: Set deleted successfully");
            }

            // Remove from local state
            setSessionSets((prev) => {
              const copy = new Map(prev);
              copy.delete(setKey);
              return copy;
            });

            // Update exercise cumulative values
            const currentActualSets = sessionExercise.actual_sets || 0;
            if (currentActualSets > 0) {
              await retryDatabaseOperation(
                async () => {
                  const success =
                    await workoutSessionContext.updateSessionExercise(
                      sessionExercise.id,
                      {
                        actual_sets: Math.max(0, currentActualSets - 1),
                        actual_reps: Math.max(
                          0,
                          (sessionExercise.actual_reps || 0) -
                            (currentItem.exercise.reps || 0)
                        ),
                        actual_duration_seconds: Math.max(
                          0,
                          (sessionExercise.actual_duration_seconds || 0) -
                            (currentSet.duration_seconds || 0)
                        ),
                        actual_rest_seconds: Math.max(
                          0,
                          (sessionExercise.actual_rest_seconds || 0) -
                            (currentSet.rest_seconds || 0)
                        ),
                      }
                    );
                  if (!success) {
                    throw new Error("Failed to update exercise");
                  }
                  return true;
                },
                "updateExerciseAfterSetDelete",
                3
              );
            }
          }
        }

        // Move to previous set
        setCurrentFlowIndex(currentFlowIndex - 1);
        setIsResting(false);
        setToast({ type: "info", message: "Moved back one set" });
        setIsGoingPrevious(false);
        return;
      }

      // Case 2: Same exercise, set 1 -> delete exercise and all its sets
      if (isSameExercise && currentSetNumber === 1) {
        console.log(
          `⏮️ PREVIOUS: Same exercise, set 1 -> deleting exercise and all sets`
        );

        const exerciseKey = `${currentExerciseId}_${currentExercisePosition}`;
        const sessionExercise = sessionExercises.get(exerciseKey);

        if (sessionExercise) {
          // Delete all sets for this exercise first
          console.log("🗑️ PREVIOUS: Deleting all sets for exercise");
          const { error: deleteSetsError } = await supabase
            .from("workout_session_sets")
            .delete()
            .eq("session_exercise_id", sessionExercise.id);

          if (deleteSetsError) {
            console.error("❌ PREVIOUS: Error deleting sets:", deleteSetsError);
          } else {
            console.log("✅ PREVIOUS: All sets deleted");
          }

          // Delete the exercise
          console.log("🗑️ PREVIOUS: Deleting exercise record");
          const { error: deleteExerciseError } = await supabase
            .from("workout_session_exercises")
            .delete()
            .eq("id", sessionExercise.id);

          if (deleteExerciseError) {
            console.error(
              "❌ PREVIOUS: Error deleting exercise:",
              deleteExerciseError
            );
          } else {
            console.log("✅ PREVIOUS: Exercise record deleted");
          }

          // Clear from local state
          exercisesAddedRef.current.delete(exerciseKey);
          setSessionExercises((prev) => {
            const copy = new Map(prev);
            copy.delete(exerciseKey);
            return copy;
          });

          // Clear sets from local state
          setSessionSets((prev) => {
            const copy = new Map(prev);
            for (const [key, set] of copy.entries()) {
              if (set.session_exercise_id === sessionExercise.id) {
                copy.delete(key);
              }
            }
            return copy;
          });
        }

        // Move to previous set (which will be set 1, but exercise is now deleted)
        setCurrentFlowIndex(currentFlowIndex - 1);
        setIsResting(false);
        setToast({ type: "info", message: "Moved back, exercise reset" });
        setIsGoingPrevious(false);
        return;
      }

      // Case 2 & 3: Going back to set 1 or different exercise -> delete all succeeding records
      console.log("⏮️ PREVIOUS: Going back to set 1 or different exercise");

      // Find Set 1 of the previous distinct exercise
      let targetIndex = -1;
      let previousExerciseId = "";
      let previousExercisePosition = -1;

      for (let i = currentFlowIndex - 1; i >= 0; i--) {
        const item = workoutFlow[i];
        if (
          item.exercise.exercise_id !== currentExerciseId ||
          item.exercise.position !== currentExercisePosition
        ) {
          previousExerciseId = item.exercise.exercise_id;
          previousExercisePosition = item.exercise.position;

          for (let j = i; j >= 0; j--) {
            const checkItem = workoutFlow[j];
            if (
              checkItem.exercise.exercise_id === previousExerciseId &&
              checkItem.exercise.position === previousExercisePosition &&
              checkItem.setNumber === 1
            ) {
              targetIndex = j;
              break;
            }
          }
          break;
        }
      }

      if (targetIndex === -1) targetIndex = 0;

      // Build set of exercise keys to reset from targetIndex → end
      console.log(
        `⏮️ PREVIOUS: Deleting all records from index ${targetIndex} to end`
      );
      const exercisesToReset = new Set<string>();
      for (let i = targetIndex; i < workoutFlow.length; i++) {
        const item = workoutFlow[i];
        const exKey = `${item.exercise.exercise_id}_${item.exercise.position}`;
        exercisesToReset.add(exKey);
      }

      console.log(
        `⏮️ PREVIOUS: Found ${exercisesToReset.size} exercises to reset`
      );

      // Delete sets and reset each exercise (DB-first to keep UI in sync)
      for (const exKey of exercisesToReset) {
        const sessionExercise = sessionExercises.get(exKey);

        if (sessionExercise) {
          console.log(
            `🗑️ PREVIOUS: Deleting all sets for exercise: ${sessionExercise.exercise_name_snapshot}`
          );

          // 1) Delete all sets for this exercise from database
          const { error: deleteError } = await supabase
            .from("workout_session_sets")
            .delete()
            .eq("session_exercise_id", sessionExercise.id)
            .select();

          if (deleteError) {
            console.error(
              `❌ PREVIOUS: Error deleting sets for ${sessionExercise.exercise_name_snapshot}:`,
              deleteError
            );
          } else {
            console.log(
              `✅ PREVIOUS: All sets deleted for ${sessionExercise.exercise_name_snapshot}`
            );
          }

          // 2) Clear sets from local state for this exercise
          setSessionSets((prev) => {
            const copy = new Map(prev);
            // Remove all sets for this exercise
            for (const [key, set] of copy.entries()) {
              if (set.session_exercise_id === sessionExercise.id) {
                copy.delete(key);
              }
            }
            return copy;
          });

          // 3) Reset cumulative fields with retry
          const resetResult = await retryDatabaseOperation(
            async () => {
              const success = await workoutSessionContext.updateSessionExercise(
                sessionExercise.id,
                {
                  actual_sets: 0,
                  actual_reps: 0,
                  actual_duration_seconds: 0,
                  actual_rest_seconds: 0,
                }
              );
              if (!success) {
                throw new Error("Failed to reset exercise");
              }
              return true;
            },
            "resetExerciseInPrevious",
            3
          );

          if (!resetResult) {
            console.error(
              `❌ PREVIOUS: Failed to reset exercise ${sessionExercise.exercise_name_snapshot} after retries`
            );
          } else {
            console.log(
              `✅ PREVIOUS: Exercise ${sessionExercise.exercise_name_snapshot} reset successfully`
            );
          }
        }
      }

      // If going all the way back to index 0 (set 1 of first exercise),
      // remove the session_exercise itself so it's clean like new.
      if (targetIndex === 0) {
        console.log(
          "⏮️ PREVIOUS: Going back to first set - deleting exercise record"
        );
        const firstItem = workoutFlow[0];
        const firstKey = `${firstItem.exercise.exercise_id}_${firstItem.exercise.position}`;
        const se = sessionExercises.get(firstKey);

        if (se) {
          // Delete all sets for this exercise first
          console.log("🗑️ PREVIOUS: Deleting all sets for first exercise");
          const { error: deleteSetsError } = await supabase
            .from("workout_session_sets")
            .delete()
            .eq("session_exercise_id", se.id);

          if (deleteSetsError) {
            console.error(
              "❌ PREVIOUS: Error deleting sets for first exercise:",
              deleteSetsError
            );
          } else {
            console.log("✅ PREVIOUS: Sets deleted for first exercise");
          }

          // Delete the exercise
          console.log("🗑️ PREVIOUS: Deleting first exercise record");
          const { error: deleteExerciseError } = await supabase
            .from("workout_session_exercises")
            .delete()
            .eq("id", se.id);

          if (deleteExerciseError) {
            console.error(
              "❌ PREVIOUS: Error deleting first exercise:",
              deleteExerciseError
            );
          } else {
            console.log("✅ PREVIOUS: First exercise record deleted");
          }

          // Clear from local state
          exercisesAddedRef.current.delete(firstKey);
          setSessionExercises((prev) => {
            const copy = new Map(prev);
            copy.delete(firstKey);
            return copy;
          });

          // Clear sets from local state
          setSessionSets((prev) => {
            const copy = new Map(prev);
            for (const [key, set] of copy.entries()) {
              if (set.session_exercise_id === se.id) {
                copy.delete(key);
              }
            }
            return copy;
          });
        }
      }

      // Move index
      console.log(`⏮️ PREVIOUS: Moving to index ${targetIndex}`);
      setCurrentFlowIndex(targetIndex);
      setIsResting(false);
      setToast({ type: "info", message: "Moved back" });
    } catch (e) {
      console.error("Error in handlePrevious:", e);
      setToast({ type: "error", message: "Failed to go back" });
    } finally {
      setIsGoingPrevious(false);
    }
  };

  /**
   * SKIP
   * Records the exercise and all remaining sets as skipped (completed: false).
   */
  const handleSkip = useCallback(async () => {
    if (isSkipping || isGoingNext || isGoingPrevious || isRestarting) return;

    setIsSkipping(true);

    try {
      // Get session ID from state or context (context is more reliable during state updates)
      let sessionId = activeSessionId;
      if (!sessionId) {
        const contextSession = workoutSessionContext.activeWorkoutSession;
        if (contextSession?.id) {
          sessionId = contextSession.id;
          // Update state to keep them in sync
          setActiveSessionId(sessionId);
          console.log("🔄 handleSkip: Got session ID from context:", sessionId);
        }
      }

      // Validate prerequisites
      if (!sessionId) {
        console.error("❌ handleSkip: No active session ID", {
          stateSessionId: activeSessionId,
          contextSessionId: workoutSessionContext.activeWorkoutSession?.id,
        });
        setToast({ type: "error", message: "No active workout session" });
        setIsSkipping(false);
        return;
      }

      if (!userProfile?.user_id) {
        console.error("❌ handleSkip: No user profile");
        setToast({ type: "error", message: "User not logged in" });
        setIsSkipping(false);
        return;
      }

      const currentItem = workoutFlow[currentFlowIndex];
      if (!currentItem) {
        console.error("❌ handleSkip: No current item in workout flow");
        setIsSkipping(false);
        return;
      }

      const { exercise, setNumber } = currentItem;
      const exerciseKey = `${exercise.exercise_id}_${exercise.position}`;

      // Ensure session exercise exists and is available before skipping
      console.log(
        "⏭️ SKIP: Ensuring exercise exists in database:",
        exerciseKey
      );
      const sessionExerciseId = await ensureExerciseExists(
        exercise,
        currentItem.exerciseOrder
      );

      if (!sessionExerciseId) {
        console.error("❌ SKIP: Failed to create exercise", {
          exerciseKey,
          exerciseId: exercise.exercise_id,
          position: exercise.position,
          sessionId: sessionId,
          stateSessionId: activeSessionId,
          contextSessionId: workoutSessionContext.activeWorkoutSession?.id,
        });
        setToast({ type: "error", message: "Failed to create exercise" });
        setIsSkipping(false);
        return;
      }

      console.log(
        "✅ SKIP: Exercise record created in database:",
        sessionExerciseId
      );

      // Verify exercise is in state (with retry)
      let sessionExercise = sessionExercises.get(exerciseKey);
      if (
        !sessionExercise ||
        !sessionExercise.id ||
        !sessionExercise.session_id
      ) {
        // Wait a bit and check again (state might be updating)
        await new Promise((resolve) => setTimeout(resolve, 100));
        sessionExercise = sessionExercises.get(exerciseKey);
      }

      if (
        !sessionExercise ||
        !sessionExercise.id ||
        !sessionExercise.session_id
      ) {
        // If still not in state, try to fetch from database
        try {
          const { data: dbExercise, error: dbError } = await supabase
            .from("workout_session_exercises")
            .select("*")
            .eq("id", sessionExerciseId)
            .maybeSingle();

          if (dbExercise && !dbError) {
            // Update state with the exercise
            exercisesAddedRef.current.add(exerciseKey);
            setSessionExercises((prev) => {
              const newMap = new Map(prev);
              newMap.set(exerciseKey, dbExercise);
              return newMap;
            });
            sessionExercise = dbExercise;
          }
        } catch (fetchError) {
          console.error(
            "❌ handleSkip: Error fetching exercise from database:",
            fetchError
          );
        }
      }

      if (
        !sessionExercise ||
        !sessionExercise.id ||
        !sessionExercise.session_id
      ) {
        console.error(
          "❌ handleSkip: Session exercise not available after all attempts",
          {
            exerciseKey,
            sessionExerciseId,
            hasInState: !!sessionExercises.get(exerciseKey),
          }
        );
        setToast({ type: "error", message: "Exercise not available" });
        setIsSkipping(false);
        return;
      }

      // Find all remaining sets for this exercise (current set + all future sets)
      const remainingSets: WorkoutFlowItem[] = [];
      let nextIndex = currentFlowIndex;

      // Include current set and all future sets for this exercise
      while (nextIndex < workoutFlow.length) {
        const item = workoutFlow[nextIndex];
        if (
          item.exercise.exercise_id !== exercise.exercise_id ||
          item.exercise.position !== exercise.position
        ) {
          break;
        }
        remainingSets.push(item);
        nextIndex++;
      }

      // Record all remaining sets as skipped sequentially to avoid race conditions
      console.log(`⏭️ SKIP: Recording ${remainingSets.length} sets as skipped`);
      for (const item of remainingSets) {
        try {
          console.log(`⏭️ SKIP: Recording set ${item.setNumber} as skipped`);
          await recordSkippedSet(item.exercise, item.setNumber, item.side);
          console.log(`✅ SKIP: Set ${item.setNumber} recorded as skipped`);
        } catch (error) {
          console.error(
            `❌ SKIP: Error recording set ${item.setNumber}:`,
            error
          );
          // Continue on error
        }
      }

      console.log("✅ SKIP: All sets recorded, advancing to next exercise");
      // Advance to next exercise
      setIsResting(false);
      setCurrentFlowIndex(nextIndex);
      setToast({ type: "success", message: "Exercise skipped" });
    } catch (e) {
      console.error("Error skipping exercise:", e);
      setToast({ type: "error", message: "Failed to skip exercise" });
    } finally {
      setIsSkipping(false);
    }
  }, [
    isSkipping,
    isGoingNext,
    isGoingPrevious,
    isRestarting,
    workoutFlow,
    currentFlowIndex,
    activeSessionId,
    userProfile?.user_id,
    sessionExercises,
    setToast,
  ]);

  /**
   * Records a skipped set with completed: false.
   * This tracks that the set was attempted but not completed.
   *
   * @param {Exercise} exercise - The exercise being skipped
   * @param {number} setNumber - The set number (1-based)
   * @param {string} side - Side from flow item ('left', 'right', or 'both')
   */
  const recordSkippedSet = async (
    exercise: Exercise,
    setNumber: number,
    side: "left" | "right" | "both" = "both"
  ): Promise<void> => {
    // Get session ID from state or context
    let sessionId = activeSessionId;
    if (!sessionId) {
      const contextSession = workoutSessionContext.activeWorkoutSession;
      if (contextSession?.id) {
        sessionId = contextSession.id;
        setActiveSessionId(sessionId);
      }
    }

    if (!sessionId || !userProfile?.user_id) {
      return;
    }

    // Direct call with timeout protection
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("Record skipped set timeout")), 5000)
    );

    try {
      await Promise.race([
        recordSkippedSetCore(exercise, setNumber, side),
        timeoutPromise,
      ]);
    } catch (error: any) {
      if (error?.message !== "Record skipped set timeout") {
        throw error; // Re-throw other errors
      }
    }
  };

  const recordSkippedSetCore = async (
    exercise: Exercise,
    setNumber: number,
    side: "left" | "right" | "both" = "both"
  ): Promise<void> => {
    // Get session ID from state or context
    let sessionId = activeSessionId;
    if (!sessionId) {
      const contextSession = workoutSessionContext.activeWorkoutSession;
      if (contextSession?.id) {
        sessionId = contextSession.id;
        setActiveSessionId(sessionId);
      }
    }

    if (!sessionId || !userProfile?.user_id) {
      return;
    }

    // Use composite key to find the correct session exercise
    const exerciseKey = `${exercise.exercise_id}_${exercise.position}`;
    let sessionExercise = sessionExercises.get(exerciseKey);

    // Ensure session exercise exists - create if not found
    if (!sessionExercise) {
      // First try to get from database
      try {
        const { data: dbExercise, error: dbError } = await supabase
          .from("workout_session_exercises")
          .select("*")
          .eq("session_id", sessionId)
          .eq("exercise_id", exercise.exercise_id)
          .eq("plan_position", exercise.position)
          .maybeSingle();

        if (dbExercise && !dbError) {
          sessionExercise = dbExercise;
          setSessionExercises((prev) => {
            const newMap = new Map(prev);
            newMap.set(exerciseKey, dbExercise);
            return newMap;
          });
        }
      } catch (dbQueryError) {
        console.error("Error querying database for exercise:", dbQueryError);
      }

      // If still not found, create it
      if (!sessionExercise) {
        const currentItem = workoutFlow[currentFlowIndex];
        if (!currentItem) {
          return;
        }

        const sessionExerciseId = await addExerciseToSession(
          exercise,
          currentItem.exerciseOrder
        );

        if (!sessionExerciseId) {
          return;
        }

        // Get the created exercise - check state first, then database
        sessionExercise = sessionExercises.get(exerciseKey);

        if (!sessionExercise) {
          // Wait a brief moment for state to update
          await new Promise((resolve) => setTimeout(resolve, 50));
          sessionExercise = sessionExercises.get(exerciseKey);
        }

        if (!sessionExercise) {
          // Query database directly using the ID we got back
          const { data: dbExercise, error: dbError } = await supabase
            .from("workout_session_exercises")
            .select("*")
            .eq("id", sessionExerciseId)
            .maybeSingle();

          if (dbExercise && !dbError) {
            sessionExercise = dbExercise;
            setSessionExercises((prev) => {
              const newMap = new Map(prev);
              newMap.set(exerciseKey, dbExercise);
              return newMap;
            });
            exercisesAddedRef.current.add(exerciseKey);
          }
        }

        if (!sessionExercise) {
          return;
        }
      }
    }

    // Validate session exercise has required fields
    if (!sessionExercise.id || !sessionExercise.session_id) {
      console.error(
        `❌ Session exercise missing required fields:`,
        sessionExercise
      );
      return;
    }

    try {
      // Determine the correct side value
      const finalSide = !exercise.per_side ? null : side;

      // Create a unique key for this specific set
      const setKey = `${exerciseKey}_${setNumber}_${finalSide ?? "null"}`;
      const existingSet = sessionSets.get(setKey);

      // Validate session exercise ID before creating payload
      if (!sessionExercise.id) {
        console.error(
          "❌ recordSkippedSetCore: Session exercise missing ID:",
          sessionExercise
        );
        return;
      }

      console.log(
        `⏭️ recordSkippedSetCore: Creating skipped set record - Set ${setNumber}, Side: ${finalSide ?? "null"}`
      );

      const setPayload: WorkoutSessionSetCreatePayload = {
        session_exercise_id: sessionExercise.id,
        user_id: userProfile.user_id,
        set_number: setNumber,
        side: finalSide,
        reps: null, // Not performed
        duration_seconds: null, // Not performed
        rest_seconds: null,
        completed: false, // Mark as not completed
      };

      // Validate payload before saving
      if (!setPayload.session_exercise_id || !setPayload.user_id) {
        console.error(
          "❌ recordSkippedSetCore: Invalid skipped set payload:",
          setPayload
        );
        return;
      }

      if (existingSet) {
        console.log(
          "⏭️ recordSkippedSetCore: Updating existing set to skipped"
        );
        // Update existing set to mark as incomplete with retry
        const updateResult = await retryDatabaseOperation(
          async () => {
            const success = await workoutSessionContext.updateExerciseSet(
              existingSet.id,
              {
                completed: false,
                reps: null,
                duration_seconds: null,
              }
            );
            if (!success) {
              throw new Error("Failed to update skipped set");
            }
            return true;
          },
          "updateSkippedSet",
          3
        );

        if (!updateResult) {
          console.error(
            "❌ recordSkippedSetCore: Failed to update skipped set after retries"
          );
        } else {
          console.log(
            "✅ recordSkippedSetCore: Set updated to skipped in database"
          );
        }
      } else {
        // Check database first to prevent duplicate key errors
        let createdSet: WorkoutSessionSet | null = null;

        try {
          const { data: dbSet, error: dbError } = await supabase
            .from("workout_session_sets")
            .select("*")
            .eq("session_exercise_id", setPayload.session_exercise_id)
            .eq("set_number", setPayload.set_number)
            .eq("side", setPayload.side)
            .maybeSingle();

          if (dbSet && !dbError) {
            // Set already exists in database
            createdSet = dbSet;
            setSessionSets((prev) => {
              const newMap = new Map(prev);
              newMap.set(setKey, dbSet);
              return newMap;
            });
          }
        } catch (dbCheckError) {
          // Continue to creation if check fails
        }

        // If not found in database, create it
        if (!createdSet) {
          console.log(
            "⏭️ recordSkippedSetCore: Creating new skipped set in database"
          );
          const createResult = await retryDatabaseOperation(
            async () => {
              return await workoutSessionContext.addSetToExercise(setPayload);
            },
            "addSkippedSet",
            3
          );

          if (!createResult) {
            console.error(
              "❌ recordSkippedSetCore: Failed to create skipped set"
            );
            // If creation failed, check database one more time (might have been created by another call)
            try {
              const { data: dbSet, error: dbError } = await supabase
                .from("workout_session_sets")
                .select("*")
                .eq("session_exercise_id", setPayload.session_exercise_id)
                .eq("set_number", setPayload.set_number)
                .eq("side", setPayload.side)
                .maybeSingle();

              if (dbSet && !dbError) {
                createdSet = dbSet;
                setSessionSets((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(setKey, dbSet);
                  return newMap;
                });
              } else {
                console.error("❌ Failed to create skipped set after retries");
                return;
              }
            } catch (finalCheckError) {
              console.error(
                "Error in final check for skipped set:",
                finalCheckError
              );
              return;
            }
          } else {
            createdSet = createResult;
            console.log(
              "✅ recordSkippedSetCore: Skipped set created in database:",
              createResult.id
            );
          }
        }

        if (createdSet) {
          // Validate created set has required fields
          if (!createdSet.id || !createdSet.session_exercise_id) {
            console.error(
              "❌ recordSkippedSetCore: Created skipped set missing required fields:",
              createdSet
            );
            return;
          }

          setSessionSets((prev) => {
            const newMap = new Map(prev);
            newMap.set(setKey, createdSet);
            return newMap;
          });
          console.log(
            "✅ recordSkippedSetCore: Skipped set added to local state"
          );
        } else {
          console.error(
            "❌ recordSkippedSetCore: Failed to create skipped set after retries"
          );
        }
      }

      // Note: We don't update the cumulative values in session_exercise for skipped sets
      // Only completed sets contribute to actual_sets, actual_reps, etc.
      console.log("✅ recordSkippedSetCore: Skipped set record complete");
    } catch (error) {
      console.error(
        "❌ recordSkippedSetCore: Error recording skipped set:",
        error
      );
    }
  };

  /**
   * Handles showing the exit confirmation modal.
   * Gives users options to continue or end the workout.
   */
  const handleBackPress = () => {
    setIsPaused(true); // Pause the timer
    setShowExitConfirmation(true);
  };

  /**
   * Handles pause/resume toggle.
   */
  const handlePauseToggle = () => {
    setIsPaused(!isPaused);
  };

  /**
   * Handles finishing the entire workout.
   * Records the final set, ends the session, and navigates back.
   */
  const handleFinish = async () => {
    // Prevent multiple simultaneous finish operations
    if (isQuitting) {
      return;
    }

    setIsQuitting(true);

    try {
      // Record the last set if not already recorded and not in rest period
      const currentItem = workoutFlow[currentFlowIndex];
      if (currentItem && !isResting) {
        // Ensure session exercise exists and is available before recording
        const sessionExerciseId = await ensureExerciseExists(
          currentItem.exercise,
          currentItem.exerciseOrder
        );

        if (sessionExerciseId) {
          let actualDuration: number | undefined;
          if (
            currentItem.exercise.duration_seconds &&
            setStartTimeRef.current
          ) {
            const elapsed = Math.floor(
              (new Date().getTime() - setStartTimeRef.current.getTime()) / 1000
            );
            actualDuration = elapsed;
          }

          const finalSetRecorded = await recordCompletedSet(
            currentItem.exercise,
            currentItem.setNumber,
            actualDuration,
            undefined,
            currentItem.side
          );

          if (!finalSetRecorded) {
            // Failed to record final set, but continuing
          }
        }
      }

      // Log final session summary
      logSessionSummary();

      // End the workout session
      const ended = await endWorkoutSession();

      if (ended) {
      }

      // Navigate back
      router.replace({
        pathname: "/(tabs)/workout-details",
        params: { id: planId, refresh: Date.now().toString() },
      });
    } catch (error) {
      console.error("❌ Error finishing workout:", error);

      // Still navigate even if there's an error
      router.replace({
        pathname: "/(tabs)/workout-details",
        params: { id: planId, refresh: Date.now().toString() },
      });
    }
  };

  /**
   * END WORKOUT
   * Navigate away immediately; delete session in background.
   */
  const handleEndWorkout = async () => {
    if (isQuitting || isRestarting) return;

    console.log("🛑 END WORKOUT: Starting end workout process");
    setIsQuitting(true);

    try {
      const sessionId = activeSessionId;
      console.log("🛑 END WORKOUT: Session ID to delete:", sessionId);

      setShowExitConfirmation(false);

      // Clear state immediately before navigation to prevent stuck loader
      console.log("🛑 END WORKOUT: Clearing state immediately");
      setActiveSessionId(null);
      workoutSessionContext.setActiveWorkoutSession(null);
      exercisesAddedRef.current.clear();
      setSessionExercises(new Map());
      setSessionSets(new Map());
      sessionInitializedRef.current = false;
      setCurrentFlowIndex(0); // Reset to first exercise for next start
      setIsResting(false);
      setIsPaused(false);
      setTimer(0);
      totalWorkoutTimeRef.current = 0;
      totalRestTimeRef.current = 0;
      exerciseStartTimeRef.current = null;
      setStartTimeRef.current = null;
      restStartTimeRef.current = null;
      shouldAutoAdvanceRef.current = false;
      setIsQuitting(false); // Reset immediately so component can be reused

      // Navigate first for snappy UX
      console.log("🛑 END WORKOUT: Navigating away");
      router.replace({
        pathname: "/(tabs)/workout-details",
        params: { id: planId, refresh: Date.now().toString() },
      });

      // Background cleanup
      if (sessionId) {
        console.log(
          "🛑 END WORKOUT: Scheduling session deletion in background:",
          sessionId
        );
        (async () => {
          try {
            console.log(
              "🗑️ END WORKOUT (Background): Starting deletion of session:",
              sessionId
            );

            // Delete child rows then session
            const { data: sesExercises } = await supabase
              .from("workout_session_exercises")
              .select("id")
              .eq("session_id", sessionId);

            const ids = (sesExercises || []).map((r) => r.id);

            if (ids.length) {
              console.log(
                `🗑️ END WORKOUT (Background): Deleting ${ids.length} exercises and their sets`
              );
              await supabase
                .from("workout_session_sets")
                .delete()
                .in("session_exercise_id", ids);

              await supabase
                .from("workout_session_exercises")
                .delete()
                .in("id", ids);
              console.log(
                "✅ END WORKOUT (Background): Exercises and sets deleted"
              );
            }

            console.log("🗑️ END WORKOUT (Background): Deleting session record");
            await supabase
              .from("workout_sessions")
              .delete()
              .eq("id", sessionId);
            console.log(
              "✅ END WORKOUT (Background): Session deleted successfully:",
              sessionId
            );
          } catch (e) {
            console.error("❌ END WORKOUT (Background): Cleanup failed:", e);
          }
        })();
      } else {
        console.log("🛑 END WORKOUT: No session ID to delete");
      }
    } catch (error) {
      console.error("❌ Error ending workout:", error);
      setIsQuitting(false);
      Alert.alert(
        "Error",
        "An error occurred while ending the workout. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  /**
   * RESTART THIS EXERCISE / WORKOUT
   * Delete old session completely, clear state, show countdown, then create a NEW session.
   */
  const handleRestartWorkout = async () => {
    if (isRestarting || isSkipping || isGoingNext || isGoingPrevious) return;

    try {
      setIsRestarting(true);
      setShowExitConfirmation(false);

      if (!userProfile?.user_id || !planId) return;

      const oldSessionId = activeSessionId;
      console.log("🔄 RESTART: Starting workout restart", {
        oldSessionId,
        planId,
        userId: userProfile.user_id,
      });

      // 1) Clear local state immediately (but keep oldSessionId reference for later deletion)
      console.log("🔄 RESTART: Clearing local state");
      workoutSessionContext.setActiveWorkoutSession(null);
      setActiveSessionId(null);
      exercisesAddedRef.current.clear();
      setSessionExercises(new Map());
      setSessionSets(new Map());
      sessionInitializedRef.current = false;

      // Reset flow/timers
      totalWorkoutTimeRef.current = 0;
      totalRestTimeRef.current = 0;
      exerciseStartTimeRef.current = null;
      setStartTimeRef.current = null;
      restStartTimeRef.current = null;
      shouldAutoAdvanceRef.current = false;

      setIsResting(false);
      setIsPaused(false);
      setCurrentFlowIndex(0);

      setIsRestarting(false);

      // 2) Countdown (1, 2, 3)
      console.log("🔄 RESTART: Showing countdown");
      await showStartCountdown();
      console.log("✅ RESTART: Countdown complete");

      // 3) Create new session FIRST (before deleting old one)
      console.log("🔄 RESTART: Creating new session");
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version?.toString() || "unknown",
        screenWidth: windowWidth,
      };

      const newSession = await retryDatabaseOperation(
        async () => {
          return await workoutSessionContext.startNewWorkoutSession({
            user_id: userProfile.user_id,
            plan_id: planId as string,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            device_info: deviceInfo,
          });
        },
        "startNewWorkoutSessionRestart",
        3
      );

      if (newSession) {
        console.log(
          "✅ RESTART: New session created successfully:",
          newSession.id
        );
        console.log(
          "🔄 RESTART: Updating context and state with new session ID"
        );

        // Update context with new session to ensure session ID is properly propagated
        workoutSessionContext.setActiveWorkoutSession(newSession);

        // Update local state
        sessionInitializedRef.current = true;
        setActiveSessionId(newSession.id);
        sessionStartTimeRef.current = new Date();
        exerciseStartTimeRef.current = new Date();
        setStartTimeRef.current = new Date();

        console.log(
          "✅ RESTART: Session ID updated - Old:",
          oldSessionId,
          "→ New:",
          newSession.id
        );

        // Wait a brief moment to ensure state is updated before proceeding
        await new Promise((resolve) => setTimeout(resolve, 100));
        console.log("✅ RESTART: Restart complete, ready for new workout");

        // 4) Delete old session in background (after new session is created and active)
        if (oldSessionId) {
          console.log(
            "🔄 RESTART: Scheduling old session deletion in background:",
            oldSessionId
          );
          (async () => {
            try {
              console.log(
                "🗑️ RESTART (Background): Starting deletion of old session:",
                oldSessionId
              );
              const deleted = await deleteSession(oldSessionId);
              if (deleted) {
                console.log(
                  "✅ RESTART (Background): Old session deleted successfully:",
                  oldSessionId
                );
              } else {
                console.error(
                  "❌ RESTART (Background): Failed to delete old session:",
                  oldSessionId
                );
              }
            } catch (error) {
              console.error(
                "❌ RESTART (Background): Error deleting old session:",
                error
              );
            }
          })();
        } else {
          console.log("🔄 RESTART: No old session to delete");
        }
      } else {
        console.error("❌ RESTART: Failed to create new session after restart");
        setIsRestarting(false);
      }
    } catch (error) {
      console.error("❌ Error restarting workout:", error);
      setIsRestarting(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getSectionLabel = (section: string): string => {
    if (section === "warmup") return "Warm Up";
    if (section === "main") return "Main Exercise";
    if (section === "cooldown") return "Cool Down";
    return section;
  };

  const getSideLabel = (side: "left" | "right" | "both"): string => {
    if (side === "left") return "Left Side";
    if (side === "right") return "Right Side";
    return "";
  };

  // Handle missing planId
  useEffect(() => {
    if (!planId) {
      router.push("/(tabs)/workouts");
    }
  }, [planId]);

  // Cleanup effect: Reset all state when component unmounts or planId changes
  useEffect(() => {
    return () => {
      console.log("🧹 CLEANUP: Resetting exercise session state");
      // Reset all state flags
      setIsQuitting(false);
      setIsRestarting(false);
      setIsSkipping(false);
      setIsGoingNext(false);
      setIsGoingPrevious(false);
      setIsStartingWorkout(false);
      setIsPaused(false);
      setIsResting(false);
      setShowExitConfirmation(false);

      // Clear session state
      setActiveSessionId(null);
      exercisesAddedRef.current.clear();
      setSessionExercises(new Map());
      setSessionSets(new Map());
      sessionInitializedRef.current = false;

      // Clear context
      workoutSessionContext.setActiveWorkoutSession(null);

      // Reset refs
      exerciseStartTimeRef.current = null;
      setStartTimeRef.current = null;
      restStartTimeRef.current = null;
      sessionStartTimeRef.current = null;
      totalWorkoutTimeRef.current = 0;
      totalRestTimeRef.current = 0;
      shouldAutoAdvanceRef.current = false;
    };
  }, [planId]);

  if (!planId) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={Platform.OS === "ios" ? ["top"] : ["top", "bottom"]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={styles.loadingText}>Redirecting...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show loading if userProfile hasn't loaded yet
  if (!userProfile?.user_id) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={Platform.OS === "ios" ? ["top"] : ["top", "bottom"]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={styles.loadingText}>Loading workout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={Platform.OS === "ios" ? ["top"] : ["top", "bottom"]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={styles.loadingText}>Loading workout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isQuitting) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={Platform.OS === "ios" ? ["top"] : ["top", "bottom"]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ef4444" />
          <Text style={styles.quittingText}>Ending workout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (workoutFlow.length === 0) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={Platform.OS === "ios" ? ["top"] : ["top", "bottom"]}
      >
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>No exercises found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentItem = workoutFlow[currentFlowIndex];
  const currentExercise = currentItem?.exercise;
  const currentSet = currentItem?.setNumber || 1;
  const totalSets = currentItem?.totalSets || 1;
  const currentSide = currentItem?.side || "both";
  const progress = ((currentFlowIndex + 1) / workoutFlow.length) * 100;

  // Normalize duration_seconds: treat null/undefined as 0
  const normalizedDurationSeconds = currentExercise?.duration_seconds ?? 0;

  // Debug: Log if currentItem or currentExercise is missing
  if (!currentItem) {
    console.error(
      "❌ UI: currentItem is undefined at index:",
      currentFlowIndex
    );
  }
  if (!currentExercise) {
    console.error(
      "❌ UI: currentExercise is undefined at index:",
      currentFlowIndex,
      "currentItem:",
      currentItem
    );
  }

  // Debug: Log timer visibility conditions for set 4 or last set
  if (currentSet === 4 || currentSet === totalSets) {
    console.log("🔍 UI: Set 4/Last Set Debug:", {
      currentSet,
      totalSets,
      currentFlowIndex,
      currentExercise: !!currentExercise,
      duration_seconds: currentExercise?.duration_seconds,
      normalizedDurationSeconds,
      hasTimer: normalizedDurationSeconds > 0,
      exerciseKey: currentExercise
        ? `${currentExercise.exercise_id}_${currentExercise.position}`
        : "N/A",
      exerciseName: currentExercise?.details?.name || "N/A",
    });
  }
  const shouldShowTwoColumns: boolean =
    Platform.OS === "web" && windowWidth > 670;

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={Platform.OS === "ios" ? ["top"] : ["top", "bottom"]}
    >
      {/* Starting Workout Countdown Screen */}
      {isStartingWorkout && (
        <View style={styles.countdownOverlay}>
          <LinearGradient
            colors={["#0d9488", "#14b8a6", "#5eead4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.countdownGradient}
          >
            <View style={styles.countdownContent}>
              <Ionicons name="fitness" size={80} color="#ffffff" />
              <Text style={styles.countdownTitle}>Starting Workout</Text>
              <View style={styles.countdownCircle}>
                <Text style={styles.countdownNumber}>{startCountdown}</Text>
              </View>
              <Text style={styles.countdownSubtext}>Get ready to move!</Text>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Header with Progress */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.closeButton}
            accessible={true}
            accessibilityLabel="Exit workout"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={24} color="#0f766e" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {workoutPlan?.name || "Workout"}
              </Text>
            </View>
            <Text style={styles.headerSubtitle}>
              {`Set ${currentFlowIndex + 1}/${workoutFlow.length} • ${getSectionLabel(currentExercise?.section || "")}`}
            </Text>
            {Platform.OS === "web" && (
              <View style={styles.saveStatusContainer}>
                {saveError ? (
                  <View style={styles.saveErrorIndicator}>
                    <Ionicons name="cloud-offline" size={12} color="#ef4444" />
                    <Text style={styles.saveErrorText}>Connection issue</Text>
                  </View>
                ) : lastSaveTime ? (
                  <View style={styles.savedIndicator}>
                    <Ionicons name="cloud-done" size={12} color="#10b981" />
                    <Text style={styles.savedText}>Synced</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.progressBarBg}>
          <LinearGradient
            colors={["#0d9488", "#14b8a6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBarFill, { width: `${progress}%` }]}
          />
        </View>
      </View>

      {/* Main Content - Scrollable on Mobile */}
      {Platform.OS === "web" ? (
        <View
          style={[
            styles.content,
            {
              paddingHorizontal: 20 * scale,
              paddingTop: 14 * scale,
              paddingBottom: 16 * scale,
              justifyContent: "flex-start",
            },
          ]}
        >
          {/* Rest or Exercise State */}
          {isResting ? (
            <View
              style={[
                styles.restContainer,
                Platform.OS === "web" && {
                  flex: 1,
                  gap: 32 * scale,
                  justifyContent: "flex-start",
                },
              ]}
            >
              <View
                style={[
                  styles.restTitleContainer,
                  Platform.OS === "web" && {
                    gap: 8 * scale,
                    marginTop: 0,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.restTitle,
                    Platform.OS === "web" && {
                      fontSize: 24 * scale,
                    },
                  ]}
                >
                  Rest Time
                </Text>
                {currentFlowIndex < workoutFlow.length - 1 &&
                  (() => {
                    const nextItem = workoutFlow[currentFlowIndex + 1];
                    if (!nextItem) return null;
                    const nextExerciseName =
                      nextItem?.exercise?.details?.name || "Exercise";
                    const nextSet = nextItem?.setNumber ?? 1;
                    const nextTotal = nextItem?.totalSets ?? 1;
                    const nextSide = nextItem?.side;
                    const showSide = nextItem?.exercise?.per_side;

                    const sideLabel =
                      showSide && nextSide !== "both"
                        ? getSideLabel(nextSide)
                        : "";
                    return (
                      <Text
                        style={[
                          styles.restSubtitle,
                          Platform.OS === "web" && {
                            fontSize: 16 * scale,
                          },
                        ]}
                      >
                        {`Next: ${nextExerciseName}${sideLabel !== "" ? ` (${sideLabel})` : ""} - Set ${nextSet}/${nextTotal}`}
                      </Text>
                    );
                  })()}
              </View>
              <View
                style={[
                  Platform.OS === "web" && {
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    width: "100%",
                  },
                ]}
              >
                <View
                  style={[
                    styles.restTimerCircle,
                    shouldShowTwoColumns && styles.restTimerCircleGrid,
                    Platform.OS === "web" && {
                      width: (shouldShowTwoColumns ? 280 : 320) * scale,
                      height: (shouldShowTwoColumns ? 280 : 320) * scale,
                    },
                  ]}
                >
                  <Svg
                    width={(shouldShowTwoColumns ? 280 : 320) * scale}
                    height={(shouldShowTwoColumns ? 280 : 320) * scale}
                    style={styles.restCircleSvg}
                  >
                    {/* Generate 60 tick marks around the circle */}
                    {Array.from({ length: 60 }).map((_, index) => {
                      const svgSize =
                        (shouldShowTwoColumns ? 280 : 320) * scale;
                      const center = svgSize / 2;
                      const radius = (shouldShowTwoColumns ? 135 : 155) * scale;
                      const angle = (index * 6 - 90) * (Math.PI / 180);
                      const tickLength = (index % 5 === 0 ? 10 : 6) * scale;
                      const x1 =
                        center + (radius - tickLength) * Math.cos(angle);
                      const y1 =
                        center + (radius - tickLength) * Math.sin(angle);
                      const x2 = center + radius * Math.cos(angle);
                      const y2 = center + radius * Math.sin(angle);

                      const totalSeconds = currentExercise?.rest_seconds || 0;
                      const elapsedSeconds = totalSeconds - timer;
                      const progressPercentage =
                        totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;
                      const isActive = index / 60 < progressPercentage;

                      return (
                        <Line
                          key={index}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={isActive ? "#f59e0b" : "#e5e7eb"}
                          strokeWidth={
                            (index % 5 === 0
                              ? shouldShowTwoColumns
                                ? 2.5
                                : 3
                              : shouldShowTwoColumns
                                ? 1.5
                                : 2) * scale
                          }
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </Svg>
                  <View style={styles.restTimerTextContainer}>
                    <Text
                      style={[
                        styles.restTimer,
                        shouldShowTwoColumns && styles.restTimerGrid,
                        Platform.OS === "web" && {
                          fontSize: (shouldShowTwoColumns ? 64 : 76) * scale,
                        },
                      ]}
                    >
                      {formatTime(timer)}
                    </Text>
                    <Text
                      style={[
                        styles.restSubtext,
                        shouldShowTwoColumns && styles.restSubtextGrid,
                        Platform.OS === "web" && {
                          fontSize: (shouldShowTwoColumns ? 14 : 18) * scale,
                        },
                      ]}
                    >
                      remaining
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.skipRestButton,
                  shouldShowTwoColumns && styles.skipRestButtonGrid,
                  Platform.OS === "web" && {
                    paddingHorizontal: 32 * scale,
                    paddingVertical: 12 * scale,
                    borderRadius: 999 * scale,
                  },
                  (isGoingNext || isSkipping || isGoingPrevious) &&
                    styles.skipRestButtonDisabled,
                ]}
                onPress={() => handleNext(false)}
                disabled={isGoingNext || isSkipping || isGoingPrevious}
                accessible={true}
                accessibilityLabel="Skip rest period"
                accessibilityRole="button"
                accessibilityState={{
                  disabled: isGoingNext || isSkipping || isGoingPrevious,
                }}
              >
                {isGoingNext ? (
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                    style={Platform.OS === "web" ? { marginVertical: 2 } : {}}
                  />
                ) : (
                  <Text
                    style={[
                      styles.skipRestText,
                      Platform.OS === "web" && {
                        fontSize: 16 * scale,
                      },
                    ]}
                  >
                    Skip Rest
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                styles.exerciseContentWrapper,
                shouldShowTwoColumns && styles.exerciseContentWrapperGrid,
                Platform.OS === "web" && {
                  flex: 1,
                  justifyContent: "flex-start",
                },
                Platform.OS === "web" &&
                  shouldShowTwoColumns && {
                    gap: 20 * scale,
                  },
              ]}
            >
              {/* Left Column: Info + Image */}
              <View
                style={[
                  styles.leftColumn,
                  shouldShowTwoColumns && styles.leftColumnGrid,
                  Platform.OS === "web" && {
                    flex: 1,
                    justifyContent: "flex-start",
                  },
                ]}
              >
                {/* Exercise Info */}
                <View
                  style={[
                    styles.infoTextContainer,
                    shouldShowTwoColumns && styles.infoTextContainerGrid,
                    Platform.OS === "web" && {
                      gap: 12 * scale,
                      marginBottom: 8 * scale,
                      marginTop: 0,
                      alignSelf: shouldShowTwoColumns ? "flex-start" : "center",
                    },
                  ]}
                >
                  {currentExercise?.per_side &&
                    currentSide !== "both" &&
                    getSideLabel(currentSide) !== "" && (
                      <View
                        style={[
                          styles.infoTextRow,
                          Platform.OS === "web" && {
                            gap: 6 * scale,
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            currentSide === "left"
                              ? "arrow-back"
                              : "arrow-forward"
                          }
                          size={14 * (Platform.OS === "web" ? scale : 1)}
                          color="#0d9488"
                        />
                        <Text
                          style={[
                            styles.infoText,
                            styles.sideInfoText,
                            Platform.OS === "web" && {
                              fontSize: 12 * scale,
                            },
                          ]}
                        >
                          {getSideLabel(currentSide)}
                        </Text>
                      </View>
                    )}
                  {totalSets > 1 && (
                    <View
                      style={[
                        styles.infoTextRow,
                        Platform.OS === "web" && {
                          gap: 6 * scale,
                        },
                      ]}
                    >
                      <Ionicons
                        name="repeat"
                        size={14 * (Platform.OS === "web" ? scale : 1)}
                        color="#0d9488"
                      />
                      <Text
                        style={[
                          styles.infoText,
                          Platform.OS === "web" && {
                            fontSize: 12 * scale,
                          },
                        ]}
                      >
                        {`Set ${currentSet} of ${totalSets}`}
                      </Text>
                    </View>
                  )}
                  {currentExercise?.reps && currentExercise.reps > 0 && (
                    <View
                      style={[
                        styles.infoTextRow,
                        Platform.OS === "web" && {
                          gap: 6 * scale,
                        },
                      ]}
                    >
                      <Ionicons
                        name="fitness"
                        size={14 * (Platform.OS === "web" ? scale : 1)}
                        color="#d97706"
                      />
                      <Text
                        style={[
                          styles.infoText,
                          Platform.OS === "web" && {
                            fontSize: 12 * scale,
                          },
                        ]}
                      >
                        {`${currentExercise.reps === 1 ? "Rep" : "Reps"}: ${currentExercise.reps}`}
                      </Text>
                    </View>
                  )}
                  {currentExercise?.rest_seconds &&
                    currentExercise.rest_seconds > 0 && (
                      <View
                        style={[
                          styles.infoTextRow,
                          Platform.OS === "web" && {
                            gap: 6 * scale,
                          },
                        ]}
                      >
                        <Ionicons
                          name="time"
                          size={14 * (Platform.OS === "web" ? scale : 1)}
                          color="#0284c7"
                        />
                        <Text
                          style={[
                            styles.infoText,
                            Platform.OS === "web" && {
                              fontSize: 12 * scale,
                            },
                          ]}
                        >
                          {`Rest: ${currentExercise.rest_seconds}s`}
                        </Text>
                      </View>
                    )}
                </View>

                {/* Exercise Image */}
                {Platform.OS === "web" ? (
                  <View
                    style={{
                      flex: 1,
                      justifyContent: "center",
                      alignItems: "center",
                      width: "100%",
                    }}
                  >
                    <View
                      style={[
                        styles.imageContainer,
                        shouldShowTwoColumns && styles.imageContainerGrid,
                        {
                          maxWidth: (shouldShowTwoColumns ? 280 : 320) * scale,
                          width: (shouldShowTwoColumns ? 280 : 320) * scale,
                          height: (shouldShowTwoColumns ? 280 : 320) * scale,
                          marginTop: 0,
                          borderRadius: 16 * scale,
                        },
                      ]}
                    >
                      {currentExercise?.details?.image_slug ? (
                        <img
                          src={getExerciseImageUrl(
                            currentExercise.section,
                            currentExercise.details.image_slug
                          )}
                          alt={currentExercise.details.name || "Exercise"}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                          }}
                        />
                      ) : (
                        <View style={styles.imagePlaceholder}>
                          <Ionicons
                            name="fitness"
                            size={60 * scale}
                            color="#9ca3af"
                          />
                        </View>
                      )}
                    </View>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.imageContainer,
                      shouldShowTwoColumns && styles.imageContainerGrid,
                    ]}
                  >
                    {currentExercise?.details?.image_slug ? (
                      <Image
                        source={{
                          uri: getExerciseImageUrl(
                            currentExercise.section,
                            currentExercise.details.image_slug
                          ),
                        }}
                        style={styles.exerciseImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Ionicons name="fitness" size={60} color="#9ca3af" />
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Skip Button for non-timer exercises (Web only) */}
              {currentExercise && normalizedDurationSeconds <= 0 && (
                <TouchableOpacity
                  style={[
                    styles.skipExerciseButtonBelow,
                    isSkipping && styles.skipExerciseButtonDisabled,
                    Platform.OS === "web" && {
                      marginTop: 20 * scale,
                      gap: 6 * scale,
                      paddingVertical: 10 * scale,
                    },
                  ]}
                  onPress={handleSkip}
                  disabled={isSkipping}
                  accessible={true}
                  accessibilityLabel="Skip current exercise"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isSkipping }}
                >
                  {isSkipping ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Text
                      style={[
                        styles.skipExerciseTextBelow,
                        Platform.OS === "web" && {
                          fontSize: 16 * scale,
                        },
                      ]}
                    >
                      Skip Exercise
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Right Column: Timer for duration-based exercises */}
              {currentExercise && normalizedDurationSeconds > 0 && (
                <View
                  style={[
                    styles.timerContainer,
                    shouldShowTwoColumns && styles.timerContainerGrid,
                    Platform.OS === "web" && {
                      marginTop: 0,
                      flex: 1,
                      justifyContent: "flex-start",
                      alignItems: "center",
                    },
                  ]}
                >
                  <View
                    style={{
                      flex: 1,
                      justifyContent: "center",
                      alignItems: "center",
                      width: "100%",
                    }}
                  >
                    <View
                      style={[
                        styles.circularProgressContainer,
                        shouldShowTwoColumns &&
                          styles.circularProgressContainerGrid,
                        Platform.OS === "web" && {
                          width: (shouldShowTwoColumns ? 320 : 280) * scale,
                          height: (shouldShowTwoColumns ? 320 : 280) * scale,
                        },
                      ]}
                    >
                      <Svg
                        width={(shouldShowTwoColumns ? 320 : 280) * scale}
                        height={(shouldShowTwoColumns ? 320 : 280) * scale}
                        style={styles.circularProgressSvg}
                      >
                        {/* Generate 60 tick marks around the circle */}
                        {Array.from({ length: 60 }).map((_, index) => {
                          const svgSize =
                            (shouldShowTwoColumns ? 320 : 280) * scale;
                          const center = svgSize / 2;
                          const radius =
                            (shouldShowTwoColumns ? 155 : 135) * scale;
                          const angle = (index * 6 - 90) * (Math.PI / 180);
                          const tickLength = (index % 5 === 0 ? 10 : 6) * scale;
                          const x1 =
                            center + (radius - tickLength) * Math.cos(angle);
                          const y1 =
                            center + (radius - tickLength) * Math.sin(angle);
                          const x2 = center + radius * Math.cos(angle);
                          const y2 = center + radius * Math.sin(angle);

                          const totalSeconds = normalizedDurationSeconds;
                          const elapsedSeconds = totalSeconds - timer;
                          const progressPercentage =
                            totalSeconds > 0
                              ? elapsedSeconds / totalSeconds
                              : 0;
                          const isActive = index / 60 < progressPercentage;

                          return (
                            <Line
                              key={index}
                              x1={x1}
                              y1={y1}
                              x2={x2}
                              y2={y2}
                              stroke={isActive ? "#f59e0b" : "#e5e7eb"}
                              strokeWidth={
                                (index % 5 === 0
                                  ? shouldShowTwoColumns
                                    ? 3.5
                                    : 2.5
                                  : shouldShowTwoColumns
                                    ? 2
                                    : 1.5) * scale
                              }
                              strokeLinecap="round"
                            />
                          );
                        })}
                      </Svg>
                      <View style={styles.timerTextContainer}>
                        <Text
                          style={[
                            styles.timerText,
                            shouldShowTwoColumns && styles.timerTextGrid,
                            Platform.OS === "web" && {
                              fontSize:
                                (shouldShowTwoColumns ? 72 : 60) * scale,
                            },
                          ]}
                        >
                          {formatTime(timer)}
                        </Text>
                        {/* Skip Button - Below Timer Counter */}
                        <TouchableOpacity
                          style={[
                            styles.skipExerciseButtonInTimer,
                            isSkipping && styles.skipExerciseButtonDisabled,
                            Platform.OS === "web" && {
                              gap: 6 * scale,
                              marginTop: 6 * scale,
                              paddingVertical: 8 * scale,
                            },
                          ]}
                          onPress={handleSkip}
                          disabled={isSkipping}
                          accessible={true}
                          accessibilityLabel="Skip current exercise"
                          accessibilityRole="button"
                          accessibilityState={{
                            disabled: isSkipping,
                          }}
                        >
                          {isSkipping ? (
                            <ActivityIndicator size="small" color="#ef4444" />
                          ) : (
                            <Text
                              style={[
                                styles.skipExerciseTextInTimer,
                                Platform.OS === "web" && {
                                  fontSize: 16 * scale,
                                },
                              ]}
                            >
                              Skip Exercise
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.scrollViewContainer}
          contentContainerStyle={styles.contentScrollContainer}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* Rest or Exercise State */}
          {isResting ? (
            <View style={styles.restContainer}>
              <View style={styles.restTitleContainer}>
                <Text style={styles.restTitle}>Rest Time</Text>
                {currentFlowIndex < workoutFlow.length - 1 &&
                  (() => {
                    const nextItem = workoutFlow[currentFlowIndex + 1];
                    if (!nextItem) return null;
                    const nextExerciseName =
                      nextItem?.exercise?.details?.name || "Exercise";
                    const nextSet = nextItem?.setNumber ?? 1;
                    const nextTotal = nextItem?.totalSets ?? 1;
                    const nextSide = nextItem?.side;
                    const showSide = nextItem?.exercise?.per_side;

                    const sideLabel =
                      showSide && nextSide !== "both"
                        ? getSideLabel(nextSide)
                        : "";
                    return (
                      <Text style={styles.restSubtitle}>
                        {`Next: ${nextExerciseName}${sideLabel !== "" ? ` (${sideLabel})` : ""} - Set ${nextSet}/${nextTotal}`}
                      </Text>
                    );
                  })()}
              </View>
              <View style={styles.restTimerCircle}>
                <Svg width={240} height={240} style={styles.restCircleSvg}>
                  {/* Generate 60 tick marks around the circle */}
                  {Array.from({ length: 60 }).map((_, index) => {
                    const svgSize = 240;
                    const center = svgSize / 2;
                    const radius = 115;
                    const angle = (index * 6 - 90) * (Math.PI / 180);
                    const tickLength = index % 5 === 0 ? 10 : 6;
                    const x1 = center + (radius - tickLength) * Math.cos(angle);
                    const y1 = center + (radius - tickLength) * Math.sin(angle);
                    const x2 = center + radius * Math.cos(angle);
                    const y2 = center + radius * Math.sin(angle);

                    const totalSeconds = currentExercise?.rest_seconds || 0;
                    const elapsedSeconds = totalSeconds - timer;
                    const progressPercentage =
                      totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;
                    const isActive = index / 60 < progressPercentage;

                    return (
                      <Line
                        key={index}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={isActive ? "#f59e0b" : "#e5e7eb"}
                        strokeWidth={index % 5 === 0 ? 3 : 2}
                        strokeLinecap="round"
                      />
                    );
                  })}
                </Svg>
                <View style={styles.restTimerTextContainer}>
                  <Text style={styles.restTimer}>{formatTime(timer)}</Text>
                  <Text style={styles.restSubtext}>remaining</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.skipRestButton,
                  (isGoingNext || isSkipping || isGoingPrevious) &&
                    styles.skipRestButtonDisabled,
                ]}
                onPress={() => handleNext(false)}
                disabled={isGoingNext || isSkipping || isGoingPrevious}
                accessible={true}
                accessibilityLabel="Skip rest period"
                accessibilityRole="button"
                accessibilityState={{
                  disabled: isGoingNext || isSkipping || isGoingPrevious,
                }}
              >
                {isGoingNext ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.skipRestText}>Skip Rest</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.exerciseContentWrapper}>
              {/* Left Column: Info + Image */}
              <View style={styles.leftColumn}>
                {/* Exercise Info */}
                <View
                  style={[
                    styles.infoTextContainer,
                    shouldShowTwoColumns && styles.infoTextContainerGrid,
                  ]}
                >
                  {currentExercise?.per_side &&
                    currentSide !== "both" &&
                    getSideLabel(currentSide) !== "" && (
                      <View style={styles.infoTextRow}>
                        <Ionicons
                          name={
                            currentSide === "left"
                              ? "arrow-back"
                              : "arrow-forward"
                          }
                          size={14}
                          color="#0d9488"
                        />
                        <Text style={[styles.infoText, styles.sideInfoText]}>
                          {getSideLabel(currentSide)}
                        </Text>
                      </View>
                    )}
                  {totalSets > 1 && (
                    <View style={styles.infoTextRow}>
                      <Ionicons name="repeat" size={14} color="#0d9488" />
                      <Text style={styles.infoText}>
                        {`Set ${currentSet} of ${totalSets}`}
                      </Text>
                    </View>
                  )}
                  {currentExercise?.reps && currentExercise.reps > 0 && (
                    <View style={styles.infoTextRow}>
                      <Ionicons name="fitness" size={14} color="#d97706" />
                      <Text style={styles.infoText}>
                        {`${currentExercise.reps === 1 ? "Rep" : "Reps"}: ${currentExercise.reps}`}
                      </Text>
                    </View>
                  )}
                  {currentExercise?.rest_seconds &&
                    currentExercise.rest_seconds > 0 && (
                      <View style={styles.infoTextRow}>
                        <Ionicons name="time" size={14} color="#0284c7" />
                        <Text style={styles.infoText}>
                          {`Rest: ${currentExercise.rest_seconds}s`}
                        </Text>
                      </View>
                    )}
                </View>

                {/* Exercise Image */}
                <View
                  style={[
                    styles.imageContainer,
                    shouldShowTwoColumns && styles.imageContainerGrid,
                  ]}
                >
                  {currentExercise?.details?.image_slug ? (
                    <Image
                      source={{
                        uri: getExerciseImageUrl(
                          currentExercise.section,
                          currentExercise.details.image_slug
                        ),
                      }}
                      style={styles.exerciseImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="fitness" size={60} color="#9ca3af" />
                    </View>
                  )}
                </View>
              </View>

              {/* Timer for duration-based exercises */}
              {currentExercise && normalizedDurationSeconds > 0 && (
                <View style={styles.timerContainer}>
                  <View style={styles.circularProgressContainer}>
                    <Svg
                      width={240}
                      height={240}
                      style={styles.circularProgressSvg}
                    >
                      {/* Generate 60 tick marks around the circle */}
                      {Array.from({ length: 60 }).map((_, index) => {
                        const svgSize = 240;
                        const center = svgSize / 2;
                        const radius = 115;
                        const angle = (index * 6 - 90) * (Math.PI / 180);
                        const tickLength = index % 5 === 0 ? 10 : 6;
                        const x1 =
                          center + (radius - tickLength) * Math.cos(angle);
                        const y1 =
                          center + (radius - tickLength) * Math.sin(angle);
                        const x2 = center + radius * Math.cos(angle);
                        const y2 = center + radius * Math.sin(angle);

                        const totalSeconds = normalizedDurationSeconds;
                        const elapsedSeconds = totalSeconds - timer;
                        const progressPercentage =
                          totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;
                        const isActive = index / 60 < progressPercentage;

                        return (
                          <Line
                            key={index}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={isActive ? "#f59e0b" : "#e5e7eb"}
                            strokeWidth={index % 5 === 0 ? 3 : 2}
                            strokeLinecap="round"
                          />
                        );
                      })}
                    </Svg>
                    <View style={styles.timerTextContainer}>
                      <Text style={styles.timerText}>{formatTime(timer)}</Text>
                      {/* Skip Button - Below Timer Counter */}
                      <TouchableOpacity
                        style={[
                          styles.skipExerciseButtonInTimer,
                          isSkipping && styles.skipExerciseButtonDisabled,
                        ]}
                        onPress={handleSkip}
                        disabled={isSkipping}
                        accessible={true}
                        accessibilityLabel="Skip current exercise"
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isSkipping }}
                      >
                        {isSkipping ? (
                          <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                          <>
                            <Text style={styles.skipExerciseTextInTimer}>
                              Skip Exercise
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
          {/* Skip Button for Mobile - Below Image (if no timer) */}
          {!isResting && currentExercise && normalizedDurationSeconds <= 0 && (
            <TouchableOpacity
              style={[
                styles.skipExerciseButtonBelow,
                isSkipping && styles.skipExerciseButtonDisabled,
              ]}
              onPress={handleSkip}
              disabled={isSkipping}
              accessible={true}
              accessibilityLabel="Skip current exercise"
              accessibilityRole="button"
              accessibilityState={{ disabled: isSkipping }}
            >
              {isSkipping ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <>
                  <Text style={styles.skipExerciseTextBelow}>
                    Skip Exercise
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Control Buttons */}
      <View
        style={[
          styles.controlsContainer,
          Platform.OS === "web" && {
            paddingHorizontal: 20 * scale,
            paddingVertical: 16 * scale,
          },
        ]}
      >
        <View
          style={[
            styles.exerciseNameRow,
            Platform.OS === "web" && {
              marginBottom: 12 * scale,
              gap: 12 * scale,
            },
          ]}
        >
          <Text
            style={[
              styles.controlsExerciseName,
              Platform.OS === "web" && {
                fontSize: 20 * scale,
              },
            ]}
            numberOfLines={1}
          >
            {currentExercise?.details?.name || "Exercise"}
            {currentExercise?.per_side &&
              currentSide !== "both" &&
              getSideLabel(currentSide) !== "" && (
                <Text
                  style={[
                    styles.sideIndicator,
                    Platform.OS === "web" && {
                      fontSize: 14 * scale,
                    },
                  ]}
                >
                  {` (${getSideLabel(currentSide)})`}
                </Text>
              )}
            {totalSets > 1 && (
              <Text
                style={[
                  styles.setIndicator,
                  Platform.OS === "web" && {
                    fontSize: 16 * scale,
                  },
                ]}
              >{` - Set ${currentSet}/${totalSets}`}</Text>
            )}
          </Text>
        </View>
        <View
          style={[
            styles.controlsRow,
            Platform.OS === "web" && {
              gap: 24 * scale,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.controlButton,
              (currentFlowIndex === 0 || isGoingPrevious) &&
                styles.controlButtonDisabled,
              Platform.OS === "web" && {
                padding: 12 * scale,
              },
            ]}
            onPress={handlePrevious}
            disabled={currentFlowIndex === 0 || isGoingPrevious}
            accessible={true}
            accessibilityLabel="Previous exercise"
            accessibilityRole="button"
            accessibilityState={{
              disabled: currentFlowIndex === 0 || isGoingPrevious,
            }}
          >
            {isGoingPrevious ? (
              <ActivityIndicator size="small" color="#0f766e" />
            ) : (
              <Ionicons
                name="play-back"
                size={28 * (Platform.OS === "web" ? scale : 1)}
                color={currentFlowIndex === 0 ? "#9ca3af" : "#0f766e"}
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.pauseButton,
              Platform.OS === "web" && {
                borderRadius: 999 * scale,
              },
            ]}
            onPress={handlePauseToggle}
            accessible={true}
            accessibilityLabel={isPaused ? "Resume workout" : "Pause workout"}
            accessibilityRole="button"
            disabled={Platform.OS === "web" && (isQuitting || isRestarting)}
          >
            <LinearGradient
              colors={
                isPaused ? ["#d97706", "#f59e0b"] : ["#0d9488", "#14b8a6"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.pauseButtonGradient,
                Platform.OS === "web" && {
                  width: 68 * scale,
                  height: 68 * scale,
                },
              ]}
            >
              <Ionicons
                name={isPaused ? "play" : "pause"}
                size={30 * (Platform.OS === "web" ? scale : 1)}
                color="#ffffff"
              />
            </LinearGradient>
          </TouchableOpacity>
          {currentFlowIndex === workoutFlow.length - 1 ? (
            <TouchableOpacity
              style={[
                styles.controlButton,
                (isGoingNext || isQuitting) && styles.controlButtonDisabled,
                Platform.OS === "web" && {
                  padding: 12 * scale,
                },
              ]}
              onPress={handleFinish}
              disabled={isGoingNext || isQuitting}
              accessible={true}
              accessibilityLabel="Finish workout"
              accessibilityRole="button"
              accessibilityState={{
                disabled: isGoingNext || isQuitting,
              }}
            >
              {isGoingNext || isQuitting ? (
                <ActivityIndicator size="small" color="#0f766e" />
              ) : (
                <Ionicons
                  name="checkmark-circle"
                  size={28 * (Platform.OS === "web" ? scale : 1)}
                  color="#0f766e"
                />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.controlButton,
                isGoingNext && styles.controlButtonDisabled,
                Platform.OS === "web" && {
                  padding: 12 * scale,
                },
              ]}
              onPress={() => handleNext(false)}
              disabled={isGoingNext}
              accessible={true}
              accessibilityLabel={
                isResting ? "Skip rest and continue" : "Next set"
              }
              accessibilityRole="button"
              accessibilityState={{
                disabled: isGoingNext,
              }}
            >
              {isGoingNext ? (
                <ActivityIndicator size="small" color="#0f766e" />
              ) : (
                <Ionicons
                  name="play-forward"
                  size={28 * (Platform.OS === "web" ? scale : 1)}
                  color="#0f766e"
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Exit Confirmation Modal */}
      <Modal
        visible={showExitConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          // Web-specific: Prevent closing if processing
          if (Platform.OS === "web" && (isQuitting || isRestarting)) {
            return;
          }
          setShowExitConfirmation(false);
          setIsPaused(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Two arm muscle emojis with dumbbell at center */}
            <View style={styles.modalMusclesContainer}>
              <Text style={styles.modalMuscleEmoji}>💪</Text>
              <Ionicons name="barbell" size={52} color="#f59e0b" />
              <Text
                style={[styles.modalMuscleEmoji, styles.modalMuscleEmojiRight]}
              >
                💪
              </Text>
            </View>

            {/* Motivational text */}
            <View style={styles.modalTextContainer}>
              <Text style={styles.modalMotivationText}>Don't give up now.</Text>
              <Text style={styles.modalEncourageText}>You can do this!</Text>
              <View style={styles.modalRemainingContainer}>
                <Text style={styles.modalRemainingText}>Only </Text>
                <Text style={styles.modalRemainingNumber}>
                  {(() => {
                    const currentItem = workoutFlow[currentFlowIndex];
                    const totalExercises =
                      workoutFlow.length > 0
                        ? workoutFlow[workoutFlow.length - 1].exerciseOrder
                        : 0;
                    const currentExerciseOrder =
                      currentItem?.exerciseOrder || 0;
                    return Math.max(0, totalExercises - currentExerciseOrder);
                  })()}
                </Text>
                <Text style={styles.modalRemainingExercises}> exercises</Text>
                <Text style={styles.modalRemainingText}> left</Text>
              </View>
            </View>

            {/* Buttons */}
            <View style={styles.modalButtonsContainer}>
              {/* Resume button with gradient */}
              <TouchableOpacity
                style={styles.modalResumeButton}
                onPress={() => {
                  // Web-specific: Prevent if processing
                  if (Platform.OS === "web" && (isQuitting || isRestarting)) {
                    return;
                  }
                  setShowExitConfirmation(false);
                  setIsPaused(false);
                }}
                activeOpacity={0.8}
                disabled={
                  isQuitting ||
                  isRestarting ||
                  isGoingNext ||
                  isSkipping ||
                  isGoingPrevious
                }
                accessible={true}
                accessibilityLabel="Resume workout"
                accessibilityRole="button"
                accessibilityState={{
                  disabled:
                    isQuitting ||
                    isRestarting ||
                    isGoingNext ||
                    isSkipping ||
                    isGoingPrevious,
                }}
              >
                <LinearGradient
                  colors={["#fbbf24", "#f59e0b", "#d97706"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.modalResumeGradient,
                    (isQuitting ||
                      isRestarting ||
                      isGoingNext ||
                      isSkipping ||
                      isGoingPrevious) &&
                      styles.modalButtonDisabled,
                  ]}
                >
                  <Ionicons name="play" size={24} color="#ffffff" />
                  <Text style={styles.modalResumeText}>Resume</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Restart this workout button */}
              <TouchableOpacity
                style={[
                  styles.modalRestartButton,
                  (isQuitting ||
                    isRestarting ||
                    isGoingNext ||
                    isSkipping ||
                    isGoingPrevious) &&
                    styles.modalButtonDisabled,
                ]}
                onPress={handleRestartWorkout}
                activeOpacity={0.7}
                disabled={
                  isQuitting ||
                  isRestarting ||
                  isGoingNext ||
                  isSkipping ||
                  isGoingPrevious
                }
                accessible={true}
                accessibilityLabel="Restart workout from beginning"
                accessibilityRole="button"
                accessibilityState={{
                  disabled:
                    isQuitting ||
                    isRestarting ||
                    isGoingNext ||
                    isSkipping ||
                    isGoingPrevious,
                }}
              >
                {isRestarting ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color="#14b8a6"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.modalRestartText}>
                      Restarting workout, please wait...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="refresh" size={22} color="#14b8a6" />
                    <Text style={styles.modalRestartText}>
                      Restart this workout
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Quit text button */}
              <TouchableOpacity
                style={styles.modalQuitButton}
                onPress={handleEndWorkout}
                activeOpacity={0.6}
                disabled={
                  isQuitting ||
                  isRestarting ||
                  isGoingNext ||
                  isSkipping ||
                  isGoingPrevious
                }
                accessible={true}
                accessibilityLabel="Quit workout and discard progress"
                accessibilityRole="button"
                accessibilityState={{
                  disabled:
                    isQuitting ||
                    isRestarting ||
                    isGoingNext ||
                    isSkipping ||
                    isGoingPrevious,
                }}
              >
                {isQuitting ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <Text
                    style={[
                      styles.modalQuitText,
                      (isRestarting ||
                        isGoingNext ||
                        isSkipping ||
                        isGoingPrevious) &&
                        styles.modalButtonDisabled,
                    ]}
                  >
                    Quit
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {Platform.OS === "web" && toastMessage && (
        <View
          style={[
            styles.toastContainer,
            toastMessage.type === "success"
              ? styles.toastSuccess
              : toastMessage.type === "error"
                ? styles.toastError
                : styles.toastInfo,
          ]}
        >
          <Ionicons
            name={
              toastMessage.type === "success"
                ? "checkmark-circle"
                : toastMessage.type === "error"
                  ? "alert-circle"
                  : "information-circle"
            }
            size={20}
            color="#ffffff"
          />
          <Text style={styles.toastText}>{toastMessage.message}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  countdownOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
  },
  countdownGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  countdownContent: {
    alignItems: "center",
    gap: 24,
  },
  countdownTitle: {
    fontSize: 36,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  countdownCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderWidth: 6,
    borderColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  countdownNumber: {
    fontSize: 96,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
  },
  countdownSubtext: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
    opacity: 0.9,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#0f766e",
    fontWeight: "700",
  },
  quittingText: {
    fontSize: 16,
    color: "#ef4444",
    fontWeight: "700",
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#0d9488",
    borderRadius: 8,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null),
  },
  backButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(156,163,175,0.2)",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  closeButton: {
    padding: 4,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null),
  },
  headerTextContainer: {
    flex: 1,
    alignItems: "center",
    marginTop: 8,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f766e",
    textAlign: "center",
  },
  continueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#10b981",
    borderRadius: 8,
  },
  continueBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
    textAlign: "center",
  },
  saveStatusContainer: {
    marginTop: 4,
    minHeight: 18,
  },
  savedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  savedText: {
    fontSize: 10,
    color: "#10b981",
    fontWeight: "600",
  },
  saveErrorIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  saveErrorText: {
    fontSize: 10,
    color: "#ef4444",
    fontWeight: "600",
  },
  placeholder: {
    width: 32,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  scrollViewContainer: {
    flex: 1,
  },
  contentScrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  exerciseContentWrapper: {
    width: "100%",
    alignItems: "center",
  },
  exerciseContentWrapperGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  },
  leftColumn: {
    width: "100%",
    alignItems: "center",
  },
  leftColumnGrid: {
    flex: 1,
    width: "auto",
    alignItems: "center",
    justifyContent: "center",
  },
  imageContainer: {
    width: "100%",
    maxWidth: 260,
    aspectRatio: 1,
    borderRadius: 16,
    marginTop: Platform.OS === "web" ? 0 : -32,
    marginBottom: Platform.OS === "web" ? 0 : -52,
    overflow: "hidden",
    zIndex: 1,
  },
  imageContainerGrid: {
    marginTop: 12,
    maxWidth: 280,
    width: 280,
    height: 280,
  },
  exerciseImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  restContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  restTitleContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  restTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f766e",
    marginBottom: -8,
    textAlign: "center",
  },
  restSubtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  restTimerCircle: {
    position: "relative",
    width: 240,
    height: 240,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
    elevation: 20,
  },
  restTimerCircleGrid: {
    width: 240,
    height: 240,
  },
  restCircleSvg: {
    position: "absolute",
  },
  restTimerTextContainer: {
    alignItems: "center",
    gap: 4,
    zIndex: 25,
  },
  restTimer: {
    fontSize: 48,
    fontWeight: "800",
    color: "#f59e0b",
    letterSpacing: -2,
  },
  restTimerGrid: {
    fontSize: 56,
  },
  restSubtext: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  restSubtextGrid: {
    fontSize: 13,
  },
  skipRestButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: "#f59e0b",
    borderRadius: 999,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null),
  },
  skipRestButtonDisabled: {
    opacity: 0.6,
    ...(Platform.OS === "web" ? ({ cursor: "not-allowed" } as any) : null),
  },
  skipRestButtonGrid: {
    marginTop: -16,
  },
  skipRestText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  exerciseName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1f2937",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 12,
  },
  infoTextContainer: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 0,
    marginBottom: 2,
    zIndex: 10,
  },
  infoTextContainerGrid: {
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  infoTextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  sideInfoText: {
    fontWeight: "700",
    color: "#0d9488",
  },
  timerContainer: {
    marginTop: 0,
    alignItems: "center",
    zIndex: 20,
    elevation: 20,
  },
  timerContainerGrid: {
    marginTop: 0,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  circularProgressContainer: {
    position: "relative",
    width: 240,
    height: 240,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
    elevation: 20,
  },
  circularProgressContainerGrid: {
    width: 280,
    height: 280,
  },
  circularProgressSvg: {
    position: "absolute",
  },
  timerTextContainer: {
    justifyContent: "center",
    alignItems: "center",
    zIndex: 25,
    gap: 10,
  },
  timerText: {
    fontSize: 42,
    fontWeight: "800",
    color: "#f59e0b",
    letterSpacing: -2,
  },
  timerTextGrid: {
    fontSize: 68,
  },
  controlsContainer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(156,163,175,0.2)",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 -2px 8px rgba(0,0,0,0.1)",
      } as any,
    }),
  },
  exerciseNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    gap: 12,
  },
  controlsExerciseName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f766e",
    textAlign: "center",
    flex: 1,
  },
  skipExerciseButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null),
  },
  skipExerciseButtonBelow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 20,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null),
  },
  skipExerciseButtonDisabled: {
    opacity: 0.5,
    ...(Platform.OS === "web" ? ({ cursor: "not-allowed" } as any) : null),
  },
  skipExerciseText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ef4444",
  },
  skipExerciseTextBelow: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ef4444",
  },
  skipExerciseButtonInTimer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    marginTop: 2,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null),
  },
  skipExerciseTextInTimer: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ef4444",
  },
  setIndicator: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  sideIndicator: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0d9488",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 24,
  },
  controlButton: {
    padding: 12,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null),
  },
  controlButtonDisabled: {
    opacity: 0.3,
    ...(Platform.OS === "web" ? ({ cursor: "not-allowed" } as any) : null),
  },
  pauseButton: {
    borderRadius: 999,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#0d9488",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0 2px 8px rgba(13, 148, 136, 0.3)",
        cursor: "pointer",
      } as any,
    }),
  },
  pauseButtonGradient: {
    width: 68,
    height: 68,
    justifyContent: "center",
    alignItems: "center",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 32,
    width: "100%",
    maxWidth: 420,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: "0 8px 16px rgba(0,0,0,0.4)",
      } as any,
    }),
    overflow: "hidden",
  },
  modalMusclesContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    gap: 8,
  },
  modalMuscleEmoji: {
    fontSize: 52,
    lineHeight: 52,
  },
  modalMuscleEmojiRight: {
    transform: [{ scaleX: -1 }],
  },
  modalTextContainer: {
    alignItems: "center",
    marginBottom: 28,
  },
  modalMotivationText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#14b8a6",
    marginBottom: 8,
    textAlign: "center",
  },
  modalEncourageText: {
    fontSize: 32,
    fontWeight: "900",
    color: "#1f2937",
    marginBottom: 16,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  modalRemainingContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  modalRemainingText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6b7280",
  },
  modalRemainingNumber: {
    fontSize: 20,
    fontWeight: "900",
    color: "#f59e0b",
  },
  modalRemainingExercises: {
    fontSize: 20,
    fontWeight: "900",
    color: "#f59e0b",
  },
  modalButtonsContainer: {
    gap: 14,
  },
  modalResumeButton: {
    borderRadius: 14,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#f59e0b",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0 4px 8px rgba(245, 158, 11, 0.4)",
        cursor: "pointer",
      } as any,
    }),
  },
  modalResumeGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 10,
  },
  modalResumeText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  modalRestartButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    gap: 8,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null),
  },
  modalRestartText: {
    color: "#14b8a6",
    fontSize: 16,
    fontWeight: "700",
  },
  modalQuitButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null),
  },
  modalQuitText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "700",
  },
  modalButtonDisabled: {
    opacity: 0.5,
    ...(Platform.OS === "web" ? ({ cursor: "not-allowed" } as any) : null),
  },
  toastContainer: {
    position: "absolute",
    top: 80,
    left: "50%",
    transform: [{ translateX: -150 }],
    width: 300,
    maxWidth: "90%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
      } as any,
    }),
    zIndex: 9999,
  },
  toastSuccess: {
    backgroundColor: "#10b981",
  },
  toastError: {
    backgroundColor: "#ef4444",
  },
  toastInfo: {
    backgroundColor: "#3b82f6",
  },
  toastText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
});

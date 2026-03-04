"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  HiSparkles,
  HiLockOpen,
  HiArrowRight,
  HiArrowPath,
} from "react-icons/hi2";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { UserProfile } from "@/types/UserProfile";
import { testOpenAIConnectionFull } from "@/utils/test_openai_connection";
import {
  generateWorkoutWithPrompt,
  generateDayWorkoutWithPrompt,
  generatePlanMetadataWithPrompt,
  convertUserProfileToVariables,
  parseExerciseMetrics,
  formatExerciseMetricsForDisplay,
  type WorkoutPlanJSON,
  type DayWorkoutResponse,
  type PlanMetadataResponse,
  type ExerciseItem,
} from "@/lib/openai-prompt";
import { generateExerciseImage } from "@/lib/gemini";
import { useImageGeneration } from "@/contexts/ImageGenerationContext";
import {
  parseWorkoutResponse,
  DailyWorkout,
} from "@/utils/parseWorkoutResponse";
import WorkoutCard from "@/components/WorkoutCard";
import { useCoachWorkoutData } from "@/hooks/useCoachWorkoutData";
import { CoachWorkoutPlanWithTags } from "@/types/CoachWorkout";
import CoachWorkoutPlanCard from "@/components/CoachWorkoutPlanCard";
import { usePlansContext } from "@/contexts/PlansContext";
import { useUserContext } from "@/contexts/UserContext";
import type { PlanTier } from "@/types/Plan";
import Dialog from "@/components/Dialog";
import { useUserWorkoutData } from "@/hooks/useUserWorkoutData";
import type {
  CreateUserExerciseDetailsPayload,
  CreateUserWorkoutPlanExercisePayload,
  ExerciseSection,
} from "@/types/UserWorkout";
import { supabase } from "@/lib/api/supabase";
import { HiMoon, HiArrowRightOnRectangle } from "react-icons/hi2";

// Helper function to format text in title case
const formatTitleCase = (text: string): string => {
  return text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const AI_LOG_ENABLED =
  process.env.NEXT_PUBLIC_AI_LOGS === "true" &&
  process.env.NODE_ENV !== "production";
const DAY_GEN_CONCURRENCY = Math.max(
  1,
  Number(process.env.NEXT_PUBLIC_DAY_GEN_CONCURRENCY ?? "2"),
);

const aiLog = (...args: unknown[]) => {
  if (AI_LOG_ENABLED) {
    console.log(...args);
  }
};

const aiWarn = (...args: unknown[]) => {
  if (AI_LOG_ENABLED) {
    console.warn(...args);
  }
};

// Helper function to format day names to abbreviations
const formatDayAbbreviation = (day: string): string => {
  const dayMap: { [key: string]: string } = {
    monday: "MON",
    tuesday: "TUE",
    wednesday: "WED",
    thursday: "THU",
    friday: "FRI",
    saturday: "SAT",
    sunday: "SUN",
  };

  const lowerDay = day.toLowerCase();
  return dayMap[lowerDay] || day.substring(0, 2).toUpperCase();
};

// Helper function to map section keys to storage section names
const mapSectionKeyToStorage = (
  sectionKey: string,
): "warmup" | "main" | "cooldown" => {
  const sectionMap: Record<string, "warmup" | "main" | "cooldown"> = {
    warm_up: "warmup",
    main_workout: "main",
    cooldown: "cooldown",
  };
  return sectionMap[sectionKey] || "main";
};

// Helper function to generate image slug from section and name
const createImageSlug = (section: string, name: string): string => {
  const storageSection = mapSectionKeyToStorage(section);
  const kebabName = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${storageSection}/${kebabName}`;
};

// Helper function to upload base64 image to Supabase Storage
const uploadImageToStorage = async (
  base64Image: string,
  gender: "male" | "female",
  imageSlug: string,
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    // Convert base64 to blob
    let imageBlob: Blob;
    if (base64Image.startsWith("data:image")) {
      const base64Data = base64Image.split(",")[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      imageBlob = new Blob([byteArray], { type: "image/png" });
    } else {
      // Raw base64 without data URL prefix
      const byteCharacters = atob(base64Image);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      imageBlob = new Blob([byteArray], { type: "image/png" });
    }

    // Upload to Supabase Storage
    const storagePath = `exercises/${gender}/${imageSlug}.png`;

    const { error: uploadError } = await supabase.storage
      .from("workouts")
      .upload(storagePath, imageBlob, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const publicUrl = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/${storagePath}`;
    return { success: true, url: publicUrl };
  } catch (err: any) {
    return { success: false, error: err?.message || "Upload failed" };
  }
};

// ============================================================================
// IMAGE GENERATION STATE is managed by ImageGenerationContext (background only).
// ============================================================================

const getLevelColor = (level: string): string => {
  const normalizedLevel: string = level.toLowerCase();
  if (normalizedLevel === "beginner") {
    return "bg-teal-500";
  } else if (normalizedLevel === "intermediate") {
    return "bg-amber-500";
  } else if (normalizedLevel === "advanced") {
    return "bg-red-500";
  }
  return "bg-amber-500";
};

const formatLevel = (level: string): string => {
  return level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
};

// Helper to render exercise metrics - hides "none" values but keeps raw value for saving
const renderExerciseMetrics = (
  setsRepsDurationRest: string | undefined,
): React.ReactNode => {
  if (!setsRepsDurationRest) return null;

  const metrics = parseExerciseMetrics(setsRepsDurationRest);
  const displayValue = formatExerciseMetricsForDisplay(metrics);

  // If everything is "none", don't display anything
  if (!displayValue) return null;

  return <p className="text-xs text-teal-600 font-medium">{displayValue}</p>;
};

// Helper to render complete exercise metrics (sets, reps, duration, rest)
const renderCompleteExerciseMetrics = (
  setsRepsDurationRest: string | undefined,
): React.ReactNode => {
  if (!setsRepsDurationRest) return null;

  const metrics = parsePlanExerciseMetricsForSave(setsRepsDurationRest);
  const hasAnyMetric =
    metrics.sets !== null ||
    metrics.reps !== null ||
    metrics.duration_seconds !== null ||
    /rest/i.test(setsRepsDurationRest);

  if (!hasAnyMetric) return null;

  const setsLabel =
    metrics.sets !== null
      ? `${metrics.sets} ${metrics.sets === 1 ? "set" : "sets"}`
      : "none sets";
  const repsLabel =
    metrics.reps !== null
      ? `${metrics.reps} ${metrics.reps === 1 ? "rep" : "reps"}`
      : "none reps";
  const durationLabel =
    metrics.duration_seconds !== null
      ? `${metrics.duration_seconds} sec`
      : "none sec";

  return (
    <p className="text-xs text-teal-600 font-medium">
      {`${setsLabel}, ${repsLabel}, ${durationLabel}, ${metrics.rest_seconds} sec rest`}
    </p>
  );
};

const SECTION_ORDER: Array<"warm_up" | "main_workout" | "cooldown"> = [
  "warm_up",
  "main_workout",
  "cooldown",
];

const getAvailableSections = (dayResult?: DayWorkoutResponse) => {
  if (!dayResult) return SECTION_ORDER;
  return SECTION_ORDER.filter(
    (section) => (dayResult[section]?.length ?? 0) > 0,
  );
};

// Helper to normalize estimated calories into "NNN kCal" format
const formatEstimatedCalories = (value: string | undefined): string | null => {
  if (!value) return null;
  const cleaned = value.replace(/\s*(k?cal|kcal)\s*/gi, "").trim();
  if (!cleaned) return null;
  return `${cleaned} kCal`;
};

// Helper to compute total minutes from exercises (seconds + reps-as-seconds)
const calculateTotalMinutes = (
  exercises: ExerciseItem[] | undefined,
): number => {
  if (!exercises || exercises.length === 0) return 0;

  const totalSeconds = exercises.reduce((sum, exercise) => {
    const metrics = parseExerciseMetrics(
      exercise.sets_reps_duration_seconds_rest,
    );
    const sets = metrics.sets ?? 1;

    if (metrics.duration_seconds !== null && metrics.duration_seconds > 0) {
      return sum + metrics.duration_seconds * sets;
    }

    if (metrics.reps !== null && metrics.reps > 0) {
      // Treat each rep as 1 second when duration is not provided
      return sum + metrics.reps * sets;
    }

    return sum;
  }, 0);

  return totalSeconds > 0 ? Math.ceil(totalSeconds / 60) : 0;
};

// Parse metrics for DB save, ensuring duration excludes rest value and 0-sec rest maps to 5
const parsePlanExerciseMetricsForSave = (value: string | undefined) => {
  const parsed = parseExerciseMetrics(value);

  if (!value || value.toLowerCase().trim() === "none") {
    return parsed;
  }

  const lowerValue = value.toLowerCase();
  const normalized = { ...parsed };

  const setsMatch = lowerValue.match(/(\d+)\s*sets?\b/i);
  if (setsMatch) {
    normalized.sets = parseInt(setsMatch[1], 10);
  }

  const repsMatch = lowerValue.match(/(\d+)\s*reps?\b/i);
  if (repsMatch) {
    normalized.reps = parseInt(repsMatch[1], 10);
  }

  // Pick the last seconds value that is not tied to rest.
  const secondMatches = Array.from(
    lowerValue.matchAll(/(\d+)\s*(?:sec|secs|second|seconds)\b/gi),
  );
  let durationSecondsFromRaw: number | null = null;
  secondMatches.forEach((match) => {
    const idx = match.index ?? -1;
    if (idx < 0) return;

    const before = lowerValue.slice(Math.max(0, idx - 8), idx);
    const after = lowerValue.slice(idx + match[0].length, idx + match[0].length + 8);
    const isRestValue = /\brest\s*$/.test(before) || /^\s*rest\b/.test(after);

    if (!isRestValue) {
      durationSecondsFromRaw = parseInt(match[1], 10);
    }
  });

  if (durationSecondsFromRaw !== null) {
    normalized.duration_seconds = durationSecondsFromRaw;
  }

  const restAfterMatch = lowerValue.match(
    /(\d+)\s*(?:sec|secs|second|seconds)\s*rest\b/i,
  );
  const restBeforeMatch = lowerValue.match(
    /\brest\s*(\d+)\s*(?:sec|secs|second|seconds)\b/i,
  );
  const restValue = restAfterMatch?.[1] || restBeforeMatch?.[1];
  if (restValue) {
    normalized.rest_seconds = parseInt(restValue, 10);
  }

  if (normalized.rest_seconds === 0) {
    normalized.rest_seconds = 5;
  }

  return normalized;
};

export default function PersonalPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { fetchUserProfile } = useUserData();
  const { userProfile: userContextProfile } = useUserContext();
  const { showPlanDialog } = usePlansContext();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(
    userContextProfile ?? null,
  );
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // OpenAI connection test state
  const [openAITestResult, setOpenAITestResult] = useState<{
    isTesting: boolean;
    success: boolean | null;
    message?: string;
  }>({
    isTesting: false,
    success: null,
  });

  // Workout generation state
  const [isGeneratingWorkout, setIsGeneratingWorkout] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState<string | null>(null);
  const [parsedWorkouts, setParsedWorkouts] = useState<DailyWorkout[]>([]);
  const [workoutPlanJSON, setWorkoutPlanJSON] =
    useState<WorkoutPlanJSON | null>(null);

  // Plan metadata state (console only, not displayed)
  const [planMetadata, setPlanMetadata] = useState<PlanMetadataResponse | null>(
    null,
  );

  // Day-specific workout generation state
  const [generatingDays, setGeneratingDays] = useState<Record<string, boolean>>(
    {},
  );
  const [dayWorkoutResults, setDayWorkoutResults] = useState<
    Record<string, DayWorkoutResponse>
  >({});

  // Track selected exercise section for each day
  const [selectedSection, setSelectedSection] = useState<
    Record<string, "warm_up" | "main_workout" | "cooldown" | null>
  >({});

  // Image generation from context (persists across navigation)
  const { clearImageGeneration, setExerciseImage } = useImageGeneration();

  // Dialog state for workout plan
  const [showWorkoutPlanDialog, setShowWorkoutPlanDialog] = useState(false);
  const [showImageProcessingDialog, setShowImageProcessingDialog] =
    useState(false);

  // Duration selection dialog state
  const [showDurationDialog, setShowDurationDialog] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(0);

  // Track if auto-generation has been initiated
  const autoGenerationStartedRef = useRef(false);
  // Track which days have been generated to avoid re-checking state
  const generatedDaysRef = useRef<Set<string>>(new Set());
  const dayCardsScrollRef = useRef<HTMLDivElement | null>(null);
  const [dayCardsCanScrollLeft, setDayCardsCanScrollLeft] = useState(false);
  const [dayCardsCanScrollRight, setDayCardsCanScrollRight] = useState(false);
  const [isRefreshingPage, setIsRefreshingPage] = useState(false);
  const updateDayCardsScrollState = useCallback(() => {
    const container = dayCardsScrollRef.current;
    if (!container) return;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    setDayCardsCanScrollLeft(container.scrollLeft > 0);
    setDayCardsCanScrollRight(container.scrollLeft < maxScrollLeft - 1);
  }, []);

  // Coach workout plans state
  const { fetchCoachWorkoutPlans } = useCoachWorkoutData();
  const [coachWorkoutPlans, setCoachWorkoutPlans] = useState<
    CoachWorkoutPlanWithTags[]
  >([]);
  const [isLoadingCoachPlans, setIsLoadingCoachPlans] = useState(false);

  // User workout plans state
  const {
    createUserWorkoutPlan,
    getRandomImagePath,
    createUserWorkoutWeekPlan,
    createUserWorkoutWeeklyPlans,
    createOrReuseExerciseDetailsBatch,
    createUserWorkoutPlanExercisesBatch,
    getExercisePosition,
    getExerciseImagePath,
    generateImageSlug,
    generateAndUploadExerciseImage,
    checkExerciseImageExists,
    fetchAllUserExerciseDetails,
    fetchUserWorkoutPlans,
  } = useUserWorkoutData();
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // My Workout Plans state
  const [myWorkoutPlans, setMyWorkoutPlans] = useState<
    import("@/types/UserWorkout").UserWorkoutPlan[]
  >([]);
  const [isLoadingMyPlans, setIsLoadingMyPlans] = useState(false);

  const updateMyWorkoutPlansCache = (
    plans: import("@/types/UserWorkout").UserWorkoutPlan[],
    userId: string | undefined,
  ) => {
    setMyWorkoutPlans(plans);
    if (typeof window !== "undefined" && userId) {
      try {
        localStorage.setItem(
          `my_workout_plans_cache_${userId}`,
          JSON.stringify({
            data: plans,
            timestamp: Date.now(),
          }),
        );
      } catch (error) {
        console.warn("Error caching my workout plans:", error);
      }
    }
  };

  // Track if a plan was just saved (for background image generation)
  const planJustSavedRef = useRef(false);

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({ show: false, message: "", type: "success" });

  // Show toast helper function
  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    setToast({ show: true, message, type });
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 5000);
  };

  const handleRefreshPage = useCallback(() => {
    setIsRefreshingPage(true);
    window.location.reload();
  }, []);

  // Get user's plan tier
  const getUserPlanTier = (): "free" | "pro" | "premium" => {
    const planCode = userContextProfile?.plan_code?.toLowerCase() || "free";
    if (planCode === "premium") return "premium";
    if (planCode === "pro") return "pro";
    return "free";
  };

  // Check if a plan is unlocked based on user tier and plan index
  const isPlanUnlocked = (planIndex: number): boolean => {
    const userTier = getUserPlanTier();

    // Premium users can access everything
    if (userTier === "premium") return true;

    // Pro users can access only the first plan (index 0)
    if (userTier === "pro") return planIndex === 0;

    // Free users can access nothing
    return false;
  };

  // Handle plan click
  const handlePlanClick = (
    plan: CoachWorkoutPlanWithTags,
    planIndex: number,
  ) => {
    const unlocked = isPlanUnlocked(planIndex);

    if (!unlocked) {
      // Show plan dialog to upgrade
      const userTier = getUserPlanTier();
      showPlanDialog({
        showAllPlans: false,
        highlightTier: userTier === "free" ? "pro" : "premium",
        onPlanSelect: (planCode: string, tier: PlanTier) => {
          console.log("Selected plan:", planCode, tier);
          // TODO: Navigate to payment/subscription page
        },
      });
      return;
    }

    // Navigate to coach workout details page
    router.push(`/personal/coach/workout/details?id=${plan.id}`);
  };

  // Keep local profile in sync with context
  useEffect(() => {
    if (userContextProfile) {
      setUserProfile(userContextProfile);
    }
  }, [userContextProfile]);

  // Fetch user profile on mount
  useEffect(() => {
    if (user?.id) {
      loadUserProfile();
    }
  }, [user?.id]);

  const loadUserProfile = async () => {
    if (!user?.id) return;
    setIsLoadingProfile(true);
    try {
      const result = await fetchUserProfile(user.id);
      if (result.success && result.data) {
        setUserProfile(result.data);
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Test OpenAI connection on mount
  useEffect(() => {
    async function testOpenAI() {
      setOpenAITestResult({ isTesting: true, success: null });
      const result = await testOpenAIConnectionFull();
      setOpenAITestResult({
        isTesting: false,
        success: result,
        message: result
          ? "OpenAI connection successful!"
          : "OpenAI connection failed. Check console for details.",
      });
    }
    testOpenAI();
  }, []);

  useEffect(() => {
    const container = dayCardsScrollRef.current;
    if (!container) return;

    updateDayCardsScrollState();
    container.addEventListener("scroll", updateDayCardsScrollState, {
      passive: true,
    });
    window.addEventListener("resize", updateDayCardsScrollState);

    return () => {
      container.removeEventListener("scroll", updateDayCardsScrollState);
      window.removeEventListener("resize", updateDayCardsScrollState);
    };
  }, [updateDayCardsScrollState, workoutPlanJSON]);

  // Fetch coach workout plans on mount with localStorage caching
  useEffect(() => {
    const CACHE_KEY = "coach_workout_plans_cache";
    const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

    async function loadCoachWorkoutPlans() {
      // Check cache first
      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            const age = Date.now() - parsed.timestamp;

            // Use cached data if it's still fresh
            if (age < CACHE_DURATION && parsed.data) {
              setCoachWorkoutPlans(parsed.data);
              setIsLoadingCoachPlans(false);
              return;
            }
          }
        } catch (error) {
          console.warn("Error reading cache:", error);
          // Clear invalid cache
          localStorage.removeItem(CACHE_KEY);
        }
      }

      // Fetch fresh data
      setIsLoadingCoachPlans(true);
      try {
        const result = await fetchCoachWorkoutPlans();
        if (result.success && result.data) {
          // Fetch tags for each plan
          const { supabase } = await import("@/lib/api/supabase");
          const { data: tagsData } = await supabase
            .from("workout_tags")
            .select("*")
            .order("name", { ascending: true });

          const plansWithTags = await Promise.all(
            result.data.map(async (plan) => {
              const { data: planTagsData } = await supabase
                .from("coach_workout_plan_tags")
                .select("tag_id")
                .eq("plan_id", plan.id);

              const tagIds = planTagsData?.map((pt) => pt.tag_id) || [];
              const tags = (tagsData || []).filter((tag) =>
                tagIds.includes(tag.id),
              );

              return { ...plan, tags };
            }),
          );

          setCoachWorkoutPlans(plansWithTags);

          // Cache the data
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                  data: plansWithTags,
                  timestamp: Date.now(),
                }),
              );
            } catch (error) {
              console.warn("Error caching data:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error loading coach workout plans:", error);
      } finally {
        setIsLoadingCoachPlans(false);
      }
    }
    loadCoachWorkoutPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch user's saved workout plans on mount with localStorage caching
  useEffect(() => {
    async function loadMyWorkoutPlans() {
      if (!user?.id) return;

      const CACHE_KEY = `my_workout_plans_cache_${user.id}`;
      const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

      // Check cache first
      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            const age = Date.now() - parsed.timestamp;

            if (age < CACHE_DURATION && parsed.data) {
              setMyWorkoutPlans(parsed.data);
              setIsLoadingMyPlans(false);
              return;
            }
          }
        } catch (error) {
          console.warn("Error reading my workout plans cache:", error);
          localStorage.removeItem(CACHE_KEY);
        }
      }

      setIsLoadingMyPlans(true);
      try {
        const result = await fetchUserWorkoutPlans(user.id);
        if (result.success && result.data) {
          updateMyWorkoutPlansCache(result.data, user.id);
        }
      } catch (error) {
        console.error("Error loading user workout plans:", error);
      } finally {
        setIsLoadingMyPlans(false);
      }
    }
    loadMyWorkoutPlans();
  }, [user?.id, fetchUserWorkoutPlans]);

  // Handle AI card click - Show duration selection dialog first
  const handleAICardClick = () => {
    if (isGeneratingWorkout) return;
    setShowDurationDialog(true);
  };

  // Handle duration selection and start workout generation
  const handleDurationSelect = (days: number) => {
    setSelectedDuration(days);
    setShowDurationDialog(false);
    setGenerationSeconds(0);
    setShowGenerationModal(true);
    handleStartGeneration(days);
  };

  // NOTE: Sequential day processing is now handled by ImageGenerationContext
  // The context automatically queues next day when previous completes

  // Handle workout generation after duration is selected
  const handleStartGeneration = async (durationDays: number) => {
    if (isGeneratingWorkout) return;

    setIsGeneratingWorkout(true);
    setGeneratedWorkout(null);
    setWorkoutPlanJSON(null);
    setParsedWorkouts([]);
    setPlanMetadata(null);
    setShowWorkoutPlanDialog(false);
    // Clear previous exercise images when generating new workout
    setDayWorkoutResults({});
    // Clear image generation state via context
    clearImageGeneration();
    // Reset auto-generation flags for a fresh run
    autoGenerationStartedRef.current = false;
    generatedDaysRef.current.clear();

    try {
      // Validate user profile data before proceeding
      if (!userProfile) {
        console.error("Ã¢ÂÅ’ User profile not available");
        alert("Please complete your profile before generating a workout plan.");
        setIsGeneratingWorkout(false);
        return;
      }

      // Prepare user data for prompts
      const userData = {
        gender: userProfile.gender || "not specified",
        goal: userProfile.fitness_goal || "not specified",
        location: userProfile.workout_location || "not specified",
        equipments: userProfile.equipment_list?.length
          ? userProfile.equipment_list.join(", ")
          : "not specified",
        level: userProfile.fitness_level || "not specified",
        schedule: userProfile.weekly_frequency?.length
          ? userProfile.weekly_frequency.join(", ")
          : "not specified",
        age: userProfile.age_range || "not specified",
        duration: userProfile.workout_duration_minutes
          ? userProfile.workout_duration_minutes.toString()
          : "not specified",
      };

      // Use user-selected duration for the plan
      const planDuration = `${durationDays} days`;

      // Log user data being sent to prompts
      aiLog("Ã°Å¸â€˜Â¤ User Data for Prompts:", {
        ...userData,
        plan_duration: planDuration,
      });

      // Step 1: Generate plan metadata first to get plan_name
      aiLog("Ã°Å¸ÂÂ·Ã¯Â¸Â Step 1: Generating Plan Metadata with duration:", planDuration);
      const metadataResult = await generatePlanMetadataWithPrompt({
        gender: userData.gender,
        goal: userData.goal,
        location: userData.location,
        equipments: userData.equipments,
        level: userData.level,
        schedule: userData.schedule,
        age: userData.age,
        duration: userData.duration,
      });

      let generatedPlanName = "Personalized Workout Plan";

      if (metadataResult.success && metadataResult.response) {
        // Override duration_days with user-selected duration
        const updatedMetadata = {
          ...metadataResult.response,
          duration_days: durationDays, // Use user-selected duration
        };
        aiLog(
          "Ã¢Å“â€¦ Plan Metadata Generated (with selected duration):",
          updatedMetadata,
        );
        setPlanMetadata(updatedMetadata);
        generatedPlanName = metadataResult.response.plan_name;
      } else {
        aiWarn(
          "Ã¢Å¡Â Ã¯Â¸Â Plan Metadata Generation Failed, using defaults:",
          metadataResult.error,
        );
        // Create default metadata with user-selected duration
        setPlanMetadata({
          plan_name: generatedPlanName,
          description: `A personalized ${durationDays}-day workout plan`,
          duration_days: durationDays,
          category: "General Fitness",
          tags: ["workout", "fitness"],
        });
      }

      // Step 2: Generate Workout Plan with user data and plan metadata
      aiLog(
        "Ã°Å¸â€œÅ  Step 2: Generating Workout Plan with plan_name:",
        generatedPlanName,
        "duration:",
        planDuration,
      );

      // Use the same validated user data for workout prompt
      const workoutVariables = {
        gender: userData.gender,
        goal: userData.goal,
        location: userData.location,
        equipments: userData.equipments,
        level: userData.level,
        schedule: userData.schedule,
        age: userData.age,
        duration: userData.duration,
        plan_name: generatedPlanName,
        plan_duration: planDuration, // Use user-selected duration
        week_number: "1",
      };

      const result = await generateWorkoutWithPrompt(workoutVariables);

      // Log generation result (excluding images)
      aiLog("Ã°Å¸â€œÅ  Workout Plan Generation Result:", {
        success: result.success,
        hasJson: !!result.json,
        hasResponse: !!result.response,
        error: result.error || null,
        json: result.json
          ? {
              plan_name: result.json.plan_name,
              plan_duration: result.json.plan_duration,
              week_theme: result.json.week_theme,
              week_number: result.json.week_number,
              category: result.json.category,
              description: result.json.description || null,
              rest_days: result.json.rest_days,
              days_count: Object.keys(result.json.days || {}).length,
              days_with_motivation: Object.entries(
                result.json.days || {},
              ).filter(([_, day]) => day?.motivation).length,
            }
          : null,
      });

      if (result.success) {
        // Use JSON if available, otherwise fall back to text parsing
        if (result.json) {
          // Log complete JSON structure with all fields
          aiLog("Ã¢Å“â€¦ Workout Plan JSON Generated (Complete Structure):", {
            plan_name: result.json.plan_name || null,
            plan_duration: result.json.plan_duration || null,
            week_theme: result.json.week_theme || null,
            week_number: result.json.week_number || null,
            category: result.json.category || null,
            description: result.json.description || null,
            rest_days: result.json.rest_days || [],
            days: Object.entries(result.json.days || {}).map(([day, data]) => ({
              day,
              title: data?.title || null,
              focus: data?.focus || null,
              motivation: data?.motivation || null,
            })),
          });

          // Also log the complete raw JSON for debugging
          aiLog(
            "Ã°Å¸â€œâ€ž Complete Raw JSON Object:",
            JSON.stringify(result.json, null, 2),
          );
          setWorkoutPlanJSON(result.json);
          setGeneratedWorkout(null);
          setParsedWorkouts([]);
        } else if (result.response) {
          // Fallback to text parsing for backward compatibility
          const workoutText =
            typeof result.response === "string"
              ? result.response
              : JSON.stringify(result.response, null, 2);
          aiLog("Ã¢Å“â€¦ Workout Plan Text Generated (length):", workoutText.length);
          setGeneratedWorkout(workoutText);
          setWorkoutPlanJSON(null);

          // Parse the workout response into structured daily workouts
          try {
            const workouts = parseWorkoutResponse(workoutText);
            aiLog("Ã¢Å“â€¦ Parsed Workouts:", workouts.length, "days");
            setParsedWorkouts(workouts);
          } catch (error) {
            console.error("Error parsing workout response:", error);
            setParsedWorkouts([]);
          }
        }
      } else {
        console.error("Ã¢ÂÅ’ Workout Plan Generation Failed:", result.error);
        setGeneratedWorkout(
          result.error || "Unable to generate workout. Please try again.",
        );
        setParsedWorkouts([]);
        setWorkoutPlanJSON(null);
        setShowGenerationModal(false);
        setIsGeneratingWorkout(false);
        setShowGenerationModal(false);
      }
    } catch (error) {
      console.error("Error generating workout:", error);
      setGeneratedWorkout("An error occurred. Please try again.");
      setShowGenerationModal(false);
      setIsGeneratingWorkout(false);
    } finally {
      // Keep isGeneratingWorkout true until day exercises are fully generated
    }
  };

  // Regenerate a single exercise image and upload to storage
  const regenerateExerciseImage = async (
    dayName: string,
    section: "warm_up" | "main_workout" | "cooldown",
    index: number,
    exerciseName: string,
    exerciseDescription: string,
  ) => {
    if (!userProfile?.gender) {
      aiWarn("Cannot generate image: user gender not available");
      return;
    }

    const gender =
      userProfile.gender.toLowerCase() === "female" ||
      userProfile.gender.toLowerCase() === "f"
        ? ("female" as const)
        : ("male" as const);

    const imageKey = `${dayName}-${section}-${index}`;
    const imageSlug = createImageSlug(section, exerciseName);

    aiLog(`Ã°Å¸Å½Â¨ [Regenerate] Starting: ${exerciseName}`);
    aiLog(`    Ã°Å¸â€œâ€š Section: ${section} Ã¢â€ â€™ ${mapSectionKeyToStorage(section)}`);
    aiLog(`    Ã°Å¸ÂÂ·Ã¯Â¸Â Image slug: ${imageSlug}`);

    // Note: Individual image regeneration now uses context functions
    aiLog(`    Ã°Å¸â€œÂ¸ Generating image via context...`);

    try {
      const result = await generateExerciseImage(
        exerciseName,
        exerciseDescription,
        gender,
      );

      if (result.success && result.image) {
        setExerciseImage(imageKey, result.image);
        aiLog(`    Ã¢Å“â€¦ Image generated for display`);

        // Upload to storage
        aiLog(`    Ã°Å¸â€œÂ¤ Uploading to storage...`);
        const uploadResult = await uploadImageToStorage(
          result.image,
          gender,
          imageSlug,
        );

        if (uploadResult.success) {
          aiLog(`    Ã¢Å“â€¦ Uploaded: ${uploadResult.url}`);
          setExerciseImage(imageKey, uploadResult.url!);
        } else {
          aiWarn(`    Ã¢Å¡Â Ã¯Â¸Â Upload failed: ${uploadResult.error}`);
        }
      } else {
        aiWarn(`    Ã¢ÂÅ’ Failed to generate image: ${result.error}`);
      }
    } catch (error) {
      console.error(`    Ã¢ÂÅ’ Error: ${error}`);
    }
    aiLog(`Ã°Å¸Å½Â¨ [Regenerate] Complete: ${exerciseName}`);
  };

  // Generate images for all exercises in a day workout and upload to storage
  // Processes consecutively: warmup Ã¢â€ â€™ main Ã¢â€ â€™ cooldown
  const generateExerciseImagesForDay = async (
    dayName: string,
    dayResult: DayWorkoutResponse,
  ) => {
    if (!userProfile?.gender) {
      aiWarn("Cannot generate images: user gender not available");
      return;
    }

    const gender =
      userProfile.gender.toLowerCase() === "female" ||
      userProfile.gender.toLowerCase() === "f"
        ? ("female" as const)
        : ("male" as const);

    // Process sections in order: warmup Ã¢â€ â€™ main Ã¢â€ â€™ cooldown
    const sections = [
      {
        key: "warm_up" as const,
        name: "WARM UP",
        exercises: dayResult.warm_up || [],
      },
      {
        key: "main_workout" as const,
        name: "MAIN WORKOUT",
        exercises: dayResult.main_workout || [],
      },
      {
        key: "cooldown" as const,
        name: "COOLDOWN",
        exercises: dayResult.cooldown || [],
      },
    ];

    // Count total exercises for progress
    const totalExercises = sections.reduce(
      (acc, s) => acc + (s.exercises?.length || 0),
      0,
    );

    if (totalExercises === 0) {
      aiLog(`Ã¢Å¡Â Ã¯Â¸Â No exercises found for ${dayName}`);
      return;
    }

    let processedCount = 0;
    let generatedCount = 0;
    let uploadedCount = 0;
    let existsInStorageCount = 0;
    let failedCount = 0;

    aiLog(
      `\nÃ¢â€¢â€Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢â€”`,
    );
    aiLog(
      `Ã¢â€¢â€˜  Ã°Å¸Å½Â¨ AUTO-GENERATING IMAGES FOR: ${dayName.toUpperCase().padEnd(28)} Ã¢â€¢â€˜`,
    );
    aiLog(`Ã¢â€¢Â Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â£`);
    aiLog(`Ã¢â€¢â€˜  Ã°Å¸â€œÅ  Total exercises: ${String(totalExercises).padEnd(40)} Ã¢â€¢â€˜`);
    aiLog(`Ã¢â€¢â€˜  Ã°Å¸â€˜Â¤ Gender: ${gender.padEnd(49)} Ã¢â€¢â€˜`);
    aiLog(
      `Ã¢â€¢â€˜  Ã°Å¸â€œâ€š Sections: warmup(${sections[0].exercises.length}) Ã¢â€ â€™ main(${sections[1].exercises.length}) Ã¢â€ â€™ cooldown(${sections[2].exercises.length})`.padEnd(
        64,
      ) + ` Ã¢â€¢â€˜`,
    );
    aiLog(`Ã¢â€¢Å¡Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â`);

    // Process each section consecutively
    for (const section of sections) {
      if (!section.exercises || section.exercises.length === 0) {
        aiLog(`\nÃ°Å¸â€œâ€š ${section.name}: (empty - skipping)`);
        continue;
      }

      aiLog(
        `\nÃ¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â`,
      );
      aiLog(
        `Ã¢â€â€š  Ã°Å¸â€œâ€š ${section.name} (${section.exercises.length} exercises)`.padEnd(
          64,
        ) + `Ã¢â€â€š`,
      );
      aiLog(
        `Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ`,
      );

      // Process each exercise in this section consecutively
      for (let index = 0; index < section.exercises.length; index++) {
        const exercise = section.exercises[index];
        if (!exercise.name) {
          aiLog(`    Ã¢Å¡Â Ã¯Â¸Â Exercise ${index + 1} has no name, skipping`);
          continue;
        }

        processedCount++;
        const progress = `[${processedCount}/${totalExercises}]`;
        const imageKey = `${dayName}-${section.key}-${index}`;
        const imageSlug = createImageSlug(section.key, exercise.name);
        const storageUrl = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/exercises/${gender}/${imageSlug}.png`;

        aiLog(`\n${progress} Ã°Å¸â€Â Checking: ${exercise.name}`);
        aiLog(`    Ã°Å¸ÂÂ·Ã¯Â¸Â Slug: ${imageSlug}`);
        aiLog(`    Ã°Å¸â€â€” URL: ${storageUrl}`);

        // Check if image already exists in storage
        let imageExistsInStorage = false;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const response = await fetch(storageUrl, {
            method: "GET",
            headers: { Range: "bytes=0-0" },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          imageExistsInStorage = response.ok || response.status === 206;
        } catch {
          imageExistsInStorage = false;
        }

        if (imageExistsInStorage) {
          aiLog(`${progress} Ã¢Å“â€¦ EXISTS in storage: ${exercise.name}`);
          existsInStorageCount++;
          // Set the image in state for display via context
          setExerciseImage(imageKey, storageUrl);
          continue;
        }

        // Generate and upload the image
        aiLog(`${progress} Ã°Å¸Å½Â¨ GENERATING: ${exercise.name}...`);

        try {
          const exerciseDescription =
            exercise.description || exercise.safety_cue || "A fitness exercise";

          // Step 1: Generate the image
          const result = await generateExerciseImage(
            exercise.name,
            exerciseDescription,
            gender,
          );

          if (result.success && result.image) {
            generatedCount++;
            aiLog(`${progress} Ã¢Å“â€¦ Generated: ${exercise.name}`);

            // Update state immediately so user sees the image
            setExerciseImage(imageKey, result.image);

            // Step 2: Upload to storage
            aiLog(`${progress} Ã°Å¸â€œÂ¤ Uploading to storage...`);
            const uploadResult = await uploadImageToStorage(
              result.image,
              gender,
              imageSlug,
            );

            if (uploadResult.success) {
              uploadedCount++;
              aiLog(`${progress} Ã¢Å“â€¦ Uploaded: ${exercise.name}`);
              aiLog(`    Ã°Å¸â€â€” ${uploadResult.url}`);
              // Update with final storage URL
              setExerciseImage(imageKey, uploadResult.url!);
            } else {
              aiWarn(`${progress} Ã¢Å¡Â Ã¯Â¸Â Upload failed: ${uploadResult.error}`);
            }
          } else {
            failedCount++;
            aiWarn(`${progress} Ã¢ÂÅ’ Generation failed: ${result.error}`);
          }
        } catch (error) {
          failedCount++;
          console.error(`${progress} Ã¢ÂÅ’ Error: ${error}`);
        }

        // Delay between exercises to avoid rate limiting
        if (index < section.exercises.length - 1) {
          aiLog(`    Ã¢ÂÂ³ Waiting 1.5s before next exercise...`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      aiLog(`\n    Ã¢Å“â€¦ ${section.name} section complete!`);
    }

    // Final summary
    aiLog(
      `\nÃ¢â€¢â€Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢â€”`,
    );
    aiLog(`Ã¢â€¢â€˜  Ã°Å¸Å½Â¨ COMPLETE: ${dayName.toUpperCase().padEnd(47)} Ã¢â€¢â€˜`);
    aiLog(`Ã¢â€¢Â Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â£`);
    aiLog(`Ã¢â€¢â€˜  Ã°Å¸â€œÅ  Total processed: ${String(processedCount).padEnd(40)} Ã¢â€¢â€˜`);
    aiLog(
      `Ã¢â€¢â€˜  Ã¢Å“â€¦ Already in storage: ${String(existsInStorageCount).padEnd(37)} Ã¢â€¢â€˜`,
    );
    aiLog(`Ã¢â€¢â€˜  Ã°Å¸Å½Â¨ Generated: ${String(generatedCount).padEnd(46)} Ã¢â€¢â€˜`);
    aiLog(`Ã¢â€¢â€˜  Ã°Å¸â€œÂ¤ Uploaded: ${String(uploadedCount).padEnd(47)} Ã¢â€¢â€˜`);
    aiLog(`Ã¢â€¢â€˜  Ã¢ÂÅ’ Failed: ${String(failedCount).padEnd(49)} Ã¢â€¢â€˜`);
    aiLog(`Ã¢â€¢Å¡Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â`);

    if (generatedCount > 0) {
      aiLog(
        `%cÃ¢Å“Â¨ ${generatedCount} new images generated for ${dayName}!`,
        "color: green; font-weight: bold; font-size: 14px;",
      );
    }

    return true;
  };

  // NOTE: processImageGenerationQueue and retryFailedImages are now handled by
  // ImageGenerationContext. The context runs processing in the background and
  // persists across navigation.

  // Handle day-specific workout generation
  const handleDayWorkoutGenerate = async (
    dayName: string,
    dayTitle: string,
    dayFocus: string,
  ) => {
    if (generatingDays[dayName]) return;

    setGeneratingDays((prev) => ({ ...prev, [dayName]: true }));

    try {
      // Validate user profile data
      if (!userProfile) {
        console.error(
          "Ã¢ÂÅ’ User profile not available for day workout generation",
        );
        setGeneratingDays((prev) => ({ ...prev, [dayName]: false }));
        return;
      }

      // Prepare validated user data for day workout prompt
      const userData = {
        gender: userProfile.gender || "not specified",
        goal: userProfile.fitness_goal || "not specified",
        location: userProfile.workout_location || "not specified",
        equipments: userProfile.equipment_list?.length
          ? userProfile.equipment_list.join(", ")
          : "not specified",
        level: userProfile.fitness_level || "not specified",
        schedule: userProfile.weekly_frequency?.length
          ? userProfile.weekly_frequency.join(", ")
          : "not specified",
        age: userProfile.age_range || "not specified",
        duration: userProfile.workout_duration_minutes
          ? userProfile.workout_duration_minutes.toString()
          : "not specified",
      };

      // Log user data for day workout
      aiLog(`Ã°Å¸â€˜Â¤ User Data for Day Workout (${dayName}):`, userData);

      // Build day-specific variables with validated user data
      const dayVariables = {
        gender: userData.gender,
        goal: userData.goal,
        location: userData.location,
        equipments: userData.equipments,
        level: userData.level,
        schedule: userData.schedule,
        age: userData.age,
        duration: userData.duration,
        day_name: dayName,
        plan_name: dayTitle,
        day_focus: dayFocus,
        plan_duration: workoutPlanJSON?.plan_duration || "28 days",
        week_number: workoutPlanJSON?.week_number || "1",
      };

      const result = await generateDayWorkoutWithPrompt(dayVariables);

      // Log day workout generation result (excluding images)
      if (result.success && result.response) {
        const dayResult = result.response;
        aiLog(`Ã¢Å“â€¦ Day Workout Generated - ${dayName}:`, {
          day: dayResult.day || dayName,
          name: dayResult.name,
          focus: dayResult.focus,
          estimated_calories:
            dayResult["estimated total calories"] ||
            dayResult.estimated_total_calories,
          warm_up_count: dayResult.warm_up?.length || 0,
          main_workout_count: dayResult.main_workout?.length || 0,
          cooldown_count: dayResult.cooldown?.length || 0,
          warm_up:
            dayResult.warm_up?.map((ex) => ({
              name: ex.name,
              sets_reps_duration_seconds_rest:
                ex.sets_reps_duration_seconds_rest,
              per_side: ex.per_side,
            })) || [],
          main_workout:
            dayResult.main_workout?.map((ex) => ({
              name: ex.name,
              sets_reps_duration_seconds_rest:
                ex.sets_reps_duration_seconds_rest,
              per_side: ex.per_side,
            })) || [],
          cooldown:
            dayResult.cooldown?.map((ex) => ({
              name: ex.name,
              sets_reps_duration_seconds_rest:
                ex.sets_reps_duration_seconds_rest,
              per_side: ex.per_side,
            })) || [],
        });
      } else {
        console.error(`Ã¢ÂÅ’ Day Workout Generation Failed - ${dayName}:`, {
          error: result.error,
          success: result.success,
        });
      }

      if (result.success && result.response) {
        setDayWorkoutResults((prev) => ({
          ...prev,
          [dayName]: result.response!,
        }));
        // Set default view to Warm Up
        setSelectedSection((prev) => ({
          ...prev,
          [dayName]: "warm_up",
        }));

        // DON'T start image generation here - wait for ALL exercises to be generated first
        // Image generation will be triggered by the useEffect that monitors exercise completion
        aiLog(
          `Ã¢Å“â€¦ ${dayName}: Exercises generated. Waiting for all days to complete before image generation.`,
        );

        return true; // Success
      } else {
        // Don't show alert during auto-generation
        if (!autoGenerationStartedRef.current) {
          alert(
            result.error ||
              "Unable to generate workout for this day. Please try again.",
          );
        }
        return false; // Failure
      }
    } catch (error) {
      console.error("Error generating day workout:", error);
      // Don't show alert during auto-generation
      if (!autoGenerationStartedRef.current) {
        alert("An error occurred. Please try again.");
      }
      return false; // Failure
    } finally {
      setGeneratingDays((prev) => ({ ...prev, [dayName]: false }));
    }
  };

  const generationSteps = [
    {
      title: "Analyzing and Reading your profile",
      detail: "Reviewing goals, schedule, and equipment.",
    },
    {
      title: "Generating Workout Plan",
      detail: "Building your weekly structure and focus.",
    },
    {
      title: "Adding Exercises",
      detail: "Curating warmups, main sets, and cooldowns.",
    },
    {
      title: "Finalizing",
      detail: "Polishing details and double-checking flow.",
    },
  ];

  const generationStepTimings = [0, 20, 45, 70];
  const generationDurationSeconds = 90;
  const generationProgressPercent = Math.min(
    Math.round((generationSeconds / generationDurationSeconds) * 100),
    100,
  );
  const currentGenerationStep = generationStepTimings.reduce(
    (acc, startTime, index) => (generationSeconds >= startTime ? index : acc),
    0,
  );

  const expectedDayNames = useMemo(() => {
    if (!workoutPlanJSON?.days) return [];
    const dayOrder = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ] as const;
    type DayName = (typeof dayOrder)[number];

    return dayOrder.filter((dayName) => {
      const day = workoutPlanJSON.days?.[dayName as DayName];
      return day?.title?.trim() && day?.focus?.trim();
    });
  }, [workoutPlanJSON]);

  const allDaysGenerated =
    expectedDayNames.length > 0 &&
    expectedDayNames.every((dayName) => dayWorkoutResults[dayName]);

  useEffect(() => {
    if (!showGenerationModal) {
      setGenerationSeconds(0);
      return;
    }

    const startTime = Date.now();
    const intervalId = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      setGenerationSeconds(Math.min(elapsedSeconds, generationDurationSeconds));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [showGenerationModal]);

  useEffect(() => {
    if (!isGeneratingWorkout || !workoutPlanJSON) {
      return;
    }

    if (expectedDayNames.length === 0) {
      setIsGeneratingWorkout(false);
      setShowGenerationModal(false);
      setShowWorkoutPlanDialog(true);
      return;
    }

    if (allDaysGenerated) {
      setIsGeneratingWorkout(false);
      setShowGenerationModal(false);
      setShowWorkoutPlanDialog(true);
    }
  }, [
    allDaysGenerated,
    expectedDayNames.length,
    isGeneratingWorkout,
    workoutPlanJSON,
  ]);

  // Auto-generate exercises for all days sequentially when plan is ready
  useEffect(() => {
    if (workoutPlanJSON && !autoGenerationStartedRef.current) {
      autoGenerationStartedRef.current = true;

      // Get ordered list of days
      const daysWithData = expectedDayNames
        .map((dayName) => [dayName, workoutPlanJSON.days?.[dayName]] as const)
        .filter(([_, day]) => day?.title?.trim() && day?.focus?.trim());

      // Sequentially generate exercises for each day
      const generateAllDays = async () => {
        aiLog(
          `Ã°Å¸â€œâ€¹ Starting exercise generation for ${daysWithData.length} days...`,
        );

        const queue = [...daysWithData];
        let index = 0;
        const worker = async () => {
          while (index < queue.length) {
            const current = queue[index];
            index += 1;
            if (!current) break;
            const [dayName, day] = current;

            // Skip if already generated (check both ref and current state)
            if (
              generatedDaysRef.current.has(dayName) ||
              dayWorkoutResults[dayName]
            ) {
              aiLog(`Ã¢ÂÂ­Ã¯Â¸Â Skipping ${dayName} - already generated`);
              continue;
            }

            aiLog(`Ã°Å¸â€â€ž Auto-generating exercises for ${dayName}...`);
            const success = await handleDayWorkoutGenerate(
              dayName,
              day.title,
              day.focus,
            );

            if (success) {
              generatedDaysRef.current.add(dayName);
            }
          }
        };

        const workers = Array.from(
          { length: Math.min(DAY_GEN_CONCURRENCY, queue.length) },
          () => worker(),
        );

        await Promise.all(workers);
        aiLog("Ã¢Å“â€¦ All day exercises generated.");
      };

      generateAllDays();
    }

    // Clean up states when dialog closes
    if (
      !showWorkoutPlanDialog &&
      !isGeneratingWorkout &&
      !showGenerationModal
    ) {
      // If plan was just saved, start background image checking instead of clearing everything
      if (planJustSavedRef.current) {
        aiLog(
          "Ã°Å¸â€œÂ· Plan saved - starting background image check for saved exercises...",
        );
        planJustSavedRef.current = false; // Reset the flag

        // Refresh the My Workout Plans list
        if (user?.id) {
          fetchUserWorkoutPlans(user.id).then((result) => {
            if (result.success && result.data) {
              updateMyWorkoutPlansCache(result.data, user.id);
            }
          });
        }

        // Start background image checking for saved exercises
        (async () => {
          try {
            if (!userProfile?.gender) {
              aiWarn("Ã¢ÂÅ’ Cannot check images: user gender not available");
              return;
            }

            const gender =
              userProfile.gender.toLowerCase() === "female" ||
              userProfile.gender.toLowerCase() === "f"
                ? "female"
                : "male";

            aiLog(`Ã°Å¸â€Â Fetching saved exercise details...`);
            const result = await fetchAllUserExerciseDetails();

            if (!result.success || !result.data) {
              aiWarn("Ã¢ÂÅ’ Failed to fetch exercise details:", result.error);
              return;
            }

            const exercises = result.data;
            aiLog(`Ã°Å¸â€œâ€¹ Found ${exercises.length} saved exercises`);

            let checkedCount = 0;
            let existingCount = 0;
            let generatedCount = 0;
            let failedCount = 0;

            for (const exercise of exercises) {
              if (!exercise.image_slug) {
                aiLog(`Ã¢ÂÂ­Ã¯Â¸Â Skipping ${exercise.name}: no image_slug`);
                continue;
              }

              checkedCount++;
              const storageUrl = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/exercises/${gender}/${exercise.image_slug}.png`;

              // Check if image exists
              let imageExists = false;
              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const response = await fetch(storageUrl, {
                  method: "GET",
                  headers: { Range: "bytes=0-0" },
                  signal: controller.signal,
                });
                clearTimeout(timeoutId);
                imageExists = response.ok || response.status === 206;
              } catch {
                imageExists = false;
              }

              if (imageExists) {
                existingCount++;
                aiLog(`Ã¢Å“â€¦ [${checkedCount}] ${exercise.name}: EXISTS`);
              } else {
                aiLog(`Ã°Å¸Å½Â¨ [${checkedCount}] ${exercise.name}: GENERATING...`);

                // Generate and upload the image
                const genResult = await generateAndUploadExerciseImage(
                  exercise.name,
                  exercise.safety_cue || "A fitness exercise",
                  gender as "male" | "female",
                  exercise.image_slug,
                );

                if (genResult.success) {
                  generatedCount++;
                  aiLog(`Ã¢Å“â€¦ [${checkedCount}] ${exercise.name}: UPLOADED`);
                } else {
                  failedCount++;
                  aiWarn(
                    `Ã¢ÂÅ’ [${checkedCount}] ${exercise.name}: FAILED - ${genResult.error}`,
                  );
                }

                // Small delay between generations to avoid rate limiting
                await new Promise((resolve) => setTimeout(resolve, 1500));
              }
            }

            aiLog(`\n${"Ã¢â€¢Â".repeat(50)}`);
            aiLog(`Ã°Å¸Å½â€° BACKGROUND IMAGE CHECK COMPLETE`);
            aiLog(`${"Ã¢â€â‚¬".repeat(50)}`);
            aiLog(`Ã°Å¸â€œÅ  Results:`);
            aiLog(`   Checked: ${checkedCount}`);
            aiLog(`   Already existed: ${existingCount}`);
            aiLog(`   Generated: ${generatedCount}`);
            aiLog(`   Failed: ${failedCount}`);
            aiLog(`${"Ã¢â€¢Â".repeat(50)}\n`);
          } catch (error) {
            console.error("Ã¢ÂÅ’ Background image check error:", error);
          }
        })();

        // Clear UI states but NOT image generation context
        autoGenerationStartedRef.current = false;
        generatedDaysRef.current.clear();
        imageGenStartedRef.current = false;
        setWorkoutPlanJSON(null);
        setGeneratedWorkout(null);
        setParsedWorkouts([]);
        setPlanMetadata(null);
        setDayWorkoutResults({});
        setGeneratingDays({});
        setIsGeneratingWorkout(false);
        setSelectedSection({});

        aiLog("Ã¢Å“â€¦ UI states cleaned up, background image check running");
        return;
      }

      // Normal cleanup when dialog closes without saving
      aiLog("Ã°Å¸Â§Â¹ Cleaning up generation states and data...");

      // Reset auto-generation flags
      autoGenerationStartedRef.current = false;
      generatedDaysRef.current.clear();
      imageGenStartedRef.current = false;

      // Clear workout plan data
      setWorkoutPlanJSON(null);
      setGeneratedWorkout(null);
      setParsedWorkouts([]);
      setPlanMetadata(null); // Clear plan metadata

      // Clear day workout results
      setDayWorkoutResults({});

      // Clear image generation state via context
      clearImageGeneration();

      // Clear generation states
      setGeneratingDays({});
      setIsGeneratingWorkout(false);

      // Clear selected sections
      setSelectedSection({});

      // Clean up any localStorage/cookie settings related to generation
      if (typeof window !== "undefined") {
        try {
          // Remove any generation-related localStorage items
          const generationKeys = [
            "workout_generation_state",
            "workout_plan_json",
            "day_workout_results",
            "generated_days",
          ];
          generationKeys.forEach((key) => {
            localStorage.removeItem(key);
          });

          // Clear any generation-related cookies
          const cookies = document.cookie.split(";");
          cookies.forEach((cookie) => {
            const cookieName = cookie.split("=")[0].trim();
            if (
              cookieName.includes("workout") ||
              cookieName.includes("generation")
            ) {
              document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            }
          });
        } catch (error) {
          aiWarn("Error cleaning up storage:", error);
        }
      }

      aiLog("Ã¢Å“â€¦ All generation states and storage cleaned up");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    expectedDayNames,
    isGeneratingWorkout,
    showGenerationModal,
    showWorkoutPlanDialog,
    workoutPlanJSON,
  ]);

  // Track if image generation has been started for this session
  const imageGenStartedRef = useRef(false);

  // Handle saving the workout plan
  const handleSavePlan = async () => {
    console.log("Ã°Å¸â€Âµ handleSavePlan called - checking conditions:", {
      hasUserId: !!user?.id,
      userId: user?.id,
      hasWorkoutPlanJSON: !!workoutPlanJSON,
      hasPlanMetadata: !!planMetadata,
      dayWorkoutResultsCount: Object.keys(dayWorkoutResults).length,
    });

    if (!user?.id || !workoutPlanJSON) {
      console.error("Ã¢ÂÅ’ Save blocked: Missing user ID or workout plan JSON");
      alert(
        "Please ensure you're logged in and have a workout plan generated.",
      );
      return;
    }

    // Require planMetadata from prompt pmpt_697b9c2d67788195908580fac6389db000faf9c8a4b2d393
    if (!planMetadata) {
      alert(
        "Plan metadata is not available. Please regenerate the workout plan.",
      );
      console.error("Ã¢ÂÅ’ Cannot save: planMetadata is null");
      return;
    }

    setIsSavingPlan(true);
    console.log("Ã°Å¸Å¡â‚¬ Save started - isSavingPlan = true");

    try {
      const serializeAuthError = (error: unknown) => {
        if (!error) return null;
        if (error instanceof Error) {
          return {
            name: error.name,
            message: error.message,
            stack: error.stack,
          };
        }

        if (typeof error === "object") {
          const err = error as Record<string, unknown>;
          return {
            name: typeof err.name === "string" ? err.name : undefined,
            message: typeof err.message === "string" ? err.message : undefined,
            status: typeof err.status === "number" ? err.status : undefined,
            code: typeof err.code === "string" ? err.code : undefined,
            details: typeof err.details === "string" ? err.details : undefined,
          };
        }

        return { message: String(error) };
      };

      // Verify user session and start image lookup in parallel (with timeout)
      const sessionPromise = supabase.auth.getSession();
      const sessionTimeoutPromise = new Promise<{
        data: null;
        error: { message: string };
      }>((resolve) => {
        setTimeout(
          () =>
            resolve({
              data: null,
              error: { message: "Session check timed out" },
            }),
          10000,
        );
      });

      // All data MUST come from metadata prompt (pmpt_697b9c2d67788195908580fac6389db000faf9c8a4b2d393)
      // No fallbacks - strict data source

      // Get user's gender for image selection (normalize to male/female)
      const rawGender = userProfile?.gender?.toLowerCase().trim() || "female";
      const userGender =
        rawGender === "male" || rawGender === "m" ? "male" : "female";

      // Get user's location for image selection (normalize to gym/home)
      const rawLocation =
        userProfile?.workout_location?.toLowerCase().trim() || "gym";
      const userLocation = rawLocation === "home" ? "home" : "gym";

      // Get random image path based on user's gender and location (with timeout)
      console.log("Ã¢ÂÂ³ Getting random image path...");
      let imagePath: string | null = null;
      const imagePromise = getRandomImagePath(
        user.id,
        userGender,
        userLocation,
      );
      try {
        const timeoutPromise = new Promise<{ success: false; error: string }>(
          (resolve) => {
            setTimeout(
              () => resolve({ success: false, error: "Timeout" }),
              8000,
            );
          },
        );

        const imageResult = await Promise.race([imagePromise, timeoutPromise]);
        console.log("Ã¢Å“â€¦ Got image path result:", imageResult.success);

        if (imageResult.success && imageResult.data) {
          imagePath = imageResult.data;
        } else {
          // Fallback to a default image path
          const randomNum = Math.floor(Math.random() * 50) + 1;
          imagePath = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/plans/${userGender}/${userLocation}/${randomNum}.png`;
          console.log("Ã¢Å¡Â Ã¯Â¸Â Using fallback image path:", imagePath);
        }
      } catch (imgError) {
        console.warn("Ã¢Å¡Â Ã¯Â¸Â Error getting image path, using fallback:", imgError);
        const randomNum = Math.floor(Math.random() * 50) + 1;
        imagePath = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/plans/${userGender}/${userLocation}/${randomNum}.png`;
      }

      console.log("Ã°Å¸â€œÂ· Final image path:", imagePath);

      const sessionResult = (await Promise.race([
        sessionPromise,
        sessionTimeoutPromise,
      ])) as {
        data: { session: { user: { id: string } } | null } | null;
        error: unknown;
      };
      const sessionData = sessionResult.data;
      const sessionError = sessionResult.error;
      let authenticatedUserId = sessionData?.session?.user?.id ?? null;

      // Fallback: getUser can still succeed even when getSession is flaky in dev/HMR
      if (!authenticatedUserId) {
        const userPromise = supabase.auth.getUser();
        const userTimeoutPromise = new Promise<{
          data: null;
          error: { message: string };
        }>((resolve) => {
          setTimeout(
            () =>
              resolve({
                data: null,
                error: { message: "User check timed out" },
              }),
            10000,
          );
        });

        const userResult = (await Promise.race([
          userPromise,
          userTimeoutPromise,
        ])) as {
          data: { user: { id: string } | null } | null;
          error: unknown;
        };

        authenticatedUserId = userResult.data?.user?.id ?? null;

        if (!authenticatedUserId) {
          console.warn("Ã¢Å¡Â Ã¯Â¸Â Session validation failed before save:", {
            sessionError: serializeAuthError(sessionError),
            userError: serializeAuthError(userResult.error),
            authContextUserId: user?.id || null,
          });
          showToast("Your session has expired. Please log in again.", "error");
          setIsSavingPlan(false);
          return;
        }
      }

      if (sessionError) {
        console.warn(
          "Ã¢Å¡Â Ã¯Â¸Â getSession returned an error, but continuing with a verified user:",
          serializeAuthError(sessionError),
        );
      }
      console.log("Ã¢Å“â€¦ Session verified for user:", authenticatedUserId);

      // Prepare save payload - ALL data from metadata prompt (pmpt_697b9c2d67788195908580fac6389db000faf9c8a4b2d393)
      const savePayload = {
        name: planMetadata.plan_name, // plan_name from metadata prompt
        description: planMetadata.description, // description from metadata prompt
        tags: planMetadata.tags, // tags from metadata prompt
        duration_days: planMetadata.duration_days ?? 28, // duration_days from metadata prompt (default: 28)
        category: planMetadata.category, // category from metadata prompt
        user_id: authenticatedUserId,
        image_path: imagePath,
        image_alt: `${planMetadata.plan_name} workout plan`,
        gender: userGender, // for fallback image generation
        location: userLocation, // for fallback image generation
      };

      // Log save payload (excluding image data)
      console.log(
        "Ã°Å¸â€™Â¾ Saving Workout Plan (from metadata prompt pmpt_697b9c2d67788195908580fac6389db000faf9c8a4b2d393):",
        {
          name: savePayload.name,
          description: savePayload.description,
          tags: savePayload.tags,
          duration_days: savePayload.duration_days,
          category: savePayload.category,
          user_id: savePayload.user_id,
          image_path: savePayload.image_path
            ? "Ã¢Å“â€¦ Image path set"
            : "Ã¢ÂÅ’ No image path",
          image_alt: savePayload.image_alt,
        },
      );

      // Save the plan with timeout protection
      console.log("Ã¢ÂÂ³ Calling createUserWorkoutPlan...");
      const planPromise = createUserWorkoutPlan(savePayload);
      const planTimeoutPromise = new Promise<{ success: false; error: string }>(
        (resolve) => {
          setTimeout(
            () =>
              resolve({
                success: false,
                error: "Save operation timed out after 30 seconds",
              }),
            30000,
          );
        },
      );
      const result = await Promise.race([planPromise, planTimeoutPromise]);
      console.log(
        "Ã°Å¸â€œÂ¥ createUserWorkoutPlan returned:",
        JSON.stringify(result, null, 2),
      );
      console.log(
        result.success ? "Ã¢Å“â€¦ Success!" : "Ã¢ÂÅ’ Failed:",
        result.error || "(no error message)",
      );

      // Log save result
      if (result.success && result.data?.id) {
        const planId = result.data.id;
        console.log("Ã¢Å“â€¦ Workout Plan Saved Successfully:", {
          plan_id: planId,
          name: result.data?.name,
          created_at: result.data?.created_at,
        });

        // Now save the weekly plan data from workoutPlanJSON (pmpt_696b1cbae2748190b762941e94daf9ca04d42161af28312a)
        if (workoutPlanJSON) {
          const weekNumber = parseInt(workoutPlanJSON.week_number) || 1;
          const restDays = workoutPlanJSON.rest_days || [];
          const durationDays = planMetadata.duration_days ?? 28;

          // Calculate remaining days: duration_days - (7 days in a week)
          const remainingDays = durationDays - 7;

          // Step 1: Create the parent week plan (user_workout_weekly_plan)
          console.log("Ã°Å¸â€œâ€¦ Creating Week Plan (user_workout_weekly_plan):", {
            plan_id: planId,
            week_number: weekNumber,
            rest_days: restDays,
            remaining_days: remainingDays,
          });

          const weekPlanPromise = createUserWorkoutWeekPlan({
            week_number: weekNumber,
            plan_id: planId,
            rest_days: restDays,
            remaining_days: remainingDays,
          });
          const weekPlanTimeoutPromise = new Promise<{
            success: false;
            error: string;
          }>((resolve) => {
            setTimeout(
              () =>
                resolve({
                  success: false,
                  error: "Week plan save timed out after 30 seconds",
                }),
              30000,
            );
          });
          const weekPlanResult = await Promise.race([
            weekPlanPromise,
            weekPlanTimeoutPromise,
          ]);

          if (!weekPlanResult.success || !weekPlanResult.data?.id) {
            console.error("Ã¢ÂÅ’ Failed to save Week Plan:", weekPlanResult.error);
            showToast(
              `Plan saved but week plan failed: ${weekPlanResult.error || "Unknown error"}`,
              "error",
            );
            planJustSavedRef.current = true;
            setShowWorkoutPlanDialog(false);
            return;
          }

          const weekPlanId = weekPlanResult.data.id;
          console.log("Ã¢Å“â€¦ Week Plan Saved Successfully:", {
            week_plan_id: weekPlanId,
            week_number: weekNumber,
          });

          // Step 2: Create weekly daily plan records for each day (user_workout_weekly_daily_plan)
          const weeklyPlanPayloads = Object.entries(workoutPlanJSON.days).map(
            ([dayName, dayData]) => {
              const dayResult = dayWorkoutResults[dayName];
              const estimatedCalories = formatEstimatedCalories(
                dayResult?.["estimated total calories"] ||
                  dayResult?.estimated_total_calories,
              );
              const totalMinutes =
                calculateTotalMinutes(dayResult?.warm_up) +
                calculateTotalMinutes(dayResult?.main_workout) +
                calculateTotalMinutes(dayResult?.cooldown);

              return {
                day: dayName,
                title: dayData.title || null,
                // Convert focus string to array (split by comma if it's a string)
                focus: dayData.focus
                  ? Array.isArray(dayData.focus)
                    ? dayData.focus
                    : [dayData.focus]
                  : null,
                motivation: dayData.motivation || null,
                week_plan_id: weekPlanId, // Reference to the parent week plan
                total_calories: estimatedCalories,
                total_minutes: totalMinutes > 0 ? totalMinutes : null,
              };
            },
          );

          console.log(
            "Ã°Å¸â€œâ€¦ Saving Weekly Daily Plans (user_workout_weekly_daily_plan):",
            {
              week_plan_id: weekPlanId,
              days_count: weeklyPlanPayloads.length,
            },
          );

          // Save all weekly daily plans in batch with timeout
          console.log("Ã¢ÂÂ³ Saving weekly daily plans...");
          const weeklyPromise =
            createUserWorkoutWeeklyPlans(weeklyPlanPayloads);
          const weeklyTimeoutPromise = new Promise<{
            success: false;
            error: string;
          }>((resolve) => {
            setTimeout(
              () =>
                resolve({
                  success: false,
                  error: "Weekly daily plans save timed out after 30 seconds",
                }),
              30000,
            );
          });
          const weeklyResult = await Promise.race([
            weeklyPromise,
            weeklyTimeoutPromise,
          ]);

          if (weeklyResult.success && weeklyResult.data) {
            console.log("Ã¢Å“â€¦ Weekly Daily Plans Saved Successfully:", {
              records_saved: weeklyResult.data?.length,
            });

            // Now save exercise details for each day
            // Map day names to their weekly plan IDs
            const weeklyPlanMap = new Map<string, string>();
            weeklyResult.data.forEach((weeklyPlan) => {
              if (weeklyPlan.day && weeklyPlan.id) {
                weeklyPlanMap.set(weeklyPlan.day.toLowerCase(), weeklyPlan.id);
              }
            });

            console.log("Ã°Å¸â€œâ€¦ Weekly Plan Map created:", {
              entries: Array.from(weeklyPlanMap.entries()),
            });

            // Collect all exercise details from dayWorkoutResults
            const exerciseDetailsPayloads: CreateUserExerciseDetailsPayload[] =
              [];

            // Helper function to map section names to ExerciseSection type
            const mapSectionName = (
              sectionKey: string,
            ): ExerciseSection | null => {
              const sectionMap: Record<string, ExerciseSection> = {
                warm_up: "warmup",
                main_workout: "main",
                cooldown: "cooldown",
              };
              return sectionMap[sectionKey] || null;
            };

            // Iterate through all day workout results
            Object.entries(dayWorkoutResults).forEach(
              ([dayName, dayResult]) => {
                const weeklyPlanId = weeklyPlanMap.get(dayName.toLowerCase());
                if (!weeklyPlanId) {
                  console.warn(
                    `Ã¢Å¡Â Ã¯Â¸Â No weekly plan ID found for day: ${dayName}`,
                  );
                  return;
                }

                // Process each section: warm_up, main_workout, cooldown
                const sections = [
                  { key: "warm_up", exercises: dayResult.warm_up || [] },
                  {
                    key: "main_workout",
                    exercises: dayResult.main_workout || [],
                  },
                  { key: "cooldown", exercises: dayResult.cooldown || [] },
                ];

                sections.forEach(({ key, exercises }) => {
                  const section = mapSectionName(key);
                  if (!section) return;

                  exercises.forEach((exercise) => {
                    if (!exercise.name) return;

                    // Parse equipment - handle string format from prompt
                    let equipmentArray: string[] | null = null;
                    if (exercise.equipment) {
                      if (typeof exercise.equipment === "string") {
                        // Split by comma and clean up
                        equipmentArray = exercise.equipment
                          .split(",")
                          .map((e) => e.trim())
                          .filter((e) => e.length > 0);
                      } else if (Array.isArray(exercise.equipment)) {
                        equipmentArray = exercise.equipment;
                      }
                    }

                    exerciseDetailsPayloads.push({
                      name: exercise.name,
                      safety_cue: exercise.safety_cue || null,
                      section: section,
                      equipment: equipmentArray,
                    });
                  });
                });
              },
            );

            // Save all exercise details in batch if there are any
            // Uses createOrReuseExerciseDetailsBatch to check for existing exercises
            // and only create new ones (avoids duplicates by name + equipment)
            if (exerciseDetailsPayloads.length > 0) {
              console.log(
                "Ã°Å¸Ââ€¹Ã¯Â¸Â Processing Exercise Details (checking for existing, from prompt pmpt_696b4c297ebc8193ab67088cd5e034c10a70cda92773d275):",
                {
                  total_exercises: exerciseDetailsPayloads.length,
                  sections: {
                    warmup: exerciseDetailsPayloads.filter(
                      (e) => e.section === "warmup",
                    ).length,
                    main: exerciseDetailsPayloads.filter(
                      (e) => e.section === "main",
                    ).length,
                    cooldown: exerciseDetailsPayloads.filter(
                      (e) => e.section === "cooldown",
                    ).length,
                  },
                },
              );

              // This will check for existing exercises by name + equipment
              // and only create new ones, returning combined list
              console.log("Ã¢ÂÂ³ Calling createOrReuseExerciseDetailsBatch...");
              const exercisePromise = createOrReuseExerciseDetailsBatch(
                exerciseDetailsPayloads,
              );
              const exerciseTimeoutPromise = new Promise<{
                success: false;
                error: string;
              }>((resolve) => {
                setTimeout(
                  () =>
                    resolve({
                      success: false,
                      error: "Exercise details save timed out after 45 seconds",
                    }),
                  45000,
                );
              });
              const exerciseResult = await Promise.race([
                exercisePromise,
                exerciseTimeoutPromise,
              ]);
              console.log(
                "Ã¢Å“â€¦ createOrReuseExerciseDetailsBatch returned:",
                exerciseResult.success,
              );

              if (exerciseResult.success && exerciseResult.data) {
                console.log("Ã¢Å“â€¦ Exercise Details Saved/Reused Successfully:", {
                  records_count: exerciseResult.data?.length,
                });

                const exerciseById = new Map(
                  exerciseResult.data.map((exercise) => [
                    exercise.id,
                    exercise,
                  ]),
                );

                // Now save plan exercises linking plan to exercise details
                // Helper to normalize equipment for comparison
                const normalizeEquipment = (
                  equipment: string[] | string | null | undefined,
                ): string => {
                  if (!equipment) return "";
                  let arr: string[];
                  if (Array.isArray(equipment)) {
                    arr = equipment;
                  } else if (typeof equipment === "string") {
                    arr = equipment
                      .split(",")
                      .map((e) => e.trim())
                      .filter((e) => e.length > 0);
                  } else {
                    return "";
                  }
                  return arr
                    .map((e) => e.toLowerCase().trim())
                    .sort()
                    .join(",");
                };

                // Helper to create exercise key from name + equipment
                const createExerciseKey = (
                  name: string,
                  equipment: string[] | string | null | undefined,
                ): string => {
                  const normalizedName = name.toLowerCase().trim();
                  const normalizedEquip = normalizeEquipment(equipment);
                  return `${normalizedName}|${normalizedEquip}`;
                };

                // Create a map of exercise (name + equipment) to exercise ID
                // DB has unique constraint on name + equipment
                const exerciseIdMap = new Map<string, string>();
                exerciseResult.data.forEach((exercise) => {
                  const key = createExerciseKey(
                    exercise.name,
                    exercise.equipment,
                  );
                  exerciseIdMap.set(key, exercise.id);
                });

                console.log("Ã°Å¸â€”â€šÃ¯Â¸Â Exercise ID Map created (name+equipment):", {
                  total_entries: exerciseIdMap.size,
                  sample_entries: Array.from(exerciseIdMap.entries()).slice(
                    0,
                    5,
                  ),
                });

                // userGender is already defined at the top of handleSavePlan

                // Collect plan exercises payloads
                const planExercisesPayloads: CreateUserWorkoutPlanExercisePayload[] =
                  [];

                // Iterate through day workout results to build plan exercises
                Object.entries(dayWorkoutResults).forEach(
                  ([dayName, dayResult]) => {
                    // Get the weekly_plan_id for this day
                    const weeklyPlanId = weeklyPlanMap.get(
                      dayName.toLowerCase(),
                    );
                    if (!weeklyPlanId) {
                      console.warn(
                        `Ã¢Å¡Â Ã¯Â¸Â No weekly plan ID found for day: ${dayName} (skipping plan exercises)`,
                      );
                      return;
                    }

                    // Track position counters for each section - reset per day
                    const positionCounters = {
                      warmup: 0,
                      main: 0,
                      cooldown: 0,
                    };

                    const sections = [
                      { key: "warm_up", exercises: dayResult.warm_up || [] },
                      {
                        key: "main_workout",
                        exercises: dayResult.main_workout || [],
                      },
                      { key: "cooldown", exercises: dayResult.cooldown || [] },
                    ];

                    sections.forEach(({ key, exercises }) => {
                      const section = mapSectionName(key);
                      if (!section) return;

                      exercises.forEach((exercise, index) => {
                        if (!exercise.name) return;

                        // Find the exercise ID from saved details (by name + equipment)
                        const exerciseKey = createExerciseKey(
                          exercise.name,
                          exercise.equipment,
                        );
                        const exerciseId = exerciseIdMap.get(exerciseKey);

                        if (!exerciseId) {
                          console.warn(
                            `Ã¢Å¡Â Ã¯Â¸Â No exercise ID found for: ${exercise.name} (equipment: ${exercise.equipment || "none"})`,
                          );
                          return;
                        }

                        // Parse the metrics from sets_reps_duration_seconds_rest
                        const metrics = parsePlanExerciseMetricsForSave(
                          exercise.sets_reps_duration_seconds_rest,
                        );

                        // Get position based on section (resets per day)
                        const position = getExercisePosition(
                          section,
                          positionCounters[section],
                        );
                        positionCounters[section]++;

                        // Generate image path using saved exercise's image_slug
                        const savedExercise = exerciseById.get(exerciseId);
                        const imageSlug =
                          savedExercise?.image_slug ||
                          generateImageSlug(section, exercise.name);
                        const imagePath = getExerciseImagePath(
                          userGender,
                          imageSlug,
                        );

                        planExercisesPayloads.push({
                          weekly_plan_id: weeklyPlanId, // FK to user_workout_weekly_plan
                          exercise_id: exerciseId,
                          position: position,
                          section: section,
                          sets: metrics.sets,
                          reps: metrics.reps,
                          duration_seconds: metrics.duration_seconds,
                          rest_seconds: metrics.rest_seconds,
                          per_side: exercise.per_side?.toLowerCase() === "yes",
                          image_path: imagePath,
                          image_alt: `${exercise.name} exercise demonstration`,
                          description: exercise.description || null,
                          is_image_generated: null,
                        });
                      });
                    });
                  },
                );

                // Save plan exercises if there are any
                if (planExercisesPayloads.length > 0) {
                  console.log("Ã°Å¸â€â€” Saving Plan Exercises:", {
                    total: planExercisesPayloads.length,
                    sections: {
                      warmup: planExercisesPayloads.filter(
                        (e) => e.section === "warmup",
                      ).length,
                      main: planExercisesPayloads.filter(
                        (e) => e.section === "main",
                      ).length,
                      cooldown: planExercisesPayloads.filter(
                        (e) => e.section === "cooldown",
                      ).length,
                    },
                  });

                  console.log(
                    "Ã¢ÂÂ³ Calling createUserWorkoutPlanExercisesBatch...",
                  );
                  const planExercisesPromise =
                    createUserWorkoutPlanExercisesBatch(planExercisesPayloads);
                  const planExercisesTimeoutPromise = new Promise<{
                    success: false;
                    error: string;
                  }>((resolve) => {
                    setTimeout(
                      () =>
                        resolve({
                          success: false,
                          error:
                            "Plan exercises save timed out after 45 seconds",
                        }),
                      45000,
                    );
                  });
                  const planExercisesResult = await Promise.race([
                    planExercisesPromise,
                    planExercisesTimeoutPromise,
                  ]);
                  console.log(
                    "Ã¢Å“â€¦ createUserWorkoutPlanExercisesBatch returned:",
                    planExercisesResult.success,
                  );

                  if (planExercisesResult.success) {
                    console.log("Ã¢Å“â€¦ Plan Exercises Saved Successfully:", {
                      records_saved: planExercisesResult.data?.length,
                    });

                    // Capture data for background processing - these are copied
                    // so the background task can continue even if dialog is closed
                    const exercisesToProcess = [...(exerciseResult.data || [])];
                    const genderForImages = userGender as "male" | "female";
                    const generateImageFn = generateAndUploadExerciseImage;

                    // Start background image generation (non-blocking)
                    // This runs independently of dialog state - data is captured above
                    console.log(
                      "Ã°Å¸â€â€ž Scheduling background image processing (will continue even if dialog closes)...",
                    );
                    setTimeout(() => {
                      (async () => {
                        console.log(
                          "Ã¢Å¡Â¡ Background task started - dialog state independent",
                        );
                        const totalExercises = exercisesToProcess.length;
                        console.log(
                          "Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â",
                        );
                        console.log(`Ã°Å¸Å½Â¨ BACKGROUND IMAGE PROCESSING STARTED`);
                        console.log(
                          `Ã°Å¸â€œÅ  Total exercises to check: ${totalExercises}`,
                        );
                        console.log(`Ã°Å¸â€˜Â¤ Gender for images: ${genderForImages}`);
                        console.log(
                          "Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â",
                        );

                        // Group exercises by section for reporting
                        const bySection = {
                          warmup: exercisesToProcess.filter(
                            (e) => e.section === "warmup",
                          ),
                          main: exercisesToProcess.filter(
                            (e) => e.section === "main",
                          ),
                          cooldown: exercisesToProcess.filter(
                            (e) => e.section === "cooldown",
                          ),
                        };
                        console.log(`Ã°Å¸â€œâ€¹ Exercises by section:`, {
                          warmup: bySection.warmup.length,
                          main: bySection.main.length,
                          cooldown: bySection.cooldown.length,
                        });

                        let generatedCount = 0;
                        let skippedCount = 0;
                        let failedCount = 0;
                        let noSlugCount = 0;
                        let currentIndex = 0;

                        for (const exercise of exercisesToProcess) {
                          currentIndex++;
                          const progress = `[${currentIndex}/${totalExercises}]`;

                          if (!exercise.image_slug) {
                            console.log(
                              `${progress} Ã¢ÂÂ­Ã¯Â¸Â SKIP (no slug): ${exercise.name}`,
                            );
                            noSlugCount++;
                            continue;
                          }

                          // Build full image URL
                          const publicUrl = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/exercises/${genderForImages}/${exercise.image_slug}.png`;

                          console.log(
                            `${progress} Ã°Å¸â€Â Checking: ${exercise.name}`,
                          );
                          console.log(`    Ã°Å¸â€œâ€š Section: ${exercise.section}`);
                          console.log(`    Ã°Å¸â€â€” URL: ${publicUrl}`);

                          try {
                            // Prioritize DB flag check before storage lookup
                            try {
                              const { data: pendingRows, error: pendingError } =
                                await supabase
                                  .from("user_workout_plan_exercises")
                                  .select("id")
                                  .eq("image_path", publicUrl)
                                  .or(
                                    "is_image_generated.is.null,is_image_generated.eq.false",
                                  );

                              if (
                                !pendingError &&
                                (!pendingRows || pendingRows.length === 0)
                              ) {
                                skippedCount++;
                                continue;
                              }
                            } catch (dbErr) {
                              console.log(
                                "    WARN: DB check failed (continuing with storage check):",
                                dbErr,
                              );
                            }

                            // Quick check if image exists via GET request with range header
                            let imageExists = false;
                            try {
                              const controller = new AbortController();
                              const timeoutId = setTimeout(
                                () => controller.abort(),
                                5000,
                              );
                              const response = await fetch(publicUrl, {
                                method: "GET",
                                headers: {
                                  Range: "bytes=0-0",
                                },
                                signal: controller.signal,
                              });
                              clearTimeout(timeoutId);
                              // 200 = full content, 206 = partial content (range request worked)
                              imageExists =
                                response.ok || response.status === 206;
                              console.log(
                                `    Ã°Å¸â€œÂ¡ Response: ${response.status} (exists: ${imageExists})`,
                              );
                            } catch (fetchErr) {
                              console.log(
                                `    Ã¢Å¡Â Ã¯Â¸Â Fetch error (assuming not exists):`,
                                fetchErr,
                              );
                              imageExists = false;
                            }

                            if (imageExists) {
                              await supabase
                                .from("user_workout_plan_exercises")
                                .update({ is_image_generated: true })
                                .eq("image_path", publicUrl)
                                .or(
                                  "is_image_generated.is.null,is_image_generated.eq.false",
                                );
                              console.log(
                                `${progress} Ã¢Å“â€¦ EXISTS: ${exercise.name}`,
                              );
                              skippedCount++;
                              continue;
                            }

                            // Generate and upload (using captured function reference)
                            console.log(
                              `${progress} Ã°Å¸Å½Â¨ GENERATING: ${exercise.name}...`,
                            );
                            const imageResult = await generateImageFn(
                              exercise.name,
                              exercise.safety_cue ||
                                `Performing ${exercise.name} with proper form`,
                              genderForImages,
                              exercise.image_slug,
                            );

                            if (imageResult.success) {
                              await supabase
                                .from("user_workout_plan_exercises")
                                .update({ is_image_generated: true })
                                .eq("image_path", publicUrl)
                                .or(
                                  "is_image_generated.is.null,is_image_generated.eq.false",
                                );
                              console.log(
                                `${progress} Ã¢Å“â€¦ UPLOADED: ${exercise.name}`,
                              );
                              console.log(
                                `    Ã°Å¸â€œÂ¤ URL: ${imageResult.data || "N/A"}`,
                              );
                              generatedCount++;
                            } else {
                              console.warn(
                                `${progress} Ã¢ÂÅ’ FAILED: ${exercise.name}`,
                              );
                              console.warn(`    Error: ${imageResult.error}`);
                              failedCount++;
                            }
                          } catch (err) {
                            console.error(
                              `${progress} Ã¢ÂÅ’ ERROR: ${exercise.name}`,
                              err,
                            );
                            failedCount++;
                          }
                        }

                        console.log(
                          "Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â",
                        );
                        console.log(
                          `Ã°Å¸Å½Â¨ BACKGROUND IMAGE PROCESSING COMPLETE (ran independently of dialog)`,
                        );
                        console.log(
                          "Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬",
                        );
                        console.log(`Ã°Å¸â€œÅ  SUMMARY:`);
                        console.log(`    Total exercises: ${totalExercises}`);
                        console.log(
                          `    Ã¢Å“â€¦ Already existed (skipped): ${skippedCount}`,
                        );
                        console.log(
                          `    Ã°Å¸Å½Â¨ Generated & uploaded: ${generatedCount}`,
                        );
                        console.log(`    Ã¢ÂÅ’ Failed: ${failedCount}`);
                        console.log(`    Ã¢ÂÂ­Ã¯Â¸Â No image slug: ${noSlugCount}`);
                        console.log(
                          "Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â",
                        );

                        // Log completion notification that user can see in console
                        if (generatedCount > 0) {
                          console.log(
                            `%cÃ¢Å“Â¨ ${generatedCount} exercise images generated successfully!`,
                            "color: green; font-weight: bold; font-size: 14px;",
                          );
                        }
                      })();
                    }, 100);

                    // Show success toast and close dialog
                    planJustSavedRef.current = true; // Mark that plan was saved for background processing
                    showToast(
                      "Workout plan saved successfully! Images are being processed in the background.",
                      "success",
                    );
                    setShowWorkoutPlanDialog(false);
                    setShowImageProcessingDialog(true);
                  } else {
                    console.error("Ã¢ÂÅ’ Failed to Save Plan Exercises:", {
                      error: planExercisesResult.error,
                    });
                    showToast(
                      `Plan saved, but plan exercises failed: ${planExercisesResult.error || "Unknown error"}`,
                      "error",
                    );
                    planJustSavedRef.current = true;
                    setShowWorkoutPlanDialog(false);
                  }
                } else {
                  planJustSavedRef.current = true;
                  showToast("Workout plan saved successfully!", "success");
                  setShowWorkoutPlanDialog(false);
                  setShowImageProcessingDialog(true);
                }
              } else {
                console.error("Ã¢ÂÅ’ Failed to Save Exercise Details:", {
                  error: exerciseResult.error,
                });
                showToast(
                  `Plan saved, but exercise details failed: ${exerciseResult.error || "Unknown error"}`,
                  "error",
                );
                planJustSavedRef.current = true;
                setShowWorkoutPlanDialog(false);
              }
            } else {
              console.log(
                "Ã¢â€žÂ¹Ã¯Â¸Â No exercise details to save (no day workouts generated)",
              );
              planJustSavedRef.current = true;
              showToast("Workout plan saved successfully!", "success");
              setShowWorkoutPlanDialog(false);
              setShowImageProcessingDialog(true);
            }
          } else {
            console.error("Ã¢ÂÅ’ Failed to Save Weekly Plan Data:", {
              error: weeklyResult.error,
            });
            showToast(
              `Plan saved but weekly data failed: ${weeklyResult.error || "Unknown error"}`,
              "error",
            );
            planJustSavedRef.current = true;
            setShowWorkoutPlanDialog(false);
          }
        } else {
          planJustSavedRef.current = true;
          showToast("Workout plan saved successfully!", "success");
          setShowWorkoutPlanDialog(false);
          setShowImageProcessingDialog(true);
        }
      } else {
        console.error("Ã¢ÂÅ’ Failed to Save Workout Plan:", {
          error: result.error,
          fullResult: result,
        });
        showToast(
          `Failed to save plan: ${result.error || "Database operation failed. Please try again."}`,
          "error",
        );
      }
    } catch (error: any) {
      console.error("Ã¢ÂÅ’ Error saving workout plan:", error);
      showToast(
        `An error occurred while saving: ${error?.message || "Unknown error"}`,
        "error",
      );
    } finally {
      console.log("Ã°Å¸ÂÂ Save complete - setting isSavingPlan = false");
      setIsSavingPlan(false);
    }
  };

  // Use real profile data only (no fallback)
  const profile = userProfile;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-3xl mx-auto px-4 sm:px-5 py-5">
        {/* App Header */}
        <div className="mb-4 -ml-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Image
                src="/images/Logo_VitalSpark.png"
                alt="VitalSpark"
                width={28}
                height={28}
                className="object-contain"
              />
              <span className="text-xs sm:text-sm font-semibold text-gray-700">
                VitalSpark by Ferdie
              </span>
            </div>
            <div className="flex items-center gap-2 -pr-8">
              <button
                type="button"
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
              >
                <HiMoon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => router.replace("/auth/logout")}

                className="inline-flex items-center justify-center px-3 h-8 rounded-full bg-white text-slate-600 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors"
              >
                <HiArrowRightOnRectangle className="w-4 h-4 mr-1" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Clean Header */}
        <div className="mb-5 mt-3">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                <h1 className="text-2xl sm:text-3xl text-teal-700 font-extrabold">
                  Spark AI
                </h1>
                <button
                  type="button"
                  onClick={handleRefreshPage}
                  disabled={isRefreshingPage}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-teal-200 bg-white text-xs font-semibold text-teal-700 hover:bg-teal-50 transition-colors disabled:opacity-60"
                >
                  <HiArrowPath
                    className={`w-3.5 h-3.5 ${isRefreshingPage ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>
              <p className="text-sm text-neutral-500">
                Your personalized AI workout companion
              </p>
            </div>
          </div>

          {/* Decorative Line */}
          <div className="h-1 bg-amber-500 rounded w-16 mt-1" />
        </div>

        {/* Simplified Fitness Profile Card */}
        {profile && (
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm mb-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-3.5">
              <div className="flex-1">
                <h2 className="text-base sm:text-lg font-extrabold text-teal-800 mb-1">
                  Fitness Profile
                </h2>
                <p className="text-xs text-gray-600 font-medium">
                  Your current fitness details and preferences
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/manage-profile")}
                className="bg-teal-600 px-2 py-0.5 rounded-lg transition hover:bg-teal-700"
              >
                <span className="text-white text-[9px] tracking-wide">
                  Edit Profile
                </span>
              </button>
            </div>

            {/* Main Stats Row */}
            <div className="flex gap-3 mb-3.5 pb-3.5 border-b border-gray-100">
              {/* Physical Stats */}
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                  Physical
                </p>
                <div className="space-y-2">
                  {profile.height && (
                    <div className="flex items-center gap-2">
                      <span className="text-teal-600">{"\uD83D\uDCCF"}</span>
                      <span className="text-xs font-semibold text-gray-700">
                        {profile.height}{" "}
                        {formatTitleCase(profile.height_unit || "cm")}
                      </span>
                    </div>
                  )}
                  {profile.weight && (
                    <div className="flex items-center gap-2">
                      <span className="text-teal-600">{"\u2696\uFE0F"}</span>
                      <span className="text-xs font-semibold text-gray-700">
                        {profile.weight}{" "}
                        {formatTitleCase(profile.weight_unit || "kg")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Fitness Stats */}
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                  Goals
                </p>
                <div className="space-y-2">
                  {profile.fitness_goal && (
                    <div className="flex items-center gap-2">
                      <span className="text-teal-600">{"\uD83C\uDFAF"}</span>
                      <span className="text-xs font-semibold text-gray-700">
                        {formatTitleCase(profile.fitness_goal)}
                      </span>
                    </div>
                  )}
                  {profile.fitness_level && (
                    <div className="flex items-center gap-2">
                      <span className="text-teal-600">{"\uD83D\uDCC8"}</span>
                      <span className="text-xs font-semibold text-gray-700">
                        {formatTitleCase(profile.fitness_level)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Workout Preferences */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                Workout Preferences
              </p>

              <div className="flex gap-3 flex-wrap">
                {profile.workout_duration_minutes && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{"\u23F1\uFE0F"}</span>
                    <span className="text-xs text-gray-700 font-medium">
                      {profile.workout_duration_minutes} Min Sessions
                    </span>
                  </div>
                )}

                {profile.workout_location && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{"\uD83D\uDCCD"}</span>
                    <span className="text-xs text-gray-700 font-medium">
                      {formatTitleCase(profile.workout_location)}
                    </span>
                  </div>
                )}
              </div>

              {profile.weekly_frequency &&
                profile.weekly_frequency.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{"\uD83D\uDCC5"}</span>
                    <span className="text-xs text-gray-700 font-medium">
                      {profile.weekly_frequency
                        .map((day) => formatTitleCase(day))
                        .join(", ")}
                    </span>
                  </div>
                )}

              {profile.equipment_list && profile.equipment_list.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-500">{"\uD83C\uDFCB\uFE0F"}</span>
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {profile.equipment_list
                      .slice(0, 4)
                      .map((equipment, index) => (
                        <span
                          key={index}
                          className="bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200 text-[11px] font-semibold text-teal-700"
                        >
                          {formatTitleCase(equipment)}
                        </span>
                      ))}
                    {profile.equipment_list.length > 4 && (
                      <span className="bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200 text-[11px] font-semibold text-teal-700">
                        +{profile.equipment_list.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Generator Card */}
        {profile && (
          <div className="mb-5">
            <div className="relative rounded-xl overflow-hidden shadow-lg bg-gradient-to-br from-amber-500 via-amber-400 to-amber-300">
              {/* Decorative Elements */}
              <div className="absolute -top-7 -right-7 w-16 h-16 rounded-full bg-white/15" />
              <div className="absolute -bottom-4 -left-4 w-14 h-14 rounded-full bg-white/10" />
              <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/8" />

              <div className="relative p-4 z-10">
                {/* Badge */}
                <div className="inline-flex items-center gap-1.5 bg-white/95 px-2.5 py-1 rounded-full mb-2.5 shadow-sm">
                  <HiSparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">
                    AI Powered
                  </span>
                </div>

                {/* Title */}
                <h2 className="text-base sm:text-lg font-extrabold text-white mb-1.5 tracking-tight">
                  Generate Your Perfect Workout
                </h2>

                {/* Subtitle */}
                <p className="text-[11px] leading-relaxed text-white/90 font-medium mb-3">
                  Our AI analyzes your profile, fitness goals, and preferences
                  to create a customized workout plan tailored just for you. Get
                  started with a plan that adapts to your schedule and
                  equipment.
                </p>

                {/* Generated Workout Display - Show raw text if parsing failed */}
                {generatedWorkout && parsedWorkouts.length === 0 && (
                  <div className="bg-white/15 rounded-lg p-3 mb-3 border border-white/20 max-h-56 overflow-y-auto">
                    <p className="text-xs sm:text-sm leading-relaxed text-white font-medium whitespace-pre-wrap">
                      {typeof generatedWorkout === "string"
                        ? generatedWorkout
                        : JSON.stringify(generatedWorkout, null, 2)}
                    </p>
                  </div>
                )}

                {/* Generate Button */}
                <button
                  onClick={handleAICardClick}
                  disabled={isGeneratingWorkout}
                  aria-busy={isGeneratingWorkout}
                  className={`w-full rounded-xl py-2.5 px-4 flex items-center justify-center gap-2 bg-white/95 shadow-xs transition-opacity ${
                    isGeneratingWorkout
                      ? "opacity-70 cursor-not-allowed"
                      : "hover:opacity-90"
                  }`}
                >
                  <HiSparkles className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-amber-500">
                    Generate Workout Plan
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* My Workout Plans Section */}
        <div className="mb-6">
          <h3 className="text-xl font-extrabold text-teal-800 mb-4">
            My Workout Plans
          </h3>
          {isLoadingMyPlans ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mb-3" />
              <p className="text-sm font-bold text-teal-700">
                Loading your workout plans...
              </p>
            </div>
          ) : myWorkoutPlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <div className="text-4xl mb-3">Ã°Å¸Ââ€¹Ã¯Â¸Â</div>
              <p className="text-base font-medium text-slate-500 text-center mb-1">
                No saved workout plans yet
              </p>
              <p className="text-sm text-slate-400 text-center">
                Generate a workout above to get started!
              </p>
            </div>
          ) : (
            <div className="px-1.5 pt-1.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {myWorkoutPlans.map((plan) => {
                  // Clean plan name (remove timestamp)
                  const cleanName = plan.name.replace(
                    / - \d{4}-\d{2}-\d{2}.*$/,
                    "",
                  );
                  const totalWeeks = plan.duration_days
                    ? Math.ceil(plan.duration_days / 7)
                    : null;
                  return (
                    <div
                      key={plan.id}
                      onClick={() =>
                        router.push(`/personal/workout/details?id=${plan.id}`)
                      }
                      className="w-full bg-white rounded-xl shadow-xs border border-slate-100 overflow-hidden cursor-pointer hover:border-teal-300 hover:scale-[1.015] transition-all duration-200 group"
                    >
                      {/* Image */}
                      <div className="relative h-28 bg-slate-100">
                        {plan.image_path ? (
                          <Image
                            src={plan.image_path}
                            alt={plan.image_alt || cleanName || "Workout plan"}
                            fill
                            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                            className="object-cover"
                          />
                        ) : (
                          <Image
                            src="/images/onboarding_1.png"
                            alt={cleanName || "Workout plan"}
                            fill
                            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                            className="object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/10 to-transparent" />
                        {plan.category && (
                          <div className="absolute top-3 right-3">
                            <span className="bg-teal-100 text-teal-700 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm">
                              {plan.category}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Header */}
                      <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50">
                        <h4 className="font-semibold text-slate-800 text-xs leading-snug line-clamp-2">
                          {cleanName}
                        </h4>
                      </div>

                      {/* Content */}
                      <div className="p-3">
                        {/* Stats Row */}
                        <div className="flex items-center gap-3 mb-2.5">
                          {plan.duration_days && (
                            <div className="flex items-center gap-1.5">
                              <svg
                                className="w-4 h-4 text-teal-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              <span className="text-xs font-semibold text-slate-700">
                                {plan.duration_days} Days
                              </span>
                            </div>
                          )}
                          {totalWeeks && (
                            <div className="flex items-center gap-1.5">
                              <svg
                                className="w-4 h-4 text-amber-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span className="text-xs font-semibold text-slate-700">
                                {totalWeeks} Week{totalWeeks > 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Tags - Limited to 3, Title Case format */}
                        {plan.tags && plan.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {plan.tags.slice(0, 3).map((tag, index) => {
                              // Format tag as Title Case (Abb Abc)
                              const formattedTag = tag
                                .toLowerCase()
                                .split(" ")
                                .map(
                                  (word) =>
                                    word.charAt(0).toUpperCase() +
                                    word.slice(1),
                                )
                                .join(" ");
                              return (
                                <span
                                  key={index}
                                  className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-medium"
                                >
                                  {formattedTag}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <span className="text-xs text-slate-400">
                            {new Date(plan.created_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </span>
                          <div className="flex items-center gap-1 text-teal-600 group-hover:text-teal-700 transition-colors">
                            <span className="text-xs font-semibold">View</span>
                            <HiArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Workout Plans by Fitness Coaches Section */}
        <div className="mb-8">
          <h3 className="text-2xl font-extrabold text-teal-800 mb-6">
            Workout Plans by Fitness Coaches
          </h3>
          {isLoadingCoachPlans ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4" />
              <p className="text-base font-bold text-teal-700">
                Loading workout plans...
              </p>
            </div>
          ) : coachWorkoutPlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="text-5xl mb-4">Ã°Å¸â€™Âª</div>
              <p className="text-base font-medium text-slate-500 text-center">
                No workout plans available from coaches yet
              </p>
            </div>
          ) : (
            <>
              <div className="pb-2">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {coachWorkoutPlans.map((plan, index) => {
                    const isLocked = !isPlanUnlocked(index);
                    return (
                      <CoachWorkoutPlanCard
                        key={plan.id}
                        plan={plan}
                        isLocked={isLocked}
                        onClick={() => handlePlanClick(plan, index)}
                      />
                    );
                  })}
                </div>
              </div>
              {coachWorkoutPlans.length > 6 && (
                <div className="mt-6 flex justify-center">
                  {getUserPlanTier() === "premium" ? (
                    <button
                      onClick={() => router.push("/personal/coach/workout")}
                      className="w-full max-w-md bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-2xl p-4 font-bold text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3"
                    >
                      <span>View all plans</span>
                      <HiArrowRight className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const userTier = getUserPlanTier();
                        showPlanDialog({
                          showAllPlans: false,
                          highlightTier:
                            userTier === "free" ? "pro" : "premium",
                          onPlanSelect: (planCode: string, tier: PlanTier) => {
                            console.log("Selected plan:", planCode, tier);
                            // TODO: Navigate to payment/subscription page
                          },
                        });
                      }}
                      className="w-full max-w-md bg-gradient-to-r from-amber-500 to-amber-400 text-white rounded-2xl p-4 font-bold text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3"
                    >
                      <HiLockOpen className="w-5 h-5" />
                      <span>Unlock all Workout Plans</span>
                      <HiArrowRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Duration Selection Dialog */}
        <Dialog
          visible={showDurationDialog}
          onDismiss={() => setShowDurationDialog(false)}
          maxWidth="400px"
        >
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">
              Choose Plan Duration
            </h2>
            <p className="text-sm text-gray-500 mb-6 text-center">
              How long would you like your workout plan to be?
            </p>
            <div className="flex flex-col gap-3">
              {[
                {
                  days: 7,
                  label: "7 Days",
                  description: "Quick start program",
                },
                {
                  days: 14,
                  label: "14 Days",
                  description: "Two-week challenge",
                },
                {
                  days: 28,
                  label: "28 Days",
                  description: "Full month transformation",
                },
              ].map((option) => (
                <button
                  key={option.days}
                  onClick={() => handleDurationSelect(option.days)}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-teal-500 hover:bg-teal-50 transition-all flex items-center justify-between group"
                >
                  <div className="text-left">
                    <p className="font-bold text-gray-800 group-hover:text-teal-700">
                      {option.label}
                    </p>
                    <p className="text-xs text-gray-500 group-hover:text-teal-600">
                      {option.description}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-teal-500 flex items-center justify-center transition-all">
                    <span className="text-gray-400 group-hover:text-white text-lg">
                      Ã¢â€ â€™
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowDurationDialog(false)}
              className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </Dialog>

        {/* Generation Progress Dialog */}
        <Dialog
          visible={showGenerationModal}
          onDismiss={() => {
            if (!isGeneratingWorkout) {
              setShowGenerationModal(false);
            }
          }}
          maxWidth="520px"
        >
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="text-xl font-extrabold text-teal-800">
                  Generating Your Workout
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  This might take a while, please wait.
                </p>
              </div>
              <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-amber-100 text-amber-700 text-sm font-bold">
                {generationProgressPercent}%
              </div>
            </div>

            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-amber-400 transition-all duration-700"
                style={{ width: `${generationProgressPercent}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-400 text-right">
              ~{generationDurationSeconds}s
            </div>

            <div className="mt-5 space-y-3">
              {generationSteps.map((step, index) => {
                const isComplete = index < currentGenerationStep;
                const isActive = index === currentGenerationStep;

                return (
                  <div
                    key={step.title}
                    className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition-all ${
                      isActive
                        ? "border-teal-200 bg-teal-50"
                        : isComplete
                          ? "border-amber-200 bg-amber-50"
                          : "border-slate-200 bg-white"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${
                        isComplete
                          ? "bg-amber-500 text-white"
                          : isActive
                            ? "bg-teal-600 text-white"
                            : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {isComplete ? "Ã¢Å“â€œ" : index + 1}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-sm font-bold ${
                          isActive
                            ? "text-teal-800"
                            : isComplete
                              ? "text-amber-700"
                              : "text-slate-700"
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {generationSeconds >= generationDurationSeconds &&
              isGeneratingWorkout && (
                <div className="mt-4 text-[10px] text-amber-600 font-semibold">
                  Still working on the final touches...
                </div>
              )}
          </div>
        </Dialog>

        {/* Workout Plan Dialog */}
        <Dialog
          visible={showWorkoutPlanDialog && !!workoutPlanJSON}
          onDismiss={() => {
            console.log("Ã°Å¸â€â€™ Dialog dismissed - cleaning up states...");
            setShowWorkoutPlanDialog(false);
            // Cleanup will be handled by the useEffect hook
          }}
          maxWidth="95vw"
          maxHeight="90vh"
          height="90vh"
        >
          {workoutPlanJSON && (
            <div className="flex flex-col h-full overflow-y-auto">
              {/* Plan Info Row - 3 Columns */}
              <div className="grid grid-cols-3 gap-6 mb-4 mt-2 pb-2 border-b border-gray-200">
                <div className="text-center">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Plan Name
                  </p>
                  <p className="text-sm font-bold text-teal-700">
                    {planMetadata?.plan_name || "Loading..."}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Week #
                  </p>
                  <p className="text-sm font-bold text-slate-700">
                    {workoutPlanJSON.week_number}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Rest Day(s)
                  </p>
                  <p className="text-sm font-semibold text-slate-600">
                    {workoutPlanJSON.rest_days &&
                    workoutPlanJSON.rest_days.length > 0
                      ? workoutPlanJSON.rest_days
                          .map((day) => formatTitleCase(day))
                          .join(", ")
                      : "None"}
                  </p>
                </div>
              </div>

              {/* Day Cards Grid */}
              <div className="relative flex-1">
                <div
                  ref={dayCardsScrollRef}
                  className="h-full overflow-x-auto overflow-y-hidden pb-2"
                >
                  <div className="flex h-full flex-nowrap items-stretch gap-4">
                    {workoutPlanJSON.days &&
                      Object.entries(workoutPlanJSON.days)
                        .filter(
                          ([_, day]) =>
                            day?.title?.trim() && day?.focus?.trim(),
                        )
                        .map(([dayName, day]) => {
                          const dayResult = dayWorkoutResults[dayName];
                          const isGenerating = !!generatingDays[dayName];
                          const availableSections =
                            getAvailableSections(dayResult);
                          const activeSection =
                            selectedSection[dayName] ??
                            availableSections[0] ??
                            null;
                          const activeIndex =
                            activeSection === null
                              ? -1
                              : availableSections.indexOf(activeSection);
                          const hasPrev = activeIndex > 0;
                          const hasNext =
                            activeIndex >= 0 &&
                            activeIndex < availableSections.length - 1;

                          return (
                            <div
                              key={dayName}
                              className="flex-none w-[85%] min-[1024px]:w-[calc((100%-2*1rem)/3)] min-[1520px]:w-[calc((100%-3*1rem)/4)] h-full bg-white rounded-xl border-2 border-gray-200 shadow-sm flex flex-col"
                            >
                              {/* Card Header */}
                              <div className="p-4 border-b border-gray-100">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h3 className="text-base font-bold text-slate-800">
                                        {formatTitleCase(dayName)}
                                      </h3>
                                      {dayResult &&
                                        (dayResult[
                                          "estimated total calories"
                                        ] ||
                                          dayResult.estimated_total_calories) &&
                                        (() => {
                                          const calories =
                                            (
                                              dayResult[
                                                "estimated total calories"
                                              ] ||
                                              dayResult.estimated_total_calories
                                            )?.toString() || "";
                                          // Remove any existing "cal" or "kcal" to avoid duplicates
                                          const caloriesValue = calories
                                            .replace(/\s*(k?cal|kcal)\s*/gi, "")
                                            .trim();
                                          return (
                                            <span className="text-[10px] text-amber-600 font-medium align-middle">
                                              ({caloriesValue} kCal)
                                            </span>
                                          );
                                        })()}
                                    </div>
                                    <p className="text-sm font-semibold text-teal-600 mb-1">
                                      {day.title}
                                    </p>
                                    <p className="text-[10px] text-slate-600">
                                      <span className="font-medium">
                                        Focus:{" "}
                                      </span>
                                      {day.focus}
                                    </p>
                                  </div>
                                  {/* Action Buttons */}
                                  {dayResult && (
                                    <div className="flex items-center gap-1">
                                      {/* Regenerate Exercises Button */}
                                      <button
                                        onClick={() => {
                                          // Remove the existing result and regenerate
                                          setDayWorkoutResults((prev) => {
                                            const updated = { ...prev };
                                            delete updated[dayName];
                                            return updated;
                                          });
                                          generatedDaysRef.current.delete(
                                            dayName,
                                          );
                                          handleDayWorkoutGenerate(
                                            dayName,
                                            day.title,
                                            day.focus,
                                          );
                                        }}
                                        disabled={isGenerating}
                                        className="shrink-0 p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Regenerate exercises"
                                      >
                                        {isGenerating ? (
                                          <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                          <HiArrowPath className="w-5 h-5 text-teal-600" />
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Card Content - Scrollable */}
                              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                                {!dayResult ? (
                                  /* Generate Button - Centered */
                                  <div className="flex-1 flex items-center justify-center">
                                    <button
                                      onClick={() =>
                                        handleDayWorkoutGenerate(
                                          dayName,
                                          day.title,
                                          day.focus,
                                        )
                                      }
                                      disabled={isGenerating}
                                      className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                                        isGenerating
                                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                          : "bg-gradient-to-r from-amber-500 to-amber-400 text-white hover:from-amber-600 hover:to-amber-500 shadow-md hover:shadow-lg"
                                      }`}
                                    >
                                      {isGenerating ? (
                                        <>
                                          <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                                          <span>Generating...</span>
                                        </>
                                      ) : (
                                        <>
                                          <HiSparkles className="w-4 h-4" />
                                          <span>Generate exercises</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                ) : (
                                  /* Generated Exercises - Scrollable */
                                  <div className="flex-1 flex flex-col overflow-hidden">
                                    {/* Section Buttons - 3 Columns */}
                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                      <button
                                        onClick={() =>
                                          setSelectedSection((prev) => ({
                                            ...prev,
                                            [dayName]:
                                              prev[dayName] === "warm_up"
                                                ? null
                                                : "warm_up",
                                          }))
                                        }
                                        className={`px-3 py-2 rounded-lg text-[10px] font-semibold transition-all ${
                                          selectedSection[dayName] === "warm_up"
                                            ? "bg-teal-600 text-white shadow-md"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                      >
                                        Ã°Å¸â€Â¥ Warm Up
                                      </button>
                                      <button
                                        onClick={() =>
                                          setSelectedSection((prev) => ({
                                            ...prev,
                                            [dayName]:
                                              prev[dayName] === "main_workout"
                                                ? null
                                                : "main_workout",
                                          }))
                                        }
                                        className={`px-3 py-2 rounded-lg text-[10px] font-semibold transition-all ${
                                          selectedSection[dayName] ===
                                          "main_workout"
                                            ? "bg-teal-600 text-white shadow-md"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                      >
                                        Ã°Å¸â€™Âª Main
                                      </button>
                                      <button
                                        onClick={() =>
                                          setSelectedSection((prev) => ({
                                            ...prev,
                                            [dayName]:
                                              prev[dayName] === "cooldown"
                                                ? null
                                                : "cooldown",
                                          }))
                                        }
                                        className={`px-3 py-2 rounded-lg text-[10px] font-semibold transition-all ${
                                          selectedSection[dayName] ===
                                          "cooldown"
                                            ? "bg-teal-600 text-white shadow-md"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                      >
                                        Ã°Å¸Â§Ëœ Cooldown
                                      </button>
                                    </div>

                                    {/* Exercises Display - Based on Selected Section */}
                                    <div className="flex-1 overflow-y-auto">
                                      {selectedSection[dayName] === "warm_up" &&
                                        dayResult.warm_up &&
                                        dayResult.warm_up.length > 0 && (
                                          <div className="space-y-2">
                                            {dayResult.warm_up.map(
                                              (item, index) => (
                                                <div
                                                  key={index}
                                                  className="p-3 bg-teal-50 rounded-lg border border-teal-100"
                                                >
                                                  <div className="flex items-start gap-2 mb-1">
                                                    <span className="shrink-0 w-5 h-5 bg-teal-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                                                      {index + 1}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                      {item.name && (
                                                        <p className="text-[10px] font-semibold text-slate-800 mb-0.5">
                                                          {item.name}
                                                        </p>
                                                      )}
                                                      {renderExerciseMetrics(
                                                        item.sets_reps_duration_seconds_rest,
                                                      )}
                                                      {item.per_side &&
                                                        item.per_side.toLowerCase() ===
                                                          "yes" && (
                                                          <span className="inline-block text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium mt-1">
                                                            Per Side
                                                          </span>
                                                        )}
                                                    </div>
                                                  </div>
                                                  {item.safety_cue && (
                                                    <div className="mt-1.5 pt-1.5 border-t border-teal-100">
                                                      <p className="text-[9px] text-amber-700 font-medium">
                                                        Ã¢Å¡Â Ã¯Â¸Â {item.safety_cue}
                                                      </p>
                                                    </div>
                                                  )}
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        )}

                                      {selectedSection[dayName] ===
                                        "main_workout" &&
                                        dayResult.main_workout &&
                                        dayResult.main_workout.length > 0 && (
                                          <div className="space-y-2">
                                            {dayResult.main_workout.map(
                                              (item, index) => (
                                                <div
                                                  key={index}
                                                  className="p-3 bg-teal-50 rounded-lg border border-teal-100"
                                                >
                                                  <div className="flex items-start gap-2 mb-1">
                                                    <span className="shrink-0 w-5 h-5 bg-teal-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                                                      {index + 1}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                      {item.name && (
                                                        <p className="text-[10px] font-semibold text-slate-800 mb-0.5">
                                                          {item.name}
                                                        </p>
                                                      )}
                                                      {renderExerciseMetrics(
                                                        item.sets_reps_duration_seconds_rest,
                                                      )}
                                                      {item.per_side &&
                                                        item.per_side.toLowerCase() ===
                                                          "yes" && (
                                                          <span className="inline-block text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium mt-1">
                                                            Per Side
                                                          </span>
                                                        )}
                                                    </div>
                                                  </div>
                                                  {item.safety_cue && (
                                                    <div className="mt-1.5 pt-1.5 border-t border-teal-100">
                                                      <p className="text-[9px] text-amber-700 font-medium">
                                                        Ã¢Å¡Â Ã¯Â¸Â {item.safety_cue}
                                                      </p>
                                                    </div>
                                                  )}
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        )}

                                      {selectedSection[dayName] ===
                                        "cooldown" &&
                                        dayResult.cooldown &&
                                        dayResult.cooldown.length > 0 && (
                                          <div className="space-y-2">
                                            {dayResult.cooldown.map(
                                              (item, index) => (
                                                <div
                                                  key={index}
                                                  className="p-3 bg-teal-50 rounded-lg border border-teal-100"
                                                >
                                                  <div className="flex items-start gap-2 mb-1">
                                                    <span className="shrink-0 w-5 h-5 bg-teal-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                                                      {index + 1}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                      {item.name && (
                                                        <p className="text-[10px] font-semibold text-slate-800 mb-0.5">
                                                          {item.name}
                                                        </p>
                                                      )}
                                                      {renderCompleteExerciseMetrics(
                                                        item.sets_reps_duration_seconds_rest,
                                                      )}
                                                      {item.per_side &&
                                                        item.per_side.toLowerCase() ===
                                                          "yes" && (
                                                          <span className="inline-block text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium mt-1">
                                                            Per Side
                                                          </span>
                                                        )}
                                                    </div>
                                                  </div>
                                                  {item.safety_cue && (
                                                    <div className="mt-1.5 pt-1.5 border-t border-teal-100">
                                                      <p className="text-[9px] text-amber-700 font-medium">
                                                        Ã¢Å¡Â Ã¯Â¸Â {item.safety_cue}
                                                      </p>
                                                    </div>
                                                  )}
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        )}

                                      {/* No section selected message - should not show if warm_up is default */}
                                      {!selectedSection[dayName] && (
                                        <div className="flex items-center justify-center h-full text-sm text-gray-500">
                                          Select a section to view exercises
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                  </div>
                </div>
                {dayCardsCanScrollLeft && (
                  <button
                    type="button"
                    onClick={() => {
                      const container = dayCardsScrollRef.current;
                      if (!container) return;
                      container.scrollBy({
                        left: -container.clientWidth * 0.9,
                        behavior: "smooth",
                      });
                      setTimeout(updateDayCardsScrollState, 200);
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full shadow-md  bg-amber-600/70 text-white cursor-pointer"
                    aria-label="Scroll to previous days"
                  >
                    <HiArrowRight className="h-5 w-5 -scale-x-100 font-bold" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const container = dayCardsScrollRef.current;
                    if (!container) return;
                    container.scrollBy({
                      left: container.clientWidth * 0.9,
                      behavior: "smooth",
                    });
                    setTimeout(updateDayCardsScrollState, 200);
                  }}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full shadow-md  bg-amber-600/70 text-white cursor-pointer ${
                    dayCardsCanScrollRight ? "" : "opacity-100-"
                  }`}
                  aria-label="Scroll to next days"
                >
                  <HiArrowRight className="h-5 w-5 font-bold" />
                </button>
              </div>

              {/* Save Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                {/* Debug info for save state */}
                {!planMetadata && (
                  <div className="mb-2 text-xs text-amber-600 text-center">
                    Waiting for plan metadata to generate...
                  </div>
                )}
                {!workoutPlanJSON && planMetadata && (
                  <div className="mb-2 text-xs text-amber-600 text-center">
                    Waiting for workout plan to generate...
                  </div>
                )}
                {!user?.id && (
                  <div className="mb-2 text-xs text-red-600 text-center">
                    Please log in to save your plan
                  </div>
                )}
                <button
                  onClick={handleSavePlan}
                  disabled={
                    isSavingPlan ||
                    !user?.id ||
                    !planMetadata ||
                    !workoutPlanJSON
                  }
                  className={`w-full bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl py-4 px-6 font-bold text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 ${
                    isSavingPlan ||
                    !user?.id ||
                    !planMetadata ||
                    !workoutPlanJSON
                      ? "opacity-70 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {isSavingPlan ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : !planMetadata || !workoutPlanJSON ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Generating plan data...</span>
                    </>
                  ) : (
                    <>
                      <span>Save Plan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </Dialog>

        {/* Image Processing Reminder Dialog */}
        <Dialog
          visible={showImageProcessingDialog}
          onDismiss={() => setShowImageProcessingDialog(false)}
          maxWidth="520px"
        >
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-2 text-center">
              Image Processing Still Running
            </h2>
            <p className="text-sm text-slate-500 text-center">
              Your plan is saved. We are still generating and uploading plan
              images in the background. Please keep this tab open, but you can
              continue browsing other tabs.
            </p>
            <button
              onClick={() => setShowImageProcessingDialog(false)}
              className="w-full mt-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
            >
              Got it
            </button>
          </div>
        </Dialog>

        {/* Toast Notification */}
        {toast.show && (
          <div className="fixed top-6 right-6 z-100 animate-in slide-in-from-right fade-in duration-300">
            <div
              className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl border ${
                toast.type === "success"
                  ? "bg-teal-50 border-teal-200"
                  : toast.type === "error"
                    ? "bg-red-50 border-red-200"
                    : "bg-blue-50 border-blue-200"
              }`}
            >
              <div
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  toast.type === "success"
                    ? "bg-teal-100"
                    : toast.type === "error"
                      ? "bg-red-100"
                      : "bg-blue-100"
                }`}
              >
                {toast.type === "success" ? (
                  <svg
                    className="w-5 h-5 text-teal-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : toast.type === "error" ? (
                  <svg
                    className="w-5 h-5 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    toast.type === "success"
                      ? "text-teal-800"
                      : toast.type === "error"
                        ? "text-red-800"
                        : "text-blue-800"
                  }`}
                >
                  {toast.type === "success"
                    ? "Success!"
                    : toast.type === "error"
                      ? "Error"
                      : "Info"}
                </p>
                <p
                  className={`text-sm mt-0.5 ${
                    toast.type === "success"
                      ? "text-teal-700"
                      : toast.type === "error"
                        ? "text-red-700"
                        : "text-blue-700"
                  }`}
                >
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => setToast((prev) => ({ ...prev, show: false }))}
                className={`shrink-0 p-1 rounded-lg transition-colors ${
                  toast.type === "success"
                    ? "hover:bg-teal-100 text-teal-500"
                    : toast.type === "error"
                      ? "hover:bg-red-100 text-red-500"
                      : "hover:bg-blue-100 text-blue-500"
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

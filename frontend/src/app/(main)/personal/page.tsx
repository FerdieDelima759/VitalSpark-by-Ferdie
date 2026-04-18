"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  HiSparkles,
  HiArrowRight,
  HiArrowPath,
  HiArrowLeft,
} from "react-icons/hi2";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { UserProfile } from "@/types/UserProfile";
import { testOpenAIConnectionFull } from "@/utils/test_openai_connection";
import {
  generateWorkoutWithPrompt,
  generateDayWorkoutWithPrompt,
  enrichDayWorkoutWithExerciseDescriptions,
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
import { useUserContext } from "@/contexts/UserContext";
import Dialog from "@/components/Dialog";
import { useUserWorkoutData } from "@/hooks/useUserWorkoutData";
import type {
  CreateUserExerciseDetailsPayload,
  CreateUserWorkoutPlanExercisePayload,
  ExerciseSection,
} from "@/types/UserWorkout";
import { supabase } from "@/lib/api/supabase";
import { WorkoutPlanDetailsView } from "@/app/(main)/personal/workout/details/WorkoutPlanDetailsView";

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
const LIGHT_PAGE_BG = "#f8fafc";
const DARK_PAGE_BG =
  "linear-gradient(to bottom, #0b1020 0%, #0f172a 50%, #111827 100%)";
const DARK_OVERSCROLL_BG = "#0f172a";

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return { success: false, error: message };
  }
};

const fetchPlanExerciseDescriptionByPath = async (
  imagePath: string,
): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from("user_workout_plan_exercises")
      .select("description")
      .eq("image_path", imagePath)
      .not("description", "is", null)
      .limit(1);

    if (error) return null;
    const description = data?.[0]?.description;
    if (typeof description !== "string") return null;
    const trimmed = description.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
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

  return (
    <p className="text-xs text-teal-600 dark:text-teal-300 font-medium">
      {displayValue}
    </p>
  );
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
    <p className="text-xs text-teal-600 dark:text-teal-300 font-medium">
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
    const after = lowerValue.slice(
      idx + match[0].length,
      idx + match[0].length + 8,
    );
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
  const { user } = useAuth();
  const { fetchUserProfile } = useUserData();
  const { userProfile: userContextProfile, refreshUserData } = useUserContext();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(
    userContextProfile ?? null,
  );
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

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
  const { clearImageGeneration, setExerciseImage, queueDayForImageGeneration } =
    useImageGeneration();

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

  const applyThemeBackground = useCallback((theme: "light" | "dark") => {
    const pageBackground = theme === "dark" ? DARK_PAGE_BG : LIGHT_PAGE_BG;
    const overscrollColor = theme === "dark" ? DARK_OVERSCROLL_BG : LIGHT_PAGE_BG;
    document.documentElement.style.background = pageBackground;
    document.documentElement.style.backgroundColor = overscrollColor;
    document.body.style.background = pageBackground;
    document.body.style.backgroundColor = overscrollColor;
  }, []);

  const handleThemeToggle = useCallback((): void => {
    const root = document.documentElement;
    const nextTheme = root.classList.contains("dark") ? "light" : "dark";
    root.classList.remove("light", "dark");
    root.classList.add(nextTheme);
    localStorage.setItem("theme", nextTheme);
    applyThemeBackground(nextTheme);
    setIsDarkTheme(nextTheme === "dark");
  }, [applyThemeBackground]);

  const handleRefreshPage = useCallback(async () => {
    if (isRefreshingPage) return;
    setIsRefreshingPage(true);

    try {
      if (typeof window !== "undefined") {
        if (user?.id) {
          localStorage.removeItem(`my_workout_plans_cache_${user.id}`);
        }
      }

      const tasks: Promise<void>[] = [];

      if (user?.id) {
        tasks.push(
          (async () => {
            try {
              await refreshUserData();
            } catch (error) {
              console.error("Error refreshing user context:", error);
            }
          })(),
        );

        tasks.push(
          (async () => {
            setIsLoadingProfile(true);
            try {
              const result = await fetchUserProfile(user.id);
              if (result.success && result.data) {
                setUserProfile(result.data);
              }
            } catch (error) {
              console.error("Error refreshing user profile:", error);
            } finally {
              setIsLoadingProfile(false);
            }
          })(),
        );

        tasks.push(
          (async () => {
            setIsLoadingMyPlans(true);
            try {
              const result = await fetchUserWorkoutPlans(user.id);
              if (result.success && result.data) {
                updateMyWorkoutPlansCache(result.data, user.id);
              }
            } catch (error) {
              console.error("Error refreshing user workout plans:", error);
            } finally {
              setIsLoadingMyPlans(false);
            }
          })(),
        );
      }

      await Promise.all(tasks);
    } finally {
      setIsRefreshingPage(false);
    }
  }, [
    isRefreshingPage,
    user?.id,
    fetchUserProfile,
    fetchUserWorkoutPlans,
    refreshUserData,
    updateMyWorkoutPlansCache,
  ]);

  useEffect(() => {
    const root = document.documentElement;
    const savedTheme = localStorage.getItem("theme");
    const resolvedTheme =
      savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    applyThemeBackground(resolvedTheme);
    setIsDarkTheme(resolvedTheme === "dark");

    return () => {
      document.documentElement.style.background = "";
      document.documentElement.style.backgroundColor = "";
      document.body.style.background = "";
      document.body.style.backgroundColor = "";
    };
  }, [applyThemeBackground]);

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
        console.error(" User profile not available");
        alert("Please complete your profile before generating a workout plan.");
        setIsGeneratingWorkout(false);
        return;
      }

      // Prepare user data for prompts
      const weeklyFrequencyValue =
        Array.isArray(userProfile.weekly_frequency) &&
        userProfile.weekly_frequency.length > 0
          ? userProfile.weekly_frequency.join(", ")
          : "not specified";

      const userData = {
        gender: userProfile.gender || "not specified",
        goal: userProfile.fitness_goal || "not specified",
        location: userProfile.workout_location || "not specified",
        equipments: userProfile.equipment_list?.length
          ? userProfile.equipment_list.join(", ")
          : "not specified",
        level: userProfile.fitness_level || "not specified",
        weekly_frequency: weeklyFrequencyValue,
        schedule: weeklyFrequencyValue,
        age: userProfile.age_range || "not specified",
        duration: userProfile.workout_duration_minutes
          ? userProfile.workout_duration_minutes.toString()
          : "not specified",
      };

      // Use user-selected duration for the plan
      const planDuration = `${durationDays} days`;

      // Log user data being sent to prompts
      aiLog(" User Data for Prompts:", {
        ...userData,
        plan_duration: planDuration,
      });

      // Step 1: Generate plan metadata first to get plan_name
      aiLog(" Step 1: Generating Plan Metadata with duration:", planDuration);
      const metadataResult = await generatePlanMetadataWithPrompt({
        gender: userData.gender,
        goal: userData.goal,
        location: userData.location,
        equipments: userData.equipments,
        level: userData.level,
        weekly_frequency: userData.weekly_frequency,
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
          " Plan Metadata Generated (with selected duration):",
          updatedMetadata,
        );
        setPlanMetadata(updatedMetadata);
        generatedPlanName = metadataResult.response.plan_name;
      } else {
        aiWarn(
          " Plan Metadata Generation Failed, using defaults:",
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
        " Step 2: Generating Workout Plan with plan_name:",
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
        weekly_frequency: userData.weekly_frequency,
        schedule: userData.schedule,
        age: userData.age,
        duration: userData.duration,
        plan_name: generatedPlanName,
        plan_duration: planDuration, // Use user-selected duration
        week_number: "1",
      };

      const result = await generateWorkoutWithPrompt(workoutVariables);

      // Log generation result (excluding images)
      aiLog(" Workout Plan Generation Result:", {
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
          aiLog(" Workout Plan JSON Generated (Complete Structure):", {
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
            " Complete Raw JSON Object:",
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
          aiLog(" Workout Plan Text Generated (length):", workoutText.length);
          setGeneratedWorkout(workoutText);
          setWorkoutPlanJSON(null);

          // Parse the workout response into structured daily workouts
          try {
            const workouts = parseWorkoutResponse(workoutText);
            aiLog(" Parsed Workouts:", workouts.length, "days");
            setParsedWorkouts(workouts);
          } catch (error) {
            console.error("Error parsing workout response:", error);
            setParsedWorkouts([]);
          }
        }
      } else {
        console.error(" Workout Plan Generation Failed:", result.error);
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
    void exerciseDescription;
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
    const storageUrl = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/exercises/${gender}/${imageSlug}.png`;

    aiLog(` [Regenerate] Starting: ${exerciseName}`);
    aiLog(`     Section: ${section}  ${mapSectionKeyToStorage(section)}`);
    aiLog(`     Image slug: ${imageSlug}`);

    // Note: Individual image regeneration now uses context functions
    aiLog(`     Generating image via context...`);

    try {
      const descriptionFromPlan =
        await fetchPlanExerciseDescriptionByPath(storageUrl);
      if (!descriptionFromPlan) {
        aiWarn(
          "     Missing description in user_workout_plan_exercises.description",
        );
        return;
      }

      const result = await generateExerciseImage(
        exerciseName,
        descriptionFromPlan,
        gender,
      );

      if (result.success && result.image) {
        setExerciseImage(imageKey, result.image);
        aiLog(`     Image generated for display`);

        // Upload to storage
        aiLog(`     Uploading to storage...`);
        const uploadResult = await uploadImageToStorage(
          result.image,
          gender,
          imageSlug,
        );

        if (uploadResult.success) {
          aiLog(`     Uploaded: ${uploadResult.url}`);
          setExerciseImage(imageKey, uploadResult.url!);
        } else {
          aiWarn(`     Upload failed: ${uploadResult.error}`);
        }
      } else {
        aiWarn(`     Failed to generate image: ${result.error}`);
      }
    } catch (error) {
      console.error(`     Error: ${error}`);
    }
    aiLog(` [Regenerate] Complete: ${exerciseName}`);
  };

  // Generate images for all exercises in a day workout and upload to storage
  // Processes consecutively: warmup  main  cooldown
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

    // Process sections in order: warmup  main  cooldown
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
      aiLog(` No exercises found for ${dayName}`);
      return;
    }

    let processedCount = 0;
    let generatedCount = 0;
    let uploadedCount = 0;
    let existsInStorageCount = 0;
    let failedCount = 0;

    aiLog(`\n`);
    aiLog(
      `   AUTO-GENERATING IMAGES FOR: ${dayName.toUpperCase().padEnd(28)} `,
    );
    aiLog(``);
    aiLog(`   Total exercises: ${String(totalExercises).padEnd(40)} `);
    aiLog(`   Gender: ${gender.padEnd(49)} `);
    aiLog(
      `   Sections: warmup(${sections[0].exercises.length})  main(${sections[1].exercises.length})  cooldown(${sections[2].exercises.length})`.padEnd(
        64,
      ) + ` `,
    );
    aiLog(``);

    // Process each section consecutively
    for (const section of sections) {
      if (!section.exercises || section.exercises.length === 0) {
        aiLog(`\n ${section.name}: (empty - skipping)`);
        continue;
      }

      aiLog(`\n`);
      aiLog(
        `   ${section.name} (${section.exercises.length} exercises)`.padEnd(
          64,
        ) + ``,
      );
      aiLog(``);

      // Process each exercise in this section consecutively
      for (let index = 0; index < section.exercises.length; index++) {
        const exercise = section.exercises[index];
        if (!exercise.name) {
          aiLog(`     Exercise ${index + 1} has no name, skipping`);
          continue;
        }

        processedCount++;
        const progress = `[${processedCount}/${totalExercises}]`;
        const imageKey = `${dayName}-${section.key}-${index}`;
        const imageSlug = createImageSlug(section.key, exercise.name);
        const storageUrl = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/exercises/${gender}/${imageSlug}.png`;

        aiLog(`\n${progress}  Checking: ${exercise.name}`);
        aiLog(`     Slug: ${imageSlug}`);
        aiLog(`     URL: ${storageUrl}`);

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
          aiLog(`${progress}  EXISTS in storage: ${exercise.name}`);
          existsInStorageCount++;
          // Set the image in state for display via context
          setExerciseImage(imageKey, storageUrl);
          continue;
        }

        // Generate and upload the image
        aiLog(`${progress}  GENERATING: ${exercise.name}...`);

        try {
          const exerciseDescription =
            await fetchPlanExerciseDescriptionByPath(storageUrl);
          if (!exerciseDescription) {
            failedCount++;
            aiWarn(
              `${progress}  Missing description in user_workout_plan_exercises.description`,
            );
            continue;
          }

          // Step 1: Generate the image
          const result = await generateExerciseImage(
            exercise.name,
            exerciseDescription,
            gender,
          );

          if (result.success && result.image) {
            generatedCount++;
            aiLog(`${progress}  Generated: ${exercise.name}`);

            // Update state immediately so user sees the image
            setExerciseImage(imageKey, result.image);

            // Step 2: Upload to storage
            aiLog(`${progress}  Uploading to storage...`);
            const uploadResult = await uploadImageToStorage(
              result.image,
              gender,
              imageSlug,
            );

            if (uploadResult.success) {
              uploadedCount++;
              aiLog(`${progress}  Uploaded: ${exercise.name}`);
              aiLog(`     ${uploadResult.url}`);
              // Update with final storage URL
              setExerciseImage(imageKey, uploadResult.url!);
            } else {
              aiWarn(`${progress}  Upload failed: ${uploadResult.error}`);
            }
          } else {
            failedCount++;
            aiWarn(`${progress}  Generation failed: ${result.error}`);
          }
        } catch (error) {
          failedCount++;
          console.error(`${progress}  Error: ${error}`);
        }

        // Delay between exercises to avoid rate limiting
        if (index < section.exercises.length - 1) {
          aiLog(`     Waiting 1.5s before next exercise...`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      aiLog(`\n     ${section.name} section complete!`);
    }

    // Final summary
    aiLog(`\n`);
    aiLog(`   COMPLETE: ${dayName.toUpperCase().padEnd(47)} `);
    aiLog(``);
    aiLog(`   Total processed: ${String(processedCount).padEnd(40)} `);
    aiLog(`   Already in storage: ${String(existsInStorageCount).padEnd(37)} `);
    aiLog(`   Generated: ${String(generatedCount).padEnd(46)} `);
    aiLog(`   Uploaded: ${String(uploadedCount).padEnd(47)} `);
    aiLog(`   Failed: ${String(failedCount).padEnd(49)} `);
    aiLog(``);

    if (generatedCount > 0) {
      aiLog(
        `%c ${generatedCount} new images generated for ${dayName}!`,
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
        console.error(" User profile not available for day workout generation");
        setGeneratingDays((prev) => ({ ...prev, [dayName]: false }));
        return;
      }

      // Prepare validated user data for day workout prompt
      const weeklyFrequencyValue =
        userProfile.weekly_frequency?.length
          ? userProfile.weekly_frequency.join(", ")
          : "not specified";

      const userData = {
        gender: userProfile.gender || "not specified",
        goal: userProfile.fitness_goal || "not specified",
        location: userProfile.workout_location || "not specified",
        equipments: userProfile.equipment_list?.length
          ? userProfile.equipment_list.join(", ")
          : "not specified",
        level: userProfile.fitness_level || "not specified",
        weekly_frequency: weeklyFrequencyValue,
        schedule: weeklyFrequencyValue,
        age: userProfile.age_range || "not specified",
        duration: userProfile.workout_duration_minutes
          ? userProfile.workout_duration_minutes.toString()
          : "not specified",
      };

      // Log user data for day workout
      aiLog(` User Data for Day Workout (${dayName}):`, userData);

      // Build day-specific variables with validated user data
      const dayVariables = {
        gender: userData.gender,
        goal: userData.goal,
        location: userData.location,
        equipments: userData.equipments,
        level: userData.level,
        weekly_frequency: userData.weekly_frequency,
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
        aiLog(` Day Workout Generated - ${dayName}:`, {
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
        console.error(` Day Workout Generation Failed - ${dayName}:`, {
          error: result.error,
          success: result.success,
        });
      }

      if (result.success && result.response) {
        const dayResultWithDescriptions =
          await enrichDayWorkoutWithExerciseDescriptions(
            result.response,
            userData.gender,
          );

        setDayWorkoutResults((prev) => ({
          ...prev,
          [dayName]: dayResultWithDescriptions,
        }));
        // Set default view to Warm Up
        setSelectedSection((prev) => ({
          ...prev,
          [dayName]: "warm_up",
        }));

        aiLog(
          ` ${dayName}: Exercises generated. Image queue will start after successful plan save.`,
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

    const dayEntries = Object.entries(
      workoutPlanJSON.days as Record<
        string,
        { title?: string; focus?: string } | undefined
      >,
    );

    const completeDayNames = dayEntries
      .filter(
        ([, day]) => Boolean(day?.title?.trim()) && Boolean(day?.focus?.trim()),
      )
      .map(([dayName]) => dayName);

    if (completeDayNames.length > 0) {
      return completeDayNames;
    }

    // Fallback for non-standard model output (e.g., 14-day variants with custom keys).
    return dayEntries
      .filter(([, day]) => Boolean(day))
      .map(([dayName]) => dayName);
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
      const dayLookup = workoutPlanJSON.days as Record<
        string,
        { title?: string; focus?: string } | undefined
      >;
      const daysWithData = expectedDayNames
        .map((dayName) => {
          const day = dayLookup[dayName];
          if (!day) return null;
          return {
            dayName,
            title: day.title?.trim() || formatTitleCase(dayName),
            focus: day.focus?.trim() || "General fitness",
          };
        })
        .filter(
          (
            item,
          ): item is { dayName: string; title: string; focus: string } =>
            Boolean(item),
        );

      // Sequentially generate exercises for each day
      const generateAllDays = async () => {
        aiLog(
          ` Starting exercise generation for ${daysWithData.length} days...`,
        );

        const queue = [...daysWithData];
        let index = 0;
        const worker = async () => {
          while (index < queue.length) {
            const current = queue[index];
            index += 1;
            if (!current) break;
            const { dayName, title, focus } = current;

            // Skip if already generated (check both ref and current state)
            if (
              generatedDaysRef.current.has(dayName) ||
              dayWorkoutResults[dayName]
            ) {
              aiLog(` Skipping ${dayName} - already generated`);
              continue;
            }

            aiLog(` Auto-generating exercises for ${dayName}...`);
            const success = await handleDayWorkoutGenerate(
              dayName,
              title,
              focus,
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
        aiLog(" All day exercises generated.");
      };

      generateAllDays();
    }

    // Clean up states when dialog closes
    if (
      !showWorkoutPlanDialog &&
      !isGeneratingWorkout &&
      !showGenerationModal
    ) {
      // Keep context image queue running after save; only clear local UI state.
      if (planJustSavedRef.current) {
        aiLog(" Plan saved - keeping background image generation queue running.");
        planJustSavedRef.current = false;

        // Refresh the My Workout Plans list
        if (user?.id) {
          fetchUserWorkoutPlans(user.id).then((result) => {
            if (result.success && result.data) {
              updateMyWorkoutPlansCache(result.data, user.id);
            }
          });
        }

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

        aiLog(" UI states cleaned up; image queue continues in background.");
        return;
      }

      // Normal cleanup when dialog closes without saving
      aiLog(" Cleaning up generation states and data...");

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

      // Keep the global image-generation queue intact so processing can
      // continue across routes/tabs even after this page resets its local UI.

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

      aiLog(" All generation states and storage cleaned up");
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
    console.log(" handleSavePlan called - checking conditions:", {
      hasUserId: !!user?.id,
      userId: user?.id,
      hasWorkoutPlanJSON: !!workoutPlanJSON,
      hasPlanMetadata: !!planMetadata,
      dayWorkoutResultsCount: Object.keys(dayWorkoutResults).length,
    });

    if (!user?.id || !workoutPlanJSON) {
      console.error(" Save blocked: Missing user ID or workout plan JSON");
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
      console.error(" Cannot save: planMetadata is null");
      return;
    }

    setIsSavingPlan(true);
    console.log(" Save started - isSavingPlan = true");

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

      const queuePendingImagesForSavedPlan = async (
        savedPlanId: string,
        authenticatedUserId: string,
      ) => {
        type PlanOwnerRow = { id: string; user_id: string };
        type WeekRow = { id: string; week_number: number | null; plan_id: string };
        type DayRow = { id: string; day: string | null; week_plan_id: string };
        type ExerciseRow = {
          id: string;
          weekly_plan_id: string;
          section: ExerciseSection | null;
          position: number | null;
          image_path: string | null;
          image_alt: string | null;
          description: string | null;
          is_image_generated: boolean | null;
        };

        const daySortRank = (day: string | null): number => {
          if (!day) return 99;
          const normalized = day.toLowerCase().trim();
          const rankMap: Record<string, number> = {
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6,
            sunday: 7,
          };
          if (rankMap[normalized]) return rankMap[normalized];
          const numericMatch = normalized.match(/\d+/);
          if (numericMatch?.[0]) return Number(numericMatch[0]);
          return 99;
        };

        const mapStoredSectionToQueueSection = (
          section: ExerciseSection | null,
        ): "warm_up" | "main_workout" | "cooldown" => {
          if (section === "warmup") return "warm_up";
          if (section === "cooldown") return "cooldown";
          return "main_workout";
        };

        const parseExerciseNameFromImageAlt = (
          imageAlt: string | null,
        ): string | null => {
          if (!imageAlt) return null;
          const trimmed = imageAlt
            .replace(/\s*exercise demonstration\s*$/i, "")
            .trim();
          return trimmed.length > 0 ? trimmed : null;
        };

        const parseExerciseNameFromImagePath = (
          imagePath: string | null,
        ): string | null => {
          if (!imagePath) return null;
          const imageSlugMatch = imagePath.match(
            /\/exercises\/(?:male|female)\/(.+?)\.png(?:\?|$)/i,
          );
          const rawSlug = imageSlugMatch?.[1];
          if (!rawSlug) return null;
          const namePart = rawSlug.includes("/")
            ? rawSlug.split("/").slice(1).join("/")
            : rawSlug;
          const cleaned = namePart.replace(/-/g, " ").trim();
          return cleaned.length > 0 ? formatTitleCase(cleaned) : null;
        };

        const { data: planOwnerData, error: planOwnerError } = await supabase
          .from("user_workout_plans")
          .select("id,user_id")
          .eq("id", savedPlanId)
          .eq("user_id", authenticatedUserId)
          .maybeSingle();

        if (planOwnerError || !planOwnerData) {
          aiWarn(" Skipping image queue bind: saved plan not owned by user.", {
            savedPlanId,
            authenticatedUserId,
            error: planOwnerError?.message,
          });
          return;
        }

        const ownedPlan = planOwnerData as PlanOwnerRow;

        const { data: weekRowsData, error: weekRowsError } = await supabase
          .from("user_workout_weekly_plan")
          .select("id,plan_id,week_number")
          .eq("plan_id", ownedPlan.id)
          .order("week_number", { ascending: true });
        if (weekRowsError) {
          aiWarn(" Failed to fetch week plans for image queue bind:", {
            savedPlanId,
            error: weekRowsError.message,
          });
          return;
        }

        const weekRows = (weekRowsData || []) as WeekRow[];
        if (weekRows.length === 0) {
          aiWarn(" No week plans found after save; skipping image queue bind.", {
            savedPlanId,
          });
          return;
        }

        const weekPlanIds = weekRows.map((row) => row.id);

        const { data: dayRowsData, error: dayRowsError } = await supabase
          .from("user_workout_weekly_day_plan")
          .select("id,day,week_plan_id")
          .in("week_plan_id", weekPlanIds);
        if (dayRowsError) {
          aiWarn(" Failed to fetch daily plans for image queue bind:", {
            savedPlanId,
            error: dayRowsError.message,
          });
          return;
        }

        const dayRows = (dayRowsData || []) as DayRow[];
        if (dayRows.length === 0) {
          aiWarn(" No daily plans found after save; skipping image queue bind.", {
            savedPlanId,
          });
          return;
        }

        const dayPlanIds = dayRows.map((row) => row.id);

        const { data: exerciseRowsData, error: exerciseRowsError } = await supabase
          .from("user_workout_plan_exercises")
          .select(
            "id,weekly_plan_id,section,position,image_path,image_alt,description,is_image_generated",
          )
          .in("weekly_plan_id", dayPlanIds)
          .or("is_image_generated.is.null,is_image_generated.eq.false")
          .order("weekly_plan_id", { ascending: true })
          .order("position", { ascending: true });
        if (exerciseRowsError) {
          aiWarn(" Failed to fetch pending exercises for image queue bind:", {
            savedPlanId,
            error: exerciseRowsError.message,
          });
          return;
        }

        const exerciseRows = (exerciseRowsData || []) as ExerciseRow[];
        if (exerciseRows.length === 0) {
          aiLog(
            ` No pending is_image_generated rows found for plan ${savedPlanId}; image queue not updated.`,
          );
          return;
        }

        const weekById = new Map<string, WeekRow>();
        weekRows.forEach((row) => weekById.set(row.id, row));

        const dayById = new Map<string, DayRow>();
        dayRows.forEach((row) => dayById.set(row.id, row));

        type QueueDayEntry = {
          dayName: string;
          weekNumber: number;
          dayRank: number;
          dayResult: DayWorkoutResponse;
        };

        const queuedDaysByName = new Map<string, QueueDayEntry>();

        exerciseRows.forEach((exerciseRow) => {
          const dayRow = dayById.get(exerciseRow.weekly_plan_id);
          if (!dayRow) return;
          const weekRow = weekById.get(dayRow.week_plan_id);
          if (!weekRow) return;

          const weekNumber = weekRow.week_number ?? 1;
          const rawDayName = dayRow.day?.trim() || "day";
          const dayLabel = formatTitleCase(rawDayName);
          const dayNameForQueue = `${dayLabel} (Week ${weekNumber})`;

          let dayEntry = queuedDaysByName.get(dayNameForQueue);
          if (!dayEntry) {
            dayEntry = {
              dayName: dayNameForQueue,
              weekNumber,
              dayRank: daySortRank(dayRow.day),
              dayResult: {
                day: dayLabel,
                warm_up: [],
                main_workout: [],
                cooldown: [],
              },
            };
            queuedDaysByName.set(dayNameForQueue, dayEntry);
          }

          const sectionKey = mapStoredSectionToQueueSection(exerciseRow.section);
          const exerciseName =
            parseExerciseNameFromImageAlt(exerciseRow.image_alt) ||
            parseExerciseNameFromImagePath(exerciseRow.image_path) ||
            `Exercise ${exerciseRow.id.slice(0, 6)}`;
          const exerciseDescription =
            exerciseRow.description?.trim() ||
            `Exercise demonstration for ${exerciseName}`;

          const queueExercise: ExerciseItem = {
            name: exerciseName,
            description: exerciseDescription,
          };

          if (sectionKey === "warm_up") {
            dayEntry.dayResult.warm_up!.push(queueExercise);
          } else if (sectionKey === "cooldown") {
            dayEntry.dayResult.cooldown!.push(queueExercise);
          } else {
            dayEntry.dayResult.main_workout!.push(queueExercise);
          }
        });

        const orderedQueuedDays = Array.from(queuedDaysByName.values())
          .filter((entry) => {
            const totalExercises =
              (entry.dayResult.warm_up?.length || 0) +
              (entry.dayResult.main_workout?.length || 0) +
              (entry.dayResult.cooldown?.length || 0);
            return totalExercises > 0;
          })
          .sort((a, b) => {
            if (a.weekNumber !== b.weekNumber) {
              return a.weekNumber - b.weekNumber;
            }
            if (a.dayRank !== b.dayRank) {
              return a.dayRank - b.dayRank;
            }
            return a.dayName.localeCompare(b.dayName);
          });

        if (orderedQueuedDays.length === 0) {
          aiLog(
            ` Pending exercise rows for ${savedPlanId} produced no valid day queue entries.`,
          );
          return;
        }

        const dayOrderForQueue = orderedQueuedDays.map((entry) => entry.dayName);

        orderedQueuedDays.forEach((entry) => {
          queueDayForImageGeneration(
            entry.dayName,
            entry.dayResult,
            userGender,
            dayOrderForQueue,
            savedPlanId,
          );
        });

        aiLog(
          ` Image queue bound from DB for saved plan ${savedPlanId}: ${orderedQueuedDays.length} day(s), ${exerciseRows.length} pending exercise row(s).`,
        );
      };

      // Get random image path based on user's gender and location (with timeout)
      console.log(" Getting random image path...");
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
        console.log(" Got image path result:", imageResult.success);

        if (imageResult.success && imageResult.data) {
          imagePath = imageResult.data;
        } else {
          // Fallback to a default image path
          const randomNum = Math.floor(Math.random() * 50) + 1;
          imagePath = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/plans/${userGender}/${userLocation}/${randomNum}.png`;
          console.log(" Using fallback image path:", imagePath);
        }
      } catch (imgError) {
        console.warn(" Error getting image path, using fallback:", imgError);
        const randomNum = Math.floor(Math.random() * 50) + 1;
        imagePath = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/plans/${userGender}/${userLocation}/${randomNum}.png`;
      }

      console.log(" Final image path:", imagePath);

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
          console.warn(" Session validation failed before save:", {
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
          " getSession returned an error, but continuing with a verified user:",
          serializeAuthError(sessionError),
        );
      }
      console.log(" Session verified for user:", authenticatedUserId);

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
        " Saving Workout Plan (from metadata prompt pmpt_697b9c2d67788195908580fac6389db000faf9c8a4b2d393):",
        {
          name: savePayload.name,
          description: savePayload.description,
          tags: savePayload.tags,
          duration_days: savePayload.duration_days,
          category: savePayload.category,
          user_id: savePayload.user_id,
          image_path: savePayload.image_path
            ? " Image path set"
            : " No image path",
          image_alt: savePayload.image_alt,
        },
      );

      // Save the plan with timeout protection
      console.log(" Calling createUserWorkoutPlan...");
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
        " createUserWorkoutPlan returned:",
        JSON.stringify(result, null, 2),
      );
      console.log(
        result.success ? " Success!" : " Failed:",
        result.error || "(no error message)",
      );

      // Log save result
      if (result.success && result.data?.id) {
        const planId = result.data.id;
        console.log(" Workout Plan Saved Successfully:", {
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
          console.log(" Creating Week Plan (user_workout_weekly_plan):", {
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
            console.error(" Failed to save Week Plan:", weekPlanResult.error);
            showToast(
              `Plan saved but week plan failed: ${weekPlanResult.error || "Unknown error"}`,
              "error",
            );
            planJustSavedRef.current = true;
            setShowWorkoutPlanDialog(false);
            return;
          }

          const weekPlanId = weekPlanResult.data.id;
          console.log(" Week Plan Saved Successfully:", {
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
            " Saving Weekly Daily Plans (user_workout_weekly_daily_plan):",
            {
              week_plan_id: weekPlanId,
              days_count: weeklyPlanPayloads.length,
            },
          );

          // Save all weekly daily plans in batch with timeout
          console.log(" Saving weekly daily plans...");
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
            console.log(" Weekly Daily Plans Saved Successfully:", {
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

            console.log(" Weekly Plan Map created:", {
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
                  console.warn(` No weekly plan ID found for day: ${dayName}`);
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
                " Processing Exercise Details (checking for existing, from prompt pmpt_696b4c297ebc8193ab67088cd5e034c10a70cda92773d275):",
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
              console.log(" Calling createOrReuseExerciseDetailsBatch...");
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
                " createOrReuseExerciseDetailsBatch returned:",
                exerciseResult.success,
              );

              if (exerciseResult.success && exerciseResult.data) {
                console.log(" Exercise Details Saved/Reused Successfully:", {
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

                console.log(" Exercise ID Map created (name+equipment):", {
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
                        ` No weekly plan ID found for day: ${dayName} (skipping plan exercises)`,
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
                            ` No exercise ID found for: ${exercise.name} (equipment: ${exercise.equipment || "none"})`,
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
                  console.log(" Saving Plan Exercises:", {
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
                    " Calling createUserWorkoutPlanExercisesBatch...",
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
                    " createUserWorkoutPlanExercisesBatch returned:",
                    planExercisesResult.success,
                  );

                  if (planExercisesResult.success) {
                    console.log(" Plan Exercises Saved Successfully:", {
                      records_saved: planExercisesResult.data?.length,
                    });

                    try {
                      const refreshedPlansResult = await fetchUserWorkoutPlans(
                        authenticatedUserId,
                      );
                      if (refreshedPlansResult.success && refreshedPlansResult.data) {
                        updateMyWorkoutPlansCache(
                          refreshedPlansResult.data,
                          authenticatedUserId,
                        );
                        aiLog(
                          ` Reloaded saved workout plans from DB for user ${authenticatedUserId}.`,
                        );
                      } else {
                        aiWarn(
                          " Unable to refresh workout plans after save:",
                          refreshedPlansResult.error,
                        );
                      }
                    } catch (refreshError) {
                      aiWarn(" Error refreshing workout plans after save:", refreshError);
                    }

                    await queuePendingImagesForSavedPlan(
                      planId,
                      authenticatedUserId,
                    );

                    console.log(
                      " Plan exercises saved. Image generation continues via ImageGenerationContext queue.",
                    );

                    // Show success toast and close dialog
                    planJustSavedRef.current = true; // Mark that plan was saved for background processing
                    showToast(
                      "Workout plan saved successfully! Images are being processed in the background.",
                      "success",
                    );
                    setShowWorkoutPlanDialog(false);
                    setShowImageProcessingDialog(true);
                  } else {
                    console.error(" Failed to Save Plan Exercises:", {
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
                console.error(" Failed to Save Exercise Details:", {
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
                " No exercise details to save (no day workouts generated)",
              );
              planJustSavedRef.current = true;
              showToast("Workout plan saved successfully!", "success");
              setShowWorkoutPlanDialog(false);
              setShowImageProcessingDialog(true);
            }
          } else {
            console.error(" Failed to Save Weekly Plan Data:", {
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
        console.error(" Failed to Save Workout Plan:", {
          error: result.error,
          fullResult: result,
        });
        showToast(
          `Failed to save plan: ${result.error || "Database operation failed. Please try again."}`,
          "error",
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(" Error saving workout plan:", error);
      showToast(
        `An error occurred while saving: ${errorMessage}`,
        "error",
      );
    } finally {
      console.log(" Save complete - setting isSavingPlan = false");
      setIsSavingPlan(false);
    }
  };

  const featuredPlan = useMemo(() => {
    if (myWorkoutPlans.length === 0) return null;
    return [...myWorkoutPlans].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];
  }, [myWorkoutPlans]);

  if (isLoadingMyPlans && !featuredPlan) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827]">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-teal-600" />
            <p className="text-sm font-bold text-teal-700 dark:text-teal-300">
              Loading workout plan...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (featuredPlan?.id) {
    return <WorkoutPlanDetailsView planId={featuredPlan.id} embedded />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827]">
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-10">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            No workout plan to display
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            This page now shows your workout plan directly. Save or refresh your
            plans to load the latest one here.
          </p>
          <button
            type="button"
            onClick={handleRefreshPage}
            disabled={isRefreshingPage}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400"
          >
            <HiArrowPath
              className={`h-4 w-4 ${isRefreshingPage ? "animate-spin" : ""}`}
            />
            Refresh plans
          </button>
        </div>
      </div>
    </div>
  );
}

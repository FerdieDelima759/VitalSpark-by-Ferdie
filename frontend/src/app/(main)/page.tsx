"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Dialog from "@/components/Dialog";
import Loader from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { useUserContext } from "@/contexts/UserContext";
import { supabase } from "@/lib/api/supabase";
import {
  HiFire,
  HiArrowRightCircle,
  HiHeart,
  HiArrowsUpDown,
  HiBars3BottomLeft,
  HiCalculator,
  HiCheckCircle,
  HiInformationCircle,
  HiMoon,
  HiSun,
  HiArrowRightOnRectangle,
} from "react-icons/hi2";

interface CompletedSessionRow {
  ended_at: string | null;
}

type WorkoutSessionSource = "workout" | "user_workout";

interface SessionActivityRow {
  plan_id: string | null;
  started_at: string | null;
  ended_at: string | null;
}

interface WorkoutPlanLookupRow {
  id: string;
  name: string;
  image_path: string | null;
  image_alt: string | null;
  category: string | null;
  duration_days: number | null;
}

interface WorkoutPlanCreatedRow extends WorkoutPlanLookupRow {
  created_at: string | null;
}

interface DashboardWorkoutCard {
  key: string;
  source: WorkoutSessionSource;
  planId: string;
  planName: string;
  imagePath: string | null;
  imageAlt: string | null;
  category: string | null;
  durationDays: number | null;
  startedAt: string | null;
  endedAt: string | null;
  activityAt: string;
  isActive: boolean;
}

interface WorkoutCardsCachePayload {
  timestamp: number;
  currentWorkoutCard: DashboardWorkoutCard | null;
  allRecentWorkoutCards: DashboardWorkoutCard[];
  allNewlyCreatedWorkoutCards: DashboardWorkoutCard[];
}

interface StreakMetrics {
  currentStreakDays: number;
  completedDaysThisWeek: number;
}

const DEFAULT_WEEKLY_GOAL = 5;
const FALLBACK_WORKOUT_IMAGE = "/images/onboarding_1.png";
const WORKOUT_CARDS_CACHE_DURATION_MS = 10 * 60 * 1000;

const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toLocalDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getWeekStartMonday = (date: Date): Date => {
  const localDay = toLocalDay(date);
  const dayIndex = localDay.getDay();
  const daysFromMonday = (dayIndex + 6) % 7;
  localDay.setDate(localDay.getDate() - daysFromMonday);
  return localDay;
};

const calculateStreakMetrics = (
  sessions: CompletedSessionRow[],
): StreakMetrics => {
  const completedDates = new Map<string, Date>();

  sessions.forEach((session) => {
    if (!session.ended_at) return;
    const endedAt = new Date(session.ended_at);
    if (Number.isNaN(endedAt.getTime())) return;

    const day = toLocalDay(endedAt);
    const key = toLocalDateKey(day);
    if (!completedDates.has(key)) {
      completedDates.set(key, day);
    }
  });

  const completedDateKeys = new Set(completedDates.keys());
  const today = toLocalDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let streakAnchor: Date | null = null;
  if (completedDateKeys.has(toLocalDateKey(today))) {
    streakAnchor = today;
  } else if (completedDateKeys.has(toLocalDateKey(yesterday))) {
    streakAnchor = yesterday;
  }

  let currentStreakDays = 0;
  if (streakAnchor) {
    const cursor = new Date(streakAnchor);
    while (completedDateKeys.has(toLocalDateKey(cursor))) {
      currentStreakDays += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  const weekStart = getWeekStartMonday(today);
  const completedWeekDateKeys = new Set<string>();
  completedDates.forEach((day, key) => {
    if (day >= weekStart && day <= today) {
      completedWeekDateKeys.add(key);
    }
  });

  return {
    currentStreakDays,
    completedDaysThisWeek: completedWeekDateKeys.size,
  };
};

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const getActivityAt = (session: SessionActivityRow): string | null =>
  session.ended_at || session.started_at;

const formatShortDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const formatSessionDayLabel = (value: string | null): string => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const cleanPlanName = (name: string): string =>
  name.replace(/ - \d{4}-\d{2}-\d{2}.*$/, "");

const getWorkoutCardsCacheKey = (userId: string): string =>
  `dashboard_workout_cards_cache_${userId}`;

const readWorkoutCardsCache = (
  userId: string,
): WorkoutCardsCachePayload | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getWorkoutCardsCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkoutCardsCachePayload;

    if (
      typeof parsed?.timestamp !== "number" ||
      !("allRecentWorkoutCards" in parsed)
    ) {
      return null;
    }

    return {
      timestamp: parsed.timestamp,
      currentWorkoutCard: parsed.currentWorkoutCard || null,
      allRecentWorkoutCards: Array.isArray(parsed.allRecentWorkoutCards)
        ? parsed.allRecentWorkoutCards
        : [],
      allNewlyCreatedWorkoutCards: Array.isArray(
        parsed.allNewlyCreatedWorkoutCards,
      )
        ? parsed.allNewlyCreatedWorkoutCards
        : [],
    };
  } catch (error) {
    console.warn("Failed to read dashboard workout cards cache:", error);
    return null;
  }
};

const writeWorkoutCardsCache = (
  userId: string,
  payload: Omit<WorkoutCardsCachePayload, "timestamp">,
): void => {
  if (typeof window === "undefined") return;
  try {
    const cachePayload: WorkoutCardsCachePayload = {
      timestamp: Date.now(),
      currentWorkoutCard: payload.currentWorkoutCard,
      allRecentWorkoutCards: payload.allRecentWorkoutCards,
      allNewlyCreatedWorkoutCards: payload.allNewlyCreatedWorkoutCards,
    };
    window.localStorage.setItem(
      getWorkoutCardsCacheKey(userId),
      JSON.stringify(cachePayload),
    );
  } catch (error) {
    console.warn("Failed to write dashboard workout cards cache:", error);
  }
};

export default function Home() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { userProfile } = useUserContext();
  const [height, setHeight] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [bmiResult, setBmiResult] = useState<number | null>(null);
  const [bmiCategory, setBmiCategory] = useState<string>("");
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isMetric, setIsMetric] = useState<boolean>(true);
  const [bmiModalOpen, setBmiModalOpen] = useState<boolean>(false);
  const [streakMetrics, setStreakMetrics] = useState<StreakMetrics>({
    currentStreakDays: 0,
    completedDaysThisWeek: 0,
  });
  const [isStreakLoading, setIsStreakLoading] = useState<boolean>(true);
  const [streakError, setStreakError] = useState<string | null>(null);
  const [currentWorkoutCard, setCurrentWorkoutCard] =
    useState<DashboardWorkoutCard | null>(null);
  const [allRecentWorkoutCards, setAllRecentWorkoutCards] = useState<
    DashboardWorkoutCard[]
  >([]);
  const [recentWorkoutCards, setRecentWorkoutCards] = useState<
    DashboardWorkoutCard[]
  >([]);
  const [newlyCreatedWorkoutCards, setNewlyCreatedWorkoutCards] = useState<
    DashboardWorkoutCard[]
  >([]);
  const [isWorkoutCardsLoading, setIsWorkoutCardsLoading] =
    useState<boolean>(true);
  const [workoutCardsError, setWorkoutCardsError] = useState<string | null>(
    null,
  );
  const [workoutCardsReloadKey, setWorkoutCardsReloadKey] = useState<number>(0);
  const [showWorkoutMoreDialog, setShowWorkoutMoreDialog] =
    useState<boolean>(false);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") return true;
    if (savedTheme === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

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
  }, []);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user?.id) {
      setStreakMetrics({ currentStreakDays: 0, completedDaysThisWeek: 0 });
      setStreakError(null);
      setIsStreakLoading(false);
      return;
    }

    let isCancelled = false;

    const fetchStreakMetrics = async () => {
      setIsStreakLoading(true);
      setStreakError(null);

      try {
        const { data, error } = await supabase
          .from("user_workout_sessions")
          .select("ended_at")
          .eq("user_id", user.id)
          .not("ended_at", "is", null)
          .order("ended_at", { ascending: false })
          .limit(2000);

        if (isCancelled) return;

        if (error) {
          throw error;
        }

        setStreakMetrics(
          calculateStreakMetrics((data || []) as CompletedSessionRow[]),
        );
      } catch (error) {
        if (isCancelled) return;
        console.error("Error loading home streak metrics:", error);
        setStreakError("Unable to load streak stats right now.");
        setStreakMetrics({ currentStreakDays: 0, completedDaysThisWeek: 0 });
      } finally {
        if (!isCancelled) {
          setIsStreakLoading(false);
        }
      }
    };

    void fetchStreakMetrics();

    return () => {
      isCancelled = true;
    };
  }, [isAuthLoading, user?.id]);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user?.id) {
      setCurrentWorkoutCard(null);
      setAllRecentWorkoutCards([]);
      setRecentWorkoutCards([]);
      setNewlyCreatedWorkoutCards([]);
      setWorkoutCardsError(null);
      setIsWorkoutCardsLoading(false);
      return;
    }

    const cachedWorkoutCards = readWorkoutCardsCache(user.id);
    const hasCachedCards = Boolean(
      cachedWorkoutCards?.currentWorkoutCard ||
        (cachedWorkoutCards?.allRecentWorkoutCards?.length || 0) > 0 ||
        (cachedWorkoutCards?.allNewlyCreatedWorkoutCards?.length || 0) > 0,
    );
    const isCacheFresh = Boolean(
      cachedWorkoutCards &&
        Date.now() - cachedWorkoutCards.timestamp <
          WORKOUT_CARDS_CACHE_DURATION_MS,
    );
    const shouldForceRefresh = workoutCardsReloadKey > 0;

    if (cachedWorkoutCards) {
      const cachedRecent = cachedWorkoutCards.allRecentWorkoutCards || [];
      const cachedNewlyCreated =
        cachedWorkoutCards.allNewlyCreatedWorkoutCards || [];
      setCurrentWorkoutCard(cachedWorkoutCards.currentWorkoutCard || null);
      setAllRecentWorkoutCards(cachedRecent);
      setRecentWorkoutCards(cachedRecent.slice(0, 3));
      setNewlyCreatedWorkoutCards(cachedNewlyCreated.slice(0, 3));
      setWorkoutCardsError(null);
      setIsWorkoutCardsLoading(false);
    }

    if (cachedWorkoutCards && isCacheFresh && !shouldForceRefresh) {
      return;
    }

    let isCancelled = false;

    const fetchDashboardWorkoutCards = async () => {
      if (!cachedWorkoutCards) {
        setIsWorkoutCardsLoading(true);
      }
      setWorkoutCardsError(null);

      try {
        const sessionResults = await Promise.allSettled([
          supabase
            .from("workout_sessions")
            .select("plan_id, started_at, ended_at")
            .eq("user_id", user.id)
            .order("started_at", { ascending: false })
            .limit(300),
          supabase
            .from("user_workout_sessions")
            .select("plan_id, started_at, ended_at")
            .eq("user_id", user.id)
            .order("started_at", { ascending: false })
            .limit(300),
        ]);

        if (isCancelled) return;

        const combinedSessions: Array<
          SessionActivityRow & { source: WorkoutSessionSource }
        > = [];
        let successfulSessionSources = 0;

        const collectSessions = (
          source: WorkoutSessionSource,
          result: PromiseSettledResult<{
            data: SessionActivityRow[] | null;
            error: { message?: string } | null;
          }>,
        ) => {
          if (result.status !== "fulfilled") {
            console.error(`Failed to read ${source} sessions:`, result.reason);
            return;
          }

          if (result.value.error) {
            console.error(
              `Failed to read ${source} sessions:`,
              result.value.error,
            );
            return;
          }

          successfulSessionSources += 1;
          (result.value.data || []).forEach((session) => {
            if (!session.plan_id) return;
            const activityAt = getActivityAt(session);
            if (!activityAt) return;
            combinedSessions.push({ ...session, source });
          });
        };

        collectSessions("workout", sessionResults[0]);
        collectSessions("user_workout", sessionResults[1]);

        if (successfulSessionSources === 0) {
          console.error("Failed to read all workout session sources.");
        }

        const workoutPlanIds = Array.from(
          new Set(
            combinedSessions
              .filter((session) => session.source === "workout")
              .map((session) => session.plan_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );
        const userWorkoutPlanIds = Array.from(
          new Set(
            combinedSessions
              .filter((session) => session.source === "user_workout")
              .map((session) => session.plan_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );

        const planFetchResults = await Promise.allSettled([
          workoutPlanIds.length > 0
            ? supabase
                .from("workout_plans")
                .select("id, name, image_path, image_alt, category, duration_days")
                .in("id", workoutPlanIds)
            : Promise.resolve({ data: [], error: null }),
          userWorkoutPlanIds.length > 0
            ? supabase
                .from("user_workout_plans")
                .select("id, name, image_path, image_alt, category, duration_days")
                .in("id", userWorkoutPlanIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (isCancelled) return;

        const workoutPlanMap = new Map<string, WorkoutPlanLookupRow>();
        const userWorkoutPlanMap = new Map<string, WorkoutPlanLookupRow>();

        const collectPlans = (
          source: WorkoutSessionSource,
          result: PromiseSettledResult<{
            data: WorkoutPlanLookupRow[] | null;
            error: { message?: string } | null;
          }>,
        ) => {
          if (result.status !== "fulfilled") {
            console.error(`Failed to read ${source} plans:`, result.reason);
            return;
          }
          if (result.value.error) {
            console.error(`Failed to read ${source} plans:`, result.value.error);
            return;
          }

          const targetMap =
            source === "workout" ? workoutPlanMap : userWorkoutPlanMap;
          (result.value.data || []).forEach((plan) => {
            targetMap.set(plan.id, plan);
          });
        };

        collectPlans("workout", planFetchResults[0]);
        collectPlans("user_workout", planFetchResults[1]);

        const timelineCards: DashboardWorkoutCard[] = combinedSessions.map(
          (session) => {
            const plan =
              session.source === "workout"
                ? workoutPlanMap.get(session.plan_id as string)
                : userWorkoutPlanMap.get(session.plan_id as string);

            const activityAt = getActivityAt(session) || new Date(0).toISOString();

            return {
              key: `${session.source}:${session.plan_id}`,
              source: session.source,
              planId: session.plan_id as string,
              planName: cleanPlanName(plan?.name || "Workout Plan"),
              imagePath: plan?.image_path || null,
              imageAlt: plan?.image_alt || null,
              category: plan?.category || null,
              durationDays: plan?.duration_days ?? null,
              startedAt: session.started_at,
              endedAt: session.ended_at,
              activityAt,
              isActive: !session.ended_at,
            };
          },
        );

        const sortedByActivity = [...timelineCards].sort(
          (a, b) => toTimestamp(b.activityAt) - toTimestamp(a.activityAt),
        );
        const sortedActive = timelineCards
          .filter((card) => card.isActive)
          .sort(
            (a, b) =>
              toTimestamp(b.startedAt || b.activityAt) -
              toTimestamp(a.startedAt || a.activityAt),
          );

        const currentCard =
          sortedActive[0] ||
          sortedByActivity.find((card) => !card.isActive) ||
          null;

        const seenPlanKeys = new Set<string>();
        const dedupedRecent = sortedByActivity.filter((card) => {
          if (seenPlanKeys.has(card.key)) return false;
          seenPlanKeys.add(card.key);
          return true;
        });

        const recentCards = dedupedRecent
          .filter((card) => card.key !== currentCard?.key)
          .slice(0, 3);
        const allRecentCards = dedupedRecent.filter(
          (card) => card.key !== currentCard?.key,
        );

        const newlyCreatedPlanResults = await Promise.allSettled([
          supabase
            .from("user_workout_plans")
            .select(
              "id, name, image_path, image_alt, category, duration_days, created_at",
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(40),
          supabase
            .from("workout_plans")
            .select(
              "id, name, image_path, image_alt, category, duration_days, created_at",
            )
            .order("created_at", { ascending: false })
            .limit(40),
        ]);

        if (isCancelled) return;

        let newlyCreatedPlansReadFailed = false;

        const collectCreatedPlans = (
          source: WorkoutSessionSource,
          result: PromiseSettledResult<{
            data: WorkoutPlanCreatedRow[] | null;
            error: { message?: string } | null;
          }>,
        ): DashboardWorkoutCard[] => {
          if (result.status !== "fulfilled") {
            newlyCreatedPlansReadFailed = true;
            console.error(`Failed to read newly created ${source} plans:`, result.reason);
            return [];
          }

          if (result.value.error) {
            newlyCreatedPlansReadFailed = true;
            console.error(
              `Failed to read newly created ${source} plans:`,
              result.value.error,
            );
            return [];
          }

          return ((result.value.data || []) as WorkoutPlanCreatedRow[]).map((plan) => {
            const createdAt = plan.created_at || new Date(0).toISOString();
            return {
              key: `${source}:${plan.id}`,
              source,
              planId: plan.id,
              planName: cleanPlanName(plan.name || "Workout Plan"),
              imagePath: plan.image_path || null,
              imageAlt: plan.image_alt || null,
              category: plan.category || null,
              durationDays: plan.duration_days ?? null,
              startedAt: null,
              endedAt: null,
              activityAt: createdAt,
              isActive: false,
            } satisfies DashboardWorkoutCard;
          });
        };

        const createdUserWorkoutCards = collectCreatedPlans(
          "user_workout",
          newlyCreatedPlanResults[0],
        );
        const createdWorkoutCards = collectCreatedPlans(
          "workout",
          newlyCreatedPlanResults[1],
        );

        const recentPlanKeys = new Set(allRecentCards.map((card) => card.key));
        const seenNewlyCreatedKeys = new Set<string>();
        const allNewlyCreatedCards = [...createdUserWorkoutCards, ...createdWorkoutCards]
          .sort((a, b) => toTimestamp(b.activityAt) - toTimestamp(a.activityAt))
          .filter((card) => !recentPlanKeys.has(card.key))
          .filter((card) => card.key !== currentCard?.key)
          .filter((card) => {
            if (seenNewlyCreatedKeys.has(card.key)) return false;
            seenNewlyCreatedKeys.add(card.key);
            return true;
          });

        const newlyCreatedCards = allNewlyCreatedCards.slice(0, 3);

        if (
          !hasCachedCards &&
          successfulSessionSources === 0 &&
          newlyCreatedPlansReadFailed
        ) {
          setWorkoutCardsError("Unable to load workout cards right now.");
        }

        setCurrentWorkoutCard(currentCard);
        setAllRecentWorkoutCards(allRecentCards);
        setRecentWorkoutCards(recentCards);
        setNewlyCreatedWorkoutCards(newlyCreatedCards);
        writeWorkoutCardsCache(user.id, {
          currentWorkoutCard: currentCard,
          allRecentWorkoutCards: allRecentCards,
          allNewlyCreatedWorkoutCards: allNewlyCreatedCards,
        });
        setIsWorkoutCardsLoading(false);
      } catch (error) {
        console.error("Failed to refresh dashboard workout cards:", error);
        if (!hasCachedCards) {
          setWorkoutCardsError("Unable to load workout cards right now.");
        }
        setIsWorkoutCardsLoading(false);
      }
    };

    void fetchDashboardWorkoutCards();

    return () => {
      isCancelled = true;
    };
  }, [isAuthLoading, user?.id, workoutCardsReloadKey]);

  const weeklyGoal = useMemo(() => {
    const goal = userProfile?.weekly_frequency?.length || DEFAULT_WEEKLY_GOAL;
    return Math.max(1, goal);
  }, [userProfile?.weekly_frequency]);

  const weeklyProgressPercent = useMemo(() => {
    if (isStreakLoading || weeklyGoal <= 0) return 0;
    return Math.min(
      100,
      Math.round((streakMetrics.completedDaysThisWeek / weeklyGoal) * 100),
    );
  }, [isStreakLoading, streakMetrics.completedDaysThisWeek, weeklyGoal]);

  const dialogRecentWorkoutCards = useMemo(
    () => allRecentWorkoutCards.slice(0, 6),
    [allRecentWorkoutCards],
  );

  const calculateBMI = (): void => {
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);

    if (
      isNaN(heightNum) ||
      isNaN(weightNum) ||
      heightNum <= 0 ||
      weightNum <= 0
    ) {
      return;
    }

    setIsCalculating(true);

    setTimeout(() => {
      let heightInMeters: number;
      let weightInKg: number;

      if (isMetric) {
        heightInMeters = heightNum / 100;
        weightInKg = weightNum;
      } else {
        heightInMeters = heightNum * 0.0254;
        weightInKg = weightNum * 0.453592;
      }

      const bmi = weightInKg / (heightInMeters * heightInMeters);
      const rounded = parseFloat(bmi.toFixed(1));
      setBmiResult(rounded);

      if (rounded < 18.5) setBmiCategory("Underweight");
      else if (rounded < 25) setBmiCategory("Normal weight");
      else if (rounded < 30) setBmiCategory("Overweight");
      else setBmiCategory("Obese");

      setIsCalculating(false);
      setBmiModalOpen(true);
    }, 300);
  };

  const getBMICategoryColor = (): string => {
    if (!bmiCategory) return "#6b7280";
    if (bmiCategory === "Underweight") return "#f59e0b";
    if (bmiCategory === "Normal weight") return "#10b981";
    if (bmiCategory === "Overweight") return "#f59e0b";
    return "#ef4444";
  };

  const getBMICategoryBackground = (): string => {
    if (!bmiCategory) return "#f3f4f6";
    if (bmiCategory === "Underweight") return "#fef3c7";
    if (bmiCategory === "Normal weight") return "#d1fae5";
    if (bmiCategory === "Overweight") return "#fef3c7";
    return "#fee2e2";
  };

  const getBMIHealthTip = (): string => {
    if (!bmiCategory) return "";
    if (bmiCategory === "Underweight")
      return "Consider consulting a nutritionist to reach a healthy weight.";
    if (bmiCategory === "Normal weight")
      return "Great! Maintain your healthy lifestyle.";
    if (bmiCategory === "Overweight")
      return "Consider a balanced diet and regular exercise.";
    return "Please consult a healthcare professional for guidance.";
  };

  const convertToMetric = (): void => {
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);
    if (!isNaN(heightNum) && heightNum > 0) {
      const heightInCm = heightNum * 2.54;
      setHeight(heightInCm.toFixed(1));
    }
    if (!isNaN(weightNum) && weightNum > 0) {
      const weightInKg = weightNum * 0.453592;
      setWeight(weightInKg.toFixed(1));
    }
    setIsMetric(true);
    setBmiResult(null);
    setBmiCategory("");
  };

  const convertToImperial = (): void => {
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);
    if (!isNaN(heightNum) && heightNum > 0) {
      const heightInInches = heightNum * 0.393701;
      setHeight(heightInInches.toFixed(1));
    }
    if (!isNaN(weightNum) && weightNum > 0) {
      const weightInLbs = weightNum * 2.20462;
      setWeight(weightInLbs.toFixed(1));
    }
    setIsMetric(false);
    setBmiResult(null);
    setBmiCategory("");
  };

  const canCalculate = (): boolean => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    return !isNaN(h) && !isNaN(w) && h > 0 && w > 0 && !isCalculating;
  };

  const handleCloseBmiModal = (): void => {
    setBmiModalOpen(false);
    setHeight("");
    setWeight("");
    setBmiResult(null);
    setBmiCategory("");
  };

  const handleThemeToggle = (): void => {
    const root = document.documentElement;
    const nextTheme = root.classList.contains("dark") ? "light" : "dark";

    root.classList.remove("light", "dark");
    root.classList.add(nextTheme);
    localStorage.setItem("theme", nextTheme);
    setIsDarkTheme(nextTheme === "dark");
  };

  const handleWorkoutCardPress = (card: DashboardWorkoutCard): void => {
    if (card.source === "workout") {
      router.push(`/workouts/details?id=${card.planId}`);
      return;
    }
    router.push(`/personal/workout/details?id=${card.planId}`);
  };

  const handleRetryWorkoutCards = (): void => {
    setWorkoutCardsReloadKey((prev) => prev + 1);
  };

  const handleOpenWorkoutMoreDialog = (): void => {
    setShowWorkoutMoreDialog(true);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827]">
      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-5 py-4 sm:py-6">
        {/* App Header */}
        <div className="mb-4 -ml-1 -mt-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Image
                src="/images/Logo_VitalSpark.png"
                alt="VitalSpark"
                width={28}
                height={28}
                className="object-contain"
              />
              <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-300">
                VitalSpark by Ferdie
              </span>
            </div>
            <div className="flex items-center gap-2 -pr-16">
              <button
                type="button"
                onClick={handleThemeToggle}
                aria-label={isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
                title={isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
                className="inline-flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-white text-slate-600 shadow-sm hover:bg-slate-50 transition-colors dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {isDarkTheme ? (
                  <HiSun className="w-4 h-4" />
                ) : (
                  <HiMoon className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => router.replace("/auth/logout")}
                className="inline-flex items-center justify-center px-3 h-8 rounded-full bg-white text-slate-600 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <HiArrowRightOnRectangle className="w-4 h-4 mr-1" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Header */}
        <div className="mb-5 sm:mb-6">
          <div className="mb-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0f766e] dark:text-teal-300 mb-1">
              Dashboard
            </h2>
            <p className="text-sm sm:text-base text-[#737373] dark:text-slate-400">
              Track your progress and stay healthy
            </p>
          </div>
          <div className="h-1 bg-[#f59e0b] dark:bg-amber-400 rounded-full w-16 mt-1" />
        </div>

        {/* Streak Card */}
        <div className="mb-5 sm:mb-6">
          <div className="bg-gradient-to-b from-[#fbbf24] via-[#f59e0b] to-[#f97316] dark:from-amber-600 dark:via-orange-600 dark:to-rose-600 rounded-xl p-3.5 sm:p-5 shadow-lg dark:shadow-black/40">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div className="flex items-center min-w-0">
                <div className="bg-white/25 rounded-lg p-1.5 mr-2">
                  <HiFire className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-white text-[11px] sm:text-xs font-extrabold tracking-wide uppercase">
                  Current Streak
                </span>
              </div>
              <div className="flex items-end shrink-0">
                <span className="text-2xl sm:text-3xl font-black text-white leading-none">
                  {isStreakLoading ? "--" : streakMetrics.currentStreakDays}
                </span>
                <span className="text-xs sm:text-sm text-white font-semibold ml-1">
                  days
                </span>
                <span className="text-xs sm:text-sm ml-1">{"\uD83D\uDD25"}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 mb-3">
              <span className="text-white text-xs sm:text-sm font-semibold">
                Weekly Goal: {weeklyGoal} session{weeklyGoal === 1 ? "" : "s"}
              </span>
              <span className="text-white text-xs sm:text-sm font-bold">
                {isStreakLoading
                  ? "-- / -- done"
                  : `${streakMetrics.completedDaysThisWeek} / ${weeklyGoal} done`}
              </span>
            </div>

            <div className="h-1.5 bg-white/30 rounded-full mb-3 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${weeklyProgressPercent}%` }}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <button className="w-full sm:w-auto justify-center bg-white/95 hover:bg-white dark:bg-slate-900/90 dark:hover:bg-slate-900 rounded-lg px-3.5 sm:px-5 py-2 sm:py-2.5 flex items-center gap-2 border border-white/80 dark:border-slate-700 shadow-md transition-colors">
                <HiArrowRightCircle className="w-3.5 h-3.5 text-[#f59e0b] dark:text-amber-300" />
                <span className="font-extrabold text-xs sm:text-sm text-[#f59e0b] dark:text-amber-300">
                  Keep it going
                </span>
              </button>
              <p className="text-white text-[11px] sm:text-xs opacity-90 w-full sm:flex-1 sm:ml-2 leading-relaxed">
                {streakError
                  ? streakError
                  : isStreakLoading
                    ? "Loading streak stats..."
                    : `Next session boosts your streak to ${streakMetrics.currentStreakDays + 1} days.`}
              </p>
            </div>
          </div>
        </div>

        {/* Current + Recent Workout Cards */}
        <div className="mb-5 sm:mb-6">
          {isWorkoutCardsLoading ? (
            <div className="bg-white dark:bg-slate-800/80 dark:border dark:border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 shadow-md">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 dark:border-teal-400" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Loading workout cards...
              </p>
            </div>
          ) : workoutCardsError ? (
            <div className="bg-white dark:bg-slate-800/80 dark:border dark:border-slate-700 rounded-2xl p-6 shadow-md">
              <p className="text-sm font-semibold text-red-600 dark:text-red-300 mb-3">
                {workoutCardsError}
              </p>
              <button
                type="button"
                onClick={handleRetryWorkoutCards}
                className="inline-flex items-center px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs sm:text-sm font-bold transition-colors"
              >
                Retry
              </button>
            </div>
          ) : !currentWorkoutCard &&
            recentWorkoutCards.length === 0 &&
            newlyCreatedWorkoutCards.length === 0 ? (
            <div className="bg-white dark:bg-slate-800/80 dark:border dark:border-slate-700 rounded-2xl p-6 shadow-md">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                No recent workout activity yet.
              </p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4">
                Start a workout and your current/recent plan cards will appear
                here.
              </p>
              <button
                type="button"
                onClick={() => router.push("/personal")}
                className="inline-flex items-center px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs sm:text-sm font-bold transition-colors"
              >
                Go to Personal Workouts
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {currentWorkoutCard && (
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 mb-2.5">
                    Current Workout
                  </p>
                  <button
                    type="button"
                    onClick={() => handleWorkoutCardPress(currentWorkoutCard)}
                    className="w-full text-left bg-white dark:bg-slate-800/80 dark:border dark:border-slate-700 rounded-2xl overflow-hidden border border-teal-200 dark:border-teal-700 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="relative h-36 sm:h-40 bg-slate-100 dark:bg-slate-700">
                      <Image
                        src={currentWorkoutCard.imagePath || FALLBACK_WORKOUT_IMAGE}
                        alt={currentWorkoutCard.imageAlt || currentWorkoutCard.planName}
                        fill
                        sizes="(min-width: 1024px) 768px, 100vw"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
                      <span className="absolute top-3 left-3 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase bg-white/95 text-teal-700">
                        Current
                      </span>
                      <span className="absolute top-3 right-3 inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold uppercase bg-black/50 text-white">
                        {currentWorkoutCard.source === "workout"
                          ? "Standard"
                          : "Personal"}
                      </span>
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="text-white text-sm sm:text-base font-extrabold line-clamp-2">
                          {currentWorkoutCard.planName}
                        </p>
                      </div>
                    </div>
                    <div className="p-3.5">
                      <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
                        {currentWorkoutCard.isActive
                          ? "Active now"
                          : `Last active ${formatShortDate(currentWorkoutCard.activityAt)}`}
                      </p>
                      <p className="text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                        Session day:{" "}
                        {formatSessionDayLabel(
                          currentWorkoutCard.startedAt || currentWorkoutCard.activityAt,
                        )}
                      </p>
                    </div>
                  </button>
                </div>
              )}

              {recentWorkoutCards.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">
                      Recent Workouts
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenWorkoutMoreDialog}
                      className="text-xs sm:text-sm font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200 transition-colors"
                    >
                      View More
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {recentWorkoutCards.map((card) => (
                      <button
                        key={card.key}
                        type="button"
                        onClick={() => handleWorkoutCardPress(card)}
                        className="text-left bg-white dark:bg-slate-800/80 dark:border dark:border-slate-700 rounded-xl overflow-hidden border border-slate-100 shadow-xs hover:shadow-md transition-all"
                      >
                        <div className="relative h-24 bg-slate-100 dark:bg-slate-700">
                          <Image
                            src={card.imagePath || FALLBACK_WORKOUT_IMAGE}
                            alt={card.imageAlt || card.planName}
                            fill
                            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                            className="object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                          <span className="absolute top-2 right-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase bg-black/50 text-white">
                            {card.source === "workout" ? "Standard" : "Personal"}
                          </span>
                        </div>
                        <div className="p-3">
                          <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-2 mb-1">
                            {card.planName}
                          </p>
                          <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
                            Last active {formatShortDate(card.activityAt)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {newlyCreatedWorkoutCards.length > 0 && (
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 mb-2.5">
                    Newly Created Workouts
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {newlyCreatedWorkoutCards.map((card) => (
                      <button
                        key={`new-${card.key}`}
                        type="button"
                        onClick={() => handleWorkoutCardPress(card)}
                        className="text-left bg-white dark:bg-slate-800/80 dark:border dark:border-slate-700 rounded-xl overflow-hidden border border-slate-100 shadow-xs hover:shadow-md transition-all"
                      >
                        <div className="relative h-24 bg-slate-100 dark:bg-slate-700">
                          <Image
                            src={card.imagePath || FALLBACK_WORKOUT_IMAGE}
                            alt={card.imageAlt || card.planName}
                            fill
                            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                            className="object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                          <span className="absolute top-2 left-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase bg-teal-600/90 text-white">
                            New
                          </span>
                          <span className="absolute top-2 right-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase bg-black/50 text-white">
                            {card.source === "workout" ? "Standard" : "Personal"}
                          </span>
                        </div>
                        <div className="p-3">
                          <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-2 mb-1">
                            {card.planName}
                          </p>
                          <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
                            Created {formatShortDate(card.activityAt)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BMI Calculator Card */}
        <div className="bg-white dark:bg-slate-800/80 dark:border dark:border-slate-700 rounded-2xl shadow-lg p-4 sm:p-6 mb-5">
          <div className="flex items-center mb-5 sm:mb-6">
            <div className="bg-[#ccfbf1] dark:bg-teal-900/50 rounded-lg p-2 sm:p-2.5 mr-3">
              <HiHeart className="w-5 h-5 sm:w-6 sm:h-6 text-[#0f766e] dark:text-teal-300" />
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
              BMI Calculator
            </h3>
          </div>

          {/* Unit Toggle */}
          <div className="flex justify-center mb-5 sm:mb-6">
            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">
              <button
                onClick={convertToMetric}
                className={`px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-bold transition-colors ${
                  isMetric
                    ? "bg-[#0f766e] dark:bg-teal-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                Metric
              </button>
              <button
                onClick={convertToImperial}
                className={`px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-bold transition-colors border-l border-gray-200 dark:border-slate-700 ${
                  !isMetric
                    ? "bg-[#0f766e] dark:bg-teal-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                Imperial
              </button>
            </div>
          </div>

          {/* Input Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 mb-5">
            {/* Height Input */}
            <div>
              <div className="flex items-center mb-2">
                <HiArrowsUpDown className="w-4 h-4 text-gray-600 dark:text-slate-300 mr-2" />
                <label className="text-sm font-bold text-gray-700 dark:text-slate-200">
                  Height
                </label>
              </div>
              <div
                className={`flex items-center bg-gray-50 dark:bg-slate-900 rounded-xl border-2 px-3 transition-colors ${
                  height ? "border-[#0f766e] dark:border-teal-400" : "border-gray-200 dark:border-slate-700"
                }`}
              >
                <input
                  type="number"
                  placeholder="Enter height"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="flex-1 py-2.5 sm:py-3 text-sm text-slate-900 dark:text-slate-100 font-semibold bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <span className="text-sm text-gray-600 dark:text-slate-300 font-semibold ml-2">
                  {isMetric ? "cm" : "in"}
                </span>
              </div>
            </div>

            {/* Weight Input */}
            <div>
              <div className="flex items-center mb-2">
                <HiBars3BottomLeft className="w-4 h-4 text-gray-600 dark:text-slate-300 mr-2" />
                <label className="text-sm font-bold text-gray-700 dark:text-slate-200">
                  Weight
                </label>
              </div>
              <div
                className={`flex items-center bg-gray-50 dark:bg-slate-900 rounded-xl border-2 px-3 transition-colors ${
                  weight ? "border-[#0f766e] dark:border-teal-400" : "border-gray-200 dark:border-slate-700"
                }`}
              >
                <input
                  type="number"
                  placeholder="Enter weight"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="flex-1 py-2.5 sm:py-3 text-sm text-slate-900 dark:text-slate-100 font-semibold bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <span className="text-sm text-gray-600 dark:text-slate-300 font-semibold ml-2">
                  {isMetric ? "kg" : "lbs"}
                </span>
              </div>
            </div>
          </div>

          {/* Calculate Button */}
          <button
            onClick={calculateBMI}
            disabled={!canCalculate()}
            className={`w-full rounded-xl py-3 sm:py-4 flex items-center justify-center gap-2 font-extrabold text-sm sm:text-base transition-all ${
              canCalculate()
                ? "bg-[#0f766e] hover:bg-[#0d6b63] dark:bg-teal-500 dark:hover:bg-teal-400 text-white shadow-lg hover:shadow-xl"
                : "bg-gray-300 text-gray-500 dark:bg-slate-700 dark:text-slate-400 cursor-not-allowed"
            }`}
          >
            {isCalculating ? (
              <>
                <Loader size="sm" inline />
                <span>Calculating...</span>
              </>
            ) : (
              <>
                <HiCalculator className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Calculate BMI</span>
              </>
            )}
          </button>
        </div>
      </main>

      {/* View More Workout Dialog */}
      <Dialog
        visible={showWorkoutMoreDialog}
        onDismiss={() => setShowWorkoutMoreDialog(false)}
        dismissible={true}
        maxWidth={980}
      >
        <div className="text-slate-900 dark:text-slate-100">
          <h3 className="text-lg sm:text-xl font-extrabold mb-3">
            Recent Workouts
          </h3>
          {dialogRecentWorkoutCards.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dialogRecentWorkoutCards.map((card) => (
                <button
                  key={`dialog-${card.key}-${card.activityAt}`}
                  type="button"
                  onClick={() => {
                    setShowWorkoutMoreDialog(false);
                    handleWorkoutCardPress(card);
                  }}
                  className="w-full text-left bg-white dark:bg-slate-800/80 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-xs hover:shadow-md transition-all"
                >
                  <div className="relative h-24 bg-slate-100 dark:bg-slate-700">
                    <Image
                      src={card.imagePath || FALLBACK_WORKOUT_IMAGE}
                      alt={card.imageAlt || card.planName}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                    <span className="absolute top-2 right-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase bg-black/50 text-white">
                      {card.source === "workout" ? "Standard" : "Personal"}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-2 mb-1">
                      {card.planName}
                    </p>
                    <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
                      Last active {formatShortDate(card.activityAt)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                No recent workouts available.
              </p>
            </div>
          )}
        </div>
      </Dialog>

      {/* BMI Result Modal */}
      <Dialog
        visible={bmiModalOpen}
        onDismiss={handleCloseBmiModal}
        dismissible={true}
        maxWidth={500}
        showCloseButton={false}
      >
        <div className="text-slate-900 dark:text-slate-100">
          {/* Header */}
          <div className="flex items-center pb-3 mb-3 border-b border-gray-200 dark:border-slate-700">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mr-3"
              style={{ backgroundColor: getBMICategoryBackground() }}
            >
              <HiHeart
                className="w-4 h-4"
                style={{ color: getBMICategoryColor() }}
              />
            </div>
            <div className="flex-1">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
                Your BMI Result
              </h3>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-0.5">Body Mass Index</p>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-3.5 max-h-[60vh] overflow-y-auto">
            {/* BMI Score */}
            <div className="bg-gray-50 dark:bg-slate-900/70 rounded-xl p-5 text-center">
              <p
                className="text-4xl sm:text-5xl font-black mb-1"
                style={{ color: getBMICategoryColor() }}
              >
                {bmiResult}
              </p>
              <p className="text-sm text-gray-600 dark:text-slate-400 font-semibold">BMI Score</p>
            </div>

            {/* Classification */}
            <div className="bg-gray-50 dark:bg-slate-900/70 rounded-xl p-5 text-center">
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">Classification</p>
              <div
                className="inline-block px-3.5 py-1.5 rounded-full"
                style={{ backgroundColor: getBMICategoryBackground() }}
              >
                <p
                  className="text-sm font-extrabold tracking-wide"
                  style={{ color: getBMICategoryColor() }}
                >
                  {bmiCategory}
                </p>
              </div>
            </div>

            {/* Health Recommendation */}
            <div className="bg-gray-50 dark:bg-slate-900/70 rounded-xl p-4 sm:p-5">
              <div className="flex items-center mb-2">
                {bmiCategory === "Normal weight" ? (
                  <HiCheckCircle
                    className="w-4 h-4 mr-2"
                    style={{ color: getBMICategoryColor() }}
                  />
                ) : (
                  <HiInformationCircle
                    className="w-4 h-4 mr-2"
                    style={{ color: getBMICategoryColor() }}
                  />
                )}
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Health Recommendation
                </p>
              </div>
              <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
                {getBMIHealthTip()}
              </p>
            </div>

            {/* BMI Ranges */}
            <div>
              <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mb-3">
                BMI Ranges
              </p>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] mr-3" />
                  <span className="text-sm text-gray-600 dark:text-slate-300 flex-1">
                    Underweight
                  </span>
                  <span className="text-sm text-gray-600 dark:text-slate-300 font-semibold">
                    &lt; 18.5
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10b981] mr-3" />
                  <span className="text-sm text-gray-600 dark:text-slate-300 flex-1">
                    Normal weight
                  </span>
                  <span className="text-sm text-gray-600 dark:text-slate-300 font-semibold">
                    18.5 - 24.9
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] mr-3" />
                  <span className="text-sm text-gray-600 dark:text-slate-300 flex-1">
                    Overweight
                  </span>
                  <span className="text-sm text-gray-600 dark:text-slate-300 font-semibold">
                    25.0 - 29.9
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] mr-3" />
                  <span className="text-sm text-gray-600 dark:text-slate-300 flex-1">Obese</span>
                  <span className="text-sm text-gray-600 dark:text-slate-300 font-semibold">
                    {"\u2265"} 30.0
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-3 mt-3 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={handleCloseBmiModal}
              className="px-4 sm:px-5 py-2 sm:py-2.5 bg-blue-500 hover:bg-blue-600 dark:bg-teal-500 dark:hover:bg-teal-400 text-white rounded-lg font-bold text-sm transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

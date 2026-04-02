"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { useWorkoutContext } from "@/contexts/WorkoutContext";
import { useUserContext } from "@/contexts/UserContext";
import type {
  WorkoutPlanFull,
  WorkoutPlanExerciseWithDetails,
  WorkoutTag,
} from "@/types/Workout";
import {
  HiArrowLeft,
  HiClock,
  HiBolt,
  HiPlayCircle,
  HiMoon,
  HiArrowPath,
} from "react-icons/hi2";
import { FaDumbbell } from "react-icons/fa";
import { supabase } from "@/lib/api/supabase";

export default function WorkoutDetailsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("id");

  const { getWorkoutPlanFull, loadingState } = useWorkoutContext();
  const { userProfile } = useUserContext();
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlanFull | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"calendar" | "exercises">(
    "calendar",
  );
  const [isRefreshingPage, setIsRefreshingPage] = useState(false);
  const [completedSessionsCount, setCompletedSessionsCount] =
    useState<number>(0);
  const [programStartDate, setProgramStartDate] = useState<Date | null>(null);
  const [todayAnchorDate, setTodayAnchorDate] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });

  const durationDays = workoutPlan?.duration_days ?? 28;

  const handleRefreshPage = useCallback(() => {
    setIsRefreshingPage(true);
    window.location.reload();
  }, []);

  const isRestDay = useCallback(
    (day: number) => day % 7 === 3 || day % 7 === 6,
    [],
  );

  const getProgramDate = useCallback(
    (dayNumber: number): Date => {
      const anchorDate = programStartDate
        ? new Date(programStartDate)
        : new Date(todayAnchorDate);
      anchorDate.setHours(0, 0, 0, 0);
      anchorDate.setDate(anchorDate.getDate() + (Math.max(dayNumber, 1) - 1));
      return anchorDate;
    },
    [programStartDate, todayAnchorDate],
  );

  useEffect(() => {
    if (programStartDate) return;

    const syncTodayAnchor = () => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      setTodayAnchorDate(now);
    };

    syncTodayAnchor();

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextSync = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const delay = Math.max(1000, nextMidnight.getTime() - now.getTime());

      timeoutId = setTimeout(() => {
        syncTodayAnchor();
        scheduleNextSync();
      }, delay);
    };

    scheduleNextSync();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [programStartDate]);

  const getDayNameForProgramDay = useCallback(
    (dayNumber: number): string =>
      getProgramDate(dayNumber).toLocaleDateString("en-US", {
        weekday: "long",
      }),
    [getProgramDate],
  );

  const workoutDayNumbers = useMemo(
    () =>
      Array.from({ length: durationDays }, (_, index) => index + 1).filter(
        (day) => !isRestDay(day),
      ),
    [durationDays, isRestDay],
  );

  const completedDayNumbers = useMemo(() => {
    const completed = new Set<number>();
    const count = Math.max(
      0,
      Math.min(completedSessionsCount, workoutDayNumbers.length),
    );

    for (let index = 0; index < count; index++) {
      completed.add(workoutDayNumbers[index]);
    }

    return completed;
  }, [completedSessionsCount, workoutDayNumbers]);

  const startDayOffset = useMemo(() => {
    const dayOfWeek = getProgramDate(1).getDay(); // 0=Sun ... 6=Sat
    return (dayOfWeek + 6) % 7; // Monday-first index
  }, [getProgramDate]);

  const calendarCells = useMemo(() => {
    const cells: Array<
      | {
          type: "placeholder";
          key: string;
          dayOfMonth: number;
          dateLabel: string;
        }
      | {
          type: "day";
          key: string;
          day: number;
          dayOfMonth: number;
          dayAbbrev: string;
          dateLabel: string;
          isRestDay: boolean;
          isCompleted: boolean;
        }
    > = [];

    const firstProgramDate = getProgramDate(1);

    for (let i = 0; i < startDayOffset; i++) {
      const offsetFromFirst = startDayOffset - i;
      const previousDate = new Date(firstProgramDate);
      previousDate.setDate(firstProgramDate.getDate() - offsetFromFirst);
      const previousDateLabel = `${(previousDate.getMonth() + 1)
        .toString()
        .padStart(
          2,
          "0",
        )}/${previousDate.getDate().toString().padStart(2, "0")}`;

      cells.push({
        type: "placeholder",
        key: `placeholder-${i}`,
        dayOfMonth: previousDate.getDate(),
        dateLabel: previousDateLabel,
      });
    }

    for (let day = 1; day <= durationDays; day++) {
      const date = getProgramDate(day);
      const dayAbbrev = date.toLocaleDateString("en-US", { weekday: "short" });
      const dateLabel = `${(date.getMonth() + 1).toString().padStart(2, "0")}/${date
        .getDate()
        .toString()
        .padStart(2, "0")}`;

      cells.push({
        type: "day",
        key: `day-${day}`,
        day,
        dayOfMonth: date.getDate(),
        dayAbbrev,
        dateLabel,
        isRestDay: isRestDay(day),
        isCompleted: completedDayNumbers.has(day),
      });
    }

    return cells;
  }, [
    startDayOffset,
    durationDays,
    getProgramDate,
    isRestDay,
    completedDayNumbers,
  ]);

  const resolvedStartDay = useMemo(() => {
    if (workoutDayNumbers.length === 0) return null;

    const dayIndex = Math.min(
      Math.max(completedSessionsCount, 0),
      workoutDayNumbers.length - 1,
    );
    const dayNumber = workoutDayNumbers[dayIndex];

    return {
      week: Math.ceil(dayNumber / 7),
      day: getDayNameForProgramDay(dayNumber),
      dayNumber,
    };
  }, [completedSessionsCount, workoutDayNumbers, getDayNameForProgramDay]);

  const buildSessionPath = useCallback((): string | null => {
    if (!planId || !resolvedStartDay) return null;
    return `/workouts/exercise/session?id=${planId}&week=${resolvedStartDay.week}&day=${encodeURIComponent(resolvedStartDay.day)}&fullscreen=1`;
  }, [planId, resolvedStartDay]);

  const handleStartWorkout = useCallback(() => {
    const sessionPath = buildSessionPath();
    if (!sessionPath) return;

    router.push(sessionPath);
  }, [buildSessionPath, router]);

  const startWorkoutLabel = useMemo(() => {
    if (!resolvedStartDay) return "Start Workout";
    return `Start Workout Day ${resolvedStartDay.dayNumber} (${resolvedStartDay.day})`;
  }, [resolvedStartDay]);

  // Fetch completed sessions count for this user + plan
  useEffect(() => {
    if (!userProfile?.user_id || !planId) {
      setCompletedSessionsCount(0);
      setProgramStartDate(null);
      return;
    }

    let isCancelled = false;

    const fetchCompletedSessionsCount = async () => {
      const [completedResult, firstSessionResult] = await Promise.all([
        supabase
          .from("workout_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userProfile.user_id)
          .eq("plan_id", planId)
          .not("ended_at", "is", null),
        supabase
          .from("workout_sessions")
          .select("started_at")
          .eq("user_id", userProfile.user_id)
          .eq("plan_id", planId)
          .order("started_at", { ascending: true })
          .limit(1),
      ]);

      if (isCancelled) return;

      if (completedResult.error) {
        setCompletedSessionsCount(0);
      } else {
        setCompletedSessionsCount(completedResult.count || 0);
      }

      const firstSessionStart = firstSessionResult.data?.[0]?.started_at;
      if (firstSessionStart) {
        setProgramStartDate(new Date(firstSessionStart));
      } else {
        setProgramStartDate(null);
      }
    };

    fetchCompletedSessionsCount();

    return () => {
      isCancelled = true;
    };
  }, [userProfile?.user_id, planId]);

  // Normalize gender for image paths (only male/female images available)
  const normalizedGender = useMemo(() => {
    const gender = userProfile?.gender?.toLowerCase() || "male";
    if (gender === "female") return "female";
    // Default to male for: male, non-binary, other, prefer not to say, etc.
    return "male";
  }, [userProfile?.gender]);

  useEffect(() => {
    if (!planId) {
      router.push("/workouts");
      return;
    }

    const fetchWorkoutPlan = async () => {
      setIsLoading(true);
      try {
        const plan = await Promise.race([
          getWorkoutPlanFull(planId),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Loading workout timed out")), 15000),
          ),
        ]);
        setWorkoutPlan(plan);
      } catch (error) {
        console.error("Error fetching workout plan:", error);
        setWorkoutPlan(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkoutPlan();
  }, [planId, getWorkoutPlanFull, router]);

  const getLevelColor = useCallback((level: string): string => {
    const normalized = level.toLowerCase();
    if (normalized === "beginner") return "bg-green-500";
    if (normalized === "intermediate") return "bg-amber-500";
    if (normalized === "advanced") return "bg-red-500";
    return "bg-amber-500";
  }, []);

  const formatLevel = useCallback(
    (level: string): string =>
      level.charAt(0).toUpperCase() + level.slice(1).toLowerCase(),
    [],
  );

  const getRandomTagColor = useCallback(
    (index: number): { borderColor: string; textColor: string } => {
      const colors = [
        { borderColor: "#f59e0b", textColor: "#d97706" },
        { borderColor: "#14b8a6", textColor: "#0d9488" },
        { borderColor: "#0ea5e9", textColor: "#0284c7" },
        { borderColor: "#8b5cf6", textColor: "#7c3aed" },
        { borderColor: "#ec4899", textColor: "#db2777" },
        { borderColor: "#10b981", textColor: "#059669" },
      ];
      return colors[index % colors.length];
    },
    [],
  );

  const getExerciseImageUrl = useCallback(
    (section: string, imageSlug: string): string => {
      const baseUrl =
        "https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/exercises/";
      return `${baseUrl}${normalizedGender}/${section}/${imageSlug}.png`;
    },
    [normalizedGender],
  );

  const formatDuration = useCallback((seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }, []);

  const getSectionTitle = useCallback(
    (section: string, count: number): string => {
      if (section === "warmup") return "Warm Up";
      if (section === "main") return `Exercises (${count})`;
      if (section === "cooldown") return "Cool Down";
      return section;
    },
    [],
  );

  const formatSets = useCallback((sets: number): string => {
    return sets === 1 ? "1 set" : `${sets} sets`;
  }, []);

  const formatReps = useCallback((reps: number): string => {
    return reps === 1 ? "1 rep" : `${reps} reps`;
  }, []);

  // Group exercises by section
  const warmupExercises = useMemo(
    () => workoutPlan?.exercises?.filter((ex) => ex.section === "warmup") || [],
    [workoutPlan],
  );
  const mainExercises = useMemo(
    () => workoutPlan?.exercises?.filter((ex) => ex.section === "main") || [],
    [workoutPlan],
  );
  const cooldownExercises = useMemo(
    () =>
      workoutPlan?.exercises?.filter((ex) => ex.section === "cooldown") || [],
    [workoutPlan],
  );

  if (isLoading || (loadingState.isLoading && !workoutPlan)) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600" />
          <p className="text-sm font-bold text-teal-700 dark:text-teal-300">
            Loading workout details...
          </p>
        </div>
      </div>
    );
  }

  if (!workoutPlan) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827] flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-semibold text-red-600 dark:text-red-300 mb-4">
            Workout plan not found
          </p>
          <button
            onClick={() => router.push("/workouts")}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition-colors"
          >
            Back to Workouts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-40">
        {/* Hero Image */}
        <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden mb-6">
          {workoutPlan.image_path ? (
            <Image
              src={workoutPlan.image_path}
              alt={workoutPlan.image_alt || workoutPlan.name}
              fill
              className="object-cover"
            />
          ) : (
            <Image
              src="/images/onboarding_1.png"
              alt={workoutPlan.name || "Workout"}
              fill
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          {/* Top Left Actions */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <button
              onClick={() => router.push("/workouts")}
              className="bg-teal-700/70 hover:bg-teal-700 p-2 rounded-full transition-colors"
              aria-label="Back to workouts"
            >
              <HiArrowLeft className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={handleRefreshPage}
              disabled={isRefreshingPage}
              className="bg-white/20 hover:bg-white/30 dark:bg-slate-900/50 dark:hover:bg-slate-900/70 p-2 rounded-full transition-colors disabled:opacity-60"
              aria-label="Refresh page"
            >
              <HiArrowPath
                className={`w-4 h-4 text-white ${isRefreshingPage ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {/* Level Badge */}
          <div className="absolute top-4 right-4 z-10">
            <span
              className={`${getLevelColor(
                workoutPlan.level,
              )} text-white px-2.5 py-1 rounded-full text-[11px] font-bold`}
            >
              {formatLevel(workoutPlan.level)}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-6 shadow-sm dark:shadow-black/30 border border-slate-100 dark:border-slate-700 -mt-4 relative z-10">
          <h1 className="text-lg md:text-xl font-extrabold text-teal-700 mb-3">
            {workoutPlan.name}
          </h1>

          {/* Tags */}
          {workoutPlan.tags && workoutPlan.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {workoutPlan.tags.map((tag: WorkoutTag, index: number) => {
                const tagColor = getRandomTagColor(index);
                return (
                  <span
                    key={tag.id}
                    className="px-2.5 py-1 rounded-full text-[11px] font-bold border"
                    style={{
                      borderColor: tagColor.borderColor,
                      color: tagColor.textColor,
                    }}
                  >
                    {tag.name}
                  </span>
                );
              })}
            </div>
          )}

          {/* Stats */}
          {(workoutPlan.total_minutes || workoutPlan.total_calories) && (
            <div className="flex flex-wrap gap-4 mb-6 p-4 bg-teal-50/50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-xl">
              {workoutPlan.total_minutes && workoutPlan.total_minutes > 0 && (
                <div className="flex items-center gap-2">
                  <HiClock className="w-5 h-5 text-teal-600" />
                  <span className="text-sm font-bold text-teal-700">
                    {workoutPlan.total_minutes} mins
                  </span>
                </div>
              )}
              {workoutPlan.total_calories && workoutPlan.total_calories > 0 && (
                <div className="flex items-center gap-2">
                  <HiBolt className="w-5 h-5 text-amber-500" />
                  <span className="text-sm font-bold text-amber-600">
                    {workoutPlan.total_calories} kCal
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {workoutPlan.description && workoutPlan.description.trim() !== "" && (
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-5 leading-relaxed">
              {workoutPlan.description}
            </p>
          )}

          {/* Motivation */}
          {workoutPlan.motivation && workoutPlan.motivation.trim() !== "" && (
            <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl p-4 mb-6 border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-teal-700 dark:text-teal-300 italic text-center font-medium">
                &quot;{workoutPlan.motivation}&quot;
              </p>
            </div>
          )}

          {/* Tab section: Calendar | View Exercises */}
          <div className="mb-8">
            <h2 className="text-base font-extrabold text-teal-700 mb-3">
              Program
            </h2>
            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4">
              <button
                type="button"
                onClick={() => setActiveTab("calendar")}
                className={`px-3 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                  activeTab === "calendar"
                    ? "border-teal-600 text-teal-700"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                Calendar
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("exercises")}
                className={`px-3 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                  activeTab === "exercises"
                    ? "border-teal-600 text-teal-700"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                View Exercises
              </button>
            </div>

            {activeTab === "calendar" && (
              <div className="rounded-xl border-none p-3 sm:p-4">
                <div className="grid grid-cols-7 gap-2 sm:gap-3">
                  {calendarCells.map((cell) => {
                    if (cell.type === "placeholder") {
                      return (
                        <div
                          key={cell.key}
                          className="relative aspect-square min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80"
                          aria-label={`Previous date ${cell.dateLabel}`}
                        >
                          <span className="absolute top-2 left-2 text-xs font-bold text-slate-400 dark:text-slate-500">
                            {cell.dayOfMonth}
                          </span>
                          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] font-medium text-gray-300 dark:text-slate-600">
                            {cell.dateLabel}
                          </span>
                        </div>
                      );
                    }

                    const day = cell.day;
                    const isRestDay = cell.isRestDay;
                    const isCompleted = cell.isCompleted;
                    return (
                      <div
                        key={cell.key}
                        className={`relative aspect-square min-w-0 rounded-lg flex flex-col items-center justify-center ${
                          isRestDay
                            ? "border border-teal-200 dark:border-teal-800 bg-slate-100/30 dark:bg-slate-800/60"
                            : isCompleted
                              ? "border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/25 shadow-sm dark:shadow-black/20"
                              : "rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs"
                        }`}
                        aria-label={`${cell.dateLabel}${isRestDay ? ", rest day" : isCompleted ? ", completed" : ", not started"}`}
                      >
                        <div className="absolute top-0 left-0 right-0 rounded-t-lg border-b border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-900/25 px-1.5 py-1 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-teal-600 ml-0.5
                          ">
                            {cell.dayOfMonth}
                          </span>
                            <span className="text-[9px] font-bold text-red-500 dark:text-red-300 mt-0.5">
                              {cell.dayAbbrev}
                            </span>
                        </div>
                        {isRestDay ? (
                          <div className="flex flex-col items-center gap-0.5 mt-3">
                            <HiMoon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 dark:text-amber-300" />
                            <span className="text-[10px] sm:text-xs font-medium text-amber-600 dark:text-amber-300">
                              Rest
                            </span>
                          </div>
                        ) : isCompleted ? (
                          <div className="flex flex-col items-center gap-0.5 mt-2">
                              <FaDumbbell className="w-5 h-5 sm:w-6 sm:h-6 text-teal-500 dark:text-teal-300" />
                              <span className="text-[10px] sm:text-xs font-semibold text-teal-700 dark:text-teal-300">
                                Done
                              </span>
                          </div>
                        ) : (
                            <span className="text-[9px] sm:text-xs font-medium text-center leading-tight mt-3 break-words line-clamp-2 text-slate-400 dark:text-slate-500">
                              Not started
                            </span>
                        )}
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-medium text-teal-700 dark:text-teal-300">
                          Day {day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "exercises" && (
              <div className="space-y-6">
                {warmupExercises.length > 0 && (
                  <div>
                    <h3 className="text-sm font-extrabold text-teal-700 mb-2">
                      {getSectionTitle("warmup", warmupExercises.length)}
                    </h3>
                    <div className="space-y-3">
                      {warmupExercises.map((exercise, index) => (
                        <ExerciseRow
                          key={`warmup-${exercise.exercise_id}-${index}`}
                          exercise={exercise}
                          getExerciseImageUrl={getExerciseImageUrl}
                          formatSets={formatSets}
                          formatReps={formatReps}
                          formatDuration={formatDuration}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {mainExercises.length > 0 && (
                  <div>
                    <h3 className="text-sm font-extrabold text-teal-700 mb-2">
                      {getSectionTitle("main", mainExercises.length)}
                    </h3>
                    <div className="space-y-3">
                      {mainExercises.map((exercise, index) => (
                        <ExerciseRow
                          key={`main-${exercise.exercise_id}-${index}`}
                          exercise={exercise}
                          getExerciseImageUrl={getExerciseImageUrl}
                          formatSets={formatSets}
                          formatReps={formatReps}
                          formatDuration={formatDuration}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {cooldownExercises.length > 0 && (
                  <div>
                    <h3 className="text-sm font-extrabold text-teal-700 mb-2">
                      {getSectionTitle("cooldown", cooldownExercises.length)}
                    </h3>
                    <div className="space-y-3">
                      {cooldownExercises.map((exercise, index) => (
                        <ExerciseRow
                          key={`cooldown-${exercise.exercise_id}-${index}`}
                          exercise={exercise}
                          getExerciseImageUrl={getExerciseImageUrl}
                          formatSets={formatSets}
                          formatReps={formatReps}
                          formatDuration={formatDuration}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {(!workoutPlan.exercises ||
                  workoutPlan.exercises.length === 0) && (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <p>No exercises available for this workout plan.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Start Exercise Button - Above Bottom Nav Bar */}
      {workoutPlan.exercises && workoutPlan.exercises.length > 0 && (
        <div className="fixed bottom-[70px] left-0 right-0 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-black/40 backdrop-blur z-40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
            <button
              type="button"
              onClick={handleStartWorkout}
              disabled={!resolvedStartDay}
              className="w-full bg-gradient-to-r from-teal-600 to-teal-500 dark:from-teal-500 dark:to-teal-400 hover:from-teal-700 hover:to-teal-600 dark:hover:from-teal-400 dark:hover:to-teal-300 text-white rounded-xl py-3.5 px-6 font-bold text-base shadow-md hover:shadow-lg dark:shadow-black/40 transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <HiPlayCircle className="w-5 h-5" />
              <span>{startWorkoutLabel}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Exercise Row Component
function ExerciseRow({
  exercise,
  getExerciseImageUrl,
  formatSets,
  formatReps,
  formatDuration,
}: {
  exercise: WorkoutPlanExerciseWithDetails;
  getExerciseImageUrl: (section: string, imageSlug: string) => string;
  formatSets: (sets: number) => string;
  formatReps: (reps: number) => string;
  formatDuration: (seconds: number) => string;
}) {
  return (
    <div className="flex items-start gap-4 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md dark:hover:shadow-black/30 transition-shadow">
      {/* Exercise Image */}
      {exercise.exercise_details?.image_slug &&
      exercise.exercise_details.image_slug.trim() !== "" ? (
        <div className="shrink-0">
          <Image
            src={getExerciseImageUrl(
              exercise.section,
              exercise.exercise_details.image_slug,
            )}
            alt={exercise.exercise_details.name || "Exercise"}
            width={80}
            height={80}
            className="rounded-lg object-contain bg-slate-50 dark:bg-slate-700"
            unoptimized
          />
        </div>
      ) : (
        <div className="shrink-0 w-20 h-20 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
          <HiBolt className="w-8 h-8 text-slate-400 dark:text-slate-500" />
        </div>
      )}

      {/* Exercise Details */}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1 text-sm">
          {exercise.exercise_details?.name || "Exercise"}
        </h3>

        {exercise.exercise_details?.primary_muscle &&
          exercise.exercise_details.primary_muscle.trim() !== "" && (
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
              Target: {exercise.exercise_details.primary_muscle}
            </p>
          )}

        {/* Exercise Meta */}
        {(exercise.sets ||
          exercise.reps ||
          exercise.duration_seconds ||
          exercise.per_side) && (
          <div className="flex flex-wrap gap-2 mt-2">
            {exercise.sets && exercise.sets > 0 && (
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                {formatSets(exercise.sets)}
              </span>
            )}
            {exercise.reps && exercise.reps > 0 && (
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                {formatReps(exercise.reps)}
              </span>
            )}
            {exercise.duration_seconds && exercise.duration_seconds > 0 && (
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                {formatDuration(exercise.duration_seconds)}
              </span>
            )}
            {exercise.per_side && (
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                Each side
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

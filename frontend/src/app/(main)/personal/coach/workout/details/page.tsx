"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useUserContext } from "@/contexts/UserContext";
import { useCoachWorkoutData } from "@/hooks/useCoachWorkoutData";
import { supabase } from "@/lib/api/supabase";
import Toast from "@/components/Toast";
import type {
  CoachWorkoutPlan,
  CoachWorkoutDailyPlan,
  CoachWorkoutDailyPlanExerciseWithDetails,
} from "@/types/CoachWorkout";
import type { WorkoutTag } from "@/types/Workout";
import {
  HiArrowLeft,
  HiCalendar,
  HiClock,
  HiFire,
  HiSparkles,
  HiBolt,
  HiMoon,
  HiUser,
} from "react-icons/hi2";

interface CoachInfo {
  id: string;
  full_name: string;
  title: string | null;
  tagline: string | null;
  about: string | null;
  is_active: boolean | null;
}

export default function CoachWorkoutDetailsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("id");

  const { user } = useAuth();
  const { userProfile } = useUserContext();
  const {
    fetchCoachWorkoutPlanById,
    fetchDailyPlansForPlan,
    fetchExercisesForDailyPlanWithDetails,
    fetchTagsForPlan,
  } = useCoachWorkoutData();

  const [workoutPlan, setWorkoutPlan] = useState<CoachWorkoutPlan | null>(null);
  const [dailyPlans, setDailyPlans] = useState<CoachWorkoutDailyPlan[]>([]);
  const [planTags, setPlanTags] = useState<WorkoutTag[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedDayExercises, setSelectedDayExercises] = useState<
    CoachWorkoutDailyPlanExerciseWithDetails[]
  >([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState<boolean>(false);
  const [coachInfo, setCoachInfo] = useState<CoachInfo | null>(null);
  const [toasts, setToasts] = useState<
    { id: number; type: "success" | "error"; title: string; message: string }[]
  >([]);
  const toastIdRef = useRef(0);

  // Normalize gender for image paths
  const normalizedGender = useMemo(() => {
    const gender = userProfile?.gender?.toLowerCase() || "male";
    if (gender === "female" || gender === "f") return "female";
    return "male";
  }, [userProfile?.gender]);

  useEffect(() => {
    if (!planId) {
      router.push("/personal");
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch workout plan
        const planResult = await fetchCoachWorkoutPlanById(planId);
        if (planResult.success && planResult.data) {
          setWorkoutPlan(planResult.data);

          // Fetch daily plans for this workout plan
          const dailyPlansResult = await fetchDailyPlansForPlan(planId);
          if (dailyPlansResult.success && dailyPlansResult.data) {
            setDailyPlans(dailyPlansResult.data);
          }

          // Fetch tags for this plan
          const tagsResult = await fetchTagsForPlan(planId);
          if (tagsResult.success && tagsResult.data) {
            setPlanTags(tagsResult.data);
          }
        }
      } catch (error) {
        console.error("Error fetching coach workout data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [
    planId,
    fetchCoachWorkoutPlanById,
    fetchDailyPlansForPlan,
    fetchTagsForPlan,
    router,
  ]);

  // Fetch first active coach from coaches_info for "About Coach" card
  useEffect(() => {
    const fetchCoach = async () => {
      const { data, error } = await supabase
        .from("coaches_info")
        .select("id, full_name, title, tagline, about, is_active")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!error && data) setCoachInfo(data as CoachInfo);
    };
    fetchCoach();
  }, []);

  // Fetch exercises when a day is selected
  useEffect(() => {
    if (selectedDay === null) {
      setSelectedDayExercises([]);
      return;
    }

    const fetchExercises = async () => {
      setIsLoadingExercises(true);
      try {
        // Find the daily plan for the selected day
        const dailyPlan = dailyPlans.find((d) => d.day_number === selectedDay);

        if (dailyPlan?.id) {
          const result = await fetchExercisesForDailyPlanWithDetails(
            dailyPlan.id,
          );
          if (result.success && result.data) {
            setSelectedDayExercises(
              result.data as CoachWorkoutDailyPlanExerciseWithDetails[],
            );
          } else {
            setSelectedDayExercises([]);
          }
        } else {
          setSelectedDayExercises([]);
        }
      } catch (error) {
        console.error("Error fetching exercises:", error);
        setSelectedDayExercises([]);
      } finally {
        setIsLoadingExercises(false);
      }
    };

    fetchExercises();
  }, [selectedDay, dailyPlans, fetchExercisesForDailyPlanWithDetails]);

  // Calculate total weeks needed based on duration
  const totalWeeks = useMemo(() => {
    const durationDays =
      workoutPlan?.duration_days || workoutPlan?.number_of_weeks
        ? (workoutPlan.number_of_weeks || 1) * 7
        : 28;
    return Math.ceil(durationDays / 7);
  }, [workoutPlan?.duration_days, workoutPlan?.number_of_weeks]);

  // Total days in the plan
  const totalDays = useMemo(() => {
    return (
      workoutPlan?.duration_days || (workoutPlan?.number_of_weeks || 4) * 7
    );
  }, [workoutPlan?.duration_days, workoutPlan?.number_of_weeks]);

  // Create a map of day number to daily plan
  const dailyPlanMap = useMemo(() => {
    const map = new Map<number, CoachWorkoutDailyPlan>();
    dailyPlans.forEach((plan) => {
      map.set(plan.day_number, plan);
    });
    return map;
  }, [dailyPlans]);

  // Build calendar data for a specific week
  const getWeekCalendarData = useCallback(
    (weekNumber: number) => {
      const weekDays: {
        dayNumber: number;
        dayOfWeek: string;
        dayAbbrev: string;
        data: CoachWorkoutDailyPlan | null;
        isRestDay: boolean;
      }[] = [];

      const dayNames = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ];
      const dayAbbrev = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const dayNumber = (weekNumber - 1) * 7 + dayIndex + 1;
        if (dayNumber <= totalDays) {
          const dailyPlan = dailyPlanMap.get(dayNumber) || null;
          // If no daily plan exists for this day, it's a rest day
          const isRestDay = !dailyPlan;

          weekDays.push({
            dayNumber,
            dayOfWeek: dayNames[dayIndex],
            dayAbbrev: dayAbbrev[dayIndex],
            data: dailyPlan,
            isRestDay,
          });
        }
      }
      return weekDays;
    },
    [totalDays, dailyPlanMap],
  );

  const getRandomTagColor = useCallback(
    (
      index: number,
    ): { borderColor: string; textColor: string; bgColor: string } => {
      const colors = [
        { borderColor: "#f59e0b", textColor: "#d97706", bgColor: "#fef3c7" },
        { borderColor: "#14b8a6", textColor: "#0d9488", bgColor: "#ccfbf1" },
        { borderColor: "#0ea5e9", textColor: "#0284c7", bgColor: "#e0f2fe" },
        { borderColor: "#8b5cf6", textColor: "#7c3aed", bgColor: "#ede9fe" },
        { borderColor: "#ec4899", textColor: "#db2777", bgColor: "#fce7f3" },
        { borderColor: "#10b981", textColor: "#059669", bgColor: "#d1fae5" },
      ];
      return colors[index % colors.length];
    },
    [],
  );

  // Exercise helper functions
  const formatSets = useCallback((sets: number): string => {
    return sets === 1 ? "1 set" : `${sets} sets`;
  }, []);

  const formatReps = useCallback((reps: number): string => {
    return reps === 1 ? "1 rep" : `${reps} reps`;
  }, []);

  const formatDuration = useCallback((seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }, []);

  const getSectionTitle = useCallback(
    (section: string, count: number): string => {
      if (section === "warmup") return `Warm Up (${count})`;
      if (section === "main") return `Main Exercises (${count})`;
      if (section === "cooldown") return `Cool Down (${count})`;
      return section;
    },
    [],
  );

  const getExerciseImageUrl = useCallback(
    (imageSlug: string | null, imagePath: string | null): string => {
      if (imagePath) return imagePath;
      if (!imageSlug) return "";
      const baseUrl =
        "https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/exercises/";
      return `${baseUrl}${normalizedGender}/${imageSlug}.png`;
    },
    [normalizedGender],
  );

  // Group exercises by section
  const warmupExercises = useMemo(
    () => selectedDayExercises.filter((ex) => ex.section === "warmup"),
    [selectedDayExercises],
  );
  const mainExercises = useMemo(
    () => selectedDayExercises.filter((ex) => ex.section === "main"),
    [selectedDayExercises],
  );
  const cooldownExercises = useMemo(
    () => selectedDayExercises.filter((ex) => ex.section === "cooldown"),
    [selectedDayExercises],
  );

  // Format tag as Title Case
  const formatTagTitleCase = (tag: string) => {
    return tag
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Truncate text to first 2 sentences
  const truncateToTwoSentences = (text: string | null): string => {
    if (!text || !text.trim()) return "";
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    return sentences.slice(0, 2).join(" ").trim() || text;
  };

  const showToast = (
    type: "success" | "error",
    title: string,
    message: string,
  ) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };
  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const coachName = coachInfo?.full_name ?? "Coach";
  const coachTagline = coachInfo?.tagline ?? "";
  const coachDescription = truncateToTwoSentences(coachInfo?.about ?? null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600" />
          <p className="text-base font-bold text-teal-700">
            Loading coach workout details...
          </p>
        </div>
      </div>
    );
  }

  if (!workoutPlan) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center">
          <p className="text-base font-semibold text-red-600 mb-4">
            Coach workout plan not found
          </p>
          <button
            onClick={() => router.push("/personal")}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 transition-colors"
          >
            Back to Personal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Hero Image */}
        <div className="relative h-52 md:h-72 rounded-3xl overflow-hidden mb-6 shadow-lg">
          {workoutPlan.image_path ? (
            <Image
              src={workoutPlan.image_path}
              alt={workoutPlan.image_alt || workoutPlan.name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
              <span className="text-8xl opacity-80">🏋️</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

          {/* Back Button */}
          <button
            onClick={() => router.push("/personal")}
            className="absolute top-4 left-4 bg-white/20 backdrop-blur-sm hover:bg-white/30 p-2.5 rounded-full transition-all z-10"
          >
            <HiArrowLeft className="w-5 h-5 text-white" />
          </button>

          {/* Coach Badge */}
          <div className="absolute top-4 right-4 z-10">
            <span className="bg-orange-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide">
              Coach Workout
            </span>
          </div>

          {/* Plan Name & Tags Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
            <h1 className="text-2xl md:text-3xl font-extrabold text-white drop-shadow-lg mb-2">
              {workoutPlan.name}
            </h1>
            {/* Tags on Hero */}
            {planTags && planTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {planTags.slice(0, 3).map((tag, index) => (
                  <span
                    key={tag.id}
                    className="bg-white/20 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs font-semibold"
                  >
                    {formatTagTitleCase(tag.name)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats Bar - Single Row */}
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 mb-6">
          <div className="grid grid-cols-4 gap-2">
            {/* Weeks */}
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
              <HiCalendar className="w-5 h-5 text-orange-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">
                  {totalWeeks} {totalWeeks === 1 ? "Week" : "Weeks"}
                </p>
                <p className="text-[10px] text-slate-500">{totalDays} days</p>
              </div>
            </div>

            {/* Level */}
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
              <HiSparkles className="w-5 h-5 text-purple-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 capitalize truncate">
                  {workoutPlan.level || "All"}
                </p>
                <p className="text-[10px] text-slate-500">Level</p>
              </div>
            </div>

            {/* Duration */}
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
              <HiClock className="w-5 h-5 text-teal-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">
                  {workoutPlan.total_minutes || "--"} min
                </p>
                <p className="text-[10px] text-slate-500">Duration</p>
              </div>
            </div>

            {/* Calories */}
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
              <HiFire className="w-5 h-5 text-red-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">
                  {workoutPlan.total_calories || "--"} cal
                </p>
                <p className="text-[10px] text-slate-500">Calories</p>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {workoutPlan.description && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6">
            <h3 className="text-sm font-bold text-slate-700 mb-2">
              About This Plan
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {workoutPlan.description}
            </p>
          </div>
        )}

        {/* Motivation */}
        {workoutPlan.motivation && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-4 shadow-sm border border-orange-100 mb-6">
            <p className="text-sm text-orange-700 italic leading-relaxed">
              &ldquo;{workoutPlan.motivation}&rdquo;
            </p>
          </div>
        )}

        {/* Weekly Calendar Section Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center">
            <HiCalendar className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-800">
            Weekly Schedule
          </h2>
        </div>

        {/* Weekly Calendar */}
        <div className="space-y-5">
          {Array.from({ length: totalWeeks }, (_, weekIndex) => {
            const weekNumber = weekIndex + 1;
            const weekDays = getWeekCalendarData(weekNumber);
            const workoutDaysCount = weekDays.filter(
              (d) => !d.isRestDay,
            ).length;
            const restDaysCount = weekDays.filter((d) => d.isRestDay).length;

            return (
              <div
                key={weekNumber}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100"
              >
                {/* Week Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-sm">
                      <span className="text-lg font-bold text-white">
                        {weekNumber}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800">
                        Week {weekNumber}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {workoutDaysCount} workout
                        {workoutDaysCount !== 1 ? "s" : ""}
                        {restDaysCount > 0 && ` • ${restDaysCount} rest`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-orange-50 px-2.5 py-1 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    <span className="text-xs font-semibold text-orange-700">
                      Active
                    </span>
                  </div>
                </div>

                {/* Week Days Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {weekDays.map((day) => {
                    const isSelected = selectedDay === day.dayNumber;
                    const calories = day.data?.total_calories ?? 0;
                    const minutes = day.data?.total_minutes ?? 0;

                    return (
                      <button
                        key={day.dayNumber}
                        onClick={() =>
                          !day.isRestDay && setSelectedDay(day.dayNumber)
                        }
                        disabled={day.isRestDay}
                        className={`
                          relative rounded-xl overflow-hidden transition-all flex flex-col outline-none focus:outline-none active:outline-none
                          ${
                            day.isRestDay
                              ? "cursor-default"
                              : isSelected
                                ? "ring-2 ring-orange-400 ring-offset-2 shadow-lg scale-[1.02]"
                                : "hover:shadow-md hover:scale-[1.01] border border-slate-200"
                          }
                        `}
                      >
                        {/* REST DAY - Subtle Design */}
                        {day.isRestDay ? (
                          <div className="flex flex-col h-full bg-slate-100">
                            {/* Top - Day Name */}
                            <div className="bg-slate-200/70 py-2 px-3">
                              <span className="text-xs font-bold text-slate-400 text-center block">
                                {day.dayOfWeek}
                              </span>
                            </div>

                            {/* Middle - Day Number with Rest Icon */}
                            <div className="flex-1 flex flex-col items-center justify-center py-4 relative">
                              <div className="absolute inset-0 flex items-center justify-center opacity-5">
                                <HiMoon className="w-16 h-16 text-slate-500" />
                              </div>
                              <span className="text-3xl font-black text-slate-300 relative z-10">
                                {day.dayNumber}
                              </span>
                            </div>

                            {/* Bottom - Rest Day Label */}
                            <div className="bg-slate-200/50 py-2.5 px-2">
                              <div className="flex items-center justify-center gap-1.5">
                                <HiMoon className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-semibold text-slate-400">
                                  Rest
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* WORKOUT DAY - 3 Horizontal Divisions */
                          <div className="flex flex-col h-full bg-white">
                            {/* TOP - Day Name with Orange Background */}
                            <div className="py-2 px-3 bg-orange-50">
                              <span className="text-xs font-bold text-center block text-orange-600">
                                {day.dayOfWeek}
                              </span>
                            </div>

                            {/* MIDDLE - Day Number Centered */}
                            <div className="flex-1 flex items-center justify-center py-4">
                              <span className="text-4xl font-black text-slate-800">
                                {day.dayNumber}
                              </span>
                            </div>

                            {/* BOTTOM - Calories & Minutes */}
                            <div className="py-2 px-1.5 bg-slate-50">
                              <div className="flex items-center justify-center gap-1.5">
                                <HiFire className="w-3.5 h-3.5 shrink-0 text-orange-500" />
                                <span className="text-xs font-bold tabular-nums text-orange-600">
                                  {calories || 0}
                                </span>
                                <span className="text-xs text-slate-400">
                                  |
                                </span>
                                <span className="text-xs font-bold tabular-nums text-teal-600">
                                  {minutes || 0}m
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Exercises for selected day in this week */}
                {selectedDay !== null &&
                  selectedDay > (weekNumber - 1) * 7 &&
                  selectedDay <= weekNumber * 7 &&
                  (() => {
                    const dailyPlan = dailyPlanMap.get(selectedDay);

                    return (
                      <div className="mt-5 pt-5 border-t border-slate-200">
                        {/* Day Header - Enhanced */}
                        <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 mb-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                                <span className="text-2xl font-black text-orange-600">
                                  {selectedDay}
                                </span>
                              </div>
                              <div>
                                <h4 className="text-lg font-bold text-slate-800">
                                  Day {selectedDay}
                                </h4>
                                {dailyPlan?.plan_goal && (
                                  <p className="text-sm text-slate-600 font-medium">
                                    {dailyPlan.plan_goal}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-3">
                              {dailyPlan?.total_minutes &&
                                dailyPlan.total_minutes > 0 && (
                                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg shadow-sm">
                                    <HiClock className="w-4 h-4 text-orange-600" />
                                    <span className="text-sm font-bold text-slate-700">
                                      {dailyPlan.total_minutes}m
                                    </span>
                                  </div>
                                )}
                              {dailyPlan?.total_calories &&
                                dailyPlan.total_calories > 0 && (
                                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg shadow-sm">
                                    <HiFire className="w-4 h-4 text-orange-500" />
                                    <span className="text-sm font-bold text-slate-700">
                                      {dailyPlan.total_calories} cal
                                    </span>
                                  </div>
                                )}
                            </div>
                          </div>

                          {/* Daily Motivation Quote */}
                          {dailyPlan?.daily_motivation && (
                            <p className="text-xs text-slate-500 italic mt-3 pt-3 border-t border-orange-100">
                              &ldquo;{dailyPlan.daily_motivation}&rdquo;
                            </p>
                          )}

                          {/* Reminder */}
                          {dailyPlan?.reminder && (
                            <div className="mt-3 pt-3 border-t border-orange-100">
                              <p className="text-xs text-orange-600 font-medium">
                                Reminder: {dailyPlan.reminder}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Exercises */}
                        {isLoadingExercises ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
                          </div>
                        ) : selectedDayExercises.length > 0 ? (
                          <div className="space-y-4">
                            {/* Warm Up */}
                            {warmupExercises.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <HiFire className="w-4 h-4 text-orange-500" />
                                  <h5 className="text-sm font-bold text-orange-600">
                                    {getSectionTitle(
                                      "warmup",
                                      warmupExercises.length,
                                    )}
                                  </h5>
                                </div>
                                <div className="space-y-2">
                                  {warmupExercises.map((exercise, index) => (
                                    <ExerciseRow
                                      key={`warmup-${exercise.id}-${index}`}
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

                            {/* Main Exercises */}
                            {mainExercises.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <HiBolt className="w-4 h-4 text-orange-600" />
                                  <h5 className="text-sm font-bold text-orange-600">
                                    {getSectionTitle(
                                      "main",
                                      mainExercises.length,
                                    )}
                                  </h5>
                                </div>
                                <div className="space-y-2">
                                  {mainExercises.map((exercise, index) => (
                                    <ExerciseRow
                                      key={`main-${exercise.id}-${index}`}
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

                            {/* Cool Down */}
                            {cooldownExercises.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <HiMoon className="w-4 h-4 text-blue-500" />
                                  <h5 className="text-sm font-bold text-blue-600">
                                    {getSectionTitle(
                                      "cooldown",
                                      cooldownExercises.length,
                                    )}
                                  </h5>
                                </div>
                                <div className="space-y-2">
                                  {cooldownExercises.map((exercise, index) => (
                                    <ExerciseRow
                                      key={`cooldown-${exercise.id}-${index}`}
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
                          </div>
                        ) : (
                          <div className="text-center py-6 text-sm text-slate-400">
                            No exercises found for this day.
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </div>
            );
          })}
        </div>

        {/* About Coach Card */}
        <div className="mt-8 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-lg font-bold text-slate-800 mb-1">
              About Coach &ldquo;{coachName}&rdquo;
            </h3>
            {coachTagline && (
              <p className="text-teal-600 font-medium text-sm mb-2">
                {coachTagline}
              </p>
            )}
            {coachDescription ? (
              <p className="text-slate-600 text-sm leading-relaxed line-clamp-2 mb-4">
                {coachDescription}
              </p>
            ) : (
              <div className="mb-4" />
            )}
            <button
              type="button"
              onClick={() =>
                showToast("success", "Coming soon", "Will be available soon")
              }
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <HiUser className="w-4 h-4" />
              Know more
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Start Workout Button */}
      <div className="fixed bottom-[70px] left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <button
            onClick={() => {
              if (selectedDay !== null) {
                const dailyPlan = dailyPlanMap.get(selectedDay);
                router.push(
                  `/personal/coach/workout/session?planId=${planId}&day=${selectedDay}${dailyPlan?.id ? `&dailyPlanId=${dailyPlan.id}` : ""}`,
                );
              } else {
                // Find first day with exercises
                const firstDay = dailyPlans[0];
                if (firstDay) {
                  router.push(
                    `/personal/coach/workout/session?planId=${planId}&day=${firstDay.day_number}&dailyPlanId=${firstDay.id}`,
                  );
                }
              }
            }}
            className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white rounded-xl py-4 px-6 font-bold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3"
          >
            <HiCalendar className="w-6 h-6" />
            <span>
              {selectedDay !== null
                ? `Start Day ${selectedDay} Workout`
                : "Start Workout"}
            </span>
          </button>
        </div>
      </div>

      {/* Toasts */}
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          onDismiss={() => dismissToast(toast.id)}
          index={index}
        />
      ))}
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
  exercise: CoachWorkoutDailyPlanExerciseWithDetails;
  getExerciseImageUrl: (
    imageSlug: string | null,
    imagePath: string | null,
  ) => string;
  formatSets: (sets: number) => string;
  formatReps: (reps: number) => string;
  formatDuration: (seconds: number) => string;
}) {
  const imageUrl = getExerciseImageUrl(
    exercise.exercise_details?.image_slug || null,
    exercise.exercise_details?.image_path || null,
  );
  const hasImage = imageUrl && imageUrl.trim() !== "";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
      <div className="flex items-stretch">
        {/* Exercise Image - Square 1:1 */}
        <div className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-slate-100 to-slate-50 rounded-l-2xl overflow-hidden">
          {hasImage ? (
            <Image
              src={imageUrl}
              alt={exercise.exercise_details?.name || "Exercise"}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                <HiBolt className="w-6 h-6 text-slate-400" />
              </div>
            </div>
          )}
        </div>

        {/* Exercise Details */}
        <div className="flex-1 p-3 flex flex-col justify-center min-w-0">
          <h5 className="font-bold text-slate-800 text-base leading-tight mb-2 line-clamp-2">
            {exercise.exercise_details?.name || "Exercise"}
          </h5>

          {/* Exercise Meta */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            {exercise.sets && exercise.sets > 0 && (
              <span>
                <span className="font-bold text-slate-800">
                  {exercise.sets}
                </span>{" "}
                sets
              </span>
            )}
            {exercise.reps && exercise.reps > 0 && (
              <span>
                <span className="font-bold text-slate-800">
                  {exercise.reps}
                </span>{" "}
                reps
              </span>
            )}
            {exercise.duration_seconds && exercise.duration_seconds > 0 && (
              <span>
                <span className="font-bold text-slate-800">
                  {formatDuration(exercise.duration_seconds)}
                </span>
              </span>
            )}
            {exercise.per_side && (
              <span className="text-xs font-semibold text-purple-600">
                Each side
              </span>
            )}
          </div>

          {/* Safety Tip */}
          {exercise.safety_tip && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-1">
              Tip: {exercise.safety_tip}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

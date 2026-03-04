"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useWorkoutContext } from "@/contexts/WorkoutContext";
import { useUserContext } from "@/contexts/UserContext";
import { usePlansContext } from "@/contexts/PlansContext";
import type { WorkoutPlan } from "@/types/Workout";
import type { PlanTier } from "@/types/Plan";
import Toast, { ToastProps } from "@/components/Toast";
import {
  HiBolt,
  HiClock,
  HiLockClosed,
  HiLockOpen,
  HiArrowRight,
  HiArrowPath,
  HiMoon,
  HiArrowRightOnRectangle,
} from "react-icons/hi2";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

export default function WorkoutsPage() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [currentDate, setCurrentDate] = useState<string>(
    new Date().toDateString(),
  );
  const [selectedCategory, setSelectedCategory] =
    useState<string>("All Workouts");
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [isRefreshingWorkouts, setIsRefreshingWorkouts] = useState(false);
  const toastIdRef = useRef(0);

  const {
    workoutPlans,
    loadingState,
    filterPlansByCategory,
    refreshWorkoutData,
  } = useWorkoutContext();

  const { userProfile } = useUserContext();
  const { showPlanDialog } = usePlansContext();

  const formatTime = (date: Date): string => {
    const hours: number = date.getHours();
    const minutes: number = date.getMinutes();
    const seconds: number = date.getSeconds();
    const ampm: string = hours >= 12 ? "PM" : "AM";
    const displayHours: number = hours % 12 || 12;
    const mm: string = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const ss: string = seconds < 10 ? `0${seconds}` : `${seconds}`;
    return `${displayHours}:${mm}:${ss} ${ampm}`;
  };

  const isToday = (date: Date): boolean => {
    const today: Date = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Ticking clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now: Date = new Date();
      setCurrentTime(now);
      const newDateString: string = now.toDateString();
      if (newDateString !== currentDate) setCurrentDate(newDateString);
    }, 1000);
    return () => clearInterval(timer);
  }, [currentDate]);

  const showToast = (
    type: "success" | "error",
    title: string,
    message: string,
  ) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const handleRefreshWorkouts = useCallback(async () => {
    try {
      setIsRefreshingWorkouts(true);
      await Promise.resolve(refreshWorkoutData());
    } finally {
      setIsRefreshingWorkouts(false);
    }
  }, [refreshWorkoutData]);

  // Helper function to check if a plan matches a category
  const planMatchesCategory = useCallback(
    (plan: WorkoutPlan, categoryKey: string): boolean => {
      if (!plan.category) return false;
      return plan.category.trim() === categoryKey.trim();
    },
    [],
  );

  const getLevelColor = (level: string): string => {
    const normalized: string = level.toLowerCase();
    if (normalized === "beginner") return "bg-green-500";
    if (normalized === "intermediate") return "bg-amber-500";
    if (normalized === "advanced") return "bg-red-500";
    return "bg-amber-500";
  };

  const formatLevel = (level: string): string =>
    level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();

  // Get user's plan tier
  const getUserPlanTier = useCallback((): "free" | "pro" | "premium" => {
    if (!userProfile?.plan_code) {
      return "free";
    }
    const planCode = userProfile.plan_code.toLowerCase();
    if (planCode === "premium") return "premium";
    if (planCode === "pro") return "pro";
    return "free";
  }, [userProfile]);

  // Check if user can access a specific workout tier
  const canAccessWorkout = useCallback(
    (workoutTier: string): boolean => {
      const userTier = getUserPlanTier();
      const tier = workoutTier?.toLowerCase() || "free";

      // Premium users can access everything
      if (userTier === "premium") return true;

      // Pro users can access free and pro content
      if (userTier === "pro" && (tier === "free" || tier === "pro"))
        return true;

      // Free users can only access free content
      if (userTier === "free" && tier === "free") return true;

      return false;
    },
    [getUserPlanTier],
  );

  // Get unique categories from workout plans
  const availableCategories = useMemo(() => {
    const uniqueCategories = [
      ...new Set(
        workoutPlans
          .map((plan) => plan.category)
          .filter((cat): cat is string => !!cat),
      ),
    ];
    return ["All Workouts", ...uniqueCategories.sort()];
  }, [workoutPlans]);

  // Filter and sort workouts based on selected category and access level
  const filteredWorkouts = useMemo(() => {
    let plans: WorkoutPlan[];
    if (selectedCategory === "All Workouts") {
      plans = workoutPlans;
    } else {
      plans = workoutPlans.filter((plan) =>
        planMatchesCategory(plan, selectedCategory),
      );
    }

    // Sort workouts: unlocked first, then locked
    return [...plans].sort((a, b) => {
      const tierCodeA = a.tier_code?.toLowerCase() || "free";
      const tierCodeB = b.tier_code?.toLowerCase() || "free";
      const hasAccessA = canAccessWorkout(tierCodeA);
      const hasAccessB = canAccessWorkout(tierCodeB);

      if (hasAccessA && !hasAccessB) return -1;
      if (!hasAccessA && hasAccessB) return 1;
      return 0;
    });
  }, [selectedCategory, workoutPlans, canAccessWorkout, planMatchesCategory]);

  const weekDays = useMemo(() => {
    const today: Date = new Date();
    const currentDayOfWeek: number = today.getDay();
    const startOfWeek: Date = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDayOfWeek);
    const daysArray: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day: Date = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      daysArray.push(day);
    }
    return daysArray;
  }, [currentDate]);

  const getCategoryIcon = (categoryName: string): string => {
    if (categoryName === "All Workouts") return "grid";
    if (categoryName === "Core Awakening") return "fitness";
    if (categoryName === "Gentle Mobility") return "leaf";
    if (categoryName === "Cardio Clarity") return "pulse";
    if (categoryName === "Strength & Stillness") return "barbell";
    if (categoryName === "Soulful Challenges") return "flame";
    return "fitness";
  };

  const handleWorkoutPress = useCallback(
    (plan: WorkoutPlan) => {
      const tierCode = plan.tier_code?.toLowerCase() || "free";
      const hasAccess: boolean = canAccessWorkout(tierCode);

      if (!hasAccess) {
        // Show plan dialog to upgrade
        showPlanDialog({
          showAllPlans: false,
          highlightTier: tierCode === "premium" ? "premium" : "pro",
          onPlanSelect: (planCode: string, tier: PlanTier) => {
            console.log("Selected plan:", planCode, tier);
            // TODO: Navigate to payment/subscription page
          },
        });
        return;
      }
      // Navigate to workout details page
      router.push(`/workouts/details?id=${plan.id}`);
    },
    [canAccessWorkout, showPlanDialog, router],
  );

  const handleViewAll = useCallback(() => {
    setSelectedCategory("All Workouts");
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-3xl mx-auto px-4 sm:px-5 py-5">
        {/* Header */}
        <div className="mb-4 -ml-1 mt-1">
          <div className="flex items-center justify-between gap-2 mb-2">
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
            <div className="flex items-center gap-2">
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

        {/* Week Calendar */}
        <div className="mb-5 bg-gray-50 rounded-lg p-3.5">
          <div className="flex justify-end items-center mb-2.5">
            <HiClock className="w-3.5 h-3.5 text-amber-500 mr-1.5" />
            <span className="text-xs sm:text-sm font-semibold text-amber-500 tracking-wide">
              {formatTime(currentTime)}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((day: Date, index: number) => {
              const isTodayFlag: boolean = isToday(day);
              const dayName: string = [
                "Sun",
                "Mon",
                "Tue",
                "Wed",
                "Thu",
                "Fri",
                "Sat",
              ][day.getDay()];
              const dateNumber: number = day.getDate();
              return (
                <div
                  key={index}
                  className={`flex flex-col items-center py-2.5 px-1.5 rounded-md transition-all ${
                    isTodayFlag
                      ? "bg-teal-600 text-white scale-[1.02] shadow-md"
                      : "bg-transparent text-gray-600"
                  }`}
                >
                  <span
                    className={`text-[11px] font-semibold mb-1 ${
                      isTodayFlag ? "text-white" : "text-gray-500"
                    }`}
                  >
                    {dayName}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      isTodayFlag ? "text-white" : "text-gray-700"
                    }`}
                  >
                    {dateNumber}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Title & Subtitle Card */}
        <div className="mb-5 bg-gradient-to-br from-teal-600 to-teal-500 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-amber-500/20 rounded-full translate-y-10 -translate-x-10" />
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2.5 mb-2.5 flex-wrap">
              <div className="inline-flex items-center gap-1.5 bg-white/95 px-2.5 py-1 rounded-full shadow-sm">
                <HiBolt className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wide">
                  Ignite Your Goals
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleRefreshWorkouts();
                }}
                disabled={isRefreshingWorkouts || loadingState.isLoading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/95 text-teal-700 text-xs sm:text-sm font-semibold hover:bg-white transition-colors disabled:opacity-60"
              >
                <HiArrowPath
                  className={`w-3.5 h-3.5 ${isRefreshingWorkouts ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1.5 tracking-tight">
              Workout Plans For You
            </h1>
            <p className="text-xs sm:text-sm text-white/90 font-medium leading-relaxed">
              Choose Your Rhythm Move with intention. Every category is a
              doorway{"\u2014"}step through the one that speaks to your breath
              today.
            </p>
          </div>
        </div>

        {/* Categories */}
        <div className="mb-5 overflow-x-auto">
          <div className="flex gap-2 pb-2">
            {availableCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? "bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md"
                    : "bg-gradient-to-r from-amber-500 to-amber-400 text-white shadow-sm hover:shadow-md"
                }`}
              >
                <span>{cat}</span>
              </button>
            ))}
          </div>
        </div>

        {/* View All Button with Total Count */}
        <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs sm:text-sm font-semibold text-gray-600">
              {filteredWorkouts.length} of {workoutPlans.length} workouts
            </p>
          </div>
          {selectedCategory !== "All Workouts" && (
            <button
              onClick={handleViewAll}
              className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-600 rounded-lg font-semibold text-xs sm:text-sm hover:bg-teal-100 transition-colors"
            >
              <span>Clear Filter</span>
              <span className="text-sm">{"\u00D7"}</span>
            </button>
          )}
        </div>

        {/* Workout Plan Cards */}
        {loadingState.isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mb-3" />
            <p className="text-sm font-bold text-teal-700">
              Loading workouts...
            </p>
          </div>
        ) : loadingState.error ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-4xl mb-3">{"\u26A0\uFE0F"}</div>
            <p className="text-sm font-semibold text-red-600 mb-3">
              Error: {loadingState.error}
            </p>
            <button
              onClick={refreshWorkoutData}
              className="px-5 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : filteredWorkouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-4xl mb-3">{"\uD83D\uDCAA"}</div>
            <p className="text-sm font-medium text-slate-500 text-center">
              {selectedCategory === "All Workouts"
                ? "No workouts available"
                : `No workouts found in "${selectedCategory}" category`}
            </p>
            {selectedCategory !== "All Workouts" && (
              <button
                onClick={handleViewAll}
                className="mt-3 px-5 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition-colors"
              >
                View All Workouts
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-5">
            {filteredWorkouts.map((plan: WorkoutPlan) => {
              const tierCode = plan.tier_code?.toLowerCase() || "free";
              const hasAccess: boolean = canAccessWorkout(tierCode);
              const isLocked: boolean = !hasAccess;

              return (
                <button
                  key={plan.id}
                  onClick={() => handleWorkoutPress(plan)}
                  className="group relative bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all transform hover:scale-[1.01]"
                >
                  {/* Image Background */}
                  <div className="relative h-40 sm:h-44 bg-gradient-to-br from-gray-200 to-gray-300">
                    {plan.image_path ? (
                      <Image
                        src={plan.image_path}
                        alt={plan.image_alt || plan.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <Image
                        src="/images/onboarding_1.png"
                        alt={plan.name || "Workout"}
                        fill
                        className="object-cover"
                      />
                    )}
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    {/* Locked Overlay */}
                    {isLocked && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                        <div className="flex flex-col items-center gap-2">
                          <HiLockClosed className="w-6 h-6 text-amber-500" />
                        </div>
                      </div>
                    )}
                    {/* Level Pill */}
                    <div className="absolute top-2.5 right-2.5 z-20">
                      <span
                        className={`${getLevelColor(
                          plan.level,
                        )} text-white px-2.5 py-0.5 rounded-full text-[11px] font-bold`}
                      >
                        {formatLevel(plan.level)}
                      </span>
                    </div>
                    {/* Content */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
                      <h3 className="text-base font-extrabold text-white mb-1.5 line-clamp-2">
                        {plan.name || "Workout"}
                      </h3>
                      {(plan.total_exercises || plan.total_minutes) && (
                        <div className="flex items-center gap-1.5 text-white/85 text-xs">
                          {plan.total_exercises && plan.total_exercises > 0 && (
                            <>
                              <span>
                                {plan.total_exercises}{" "}
                                {plan.total_exercises === 1
                                  ? "exercise"
                                  : "exercises"}
                              </span>
                              {plan.total_minutes && plan.total_minutes > 0 && (
                                <span>{"\u2022"}</span>
                              )}
                            </>
                          )}
                          {plan.total_minutes && plan.total_minutes > 0 && (
                            <span>{plan.total_minutes} min</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Unlock All Exercises Button - Only for Free and Pro accounts */}
        {!loadingState.isLoading &&
          filteredWorkouts.length > 0 &&
          getUserPlanTier() !== "premium" && (
            <button
              onClick={() => {
                showPlanDialog({
                  showAllPlans: false,
                  highlightTier:
                    getUserPlanTier() === "free" ? "pro" : "premium",
                  onPlanSelect: (planCode: string, tier: PlanTier) => {
                    console.log("Selected plan:", planCode, tier);
                    // TODO: Navigate to payment/subscription page or handle upgrade
                  },
                });
              }}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-400 text-white rounded-xl p-3.5 font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <HiLockOpen className="w-4 h-4" />
              <span>Unlock all exercises</span>
              <HiArrowRight className="w-4 h-4" />
            </button>
          )}
      </div>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
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
    </div>
  );
}

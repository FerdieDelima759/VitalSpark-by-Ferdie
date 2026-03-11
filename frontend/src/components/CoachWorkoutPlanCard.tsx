"use client";

import Image from "next/image";
import { HiLockClosed } from "react-icons/hi2";
import { CoachWorkoutPlanWithTags } from "@/types/CoachWorkout";

interface CoachWorkoutPlanCardProps {
  plan: CoachWorkoutPlanWithTags;
  isLocked?: boolean;
  onClick?: () => void;
  hideImage?: boolean;
}

const getLevelColor = (level: string): string => {
  const normalized: string = level.toLowerCase();
  if (normalized === "beginner") return "bg-green-500";
  if (normalized === "intermediate") return "bg-amber-500";
  if (normalized === "advanced") return "bg-red-500";
  return "bg-amber-500";
};

const formatLevel = (level: string): string =>
  level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();

export default function CoachWorkoutPlanCard({
  plan,
  isLocked = false,
  onClick,
  hideImage = false,
}: CoachWorkoutPlanCardProps) {
  const days =
    plan.duration_days ||
    (plan.number_of_weeks ? plan.number_of_weeks * 7 : null);
  return (
    <button
      onClick={onClick}
      className="group relative bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-md hover:shadow-xl dark:hover:shadow-black/40 transition-all transform hover:scale-[1.02] w-full text-left border border-transparent dark:border-slate-700"
    >
      {/* Header */}
      {hideImage ? (
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 line-clamp-2">
              {plan.name || "Workout"}
            </h3>
            <span
              className={`${getLevelColor(
                plan.level
              )} text-white px-3 py-1 rounded-full text-xs font-bold`}
            >
              {formatLevel(plan.level)}
            </span>
          </div>
          {days && days > 0 && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 text-sm">
              <span>
                {days} {days === 1 ? "day" : "days"}
              </span>
              {plan.total_minutes && plan.total_minutes > 0 && (
                <>
                  <span>•</span>
                  <span>{plan.total_minutes} min</span>
                </>
              )}
            </div>
          )}
          {isLocked && (
            <div className="mt-3 inline-flex items-center gap-2 text-amber-600 dark:text-amber-300 text-xs font-semibold">
              <HiLockClosed className="w-4 h-4" />
              Locked
            </div>
          )}
        </div>
      ) : (
        <div className="relative h-48 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-700 dark:to-slate-600">
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
                <HiLockClosed className="w-8 h-8 text-amber-500" />
              </div>
            </div>
          )}
          {/* Level Pill */}
          <div className="absolute top-3 right-3 z-20">
            <span
              className={`${getLevelColor(
                plan.level
              )} text-white px-3 py-1 rounded-full text-xs font-bold`}
            >
              {formatLevel(plan.level)}
            </span>
          </div>
          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
            <h3 className="text-lg font-extrabold text-white mb-2 line-clamp-2">
              {plan.name || "Workout"}
            </h3>
            {days && days > 0 && (
              <div className="flex items-center gap-2 text-white/85 text-sm">
                <span>
                  {days} {days === 1 ? "day" : "days"}
                </span>
                {plan.total_minutes && plan.total_minutes > 0 && (
                  <>
                    <span>•</span>
                    <span>{plan.total_minutes} min</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </button>
  );
}

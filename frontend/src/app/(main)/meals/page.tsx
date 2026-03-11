"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { HiMoon, HiSun, HiArrowRightOnRectangle } from "react-icons/hi2";
import WorkoutMealPlanPage from "./workout/plan/[id]/page";

export default function MealsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workoutPlanId = searchParams.get("workoutPlanId");
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") return true;
    if (savedTheme === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (!workoutPlanId) return;
    router.replace(`/meals/workout/plan/${workoutPlanId}`);
  }, [router, workoutPlanId]);

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

  const handleThemeToggle = (): void => {
    const root = document.documentElement;
    const nextTheme = root.classList.contains("dark") ? "light" : "dark";

    root.classList.remove("light", "dark");
    root.classList.add(nextTheme);
    localStorage.setItem("theme", nextTheme);
    setIsDarkTheme(nextTheme === "dark");
  };

  if (workoutPlanId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
        <div className="mb-4 ml-14">
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
            <div className="flex items-center gap-2 pr-14">
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
        <WorkoutMealPlanPage showRefreshButton />
      </div>
    </div>
  );
}

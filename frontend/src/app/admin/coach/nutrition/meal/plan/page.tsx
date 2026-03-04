"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { HiArrowLeft } from "react-icons/hi2";
import Loader from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useCoachMealData } from "@/hooks/useCoachMealData";
import { CoachMealPlan } from "@/types/CoachMeal";

export default function CoachMealPlansPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const { fetchMealPlans } = useCoachMealData();
  const hasCheckedAuth = useRef(false);
  const [mealPlans, setMealPlans] = useState<CoachMealPlan[]>([]);
  const [isLoadingMealPlans, setIsLoadingMealPlans] = useState<boolean>(false);
  const [mealPlansError, setMealPlansError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isLoadingRole) {
      if (!hasCheckedAuth.current) {
        hasCheckedAuth.current = true;
      }
      if (!isAuthenticated) {
        router.push("/auth/login");
      } else if (hasCheckedAuth.current && !isAdmin) {
        router.push("/");
      }
    }
  }, [isAuthenticated, isAdmin, isLoading, isLoadingRole, router]);

  useEffect(() => {
    let isMounted = true;
    const loadPlans = async () => {
      setIsLoadingMealPlans(true);
      const result = await fetchMealPlans();
      if (!isMounted) {
        return;
      }
      if (result.success && result.data) {
        setMealPlans(result.data);
        setMealPlansError(null);
      } else {
        setMealPlans([]);
        setMealPlansError(result.error || "Unable to load meal plans");
      }
      setIsLoadingMealPlans(false);
    };
    if (isAuthenticated && isAdmin) {
      loadPlans();
    }
    return () => {
      isMounted = false;
    };
  }, [fetchMealPlans, isAdmin, isAuthenticated]);

  const formatCalories = (value: number | null) => {
    if (!value || Number.isNaN(value)) {
      return "—";
    }
    return new Intl.NumberFormat("en-US").format(value);
  };

  const formatDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  if (!isAuthenticated || !isAdmin) {
    if (!isLoading && !isLoadingRole) {
      return null;
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading || isLoadingRole ? (
          <div className="flex min-h-[calc(100vh-140px)] items-center justify-center">
            <Loader
              size="lg"
              text="Loading..."
              color="green"
              textColor="slate"
            />
          </div>
        ) : (
          <>
            {/* Page heading */}
            <div className="mb-6 sm:mb-8">
              <div className="mb-2">
                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => router.push("/admin/coach/nutrition")}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                  >
                    <HiArrowLeft className="h-5 w-5" />
                  </button>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
                  Coach Meal Plans
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  Browse every shared meal plan crafted by your coaching team
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Role: Admin</span>
                </div>
              </div>
              <div className="h-1 bg-[#f59e0b] rounded-full w-16 mt-1" />
            </div>

            {mealPlansError && (
              <p className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {mealPlansError}
              </p>
            )}
            {isLoadingMealPlans ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`plan-skeleton-${index}`}
                    className="animate-pulse rounded-2xl border border-slate-100 bg-white/60 p-5 shadow-inner"
                  >
                    <div className="h-4 w-1/3 rounded bg-slate-200" />
                    <div className="mt-3 h-6 w-2/3 rounded bg-slate-200" />
                    <div className="mt-4 space-y-2">
                      <div className="h-3 w-full rounded bg-slate-100" />
                      <div className="h-3 w-3/4 rounded bg-slate-100" />
                      <div className="h-3 w-1/2 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : mealPlans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center">
                <p className="text-sm text-slate-500">
                  No meal plans available. Create one from the General Nutrition
                  Library to see it listed here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {mealPlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() =>
                      router.push(`/admin/coach/nutrition/meal/${plan.id}`)
                    }
                    className="flex h-full flex-col justify-between rounded-2xl border border-teal-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                          {plan.goal || "General"}
                          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                          {plan.duration_days}d
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          {plan.is_public ? "Public" : "Private"}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-slate-900">
                        {plan.name}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 line-clamp-3">
                        {plan.description || "No description provided."}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                        🔥 {formatCalories(plan.estimated_daily_calories)}{" "}
                        kcal/day
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                        🗓️ {plan.duration_days} days
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                        📅 {formatDate(plan.created_at)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

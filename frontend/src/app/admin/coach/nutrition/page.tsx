"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { HiArrowLeft } from "react-icons/hi2";
import Loader from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useCoachMealData } from "@/hooks/useCoachMealData";
import { CoachMealPlan } from "@/types/CoachMeal";

export default function CoachMealsPage() {
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
    const loadMealPlans = async () => {
      setIsLoadingMealPlans(true);
      const result = await fetchMealPlans();
      if (!isMounted) {
        return;
      }
      if (result.success && result.data) {
        setMealPlans(result.data.slice(0, 6));
        setMealPlansError(null);
      } else {
        setMealPlans([]);
        setMealPlansError(result.error || "Unable to load meal plans");
      }
      setIsLoadingMealPlans(false);
    };
    if (isAuthenticated && isAdmin) {
      loadMealPlans();
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

  if (!isAuthenticated || !isAdmin) {
    if (!isLoading && !isLoadingRole) {
      return null; // Will redirect
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
                    onClick={() => router.push("/admin")}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                  >
                    <HiArrowLeft className="h-5 w-5" />
                  </button>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
                  Coach Meal Plans
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  Manage base foods, recipes, and meals for meal plans
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Role: Admin</span>
                </div>
              </div>
              <div className="h-1 bg-[#f59e0b] rounded-full w-16 mt-1" />
            </div>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-500">
                    Meal Plans
                  </p>
                  <h3 className="text-xl font-semibold text-slate-900">
                    Coach Nutrition Programs
                  </h3>
                  <p className="text-sm text-slate-600">
                    Recently published meal plans across your coaching team.
                  </p>
                </div>
                <Link
                  href="/admin/coach/nutrition/meal/plan"
                  className="inline-flex items-center justify-center rounded-full border border-teal-200 px-4 py-2 text-sm font-semibold text-teal-700 transition hover:border-teal-400 hover:text-teal-900"
                >
                  View All
                </Link>
              </div>

              {mealPlansError && (
                <p className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {mealPlansError}
                </p>
              )}

              {isLoadingMealPlans ? (
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 2xl:grid-cols-8">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={`skeleton-${index}`}
                      className="animate-pulse rounded-2xl border border-slate-100 bg-slate-50/70 p-5 shadow-inner 2xl:col-span-2"
                    >
                      <div className="h-4 w-1/3 rounded bg-slate-200" />
                      <div className="mt-3 h-5 w-2/3 rounded bg-slate-200" />
                      <div className="mt-4 space-y-2">
                        <div className="h-3 w-full rounded bg-slate-100" />
                        <div className="h-3 w-3/4 rounded bg-slate-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 2xl:grid-cols-8">
                  {mealPlans.length === 0 ? (
                    <div className="col-span-full rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center">
                      <p className="text-sm text-slate-500">
                        No meal plans found yet. Start creating plans in the
                        General Nutrition Library.
                      </p>
                    </div>
                  ) : (
                    mealPlans.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() =>
                          router.push(`/admin/coach/nutrition/meal/${plan.id}`)
                        }
                        className="flex flex-col justify-between rounded-2xl border border-teal-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 2xl:col-span-2"
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
                          <h4 className="mt-3 text-lg font-semibold text-slate-900">
                            {plan.name}
                          </h4>
                          <p className="mt-2 text-sm text-slate-600 line-clamp-3">
                            {plan.description || "No description provided."}
                          </p>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                            🔥 {formatCalories(plan.estimated_daily_calories)}{" "}
                            kcal/day
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                            🗓️ {plan.duration_days} days
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </section>

            <div className="mt-10 rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-3xl">
                  🥗
                </div>
                <div className="flex-1">
                  <p className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                    Nutrition
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    Library
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-slate-900">
                    Edit base food, recipes, and meals
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    All shared nutrition data now lives in the General Nutrition
                    Library. Continue curating ingredients, recipes, and meals
                    from the new home so every coach works from the same source
                    of truth.
                  </p>
                  <ul className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                    <li className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                      <span className="text-lg">🥬</span>
                      <span>Base food catalog</span>
                    </li>
                    <li className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                      <span className="text-lg">📋</span>
                      <span>Reusable recipes</span>
                    </li>
                    <li className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                      <span className="text-lg">🍽️</span>
                      <span>Meal templates</span>
                    </li>
                  </ul>
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => router.push("/admin/general/nutrition")}
                      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-teal-600 hover:to-emerald-600"
                    >
                      Go to Nutrition Library
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

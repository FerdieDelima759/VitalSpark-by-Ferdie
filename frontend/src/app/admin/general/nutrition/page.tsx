"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import Image from "next/image";
import Loader from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { HiArrowLeft } from "react-icons/hi2";

export default function GeneralNutritionPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const hasCheckedAuth = useRef(false);

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

  if (!isAuthenticated || !isAdmin) {
    if (!isLoading && !isLoadingRole) {
      return null;
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
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
                  General Nutrition Library
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  Manage base foods, recipes, and meals shared across plans.
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Role: Admin</span>
                </div>
              </div>
              <div className="h-1 bg-[#f59e0b] rounded-full w-16 mt-1" />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => router.push("/admin/general/nutrition/base/food")}
                className="group flex flex-col justify-between rounded-2xl border border-teal-100 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                      Base Data
                    </span>
                    <h3 className="mt-3 text-lg font-semibold text-slate-900">
                      View Base Food
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Browse and manage base food items with nutritional
                      information.
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-2xl">
                    🥗
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-medium text-teal-700">
                  <span className="transition-transform group-hover:translate-x-1">
                    View Foods
                  </span>
                  <span aria-hidden>&rarr;</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => router.push("/admin/general/nutrition/base/recipes")}
                className="group flex flex-col justify-between rounded-2xl border border-amber-100 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Base Data
                    </span>
                    <h3 className="mt-3 text-lg font-semibold text-slate-900">
                      View Base Recipes
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Browse and manage recipe templates with ingredients and
                      instructions.
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
                    📝
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-medium text-amber-700">
                  <span className="transition-transform group-hover:translate-x-1">
                    View Recipes
                  </span>
                  <span aria-hidden>&rarr;</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => router.push("/admin/general/nutrition/base/meals")}
                className="group flex flex-col justify-between rounded-2xl border border-violet-100 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                      Base Data
                    </span>
                    <h3 className="mt-3 text-lg font-semibold text-slate-900">
                      View Base Meals
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Browse and manage meal templates combining foods and
                      recipes.
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-2xl">
                    🍽️
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-medium text-violet-700">
                  <span className="transition-transform group-hover:translate-x-1">
                    View Meals
                  </span>
                  <span aria-hidden>&rarr;</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => router.push("/admin/general/nutrition/plans")}
                className="group flex flex-col justify-between rounded-2xl border border-emerald-100 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Plans
                    </span>
                    <h3 className="mt-3 text-lg font-semibold text-slate-900">
                      Meal Plans
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Browse and manage meal plans with daily meal schedules
                      and nutritional goals.
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
                    📋
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-700">
                  <span className="transition-transform group-hover:translate-x-1">
                    View Meal Plans
                  </span>
                  <span aria-hidden>&rarr;</span>
                </div>
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}



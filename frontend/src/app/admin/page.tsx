"use client";

import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page heading */}
        <div className="mb-6 sm:mb-8">
          <div className="mb-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
              Admin Dashboard
            </h2>
            <p className="text-base sm:text-lg text-[#737373]">
              Manage your members, subscriptions, and workout content
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              <span>Role: Admin</span>
            </div>
          </div>
          <div className="h-1 bg-[#f59e0b] rounded-full w-16 mt-1" />
        </div>

        {/* Admin Sections */}
        <div className="space-y-8">
          {/* Users and Subscriptions Row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Users Card - Cyan accent */}
            <button
              type="button"
              onClick={() => router.push("/admin/users")}
              className="group flex flex-col justify-between rounded-2xl border border-cyan-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                    Users
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">
                    Users
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Manage user accounts, roles, and basic profile information.
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-100 text-xl">
                  👥
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-cyan-700">
                <span className="transition-transform group-hover:translate-x-1">
                  Go to Users
                </span>
                <span aria-hidden>&rarr;</span>
              </div>
            </button>

            {/* Subscriptions Card - Purple accent */}
            <button
              type="button"
              onClick={() => router.push("/admin/subscriptions")}
              className="group flex flex-col justify-between rounded-2xl border border-violet-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                    Billing & Plans
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">
                    Subscriptions
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Manage user subscriptions, billing tiers, and plan access.
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-xl">
                  💳
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-violet-700">
                <span className="transition-transform group-hover:translate-x-1">
                  Go to Subscriptions
                </span>
                <span aria-hidden>&rarr;</span>
              </div>
            </button>
          </div>

          {/* General Section Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#f8fafc] px-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                General
              </span>
            </div>
          </div>

          {/* General Workouts and Nutrition Cards - Emerald and Orange accent */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => router.push("/admin/general/workouts")}
              className="group flex flex-col justify-between rounded-2xl border border-emerald-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Library
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">
                    General Workouts
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Manage shared workout plans and exercise templates.
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-xl">
                  💪
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-700">
                <span className="transition-transform group-hover:translate-x-1">
                  Go to General Workouts
                </span>
                <span aria-hidden>&rarr;</span>
              </div>
            </button>

            {/* Nutrition and Meal Plans Card - Orange accent */}
            <button
              type="button"
              onClick={() => router.push("/admin/general/nutrition")}
              className="group flex flex-col justify-between rounded-2xl border border-orange-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    Library
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">
                    Nutrition and Meal Plans
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Manage shared meal plans and nutrition templates.
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-xl">
                  🥗
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-orange-700">
                <span className="transition-transform group-hover:translate-x-1">
                  Go to Nutrition Library
                </span>
                <span aria-hidden>&rarr;</span>
              </div>
            </button>
          </div>

          {/* Coach Section Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#f8fafc] px-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Coach
              </span>
            </div>
          </div>

          {/* Coach Workout Plans, Meal Plans, and Coaches Info Row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => router.push("/admin/coach/workout/plans")}
              className="group flex flex-col justify-between rounded-2xl border border-rose-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    Coaching
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">
                    Workout Plans
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Create and manage workout programs assigned by coaches.
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-xl">
                  🏋️
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-rose-700">
                <span className="transition-transform group-hover:translate-x-1">
                  Go to Coach Plans
                </span>
                <span aria-hidden>&rarr;</span>
              </div>
            </button>

            {/* Meal Plans Card - Teal accent */}
            <button
              type="button"
              onClick={() => router.push("/admin/coach/nutrition")}
              className="group flex flex-col justify-between rounded-2xl border border-teal-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                    Nutrition
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">
                    Meal Plans
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Connect workout plans with meal plans.
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-xl">
                  🍽️
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-teal-700">
                <span className="transition-transform group-hover:translate-x-1">
                  Go to Meal Plans
                </span>
                <span aria-hidden>&rarr;</span>
              </div>
            </button>

            {/* Coaches Info Card - Indigo accent */}
            <button
              type="button"
              onClick={() => router.push("/admin/coach/info")}
              className="group flex flex-col justify-between rounded-2xl border border-indigo-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    Coaching
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">
                    Coaches Info
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Insert, update, and delete coach profiles and information.
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-xl">
                  👤
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-indigo-700">
                <span className="transition-transform group-hover:translate-x-1">
                  Go to Coaches Info
                </span>
                <span aria-hidden>&rarr;</span>
              </div>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

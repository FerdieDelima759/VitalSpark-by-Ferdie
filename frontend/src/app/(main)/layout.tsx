"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { MealsProvider } from "@/contexts/MealsContext";
import BottomNavBar from "@/components/BottomNavBar";
import Loader from "@/components/Loader";
import { clearLocalStoragePreserveTheme } from "@/utils/themeStorage";
import { getSavedPersonalizedWorkoutPlan } from "@/lib/user-workout-plan";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user, signOut } = useAuth();
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const hideBottomNav =
    pathname === "/workouts/exercise/session" ||
    pathname.startsWith("/workouts/exercise/session/");

  const clearClientStorage = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      clearLocalStoragePreserveTheme();
    } catch {}
    try {
      sessionStorage.clear();
    } catch {}
    try {
      document.cookie.split(";").forEach((cookie) => {
        const cookieName = cookie.split("=")[0]?.trim();
        if (!cookieName) return;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      });
    } catch {}
  }, []);

  const enterMaintenanceMode = useCallback(async () => {
    setMaintenanceMode(true);
    try {
      await signOut();
    } catch {
      // Continue to clear local data even if sign-out fails.
    }
    clearClientStorage();
  }, [clearClientStorage, signOut]);

  useEffect(() => {
    if (isLoading || maintenanceMode) return;

    const checkOnboarding = async () => {
      // If not authenticated, go to login
      if (!isAuthenticated || !user) {
        router.push("/auth/login");
        return;
      }

      // User is authenticated - check onboarding status
      try {
        const { supabase } = await import("@/lib/api/supabase");
        const { data: profileRows, error } = await supabase
          .from("user_profile")
          .select("is_onboarding_complete, current_step")
          .eq("user_id", user.id)
          .limit(1);

        const profile = profileRows?.[0] ?? null;

        // No profile or error - start onboarding
        if (error) {
          await enterMaintenanceMode();
          return;
        }
        if (!profile) {
          router.push("/onboarding/language");
          return;
        }

        // Profile exists - check completion
        if (!profile.is_onboarding_complete) {
          // Route to current step
          const routes = [
            "/onboarding/language",
            "/onboarding/mood",
            "/onboarding/profile",
            "/onboarding/location",
            "/onboarding/height",
            "/onboarding/weight",
            "/onboarding/fitness",
            "/onboarding/target-muscle-group",
            "/onboarding/dietary",
            "/onboarding/finish",
          ];
          const step = profile.current_step || 1;
          // If step is 9 or higher, go to finish
          if (step >= 10) {
            router.push("/onboarding/finish");
          } else {
            router.push(routes[step - 1] || routes[0]);
          }
          return;
        }

        const savedPlanCheck = await getSavedPersonalizedWorkoutPlan(user.id);
        if (!savedPlanCheck.success || !savedPlanCheck.hasSavedPlan) {
          router.push("/onboarding/generate-workout");
          return;
        }
      } catch (error) {
        console.error("Error determining route:", error);
        await enterMaintenanceMode();
      }
    };

    checkOnboarding();
  }, [
    isAuthenticated,
    isLoading,
    user,
    router,
    maintenanceMode,
    enterMaintenanceMode,
  ]);

  if (maintenanceMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827]  px-6">
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-600">
            Maintenance
          </p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            We&apos;re tuning things up
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Your session was reset due to a connectivity issue. Please check
            your connection and try again shortly.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827]">
        <Loader size="lg" text="Loading..." textColor="slate" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <MealsProvider>
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827] flex flex-col">
        <main className={`flex-1 ${hideBottomNav ? "pb-0" : "pb-[70px]"}`}>
          {children}
        </main>
        {!hideBottomNav && <BottomNavBar />}
      </div>
    </MealsProvider>
  );
}

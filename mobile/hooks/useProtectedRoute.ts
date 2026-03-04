import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { useAuth } from "../contexts/AuthContext";

/**
 * Hook to protect routes based on authentication status
 * Redirects unauthenticated users to login
 * Redirects authenticated users away from auth routes
 */
export function useProtectedRoute(): void {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboardingGroup = segments[0] === "(onboarding)";
    const currentAuthRoute = segments[1];

    // Special auth pages that should be allowed regardless of auth state
    const specialAuthPages = ["callback", "reset-password", "email-verify"];
    const isSpecialAuthPage = inAuthGroup && currentAuthRoute && specialAuthPages.includes(currentAuthRoute);

    if (!isAuthenticated && !inAuthGroup) {
      // User is not authenticated and trying to access protected routes
      // Redirect to login
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup && !isSpecialAuthPage) {
      // User is authenticated but on regular auth routes (login, signup, forgot-password)
      // Redirect to onboarding or main app (but allow special auth pages)
      router.replace("/");
    }
  }, [isAuthenticated, segments, isLoading, router]);
}


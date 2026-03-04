import { Redirect } from "expo-router";
import { useEffect, useState, useMemo } from "react";
import { Platform, View, ActivityIndicator } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../utils/supabase";
import "../global.css";

export default function Index() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  // Memoize mobile web check - only runs once
  const isMobileWeb = useMemo(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return false;
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isMobileDevice =
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent
      );
    const isSmallScreen = window.innerWidth <= 768;

    return isMobileDevice || isSmallScreen;
  }, []);

  // Memoize special auth flow check - only runs once on mount
  const specialAuthRoute = useMemo(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return null;
    }

    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);

    // Check for password reset tokens
    if (
      hash.includes("type=recovery") ||
      searchParams.get("type") === "recovery"
    ) {
      return "/(auth)/reset-password";
    }

    // Check for email verification
    if (hash.includes("type=signup") || searchParams.get("type") === "signup") {
      return "/(auth)/callback";
    }

    // Check for OAuth tokens
    if (hash.includes("access_token") && hash.includes("refresh_token")) {
      return "/(auth)/callback";
    }

    return null;
  }, []);

  useEffect(() => {
    // Don't run until auth is ready
    if (authLoading) return;

    // Prevent double execution
    if (redirectPath) return;

    const determineRoute = async () => {
      // Handle special auth flows first
      if (specialAuthRoute) {
        setRedirectPath(specialAuthRoute);
        return;
      }

      // Handle mobile web download page
      if (isMobileWeb && !isAuthenticated) {
        setRedirectPath("/download-app");
        return;
      }

      // If not authenticated, go to login
      if (!isAuthenticated || !user) {
        setRedirectPath("/(auth)/login");
        return;
      }

      // User is authenticated - check onboarding status
      try {
        const { data, error } = await supabase
          .from("user_profile")
          .select("is_onboarding_complete, current_step")
          .eq("user_id", user.id)
          .maybeSingle(); // Use maybeSingle to avoid error if no profile

        // No profile or error - start onboarding
        if (error || !data) {
          setRedirectPath("/(onboarding)/language");
          return;
        }

        // Profile exists - check completion
        if (data.is_onboarding_complete) {
          setRedirectPath("/(tabs)/home");
        } else {
          // Route to current step
          const routes = [
            "/(onboarding)/language",
            "/(onboarding)/mood",
            "/(onboarding)/profile",
            "/(onboarding)/location",
            "/(onboarding)/height",
            "/(onboarding)/weight",
            "/(onboarding)/fitness",
            "/(onboarding)/target-muscle-group",
            "/(onboarding)/dietary",
            "/(onboarding)/finish",
          ];
          const step = data.current_step || 1;
          // If step is 9 or higher, go to finish
          if (step >= 9) {
            setRedirectPath("/(onboarding)/finish");
          } else {
            setRedirectPath(routes[step - 1] || routes[0]);
          }
        }
      } catch (error) {
        console.error("Error determining route:", error);
        setRedirectPath("/(onboarding)/language");
      }
    };

    determineRoute();
  }, [authLoading, isAuthenticated, user]);

  // Show loading while checking auth or determining route
  if (authLoading || !redirectPath) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  // Redirect to the determined path
  return <Redirect href={redirectPath as any} />;
}

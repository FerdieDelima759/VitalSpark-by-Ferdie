import { useRouter, usePathname, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

/**
 * Hook to detect mobile web access and redirect to download page
 * @param enabled - Whether to enable the redirect (default: true)
 */
export function useMobileWebRedirect(enabled: boolean = true) {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments() as string[];
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (!enabled || Platform.OS !== "web" || hasChecked) return;

    if (pathname === "/download-app" || segments.includes("download-app")) {
      setHasChecked(true);
      return;
    }

    const isMobile = () => {
      if (typeof window === "undefined") return false;

      const userAgent = window.navigator.userAgent.toLowerCase();
      const isMobileDevice =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
          userAgent
        );
      const isSmallScreen = window.innerWidth <= 768;

      return isMobileDevice || isSmallScreen;
    };

    const timer = setTimeout(() => {
      if (isMobile()) {
        try {
          router.replace("/download-app");
        } catch (error) {
          // Navigation not ready
        }
      }
      setHasChecked(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [enabled, pathname, segments, hasChecked]);
}

/**
 * Hook to detect desktop web access and redirect to login page
 * Use this on mobile-only pages like download-app
 */
export function useDesktopWebRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments() as string[];
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || hasChecked) return;

    if (
      pathname === "/(auth)/login" ||
      pathname === "/login" ||
      segments.includes("login") ||
      segments.includes("(auth)")
    ) {
      setHasChecked(true);
      return;
    }

    const isDesktop = () => {
      if (typeof window === "undefined") return false;

      const userAgent = window.navigator.userAgent.toLowerCase();
      const isMobileDevice =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
          userAgent
        );

      const isSmallScreen = window.innerWidth <= 768;

      return !isMobileDevice && !isSmallScreen;
    };

    const timer = setTimeout(() => {
      if (isDesktop()) {
        try {
          router.replace("/(auth)/login");
        } catch (error) {
          // Navigation not ready
        }
      }
      setHasChecked(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [pathname, segments, hasChecked]);
}

/**
 * Check if current device is mobile web
 * @returns boolean indicating if device is mobile web
 */
export function isMobileWeb(): boolean {
  if (Platform.OS !== "web") return false;
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isMobile =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent
    );

  const isSmallScreen = window.innerWidth <= 768;

  return isMobile || isSmallScreen;
}

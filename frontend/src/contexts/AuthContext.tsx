"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/api/supabase";
import { clearLocalStoragePreserveTheme } from "../utils/themeStorage";

// ===========================
// Context Type Definition
// ===========================

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

// ===========================
// Context Creation
// ===========================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===========================
// Provider Props
// ===========================

interface AuthProviderProps {
  children: ReactNode;
}

const AUTH_INIT_TIMEOUT_MS = 15000;
const AUTH_INIT_HARD_TIMEOUT_MS = 22000;
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
const LAST_ACTIVITY_KEY = "vs:last-activity-ts";
const ACTIVITY_WRITE_THROTTLE_MS = 10000;
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "pointerdown",
  "focus",
];

// ===========================
// Provider Component
// ===========================

export function AuthProvider({
  children,
}: AuthProviderProps): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const inactivityTimerRef = useRef<number | null>(null);
  const inactivitySignOutInProgressRef = useRef(false);
  const lastActivityWriteRef = useRef(0);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);

      // Clear session storage on logout
      if (typeof window !== "undefined") {
        const { clearUserSessionData } =
          await import("../utils/sessionStorage");
        clearUserSessionData();
        clearLocalStoragePreserveTheme();
      }
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }, []);

  const clearInactivityTimer = useCallback(() => {
    if (typeof window === "undefined") return;
    if (inactivityTimerRef.current !== null) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const readLastActivity = useCallback((): number | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(LAST_ACTIVITY_KEY);
      if (!raw) return null;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const writeLastActivity = useCallback((timestamp: number) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
    } catch {
      // Ignore storage write errors.
    }
  }, []);

  const handleInactiveSignOut = useCallback(async () => {
    if (inactivitySignOutInProgressRef.current) return;
    inactivitySignOutInProgressRef.current = true;
    clearInactivityTimer();

    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out inactive user:", error);
    } finally {
      if (typeof window !== "undefined") {
        window.location.replace("/auth/login?reason=inactive");
      }
    }
  }, [clearInactivityTimer, signOut]);

  const scheduleInactivityLogout = useCallback(() => {
    if (typeof window === "undefined") return;
    clearInactivityTimer();

    if (!session || !user) return;

    const now = Date.now();
    const storedLastActivity = readLastActivity();
    const lastActivity = storedLastActivity ?? now;

    if (!storedLastActivity) {
      writeLastActivity(lastActivity);
      lastActivityWriteRef.current = lastActivity;
    }

    const idleTime = now - lastActivity;
    const remaining = INACTIVITY_TIMEOUT_MS - idleTime;

    if (remaining <= 0) {
      void handleInactiveSignOut();
      return;
    }

    inactivityTimerRef.current = window.setTimeout(() => {
      void handleInactiveSignOut();
    }, remaining);
  }, [
    clearInactivityTimer,
    handleInactiveSignOut,
    readLastActivity,
    session,
    user,
    writeLastActivity,
  ]);

  useEffect(() => {
    let isMounted = true;

    const setAuthState = (nextSession: Session | null, nextUser: User | null) => {
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextUser);
    };

    const setLoadingState = (nextLoading: boolean) => {
      if (!isMounted) return;
      setIsLoading(nextLoading);
    };

    const withTimeout = async <T,>(
      promise: Promise<T>,
      timeoutMs: number,
      label: string
    ): Promise<T> => {
      return await new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        promise
          .then((result) => {
            clearTimeout(timeoutId);
            resolve(result);
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            reject(error);
          });
      });
    };

    // Check for existing session on mount
    const initializeAuth = async () => {
      const hardTimeoutId = window.setTimeout(() => {
        if (!isMounted) return;
        console.warn(
          `Auth initialization hard timeout (${AUTH_INIT_HARD_TIMEOUT_MS}ms). Falling back to signed-out state.`
        );
        setAuthState(null, null);
        setLoadingState(false);
      }, AUTH_INIT_HARD_TIMEOUT_MS);

      try {
        const {
          data: { session: currentSession },
          error,
        } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_INIT_TIMEOUT_MS,
          "supabase.auth.getSession"
        );

        if (error) {
          console.error("Error fetching session:", error);
          setAuthState(null, null);
        } else {
          setAuthState(currentSession, currentSession?.user ?? null);
        }
      } catch (error) {
        console.error("Unexpected error initializing auth:", error);
        setAuthState(null, null);
      } finally {
        window.clearTimeout(hardTimeoutId);
        setLoadingState(false);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      try {
        // Check if session is expired (token refresh may have failed silently)
        if (currentSession) {
          const expiresAt = currentSession.expires_at;
          if (expiresAt && expiresAt * 1000 < Date.now()) {
            // Session is expired, sign out
            console.warn("Session expired, signing out");
            setAuthState(null, null);
            await supabase.auth.signOut();
            if (typeof window !== "undefined") {
              const { clearUserSessionData } =
                await import("../utils/sessionStorage");
              clearUserSessionData();
            }
            return;
          }
        }

        if (event === "SIGNED_OUT") {
          setAuthState(null, null);
          // Clear session storage on logout
          if (typeof window !== "undefined") {
            const { clearUserSessionData } =
              await import("../utils/sessionStorage");
            clearUserSessionData();
          }
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          setAuthState(currentSession, currentSession?.user ?? null);

          // Fetch and store user data and role in session storage
          if (currentSession?.user) {
            try {
              const { setUserSessionData } =
                await import("../utils/sessionStorage");

              // Fetch user profile
              const { data: profileRows, error: profileError } = await supabase
                .from("user_profile")
                .select("*")
                .eq("user_id", currentSession.user.id)
                .limit(1);

              const profileData = profileRows?.[0] ?? null;

              // Fetch user role
              const { data: roleRows, error: roleError } = await supabase
                .from("user_role")
                .select("*")
                .eq("user_id", currentSession.user.id)
                .limit(1);

              const roleData = roleRows?.[0] ?? null;

              if (profileError) {
                console.error(
                  "Error fetching user profile during auth sync:",
                  profileError
                );
              }
              if (roleError) {
                console.error(
                  "Error fetching user role during auth sync:",
                  roleError
                );
              }

              // Store in session storage
              const isAdmin = roleData?.role?.toLowerCase() === "admin";
              setUserSessionData({
                userId: currentSession.user.id,
                userRole: roleData?.role || null,
                isAdmin,
                userProfile: profileData || null,
              });
            } catch (error) {
              console.error("Error storing user data in session storage:", error);
            }
          }
        } else {
          // Update session for other events
          setAuthState(currentSession, currentSession?.user ?? null);
        }
      } catch (error) {
        console.error("Error handling auth state change:", error);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!session || !user) {
      clearInactivityTimer();
      inactivitySignOutInProgressRef.current = false;
      lastActivityWriteRef.current = 0;
      return;
    }

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastActivityWriteRef.current >= ACTIVITY_WRITE_THROTTLE_MS) {
        lastActivityWriteRef.current = now;
        writeLastActivity(now);
      }
      scheduleInactivityLogout();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_KEY) {
        scheduleInactivityLogout();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        recordActivity();
      }
    };

    scheduleInactivityLogout();

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true });
    });
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInactivityTimer();
    };
  }, [clearInactivityTimer, scheduleInactivityLogout, session, user, writeLastActivity]);

  const contextValue: AuthContextType = {
    session,
    user,
    isLoading,
    isAuthenticated: !!session && !!user,
    signOut,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// ===========================
// Custom Hook
// ===========================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

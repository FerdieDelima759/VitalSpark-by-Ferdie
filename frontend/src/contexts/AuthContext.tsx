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
import { clearAuthStorage, supabase } from "../lib/api/supabase";
import { clearLocalStoragePreserveTheme } from "../utils/themeStorage";
import Dialog from "@/components/Dialog";

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
const SIGN_OUT_TIMEOUT_MS = 8000;
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
  const [showSessionTimeoutDialog, setShowSessionTimeoutDialog] =
    useState<boolean>(false);
  const inactivityTimerRef = useRef<number | null>(null);
  const inactivitySignOutInProgressRef = useRef(false);
  const lastActivityWriteRef = useRef(0);
  const authRecoveryInProgressRef = useRef(false);
  const hasShownSessionTimeoutDialogRef = useRef(false);

  const clearInactivityTimer = useCallback(() => {
    if (typeof window === "undefined") return;
    if (inactivityTimerRef.current !== null) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(`supabase.auth.signOut timed out after ${SIGN_OUT_TIMEOUT_MS}ms`)
          );
        }, SIGN_OUT_TIMEOUT_MS);
      });

      const { error } = await Promise.race([signOutPromise, timeoutPromise]);
      if (error) {
        throw error;
      }
    } catch (error) {
      // Fall back to a local sign-out so UI state does not get stuck waiting on network.
      console.warn(
        "Primary sign-out failed or timed out. Falling back to local sign-out.",
        error
      );
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (localError) {
        console.warn("Local sign-out fallback also failed:", localError);
      }
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      setSession(null);
      setUser(null);
      clearInactivityTimer();
      inactivitySignOutInProgressRef.current = false;
      lastActivityWriteRef.current = 0;

      // Clear session storage on logout
      if (typeof window !== "undefined") {
        const { clearUserSessionData } =
          await import("../utils/sessionStorage");
        clearUserSessionData();
        clearLocalStoragePreserveTheme();
      }
    }
  }, [clearInactivityTimer]);

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

    const showTimeoutDialog = () => {
      if (!isMounted || hasShownSessionTimeoutDialogRef.current) return;
      hasShownSessionTimeoutDialogRef.current = true;
      setShowSessionTimeoutDialog(true);
    };

    const recoverAuthStorage = async (reason: string) => {
      if (authRecoveryInProgressRef.current) return;
      authRecoveryInProgressRef.current = true;

      try {
        console.warn(`Attempting auth storage recovery due to ${reason}`);
        await clearAuthStorage();
      } catch (recoveryError) {
        console.error("Auth storage recovery failed:", recoveryError);
      } finally {
        try {
          const { clearUserSessionData } =
            await import("../utils/sessionStorage");
          clearUserSessionData();
        } catch (sessionError) {
          console.error("Error clearing user session storage:", sessionError);
        }
        setAuthState(null, null);
        authRecoveryInProgressRef.current = false;
      }
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
        showTimeoutDialog();
        void recoverAuthStorage("auth-init-hard-timeout");
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
          await recoverAuthStorage("auth-getSession-error");
        } else {
          setAuthState(currentSession, currentSession?.user ?? null);
        }
      } catch (error) {
        console.error("Unexpected error initializing auth:", error);
        if (
          error instanceof Error &&
          error.message.includes("supabase.auth.getSession timed out")
        ) {
          showTimeoutDialog();
        }
        await recoverAuthStorage("auth-getSession-timeout-or-exception");
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

  const handleSessionTimeoutDialogAction = () => {
    setShowSessionTimeoutDialog(false);
    if (typeof window !== "undefined") {
      window.location.replace("/auth/login?reason=session-timeout");
    }
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}

      <Dialog
        visible={showSessionTimeoutDialog}
        onDismiss={handleSessionTimeoutDialogAction}
        dismissible={false}
        showCloseButton={false}
        maxWidth={420}
      >
        <div className="text-center">
          <h2 className="text-lg font-extrabold text-slate-900 mb-2">
            Session Timeout
          </h2>
          <p className="text-sm text-slate-600 mb-5">
            Session timed out, you have been logged out
          </p>
          <button
            type="button"
            onClick={handleSessionTimeoutDialogAction}
            className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            OK
          </button>
        </div>
      </Dialog>
    </AuthContext.Provider>
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

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
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

// ===========================
// Provider Component
// ===========================

export function AuthProvider({
  children,
}: AuthProviderProps): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check for existing session on mount
    const initializeAuth = async () => {
      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Error fetching session:", error);
          setSession(null);
          setUser(null);
        } else {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
        }
      } catch (error) {
        console.error("Unexpected error initializing auth:", error);
        setSession(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      // Check if session is expired (token refresh may have failed silently)
      if (currentSession) {
        const expiresAt = currentSession.expires_at;
        if (expiresAt && expiresAt * 1000 < Date.now()) {
          // Session is expired, sign out
          console.warn("Session expired, signing out");
          setSession(null);
          setUser(null);
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
        setSession(null);
        setUser(null);
        // Clear session storage on logout
        if (typeof window !== "undefined") {
          const { clearUserSessionData } =
            await import("../utils/sessionStorage");
          clearUserSessionData();
        }
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

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
              console.error("Error fetching user profile during auth sync:", profileError);
            }
            if (roleError) {
              console.error("Error fetching user role during auth sync:", roleError);
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
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async (): Promise<void> => {
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
  };

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

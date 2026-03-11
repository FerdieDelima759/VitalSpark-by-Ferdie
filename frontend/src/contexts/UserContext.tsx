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
import {
  UserProfile,
  UserRole,
} from "../types/UserProfile";
import { supabase } from "../lib/api/supabase";
import {
  clearUserSessionData,
  setUserSessionData,
} from "../utils/sessionStorage";
import { useAuth } from "./AuthContext";

// ===========================
// Context Type Definition
// ===========================

export interface ProfileLoadingState {
  isLoading: boolean;
  isUpdating: boolean;
  isSaving: boolean;
  error: string | null;
}

interface UserContextType {
  userProfile: UserProfile | null;
  userRole: UserRole | null;
  loadingState: ProfileLoadingState;
  setUserProfile: (profile: UserProfile | null) => void;
  setUserRole: (role: UserRole | null) => void;
  refreshUserData: () => Promise<void>;
  clearUserData: () => void;
}

// ===========================
// Context Creation
// ===========================

const UserContext = createContext<UserContextType | undefined>(undefined);

// ===========================
// Provider Props
// ===========================

interface UserProviderProps {
  children: ReactNode;
}

const REQUEST_TIMEOUT_MS = 15000;

const withTimeout = async <T,>(
  promise: PromiseLike<T>,
  label: string,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

// ===========================
// Provider Component
// ===========================

export function UserProvider({
  children,
}: UserProviderProps): React.ReactElement {
  const { user, isLoading: isAuthLoading } = useAuth();
  const requestSequenceRef = useRef(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loadingState, setLoadingState] = useState<ProfileLoadingState>({
    isLoading: true,
    isUpdating: false,
    isSaving: false,
    error: null,
  });

  const clearUserData = useCallback((): void => {
    requestSequenceRef.current += 1;
    setUserProfile(null);
    setUserRole(null);
    setLoadingState({
      isLoading: false,
      isUpdating: false,
      isSaving: false,
      error: null,
    });
    if (typeof window !== "undefined") {
      clearUserSessionData();
    }
  }, []);

  const fetchUserData = useCallback(async (userId: string): Promise<void> => {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;

    try {
      setLoadingState((prev) => ({ ...prev, isLoading: true, error: null }));

      const [profileResult, roleResult] = await Promise.all([
        withTimeout(
          supabase.from("user_profile").select("*").eq("user_id", userId).limit(1),
          "fetch user_profile",
        ),
        withTimeout(
          supabase.from("user_role").select("*").eq("user_id", userId).limit(1),
          "fetch user_role",
        ),
      ]);

      const { data: profileRows, error: profileError } = profileResult;
      const { data: roleRows, error: roleError } = roleResult;

      const profileData = profileRows?.[0] ?? null;
      const roleData = roleRows?.[0] ?? null;

      if (profileError) {
        console.error("Error fetching user profile:", profileError);
      }

      if (roleError) {
        console.error("Error fetching user role:", roleError);
      }

      if (requestSequenceRef.current !== requestId) {
        return;
      }

      setUserProfile(profileData || null);
      setUserRole(roleData || null);

      // Store in session storage
      if (typeof window !== "undefined") {
        try {
          const isAdmin = roleData?.role?.toLowerCase() === "admin";
          setUserSessionData({
            userId,
            userRole: roleData?.role || null,
            isAdmin,
            userProfile: profileData || null,
          });
        } catch (error) {
          console.error("Error storing user data in session storage:", error);
        }
      }

      setLoadingState({
        isLoading: false,
        isUpdating: false,
        isSaving: false,
        error: profileError?.message || roleError?.message || null,
      });
    } catch (error: unknown) {
      if (requestSequenceRef.current !== requestId) {
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      console.error("Unexpected error fetching user data:", error);
      setLoadingState({
        isLoading: false,
        isUpdating: false,
        isSaving: false,
        error: errorMessage,
      });
    }
  }, []);

  const refreshUserData = useCallback(async (): Promise<void> => {
    if (!user?.id) {
      clearUserData();
      return;
    }
    await fetchUserData(user.id);
  }, [clearUserData, fetchUserData, user]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    const syncUserState = async () => {
      if (!user?.id) {
        clearUserData();
        return;
      }
      await fetchUserData(user.id);
    };

    void syncUserState();
  }, [clearUserData, fetchUserData, isAuthLoading, user]);

  const contextValue: UserContextType = {
    userProfile,
    userRole,
    loadingState,
    setUserProfile,
    setUserRole,
    refreshUserData,
    clearUserData,
  };

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
}

// ===========================
// Custom Hook
// ===========================

export function useUserContext(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}


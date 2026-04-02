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
  getUserSessionData,
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

const REQUEST_TIMEOUT_MS = 12000;
const REQUEST_RETRY_COUNT = 1;
const REQUEST_RETRY_DELAY_MS = 500;
const TIMEOUT_ERROR_FRAGMENT = "timed out after";
const ABORT_ERROR_FRAGMENT = "aborted";

const isTimeoutError = (message: string): boolean =>
  message.toLowerCase().includes(TIMEOUT_ERROR_FRAGMENT);

const isAbortError = (message: string): boolean => {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes(ABORT_ERROR_FRAGMENT) ||
    normalizedMessage.includes("aborterror")
  );
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "An unexpected error occurred";

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getCachedUserData = (
  userId: string,
): { profile: UserProfile | null; role: UserRole | null } => {
  if (typeof window === "undefined") {
    return { profile: null, role: null };
  }

  const sessionData = getUserSessionData();
  if (sessionData.userId !== userId) {
    return { profile: null, role: null };
  }

  const roleData: UserRole | null = sessionData.userRole
    ? { user_id: userId, role: sessionData.userRole }
    : null;

  return {
    profile: sessionData.userProfile ?? null,
    role: roleData,
  };
};

const withTimeout = async <T,>(
  promiseFactory: (signal: AbortSignal) => PromiseLike<T>,
  label: string,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
  externalSignal?: AbortSignal,
): Promise<T> => {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort();
  }, timeoutMs);

  const relayAbort = () => {
    timeoutController.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      timeoutController.abort();
    } else {
      externalSignal.addEventListener("abort", relayAbort, { once: true });
    }
  }

  try {
    return await Promise.resolve(promiseFactory(timeoutController.signal));
  } catch (error) {
    if (timeoutController.signal.aborted) {
      if (externalSignal?.aborted) {
        throw new Error(`${label} aborted`);
      }
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", relayAbort);
    }
  }
};

const withTimeoutRetry = async <T,>(
  promiseFactory: (signal: AbortSignal) => PromiseLike<T>,
  label: string,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
  retryCount: number = REQUEST_RETRY_COUNT,
  externalSignal?: AbortSignal,
): Promise<T> => {
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await withTimeout(
        promiseFactory,
        label,
        timeoutMs,
        externalSignal,
      );
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      if (isAbortError(errorMessage)) {
        throw error;
      }

      const canRetry =
        isTimeoutError(errorMessage) &&
        attempt < retryCount &&
        !externalSignal?.aborted;

      if (!canRetry) {
        throw error;
      }

      await delay(REQUEST_RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw new Error(`${label} failed after retry attempts`);
};

// ===========================
// Provider Component
// ===========================

export function UserProvider({
  children,
}: UserProviderProps): React.ReactElement {
  const { user, isLoading: isAuthLoading } = useAuth();
  const requestSequenceRef = useRef(0);
  const activeFetchAbortRef = useRef<AbortController | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loadingState, setLoadingState] = useState<ProfileLoadingState>({
    isLoading: true,
    isUpdating: false,
    isSaving: false,
    error: null,
  });

  const clearUserData = useCallback((): void => {
    activeFetchAbortRef.current?.abort();
    activeFetchAbortRef.current = null;
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
    activeFetchAbortRef.current?.abort();
    const fetchAbortController = new AbortController();
    activeFetchAbortRef.current = fetchAbortController;

    try {
      const cachedData = getCachedUserData(userId);
      const hasCachedData = Boolean(cachedData.profile || cachedData.role);

      setLoadingState((prev) => ({
        ...prev,
        isLoading: !hasCachedData,
        isUpdating: hasCachedData,
        error: null,
      }));

      if (hasCachedData) {
        if (cachedData.profile) {
          setUserProfile(cachedData.profile);
        }
        if (cachedData.role) {
          setUserRole(cachedData.role);
        }
      }

      const [profileSettled, roleSettled] = await Promise.allSettled([
        withTimeoutRetry(
          (signal) =>
            supabase
              .from("user_profile")
              .select("*")
              .eq("user_id", userId)
              .limit(1)
              .abortSignal(signal),
          "fetch user_profile",
          REQUEST_TIMEOUT_MS,
          REQUEST_RETRY_COUNT,
          fetchAbortController.signal,
        ),
        withTimeoutRetry(
          (signal) =>
            supabase
              .from("user_role")
              .select("*")
              .eq("user_id", userId)
              .limit(1)
              .abortSignal(signal),
          "fetch user_role",
          REQUEST_TIMEOUT_MS,
          REQUEST_RETRY_COUNT,
          fetchAbortController.signal,
        ),
      ]);

      if (
        requestSequenceRef.current !== requestId ||
        fetchAbortController.signal.aborted
      ) {
        return;
      }

      let profileRows: UserProfile[] | null = null;
      let roleRows: UserRole[] | null = null;
      let profileErrorMessage: string | null = null;
      let roleErrorMessage: string | null = null;

      if (profileSettled.status === "fulfilled") {
        const { data, error } = profileSettled.value;
        profileRows = (data as UserProfile[] | null) ?? null;
        if (error) {
          profileErrorMessage = error.message;
          if (!isTimeoutError(profileErrorMessage)) {
            console.error("Error fetching user profile:", error);
          } else {
            console.warn("Profile request timed out, falling back to cache.");
          }
        }
      } else {
        profileErrorMessage = getErrorMessage(profileSettled.reason);
        if (
          !isTimeoutError(profileErrorMessage) &&
          !isAbortError(profileErrorMessage)
        ) {
          console.error("Error fetching user profile:", profileSettled.reason);
        } else if (isTimeoutError(profileErrorMessage)) {
          console.warn("Profile request timed out, falling back to cache.");
        }
      }

      if (roleSettled.status === "fulfilled") {
        const { data, error } = roleSettled.value;
        roleRows = (data as UserRole[] | null) ?? null;
        if (error) {
          roleErrorMessage = error.message;
          if (!isTimeoutError(roleErrorMessage)) {
            console.error("Error fetching user role:", error);
          } else {
            console.warn("Role request timed out, falling back to cache.");
          }
        }
      } else {
        roleErrorMessage = getErrorMessage(roleSettled.reason);
        if (!isTimeoutError(roleErrorMessage) && !isAbortError(roleErrorMessage)) {
          console.error("Error fetching user role:", roleSettled.reason);
        } else if (isTimeoutError(roleErrorMessage)) {
          console.warn("Role request timed out, falling back to cache.");
        }
      }

      const fetchedProfile = profileRows?.[0] ?? null;
      const fetchedRole = roleRows?.[0] ?? null;

      const profileData = fetchedProfile ?? cachedData.profile;
      const roleData = fetchedRole ?? cachedData.role;
      const usedCachedProfile = !fetchedProfile && Boolean(cachedData.profile);
      const usedCachedRole = !fetchedRole && Boolean(cachedData.role);

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

      const visibleProfileError =
        usedCachedProfile && profileErrorMessage && isTimeoutError(profileErrorMessage)
          ? null
          : profileErrorMessage;
      const visibleRoleError =
        usedCachedRole && roleErrorMessage && isTimeoutError(roleErrorMessage)
          ? null
          : roleErrorMessage;

      setLoadingState({
        isLoading: false,
        isUpdating: false,
        isSaving: false,
        error: visibleProfileError || visibleRoleError || null,
      });
    } catch (error: unknown) {
      if (requestSequenceRef.current !== requestId) {
        return;
      }

      const errorMessage = getErrorMessage(error);
      if (
        requestSequenceRef.current !== requestId ||
        fetchAbortController.signal.aborted ||
        isAbortError(errorMessage)
      ) {
        return;
      }

      if (!isTimeoutError(errorMessage)) {
        console.error("Unexpected error fetching user data:", error);
      } else {
        console.warn("User data request timed out, falling back to cache.");
      }

      const cachedData = getCachedUserData(userId);
      if (
        isTimeoutError(errorMessage) &&
        (cachedData.profile !== null || cachedData.role !== null)
      ) {
        setUserProfile(cachedData.profile);
        setUserRole(cachedData.role);
        setLoadingState({
          isLoading: false,
          isUpdating: false,
          isSaving: false,
          error: null,
        });
        return;
      }

      setLoadingState({
        isLoading: false,
        isUpdating: false,
        isSaving: false,
        error: errorMessage,
      });
    } finally {
      if (activeFetchAbortRef.current === fetchAbortController) {
        activeFetchAbortRef.current = null;
      }
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

  useEffect(() => {
    return () => {
      activeFetchAbortRef.current?.abort();
      activeFetchAbortRef.current = null;
    };
  }, []);

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


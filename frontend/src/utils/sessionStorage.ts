/**
 * Session Storage utilities for user data
 */

import type { UserProfile } from "@/types/UserProfile";

const SESSION_STORAGE_KEYS = {
  USER_ROLE: "vitalspark_user_role",
  IS_ADMIN: "vitalspark_is_admin",
  USER_ID: "vitalspark_user_id",
  USER_PROFILE: "vitalspark_user_profile",
} as const;

export interface UserSessionData {
  userRole: string | null;
  isAdmin: boolean;
  userId: string | null;
  userProfile: UserProfile | null;
}

/**
 * Get user session data from session storage
 */
export function getUserSessionData(): UserSessionData {
  if (typeof window === "undefined") {
    return {
      userRole: null,
      isAdmin: false,
      userId: null,
      userProfile: null,
    };
  }

  try {
    const userRole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);
    const isAdmin = sessionStorage.getItem(SESSION_STORAGE_KEYS.IS_ADMIN) === "true";
    const userId = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID);
    const userProfileStr = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_PROFILE);
    let userProfile: UserProfile | null = null;

    if (userProfileStr) {
      try {
        userProfile = JSON.parse(userProfileStr) as UserProfile;
      } catch (e) {
        console.error("Error parsing user profile from session storage:", e);
      }
    }

    return {
      userRole,
      isAdmin,
      userId,
      userProfile,
    };
  } catch (error) {
    console.error("Error reading from session storage:", error);
    return {
      userRole: null,
      isAdmin: false,
      userId: null,
      userProfile: null,
    };
  }
}

/**
 * Set user session data in session storage
 */
export function setUserSessionData(data: Partial<UserSessionData>): void {
  if (typeof window === "undefined") return;

  try {
    if (data.userRole !== undefined) {
      if (data.userRole) {
        sessionStorage.setItem(SESSION_STORAGE_KEYS.USER_ROLE, data.userRole);
      } else {
        sessionStorage.removeItem(SESSION_STORAGE_KEYS.USER_ROLE);
      }
      // Dispatch custom event for same-window updates
      window.dispatchEvent(new Event("sessionStorageChange"));
    }

    if (data.isAdmin !== undefined) {
      sessionStorage.setItem(
        SESSION_STORAGE_KEYS.IS_ADMIN,
        data.isAdmin.toString()
      );
      // Dispatch custom event for same-window updates
      window.dispatchEvent(new Event("sessionStorageChange"));
    }

    if (data.userId !== undefined) {
      if (data.userId) {
        sessionStorage.setItem(SESSION_STORAGE_KEYS.USER_ID, data.userId);
      } else {
        sessionStorage.removeItem(SESSION_STORAGE_KEYS.USER_ID);
      }
    }

    if (data.userProfile !== undefined) {
      if (data.userProfile) {
        sessionStorage.setItem(
          SESSION_STORAGE_KEYS.USER_PROFILE,
          JSON.stringify(data.userProfile)
        );
      } else {
        sessionStorage.removeItem(SESSION_STORAGE_KEYS.USER_PROFILE);
      }
    }
  } catch (error) {
    console.error("Error writing to session storage:", error);
  }
}

/**
 * Clear all user session data
 */
export function clearUserSessionData(): void {
  if (typeof window === "undefined") return;

  try {
    Object.values(SESSION_STORAGE_KEYS).forEach((key) => {
      sessionStorage.removeItem(key);
    });
  } catch (error) {
    console.error("Error clearing session storage:", error);
  }
}

/**
 * Check if user is admin from session storage
 */
export function isAdminFromStorage(): boolean {
  const data = getUserSessionData();
  return data.isAdmin;
}


"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/api/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  setUserSessionData,
  clearUserSessionData,
  getUserSessionData,
} from "../utils/sessionStorage";

export interface UserRole {
  user_id: string;
  role: string;
}

export function useUserRole() {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserRole = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Check session storage first
      const sessionData = getUserSessionData();
      if (sessionData.userId === userId && sessionData.userRole) {
        setUserRole({
          user_id: userId,
          role: sessionData.userRole,
        });
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("user_role")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (fetchError) {
        // If no role found, that's okay - user just doesn't have a role assigned
        if (fetchError.code === "PGRST116") {
          setUserRole(null);
          setUserSessionData({
            userRole: null,
            isAdmin: false,
            userId,
          });
          return;
        }
        throw fetchError;
      }

      const roleData = data as UserRole;
      const isAdmin = roleData.role?.toLowerCase() === "admin";

      // Store in session storage
      setUserSessionData({
        userRole: roleData.role,
        isAdmin,
        userId,
      });

      setUserRole(roleData);
    } catch (err: any) {
      console.error("Error fetching user role:", err);
      setError(err.message || "Failed to fetch user role");
      setUserRole(null);
      setUserSessionData({
        userRole: null,
        isAdmin: false,
        userId,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchUserRole(user.id);
    } else {
      setUserRole(null);
      clearUserSessionData();
      setIsLoading(false);
    }
  }, [user?.id, fetchUserRole]);

  const isAdmin = userRole?.role?.toLowerCase() === "admin";

  return {
    userRole,
    isAdmin,
    isLoading,
    error,
    refetch: () => user?.id && fetchUserRole(user.id),
  };
}


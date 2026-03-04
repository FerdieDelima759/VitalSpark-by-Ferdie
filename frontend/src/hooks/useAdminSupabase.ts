"use client";

import { useState, useEffect } from "react";
import { getAdminSupabaseClient } from "../lib/api/supabase";
import { useAuth } from "../contexts/AuthContext";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Hook to get Supabase client with service key for admin operations
 * 
 * This hook verifies the user's role from the user_role table (not from auth)
 * and returns a Supabase client with service key privileges if they are admin.
 * 
 * @returns Supabase client with service key or null if not admin
 */
export function useAdminSupabase(): SupabaseClient | null {
  const { user } = useAuth();
  const [adminClient, setAdminClient] = useState<SupabaseClient | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchAdminClient = async () => {
      if (!user?.id) {
        setAdminClient(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        // Verify role from user_role table and get admin client
        const client = await getAdminSupabaseClient(user.id);
        setAdminClient(client);
      } catch (error) {
        console.error("Error getting admin client:", error);
        setAdminClient(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdminClient();
  }, [user?.id]);

  return adminClient;
}


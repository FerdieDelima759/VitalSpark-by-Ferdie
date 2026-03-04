import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  UserProfile,
  UserRole,
  ProfileLoadingState,
} from "../types/UserProfile";
import { supabase } from "../utils/supabase";

// ===========================
// Context Type Definition
// ===========================

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

// ===========================
// Provider Component
// ===========================

export function UserProvider({
  children,
}: UserProviderProps): React.ReactElement {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loadingState, setLoadingState] = useState<ProfileLoadingState>({
    isLoading: true,
    isUpdating: false,
    isSaving: false,
    error: null,
  });

  const fetchUserData = async (): Promise<void> => {
    try {
      setLoadingState((prev) => ({ ...prev, isLoading: true, error: null }));

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setUserProfile(null);
        setUserRole(null);
        setLoadingState({
          isLoading: false,
          isUpdating: false,
          isSaving: false,
          error: authError?.message || "No authenticated user",
        });
        return;
      }

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from("user_profile")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        console.error("Error fetching user profile:", profileError);
        setLoadingState((prev) => ({
          ...prev,
          isLoading: false,
          error: profileError.message,
        }));
        return;
      }

      // Fetch user role
      const { data: roleData, error: roleError } = await supabase
        .from("user_role")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (roleError && roleError.code !== "PGRST116") {
        console.error("Error fetching user role:", roleError);
      }

      setUserProfile(profileData || null);
      setUserRole(roleData || null);
      setLoadingState({
        isLoading: false,
        isUpdating: false,
        isSaving: false,
        error: null,
      });
    } catch (error: any) {
      console.error("Unexpected error fetching user data:", error);
      setLoadingState({
        isLoading: false,
        isUpdating: false,
        isSaving: false,
        error: error.message || "An unexpected error occurred",
      });
    }
  };

  const refreshUserData = async (): Promise<void> => {
    await fetchUserData();
  };

  const clearUserData = (): void => {
    setUserProfile(null);
    setUserRole(null);
    setLoadingState({
      isLoading: false,
      isUpdating: false,
      isSaving: false,
      error: null,
    });
  };

  useEffect(() => {
    fetchUserData();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          await fetchUserData();
        } else if (event === "SIGNED_OUT") {
          clearUserData();
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
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

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../utils/supabase";

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
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      
      // Clear AsyncStorage on mobile (not web)
      if (Platform.OS !== "web") {
        try {
          // Clear all user-related data from AsyncStorage
          await AsyncStorage.multiRemove([
            "vitalspark_user_role",
            "vitalspark_is_admin",
            "vitalspark_user_id",
            "vitalspark_user_profile",
            // Note: Keeping i18nextLng to preserve language preference
          ]);
        } catch (storageError) {
          console.error("Error clearing AsyncStorage:", storageError);
          // Don't throw - storage clearing is not critical for sign out
        }
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

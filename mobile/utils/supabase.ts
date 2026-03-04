import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Custom storage adapter that works across all platforms
const createCustomStorage = () => {
    // For web, use localStorage if available (client-side)
    if (Platform.OS === 'web') {
        return {
            getItem: async (key: string) => {
                try {
                    if (typeof window !== 'undefined' && window.localStorage) {
                        const value = window.localStorage.getItem(key);
                        // Validate that the stored value is valid JSON if it exists
                        if (value) {
                            try {
                                JSON.parse(value);
                                return value;
                            } catch (parseError) {
                                // Invalid JSON in storage, remove it
                                console.warn(`Invalid JSON in storage for key ${key}, removing...`);
                                window.localStorage.removeItem(key);
                                return null;
                            }
                        }
                        return value;
                    }
                    return null;
                } catch (error) {
                    console.error('Error getting item from storage:', error);
                    return null;
                }
            },
            setItem: async (key: string, value: string) => {
                try {
                    if (typeof window !== 'undefined' && window.localStorage) {
                        window.localStorage.setItem(key, value);
                    }
                } catch (error) {
                    console.error('Error setting item in storage:', error);
                }
            },
            removeItem: async (key: string) => {
                try {
                    if (typeof window !== 'undefined' && window.localStorage) {
                        window.localStorage.removeItem(key);
                    }
                } catch (error) {
                    console.error('Error removing item from storage:', error);
                }
            },
        };
    }

    // For native platforms, use AsyncStorage
    return AsyncStorage;
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables. Please check your .env.local file.'
    );
}

// Create redirect URI for deep linking
export const getRedirectUri = (route: string = '(auth)/callback'): string => {
    if (Platform.OS === 'web') {
        // For web, use the current origin
        if (typeof window !== 'undefined') {
            return `${window.location.origin}/${route}`;
        }
        return `http://localhost:8081/${route}`;
    }

    // For native platforms, use the app scheme
    try {
        const url = Linking.createURL(route);
        return url;
    } catch (error) {
        // Fallback
        return `vitalspark://${route}`;
    }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: createCustomStorage(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
    },
});

// Handle session errors and clear invalid sessions
supabase.auth.onAuthStateChange((event, session) => {
    // Removed console logs for cleaner user experience
    // Auth state changes are handled by AuthContext
});

// Clear invalid session on initialization
const clearInvalidSession = async () => {
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
            console.warn('Invalid session detected, clearing...', error.message);
            await supabase.auth.signOut();
        }
    } catch (error) {
        console.error('Error checking session:', error);
        // Clear storage if there's an error
        try {
            await supabase.auth.signOut();
        } catch (signOutError) {
            console.error('Error signing out:', signOutError);
        }
    }
};

// Only run on client-side for web
if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
        clearInvalidSession();
    }
} else {
    // Run immediately for native platforms
    clearInvalidSession();
}

// Utility function to manually clear all auth storage
export const clearAuthStorage = async (): Promise<void> => {
    try {
        await supabase.auth.signOut();
        const storage = createCustomStorage();

        // Clear all Supabase auth keys
        const authKeys = [
            'supabase.auth.token',
            'sb-auth-token',
            `sb-${supabaseUrl.split('//')[1]?.split('.')[0]}-auth-token`,
        ];

        for (const key of authKeys) {
            await storage.removeItem(key);
        }

        console.log('Auth storage cleared successfully');
    } catch (error) {
        console.error('Error clearing auth storage:', error);
    }
};


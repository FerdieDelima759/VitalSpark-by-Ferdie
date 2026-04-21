import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY) as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables. Please check your .env.local file.'
    );
}

// Create redirect URI for web only
export const getRedirectUri = (route: string = 'auth/callback'): string => {
    if (typeof window !== 'undefined') {
        return `${window.location.origin}/${route}`;
    }
    return `http://localhost:3000/${route}`;
};

const DEFAULT_SUPABASE_FETCH_TIMEOUT_MS = 90000;
const parsedSupabaseFetchTimeoutMs = Number(
    process.env.NEXT_PUBLIC_SUPABASE_FETCH_TIMEOUT_MS ?? ''
);
const SUPABASE_FETCH_TIMEOUT_MS =
    Number.isFinite(parsedSupabaseFetchTimeoutMs) && parsedSupabaseFetchTimeoutMs > 0
        ? parsedSupabaseFetchTimeoutMs
        : DEFAULT_SUPABASE_FETCH_TIMEOUT_MS;

// Custom fetch with timeout to prevent hanging requests
const fetchWithTimeout = (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
    const timeout = SUPABASE_FETCH_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.warn(`⏰ Supabase fetch timeout after ${timeout}ms:`, url);
        controller.abort();
    }, timeout);

    return fetch(url, {
        ...options,
        signal: controller.signal,
    }).finally(() => {
        clearTimeout(timeoutId);
    });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
    global: {
        headers: {
            'apikey': supabaseAnonKey,
        },
        fetch: fetchWithTimeout,
    },
});

const getProjectRefFromUrl = (): string => {
    try {
        const host = supabaseUrl.split('//')[1] || '';
        return host.split('.')[0] || '';
    } catch {
        return '';
    }
};

export const clearSupabaseAuthStorageKeys = (): void => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }

    const projectRef = getProjectRefFromUrl();
    const explicitKeys = new Set<string>([
        'supabase.auth.token',
        'sb-auth-token',
        projectRef ? `sb-${projectRef}-auth-token` : '',
    ].filter(Boolean));

    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (!key) continue;

        const isKnownKey = explicitKeys.has(key);
        const isSupabaseAuthToken =
            key.startsWith('sb-') && key.includes('-auth-token');
        const isSupabaseCodeVerifier =
            key.startsWith('sb-') && key.includes('-code-verifier');
        const isLegacyAuthKey = key.includes('supabase.auth.token');

        if (
            isKnownKey ||
            isSupabaseAuthToken ||
            isSupabaseCodeVerifier ||
            isLegacyAuthKey
        ) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach((key) => {
        window.localStorage.removeItem(key);
    });
};

// Log configuration in development to help debug CORS issues
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('Supabase Configuration:', {
        url: supabaseUrl,
        origin: window.location.origin,
        hasAnonKey: !!supabaseAnonKey,
    });
}

// Clear invalid session on initialization (client-side only)
if (typeof window !== 'undefined') {
    supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
            // Clear invalid session
            supabase.auth
                .signOut()
                .catch(signOutError =>
                    console.warn('Failed to sign out after session error:', signOutError)
                );
        } else if (data?.session) {
            // Check if token is expired
            const expiresAt = data.session.expires_at;
            if (expiresAt && expiresAt * 1000 < Date.now()) {
                // Token is expired, try to refresh or sign out
                supabase.auth.refreshSession()
                    .then(({ error: refreshError }) => {
                        if (refreshError) {
                            // Refresh failed, clear session
                            supabase.auth.signOut().catch(() => { });
                        }
                    })
                    .catch(() => {
                        // Refresh failed, clear session
                        supabase.auth.signOut().catch(() => { });
                    });
            }
        }
    });
}

// Utility function to manually clear all auth storage
export const clearAuthStorage = async (): Promise<void> => {
    try {
        const signOutWithTimeout = Promise.race([
            supabase.auth.signOut(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('supabase.auth.signOut timed out')), 4000)
            ),
        ]);

        await signOutWithTimeout;
    } catch (error) {
        console.error('Error clearing auth storage:', error);
    } finally {
        clearSupabaseAuthStorageKeys();
    }
};

/**
 * Verify if a user has admin role by checking the user_role table
 * 
 * @param userId - The user ID to check
 * @returns Promise that resolves to true if user is admin, false otherwise
 */
export const verifyAdminRole = async (userId: string): Promise<boolean> => {
    try {
        if (!userId) {
            return false;
        }

        const { data, error } = await supabase
            .from('user_role')
            .select('role')
            .eq('user_id', userId)
            .single();

        if (error) {
            // If no role found, user is not admin
            if (error.code === 'PGRST116') {
                return false;
            }
            console.error('Error verifying admin role:', error);
            return false;
        }

        return data?.role?.toLowerCase() === 'admin';
    } catch (error) {
        console.error('Error verifying admin role:', error);
        return false;
    }
};

/**
 * Get Supabase client with service key for admin operations
 * 
 * This function verifies the user's role from the user_role table (not from auth)
 * before granting admin access. The service key bypasses Row Level Security (RLS).
 * 
 * WARNING: The service key has full database access and should ONLY be used for admin operations.
 * 
 * @param userId - The user ID to verify admin role from user_role table
 * @returns Promise that resolves to Supabase client with service key if admin, otherwise null
 */
export const getAdminSupabaseClient = async (userId: string): Promise<SupabaseClient | null> => {
    if (!userId) {
        console.warn('getAdminSupabaseClient: No user ID provided. Returning null.');
        return null;
    }

    // Verify admin role from user_role table (not from auth)
    const isAdmin = await verifyAdminRole(userId);

    if (!isAdmin) {
        console.warn('getAdminSupabaseClient: User is not an admin according to user_role table. Returning null.');
        return null;
    }

    if (!supabaseServiceKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is not set. Admin operations will not work.');
        return null;
    }

    // Create a client with service key for admin operations
    // This bypasses RLS and should only be used for admin operations
    // We disable session persistence and auto-refresh to prevent CORS issues
    // The service key allows auth.admin operations but regular auth operations may fail
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storage: undefined, // Disable storage to prevent session checks
        },
        global: {
            headers: {
                'apikey': supabaseServiceKey,
            },
        },
    });

    // Override signOut to prevent CORS errors - admin client shouldn't use regular auth
    if (typeof window !== 'undefined') {
        const originalSignOut = adminClient.auth.signOut.bind(adminClient.auth);
        adminClient.auth.signOut = async () => {
            try {
                return await originalSignOut();
            } catch (error) {
                // Silently fail - admin client doesn't need to sign out
                console.warn('Admin client signOut failed (expected):', error);
                return { error: null };
            }
        };
    }

    return adminClient;
};


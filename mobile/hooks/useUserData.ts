import { useState, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import {
    UserProfile,
    UserRole,
    ProfileUpdatePayload,
    ProfileUpdateResponse,
    ApiError,
} from '../types/UserProfile';
import { useUserContext } from '../contexts/UserContext';

// ===========================
// Hook Interface
// ===========================

interface UseUserDataReturn {
    // Profile operations
    fetchUserProfile: (userId: string) => Promise<ProfileUpdateResponse>;
    createUserProfile: (profile: UserProfile) => Promise<ProfileUpdateResponse>;
    updateUserProfile: (
        userId: string,
        updates: ProfileUpdatePayload
    ) => Promise<ProfileUpdateResponse>;
    upsertUserProfile: (profile: UserProfile) => Promise<ProfileUpdateResponse>;
    deleteUserProfile: (userId: string) => Promise<ProfileUpdateResponse>;

    // Role operations
    fetchUserRole: (userId: string) => Promise<{ success: boolean; data?: UserRole; error?: string }>;
    createUserRole: (role: UserRole) => Promise<{ success: boolean; data?: UserRole; error?: string }>;
    updateUserRole: (
        userId: string,
        role: string
    ) => Promise<{ success: boolean; data?: UserRole; error?: string }>;
    upsertUserRole: (role: UserRole) => Promise<{ success: boolean; data?: UserRole; error?: string }>;

    // State
    isLoading: boolean;
    error: string | null;
}

// ===========================
// Custom Hook
// ===========================

export function useUserData(): UseUserDataReturn {
    const { setUserProfile, setUserRole, refreshUserData } = useUserContext();
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // ===========================
    // Error Handler
    // ===========================

    const handleError = useCallback((error: any): ApiError => {
        if (error?.message) {
            return {
                message: error.message,
                code: error.code || error.status_code,
                statusCode: error.status || 500,
            };
        }
        return {
            message: 'An unexpected error occurred. Please try again.',
            statusCode: 500,
        };
    }, []);

    // ===========================
    // Profile Operations
    // ===========================

    const fetchUserProfile = useCallback(
        async (userId: string): Promise<ProfileUpdateResponse> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!userId.trim()) {
                    return {
                        success: false,
                        error: 'User ID is required',
                    };
                }

                const { data, error: fetchError } = await supabase
                    .from('user_profile')
                    .select('*')
                    .eq('user_id', userId)
                    .single();

                if (fetchError) {
                    const apiError = handleError(fetchError);
                    setError(apiError.message);
                    return {
                        success: false,
                        error: apiError.message,
                    };
                }

                if (data) {
                    setUserProfile(data as UserProfile);
                }

                return {
                    success: true,
                    error: null,
                    data: data as UserProfile,
                };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return {
                    success: false,
                    error: apiError.message,
                };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError, setUserProfile]
    );

    const createUserProfile = useCallback(
        async (profile: UserProfile): Promise<ProfileUpdateResponse> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!profile.user_id) {
                    return {
                        success: false,
                        error: 'User ID is required',
                    };
                }

                const profileData = {
                    ...profile,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };

                const { data, error: insertError } = await supabase
                    .from('user_profile')
                    .insert([profileData])
                    .select()
                    .single();

                if (insertError) {
                    const apiError = handleError(insertError);
                    setError(apiError.message);
                    return {
                        success: false,
                        error: apiError.message,
                    };
                }

                if (data) {
                    setUserProfile(data as UserProfile);
                    await refreshUserData();
                }

                return {
                    success: true,
                    error: null,
                    data: data as UserProfile,
                };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return {
                    success: false,
                    error: apiError.message,
                };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError, setUserProfile, refreshUserData]
    );

    const updateUserProfile = useCallback(
        async (
            userId: string,
            updates: ProfileUpdatePayload
        ): Promise<ProfileUpdateResponse> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!userId.trim()) {
                    return {
                        success: false,
                        error: 'User ID is required',
                    };
                }

                const updateData = {
                    ...updates,
                    updated_at: new Date().toISOString(),
                };

                const { data, error: updateError } = await supabase
                    .from('user_profile')
                    .update(updateData)
                    .eq('user_id', userId)
                    .select()
                    .single();

                if (updateError) {
                    const apiError = handleError(updateError);
                    setError(apiError.message);
                    return {
                        success: false,
                        error: apiError.message,
                    };
                }

                if (data) {
                    setUserProfile(data as UserProfile);
                    await refreshUserData();
                }

                return {
                    success: true,
                    error: null,
                    data: data as UserProfile,
                };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return {
                    success: false,
                    error: apiError.message,
                };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError, setUserProfile, refreshUserData]
    );

    const upsertUserProfile = useCallback(
        async (profile: UserProfile): Promise<ProfileUpdateResponse> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!profile.user_id) {
                    return {
                        success: false,
                        error: 'User ID is required',
                    };
                }

                const profileData = {
                    ...profile,
                    updated_at: new Date().toISOString(),
                };

                const { data, error: upsertError } = await supabase
                    .from('user_profile')
                    .upsert(profileData, {
                        onConflict: 'user_id',
                    })
                    .select()
                    .single();

                if (upsertError) {
                    const apiError = handleError(upsertError);
                    setError(apiError.message);
                    return {
                        success: false,
                        error: apiError.message,
                    };
                }

                if (data) {
                    setUserProfile(data as UserProfile);
                    await refreshUserData();
                }

                return {
                    success: true,
                    error: null,
                    data: data as UserProfile,
                };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return {
                    success: false,
                    error: apiError.message,
                };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError, setUserProfile, refreshUserData]
    );

    const deleteUserProfile = useCallback(
        async (userId: string): Promise<ProfileUpdateResponse> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!userId.trim()) {
                    return {
                        success: false,
                        error: 'User ID is required',
                    };
                }

                const { error: deleteError } = await supabase
                    .from('user_profile')
                    .delete()
                    .eq('user_id', userId);

                if (deleteError) {
                    const apiError = handleError(deleteError);
                    setError(apiError.message);
                    return {
                        success: false,
                        error: apiError.message,
                    };
                }

                setUserProfile(null);
                await refreshUserData();

                return {
                    success: true,
                    error: null,
                };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return {
                    success: false,
                    error: apiError.message,
                };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError, setUserProfile, refreshUserData]
    );

    // ===========================
    // Role Operations
    // ===========================

    const fetchUserRole = useCallback(
        async (userId: string): Promise<{ success: boolean; data?: UserRole; error?: string }> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!userId.trim()) {
                    return {
                        success: false,
                        error: 'User ID is required',
                    };
                }

                const { data, error: fetchError } = await supabase
                    .from('user_role')
                    .select('*')
                    .eq('user_id', userId)
                    .single();

                if (fetchError) {
                    const apiError = handleError(fetchError);
                    setError(apiError.message);
                    return {
                        success: false,
                        error: apiError.message,
                    };
                }

                if (data) {
                    setUserRole(data as UserRole);
                }

                return {
                    success: true,
                    data: data as UserRole,
                };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return {
                    success: false,
                    error: apiError.message,
                };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError, setUserRole]
    );

    const createUserRole = useCallback(
        async (role: UserRole): Promise<{ success: boolean; data?: UserRole; error?: string }> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!role.user_id) {
                    return {
                        success: false,
                        error: 'User ID is required',
                    };
                }

                const { data, error: insertError } = await supabase
                    .from('user_role')
                    .insert([role])
                    .select()
                    .single();

                if (insertError) {
                    const apiError = handleError(insertError);
                    setError(apiError.message);
                    return {
                        success: false,
                        error: apiError.message,
                    };
                }

                if (data) {
                    setUserRole(data as UserRole);
                    await refreshUserData();
                }

                return {
                    success: true,
                    data: data as UserRole,
                };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return {
                    success: false,
                    error: apiError.message,
                };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError, setUserRole, refreshUserData]
    );

    const updateUserRole = useCallback(
        async (
            userId: string,
            role: string
        ): Promise<{ success: boolean; data?: UserRole; error?: string }> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!userId.trim()) {
                    return {
                        success: false,
                        error: 'User ID is required',
                    };
                }

                const { data, error: updateError } = await supabase
                    .from('user_role')
                    .update({ role })
                    .eq('user_id', userId)
                    .select()
                    .single();

                if (updateError) {
                    const apiError = handleError(updateError);
                    setError(apiError.message);
                    return {
                        success: false,
                        error: apiError.message,
                    };
                }

                if (data) {
                    setUserRole(data as UserRole);
                    await refreshUserData();
                }

                return {
                    success: true,
                    data: data as UserRole,
                };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return {
                    success: false,
                    error: apiError.message,
                };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError, setUserRole, refreshUserData]
    );

    const upsertUserRole = useCallback(
        async (role: UserRole): Promise<{ success: boolean; data?: UserRole; error?: string }> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!role.user_id) {
                    return {
                        success: false,
                        error: 'User ID is required',
                    };
                }

                const { data, error: upsertError } = await supabase
                    .from('user_role')
                    .upsert(role, {
                        onConflict: 'user_id',
                    })
                    .select()
                    .single();

                if (upsertError) {
                    const apiError = handleError(upsertError);
                    setError(apiError.message);
                    return {
                        success: false,
                        error: apiError.message,
                    };
                }

                if (data) {
                    setUserRole(data as UserRole);
                    await refreshUserData();
                }

                return {
                    success: true,
                    data: data as UserRole,
                };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return {
                    success: false,
                    error: apiError.message,
                };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError, setUserRole, refreshUserData]
    );

    // ===========================
    // Return Hook Interface
    // ===========================

    return {
        // Profile operations
        fetchUserProfile,
        createUserProfile,
        updateUserProfile,
        upsertUserProfile,
        deleteUserProfile,

        // Role operations
        fetchUserRole,
        createUserRole,
        updateUserRole,
        upsertUserRole,

        // State
        isLoading,
        error,
    };
}


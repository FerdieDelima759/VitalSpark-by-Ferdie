import { useState, useCallback } from "react";
import { supabase } from "../utils/supabase";
import {
    UserWorkoutTag,
    UserWorkoutPlan,
    UserWorkoutPlanWithTags,
    UserWorkoutPlanFull,
    UserWorkoutPlanExercise,
    UserWorkoutPlanExerciseWithDetails,
    UserWorkoutPlanExerciseDetails,
    UserWorkoutPlanCreatePayload,
    UserWorkoutPlanUpdatePayload,
    UserWorkoutPlanExerciseCreatePayload,
    UserWorkoutPlanExerciseUpdatePayload,
    UserWorkoutPlanExerciseDetailsCreatePayload,
    UserWorkoutPlanExerciseDetailsUpdatePayload,
    UserWorkoutDataResponse,
    ApiError,
} from "../types/UserWorkout";
import { useUserWorkoutContext } from "../contexts/UserWorkoutContext";

// ===========================
// Hook Interface
// ===========================

interface UseUserWorkoutDataReturn {
    // User Workout Plan Operations
    fetchUserWorkoutPlans: (
        userId: string
    ) => Promise<UserWorkoutDataResponse<UserWorkoutPlan[]>>;
    fetchUserWorkoutPlanById: (
        planId: string
    ) => Promise<UserWorkoutDataResponse<UserWorkoutPlan>>;
    fetchUserWorkoutPlanWithTags: (
        planId: string
    ) => Promise<UserWorkoutDataResponse<UserWorkoutPlanWithTags>>;
    fetchUserWorkoutPlanFull: (
        planId: string
    ) => Promise<UserWorkoutDataResponse<UserWorkoutPlanFull>>;
    createUserWorkoutPlan: (
        payload: UserWorkoutPlanCreatePayload
    ) => Promise<UserWorkoutDataResponse<UserWorkoutPlan>>;
    updateUserWorkoutPlan: (
        planId: string,
        payload: UserWorkoutPlanUpdatePayload
    ) => Promise<UserWorkoutDataResponse<UserWorkoutPlan>>;
    deleteUserWorkoutPlan: (
        planId: string
    ) => Promise<UserWorkoutDataResponse<void>>;
    fetchUserWorkoutPlansByLevel: (
        userId: string,
        level: string
    ) => Promise<UserWorkoutDataResponse<UserWorkoutPlan[]>>;
    fetchUserWorkoutPlansByCategory: (
        userId: string,
        category: string
    ) => Promise<UserWorkoutDataResponse<UserWorkoutPlan[]>>;

    // User Workout Plan Tags Operations
    addTagToUserWorkoutPlan: (
        planId: string,
        tagId: string
    ) => Promise<UserWorkoutDataResponse<void>>;
    removeTagFromUserWorkoutPlan: (
        planId: string,
        tagId: string
    ) => Promise<UserWorkoutDataResponse<void>>;
    fetchTagsForUserWorkoutPlan: (
        planId: string
    ) => Promise<UserWorkoutDataResponse<UserWorkoutTag[]>>;

    // User Workout Plan Exercise Operations
    fetchExercisesForUserWorkoutPlan: (
        planId: string
    ) => Promise<UserWorkoutDataResponse<UserWorkoutPlanExercise[]>>;
    fetchExercisesForUserWorkoutPlanWithDetails: (
        planId: string
    ) => Promise<UserWorkoutDataResponse<UserWorkoutPlanExerciseWithDetails[]>>;
    addExerciseToUserWorkoutPlan: (
        payload: UserWorkoutPlanExerciseCreatePayload
    ) => Promise<UserWorkoutDataResponse<UserWorkoutPlanExercise>>;
    updateUserWorkoutPlanExercise: (
        planId: string,
        exerciseId: string,
        payload: UserWorkoutPlanExerciseUpdatePayload
    ) => Promise<UserWorkoutDataResponse<UserWorkoutPlanExercise>>;
    removeExerciseFromUserWorkoutPlan: (
        planId: string,
        exerciseId: string
    ) => Promise<UserWorkoutDataResponse<void>>;
    reorderExercisesInUserWorkoutPlan: (
        planId: string,
        exercises: Array<{ exercise_id: string; position: number }>
    ) => Promise<UserWorkoutDataResponse<void>>;

    // User Workout Plan Exercise Details Operations
    fetchUserWorkoutPlanExerciseDetails: () => Promise<
        UserWorkoutDataResponse<UserWorkoutPlanExerciseDetails[]>
    >;
    fetchUserWorkoutPlanExerciseDetailsById: (
        exerciseId: string
    ) => Promise<UserWorkoutDataResponse<UserWorkoutPlanExerciseDetails>>;
    createUserWorkoutPlanExerciseDetails: (
        payload: UserWorkoutPlanExerciseDetailsCreatePayload
    ) => Promise<UserWorkoutDataResponse<UserWorkoutPlanExerciseDetails>>;
    updateUserWorkoutPlanExerciseDetails: (
        exerciseId: string,
        payload: UserWorkoutPlanExerciseDetailsUpdatePayload
    ) => Promise<UserWorkoutDataResponse<UserWorkoutPlanExerciseDetails>>;
    deleteUserWorkoutPlanExerciseDetails: (
        exerciseId: string
    ) => Promise<UserWorkoutDataResponse<void>>;

    // Workout Tags Operations (shared tags table)
    fetchWorkoutTags: () => Promise<UserWorkoutDataResponse<UserWorkoutTag[]>>;
    createWorkoutTag: (
        name: string
    ) => Promise<UserWorkoutDataResponse<UserWorkoutTag>>;

    // State
    isLoading: boolean;
    error: string | null;
}

// ===========================
// Custom Hook
// ===========================

export function useUserWorkoutData(): UseUserWorkoutDataReturn {
    const {
        setUserWorkoutPlans,
        setCurrentUserWorkoutPlan,
        refreshUserWorkoutPlans,
    } = useUserWorkoutContext();
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // ===========================
    // Error Handler
    // ===========================

    const handleError = useCallback((error: any): ApiError => {
        console.error("User workout data error:", error);
        if (error?.message) {
            return {
                message: error.message,
                code: error.code || error.status_code,
                statusCode: error.status || 500,
            };
        }
        return {
            message: "An unexpected error occurred. Please try again.",
            statusCode: 500,
        };
    }, []);

    // ===========================
    // User Workout Plan Operations
    // ===========================

    const fetchUserWorkoutPlans = useCallback(
        async (
            userId: string
        ): Promise<UserWorkoutDataResponse<UserWorkoutPlan[]>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!userId.trim()) {
                    return { success: false, error: "User ID is required" };
                }

                const { data, error: fetchError } = await supabase
                    .from("user_workout_plans")
                    .select("*")
                    .eq("user_id", userId)
                    .order("created_at", { ascending: false });

                if (fetchError) {
                    const apiError = handleError(fetchError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                setUserWorkoutPlans(data || []);
                return { success: true, data: data || [] };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError, setUserWorkoutPlans]
    );

    const fetchUserWorkoutPlanById = useCallback(
        async (planId: string): Promise<UserWorkoutDataResponse<UserWorkoutPlan>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!planId.trim()) {
                    return { success: false, error: "Plan ID is required" };
                }

                const { data, error: fetchError } = await supabase
                    .from("user_workout_plans")
                    .select("*")
                    .eq("id", planId)
                    .single();

                if (fetchError) {
                    const apiError = handleError(fetchError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                return { success: true, data: data as UserWorkoutPlan };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    const fetchUserWorkoutPlanWithTags = useCallback(
        async (
            planId: string
        ): Promise<UserWorkoutDataResponse<UserWorkoutPlanWithTags>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!planId.trim()) {
                    return { success: false, error: "Plan ID is required" };
                }

                const { data: plan, error: planError } = await supabase
                    .from("user_workout_plans")
                    .select("*")
                    .eq("id", planId)
                    .single();

                if (planError) {
                    const apiError = handleError(planError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                const { data: planTags, error: planTagsError } = await supabase
                    .from("user_workout_plan_tags")
                    .select("tag_id")
                    .eq("user_plan_id", planId);

                if (planTagsError) {
                    console.error("Error fetching plan tags:", planTagsError);
                }

                const tagIds = planTags?.map((pt) => pt.tag_id) || [];

                let tags: UserWorkoutTag[] = [];
                if (tagIds.length > 0) {
                    const { data: tagsData, error: tagsError } = await supabase
                        .from("workout_tags")
                        .select("*")
                        .in("id", tagIds);

                    if (tagsError) {
                        console.error("Error fetching tags:", tagsError);
                    } else {
                        tags = tagsData || [];
                    }
                }

                return { success: true, data: { ...plan, tags } };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    const fetchUserWorkoutPlanFull = useCallback(
        async (
            planId: string
        ): Promise<UserWorkoutDataResponse<UserWorkoutPlanFull>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!planId.trim()) {
                    return { success: false, error: "Plan ID is required" };
                }

                const planWithTagsResult = await fetchUserWorkoutPlanWithTags(planId);
                if (!planWithTagsResult.success || !planWithTagsResult.data) {
                    return {
                        success: false,
                        error: planWithTagsResult.error || "Failed to fetch plan",
                    };
                }

                const { data: planExercises, error: exercisesError } = await supabase
                    .from("user_workout_plan_exercises")
                    .select("*")
                    .eq("plan_id", planId)
                    .order("position", { ascending: true });

                if (exercisesError) {
                    console.error("Error fetching exercises:", exercisesError);
                }

                const exerciseIds = planExercises?.map((ex) => ex.exercise_id) || [];
                let exerciseDetailsMap: Map<
                    string,
                    UserWorkoutPlanExerciseDetails
                > = new Map();

                if (exerciseIds.length > 0) {
                    const { data: detailsData, error: detailsError } = await supabase
                        .from("user_workout_plan_exercises_details")
                        .select("*")
                        .in("id", exerciseIds);

                    if (detailsError) {
                        console.error("Error fetching exercise details:", detailsError);
                    } else {
                        detailsData?.forEach((detail) => {
                            exerciseDetailsMap.set(detail.id, detail);
                        });
                    }
                }

                const exercises = planExercises?.map((exercise) => ({
                    ...exercise,
                    exercise_details: exerciseDetailsMap.get(exercise.exercise_id),
                }));

                const fullPlan = { ...planWithTagsResult.data, exercises };
                setCurrentUserWorkoutPlan(fullPlan);

                return {
                    success: true,
                    data: fullPlan,
                };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError, fetchUserWorkoutPlanWithTags, setCurrentUserWorkoutPlan]
    );

    const createUserWorkoutPlan = useCallback(
        async (
            payload: UserWorkoutPlanCreatePayload
        ): Promise<UserWorkoutDataResponse<UserWorkoutPlan>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!payload.name.trim()) {
                    return { success: false, error: "Plan name is required" };
                }

                if (!payload.user_id) {
                    return { success: false, error: "User ID is required" };
                }

                const planData = {
                    ...payload,
                    created_at: new Date().toISOString(),
                };

                const { data, error: insertError } = await supabase
                    .from("user_workout_plans")
                    .insert([planData])
                    .select()
                    .single();

                if (insertError) {
                    const apiError = handleError(insertError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                await refreshUserWorkoutPlans(payload.user_id);

                return { success: true, data: data as UserWorkoutPlan };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError, refreshUserWorkoutPlans]
    );

    const updateUserWorkoutPlan = useCallback(
        async (
            planId: string,
            payload: UserWorkoutPlanUpdatePayload
        ): Promise<UserWorkoutDataResponse<UserWorkoutPlan>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!planId.trim()) {
                    return { success: false, error: "Plan ID is required" };
                }

                const { data, error: updateError } = await supabase
                    .from("user_workout_plans")
                    .update(payload)
                    .eq("id", planId)
                    .select()
                    .single();

                if (updateError) {
                    const apiError = handleError(updateError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                const plan = data as UserWorkoutPlan;
                if (plan.user_id) {
                    await refreshUserWorkoutPlans(plan.user_id);
                }

                return { success: true, data: plan };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError, refreshUserWorkoutPlans]
    );

    const deleteUserWorkoutPlan = useCallback(
        async (planId: string): Promise<UserWorkoutDataResponse<void>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!planId.trim()) {
                    return { success: false, error: "Plan ID is required" };
                }

                const { data: plan } = await supabase
                    .from("user_workout_plans")
                    .select("user_id")
                    .eq("id", planId)
                    .single();

                const { error: deleteError } = await supabase
                    .from("user_workout_plans")
                    .delete()
                    .eq("id", planId);

                if (deleteError) {
                    const apiError = handleError(deleteError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                if (plan?.user_id) {
                    await refreshUserWorkoutPlans(plan.user_id);
                }

                return { success: true };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError, refreshUserWorkoutPlans]
    );

    const fetchUserWorkoutPlansByLevel = useCallback(
        async (
            userId: string,
            level: string
        ): Promise<UserWorkoutDataResponse<UserWorkoutPlan[]>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!userId.trim()) {
                    return { success: false, error: "User ID is required" };
                }

                if (!level.trim()) {
                    return { success: false, error: "Level is required" };
                }

                const { data, error: fetchError } = await supabase
                    .from("user_workout_plans")
                    .select("*")
                    .eq("user_id", userId)
                    .eq("level", level.toLowerCase())
                    .order("created_at", { ascending: false });

                if (fetchError) {
                    const apiError = handleError(fetchError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                return { success: true, data: data || [] };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    const fetchUserWorkoutPlansByCategory = useCallback(
        async (
            userId: string,
            category: string
        ): Promise<UserWorkoutDataResponse<UserWorkoutPlan[]>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!userId.trim()) {
                    return { success: false, error: "User ID is required" };
                }

                if (!category.trim()) {
                    return { success: false, error: "Category is required" };
                }

                const { data, error: fetchError } = await supabase
                    .from("user_workout_plans")
                    .select("*")
                    .eq("user_id", userId)
                    .eq("category", category)
                    .order("created_at", { ascending: false });

                if (fetchError) {
                    const apiError = handleError(fetchError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                return { success: true, data: data || [] };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    // ===========================
    // User Workout Plan Tags Operations
    // ===========================

    const addTagToUserWorkoutPlan = useCallback(
        async (
            planId: string,
            tagId: string
        ): Promise<UserWorkoutDataResponse<void>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!planId.trim() || !tagId.trim()) {
                    return { success: false, error: "Plan ID and Tag ID are required" };
                }

                const { error: insertError } = await supabase
                    .from("user_workout_plan_tags")
                    .insert([{ user_plan_id: planId, tag_id: tagId }]);

                if (insertError) {
                    const apiError = handleError(insertError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                return { success: true };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    const removeTagFromUserWorkoutPlan = useCallback(
        async (
            planId: string,
            tagId: string
        ): Promise<UserWorkoutDataResponse<void>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!planId.trim() || !tagId.trim()) {
                    return { success: false, error: "Plan ID and Tag ID are required" };
                }

                const { error: deleteError } = await supabase
                    .from("user_workout_plan_tags")
                    .delete()
                    .eq("user_plan_id", planId)
                    .eq("tag_id", tagId);

                if (deleteError) {
                    const apiError = handleError(deleteError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                return { success: true };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    const fetchTagsForUserWorkoutPlan = useCallback(
        async (
            planId: string
        ): Promise<UserWorkoutDataResponse<UserWorkoutTag[]>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!planId.trim()) {
                    return { success: false, error: "Plan ID is required" };
                }

                const { data: planTags, error: planTagsError } = await supabase
                    .from("user_workout_plan_tags")
                    .select("tag_id")
                    .eq("user_plan_id", planId);

                if (planTagsError) {
                    const apiError = handleError(planTagsError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                const tagIds = planTags?.map((pt) => pt.tag_id) || [];

                if (tagIds.length === 0) {
                    return { success: true, data: [] };
                }

                const { data: tags, error: tagsError } = await supabase
                    .from("workout_tags")
                    .select("*")
                    .in("id", tagIds);

                if (tagsError) {
                    const apiError = handleError(tagsError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                return { success: true, data: tags || [] };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    // ===========================
    // User Workout Plan Exercise Operations
    // ===========================

    const fetchExercisesForUserWorkoutPlan = useCallback(
        async (
            planId: string
        ): Promise<UserWorkoutDataResponse<UserWorkoutPlanExercise[]>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!planId.trim()) {
                    return { success: false, error: "Plan ID is required" };
                }

                const { data, error: fetchError } = await supabase
                    .from("user_workout_plan_exercises")
                    .select("*")
                    .eq("plan_id", planId)
                    .order("position", { ascending: true });

                if (fetchError) {
                    const apiError = handleError(fetchError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                return { success: true, data: data || [] };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    const fetchExercisesForUserWorkoutPlanWithDetails = useCallback(
        async (
            planId: string
        ): Promise<UserWorkoutDataResponse<UserWorkoutPlanExerciseWithDetails[]>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!planId.trim()) {
                    return { success: false, error: "Plan ID is required" };
                }

                const { data: exercises, error: exercisesError } = await supabase
                    .from("user_workout_plan_exercises")
                    .select("*")
                    .eq("plan_id", planId)
                    .order("position", { ascending: true });

                if (exercisesError) {
                    const apiError = handleError(exercisesError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                const exerciseIds = exercises?.map((ex) => ex.exercise_id) || [];

                if (exerciseIds.length === 0) {
                    return { success: true, data: [] };
                }

                const { data: details, error: detailsError } = await supabase
                    .from("user_workout_plan_exercises_details")
                    .select("*")
                    .in("id", exerciseIds);

                if (detailsError) {
                    console.error("Error fetching exercise details:", detailsError);
                }

                const detailsMap = new Map<
                    string,
                    UserWorkoutPlanExerciseDetails
                >();
                details?.forEach((detail) => {
                    detailsMap.set(detail.id, detail);
                });

                const exercisesWithDetails = exercises?.map((exercise) => ({
                    ...exercise,
                    exercise_details: detailsMap.get(exercise.exercise_id),
                }));

                return { success: true, data: exercisesWithDetails || [] };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    const addExerciseToUserWorkoutPlan = useCallback(
        async (
            payload: UserWorkoutPlanExerciseCreatePayload
        ): Promise<UserWorkoutDataResponse<UserWorkoutPlanExercise>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!payload.plan_id.trim() || !payload.exercise_id.trim()) {
                    return {
                        success: false,
                        error: "Plan ID and Exercise ID are required",
                    };
                }

                const exerciseData = {
                    plan_id: payload.plan_id,
                    exercise_id: payload.exercise_id,
                    position: payload.position,
                    section: payload.section || "main",
                    safety_tip: payload.safety_tip || null,
                    sets: payload.sets || null,
                    reps: payload.reps || null,
                    duration_seconds: payload.duration_seconds || null,
                    rest_seconds: payload.rest_seconds || 30,
                    per_side: payload.per_side || false,
                };

                const { data, error: insertError } = await supabase
                    .from("user_workout_plan_exercises")
                    .insert([exerciseData])
                    .select()
                    .single();

                if (insertError) {
                    const apiError = handleError(insertError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                return { success: true, data: data as UserWorkoutPlanExercise };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    const updateUserWorkoutPlanExercise = useCallback(
        async (
            planId: string,
            exerciseId: string,
            payload: UserWorkoutPlanExerciseUpdatePayload
        ): Promise<UserWorkoutDataResponse<UserWorkoutPlanExercise>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!planId.trim() || !exerciseId.trim()) {
                    return {
                        success: false,
                        error: "Plan ID and Exercise ID are required",
                    };
                }

                const { data, error: updateError } = await supabase
                    .from("user_workout_plan_exercises")
                    .update(payload)
                    .eq("plan_id", planId)
                    .eq("exercise_id", exerciseId)
                    .select()
                    .single();

                if (updateError) {
                    const apiError = handleError(updateError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                return { success: true, data: data as UserWorkoutPlanExercise };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    const removeExerciseFromUserWorkoutPlan = useCallback(
        async (
            planId: string,
            exerciseId: string
        ): Promise<UserWorkoutDataResponse<void>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!planId.trim() || !exerciseId.trim()) {
                    return {
                        success: false,
                        error: "Plan ID and Exercise ID are required",
                    };
                }

                const { error: deleteError } = await supabase
                    .from("user_workout_plan_exercises")
                    .delete()
                    .eq("plan_id", planId)
                    .eq("exercise_id", exerciseId);

                if (deleteError) {
                    const apiError = handleError(deleteError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                return { success: true };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    const reorderExercisesInUserWorkoutPlan = useCallback(
        async (
            planId: string,
            exercises: Array<{ exercise_id: string; position: number }>
        ): Promise<UserWorkoutDataResponse<void>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!planId.trim()) {
                    return { success: false, error: "Plan ID is required" };
                }

                if (!exercises || exercises.length === 0) {
                    return { success: false, error: "Exercises array is required" };
                }

                for (const exercise of exercises) {
                    const { error: updateError } = await supabase
                        .from("user_workout_plan_exercises")
                        .update({ position: exercise.position })
                        .eq("plan_id", planId)
                        .eq("exercise_id", exercise.exercise_id);

                    if (updateError) {
                        const apiError = handleError(updateError);
                        setError(apiError.message);
                        return { success: false, error: apiError.message };
                    }
                }

                return { success: true };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    // ===========================
    // User Workout Plan Exercise Details Operations
    // ===========================

    const fetchUserWorkoutPlanExerciseDetails = useCallback(async (): Promise<
        UserWorkoutDataResponse<UserWorkoutPlanExerciseDetails[]>
    > => {
        try {
            setIsLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from("user_workout_plan_exercises_details")
                .select("*")
                .order("name", { ascending: true });

            if (fetchError) {
                const apiError = handleError(fetchError);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            }

            return { success: true, data: data || [] };
        } catch (err: any) {
            const apiError = handleError(err);
            setError(apiError.message);
            return { success: false, error: apiError.message };
        } finally {
            setIsLoading(false);
        }
    }, [handleError]);

    const fetchUserWorkoutPlanExerciseDetailsById = useCallback(
        async (
            exerciseId: string
        ): Promise<UserWorkoutDataResponse<UserWorkoutPlanExerciseDetails>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!exerciseId.trim()) {
                    return { success: false, error: "Exercise ID is required" };
                }

                const { data, error: fetchError } = await supabase
                    .from("user_workout_plan_exercises_details")
                    .select("*")
                    .eq("id", exerciseId)
                    .single();

                if (fetchError) {
                    const apiError = handleError(fetchError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                return { success: true, data: data as UserWorkoutPlanExerciseDetails };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    const createUserWorkoutPlanExerciseDetails = useCallback(
        async (
            payload: UserWorkoutPlanExerciseDetailsCreatePayload
        ): Promise<UserWorkoutDataResponse<UserWorkoutPlanExerciseDetails>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!payload.name.trim()) {
                    return { success: false, error: "Exercise name is required" };
                }

                const exerciseData = {
                    ...payload,
                    created_at: new Date().toISOString(),
                };

                const { data, error: insertError } = await supabase
                    .from("user_workout_plan_exercises_details")
                    .insert([exerciseData])
                    .select()
                    .single();

                if (insertError) {
                    const apiError = handleError(insertError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                return {
                    success: true,
                    data: data as UserWorkoutPlanExerciseDetails,
                };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    const updateUserWorkoutPlanExerciseDetails = useCallback(
        async (
            exerciseId: string,
            payload: UserWorkoutPlanExerciseDetailsUpdatePayload
        ): Promise<UserWorkoutDataResponse<UserWorkoutPlanExerciseDetails>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!exerciseId.trim()) {
                    return { success: false, error: "Exercise ID is required" };
                }

                const { data, error: updateError } = await supabase
                    .from("user_workout_plan_exercises_details")
                    .update(payload)
                    .eq("id", exerciseId)
                    .select()
                    .single();

                if (updateError) {
                    const apiError = handleError(updateError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                return {
                    success: true,
                    data: data as UserWorkoutPlanExerciseDetails,
                };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    const deleteUserWorkoutPlanExerciseDetails = useCallback(
        async (exerciseId: string): Promise<UserWorkoutDataResponse<void>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!exerciseId.trim()) {
                    return { success: false, error: "Exercise ID is required" };
                }

                const { error: deleteError } = await supabase
                    .from("user_workout_plan_exercises_details")
                    .delete()
                    .eq("id", exerciseId);

                if (deleteError) {
                    const apiError = handleError(deleteError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                return { success: true };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    // ===========================
    // Workout Tags Operations
    // ===========================

    const fetchWorkoutTags = useCallback(async (): Promise<
        UserWorkoutDataResponse<UserWorkoutTag[]>
    > => {
        try {
            setIsLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from("workout_tags")
                .select("*")
                .order("name", { ascending: true });

            if (fetchError) {
                const apiError = handleError(fetchError);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            }

            return { success: true, data: data || [] };
        } catch (err: any) {
            const apiError = handleError(err);
            setError(apiError.message);
            return { success: false, error: apiError.message };
        } finally {
            setIsLoading(false);
        }
    }, [handleError]);

    const createWorkoutTag = useCallback(
        async (name: string): Promise<UserWorkoutDataResponse<UserWorkoutTag>> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!name.trim()) {
                    return { success: false, error: "Tag name is required" };
                }

                const { data, error: insertError } = await supabase
                    .from("workout_tags")
                    .insert([{ name: name.trim() }])
                    .select()
                    .single();

                if (insertError) {
                    const apiError = handleError(insertError);
                    setError(apiError.message);
                    return { success: false, error: apiError.message };
                }

                return { success: true, data: data as UserWorkoutTag };
            } catch (err: any) {
                const apiError = handleError(err);
                setError(apiError.message);
                return { success: false, error: apiError.message };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    // ===========================
    // Return Hook Interface
    // ===========================

    return {
        // User Workout Plan Operations
        fetchUserWorkoutPlans,
        fetchUserWorkoutPlanById,
        fetchUserWorkoutPlanWithTags,
        fetchUserWorkoutPlanFull,
        createUserWorkoutPlan,
        updateUserWorkoutPlan,
        deleteUserWorkoutPlan,
        fetchUserWorkoutPlansByLevel,
        fetchUserWorkoutPlansByCategory,

        // User Workout Plan Tags Operations
        addTagToUserWorkoutPlan,
        removeTagFromUserWorkoutPlan,
        fetchTagsForUserWorkoutPlan,

        // User Workout Plan Exercise Operations
        fetchExercisesForUserWorkoutPlan,
        fetchExercisesForUserWorkoutPlanWithDetails,
        addExerciseToUserWorkoutPlan,
        updateUserWorkoutPlanExercise,
        removeExerciseFromUserWorkoutPlan,
        reorderExercisesInUserWorkoutPlan,

        // User Workout Plan Exercise Details Operations
        fetchUserWorkoutPlanExerciseDetails,
        fetchUserWorkoutPlanExerciseDetailsById,
        createUserWorkoutPlanExerciseDetails,
        updateUserWorkoutPlanExerciseDetails,
        deleteUserWorkoutPlanExerciseDetails,

        // Workout Tags Operations
        fetchWorkoutTags,
        createWorkoutTag,

        // State
        isLoading,
        error,
    };
}


import { useState, useCallback } from "react";
import { supabase } from "../lib/api/supabase";
import {
  UserWorkoutPlan,
  UserWorkoutDataResponse,
  CreateUserWorkoutPlanPayload,
  UpdateUserWorkoutPlanPayload,
  UserWorkoutWeekPlan,
  CreateUserWorkoutWeekPlanPayload,
  UserWorkoutWeeklyPlan,
  CreateUserWorkoutWeeklyPlanPayload,
  UserExerciseDetails,
  CreateUserExerciseDetailsPayload,
  ExerciseSection,
  UserWorkoutPlanExercise,
  UserWorkoutPlanExerciseWithDetails,
  CreateUserWorkoutPlanExercisePayload,
} from "../types/UserWorkout";
import { parseExerciseMetrics } from "../lib/openai-prompt";
import { generateImage, buildExerciseImagePrompt } from "../lib/gemini";

// ===========================
// Hook Interface
// ===========================

interface UseUserWorkoutDataReturn {
  // User Workout Plans
  fetchUserWorkoutPlans: (
    userId: string
  ) => Promise<UserWorkoutDataResponse<UserWorkoutPlan[]>>;
  fetchUserWorkoutPlanById: (
    planId: string
  ) => Promise<UserWorkoutDataResponse<UserWorkoutPlan>>;
  createUserWorkoutPlan: (
    payload: CreateUserWorkoutPlanPayload
  ) => Promise<UserWorkoutDataResponse<UserWorkoutPlan>>;
  updateUserWorkoutPlan: (
    planId: string,
    payload: UpdateUserWorkoutPlanPayload
  ) => Promise<UserWorkoutDataResponse<UserWorkoutPlan>>;
  deleteUserWorkoutPlan: (
    planId: string
  ) => Promise<UserWorkoutDataResponse<boolean>>;

  // Image randomization
  getRandomImagePath: (
    userId: string,
    gender?: string,
    location?: string
  ) => Promise<UserWorkoutDataResponse<string>>;

  // User Workout Week Plan (Parent - contains week_number, rest_days, remaining_days)
  fetchUserWorkoutWeekPlan: (
    planId: string
  ) => Promise<UserWorkoutDataResponse<UserWorkoutWeekPlan>>;
  fetchAllUserWorkoutWeekPlans: (
    planId: string
  ) => Promise<UserWorkoutDataResponse<UserWorkoutWeekPlan[]>>;
  createUserWorkoutWeekPlan: (
    payload: CreateUserWorkoutWeekPlanPayload
  ) => Promise<UserWorkoutDataResponse<UserWorkoutWeekPlan>>;

  // User Workout Weekly Daily Plans (Child - contains day details)
  fetchUserWorkoutWeeklyDayPlans: (
    weekPlanId: string
  ) => Promise<UserWorkoutDataResponse<UserWorkoutWeeklyPlan[]>>;
  createUserWorkoutWeeklyPlan: (
    payload: CreateUserWorkoutWeeklyPlanPayload
  ) => Promise<UserWorkoutDataResponse<UserWorkoutWeeklyPlan>>;
  createUserWorkoutWeeklyPlans: (
    payloads: CreateUserWorkoutWeeklyPlanPayload[]
  ) => Promise<UserWorkoutDataResponse<UserWorkoutWeeklyPlan[]>>;

  // User Exercise Details
  createUserExerciseDetails: (
    payload: CreateUserExerciseDetailsPayload
  ) => Promise<UserWorkoutDataResponse<UserExerciseDetails>>;
  createUserExerciseDetailsBatch: (
    payloads: CreateUserExerciseDetailsPayload[]
  ) => Promise<UserWorkoutDataResponse<UserExerciseDetails[]>>;
  findExistingExercises: (
    exercises: Array<{ name: string; equipment: string[] | null }>
  ) => Promise<UserWorkoutDataResponse<UserExerciseDetails[]>>;
  createOrReuseExerciseDetailsBatch: (
    payloads: CreateUserExerciseDetailsPayload[]
  ) => Promise<UserWorkoutDataResponse<UserExerciseDetails[]>>;
  generateImageSlug: (section: ExerciseSection, name: string) => string;

  // User Workout Plan Exercises
  fetchUserWorkoutPlanExercises: (
    weeklyPlanId: string
  ) => Promise<UserWorkoutDataResponse<UserWorkoutPlanExerciseWithDetails[]>>;
  createUserWorkoutPlanExercisesBatch: (
    payloads: CreateUserWorkoutPlanExercisePayload[]
  ) => Promise<UserWorkoutDataResponse<UserWorkoutPlanExercise[]>>;
  getExercisePosition: (section: ExerciseSection, index: number) => number;
  getExerciseImagePath: (gender: string, imageSlug: string) => string;

  // Exercise Image Generation & Upload
  generateAndUploadExerciseImage: (
    exerciseName: string,
    exerciseDescription: string,
    gender: "male" | "female",
    imageSlug: string
  ) => Promise<UserWorkoutDataResponse<string>>;
  checkExerciseImageExists: (
    gender: string,
    imageSlug: string
  ) => Promise<boolean>;

  // Fetch all exercise details (for background image generation)
  fetchAllUserExerciseDetails: () => Promise<
    UserWorkoutDataResponse<UserExerciseDetails[]>
  >;

  // State
  isLoading: boolean;
  error: string | null;
}

// ===========================
// Helper Functions
// ===========================

/**
 * Extract image number from image path
 * Example: "https://...female/42.png" -> 42
 */
const extractImageNumber = (imagePath: string): number | null => {
  const match = imagePath.match(/\/(\d+)\.png$/);
  return match ? parseInt(match[1], 10) : null;
};

/**
 * Get used image numbers for a user
 * Simplified to just return empty array to avoid query delays
 */
const getUsedImageNumbers = async (
  userId: string
): Promise<number[]> => {
  // Skip database query to avoid delays - just return empty array
  // This means we might reuse image numbers, but it's better than blocking
  console.log("📷 Skipping used image query for faster save");
  return [];
};

/**
 * Generate a random image number that hasn't been used by this user
 */
const generateRandomImageNumber = (
  usedNumbers: number[],
  maxNumber: number = 100
): number => {
  const availableNumbers = Array.from(
    { length: maxNumber },
    (_, i) => i + 1
  ).filter((num) => !usedNumbers.includes(num));

  if (availableNumbers.length === 0) {
    // If all numbers are used, just pick a random one
    return Math.floor(Math.random() * maxNumber) + 1;
  }

  const randomIndex = Math.floor(Math.random() * availableNumbers.length);
  return availableNumbers[randomIndex];
};

/**
 * Generate image_slug from section and exercise name
 * Format: "section/word-word-word" (e.g., "warmup/jumping-jacks")
 * 
 * @param section - Exercise section: "warmup" | "main" | "cooldown"
 * @param name - Exercise name (e.g., "Jumping Jacks")
 * @returns Image slug in format "section/kebab-case-name"
 */
const generateImageSlugFromName = (
  section: ExerciseSection,
  name: string
): string => {
  // Convert name to kebab-case: lowercase, replace spaces with dashes
  const kebabName = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters except spaces and hyphens
    .replace(/\s+/g, "-") // Replace spaces with dashes
    .replace(/-+/g, "-") // Replace multiple dashes with single dash
    .replace(/^-|-$/g, ""); // Remove leading/trailing dashes

  return `${section}/${kebabName}`;
};

// ===========================
// Custom Hook
// ===========================

export function useUserWorkoutData(): UseUserWorkoutDataReturn {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((error: any): string => {
    // Handle null/undefined
    if (!error) {
      console.error("User workout data error: Unknown error (null/undefined)");
      return "An unknown error occurred";
    }
    // Handle Supabase PostgrestError format
    if (error?.code && error?.message) {
      console.error("User workout data error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      // Handle specific Postgres error codes
      if (error.code === "23505") {
        return "A record with this name already exists. Please try again.";
      }
      if (error.code === "23503") {
        return "Referenced record not found. Please refresh and try again.";
      }
      if (error.code === "42501") {
        return "Permission denied. Check your database permissions.";
      }
      return error.message;
    }
    // Handle standard Error objects
    if (error?.message) {
      console.error("User workout data error:", error.message);
      return error.message;
    }
    // Handle string errors
    if (typeof error === "string") {
      console.error("User workout data error:", error);
      return error;
    }
    // Handle empty object
    if (typeof error === "object" && Object.keys(error).length === 0) {
      console.error("User workout data error: Empty error object received");
      return "Database operation failed (empty response)";
    }
    // Fallback - try to stringify
    try {
      const errorStr = JSON.stringify(error, null, 2);
      console.error("User workout data error (unknown format):", errorStr);
      return `Database error: ${errorStr}`;
    } catch {
      console.error("User workout data error: Could not serialize error object");
      return "An unexpected error occurred";
    }
  }, []);

  // ===========================
  // Fetch User Workout Plans
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
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchUserWorkoutPlanById = useCallback(
    async (
      planId: string
    ): Promise<UserWorkoutDataResponse<UserWorkoutPlan>> => {
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
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ===========================
  // Image Randomization
  // ===========================

  const getRandomImagePath = useCallback(
    async (
      userId: string,
      gender: string = "female",
      location: string = "gym"
    ): Promise<UserWorkoutDataResponse<string>> => {
      try {
        // Don't set loading state here as it's used internally
        // setIsLoading(true);
        // setError(null);

        if (!userId.trim()) {
          return { success: false, error: "User ID is required" };
        }

        // Get used image numbers for this user
        const usedNumbers = await getUsedImageNumbers(userId);

        // Generate a random number that hasn't been used (1-50)
        const imageNumber = generateRandomImageNumber(usedNumbers, 50);

        // Determine gender folder (default to female)
        const genderFolder =
          gender?.toLowerCase() === "male" ||
            gender?.toLowerCase() === "m"
            ? "male"
            : "female";

        // Determine location folder (normalize to gym or home, default to gym)
        const normalizedLocation = location?.toLowerCase().trim() || "gym";
        const locationFolder = normalizedLocation === "home" ? "home" : "gym";

        // Construct the image path: /[gender]/[location]/[1-50].png
        const imagePath = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/plans/${genderFolder}/${locationFolder}/${imageNumber}.png`;

        return { success: true, data: imagePath };
      } catch (err: any) {
        const errorMsg = handleError(err);
        return { success: false, error: errorMsg };
      }
    },
    [handleError]
  );

  // ===========================
  // Create User Workout Plan
  // ===========================

  const createUserWorkoutPlan = useCallback(
    async (
      payload: CreateUserWorkoutPlanPayload
    ): Promise<UserWorkoutDataResponse<UserWorkoutPlan>> => {
      console.log("📝 createUserWorkoutPlan called with:", {
        name: payload.name,
        user_id: payload.user_id,
        hasImagePath: !!payload.image_path,
      });

      try {
        setIsLoading(true);
        setError(null);

        if (!payload.name?.trim()) {
          console.error("❌ createUserWorkoutPlan: Plan name is required");
          return { success: false, error: "Plan name is required" };
        }

        if (!payload.user_id?.trim()) {
          console.error("❌ createUserWorkoutPlan: User ID is required");
          return { success: false, error: "User ID is required" };
        }

        // Get random image path if not provided
        let imagePath = payload.image_path;
        if (!imagePath) {
          console.log("📷 No image path provided, generating one...");
          // Use gender and location from payload, with defaults
          const imageResult = await getRandomImagePath(
            payload.user_id,
            payload.gender || "female",
            payload.location || "gym"
          );
          if (imageResult.success && imageResult.data) {
            imagePath = imageResult.data;
          }
        }

        const insertPayload = {
          name: payload.name,
          description: payload.description ?? null,
          tags: payload.tags ?? null,
          image_path: imagePath ?? null,
          image_alt: payload.image_alt ?? null,
          duration_days: payload.duration_days ?? null,
          category: payload.category ?? null,
          user_id: payload.user_id,
        };

        console.log("📤 Inserting to user_workout_plans:", JSON.stringify(insertPayload, null, 2));
        console.log("🔌 Supabase client exists:", !!supabase);

        let data: any = null;
        let insertError: any = null;

        try {
          console.log("🚀 Starting Supabase insert...");
          const startTime = Date.now();
          const response = await supabase
            .from("user_workout_plans")
            .insert(insertPayload)
            .select()
            .single();

          data = response.data;
          insertError = response.error;
          console.log(`📡 Supabase call completed in ${Date.now() - startTime}ms`);
        } catch (supabaseException: any) {
          console.error("💥 Supabase exception:", supabaseException);
          // Check if it's an abort error (timeout)
          if (supabaseException?.name === 'AbortError' || supabaseException?.message?.includes('abort')) {
            insertError = { message: "Database request timed out. Please try again." };
          } else {
            insertError = supabaseException;
          }
        }

        console.log("📥 Supabase response:", {
          hasData: !!data,
          hasError: !!insertError,
          error: insertError,
          dataId: data?.id
        });

        if (insertError) {
          console.error("❌ Supabase insert error:", insertError);
          const errorMsg = handleError(insertError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        if (!data) {
          console.error("❌ No data returned from insert");
          return { success: false, error: "No data returned from database" };
        }

        console.log("✅ Plan saved successfully:", data?.id);
        return { success: true, data: data };
      } catch (err: any) {
        console.error("❌ createUserWorkoutPlan exception:", err);
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError, getRandomImagePath]
  );

  // ===========================
  // Update User Workout Plan
  // ===========================

  const updateUserWorkoutPlan = useCallback(
    async (
      planId: string,
      payload: UpdateUserWorkoutPlanPayload
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
          const errorMsg = handleError(updateError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ===========================
  // Delete User Workout Plan
  // ===========================

  const deleteUserWorkoutPlan = useCallback(
    async (planId: string): Promise<UserWorkoutDataResponse<boolean>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId.trim()) {
          return { success: false, error: "Plan ID is required" };
        }

        const { error: deleteError } = await supabase
          .from("user_workout_plans")
          .delete()
          .eq("id", planId);

        if (deleteError) {
          const errorMsg = handleError(deleteError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: true };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ===========================
  // Fetch User Workout Week Plan (Parent - for week_number, rest_days, remaining_days)
  // Table: user_workout_weekly_plan
  // ===========================

  const fetchUserWorkoutWeekPlan = useCallback(
    async (
      planId: string
    ): Promise<UserWorkoutDataResponse<UserWorkoutWeekPlan>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId?.trim()) {
          return { success: false, error: "Plan ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("user_workout_weekly_plan")
          .select("*")
          .eq("plan_id", planId)
          .order("week_number", { ascending: true })
          .limit(1)
          .single();

        if (fetchError) {
          // PGRST116 means no rows found - not necessarily an error
          if (fetchError.code === "PGRST116") {
            return { success: true, data: undefined };
          }
          console.error("❌ Week plan fetch error:", fetchError);
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data };
      } catch (err: any) {
        console.error("❌ fetchUserWorkoutWeekPlan exception:", err);
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ===========================
  // Fetch ALL User Workout Week Plans (for multi-week support)
  // Table: user_workout_weekly_plan
  // ===========================

  const fetchAllUserWorkoutWeekPlans = useCallback(
    async (
      planId: string
    ): Promise<UserWorkoutDataResponse<UserWorkoutWeekPlan[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!planId?.trim()) {
          return { success: false, error: "Plan ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("user_workout_weekly_plan")
          .select("*")
          .eq("plan_id", planId)
          .order("week_number", { ascending: true });

        if (fetchError) {
          console.error("❌ Week plans fetch error:", fetchError);
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        console.error("❌ fetchAllUserWorkoutWeekPlans exception:", err);
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ===========================
  // Create User Workout Week Plan (Parent - for week_number, rest_days, remaining_days)
  // Table: user_workout_weekly_plan
  // ===========================

  const createUserWorkoutWeekPlan = useCallback(
    async (
      payload: CreateUserWorkoutWeekPlanPayload
    ): Promise<UserWorkoutDataResponse<UserWorkoutWeekPlan>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!payload.plan_id?.trim()) {
          return { success: false, error: "Plan ID is required" };
        }

        const insertPayload = {
          week_number: payload.week_number,
          plan_id: payload.plan_id,
          rest_days: payload.rest_days,
          remaining_days: payload.remaining_days,
        };

        console.log("📤 Creating week plan:", insertPayload);

        const { data, error: insertError } = await supabase
          .from("user_workout_weekly_plan")
          .insert(insertPayload)
          .select()
          .single();

        if (insertError) {
          console.error("❌ Week plan insert error:", insertError);
          const errorMsg = handleError(insertError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        // Check if data was actually returned (RLS might silently block inserts)
        if (!data || !data.id) {
          console.error("❌ Week plan insert returned no data - possible RLS issue");
          const errorMsg = "Insert succeeded but no data returned. Check database permissions.";
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        console.log("✅ Week plan created:", data.id);
        return { success: true, data: data };
      } catch (err: any) {
        console.error("❌ createUserWorkoutWeekPlan exception:", err);
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ===========================
  // Fetch User Workout Weekly Daily Plans
  // Table: user_workout_weekly_day_plan (references week_plan_id)
  // ===========================

  const fetchUserWorkoutWeeklyDayPlans = useCallback(
    async (
      weekPlanId: string
    ): Promise<UserWorkoutDataResponse<UserWorkoutWeeklyPlan[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!weekPlanId?.trim()) {
          return { success: false, error: "Week Plan ID is required" };
        }

        const { data, error: fetchError } = await supabase
          .from("user_workout_weekly_day_plan")
          .select("*")
          .eq("week_plan_id", weekPlanId)
          .order("created_at", { ascending: true });

        if (fetchError) {
          console.error("❌ Weekly day plans fetch error:", fetchError);
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        console.error("❌ fetchUserWorkoutWeeklyDayPlans exception:", err);
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ===========================
  // Create User Workout Weekly Daily Plan (Single)
  // Table: user_workout_weekly_day_plan (references week_plan_id)
  // ===========================

  const createUserWorkoutWeeklyPlan = useCallback(
    async (
      payload: CreateUserWorkoutWeeklyPlanPayload
    ): Promise<UserWorkoutDataResponse<UserWorkoutWeeklyPlan>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!payload.week_plan_id?.trim()) {
          return { success: false, error: "Week Plan ID is required" };
        }

        const insertPayload = {
          day: payload.day,
          title: payload.title,
          focus: payload.focus,
          motivation: payload.motivation,
          week_plan_id: payload.week_plan_id,
          total_calories: payload.total_calories,
          total_minutes: payload.total_minutes,
          rpe_record: payload.rpe_record ?? null,
        };

        const { data, error: insertError } = await supabase
          .from("user_workout_weekly_day_plan")
          .insert(insertPayload)
          .select()
          .single();

        if (insertError) {
          const errorMsg = handleError(insertError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ===========================
  // Create User Workout Weekly Daily Plans (Batch)
  // Table: user_workout_weekly_day_plan (references week_plan_id)
  // ===========================

  const createUserWorkoutWeeklyPlans = useCallback(
    async (
      payloads: CreateUserWorkoutWeeklyPlanPayload[]
    ): Promise<UserWorkoutDataResponse<UserWorkoutWeeklyPlan[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!payloads || payloads.length === 0) {
          return { success: false, error: "At least one weekly daily plan is required" };
        }

        // Validate all payloads have week_plan_id
        const invalidPayload = payloads.find((p) => !p.week_plan_id?.trim());
        if (invalidPayload) {
          return { success: false, error: "All weekly daily plans must have a Week Plan ID" };
        }

        const insertPayloads = payloads.map((payload) => ({
          day: payload.day,
          title: payload.title,
          focus: payload.focus,
          motivation: payload.motivation,
          week_plan_id: payload.week_plan_id,
          total_calories: payload.total_calories,
          total_minutes: payload.total_minutes,
          rpe_record: payload.rpe_record ?? null,
        }));

        console.log("📤 Creating weekly daily plans:", insertPayloads.length);

        const { data, error: insertError } = await supabase
          .from("user_workout_weekly_day_plan")
          .insert(insertPayloads)
          .select();

        if (insertError) {
          console.error("❌ Weekly day plans insert error:", insertError);
          const errorMsg = handleError(insertError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        // Check if data was actually returned (RLS might silently block inserts)
        if (!data || data.length === 0) {
          console.error("❌ Weekly day plans insert returned no data - possible RLS issue");
          const errorMsg = "Insert succeeded but no data returned. Check database permissions.";
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        console.log("✅ Weekly day plans created:", data.length);
        return { success: true, data: data };
      } catch (err: any) {
        console.error("❌ createUserWorkoutWeeklyPlans exception:", err);
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ===========================
  // Generate Image Slug Helper
  // ===========================

  const generateImageSlug = useCallback(
    (section: ExerciseSection, name: string): string => {
      return generateImageSlugFromName(section, name);
    },
    []
  );

  // ===========================
  // Create User Exercise Details (Single)
  // ===========================

  const createUserExerciseDetails = useCallback(
    async (
      payload: CreateUserExerciseDetailsPayload
    ): Promise<UserWorkoutDataResponse<UserExerciseDetails>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!payload.name?.trim()) {
          return { success: false, error: "Exercise name is required" };
        }

        if (!payload.section) {
          return { success: false, error: "Exercise section is required" };
        }

        // Generate image_slug if not provided
        const imageSlug = payload.image_slug || generateImageSlugFromName(payload.section, payload.name);

        // Parse equipment - handle both string and array formats
        let equipmentArray: string[] | null = null;
        if (payload.equipment) {
          if (Array.isArray(payload.equipment)) {
            equipmentArray = payload.equipment;
          } else if (typeof payload.equipment === "string") {
            // Handle comma-separated string
            equipmentArray = (payload.equipment as string)
              .split(",")
              .map((e: string) => e.trim())
              .filter((e: string) => e.length > 0);
          }
        }

        const insertPayload = {
          name: payload.name.trim(),
          safety_cue: payload.safety_cue ?? null,
          image_slug: imageSlug,
          section: payload.section,
          equipment: equipmentArray,
        };

        const { data, error: insertError } = await supabase
          .from("user_exercises_details")
          .insert(insertPayload)
          .select()
          .single();

        if (insertError) {
          const errorMsg = handleError(insertError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ===========================
  // Create User Exercise Details (Batch)
  // ===========================

  const createUserExerciseDetailsBatch = useCallback(
    async (
      payloads: CreateUserExerciseDetailsPayload[]
    ): Promise<UserWorkoutDataResponse<UserExerciseDetails[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!payloads || payloads.length === 0) {
          return { success: false, error: "At least one exercise detail is required" };
        }

        // Validate all payloads
        for (const payload of payloads) {
          if (!payload.name?.trim()) {
            return { success: false, error: "All exercises must have a name" };
          }
          if (!payload.section) {
            return { success: false, error: "All exercises must have a section" };
          }
        }

        const insertPayloads = payloads.map((payload) => {
          // Generate image_slug if not provided
          const imageSlug = payload.image_slug || generateImageSlugFromName(payload.section, payload.name);

          // Parse equipment - handle both string and array formats
          let equipmentArray: string[] | null = null;
          if (payload.equipment) {
            if (Array.isArray(payload.equipment)) {
              equipmentArray = payload.equipment;
            } else if (typeof payload.equipment === "string") {
              // Handle comma-separated string
              equipmentArray = (payload.equipment as string)
                .split(",")
                .map((e: string) => e.trim())
                .filter((e: string) => e.length > 0);
            }
          }

          return {
            name: payload.name.trim(),
            safety_cue: payload.safety_cue ?? null,
            image_slug: imageSlug,
            section: payload.section,
            equipment: equipmentArray,
          };
        });

        const { data, error: insertError } = await supabase
          .from("user_exercises_details")
          .insert(insertPayloads)
          .select();

        if (insertError) {
          const errorMsg = handleError(insertError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ===========================
  // Find Existing Exercises by Name and Equipment
  // ===========================

  const findExistingExercises = useCallback(
    async (
      exercises: Array<{ name: string; equipment: string[] | null }>
    ): Promise<UserWorkoutDataResponse<UserExerciseDetails[]>> => {
      try {
        if (!exercises || exercises.length === 0) {
          return { success: true, data: [] };
        }

        // Get unique exercise names (normalized)
        const exerciseNames = [...new Set(exercises.map((e) => e.name.trim()))];

        // Query all exercises and filter by case-insensitive name match
        const { data, error: fetchError } = await supabase
          .from("user_exercises_details")
          .select("*");

        if (fetchError) {
          const errorMsg = handleError(fetchError);
          return { success: false, error: errorMsg };
        }

        // Filter manually by name (case-insensitive)
        const exerciseNamesLower = exerciseNames.map((n) => n.toLowerCase());
        const matchingExercises = (data || []).filter((dbExercise) =>
          exerciseNamesLower.includes(dbExercise.name.toLowerCase().trim())
        );

        return { success: true, data: matchingExercises };
      } catch (err: any) {
        const errorMsg = handleError(err);
        return { success: false, error: errorMsg };
      }
    },
    [handleError]
  );

  // ===========================
  // Create or Reuse Exercise Details (Batch)
  // Checks for existing exercises by name + equipment (DB unique constraint)
  // ===========================

  const createOrReuseExerciseDetailsBatch = useCallback(
    async (
      payloads: CreateUserExerciseDetailsPayload[]
    ): Promise<UserWorkoutDataResponse<UserExerciseDetails[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!payloads || payloads.length === 0) {
          return { success: false, error: "At least one exercise detail is required" };
        }

        // Validate all payloads
        for (const payload of payloads) {
          if (!payload.name?.trim()) {
            return { success: false, error: "All exercises must have a name" };
          }
          if (!payload.section) {
            return { success: false, error: "All exercises must have a section" };
          }
        }

        // Helper to parse equipment from payload
        const parseEquipment = (equipment: string[] | null | undefined): string[] | null => {
          if (!equipment) return null;
          if (Array.isArray(equipment)) {
            return equipment;
          } else if (typeof equipment === "string") {
            return (equipment as string)
              .split(",")
              .map((e) => e.trim())
              .filter((e) => e.length > 0);
          }
          return null;
        };

        // Helper to normalize equipment for comparison (sorted, lowercase, joined)
        const normalizeEquipment = (equipment: string[] | null | undefined): string => {
          if (!equipment || equipment.length === 0) return "";
          return equipment
            .map((e) => e.toLowerCase().trim())
            .sort()
            .join(",");
        };

        // Helper to create a unique key from name + equipment
        const createExerciseKey = (name: string, equipment: string[] | null | undefined): string => {
          const normalizedName = name.toLowerCase().trim();
          const normalizedEquip = normalizeEquipment(equipment);
          return `${normalizedName}|${normalizedEquip}`;
        };

        // Deduplicate input payloads by name + equipment (DB has unique constraint on name + equipment)
        const seenKeys = new Set<string>();
        const uniquePayloads: CreateUserExerciseDetailsPayload[] = [];

        payloads.forEach((payload) => {
          const equipmentArray = parseEquipment(payload.equipment);
          const key = createExerciseKey(payload.name, equipmentArray);

          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniquePayloads.push(payload);
          }
        });

        console.log("📋 Deduplicated input payloads by name+equipment:", {
          original_count: payloads.length,
          unique_count: uniquePayloads.length,
        });

        // Prepare exercises for lookup
        const exercisesForLookup = uniquePayloads.map((p) => ({
          name: p.name.trim(),
          equipment: parseEquipment(p.equipment),
        }));

        // Find existing exercises by name (we'll filter by equipment in memory)
        const existingResult = await findExistingExercises(exercisesForLookup);
        const existingExercises = existingResult.success ? existingResult.data || [] : [];

        console.log("🔍 Found existing exercises in DB:", {
          total_found: existingExercises.length,
          exercises: existingExercises.map((e) => ({ name: e.name, equipment: e.equipment })),
        });

        // Create a map of existing exercises by name + equipment key
        const existingByKey = new Map<string, UserExerciseDetails>();
        existingExercises.forEach((exercise) => {
          const key = createExerciseKey(exercise.name, exercise.equipment);
          existingByKey.set(key, exercise);
        });

        // Separate payloads into existing (to reuse) and new (to create)
        // Check by NAME + EQUIPMENT (DB unique constraint)
        const reusedExercises: UserExerciseDetails[] = [];
        const newPayloads: CreateUserExerciseDetailsPayload[] = [];

        uniquePayloads.forEach((payload) => {
          const equipmentArray = parseEquipment(payload.equipment);
          const key = createExerciseKey(payload.name, equipmentArray);
          const existingExercise = existingByKey.get(key);

          if (existingExercise) {
            // Reuse existing exercise (matched by name + equipment)
            console.log(`♻️ Reusing existing exercise: ${payload.name} (equipment: ${normalizeEquipment(equipmentArray) || "none"})`);
            reusedExercises.push(existingExercise);
          } else {
            // Need to create new exercise
            newPayloads.push(payload);
          }
        });

        console.log("📊 Exercise deduplication result:", {
          total_unique: uniquePayloads.length,
          reused_from_db: reusedExercises.length,
          new_to_create: newPayloads.length,
        });

        // Create only the new exercises (already deduplicated by name)
        let newlyCreatedExercises: UserExerciseDetails[] = [];
        if (newPayloads.length > 0) {
          const insertPayloads = newPayloads.map((payload) => {
            const imageSlug =
              payload.image_slug || generateImageSlugFromName(payload.section, payload.name);

            const equipmentArray = parseEquipment(payload.equipment);

            return {
              name: payload.name.trim(),
              safety_cue: payload.safety_cue ?? null,
              image_slug: imageSlug,
              section: payload.section,
              equipment: equipmentArray,
            };
          });

          console.log("📝 Inserting new exercises:", {
            count: insertPayloads.length,
            names: insertPayloads.map((p) => p.name),
          });

          const { data, error: insertError } = await supabase
            .from("user_exercises_details")
            .insert(insertPayloads)
            .select();

          if (insertError) {
            console.error("❌ Insert error:", insertError);
            const errorMsg = handleError(insertError);
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

          newlyCreatedExercises = data || [];
          console.log("✅ Created new exercises:", {
            count: newlyCreatedExercises.length,
            names: newlyCreatedExercises.map((e) => e.name),
          });
        }

        // Build a complete map of all exercises (reused + newly created) by name + equipment
        const allExercisesMap = new Map<string, UserExerciseDetails>();
        reusedExercises.forEach((e) => {
          const key = createExerciseKey(e.name, e.equipment);
          allExercisesMap.set(key, e);
        });
        newlyCreatedExercises.forEach((e) => {
          const key = createExerciseKey(e.name, e.equipment);
          allExercisesMap.set(key, e);
        });

        // Return all unique exercises
        const allExercises = Array.from(allExercisesMap.values());

        return { success: true, data: allExercises };
      } catch (err: any) {
        console.error("❌ createOrReuseExerciseDetailsBatch error:", err);
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError, findExistingExercises]
  );

  // ===========================
  // Helper: Get Exercise Position
  // warmup: starts at 101, main: starts at 1, cooldown: starts at 201
  // ===========================

  const getExercisePosition = useCallback(
    (section: ExerciseSection, index: number): number => {
      switch (section) {
        case "warmup":
          return 101 + index;
        case "main":
          return 1 + index;
        case "cooldown":
          return 201 + index;
        default:
          return 1 + index;
      }
    },
    []
  );

  // ===========================
  // Helper: Get Exercise Image Path
  // Format: https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/exercises/[gender]/[image_slug].png
  // ===========================

  const getExerciseImagePath = useCallback(
    (gender: string, imageSlug: string): string => {
      const normalizedGender =
        gender?.toLowerCase() === "male" || gender?.toLowerCase() === "m"
          ? "male"
          : "female";
      return `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/exercises/${normalizedGender}/${imageSlug}.png`;
    },
    []
  );

  // ===========================
  // Fetch User Workout Plan Exercises with Details
  // ===========================

  const fetchUserWorkoutPlanExercises = useCallback(
    async (
      weeklyPlanId: string
    ): Promise<UserWorkoutDataResponse<UserWorkoutPlanExerciseWithDetails[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!weeklyPlanId?.trim()) {
          return { success: false, error: "Weekly Plan ID is required" };
        }

        // Fetch exercises with joined exercise details
        const { data, error: fetchError } = await supabase
          .from("user_workout_plan_exercises")
          .select(`
            *,
            exercise_details:user_exercises_details(*)
          `)
          .eq("weekly_plan_id", weeklyPlanId)
          .order("position", { ascending: true });

        if (fetchError) {
          console.error("❌ Plan exercises fetch error:", fetchError);
          const errorMsg = handleError(fetchError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, data: data || [] };
      } catch (err: any) {
        console.error("❌ fetchUserWorkoutPlanExercises exception:", err);
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ===========================
  // Create User Workout Plan Exercises (Batch)
  // ===========================

  const createUserWorkoutPlanExercisesBatch = useCallback(
    async (
      payloads: CreateUserWorkoutPlanExercisePayload[]
    ): Promise<UserWorkoutDataResponse<UserWorkoutPlanExercise[]>> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!payloads || payloads.length === 0) {
          return { success: false, error: "At least one plan exercise is required" };
        }

        // Validate all payloads
        for (const payload of payloads) {
          if (!payload.weekly_plan_id?.trim()) {
            return { success: false, error: "All exercises must have a weekly plan ID" };
          }
          if (!payload.exercise_id?.trim()) {
            return { success: false, error: "All exercises must have an exercise ID" };
          }
          if (!payload.section) {
            return { success: false, error: "All exercises must have a section" };
          }
        }

        // Generate UUID for each payload if not provided
        // Table requires id (no default), and primary key is (id, position)
        const insertPayloads = payloads.map((payload) => ({
          id: payload.id || crypto.randomUUID(),
          weekly_plan_id: payload.weekly_plan_id,
          exercise_id: payload.exercise_id,
          position: payload.position,
          section: payload.section,
          sets: payload.sets ?? null,
          reps: payload.reps ?? null,
          duration_seconds: payload.duration_seconds ?? null,
          rest_seconds: payload.rest_seconds ?? 30,
          per_side: payload.per_side ?? false,
          image_path: payload.image_path ?? null,
          image_alt: payload.image_alt ?? null,
          description: payload.description ?? null,
          is_image_generated: payload.is_image_generated ?? null,
        }));

        console.log("📝 Inserting plan exercises:", {
          count: insertPayloads.length,
          sample: insertPayloads.slice(0, 2),
        });

        const { data, error: insertError } = await supabase
          .from("user_workout_plan_exercises")
          .insert(insertPayloads)
          .select();

        if (insertError) {
          console.error("❌ Plan exercises insert error:", insertError);
          const errorMsg = handleError(insertError);
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        // Check if data was actually returned (RLS might silently block inserts)
        if (!data || data.length === 0) {
          console.error("❌ Plan exercises insert returned no data - possible RLS issue");
          const errorMsg = "Insert succeeded but no data returned. Check database permissions.";
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        console.log("✅ Plan exercises saved:", {
          count: data.length,
        });

        return { success: true, data: data };
      } catch (err: any) {
        console.error("❌ createUserWorkoutPlanExercisesBatch error:", err);
        const errorMsg = handleError(err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ===========================
  // Check if Exercise Image Exists in Storage
  // ===========================

  const checkExerciseImageExists = useCallback(
    async (gender: string, imageSlug: string): Promise<boolean> => {
      try {
        const normalizedGender =
          gender?.toLowerCase() === "male" || gender?.toLowerCase() === "m"
            ? "male"
            : "female";

        // Path in storage: workouts/exercises/[gender]/[imageSlug].png
        // imageSlug format: section/name-kebab (e.g., "warmup/jumping-jacks")
        const storagePath = `exercises/${normalizedGender}/${imageSlug}.png`;

        // Use GET with Range header (more reliable than HEAD for Supabase)
        const publicUrl = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/${storagePath}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(publicUrl, {
          method: "GET",
          headers: {
            Range: "bytes=0-0",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 200 = full content, 206 = partial content (range request worked)
        if (response.ok || response.status === 206) {
          console.log(`✅ Image exists: ${imageSlug}`);
          return true;
        }

        console.log(`📷 Image not found: ${imageSlug}`);
        return false;
      } catch (err) {
        console.warn("Error checking image existence:", err);
        return false;
      }
    },
    []
  );

  // ===========================
  // Generate and Upload Exercise Image
  // ===========================

  const generateAndUploadExerciseImage = useCallback(
    async (
      exerciseName: string,
      exerciseDescription: string,
      gender: "male" | "female",
      imageSlug: string
    ): Promise<UserWorkoutDataResponse<string>> => {
      try {
        void exerciseDescription;
        console.log(`🎨 Step 1: Generating image for: ${exerciseName} (${gender})`);
        console.log(`📍 Target path: workouts/exercises/${gender}/${imageSlug}.png`);

        const storagePath = `exercises/${gender}/${imageSlug}.png`;
        const publicUrl = `https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/${storagePath}`;
        const { data: descriptionRows, error: descriptionError } = await supabase
          .from("user_workout_plan_exercises")
          .select("description")
          .eq("image_path", publicUrl)
          .not("description", "is", null)
          .limit(1);

        if (descriptionError) {
          return {
            success: false,
            error: `Failed to read user_workout_plan_exercises.description: ${descriptionError.message}`,
          };
        }

        const description = descriptionRows?.[0]?.description;
        if (typeof description !== "string" || description.trim().length === 0) {
          return {
            success: false,
            error: "Missing description in user_workout_plan_exercises.description",
          };
        }

        // Build the prompt for image generation
        const prompt = buildExerciseImagePrompt(
          exerciseName,
          description.trim(),
          gender
        );

        console.log(`📝 Prompt preview: ${prompt.substring(0, 100)}...`);

        // Generate the image using Gemini/Imagen API
        const imageResult = await generateImage({
          prompt,
          model: "imagen-4.0-generate-001",
          aspectRatio: "16:9",
          numberOfImages: 1,
          personGeneration: "allow_all",
        });

        console.log(`📊 Image generation result:`, {
          success: imageResult.success,
          hasImages: !!(imageResult.images && imageResult.images.length > 0),
          error: imageResult.error || "none",
        });

        if (!imageResult.success || !imageResult.images || imageResult.images.length === 0) {
          console.error("❌ Image generation failed:", imageResult.error);
          return {
            success: false,
            error: imageResult.error || "Failed to generate image",
          };
        }

        const generatedImage = imageResult.images[0];
        console.log(`✅ Step 2: Image generated for: ${exerciseName}`);
        console.log(`📏 Image data type: ${generatedImage.startsWith("data:") ? "base64" : generatedImage.startsWith("http") ? "URL" : "raw base64"}`);

        // Convert base64 to blob if needed
        let imageBlob: Blob;
        if (generatedImage.startsWith("data:image")) {
          // It's a base64 data URL
          const base64Data = generatedImage.split(",")[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          imageBlob = new Blob([byteArray], { type: "image/png" });
        } else if (generatedImage.startsWith("http")) {
          // It's a URL, fetch it
          const response = await fetch(generatedImage);
          if (!response.ok) {
            return { success: false, error: "Failed to fetch generated image from URL" };
          }
          imageBlob = await response.blob();
        } else {
          // Assume it's raw base64 without data URL prefix
          const byteCharacters = atob(generatedImage);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          imageBlob = new Blob([byteArray], { type: "image/png" });
        }

        // Upload to Supabase Storage
        // Path: workouts/exercises/[gender]/[section]/[name].png
        // imageSlug format: section/name-kebab (e.g., "warmup/jumping-jacks")

        console.log(`📤 Step 3: Uploading to Supabase Storage...`);
        console.log(`📁 Bucket: workouts`);
        console.log(`📂 Path: ${storagePath}`);
        console.log(`📊 Blob size: ${imageBlob.size} bytes`);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("workouts")
          .upload(storagePath, imageBlob, {
            contentType: "image/png",
            upsert: true, // Overwrite if exists
          });

        if (uploadError) {
          console.error("❌ Supabase Upload error:", {
            message: uploadError.message,
            name: uploadError.name,
            details: uploadError,
          });
          return {
            success: false,
            error: `Failed to upload image: ${uploadError.message}`,
          };
        }

        console.log(`✅ Step 4: Image uploaded successfully!`);
        console.log(`🔗 Public URL: ${publicUrl}`);
        console.log(`📋 Upload data:`, uploadData);

        return { success: true, data: publicUrl };
      } catch (err: any) {
        console.error("❌ generateAndUploadExerciseImage error:", err);
        return {
          success: false,
          error: err?.message || "Unknown error during image generation/upload",
        };
      }
    },
    []
  );

  // ===========================
  // Fetch All User Exercise Details
  // ===========================

  const fetchAllUserExerciseDetails = useCallback(async (): Promise<
    UserWorkoutDataResponse<UserExerciseDetails[]>
  > => {
    try {
      const { data, error: fetchError } = await supabase
        .from("user_exercises_details")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        const errorMsg = handleError(fetchError);
        return { success: false, error: errorMsg };
      }

      return { success: true, data: data || [] };
    } catch (err: any) {
      const errorMsg = handleError(err);
      return { success: false, error: errorMsg };
    }
  }, [handleError]);

  return {
    fetchUserWorkoutPlans,
    fetchUserWorkoutPlanById,
    createUserWorkoutPlan,
    updateUserWorkoutPlan,
    deleteUserWorkoutPlan,
    getRandomImagePath,
    fetchUserWorkoutWeekPlan,
    fetchAllUserWorkoutWeekPlans,
    createUserWorkoutWeekPlan,
    fetchUserWorkoutWeeklyDayPlans,
    createUserWorkoutWeeklyPlan,
    createUserWorkoutWeeklyPlans,
    createUserExerciseDetails,
    createUserExerciseDetailsBatch,
    findExistingExercises,
    createOrReuseExerciseDetailsBatch,
    generateImageSlug,
    fetchUserWorkoutPlanExercises,
    createUserWorkoutPlanExercisesBatch,
    getExercisePosition,
    getExerciseImagePath,
    generateAndUploadExerciseImage,
    checkExerciseImageExists,
    fetchAllUserExerciseDetails,
    isLoading,
    error,
  };
}

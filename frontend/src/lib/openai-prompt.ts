import { openai } from "./openai";

// Prompt ID for workout generation
const WORKOUT_PROMPT_ID = "pmpt_696b1cbae2748190b762941e94daf9ca04d42161af28312a";
const PROMPT_VERSION = "7";

// Prompt ID for day-specific workout generation
const DAY_WORKOUT_PROMPT_ID = "pmpt_696b4c297ebc8193ab67088cd5e034c10a70cda92773d275";
const DAY_WORKOUT_PROMPT_VERSION = "14";

// Interface for user profile data
export interface WorkoutPromptVariables {
  gender?: string;
  goal?: string;
  location?: string;
  equipments?: string;
  level?: string;
  schedule?: string;
  age?: string;
  duration?: string;
  plan_name?: string;
  plan_duration?: string;
  week_number?: string;
}

// Interface for workout plan day structure
export interface WorkoutDay {
  title: string;
  focus: string;
  motivation?: string;
}

export type DayName =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type WorkoutPlanDays = Record<DayName, WorkoutDay>;

// Interface for workout plan JSON structure
export interface WorkoutPlanJSON {
  plan_name: string;
  plan_duration: string;
  week_theme: string;
  week_number: string;
  category: string;
  description?: string;
  days: WorkoutPlanDays;
  rest_days: DayName[];
}

// Remove any days that come back empty to keep UI clean
const sanitizeWorkoutPlan = (plan: WorkoutPlanJSON): WorkoutPlanJSON => {
  const filteredDaysEntries = Object.entries(plan.days).filter(
    ([, value]) =>
      Boolean(value?.title?.trim()) &&
      Boolean(value?.focus?.trim())
  ) as [DayName, WorkoutDay][];

  const filteredDays = Object.fromEntries(filteredDaysEntries) as WorkoutPlanDays;

  const validDayNames: DayName[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  const filteredRestDays = plan.rest_days.filter((day) => validDayNames.includes(day));

  return {
    ...plan,
    days: filteredDays,
    rest_days: filteredRestDays,
  };
};

// Interface for the response
export interface WorkoutPromptResponse {
  success: boolean;
  response?: string;
  json?: WorkoutPlanJSON;
  error?: string;
}

// Interface for day-specific workout variables
export interface DayWorkoutPromptVariables {
  gender?: string;
  goal?: string;
  location?: string;
  equipments?: string;
  level?: string;
  schedule?: string;
  age?: string;
  duration?: string;
  day_name: string;
  plan_name: string;
  day_focus: string;
  plan_duration?: string;
  week_number?: string;
}

// Interface for day-specific adaptive workout variables (uses RPE feedback)
export interface DayWorkoutRpePromptVariables extends DayWorkoutPromptVariables {
  rpe?: string;
  remaining_days?: string;
}

// Interface for exercise item in workout arrays
export interface ExerciseItem {
  number?: number;
  name?: string;
  equipment?: string;
  sets_reps_duration_seconds_rest?: string; // Format: "3 sets x 12 reps, 45 sec, 30 sec rest" or "none" for any value
  sets_reps_rest?: string; // Backward-compatible fallback key from older prompt variants
  per_side?: string; // "yes" | "no"
  description?: string;
  safety_cue?: string;
}

// Parsed exercise metrics from sets_reps_duration_seconds_rest string
export interface ParsedExerciseMetrics {
  sets: number | null;
  reps: number | null;
  duration_seconds: number | null;
  rest_seconds: number;
  raw: string; // Original string for display/saving
}

/**
 * Parse sets_reps_duration_seconds_rest string into individual values
 * Format examples:
 * - "3 sets x 12 reps, 45 sec, 30 sec rest"
 * - "3 sets x none, 60 sec, 30 sec rest" (no reps, has duration)
 * - "3 sets x 10 reps, none, 30 sec rest" (no duration)
 * - "none" (everything is none)
 *
 * @param value - The sets_reps_duration_seconds_rest string from the prompt
 * @returns ParsedExerciseMetrics object with individual values
 */
export function parseExerciseMetrics(value: string | undefined): ParsedExerciseMetrics {
  const defaultResult: ParsedExerciseMetrics = {
    sets: null,
    reps: null,
    duration_seconds: null,
    rest_seconds: 30, // Default rest time
    raw: value || "",
  };

  if (!value || value.toLowerCase().trim() === "none") {
    return defaultResult;
  }

  const lowerValue = value.toLowerCase();
  const csvParts = lowerValue
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  // Parse sets: look for "X sets" or "X set"
  const setsMatch = lowerValue.match(/(\d+)\s*sets?/i);
  if (setsMatch) {
    defaultResult.sets = parseInt(setsMatch[1], 10);
  } else {
    // Support compact format like: "3, 12 reps, 45 sec, 30 sec rest"
    const firstValueMatch = csvParts[0]?.match(/^(\d+)$/);
    if (firstValueMatch) {
      defaultResult.sets = parseInt(firstValueMatch[1], 10);
    }
  }

  // Parse reps: look for "X reps" or "X rep" (but not "none")
  const repsMatch = lowerValue.match(/(\d+)\s*reps?/i);
  if (repsMatch) {
    defaultResult.reps = parseInt(repsMatch[1], 10);
  }

  // Parse duration: look for duration in seconds (not rest)
  // Pattern: "X sec" that comes BEFORE "rest" keyword
  // Split by rest to separate duration from rest time
  const parts = lowerValue.split(/rest/i);
  if (parts.length > 0) {
    // First part contains sets, reps, and duration
    const mainPart = parts[0];
    // Look for duration seconds (second occurrence of "X sec" after sets and reps, or first if no reps)
    const secMatches = mainPart.match(/(\d+)\s*sec/gi);
    if (secMatches && secMatches.length > 0) {
      // Get the last "X sec" before "rest" as duration
      const lastSecMatch = secMatches[secMatches.length - 1].match(/(\d+)/);
      if (lastSecMatch) {
        defaultResult.duration_seconds = parseInt(lastSecMatch[1], 10);
      }
    }
  }

  // Parse rest: look for "X sec rest" or "rest X sec" or "X seconds rest"
  const restMatch = lowerValue.match(/(\d+)\s*(?:sec(?:onds?)?)\s*rest|rest\s*(\d+)\s*(?:sec(?:onds?)?)/i);
  if (restMatch) {
    const restValue = restMatch[1] || restMatch[2];
    if (restValue) {
      defaultResult.rest_seconds = parseInt(restValue, 10);
    }
  }

  return defaultResult;
}

/**
 * Format exercise metrics for display, hiding "none" values
 * @param metrics - Parsed exercise metrics
 * @returns Formatted string for display, or null if everything is none
 */
export function formatExerciseMetricsForDisplay(metrics: ParsedExerciseMetrics): string | null {
  const parts: string[] = [];

  if (metrics.sets !== null) {
    parts.push(`${metrics.sets} ${metrics.sets === 1 ? "set" : "sets"}`);
  }

  if (metrics.reps !== null) {
    parts.push(`${metrics.reps} ${metrics.reps === 1 ? "rep" : "reps"}`);
  }

  if (metrics.duration_seconds !== null) {
    parts.push(`${metrics.duration_seconds} sec`);
  }

  // Always show rest if we have other values
  if (parts.length > 0 && metrics.rest_seconds > 0) {
    parts.push(`${metrics.rest_seconds} sec rest`);
  }

  return parts.length > 0 ? parts.join(" x ").replace(" x ", " x ").replace(/x\s*(\d+\s*sec\s*rest)/, ", $1") : null;
}

// Interface for day-specific workout response
export interface DayWorkoutResponse {
  day?: string;
  name?: string;
  focus?: string;
  "estimated total calories"?: string;
  estimated_total_calories?: string; // Fallback for underscore version
  intensity?: string;
  warm_up?: ExerciseItem[];
  main_workout?: ExerciseItem[];
  cooldown?: ExerciseItem[];
}

/**
 * Generate workout using OpenAI prompt management
 * 
 * @param variables - User profile variables to pass to the prompt
 * @returns Promise with the generated workout response
 */
export async function generateWorkoutWithPrompt(
  variables: WorkoutPromptVariables
): Promise<WorkoutPromptResponse> {
  if (!openai) {
    return {
      success: false,
      error: "OpenAI client is not initialized. Please set NEXT_PUBLIC_OPENAI_API_KEY in .env.local",
    };
  }

  // Log the variables being sent to verify user data is being used
  console.log("📊 Sending user data to OpenAI prompt:", {
    gender: variables.gender,
    goal: variables.goal,
    location: variables.location,
    equipments: variables.equipments,
    level: variables.level,
    schedule: variables.schedule,
    age: variables.age,
    duration: variables.duration,
    plan_name: variables.plan_name ?? "not specified",
    plan_duration: variables.plan_duration ?? "28 days",
    week_number: variables.week_number ?? "1",
  });

  try {
    // Check if the OpenAI client has the responses API
    // If not, we'll need to use an alternative approach
    if (typeof (openai as any).responses?.create === "function") {
      // Use the prompt management API if available
      // Variables are passed in prompt.variables object
      // According to OpenAI API docs: when using prompt with variables, input should be empty array
      const response = await (openai as any).responses.create({
        prompt: {
          id: WORKOUT_PROMPT_ID,
          version: PROMPT_VERSION,
          variables: {
            gender: variables.gender ?? "not specified",
            goal: variables.goal ?? "not specified",
            location: variables.location ?? "not specified",
            equipments: variables.equipments ?? "not specified",
            level: variables.level ?? "not specified",
            schedule: variables.schedule ?? "not specified",
            age: variables.age ?? "not specified",
            duration: variables.duration ?? "not specified",
            plan_name: variables.plan_name ?? "not specified",
            plan_duration: variables.plan_duration ?? "28 days",
            week_number: variables.week_number ?? "1",
          },
        },
        input: [],
        text: {
          format: {
            type: "json_schema",
            name: "workout_plan",
            schema: {
              type: "object",
              properties: {
                plan_name: { type: "string" },
                plan_duration: { type: "string" },
                week_theme: { type: "string" },
                week_number: { type: "string" },
                category: { type: "string" },
                description: { type: "string" },
                days: {
                  type: "object",
                  properties: {
                    monday: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        focus: { type: "string" },
                        motivation: { type: "string" },
                      },
                      required: ["title", "focus", "motivation"],
                      additionalProperties: false,
                    },
                    tuesday: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        focus: { type: "string" },
                        motivation: { type: "string" },
                      },
                      required: ["title", "focus", "motivation"],
                      additionalProperties: false,
                    },
                    wednesday: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        focus: { type: "string" },
                        motivation: { type: "string" },
                      },
                      required: ["title", "focus", "motivation"],
                      additionalProperties: false,
                    },
                    thursday: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        focus: { type: "string" },
                        motivation: { type: "string" },
                      },
                      required: ["title", "focus", "motivation"],
                      additionalProperties: false,
                    },
                    friday: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        focus: { type: "string" },
                        motivation: { type: "string" },
                      },
                      required: ["title", "focus", "motivation"],
                      additionalProperties: false,
                    },
                    saturday: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        focus: { type: "string" },
                        motivation: { type: "string" },
                      },
                      required: ["title", "focus", "motivation"],
                      additionalProperties: false,
                    },
                    sunday: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        focus: { type: "string" },
                        motivation: { type: "string" },
                      },
                      required: ["title", "focus", "motivation"],
                      additionalProperties: false,
                    },
                  },
                  required: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
                  additionalProperties: false,
                },
                rest_days: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
                  },
                },
              },
              required: ["plan_name", "plan_duration", "week_theme", "week_number", "category", "description", "days", "rest_days"],
              additionalProperties: false,
            },
          },
        },
        reasoning: {},
        max_output_tokens: 2048,
        store: true,
        include: ["web_search_call.action.sources"],
      });

      // Extract the response - handle JSON format
      let responseText: string;
      let parsedJSON: WorkoutPlanJSON | undefined;

      // The response structure from OpenAI responses API
      // According to docs: response.output_text or response.text.content
      if (response?.output_text) {
        // Primary response text field
        responseText = response.output_text;
      } else if (response?.text?.content) {
        // Response text content
        responseText = response.text.content;
      } else if (response?.text) {
        // If text is a string directly
        responseText = typeof response.text === "string" ? response.text : JSON.stringify(response.text);
      } else if (typeof response === "string") {
        responseText = response;
      } else if (response?.content) {
        responseText = response.content;
      } else if (response?.message) {
        responseText = response.message;
      } else if (response?.body?.text?.content) {
        // Nested structure
        responseText = response.body.text.content;
      } else if (typeof response === "object") {
        // Try to find any string property in the response
        const stringValue = Object.values(response).find(
          (val) => typeof val === "string" && val.length > 0
        ) as string | undefined;
        responseText = stringValue || JSON.stringify(response, null, 2);
      } else {
        responseText = String(response);
      }

      // Log raw response before parsing
      console.log("📥 Raw OpenAI Response:", {
        responseType: typeof response,
        hasOutputText: !!response?.output_text,
        hasTextContent: !!response?.text?.content,
        responseTextLength: responseText?.length,
        responseTextPreview: responseText?.substring(0, 500),
      });

      // Try to parse JSON from response
      try {
        const rawParsed = JSON.parse(responseText);
        console.log("📋 Raw Parsed JSON (before sanitization):", rawParsed);
        parsedJSON = rawParsed as WorkoutPlanJSON;
        parsedJSON = sanitizeWorkoutPlan(parsedJSON);
        console.log("✨ Sanitized JSON:", parsedJSON);
        responseText = JSON.stringify(parsedJSON, null, 2);
      } catch (e) {
        console.warn("⚠️ JSON parse error, trying direct object access:", e);
        // If parsing fails, try to extract JSON from the response object directly
        if (typeof response === "object" && response !== null) {
          try {
            console.log("📋 Trying direct object access:", response);
            parsedJSON = response as WorkoutPlanJSON;
            parsedJSON = sanitizeWorkoutPlan(parsedJSON);
            console.log("✨ Sanitized JSON from direct object:", parsedJSON);
            responseText = JSON.stringify(parsedJSON, null, 2);
          } catch (e2) {
            console.error("❌ Failed to use direct object:", e2);
            // JSON parsing failed, will return text only
          }
        }
      }

      return {
        success: true,
        response: responseText,
        json: parsedJSON,
      };
    } else {
      // Fallback: Use direct API call if responses.create is not available
      // This is a workaround for when the SDK doesn't support prompt management
      const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
      if (!apiKey) {
        return {
          success: false,
          error: "OpenAI API key not found",
        };
      }

      // Make direct HTTP request to OpenAI's prompt API
      // Variables are passed in prompt.variables object
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: {
            id: WORKOUT_PROMPT_ID,
            version: PROMPT_VERSION,
            variables: {
              gender: variables.gender ?? "not specified",
              goal: variables.goal ?? "not specified",
              location: variables.location ?? "not specified",
              equipments: variables.equipments ?? "not specified",
              level: variables.level ?? "not specified",
              schedule: variables.schedule ?? "not specified",
              age: variables.age ?? "not specified",
              duration: variables.duration ?? "not specified",
              plan_name: variables.plan_name ?? "not specified",
              plan_duration: variables.plan_duration ?? "28 days",
              week_number: variables.week_number ?? "1",
            },
          },
          input: [],
          text: {
            format: {
              type: "json_schema",
              name: "workout_plan",
              schema: {
                type: "object",
                properties: {
                  plan_name: { type: "string" },
                  plan_duration: { type: "string" },
                  week_theme: { type: "string" },
                  week_number: { type: "string" },
                  category: { type: "string" },
                  description: { type: "string" },
                  days: {
                    type: "object",
                    properties: {
                      monday: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          focus: { type: "string" },
                          motivation: { type: "string" },
                        },
                        required: ["title", "focus", "motivation"],
                        additionalProperties: false,
                      },
                      tuesday: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          focus: { type: "string" },
                          motivation: { type: "string" },
                        },
                        required: ["title", "focus", "motivation"],
                        additionalProperties: false,
                      },
                      wednesday: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          focus: { type: "string" },
                          motivation: { type: "string" },
                        },
                        required: ["title", "focus", "motivation"],
                        additionalProperties: false,
                      },
                      thursday: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          focus: { type: "string" },
                          motivation: { type: "string" },
                        },
                        required: ["title", "focus", "motivation"],
                        additionalProperties: false,
                      },
                      friday: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          focus: { type: "string" },
                          motivation: { type: "string" },
                        },
                        required: ["title", "focus", "motivation"],
                        additionalProperties: false,
                      },
                      saturday: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          focus: { type: "string" },
                          motivation: { type: "string" },
                        },
                        required: ["title", "focus", "motivation"],
                        additionalProperties: false,
                      },
                      sunday: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          focus: { type: "string" },
                          motivation: { type: "string" },
                        },
                        required: ["title", "focus", "motivation"],
                        additionalProperties: false,
                      },
                    },
                    required: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
                    additionalProperties: false,
                  },
                  rest_days: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
                    },
                  },
                },
                required: ["plan_name", "plan_duration", "week_theme", "week_number", "category", "description", "days", "rest_days"],
                additionalProperties: false,
              },
            },
          },
          reasoning: {},
          max_output_tokens: 2048,
          store: true,
          include: ["web_search_call.action.sources"],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error?.message || `API request failed with status ${response.status}`,
        };
      }

      const data = await response.json();

      // Extract the response - handle JSON format
      let responseText: string;
      let parsedJSON: WorkoutPlanJSON | undefined;

      // The response structure from OpenAI responses API
      // According to docs: response.output_text or response.text.content
      if (data?.output_text) {
        // Primary response text field
        responseText = data.output_text;
      } else if (data?.text?.content) {
        // Response text content
        responseText = data.text.content;
      } else if (data?.text) {
        // If text is a string directly
        responseText = typeof data.text === "string" ? data.text : JSON.stringify(data.text);
      } else if (typeof data === "string") {
        responseText = data;
      } else if (data?.content) {
        responseText = data.content;
      } else if (data?.message) {
        responseText = data.message;
      } else if (data?.body?.text?.content) {
        // Nested structure
        responseText = data.body.text.content;
      } else if (typeof data === "object") {
        // Try to find any string property in the response
        const stringValue = Object.values(data).find(
          (val) => typeof val === "string" && val.length > 0
        ) as string | undefined;
        responseText = stringValue || JSON.stringify(data, null, 2);
      } else {
        responseText = String(data);
      }

      // Log raw response before parsing
      console.log("📥 Raw OpenAI Response (Fallback):", {
        responseType: typeof data,
        hasOutputText: !!data?.output_text,
        hasTextContent: !!data?.text?.content,
        responseTextLength: responseText?.length,
        responseTextPreview: responseText?.substring(0, 500),
      });

      // Try to parse JSON from response
      try {
        const rawParsed = JSON.parse(responseText);
        console.log("📋 Raw Parsed JSON (before sanitization - Fallback):", rawParsed);
        parsedJSON = rawParsed as WorkoutPlanJSON;
        parsedJSON = sanitizeWorkoutPlan(parsedJSON);
        console.log("✨ Sanitized JSON (Fallback):", parsedJSON);
        responseText = JSON.stringify(parsedJSON, null, 2);
      } catch (e) {
        console.warn("⚠️ JSON parse error (Fallback), trying direct object access:", e);
        // If parsing fails, try to extract JSON from the response object directly
        if (typeof data === "object" && data !== null) {
          try {
            console.log("📋 Trying direct object access (Fallback):", data);
            parsedJSON = data as WorkoutPlanJSON;
            parsedJSON = sanitizeWorkoutPlan(parsedJSON);
            console.log("✨ Sanitized JSON from direct object (Fallback):", parsedJSON);
            responseText = JSON.stringify(parsedJSON, null, 2);
          } catch (e2) {
            console.error("❌ Failed to use direct object (Fallback):", e2);
            // JSON parsing failed, will return text only
          }
        }
      }

      return {
        success: true,
        response: responseText,
        json: parsedJSON,
      };
    }
  } catch (error: any) {
    console.error("Error generating workout with prompt:", error);
    return {
      success: false,
      error: error?.message || "Unknown error occurred while generating workout",
    };
  }
}

/**
 * Helper function to convert user profile to prompt variables
 * Only uses "not specified" when data is truly missing (null, undefined, or empty)
 */
export function convertUserProfileToVariables(userProfile: {
  gender?: string | null;
  fitness_goal?: string | null;
  workout_location?: string | null;
  equipment_list?: string[] | null;
  fitness_level?: string | null;
  weekly_frequency?: string[] | null;
  age_range?: string | null;
  workout_duration_minutes?: number | null;
}): WorkoutPromptVariables {
  // Helper to check if a value is actually provided
  const hasValue = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string" && value.trim() === "") return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  };

  return {
    gender: hasValue(userProfile.gender) ? String(userProfile.gender) : "not specified",
    goal: hasValue(userProfile.fitness_goal) ? String(userProfile.fitness_goal) : "not specified",
    location: hasValue(userProfile.workout_location) ? String(userProfile.workout_location) : "not specified",
    equipments: hasValue(userProfile.equipment_list)
      ? userProfile.equipment_list!.join(", ")
      : "not specified",
    level: hasValue(userProfile.fitness_level) ? String(userProfile.fitness_level) : "not specified",
    schedule: hasValue(userProfile.weekly_frequency)
      ? userProfile.weekly_frequency!.join(", ")
      : "not specified",
    age: hasValue(userProfile.age_range) ? String(userProfile.age_range) : "not specified",
    duration: hasValue(userProfile.workout_duration_minutes)
      ? `${userProfile.workout_duration_minutes} minutes`
      : "not specified",
  };
}

/**
 * Generate day-specific workout using OpenAI prompt management
 * 
 * @param variables - Day-specific workout variables including day_name, plan_name, and day_focus
 * @returns Promise with the generated day workout response
 */
export async function generateDayWorkoutWithPrompt(
  variables: DayWorkoutPromptVariables
): Promise<{ success: boolean; response?: DayWorkoutResponse; error?: string }> {
  try {
    const response = await fetch("/api/generate-day-workout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variables }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error:
          errorData.error ||
          `API request failed with status ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      response: data.response as DayWorkoutResponse,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Unknown error occurred while generating workout",
    };
  }
}

/**
 * Generate day-specific workout using adaptive RPE prompt management
 *
 * @param variables - Adaptive day-specific variables including rpe and remaining_days
 * @returns Promise with the generated day workout response
 */
export async function generateDayWorkoutWithRpePrompt(
  variables: DayWorkoutRpePromptVariables
): Promise<{ success: boolean; response?: DayWorkoutResponse; error?: string }> {
  try {
    const response = await fetch("/api/generate-day-workout-rpe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variables }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error:
          errorData.error ||
          `API request failed with status ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      response: data.response as DayWorkoutResponse,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error occurred while generating workout";
    return {
      success: false,
      error: message,
    };
  }
}

// ===========================
// Plan Metadata Generation
// ===========================

// Prompt ID for plan metadata generation
const PLAN_METADATA_PROMPT_ID = "pmpt_697b9c2d67788195908580fac6389db000faf9c8a4b2d393";
const PLAN_METADATA_PROMPT_VERSION = "3";

// Interface for plan metadata response
export interface PlanMetadataResponse {
  plan_name: string;
  description: string;
  duration_days: number;
  category: string;
  tags: string[];
}

// Interface for plan metadata prompt variables
export interface PlanMetadataPromptVariables {
  gender?: string;
  goal?: string;
  location?: string;
  equipments?: string;
  level?: string;
  schedule?: string;
  age?: string;
  duration?: string;
}

/**
 * Generate plan metadata using OpenAI prompt management
 * 
 * @param variables - User profile variables to pass to the prompt
 * @returns Promise with the generated plan metadata response
 */
export async function generatePlanMetadataWithPrompt(
  variables: PlanMetadataPromptVariables
): Promise<{ success: boolean; response?: PlanMetadataResponse; error?: string }> {
  if (!openai) {
    return {
      success: false,
      error: "OpenAI client is not initialized. Please set NEXT_PUBLIC_OPENAI_API_KEY in .env.local",
    };
  }

  // Log the variables being sent
  console.log("📊 Sending user data to Plan Metadata prompt:", {
    gender: variables.gender,
    goal: variables.goal,
    location: variables.location,
    equipments: variables.equipments,
    level: variables.level,
    schedule: variables.schedule,
    age: variables.age,
    duration: variables.duration,
  });

  try {
    // Check if the OpenAI client has the responses API
    if (typeof (openai as any).responses?.create === "function") {
      const response = await (openai as any).responses.create({
        prompt: {
          id: PLAN_METADATA_PROMPT_ID,
          version: PLAN_METADATA_PROMPT_VERSION,
          variables: {
            gender: variables.gender ?? "not specified",
            goal: variables.goal ?? "not specified",
            location: variables.location ?? "not specified",
            equipments: variables.equipments ?? "not specified",
            level: variables.level ?? "not specified",
            schedule: variables.schedule ?? "not specified",
            age: variables.age ?? "not specified",
            duration: variables.duration ?? "not specified",
          },
        },
        input: [],
        text: {
          format: {
            type: "json_schema",
            name: "plan_metadata",
            schema: {
              type: "object",
              properties: {
                plan_name: { type: "string" },
                description: { type: "string" },
                duration_days: { type: "number" },
                category: { type: "string" },
                tags: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["plan_name", "description", "duration_days", "category", "tags"],
              additionalProperties: false,
            },
          },
        },
        reasoning: {},
        max_output_tokens: 1024,
        store: true,
      });

      // Extract response text
      let responseText: string;
      if (response?.output_text) {
        responseText = response.output_text;
      } else if (response?.text?.content) {
        responseText = response.text.content;
      } else if (response?.text) {
        responseText = typeof response.text === "string" ? response.text : JSON.stringify(response.text);
      } else if (typeof response === "string") {
        responseText = response;
      } else if (typeof response === "object") {
        responseText = JSON.stringify(response, null, 2);
      } else {
        responseText = String(response);
      }

      // Log raw response
      console.log("📥 Raw Plan Metadata Response:", {
        responseType: typeof response,
        responseTextPreview: responseText?.substring(0, 500),
      });

      // Try to parse JSON
      try {
        const parsedJSON = JSON.parse(responseText) as PlanMetadataResponse;
        console.log("✅ Plan Metadata Generated:", parsedJSON);
        return {
          success: true,
          response: parsedJSON,
        };
      } catch (e) {
        console.warn("⚠️ Plan Metadata JSON parse error, trying direct object:", e);
        if (typeof response === "object" && response !== null) {
          try {
            const parsedJSON = response as PlanMetadataResponse;
            console.log("✅ Using direct object as Plan Metadata:", parsedJSON);
            return {
              success: true,
              response: parsedJSON,
            };
          } catch (e2) {
            console.error("❌ Failed to use direct object:", e2);
            return {
              success: false,
              error: "Failed to parse plan metadata response as JSON",
            };
          }
        }
        return {
          success: false,
          error: "Failed to parse plan metadata response as JSON",
        };
      }
    } else {
      // Fallback: Use direct API call
      const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
      if (!apiKey) {
        return {
          success: false,
          error: "OpenAI API key not found",
        };
      }

      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: {
            id: PLAN_METADATA_PROMPT_ID,
            version: PLAN_METADATA_PROMPT_VERSION,
            variables: {
              gender: variables.gender ?? "not specified",
              goal: variables.goal ?? "not specified",
              location: variables.location ?? "not specified",
              equipments: variables.equipments ?? "not specified",
              level: variables.level ?? "not specified",
              schedule: variables.schedule ?? "not specified",
              age: variables.age ?? "not specified",
              duration: variables.duration ?? "not specified",
            },
          },
          input: [],
          text: {
            format: {
              type: "json_schema",
              name: "plan_metadata",
              schema: {
                type: "object",
                properties: {
                  plan_name: { type: "string" },
                  description: { type: "string" },
                  duration_days: { type: "number" },
                  category: { type: "string" },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["plan_name", "description", "duration_days", "category", "tags"],
                additionalProperties: false,
              },
            },
          },
          reasoning: {},
          max_output_tokens: 1024,
          store: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error?.message || `API request failed with status ${response.status}`,
        };
      }

      const data = await response.json();

      // Extract response text
      let responseText: string;
      if (data?.output_text) {
        responseText = data.output_text;
      } else if (data?.text?.content) {
        responseText = data.text.content;
      } else if (data?.text) {
        responseText = typeof data.text === "string" ? data.text : JSON.stringify(data.text);
      } else if (typeof data === "string") {
        responseText = data;
      } else if (typeof data === "object") {
        responseText = JSON.stringify(data, null, 2);
      } else {
        responseText = String(data);
      }

      // Log raw response
      console.log("📥 Raw Plan Metadata Response (Fallback):", {
        responseType: typeof data,
        responseTextPreview: responseText?.substring(0, 500),
      });

      // Try to parse JSON
      try {
        const parsedJSON = JSON.parse(responseText) as PlanMetadataResponse;
        console.log("✅ Plan Metadata Generated (Fallback):", parsedJSON);
        return {
          success: true,
          response: parsedJSON,
        };
      } catch (e) {
        console.warn("⚠️ Plan Metadata JSON parse error (Fallback):", e);
        if (typeof data === "object" && data !== null) {
          try {
            const parsedJSON = data as PlanMetadataResponse;
            console.log("✅ Using direct object as Plan Metadata (Fallback):", parsedJSON);
            return {
              success: true,
              response: parsedJSON,
            };
          } catch (e2) {
            console.error("❌ Failed to use direct object (Fallback):", e2);
            return {
              success: false,
              error: "Failed to parse plan metadata response as JSON",
            };
          }
        }
        return {
          success: false,
          error: "Failed to parse plan metadata response as JSON",
        };
      }
    }
  } catch (error: any) {
    console.error("Error generating plan metadata with prompt:", error);
    return {
      success: false,
      error: error?.message || "Unknown error occurred while generating plan metadata",
    };
  }
}

// ===========================
// Meal Plan Generation (OpenAI Responses API)
// ===========================

const MEAL_PLAN_OVERVIEW_PROMPT_ID = "pmpt_696e0dcf9e4c8195b896c6701566d3880db44d6a0e9965f3";
const MEAL_PLAN_DAY_PROMPT_ID = "pmpt_696e3fefc840819085b5827a5c97bbc80fdfdf8d4754fdde";
const MEAL_PLAN_PROMPT_VERSION = "5";

export interface MealPlanOverviewVariables {
  gender?: string;
  goal?: string;
  dietary_preference?: string;
  weekly_budget?: string;
  weekly_duration?: string;
  allergies?: string;
}

export interface MealPlanOverviewOutput {
  calorie_target_per_day?: string;
  macro_targets?: {
    protein?: string;
    carbs?: string;
    fats?: string;
  };
  days?: Record<string, { theme?: string }>;
}

export interface MealPlanDayVariables extends MealPlanOverviewVariables {
  day_name: string;
  day_theme: string;
}

export interface MealPlanDayMeals {
  breakfast?: MealPlanMeal;
  lunch?: MealPlanMeal;
  dinner?: MealPlanMeal;
  snacks?: MealPlanMeal[];
}

export interface MealPlanDayOutput {
  day?: string;
  meal_theme?: string;
  daily_budget?: string;
  calorie_target?: string;
  macro_breakdown?: {
    protein?: string;
    carbs?: string;
    fats?: string;
  };
  meals?: MealPlanDayMeals;
  total_daily_cost?: string;
}

export interface MealPlanIngredient {
  measurement?: string;
  item?: string;
  item_name?: string;
  price?: string;
}

export interface MealPlanMeal {
  meal_name?: string;
  best_time?: string;
  best_time_to_eat?: string;
  ingredients?: MealPlanIngredient[];
  estimated_meal_cost?: string;
  estimated_cost?: string;
  cooking_instructions?: string[];
}

export async function generateMealPlanOverviewWithPrompt(
  variables: MealPlanOverviewVariables
): Promise<{ success: boolean; response?: MealPlanOverviewOutput; error?: string }> {
  if (!openai) {
    return {
      success: false,
      error: "OpenAI client is not initialized. Set NEXT_PUBLIC_OPENAI_API_KEY in .env.local",
    };
  }

  const vars = {
    gender: variables.gender ?? "not specified",
    goal: variables.goal ?? "not specified",
    dietary_preference: variables.dietary_preference ?? "not specified",
    weekly_budget: variables.weekly_budget ?? "not specified",
    weekly_duration: variables.weekly_duration ?? "not specified",
    allergies: variables.allergies ?? "none",
  };

  console.log("📊 Sending user data to OpenAI meal plan overview prompt:", vars);

  try {
    if (typeof (openai as any).responses?.create === "function") {
      const response = await (openai as any).responses.create({
        prompt: {
          id: MEAL_PLAN_OVERVIEW_PROMPT_ID,
          version: MEAL_PLAN_PROMPT_VERSION,
          variables: vars,
        },
      });

      let responseText: string;
      if (response?.output_text) {
        responseText = response.output_text;
      } else if (response?.text?.content) {
        responseText = response.text.content;
      } else if (response?.text) {
        responseText = typeof response.text === "string" ? response.text : JSON.stringify(response.text);
      } else if (typeof response === "string") {
        responseText = response;
      } else if (typeof response === "object") {
        responseText = JSON.stringify(response, null, 2);
      } else {
        responseText = String(response);
      }

      const parsed = JSON.parse(responseText) as MealPlanOverviewOutput;
      return { success: true, response: parsed };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate meal plan overview";
    return { success: false, error: String(message) };
  }

  return { success: false, error: "OpenAI responses API not available" };
}

export async function generateMealPlanDayWithPrompt(
  variables: MealPlanDayVariables
): Promise<{ success: boolean; response?: MealPlanDayOutput; error?: string }> {
  if (!openai) {
    return {
      success: false,
      error: "OpenAI client is not initialized. Set NEXT_PUBLIC_OPENAI_API_KEY in .env.local",
    };
  }

  const vars = {
    gender: variables.gender ?? "not specified",
    goal: variables.goal ?? "not specified",
    dietary_preference: variables.dietary_preference ?? "not specified",
    weekly_budget: variables.weekly_budget ?? "not specified",
    weekly_duration: variables.weekly_duration ?? "not specified",
    allergies: variables.allergies ?? "none",
    day_name: variables.day_name ?? "not specified",
    day_theme: variables.day_theme ?? "not specified",
  };

  console.log("📊 Sending user data to OpenAI meal plan day prompt:", vars);

  try {
    if (typeof (openai as any).responses?.create === "function") {
      const response = await (openai as any).responses.create({
        prompt: {
          id: MEAL_PLAN_DAY_PROMPT_ID,
          version: MEAL_PLAN_PROMPT_VERSION,
          variables: vars,
        },
        text: {
          format: {
            type: "json_schema",
            name: "meal_plan_day",
            schema: {
              type: "object",
              properties: {
                day: { type: "string" },
                meal_theme: { type: "string" },
                daily_budget: { type: "string" },
                calorie_target: { type: "string" },
                macro_breakdown: {
                  type: "object",
                  properties: {
                    protein: { type: "string" },
                    carbs: { type: "string" },
                    fats: { type: "string" },
                  },
                  required: ["protein", "carbs", "fats"],
                  additionalProperties: false,
                },
                meals: {
                  type: "object",
                  properties: {
                    breakfast: {
                      type: "object",
                      properties: {
                        meal_name: { type: "string" },
                        best_time: { type: "string" },
                        best_time_to_eat: { type: "string" },
                        ingredients: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              measurement: { type: "string" },
                              item: { type: "string" },
                              price: { type: "string" },
                            },
                            required: ["measurement", "item", "price"],
                            additionalProperties: false,
                          },
                        },
                        estimated_meal_cost: { type: "string" },
                        cooking_instructions: {
                          type: "array",
                          items: { type: "string" },
                        },
                      },
                      anyOf: [
                        {
                          required: ["meal_name", "best_time_to_eat"],
                          additionalProperties: false,
                        },
                        {
                          required: ["meal_name", "best_time"],
                          additionalProperties: false,
                        },
                      ],
                      additionalProperties: false,
                    },
                    lunch: {
                      type: "object",
                      properties: {
                        meal_name: { type: "string" },
                        best_time: { type: "string" },
                        best_time_to_eat: { type: "string" },
                        ingredients: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              measurement: { type: "string" },
                              item: { type: "string" },
                              price: { type: "string" },
                            },
                            required: ["measurement", "item", "price"],
                            additionalProperties: false,
                          },
                        },
                        estimated_meal_cost: { type: "string" },
                        cooking_instructions: {
                          type: "array",
                          items: { type: "string" },
                        },
                      },
                      anyOf: [
                        {
                          required: ["meal_name", "best_time_to_eat"],
                          additionalProperties: false,
                        },
                        {
                          required: ["meal_name", "best_time"],
                          additionalProperties: false,
                        },
                      ],
                      additionalProperties: false,
                    },
                    dinner: {
                      type: "object",
                      properties: {
                        meal_name: { type: "string" },
                        best_time: { type: "string" },
                        best_time_to_eat: { type: "string" },
                        ingredients: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              measurement: { type: "string" },
                              item: { type: "string" },
                              price: { type: "string" },
                            },
                            required: ["measurement", "item", "price"],
                            additionalProperties: false,
                          },
                        },
                        estimated_meal_cost: { type: "string" },
                        cooking_instructions: {
                          type: "array",
                          items: { type: "string" },
                        },
                      },
                      anyOf: [
                        {
                          required: ["meal_name", "best_time_to_eat"],
                          additionalProperties: false,
                        },
                        {
                          required: ["meal_name", "best_time"],
                          additionalProperties: false,
                        },
                      ],
                      additionalProperties: false,
                    },
                    snacks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          meal_name: { type: "string" },
                          best_time: { type: "string" },
                          best_time_to_eat: { type: "string" },
                          ingredients: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                measurement: { type: "string" },
                                item: { type: "string" },
                                price: { type: "string" },
                              },
                              required: ["measurement", "item", "price"],
                              additionalProperties: false,
                            },
                          },
                          estimated_meal_cost: { type: "string" },
                          cooking_instructions: {
                            type: "array",
                            items: { type: "string" },
                          },
                        },
                        anyOf: [
                          {
                            required: ["meal_name", "best_time_to_eat"],
                            additionalProperties: false,
                          },
                          {
                            required: ["meal_name", "best_time"],
                            additionalProperties: false,
                          },
                        ],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["breakfast", "lunch", "dinner", "snacks"],
                  additionalProperties: false,
                },
                total_daily_cost: { type: "string" },
              },
              required: [
                "day",
                "meal_theme",
                "daily_budget",
                "calorie_target",
                "macro_breakdown",
                "meals",
                "total_daily_cost",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      let responseText: string;
      if (response?.output_text) {
        responseText = response.output_text;
      } else if (response?.text?.content) {
        responseText = response.text.content;
      } else if (response?.text) {
        responseText = typeof response.text === "string" ? response.text : JSON.stringify(response.text);
      } else if (typeof response === "string") {
        responseText = response;
      } else if (typeof response === "object") {
        responseText = JSON.stringify(response, null, 2);
      } else {
        responseText = String(response);
      }

      const parsed = JSON.parse(responseText) as MealPlanDayOutput;
      return { success: true, response: parsed };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate day meals";
    return { success: false, error: String(message) };
  }

  return { success: false, error: "OpenAI responses API not available" };
}


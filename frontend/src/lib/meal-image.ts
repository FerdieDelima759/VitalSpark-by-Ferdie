import { supabase } from "@/lib/api/supabase";
import { generateImage } from "@/lib/gemini";

const MEAL_IMAGE_BUCKET = "workouts";
const MEAL_IMAGE_FOLDER = "meals/plans";
const MEAL_IMAGE_BASE_URL =
  "https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts";

const DIETARY_FOOD_OPTIONS: Record<string, string[]> = {
  vegan: [
    "chickpea Buddha bowl",
    "tofu stir-fry with vegetables",
    "lentil quinoa salad",
    "roasted vegetable couscous",
  ],
  vegetarian: [
    "caprese quinoa salad",
    "vegetable frittata",
    "spinach ricotta stuffed peppers",
    "mushroom barley bowl",
  ],
  pescatarian: [
    "grilled salmon with greens",
    "tuna poke bowl",
    "shrimp quinoa salad",
    "baked cod with vegetables",
  ],
  keto: [
    "avocado chicken salad",
    "salmon with asparagus",
    "cauliflower rice bowl",
    "zucchini noodles with pesto",
  ],
  paleo: [
    "grilled chicken with sweet potato",
    "steak with roasted vegetables",
    "baked salmon with greens",
    "turkey lettuce wraps",
  ],
  mediterranean: [
    "greek salad with chickpeas",
    "grilled fish with olive salad",
    "hummus and roasted vegetables",
    "quinoa tabbouleh bowl",
  ],
  "gluten-free": [
    "rice bowl with vegetables",
    "quinoa salad with herbs",
    "grilled chicken with greens",
    "sweet potato and black bean bowl",
  ],
  "dairy-free": [
    "coconut curry vegetables",
    "avocado turkey salad",
    "stir-fried tofu with greens",
    "roasted vegetable grain bowl",
  ],
  "low-carb": [
    "grilled chicken salad",
    "zucchini noodle bowl",
    "cauliflower rice stir-fry",
    "turkey lettuce wraps",
  ],
  "high-protein": [
    "chicken quinoa bowl",
    "turkey power salad",
    "salmon with lentils",
    "Greek yogurt parfait",
  ],
};

const FALLBACK_FOOD_OPTIONS = [
  "grilled chicken salad",
  "veggie quinoa bowl",
  "salmon with greens",
  "Mediterranean grain bowl",
];

const normalizePreference = (value?: string): string =>
  (value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const pickFoodForPreference = (dietaryPreference?: string): string => {
  const normalized = normalizePreference(dietaryPreference);

  const matchedKey = Object.keys(DIETARY_FOOD_OPTIONS).find((key) =>
    normalized.includes(key),
  );

  const options = matchedKey
    ? DIETARY_FOOD_OPTIONS[matchedKey]
    : FALLBACK_FOOD_OPTIONS;

  return options[Math.floor(Math.random() * options.length)];
};

export const buildMealPlanImagePrompt = (
  dietaryPreference: string | undefined,
  food: string,
): string => {
  const preferenceLabel = dietaryPreference?.trim()
    ? `${dietaryPreference.trim()}-friendly`
    : "healthy";

  return [
    "Style: high-end food photography, natural light.",
    `Subject: a ${preferenceLabel} ${food} meal, plated beautifully.`,
    "Composition: wide shot, food is far from the camera and small in frame, centered with generous negative space.",
    "Environment: clean kitchen table, soft background bokeh, no people, no hands, no text.",
    "Camera: wide-angle, 16:9 framing, crisp detail, realistic colors.",
  ].join(" ");
};

const imageToBlob = async (image: string): Promise<Blob> => {
  if (image.startsWith("data:image")) {
    const base64Data = image.split(",")[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: "image/png" });
  }

  if (image.startsWith("http")) {
    const response = await fetch(image);
    if (!response.ok) {
      throw new Error("Failed to fetch generated image URL");
    }
    return await response.blob();
  }

  const byteCharacters = atob(image);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: "image/png" });
};

const listExistingMealImages = async (): Promise<number[] | null> => {
  const { data, error } = await supabase.storage
    .from(MEAL_IMAGE_BUCKET)
    .list(MEAL_IMAGE_FOLDER, { limit: 1000, offset: 0 });

  if (error) {
    console.warn("Meal image list failed:", error.message);
    return null;
  }

  const numbers = (data || [])
    .map((item) => item.name)
    .filter((name) => /^\d+\.png$/i.test(name))
    .map((name) => parseInt(name.replace(/\.png$/i, ""), 10))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  return numbers;
};

const checkMealImageExists = async (fileNumber: number): Promise<boolean> => {
  const url = `${MEAL_IMAGE_BASE_URL}/${MEAL_IMAGE_FOLDER}/${fileNumber}.png`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok || response.status === 206;
  } catch {
    return false;
  }
};

const findNextAvailableNumber = async (startAt: number): Promise<number> => {
  let candidate = startAt;
  for (let i = 0; i < 50; i += 1) {
    const exists = await checkMealImageExists(candidate);
    if (!exists) return candidate;
    candidate += 1;
  }
  return candidate;
};

export const getNextMealPlanImageNumber = async (): Promise<number> => {
  const existingNumbers = await listExistingMealImages();
  if (existingNumbers && existingNumbers.length > 0) {
    return existingNumbers[existingNumbers.length - 1] + 1;
  }

  return await findNextAvailableNumber(1);
};

export interface MealPlanImageResult {
  success: boolean;
  url?: string;
  fileName?: string;
  food?: string;
  prompt?: string;
  error?: string;
}

export const generateAndUploadMealPlanImage = async (
  dietaryPreference?: string,
): Promise<MealPlanImageResult> => {
  try {
    const food = pickFoodForPreference(dietaryPreference);
    const prompt = buildMealPlanImagePrompt(dietaryPreference, food);

    const imageResult = await generateImage({
      prompt,
      aspectRatio: "16:9",
      numberOfImages: 1,
    });

    if (!imageResult.success || !imageResult.images?.length) {
      return {
        success: false,
        error: imageResult.error || "Image generation failed",
      };
    }

    const imageBlob = await imageToBlob(imageResult.images[0]);
    const nextNumber = await getNextMealPlanImageNumber();
    const fileName = `${nextNumber}.png`;
    const storagePath = `${MEAL_IMAGE_FOLDER}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(MEAL_IMAGE_BUCKET)
      .upload(storagePath, imageBlob, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      const fallbackNumber = await findNextAvailableNumber(nextNumber + 1);
      const fallbackFileName = `${fallbackNumber}.png`;
      const fallbackPath = `${MEAL_IMAGE_FOLDER}/${fallbackFileName}`;

      const { error: retryError } = await supabase.storage
        .from(MEAL_IMAGE_BUCKET)
        .upload(fallbackPath, imageBlob, {
          contentType: "image/png",
          upsert: false,
        });

      if (retryError) {
        return { success: false, error: retryError.message };
      }

      return {
        success: true,
        url: `${MEAL_IMAGE_BASE_URL}/${fallbackPath}`,
        fileName: fallbackFileName,
        food,
        prompt,
      };
    }

    return {
      success: true,
      url: `${MEAL_IMAGE_BASE_URL}/${storagePath}`,
      fileName,
      food,
      prompt,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to generate meal plan image",
    };
  }
};

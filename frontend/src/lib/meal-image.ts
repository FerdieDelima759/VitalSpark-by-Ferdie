import { generateImage } from "@/lib/gemini";

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

export const pickFoodForPreference = (dietaryPreference?: string): string => {
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

    const response = await fetch("/api/upload-meal-plan-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: imageResult.images[0],
        food,
        prompt,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as MealPlanImageResult;
    if (!response.ok) {
      return {
        success: false,
        error: payload.error || "Failed to upload meal plan image",
      };
    }

    return {
      success: true,
      url: payload.url,
      fileName: payload.fileName,
      food: payload.food ?? food,
      prompt: payload.prompt ?? prompt,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate meal plan image",
    };
  }
};

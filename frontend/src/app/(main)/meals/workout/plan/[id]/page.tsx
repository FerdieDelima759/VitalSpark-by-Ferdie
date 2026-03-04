"use client";

import { useParams } from "next/navigation";
import MealsPageClient from "../../../MealsPageClient";

export default function WorkoutMealPlanPage() {
  const params = useParams<{ id: string }>();
  const workoutPlanId = params?.id ?? null;

  return (
    <MealsPageClient
      workoutPlanIdOverride={workoutPlanId}
      dayGenerationConcurrency={2}
      showBackToMealsButton
    />
  );
}

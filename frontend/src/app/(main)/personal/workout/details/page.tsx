"use client";

import { useSearchParams } from "next/navigation";
import { WorkoutPlanDetailsView } from "./WorkoutPlanDetailsView";

export default function MyWorkoutDetailsPage() {
  const searchParams = useSearchParams();

  return (
    <WorkoutPlanDetailsView
      planId={searchParams.get("id")}
      source={searchParams.get("source")}
    />
  );
}

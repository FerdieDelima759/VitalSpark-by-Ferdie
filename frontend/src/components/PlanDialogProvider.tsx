"use client";

import { usePlansContext } from "@/contexts/PlansContext";
import PlanDialog from "./PlanDialog";

export default function PlanDialogProvider() {
  const { isPlanDialogVisible, hidePlanDialog, planDialogConfig } =
    usePlansContext();

  return (
    <PlanDialog
      visible={isPlanDialogVisible}
      onDismiss={hidePlanDialog}
      showAllPlans={planDialogConfig.showAllPlans}
      highlightTier={planDialogConfig.highlightTier}
      onPlanSelect={planDialogConfig.onPlanSelect}
    />
  );
}


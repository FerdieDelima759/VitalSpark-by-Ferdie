"use client";

import React, { useMemo } from "react";
import { usePlansContext } from "@/contexts/PlansContext";
import { useUserContext } from "@/contexts/UserContext";
import { PlanTier } from "@/types/Plan";
import Dialog from "./Dialog";
import PlanCard from "./PlanCard";
import { HiSparkles, HiLockClosed, HiArrowPath } from "react-icons/hi2";

interface PlanDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onPlanSelect?: (planCode: string, tier: PlanTier) => void;
  showAllPlans?: boolean;
  highlightTier?: PlanTier;
}

const COLORS = {
  teal800: "#115e59",
  teal700: "#0f766e",
  teal600: "#0d9488",
  teal500: "#14b8a6",
  teal50: "#f0fdfa",
  slate900: "#0f172a",
  slate700: "#334155",
  slate500: "#64748b",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
};

export default function PlanDialog({
  visible,
  onDismiss,
  onPlanSelect,
  showAllPlans = true,
  highlightTier,
}: PlanDialogProps): React.ReactElement {
  const { freePlan, proPlan, premiumPlan, loadingState } = usePlansContext();
  const { userProfile } = useUserContext();

  const currentPlanCode = userProfile?.plan_code?.toLowerCase() || "free";

  const getCurrentTier = (): PlanTier => {
    if (currentPlanCode === "premium") return "premium";
    if (currentPlanCode === "pro") return "pro";
    return "free";
  };

  const currentTier = getCurrentTier();

  const plansToShow = useMemo(() => {
    const plans: Array<{ plan: any; tier: PlanTier }> = [];
    if (showAllPlans) {
      if (freePlan) plans.push({ plan: freePlan, tier: "free" });
      if (proPlan) plans.push({ plan: proPlan, tier: "pro" });
      if (premiumPlan) plans.push({ plan: premiumPlan, tier: "premium" });
    } else {
      if (currentTier === "free") {
        // Show all plans for free users
        if (freePlan) plans.push({ plan: freePlan, tier: "free" });
        if (proPlan) plans.push({ plan: proPlan, tier: "pro" });
        if (premiumPlan) plans.push({ plan: premiumPlan, tier: "premium" });
      } else if (currentTier === "pro") {
        // Show Free, Pro and Premium plans for pro users
        if (freePlan) plans.push({ plan: freePlan, tier: "free" });
        if (proPlan) plans.push({ plan: proPlan, tier: "pro" });
        if (premiumPlan) plans.push({ plan: premiumPlan, tier: "premium" });
      }
    }
    return plans;
  }, [showAllPlans, currentTier, freePlan, proPlan, premiumPlan]);

  const handlePlanSelect = (planCode: string, tier: PlanTier) => {
    onPlanSelect?.(planCode, tier);
    onDismiss();
  };

  return (
    <Dialog
      visible={visible}
      onDismiss={onDismiss}
      maxWidth={1200}
      height="90vh"
    >
      {/* Header Strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-teal-700 via-teal-500 to-teal-600 rounded-t-2xl shrink-0" />

      <div className="bg-white px-4 pt-3 pb-4 flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex flex-col items-center mb-3.5 pb-3.5 border-b border-slate-200">
          <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-2.5 shadow-sm">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-700 to-teal-500 flex items-center justify-center shadow-md">
              <HiSparkles className="w-6.5 h-6.5 text-white" />
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 text-center mb-1.5 tracking-tight">
            {showAllPlans ? "Choose Your Plan" : "Upgrade Your Plan"}
          </h2>

          <p className="text-sm font-medium text-slate-600 text-center leading-5 max-w-md px-2">
            {showAllPlans
              ? "Pick the plan that fits your training—no pressure, level up anytime."
              : "Unlock advanced features and accelerate your progress."}
          </p>
        </div>

        {/* Loading */}
        {loadingState.isLoading && (
          <div className="flex flex-col items-center justify-center py-9 gap-3 border border-slate-200 rounded-2xl bg-slate-50 mt-1.5">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
            <p className="text-sm font-semibold text-slate-700">
              Loading plans…
            </p>
          </div>
        )}

        {/* Error */}
        {!!loadingState.error && !loadingState.isLoading && (
          <div className="flex flex-col items-center justify-center py-9 gap-3 border border-red-200 rounded-2xl bg-red-50 mt-1.5">
            <div className="text-red-600 text-2xl">⚠️</div>
            <p className="text-sm font-bold text-red-700 text-center px-3">
              {loadingState.error}
            </p>
          </div>
        )}

        {/* Plans */}
        {!loadingState.isLoading && !loadingState.error && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2.5 flex-1 min-h-0">
            {plansToShow.length === 0 ? (
              <div className="col-span-3 flex flex-col items-center justify-center py-10 gap-2.5 border border-slate-200 rounded-2xl bg-white">
                <div className="text-5xl">🎖️</div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  You're on the top plan
                </h3>
                <p className="text-sm font-medium text-slate-600 text-center max-w-xs">
                  There are no higher tiers available right now.
                </p>
              </div>
            ) : (
              plansToShow.map(({ plan, tier }) => (
                <div key={plan.code} className="flex flex-col h-full">
                  <PlanCard
                    plan={plan}
                    tier={tier}
                    isCurrentPlan={currentPlanCode === plan.code}
                    isRecommended={
                      highlightTier ? tier === highlightTier : tier === "pro"
                    }
                    onSelect={() => handlePlanSelect(plan.code, tier)}
                    compact
                  />
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        {!loadingState.isLoading && plansToShow.length > 0 && (
          <div className="flex flex-row items-center justify-center mt-4 pt-3.5 border-t border-slate-200 gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-50">
              <HiLockClosed className="w-3.5 h-3.5 text-slate-700" />
              <span className="text-xs font-semibold text-slate-700">
                Secure payment
              </span>
            </div>
            <div className="w-1 h-1 rounded-full bg-slate-300" />
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-50">
              <HiArrowPath className="w-3.5 h-3.5 text-slate-700" />
              <span className="text-xs font-semibold text-slate-700">
                Cancel anytime
              </span>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

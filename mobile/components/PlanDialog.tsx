import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { usePlansContext } from "../contexts/PlansContext";
import { useUserContext } from "../contexts/UserContext";
import { PlanTier } from "../types/Plan";
import Dialog from "./Dialog";
import PlanCard from "./PlanCard";

interface PlanDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onPlanSelect?: (planCode: string, tier: PlanTier) => void;
  showAllPlans?: boolean;
  highlightTier?: PlanTier;
}

const COLORS = {
  // Theme
  teal600: "#0f766e",
  teal500: "#14b8a6",
  teal50: "#e6fffb",
  amber600: "#d97706",
  amber500: "#f59e0b",
  amber50: "#fff7ed",

  ink900: "#111827",
  ink700: "#374151",
  ink600: "#4b5563",
  ink500: "#6b7280",

  line: "#e5e7eb",
  bg: "#ffffff",
  soft: "rgba(2,132,199,0.06)", // soft sky-ish tint for subtle blocks
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
        // Show Pro and Premium plans for pro users
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
      maxWidth={Platform.OS === "web" ? 1200 : 720}
      maxHeight={Platform.OS === "web" ? 680 : 800}
    >
      {/* Header Strip */}
      <LinearGradient
        colors={[COLORS.teal500, COLORS.amber500]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerStrip}
      />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View
            style={styles.heroBadgeOuter}
            accessible
            accessibilityRole="image"
            accessibilityLabel="Plan options"
          >
            <View style={styles.heroBadgeInner}>
              <Ionicons name="rocket" size={26} color={COLORS.bg} />
            </View>
          </View>

          <Text style={styles.title}>
            {showAllPlans ? "Choose Your Plan" : "Upgrade Your Plan"}
          </Text>

          <Text style={styles.subtitle}>
            {showAllPlans
              ? "Pick the plan that fits your training—no pressure, level up anytime."
              : "Unlock advanced features and accelerate your progress."}
          </Text>
        </View>

        {/* Loading */}
        {loadingState.isLoading && (
          <View style={styles.stateBlock}>
            <ActivityIndicator size="large" color={COLORS.teal600} />
            <Text style={styles.stateText}>Loading plans…</Text>
          </View>
        )}

        {/* Error */}
        {!!loadingState.error && !loadingState.isLoading && (
          <View style={[styles.stateBlock, styles.errorBlock]}>
            <Ionicons name="alert-circle" size={24} color={COLORS.amber600} />
            <Text style={styles.errorText}>{loadingState.error}</Text>
          </View>
        )}

        {/* Plans */}
        {!loadingState.isLoading && !loadingState.error && (
          <View
            style={[
              styles.plansContainer,
              Platform.OS === "web" ? styles.plansGridWeb : null,
            ]}
          >
            {plansToShow.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="ribbon" size={44} color={COLORS.teal600} />
                <Text style={styles.emptyTitle}>You're on the top plan</Text>
                <Text style={styles.emptyText}>
                  There are no higher tiers available right now.
                </Text>
              </View>
            ) : (
              plansToShow.map(({ plan, tier }) => (
                <PlanCard
                  key={plan.code}
                  plan={plan}
                  tier={tier}
                  isCurrentPlan={currentPlanCode === plan.code}
                  isRecommended={
                    highlightTier ? tier === highlightTier : tier === "pro"
                  }
                  onSelect={() => handlePlanSelect(plan.code, tier)}
                  compact
                />
              ))
            )}
          </View>
        )}

        {/* Footer */}
        {!loadingState.isLoading && plansToShow.length > 0 && (
          <View style={styles.footer}>
            <View style={styles.footerChip}>
              <Ionicons name="lock-closed" size={14} color={COLORS.ink600} />
              <Text style={styles.footerChipText}>Secure payment</Text>
            </View>
            <View style={styles.dot} />
            <View style={styles.footerChip}>
              <Ionicons name="refresh" size={14} color={COLORS.ink600} />
              <Text style={styles.footerChipText}>Cancel anytime</Text>
            </View>
            <View style={styles.dot} />
          </View>
        )}
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  headerStrip: {
    height: 6,
    width: "100%",
  },
  container: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: Platform.OS === "web" ? 16 : 10,
    paddingTop: Platform.OS === "web" ? 12 : 8,
    paddingBottom: Platform.OS === "web" ? 16 : 10,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: Platform.OS === "web" ? 14 : 10,
    paddingBottom: Platform.OS === "web" ? 14 : 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
  },
  heroBadgeOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.amber50,
    borderWidth: 2,
    borderColor: COLORS.amber500,
    marginBottom: 10,
  },
  heroBadgeInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.teal600,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    ...(Platform.OS === "web"
      ? { boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }
      : null),
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.ink900,
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.ink500,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 420,
    paddingHorizontal: 8,
  },
  currentPlanChip: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(20,184,166,0.10)", // teal-500 @ 10%
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  currentPlanText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.teal600,
    letterSpacing: 0.2,
  },

  // States
  stateBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 16,
    backgroundColor: COLORS.soft,
    marginTop: 6,
  },
  stateText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.ink600,
  },
  errorBlock: {
    backgroundColor: COLORS.amber50,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  errorText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.amber600,
    textAlign: "center",
    paddingHorizontal: 12,
  },

  // Plans list
  plansContainer: {
    gap: Platform.OS === "web" ? 12 : 10,
    marginTop: Platform.OS === "web" ? 10 : 8,
  },
  plansGridWeb: {
    display: "grid" as any,
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gridAutoRows: "1fr",
    columnGap: 10,
    rowGap: 12,
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.ink900,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.ink500,
    textAlign: "center",
    maxWidth: 320,
  },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.line,
    gap: 10,
    flexWrap: "wrap",
  },
  footerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(245, 158, 11, 0.08)", // amber wash
  },
  footerChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.ink600,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.line,
  },
});

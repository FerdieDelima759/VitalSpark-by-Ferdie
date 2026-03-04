import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Platform,
  Pressable,
} from "react-native";
import { Plan, PlanTier } from "../types/Plan";
import { formatPlanFeatures } from "../utils/planFeatures";

interface PlanCardProps {
  plan: Plan;
  tier: PlanTier;
  isCurrentPlan?: boolean;
  isRecommended?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}

const COLORS = {
  teal700: "#0f766e",
  teal500: "#14b8a6",
  amber700: "#b45309",
  amber600: "#d97706",
  amber500: "#f59e0b",
  ink900: "#111827",
  ink600: "#4b5563",
  ink500: "#6b7280",
  line: "#e5e7eb",
  card: "#ffffff",
};

export default function PlanCard({
  plan,
  tier,
  isCurrentPlan = false,
  isRecommended = false,
  onSelect,
  compact = false,
}: PlanCardProps): React.ReactElement {
  const { width } = useWindowDimensions();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  const isMobile = !isWeb;

  // Color scheme based on current plan status and hover state
  const colorScheme = isCurrentPlan
    ? {
        // Current plan: All teal
        badgeGradient: [COLORS.teal700, COLORS.teal500] as const,
        border: COLORS.teal500,
        bulletColor: COLORS.teal700,
        buttonGradient: [COLORS.teal700, COLORS.teal500] as const,
      }
    : {
        // Not current plan: Gray initially, amber on hover/active
        badgeGradient: ["#6b7280", "#9ca3af"] as const,
        border: isHovered ? COLORS.amber500 : COLORS.line,
        bulletColor: COLORS.amber600,
        buttonGradient: [COLORS.amber600, COLORS.amber500] as const,
      };

  const tierInfo = (() => {
    switch (tier) {
      case "free":
        return {
          icon: "leaf-outline" as const,
        };
      case "pro":
        return {
          icon: "flash" as const,
        };
      case "premium":
        return {
          icon: "star" as const,
        };
    }
  })();

  const displayFeatures = formatPlanFeatures(plan.features);

  const showFeatures = isWeb || isExpanded;

  const toggleExpand = () => {
    if (isMobile) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <View
      style={[
        styles.wrapper,
        compact && styles.wrapperCompact,
        {
          width: "100%",
          alignSelf: "stretch",
        },
        isWeb && { height: "100%" },
      ]}
    >
      <View
        style={[
          styles.card,
          { borderColor: colorScheme.border },
          compact && styles.cardCompact,
          isWeb &&
            ({
              display: "flex",
              flex: 1,
              flexDirection: "column",
              // @ts-ignore - Web only CSS properties
              transition: "border-color 0.3s ease",
              cursor: !isCurrentPlan ? "pointer" : "default",
            } as any),
        ]}
        {...(isWeb && {
          // @ts-ignore - Web only hover events
          onMouseEnter: () => !isCurrentPlan && setIsHovered(true),
          onMouseLeave: () => !isCurrentPlan && setIsHovered(false),
        })}
      >
        {/* Header - Clickable on mobile */}
        <Pressable onPress={toggleExpand} disabled={isWeb}>
          <View style={[styles.headerRow, compact && styles.headerRowCompact]}>
            <LinearGradient
              colors={colorScheme.badgeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.iconBadge, compact && styles.iconBadgeCompact]}
            >
              <Ionicons
                name={tierInfo.icon}
                size={compact ? 16 : 22}
                color="#ffffff"
              />
            </LinearGradient>

            <View style={styles.headerTextCol}>
              <Text
                style={[styles.planName, compact && styles.planNameCompact]}
              >
                {plan.name}
              </Text>
              {isCurrentPlan && (
                <View style={styles.currentChip}>
                  <Ionicons
                    name="checkmark-circle"
                    size={12}
                    color={COLORS.teal700}
                  />
                  <Text style={styles.currentChipText}>Current plan</Text>
                </View>
              )}
            </View>

            {/* Expand/Collapse Icon on Mobile */}
            {isMobile && (
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color={COLORS.ink500}
              />
            )}
          </View>
        </Pressable>

        {/* Price */}
        <View style={[styles.priceWrap, compact && styles.priceWrapCompact]}>
          {plan.price_usd === 0 ? (
            <Text
              style={[styles.priceZero, compact && styles.priceZeroCompact]}
            >
              Free
            </Text>
          ) : (
            <View style={styles.priceRow}>
              <Text
                style={[styles.currency, compact && styles.currencyCompact]}
              >
                $
              </Text>
              <Text style={[styles.price, compact && styles.priceCompact]}>
                {plan.price_usd.toFixed(2)}
              </Text>
              <Text style={[styles.period, compact && styles.periodCompact]}>
                /month
              </Text>
            </View>
          )}
        </View>

        {/* Tap to view hint on mobile */}
        {isMobile && !isExpanded && (
          <Text style={styles.tapToViewText}>Tap to view features</Text>
        )}

        {/* Features - Show always on web, on expand for mobile */}
        {showFeatures && (
          <View
            style={[
              styles.featuresCol,
              compact && styles.featuresColCompact,
              isWeb && { flex: 1 },
            ]}
          >
            {displayFeatures.map((feature: string, i: number) => (
              <View key={i} style={styles.featureRow}>
                <Text
                  style={[
                    styles.bullet,
                    compact && styles.bulletCompact,
                    {
                      color: colorScheme.bulletColor,
                    },
                  ]}
                >
                  •
                </Text>
                <Text
                  style={[
                    styles.featureText,
                    compact && styles.featureTextCompact,
                  ]}
                >
                  {feature}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Button */}
        {onSelect && (
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isCurrentPlan}
            onPress={onSelect}
            style={[styles.button, isCurrentPlan && styles.buttonDisabled]}
          >
            <LinearGradient
              colors={colorScheme.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Text
                style={[
                  styles.buttonText,
                  !isCurrentPlan && { color: "#ffffff" },
                ]}
              >
                {isCurrentPlan
                  ? "Current Plan"
                  : tier === "free"
                    ? "Get Started"
                    : "Upgrade Now"}
              </Text>
              {!isCurrentPlan && (
                <Ionicons name="arrow-forward" size={18} color="#ffffff" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    marginBottom: 16,
  },
  wrapperCompact: {
    marginBottom: 10,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
  },
  cardCompact: {
    borderRadius: 12,
    padding: 12,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  headerRowCompact: {
    gap: 10,
    marginBottom: 10,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadgeCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerTextCol: { flex: 1 },
  planName: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.ink900,
    letterSpacing: 0.2,
  },
  planNameCompact: {
    fontSize: 15,
    fontWeight: "800",
  },
  currentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(20,184,166,0.10)",
  },
  currentChipText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.teal700,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  priceWrap: { marginBottom: 16 },
  priceWrapCompact: { marginBottom: 10 },
  priceRow: { flexDirection: "row", alignItems: "flex-end" },
  currency: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.ink900,
    marginRight: 2,
    marginBottom: 2,
  },
  currencyCompact: { fontSize: 14, marginBottom: 1 },
  price: {
    fontSize: 34,
    fontWeight: "900",
    color: COLORS.ink900,
    lineHeight: 40,
  },
  priceCompact: { fontSize: 24, lineHeight: 28, fontWeight: "800" },
  period: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.ink500,
    marginLeft: 6,
    marginBottom: 6,
  },
  periodCompact: { fontSize: 11, marginBottom: 4 },
  priceZero: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.ink900,
  },
  priceZeroCompact: { fontSize: 16, fontWeight: "700" },

  tapToViewText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.ink500,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 8,
  },

  featuresCol: { gap: 8, marginBottom: 12 },
  featuresColCompact: { gap: 6, marginBottom: 10 },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 2,
  },
  bullet: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.teal700,
    lineHeight: 20,
    marginTop: 1,
  },
  bulletCompact: {
    fontSize: 14,
    lineHeight: 15,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.ink600,
    lineHeight: 18,
  },
  featureTextCompact: { fontSize: 11, lineHeight: 15, fontWeight: "600" },

  button: { borderRadius: 12, overflow: "hidden" },
  buttonDisabled: { opacity: 1 },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
});

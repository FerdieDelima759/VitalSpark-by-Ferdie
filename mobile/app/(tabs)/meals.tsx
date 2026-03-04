import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMobileWebRedirect } from "@/hooks/useMobileWebRedirect";
import { useBaseNutritionContext } from "@/contexts/BaseNutritionContext";
import { GeneralMealPlan } from "@/types/BaseNutrition";

export default function MealsScreen() {
  useMobileWebRedirect(true);
  const { generalMealPlans, loadingState, refreshBaseNutritionData } =
    useBaseNutritionContext();

  const formatDuration = (days: number): string => {
    if (days === 1) return "1 day";
    if (days < 7) return `${days} days`;
    if (days === 7) return "1 week";
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    if (remainingDays === 0) return `${weeks} week${weeks > 1 ? "s" : ""}`;
    return `${weeks} week${weeks > 1 ? "s" : ""} ${remainingDays} day${remainingDays > 1 ? "s" : ""}`;
  };

  const formatCalories = (calories: number | null): string => {
    if (calories === null) return "N/A";
    return `${calories.toLocaleString()} kcal`;
  };

  if (loadingState.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={styles.loadingText}>Loading meal plans...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadingState.error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Error loading meal plans</Text>
          <Text style={styles.errorMessage}>{loadingState.error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={refreshBaseNutritionData}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={20} color="#ffffff" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meal Plans</Text>
        <Text style={styles.subtitle}>
          {generalMealPlans.length}{" "}
          {generalMealPlans.length === 1 ? "plan" : "plans"} available
        </Text>
      </View>

      {generalMealPlans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No meal plans found</Text>
          <Text style={styles.emptyMessage}>
            Check back later for available meal plans
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {generalMealPlans.map((plan: GeneralMealPlan) => (
            <TouchableOpacity
              key={plan.id}
              style={styles.planCard}
              activeOpacity={0.8}
              onPress={() =>
                router.push(`/(tabs)/meal-plan-details?id=${plan.id}` as any)
              }
            >
              {/* Gradient Accent Bar */}
              <LinearGradient
                colors={["#0d9488", "#14b8a6", "#5eead4"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBar}
              />

              <View style={styles.cardContent}>
                {/* Header */}
                <View style={styles.planCardHeader}>
                  <View style={styles.planCardHeaderLeft}>
                    <View style={styles.iconContainer}>
                      <Ionicons name="restaurant" size={20} color="#0d9488" />
                    </View>
                    <View style={styles.titleContainer}>
                      <Text style={styles.planName}>{plan.name}</Text>
                    </View>
                  </View>
                  <View style={styles.chevronContainer}>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#94a3b8"
                    />
                  </View>
                </View>

                {/* Description */}
                {plan.description && (
                  <Text style={styles.planDescription} numberOfLines={2}>
                    {plan.description}
                  </Text>
                )}

                {/* Stats */}
                <View style={styles.statsContainer}>
                  {/* Duration Row */}
                  <View style={styles.statRow}>
                    <View style={styles.statIconContainer}>
                      <Ionicons name="calendar" size={18} color="#0d9488" />
                    </View>
                    <View style={styles.statContent}>
                      <Text style={styles.statLabel}>Duration</Text>
                      <Text style={styles.statValue}>
                        {formatDuration(plan.duration_days)}
                      </Text>
                    </View>
                  </View>

                  {/* Daily Calories Row */}
                  {plan.estimated_daily_calories && (
                    <View style={styles.statRow}>
                      <View style={styles.statIconContainer}>
                        <Ionicons name="flame" size={18} color="#f59e0b" />
                      </View>
                      <View style={styles.statContent}>
                        <Text style={styles.statLabel}>Daily Calories</Text>
                        <Text style={styles.statValue}>
                          {formatCalories(plan.estimated_daily_calories)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Goal Row */}
                  {plan.goal && (
                    <View style={styles.statRow}>
                      <View style={styles.statIconContainer}>
                        <Ionicons name="flag" size={18} color="#8b5cf6" />
                      </View>
                      <View style={styles.statContent}>
                        <Text style={styles.statLabel}>Goal</Text>
                        <Text style={styles.statValue} numberOfLines={1}>
                          {plan.goal}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0f766e",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  planCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginBottom: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        cursor: "pointer",
      } as any,
    }),
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  gradientBar: {
    height: 4,
    width: "100%",
  },
  cardContent: {
    padding: 20,
  },
  planCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  planCardHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(13, 148, 136, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  titleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  planName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
    flex: 1,
  },
  publicBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f0fdfa",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#5eead4",
    marginTop: 2,
  },
  publicBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0d9488",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  planDescription: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 16,
    paddingLeft: 56,
  },
  statsContainer: {
    flexDirection: "column",
    gap: 12,
    paddingLeft: 56,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(13, 148, 136, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    gap: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 8,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0d9488",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  emptyMessage: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
});

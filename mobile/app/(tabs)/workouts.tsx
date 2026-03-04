import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWorkoutContext } from "../../contexts/WorkoutContext";
import { useUserContext } from "../../contexts/UserContext";
import { usePlansContext } from "../../contexts/PlansContext";
import { useMobileWebRedirect } from "@/hooks/useMobileWebRedirect";
import type { WorkoutPlan } from "../../types/Workout";
import type { PlanTier } from "../../types/Plan";

export default function WorkoutsScreen() {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [currentDate, setCurrentDate] = useState<string>(
    new Date().toDateString()
  );
  const [selectedCategory, setSelectedCategory] =
    useState<string>("All Workouts");

  const {
    workoutPlans,
    loadingState,
    filterPlansByCategory,
    refreshWorkoutData,
  } = useWorkoutContext();

  const { userProfile } = useUserContext();
  const { showPlanDialog } = usePlansContext();

  const [windowWidth, setWindowWidth] = useState<number>(
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.innerWidth
      : Dimensions.get("window").width
  );

  useMobileWebRedirect(true);

  const imageResizeMode = useMemo(
    () => (Platform.OS === "web" ? "stretch" : "cover"),
    []
  );

  const weekDays = useMemo(() => {
    const today: Date = new Date();
    const currentDayOfWeek: number = today.getDay();
    const startOfWeek: Date = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDayOfWeek);
    const daysArray: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day: Date = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      daysArray.push(day);
    }
    return daysArray;
  }, [currentDate]);

  const formatTime = (date: Date): string => {
    const hours: number = date.getHours();
    const minutes: number = date.getMinutes();
    const seconds: number = date.getSeconds();
    const ampm: string = hours >= 12 ? "PM" : "AM";
    const displayHours: number = hours % 12 || 12;
    const mm: string = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const ss: string = seconds < 10 ? `0${seconds}` : `${seconds}`;
    return `${displayHours}:${mm}:${ss} ${ampm}`;
  };

  const isToday = (date: Date): boolean => {
    const today: Date = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Ticking clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now: Date = new Date();
      setCurrentTime(now);
      const newDateString: string = now.toDateString();
      if (newDateString !== currentDate) setCurrentDate(newDateString);
    }, 1000);
    return () => clearInterval(timer);
  }, [currentDate]);

  // Window resize (web)
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handleResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Map category names to database categories
  const getCategoryKey = (category: string): string => {
    // Return exact category name for filtering (no mapping needed)
    // "All Workouts" is the only special case
    if (category === "All Workouts") {
      return "all";
    }
    return category;
  };

  // Helper function to check if a plan matches a category
  const planMatchesCategory = useCallback(
    (plan: WorkoutPlan, categoryKey: string): boolean => {
      if (!plan.category) return false;
      // Exact match with trimmed whitespace
      return plan.category.trim() === categoryKey.trim();
    },
    []
  );

  const getLevelColor = (level: string): readonly [string, string] => {
    const normalized: string = level.toLowerCase();
    if (normalized === "beginner") return ["#22c55e", "#16a34a"] as const;
    if (normalized === "intermediate") return ["#f59e0b", "#d97706"] as const;
    if (normalized === "advanced") return ["#ef4444", "#dc2626"] as const;
    return ["#f59e0b", "#d97706"] as const;
  };

  const formatLevel = (level: string): string =>
    level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();

  // Get user's plan tier
  const getUserPlanTier = useCallback((): "free" | "pro" | "premium" => {
    if (!userProfile?.plan_code) {
      return "free";
    }
    const planCode = userProfile.plan_code.toLowerCase();
    if (planCode === "premium") return "premium";
    if (planCode === "pro") return "pro";
    return "free";
  }, [userProfile]);

  // Check if user can access a specific workout tier
  const canAccessWorkout = useCallback(
    (workoutTier: string): boolean => {
      const userTier = getUserPlanTier();
      const tier = workoutTier?.toLowerCase() || "free";

      // Premium users can access everything
      if (userTier === "premium") return true;

      // Pro users can access free and pro content
      if (userTier === "pro" && (tier === "free" || tier === "pro"))
        return true;

      // Free users can only access free content
      if (userTier === "free" && tier === "free") return true;

      return false;
    },
    [getUserPlanTier]
  );

  // Get unique categories from workout plans
  const availableCategories = useMemo(() => {
    const uniqueCategories = [
      ...new Set(
        workoutPlans
          .map((plan) => plan.category)
          .filter((cat): cat is string => !!cat)
      ),
    ];
    // Add "All Workouts" as first option
    return ["All Workouts", ...uniqueCategories.sort()];
  }, [workoutPlans]);

  // Filter and sort workouts based on selected category and access level
  const filteredWorkouts = useMemo(() => {
    let plans: WorkoutPlan[];
    if (selectedCategory === "All Workouts") {
      plans = workoutPlans;
    } else {
      const categoryKey = getCategoryKey(selectedCategory);
      // Filter by category using the same helper function as the counter
      plans = workoutPlans.filter((plan) =>
        planMatchesCategory(plan, categoryKey)
      );

      // Debug log for filtering
      console.log(
        `🔍 Filtering by "${selectedCategory}" (key: "${categoryKey}"):`,
        `Found ${plans.length} of ${workoutPlans.length} workouts`
      );
    }

    // Sort workouts: unlocked first, then locked
    return [...plans].sort((a, b) => {
      const tierCodeA = a.tier_code?.toLowerCase() || "free";
      const tierCodeB = b.tier_code?.toLowerCase() || "free";
      const hasAccessA = canAccessWorkout(tierCodeA);
      const hasAccessB = canAccessWorkout(tierCodeB);

      // If access levels differ, prioritize accessible workouts
      if (hasAccessA && !hasAccessB) return -1;
      if (!hasAccessA && hasAccessB) return 1;

      // If both have same access level, maintain original order
      return 0;
    });
  }, [selectedCategory, workoutPlans, canAccessWorkout, planMatchesCategory]);

  const shouldShowTwoColumns: boolean =
    Platform.OS === "web" && windowWidth > 670;

  // Get total count of all plans
  const totalPlansCount = useMemo(() => {
    return workoutPlans.length;
  }, [workoutPlans]);

  const handleWorkoutPress = useCallback((planId: string) => {
    router.push(`/(tabs)/workout-details?id=${planId}` as any);
  }, []);

  const handleViewAll = useCallback(() => {
    setSelectedCategory("All Workouts");
  }, []);

  return (
    <SafeAreaView 
      style={styles.safeArea}
      edges={Platform.OS === "ios" ? ["top"] : ["top", "bottom"]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={Platform.OS === "ios"}
      >
        <View style={styles.pageContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Image
                source={require("../../assets/images/Logo_VitalSpark.png")}
                style={styles.brandLogo}
                resizeMode="contain"
              />
              <Text style={styles.brandName}>VitalSpark by Ferdie</Text>
            </View>
          </View>

          {/* Week Calendar */}
          <View style={styles.calendarSection}>
            <View style={styles.calendarHeader}>
              <Ionicons
                name="time-outline"
                size={18}
                color="#f59e0b"
                style={styles.clockIcon}
              />
              <Text style={styles.currentTime}>{formatTime(currentTime)}</Text>
            </View>
            <View style={styles.weekContainer}>
              {weekDays.map((day: Date, index: number) => {
                const isTodayFlag: boolean = isToday(day);
                const dayName: string = [
                  "Sun",
                  "Mon",
                  "Tue",
                  "Wed",
                  "Thu",
                  "Fri",
                  "Sat",
                ][day.getDay()];
                const dateNumber: number = day.getDate();
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayContainer,
                      isTodayFlag && styles.dayContainerToday,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayName,
                        isTodayFlag && styles.dayNameToday,
                      ]}
                    >
                      {dayName}
                    </Text>
                    <Text
                      style={[
                        styles.dayNumber,
                        isTodayFlag && styles.dayNumberToday,
                      ]}
                    >
                      {dateNumber}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Title & Subtitle Card */}
          <View style={styles.titleCard}>
            <LinearGradient
              colors={["#0d9488", "#14b8a6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.titleCardGradient}
            >
              <View style={styles.titleDecorativeCircle1} />
              <View style={styles.titleDecorativeCircle2} />
              <View style={styles.titleContent}>
                <View style={styles.titleBadge}>
                  <Ionicons name="flash" size={16} color="#f59e0b" />
                  <Text style={styles.titleBadgeText}>Ignite Your Goals</Text>
                </View>
                <Text style={styles.title}>Workout Plans For You</Text>
                <Text style={styles.subtitle}>
                  Choose Your Rhythm Move with intention. Every category is a
                  doorway—step through the one that speaks to your breath today.
                </Text>
              </View>
            </LinearGradient>
          </View>

          {/* Categories */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
            style={styles.categoriesScroll}
          >
            {availableCategories.map((cat) => {
              const getCategoryIcon = (categoryName: string): string => {
                if (categoryName === "All Workouts") return "grid";
                if (categoryName === "Core Awakening") return "fitness";
                if (categoryName === "Gentle Mobility") return "leaf";
                if (categoryName === "Cardio Clarity") return "pulse";
                if (categoryName === "Strength & Stillness") return "barbell";
                if (categoryName === "Soulful Challenges") return "flame";
                return "fitness"; // Default icon
              };

              return (
                <TouchableOpacity
                  key={cat}
                  style={styles.categoryCard}
                  activeOpacity={0.8}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <LinearGradient
                    colors={
                      selectedCategory === cat
                        ? ["#0d9488", "#14b8a6"]
                        : ["#f59e0b", "#fbbf24"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.categoryGradient}
                  >
                    <Ionicons
                      name={getCategoryIcon(cat) as any}
                      size={20}
                      color="#ffffff"
                    />
                    <Text style={styles.categoryText}>{cat}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* View All Button with Total Count */}
          <View style={styles.viewAllContainer}>
            <View style={styles.filterInfoContainer}>
              <Text style={styles.totalCountText}>
                {filteredWorkouts.length} of {totalPlansCount} workouts
              </Text>
            </View>
            {selectedCategory !== "All Workouts" && (
              <TouchableOpacity
                style={styles.viewAllButton}
                activeOpacity={0.7}
                onPress={handleViewAll}
              >
                <Text style={styles.viewAllButtonText}>Clear Filter</Text>
                <Ionicons name="close-circle" size={16} color="#0d9488" />
              </TouchableOpacity>
            )}
          </View>

          {/* Workout Plan Cards */}
          {loadingState.isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0d9488" />
              <Text style={styles.loadingText}>Loading workouts...</Text>
            </View>
          ) : loadingState.error ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
              <Text style={styles.errorText}>Error: {loadingState.error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={refreshWorkoutData}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredWorkouts.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="barbell-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>
                {selectedCategory === "All Workouts"
                  ? "No workouts available"
                  : `No workouts found in "${selectedCategory}" category`}
              </Text>
              {selectedCategory !== "All Workouts" && (
                <>
                  <Text style={styles.emptySubtext}>
                    The category filter might not match the database values.
                  </Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={handleViewAll}
                  >
                    <Text style={styles.retryButtonText}>
                      View All Workouts
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <View
              style={[
                styles.cardsContainer,
                shouldShowTwoColumns && styles.cardsContainerGrid,
              ]}
            >
              {filteredWorkouts.map((plan: WorkoutPlan, index: number) => {
                const tierCode = plan.tier_code?.toLowerCase() || "free";
                const hasAccess: boolean = canAccessWorkout(tierCode);
                const isLocked: boolean = !hasAccess;

                return (
                  <TouchableOpacity
                    key={plan.id}
                    style={[
                      styles.cardTouchable,
                      shouldShowTwoColumns && styles.cardTouchableGrid,
                      shouldShowTwoColumns
                        ? index > 1 && styles.cardTouchableSpacing
                        : index > 0 && styles.cardTouchableSpacing,
                    ]}
                    activeOpacity={isLocked ? 0.7 : 0.85}
                    onPress={() => {
                      if (isLocked) {
                        // Show plan dialog to upgrade
                        showPlanDialog({
                          showAllPlans: false,
                          highlightTier:
                            tierCode === "premium" ? "premium" : "pro",
                          onPlanSelect: (planCode: string, tier: PlanTier) => {
                            console.log("Selected plan:", planCode, tier);
                            // TODO: Navigate to payment/subscription page
                          },
                        });
                        return;
                      }
                      handleWorkoutPress(plan.id);
                    }}
                  >
                    <View style={styles.cardShell}>
                      <ImageBackground
                        source={require("../../assets/images/onboarding_1.png")}
                        style={styles.cardImage}
                        resizeMode={imageResizeMode as any}
                        imageStyle={styles.cardImageInner}
                      >
                        <LinearGradient
                          colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0.9)"]}
                          start={{ x: 0.5, y: 0.2 }}
                          end={{ x: 0.5, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                        {isLocked && (
                          <View style={styles.lockedOverlay}>
                            <View style={styles.lockIconContainer}>
                              <Ionicons
                                name="lock-closed"
                                size={32}
                                color="#f59e0b"
                              />
                            </View>
                          </View>
                        )}
                        <View style={styles.cardContent}>
                          {/* Level Pill */}
                          <LinearGradient
                            colors={getLevelColor(plan.level)}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.levelPill}
                          >
                            <Text style={styles.levelPillText}>
                              {formatLevel(plan.level)}
                            </Text>
                          </LinearGradient>

                          {/* Footer Row */}
                          <View style={styles.cardFooterRow}>
                            <View style={styles.cardTextCol}>
                              <Text
                                style={styles.cardTitle}
                                numberOfLines={2}
                                ellipsizeMode="tail"
                              >
                                {plan.name || "Workout"}
                              </Text>
                              {(plan.total_exercises || plan.total_minutes) && (
                                <View style={styles.cardMetaRow}>
                                  {plan.total_exercises &&
                                    plan.total_exercises > 0 && (
                                      <>
                                        <Text style={styles.cardMetaText}>
                                          {plan.total_exercises}{" "}
                                          {plan.total_exercises === 1
                                            ? "exercise"
                                            : "exercises"}
                                        </Text>
                                        {plan.total_minutes &&
                                          plan.total_minutes > 0 && (
                                            <View style={styles.metaDot} />
                                          )}
                                      </>
                                    )}
                                  {plan.total_minutes &&
                                    plan.total_minutes > 0 && (
                                      <Text style={styles.cardMetaText}>
                                        {plan.total_minutes} min
                                      </Text>
                                    )}
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      </ImageBackground>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Unlock All Exercises Button - Only for Free and Pro accounts */}
          {!loadingState.isLoading &&
            filteredWorkouts.length > 0 &&
            getUserPlanTier() !== "premium" && (
              <TouchableOpacity
                style={styles.unlockAllButton}
                activeOpacity={0.8}
                onPress={() =>
                  showPlanDialog({
                    showAllPlans: false,
                    highlightTier:
                      getUserPlanTier() === "free" ? "pro" : "premium",
                    onPlanSelect: (planCode: string, tier: PlanTier) => {
                      console.log("Selected plan:", planCode, tier);
                      // TODO: Navigate to payment/subscription page or handle upgrade
                    },
                  })
                }
              >
                <LinearGradient
                  colors={["#f59e0b", "#fbbf24"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.unlockAllButtonGradient}
                >
                  <Ionicons name="lock-open" size={20} color="#ffffff" />
                  <Text style={styles.unlockAllButtonText}>
                    Unlock all exercises
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="#ffffff" />
                </LinearGradient>
              </TouchableOpacity>
            )}

          <View style={{ height: 12 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#ffffff" },
  scroll: {
    flex: 1,
    ...(Platform.OS === "web"
      ? ({ WebkitOverflowScrolling: "touch" } as any)
      : null),
  },
  scrollContent: { paddingBottom: 40 },

  pageContainer: {
    alignSelf: "center",
    paddingHorizontal: 16,
    ...(Platform.OS === "web"
      ? typeof window !== "undefined" && window.innerWidth > 768
        ? { width: "60%", minWidth: 360, maxWidth: 1100 }
        : { alignSelf: "center", width: "75%", minWidth: 410, maxWidth: 1100 }
      : { width: "100%" }),
  },

  header: { paddingTop: 12, paddingBottom: 20 },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brandLogo: { width: 32, height: 32, marginRight: 8 },
  brandName: { fontSize: 14, fontWeight: "600", color: "#374151" },

  calendarSection: { marginBottom: 20, paddingHorizontal: 8 },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 12,
  },
  clockIcon: { marginRight: 6 },
  currentTime: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f59e0b",
    letterSpacing: 0.5,
  },
  weekContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 8,
  },
  dayContainer: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: "transparent",
  },
  dayContainerToday: {
    backgroundColor: "#0d9488",
    paddingVertical: 14,
    transform: [{ scale: 1.05 }],
    ...Platform.select({
      ios: {
        shadowColor: "#0d9488",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 4px 12px rgba(13, 148, 136, 0.4)",
      },
    }),
  },
  dayName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 4,
  },
  dayNameToday: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  dayNumber: { fontSize: 16, fontWeight: "700", color: "#374151" },
  dayNumberToday: { color: "#ffffff", fontSize: 18, fontWeight: "800" },

  titleCard: {
    marginBottom: 20,
    marginHorizontal: 4,
    borderRadius: 20,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#0d9488",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 6px 20px rgba(13, 148, 136, 0.3)",
      },
    }),
  },
  titleCardGradient: { position: "relative", overflow: "hidden" },
  titleDecorativeCircle1: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  titleDecorativeCircle2: {
    position: "absolute",
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  titleContent: {
    paddingVertical: 24,
    paddingHorizontal: 24,
    position: "relative",
    zIndex: 1,
  },
  titleBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  titleBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0d9488",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.3,
    marginBottom: 8,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "500",
  },

  categoriesScroll: { marginBottom: 20 },
  categoriesContainer: { paddingHorizontal: 4, paddingVertical: 4 },
  categoryCard: {
    marginHorizontal: 4,
    borderRadius: 12,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.12)",
      },
    }),
  },
  categoryGradient: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  cardsContainer: { width: "100%" },
  cardsContainerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "space-between",
  },

  cardTouchable: { paddingHorizontal: 4 },
  cardTouchableGrid: { width: "48%", paddingHorizontal: 0 },
  cardTouchableSpacing: { marginTop: 16 },

  cardShell: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
  },
  cardImage: {
    width: "100%",
    ...(Platform.OS === "web"
      ? { aspectRatio: 7 / 3, height: 180 }
      : { height: 170 }),
    justifyContent: "space-between",
  },
  cardImageInner: {
    borderRadius: 16,
    ...(Platform.OS === "web" ? { width: "100%", height: "100%" } : {}),
  },
  cardContent: {
    flex: 1,
    padding: Platform.OS === "web" ? 12 : 16,
    justifyContent: "space-between",
  },
  levelPill: {
    alignSelf: "flex-end",
    paddingHorizontal: Platform.OS === "web" ? 8 : 10,
    paddingVertical: Platform.OS === "web" ? 3 : 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  levelPillText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: Platform.OS === "web" ? 10 : 12,
  },

  loadingContainer: {
    paddingHorizontal: 4,
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: { fontSize: 16, color: "#0f766e", fontWeight: "700" },
  errorText: {
    fontSize: 16,
    color: "#dc2626",
    fontWeight: "600",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "400",
    textAlign: "center",
    marginTop: 4,
  },

  retryButton: {
    backgroundColor: "#0d9488",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  retryButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },

  viewAllContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 16,
    marginHorizontal: 8,
    flexWrap: "wrap",
    gap: 8,
  },
  filterInfoContainer: {
    flexDirection: "column",
    gap: 6,
  },
  totalCountText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  activeFilterBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#d1fae5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0d9488",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#f0fdfa",
    borderRadius: 8,
  },
  viewAllButtonText: { fontSize: 14, fontWeight: "600", color: "#0d9488" },

  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  lockIconContainer: { alignItems: "center", gap: 8 },
  premiumText: {
    color: "#f59e0b",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  cardFooterRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  cardTextCol: { flex: 1, paddingRight: 8 },
  cardTitle: {
    color: "#ffffff",
    fontSize: Platform.OS === "web" ? 18 : 22,
    fontWeight: "800",
    ...(Platform.OS === "web" && {
      wordBreak: "break-word" as any,
      overflowWrap: "break-word" as any,
    }),
  },
  cardMetaRow: { marginTop: 4, flexDirection: "row", alignItems: "center" },
  cardMetaText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: Platform.OS === "web" ? 11 : 13,
    fontWeight: "500",
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.5)",
    marginHorizontal: 8,
  },
  playButton: {
    backgroundColor: "#0d9488",
    borderRadius: 999,
    padding: Platform.OS === "web" ? 8 : 10,
  },

  unlockAllButton: {
    marginTop: 24,
    marginHorizontal: 4,
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#f59e0b",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)",
      },
    }),
  },
  unlockAllButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  unlockAllButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

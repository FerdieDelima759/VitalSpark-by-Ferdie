import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useUserWorkoutData } from "../../hooks/useUserWorkoutData";
import { useUserWorkoutContext } from "../../contexts/UserWorkoutContext";
import { UserWorkoutPlan } from "../../types/UserWorkout";
import { useMobileWebRedirect } from "@/hooks/useMobileWebRedirect";
import { testOpenAIConnectionFull } from "../../utils/test_openai_connection";
import { GenerateWorkout } from "../../lib/openai";

// Helper function to format text in title case
const formatTitleCase = (text: string): string => {
  return text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

// Helper function to format day names to 3-letter abbreviations
const formatDayAbbreviation = (day: string): string => {
  const dayMap: { [key: string]: string } = {
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
  };

  const lowerDay = day.toLowerCase();
  return dayMap[lowerDay] || day.substring(0, 3);
};

const getLevelColor = (level: string): readonly [string, string] => {
  const normalizedLevel: string = level.toLowerCase();
  if (normalizedLevel === "beginner") {
    return ["#22c55e", "#16a34a"] as const;
  } else if (normalizedLevel === "intermediate") {
    return ["#f59e0b", "#d97706"] as const;
  } else if (normalizedLevel === "advanced") {
    return ["#ef4444", "#dc2626"] as const;
  }
  return ["#f59e0b", "#d97706"] as const;
};

const formatLevel = (level: string): string => {
  return level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
};

export default function PersonalScreen() {
  const insets = useSafeAreaInsets();
  const keyboardVerticalOffset = useMemo(
    () => Math.max(insets.top, 16),
    [insets.top]
  );

  // Auth and user data
  const { user } = useAuth();

  // User Workout Data
  const { userWorkoutPlans, loadingState } = useUserWorkoutContext();
  const { fetchUserWorkoutPlans, isLoading: isLoadingWorkouts } =
    useUserWorkoutData();

  useMobileWebRedirect(true);

  const [windowWidth, setWindowWidth] = useState<number>(
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.innerWidth
      : Dimensions.get("window").width
  );

  // OpenAI connection test state
  const [openAITestResult, setOpenAITestResult] = useState<{
    isTesting: boolean;
    success: boolean | null;
    message?: string;
  }>({
    isTesting: false,
    success: null,
  });

  // Workout generation state
  const [isGeneratingWorkout, setIsGeneratingWorkout] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState<string | null>(null);

  const imageResizeMode = useMemo(
    () => (Platform.OS === "web" ? "stretch" : "cover"),
    []
  );

  const shouldShowTwoColumns: boolean =
    Platform.OS === "web" && windowWidth > 670;

  // Mock profile data (replace with actual profile hook if available)
  const profile = {
    plan_code: "free",
    height: 175,
    height_unit: "cm",
    weight: 70,
    weight_unit: "kg",
    fitness_goal: "build muscle",
    fitness_level: "intermediate",
    workout_duration_minutes: 45,
    workout_location: "gym",
    equipment_list: ["dumbbells", "barbell", "resistance bands"],
    weekly_frequency: ["monday", "wednesday", "friday"],
  };

  // Fetch user's workout plans on mount
  useEffect(() => {
    if (user?.id) {
      fetchUserWorkoutPlans(user.id);
    }
  }, [user?.id]);

  // Test OpenAI connection on mount
  useEffect(() => {
    async function testOpenAI() {
      setOpenAITestResult({ isTesting: true, success: null });
      const result = await testOpenAIConnectionFull();
      setOpenAITestResult({
        isTesting: false,
        success: result,
        message: result
          ? "OpenAI connection successful!"
          : "OpenAI connection failed. Check console for details.",
      });
    }
    testOpenAI();
  }, []);

  // Window resize (web)
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handleResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Handle AI card click - Generate workout
  const handleAICardClick = async () => {
    if (isGeneratingWorkout) return;

    setIsGeneratingWorkout(true);
    setGeneratedWorkout(null);

    try {
      const result = await GenerateWorkout({
        fitness_goal: profile.fitness_goal,
        fitness_level: profile.fitness_level,
        workout_duration_minutes: profile.workout_duration_minutes,
        workout_location: profile.workout_location,
        equipment_list: profile.equipment_list,
      });

      if (result.success && result.workout) {
        setGeneratedWorkout(result.workout);
      } else {
        setGeneratedWorkout("Unable to generate workout. Please try again.");
      }
    } catch (error) {
      console.error("Error generating workout:", error);
      setGeneratedWorkout("An error occurred. Please try again.");
    } finally {
      setIsGeneratingWorkout(false);
    }
  };

  // Navigate to workout details
  const handleWorkoutPress = (planId: string) => {
    router.push({
      pathname: "/user-workout-details",
      params: { planId },
    });
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#f8fafc" }}
      edges={Platform.OS === "ios" ? ["top"] : ["top", "bottom"]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{
            flex: 1,
            backgroundColor: "#f8fafc",
            ...(Platform.OS === "web"
              ? ({ WebkitOverflowScrolling: "touch" } as any)
              : undefined),
          }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={false}
          showsVerticalScrollIndicator={false}
          bounces={Platform.OS === "ios"}
          contentContainerStyle={{
            paddingBottom: 40,
          }}
        >
          <View style={styles.pageContainer}>
            {/* Clean Header */}
            <View className="mb-8 mt-6">
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1">
                  <View style={styles.headerTitleRow}>
                    <Text className="text-4xl text-teal-700 mb-1 font-extrabold">
                      Spark AI
                    </Text>
                    {/* OpenAI Connection Status */}
                    {!openAITestResult.isTesting &&
                      openAITestResult.success !== null && (
                        <View style={styles.headerStatusContainer}>
                          {openAITestResult.success ? (
                            <View style={styles.headerStatusCircle} />
                          ) : (
                            <Ionicons
                              name="close-circle"
                              size={14}
                              color="#ef4444"
                            />
                          )}
                          <Text
                            style={[
                              styles.headerStatusText,
                              openAITestResult.success
                                ? styles.headerStatusSuccess
                                : styles.headerStatusError,
                            ]}
                          >
                            {openAITestResult.success
                              ? "Connected"
                              : "Unable to connect"}
                          </Text>
                        </View>
                      )}
                  </View>
                  <Text className="text-base text-neutral-500">
                    Your personalized AI workout companion
                  </Text>
                </View>
              </View>

              {/* Decorative Line */}
              <View
                style={{
                  height: 3,
                  backgroundColor: "#f59e0b",
                  borderRadius: 2,
                  width: 60,
                  marginTop: 4,
                }}
              />
            </View>

            {/* Simplified Fitness Profile Card */}
            {profile && (
              <View style={styles.profileCard}>
                {/* Header */}
                <View style={styles.profileCardHeader}>
                  <View style={styles.profileHeaderLeft}>
                    <Text style={styles.profileCardTitle}>Fitness Profile</Text>
                    <Text style={styles.profileCardSubtitle}>
                      Your current fitness snapshot
                    </Text>
                  </View>
                  <View style={styles.profilePlanBadge}>
                    <Text style={styles.profilePlanBadgeText}>
                      {profile.plan_code?.toUpperCase() || "FREE"}
                    </Text>
                  </View>
                </View>

                {/* Main Stats Row */}
                <View style={styles.mainStatsRow}>
                  {/* Physical Stats */}
                  <View style={styles.statGroup}>
                    <Text style={styles.statGroupLabel}>Physical</Text>
                    <View style={styles.statRow}>
                      {profile.height && (
                        <View style={styles.statItem}>
                          <Ionicons name="resize" size={16} color="#0d9488" />
                          <Text style={styles.statText}>
                            {profile.height} {profile.height_unit || "cm"}
                          </Text>
                        </View>
                      )}
                      {profile.weight && (
                        <View style={styles.statItem}>
                          <Ionicons name="scale" size={16} color="#0d9488" />
                          <Text style={styles.statText}>
                            {profile.weight} {profile.weight_unit || "kg"}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Fitness Stats */}
                  <View style={styles.statGroup}>
                    <Text style={styles.statGroupLabel}>Goals</Text>
                    <View style={styles.statRow}>
                      {profile.fitness_goal && (
                        <View style={styles.statItem}>
                          <Ionicons name="flag" size={16} color="#0d9488" />
                          <Text style={styles.statText}>
                            {formatTitleCase(profile.fitness_goal)}
                          </Text>
                        </View>
                      )}
                      {profile.fitness_level && (
                        <View style={styles.statItem}>
                          <Ionicons
                            name="trending-up"
                            size={16}
                            color="#0d9488"
                          />
                          <Text style={styles.statText}>
                            {formatTitleCase(profile.fitness_level)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Workout Preferences */}
                <View style={styles.preferencesSection}>
                  <Text style={styles.statGroupLabel}>Workout Preferences</Text>

                  <View style={styles.preferenceRow}>
                    {profile.workout_duration_minutes && (
                      <View style={styles.preferenceItem}>
                        <Ionicons
                          name="time-outline"
                          size={18}
                          color="#6b7280"
                        />
                        <Text style={styles.preferenceText}>
                          {profile.workout_duration_minutes} min sessions
                        </Text>
                      </View>
                    )}

                    {profile.workout_location && (
                      <View style={styles.preferenceItem}>
                        <Ionicons
                          name="location-outline"
                          size={18}
                          color="#6b7280"
                        />
                        <Text style={styles.preferenceText}>
                          {formatTitleCase(profile.workout_location)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {profile.weekly_frequency &&
                    profile.weekly_frequency.length > 0 && (
                      <View style={styles.frequencyContainer}>
                        <Ionicons
                          name="calendar-outline"
                          size={18}
                          color="#6b7280"
                        />
                        <Text style={styles.preferenceText}>
                          {profile.weekly_frequency
                            .map((day) => formatDayAbbreviation(day))
                            .join(", ")}
                        </Text>
                      </View>
                    )}

                  {profile.equipment_list &&
                    profile.equipment_list.length > 0 && (
                      <View style={styles.equipmentContainer}>
                        <Ionicons
                          name="barbell-outline"
                          size={18}
                          color="#6b7280"
                        />
                        <View style={styles.equipmentTagsContainer}>
                          {profile.equipment_list
                            .slice(0, 4)
                            .map((equipment, index) => (
                              <View key={index} style={styles.equipmentChip}>
                                <Text style={styles.equipmentChipText}>
                                  {formatTitleCase(equipment)}
                                </Text>
                              </View>
                            ))}
                          {profile.equipment_list.length > 4 && (
                            <View style={styles.equipmentChip}>
                              <Text style={styles.equipmentChipText}>
                                +{profile.equipment_list.length - 4}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}
                </View>
              </View>
            )}

            {/* AI Generator Card - Non-functional UI Only */}
            {profile && (
              <View className="mt-8">
                <View style={styles.aiGeneratorCard}>
                  <LinearGradient
                    colors={["#f59e0b", "#fbbf24", "#fcd34d"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.aiGeneratorGradient}
                  >
                    {/* Decorative Elements */}
                    <View style={styles.aiDecorativeCircle1} />
                    <View style={styles.aiDecorativeCircle2} />
                    <View style={styles.aiDecorativeCircle3} />

                    <View style={styles.aiContent}>
                      {/* Badge */}
                      <View style={styles.aiBadge}>
                        <Ionicons name="sparkles" size={16} color="#f59e0b" />
                        <Text style={styles.aiBadgeText}>AI Powered</Text>
                      </View>

                      {/* Title */}
                      <Text style={styles.aiTitle}>
                        Generate Your Perfect Workout
                      </Text>

                      {/* Subtitle */}
                      <Text style={styles.aiSubtitle}>
                        Our AI analyzes your profile, fitness goals, and
                        preferences to create a customized workout plan tailored
                        just for you. Get started with a plan that adapts to
                        your schedule and equipment.
                      </Text>

                      {/* Generated Workout Display */}
                      {generatedWorkout && (
                        <View style={styles.generatedWorkoutContainer}>
                          <Text style={styles.generatedWorkoutText}>
                            {generatedWorkout}
                          </Text>
                        </View>
                      )}

                      {/* Generate Button */}
                      <Pressable
                        onPress={handleAICardClick}
                        disabled={isGeneratingWorkout}
                        style={[
                          styles.aiGenerateButton,
                          isGeneratingWorkout &&
                            styles.aiGenerateButtonDisabled,
                        ]}
                      >
                        {isGeneratingWorkout ? (
                          <>
                            <ActivityIndicator size="small" color="#f59e0b" />
                            <Text
                              style={[
                                styles.aiButtonText,
                                { color: "#f59e0b", marginLeft: 8 },
                              ]}
                            >
                              Generating...
                            </Text>
                          </>
                        ) : (
                          <>
                            <Ionicons
                              name="sparkles"
                              size={20}
                              color="#f59e0b"
                            />
                            <Text
                              style={[
                                styles.aiButtonText,
                                { color: "#f59e0b" },
                              ]}
                            >
                              Generate Workout
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </LinearGradient>
                </View>
              </View>
            )}

            {/* Workout Plans Section */}
            <View style={styles.workoutPlansSection}>
              <View style={styles.workoutPlansHeader}>
                <Text style={styles.workoutPlansTitle}>
                  Your Saved Workouts
                </Text>
                <Text style={styles.workoutPlansSubtitle}>
                  Your personalized workout plans ready to use
                </Text>
              </View>

              {/* Workout Plan Cards */}
              {isLoadingWorkouts || loadingState.isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#0d9488" />
                  <Text style={styles.loadingText}>Loading workouts...</Text>
                </View>
              ) : userWorkoutPlans.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <Ionicons name="barbell-outline" size={48} color="#94a3b8" />
                  <Text style={styles.emptyText}>No saved workouts yet</Text>
                  <Text style={styles.emptySubtext}>
                    Create your first workout plan to get started!
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.cardsContainer,
                    shouldShowTwoColumns && styles.cardsContainerGrid,
                  ]}
                >
                  {userWorkoutPlans.map(
                    (workout: UserWorkoutPlan, index: number) => {
                      return (
                        <TouchableOpacity
                          key={workout.id}
                          style={[
                            styles.cardTouchable,
                            shouldShowTwoColumns && styles.cardTouchableGrid,
                            shouldShowTwoColumns
                              ? index > 1 && styles.cardTouchableSpacing
                              : index > 0 && styles.cardTouchableSpacing,
                          ]}
                          activeOpacity={0.85}
                          onPress={() => handleWorkoutPress(workout.id)}
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
                              <View style={styles.cardContent}>
                                {/* Level Pill */}
                                <LinearGradient
                                  colors={getLevelColor(workout.level)}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 0 }}
                                  style={styles.levelPill}
                                >
                                  <Text style={styles.levelPillText}>
                                    {formatLevel(workout.level)}
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
                                      {workout.name || "Workout"}
                                    </Text>
                                    {(workout.total_exercises ||
                                      workout.total_minutes) && (
                                      <View style={styles.cardMetaRow}>
                                        {workout.total_exercises &&
                                          workout.total_exercises > 0 && (
                                            <>
                                              <Text style={styles.cardMetaText}>
                                                {workout.total_exercises}{" "}
                                                {workout.total_exercises === 1
                                                  ? "exercise"
                                                  : "exercises"}
                                              </Text>
                                              {workout.total_minutes &&
                                                workout.total_minutes > 0 && (
                                                  <View
                                                    style={styles.metaDot}
                                                  />
                                                )}
                                            </>
                                          )}
                                        {workout.total_minutes &&
                                          workout.total_minutes > 0 && (
                                            <Text style={styles.cardMetaText}>
                                              {workout.total_minutes} min
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
                    }
                  )}
                </View>
              )}
            </View>

            {/* Future Features Preview */}
            <View className="mt-8">
              <Text className="text-lg font-semibold text-neutral-800 mb-4">
                Coming Soon
              </Text>
              <View className="space-y-2">
                <Text className="text-gray-600">
                  • AI-powered workout generation
                </Text>
                <Text className="text-gray-600">• AI form analysis</Text>
                <Text className="text-gray-600">
                  • Smart nutrition recommendations
                </Text>
                <Text className="text-gray-600">
                  • Progress tracking insights
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    ...(Platform.OS === "web"
      ? typeof window !== "undefined" && window.innerWidth > 768
        ? { width: "60%", minWidth: 360, maxWidth: 1100 }
        : { alignSelf: "center", width: "75%", minWidth: 410, maxWidth: 1100 }
      : { width: "100%" }),
  },

  // Simplified Profile Card Styles
  profileCard: {
    marginTop: 16,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
      },
    }),
  },
  profileCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  profileHeaderLeft: {
    flex: 1,
  },
  profileCardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f766e",
    marginBottom: 4,
  },
  profileCardSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  profilePlanBadge: {
    backgroundColor: "#0d9488",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  profilePlanBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  mainStatsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  statGroup: {
    flex: 1,
  },
  statGroupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  statRow: {
    gap: 8,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  statText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  preferencesSection: {
    gap: 12,
  },
  preferenceRow: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
  },
  preferenceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  preferenceText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  frequencyContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  equipmentContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 4,
  },
  equipmentTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
  },
  equipmentChip: {
    backgroundColor: "#f0fdfa",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#99f6e4",
  },
  equipmentChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0d9488",
  },

  // AI Generator Card Styles
  aiGeneratorCard: {
    marginHorizontal: 4,
    borderRadius: 18,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#f59e0b",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0 4px 16px rgba(245, 158, 11, 0.25)",
      },
    }),
  },
  aiGeneratorGradient: {
    position: "relative",
    overflow: "hidden",
  },
  aiDecorativeCircle1: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  aiDecorativeCircle2: {
    position: "absolute",
    bottom: -20,
    left: -20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  aiDecorativeCircle3: {
    position: "absolute",
    top: 15,
    right: 15,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  aiContent: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    position: "relative",
    zIndex: 1,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
    gap: 5,
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
  aiBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#f59e0b",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  aiTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.3,
    marginBottom: 6,
    lineHeight: 28,
  },
  aiSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "500",
    marginBottom: 16,
  },
  generatedWorkoutContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  generatedWorkoutText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#ffffff",
    fontWeight: "500",
    textAlign: "center",
  },
  aiGenerateButton: {
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
      },
    }),
  },
  aiGenerateButtonDisabled: {
    opacity: 0.7,
  },
  aiButtonText: {
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 8,
  },

  // Workout Plans Section Styles
  workoutPlansSection: {
    marginTop: 32,
  },
  workoutPlansHeader: {
    marginBottom: 16,
  },
  workoutPlansTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f766e",
    marginBottom: 4,
  },
  workoutPlansSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  cardsContainer: {
    width: "100%",
  },
  cardsContainerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "space-between",
  },
  cardTouchable: {
    paddingHorizontal: 4,
  },
  cardTouchableGrid: {
    width: "48%",
    paddingHorizontal: 0,
  },
  cardTouchableSpacing: {
    marginTop: 16,
  },
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
  loadingText: {
    fontSize: 16,
    color: "#0f766e",
    fontWeight: "700",
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
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  cardTextCol: {
    flex: 1,
    paddingRight: 8,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: Platform.OS === "web" ? 18 : 22,
    fontWeight: "800",
    ...(Platform.OS === "web" && {
      wordBreak: "break-word" as any,
      overflowWrap: "break-word" as any,
    }),
  },
  cardMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
  },
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

  // Header Status Styles
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  headerStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  headerStatusCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22c55e",
  },
  headerStatusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  headerStatusSuccess: {
    color: "#22c55e",
  },
  headerStatusError: {
    color: "#ef4444",
  },
});

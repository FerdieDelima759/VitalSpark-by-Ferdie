import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  ActivityIndicator,
  Animated,
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
import { useWorkoutData } from "../../hooks/useWorkoutData";
import { useMobileWebRedirect } from "@/hooks/useMobileWebRedirect";
import { supabase } from "../../utils/supabase";
import type {
  WorkoutPlanFull,
  WorkoutPlanExerciseWithDetails,
  WorkoutTag,
} from "../../types/Workout";

// ===========================
// Web-specific Cache Manager
// ===========================
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache for web
const CACHE_KEY_PREFIX = "workout_details_";

interface CachedWorkoutData {
  workoutPlan: WorkoutPlanFull;
  userGender: string;
  timestamp: number;
}

const getCachedData = (planId: string): CachedWorkoutData | null => {
  if (Platform.OS !== "web" || typeof sessionStorage === "undefined") {
    return null;
  }

  try {
    const cached = sessionStorage.getItem(`${CACHE_KEY_PREFIX}${planId}`);
    if (!cached) return null;

    const parsed: CachedWorkoutData = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;

    if (age > CACHE_DURATION) {
      sessionStorage.removeItem(`${CACHE_KEY_PREFIX}${planId}`);
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn("Cache read error:", error);
    return null;
  }
};

const setCachedData = (
  planId: string,
  workoutPlan: WorkoutPlanFull,
  userGender: string
): void => {
  if (Platform.OS !== "web" || typeof sessionStorage === "undefined") {
    return;
  }

  try {
    const cacheData: CachedWorkoutData = {
      workoutPlan,
      userGender,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(
      `${CACHE_KEY_PREFIX}${planId}`,
      JSON.stringify(cacheData)
    );
  } catch (error) {
    console.warn("Cache write error:", error);
  }
};

// ===========================
// Web-optimized fetching with timeout
// ===========================
const fetchWithTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number = 10000
): Promise<T> => {
  if (Platform.OS !== "web") {
    return promise;
  }

  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
    ),
  ]);
};

export default function WorkoutDetailsScreen() {
  const params = useLocalSearchParams();
  const planId = params.id as string;
  const refreshParam = params.refresh as string;

  const { fetchWorkoutPlanFull, isLoading } = useWorkoutData();
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlanFull | null>(null);
  const [userGender, setUserGender] = useState<string>("male");
  const [isLoadingOptimized, setIsLoadingOptimized] = useState<boolean>(false);

  // Shimmer animation for skeleton
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const fetchStartTimeRef = useRef<number>(0);

  useMobileWebRedirect(true);

  // Normalize gender for image paths (only male/female images available)
  const normalizedGender = useMemo(() => {
    const gender = userGender.toLowerCase();
    if (gender === "female") return "female";
    // Default to male for: male, non-binary, other, prefer not to say, etc.
    return "male";
  }, [userGender]);

  // Determine which loading state to show
  const isActuallyLoading = isLoading || isLoadingOptimized;

  // Reset state when visiting the page (on mount, when planId changes, or when refreshParam changes)
  useEffect(() => {
    console.log("🔄 Resetting workout details state", {
      planId,
      refreshParam,
      timestamp: Date.now(),
    });
    // Reset all state to ensure fresh start
    setWorkoutPlan(null);
    setUserGender("male");
    setIsLoadingOptimized(false);

    // Clear web cache if refreshParam is present (coming back from exercise session)
    if (Platform.OS === "web" && refreshParam && planId) {
      try {
        sessionStorage.removeItem(`${CACHE_KEY_PREFIX}${planId}`);
        console.log("🗑️ Cleared workout details cache due to refresh");
      } catch (error) {
        console.warn("Error clearing cache:", error);
      }
    }
  }, [planId, refreshParam]);

  // Start shimmer animation
  useEffect(() => {
    if (isActuallyLoading || !workoutPlan) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isActuallyLoading, workoutPlan, shimmerAnim]);

  useEffect(() => {
    let isMounted = true;
    let abortController: AbortController | null = null;

    async function loadWorkoutPlan() {
      if (!planId) return;

      // Force reload when refreshParam is present (coming from exercise session)
      if (refreshParam) {
        console.log("🔄 Force reloading workout details due to refresh param");
        // Ensure state is cleared before fetching
        setWorkoutPlan(null);
        setUserGender("male");
      }

      setIsLoadingOptimized(true);
      fetchStartTimeRef.current = Date.now();

      // Web-specific: Check cache first (skip cache if refreshParam is present)
      if (Platform.OS === "web" && !refreshParam) {
        const cached = getCachedData(planId);
        if (cached) {
          console.log("✅ [WEB] Using cached workout data");
          if (isMounted) {
            setUserGender(cached.userGender);
            setWorkoutPlan(cached.workoutPlan);
            setIsLoadingOptimized(false);
          }
          return;
        }
      }

      // Web-specific: Use AbortController for request cancellation
      if (Platform.OS === "web" && typeof AbortController !== "undefined") {
        abortController = new AbortController();
      }

      try {
        // Optimized parallel fetch with timeout protection for web
        const fetchPromise = Promise.all([
          // Fetch user gender
          (async () => {
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (user) {
                const { data: profile } = await supabase
                  .from("user_profile")
                  .select("gender")
                  .eq("user_id", user.id)
                  .single();
                return profile?.gender?.toLowerCase() || "male";
              }
              return "male";
            } catch (error) {
              console.error("Error fetching user gender:", error);
              return "male";
            }
          })(),
          // Fetch workout plan
          fetchWorkoutPlanFull(planId),
        ]);

        const [genderResult, workoutResult] = await (Platform.OS === "web"
          ? fetchWithTimeout(fetchPromise, 10000)
          : fetchPromise);

        if (isMounted && !abortController?.signal.aborted) {
          setUserGender(genderResult);

          if (workoutResult.success && workoutResult.data) {
            setWorkoutPlan(workoutResult.data);

            // Web-specific: Cache the result
            if (Platform.OS === "web") {
              setCachedData(planId, workoutResult.data, genderResult);

              // Performance logging
              const fetchDuration = Date.now() - fetchStartTimeRef.current;
              console.log(`⚡ [WEB] Workout loaded in ${fetchDuration}ms`);
            }
          } else {
            console.error("Failed to load workout:", workoutResult.error);
          }
        }
      } catch (error: any) {
        if (!abortController?.signal.aborted) {
          console.error("Error loading workout plan:", error);

          // Web-specific: Show user-friendly error
          if (Platform.OS === "web") {
            if (error?.message === "Request timeout") {
              console.error(
                "⚠️ [WEB] Request timed out. Please check your connection."
              );
            } else if (!navigator.onLine) {
              console.error("⚠️ [WEB] No internet connection.");
            }
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingOptimized(false);
        }
      }
    }

    loadWorkoutPlan();

    // Cleanup function
    return () => {
      isMounted = false;
      if (abortController) {
        abortController.abort();
      }
      setWorkoutPlan(null);
      setUserGender("male");
    };
  }, [planId, fetchWorkoutPlanFull, refreshParam]);

  // Preload workout images for web
  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      typeof window === "undefined" ||
      !workoutPlan?.exercises
    ) {
      return;
    }

    const preloadWorkoutImages = () => {
      const uniqueImages = new Set<string>();

      // Collect all unique exercise images
      workoutPlan.exercises?.forEach((exercise) => {
        if (exercise.exercise_details?.image_slug) {
          const url = getExerciseImageUrl(
            exercise.section,
            exercise.exercise_details.image_slug
          );
          uniqueImages.add(url);
        }
      });

      console.log(
        `🖼️ Preloading ${uniqueImages.size} workout preview images...`
      );

      // Preload using link prefetch and Image objects
      uniqueImages.forEach((url) => {
        // Browser-native prefetch
        const existingLink = document.querySelector(
          `link[rel="prefetch"][href="${url}"]`
        );
        if (!existingLink) {
          const link = document.createElement("link");
          link.rel = "prefetch";
          link.as = "image";
          link.href = url;
          document.head.appendChild(link);
        }

        // Immediate preload via HTMLImageElement
        const img = new (window as any).Image() as HTMLImageElement;
        img.src = url;
      });

      console.log("✅ Workout preview images queued for preload");
    };

    // Delay slightly to not block initial render
    const timer = setTimeout(preloadWorkoutImages, 50);

    return () => clearTimeout(timer);
  }, [workoutPlan, normalizedGender]);

  const getLevelColor = useCallback(
    (level: string): readonly [string, string] => {
      const normalized = level.toLowerCase();
      if (normalized === "beginner") return ["#22c55e", "#16a34a"] as const;
      if (normalized === "intermediate") return ["#f59e0b", "#d97706"] as const;
      if (normalized === "advanced") return ["#ef4444", "#dc2626"] as const;
      return ["#f59e0b", "#d97706"] as const;
    },
    []
  );

  const formatLevel = useCallback(
    (level: string): string =>
      level.charAt(0).toUpperCase() + level.slice(1).toLowerCase(),
    []
  );

  const getRandomTagColor = useCallback(
    (index: number): { borderColor: string; textColor: string } => {
      const colors = [
        { borderColor: "#f59e0b", textColor: "#d97706" },
        { borderColor: "#14b8a6", textColor: "#0d9488" },
        { borderColor: "#0ea5e9", textColor: "#0284c7" },
        { borderColor: "#8b5cf6", textColor: "#7c3aed" },
        { borderColor: "#ec4899", textColor: "#db2777" },
        { borderColor: "#10b981", textColor: "#059669" },
      ];
      return colors[index % colors.length];
    },
    []
  );

  const getExerciseImageUrl = useCallback(
    (section: string, imageSlug: string): string => {
      const baseUrl =
        "https://fvlaenpwxjnkzpbjnhrl.supabase.co/storage/v1/object/public/workouts/exercises/";
      return `${baseUrl}${normalizedGender}/${section}/${imageSlug}.png`;
    },
    [normalizedGender]
  );

  const formatDuration = useCallback((seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }, []);

  const getSectionTitle = useCallback(
    (section: string, count: number): string => {
      if (section === "warmup") return "Warm Up";
      if (section === "main") return `Exercises (${count})`;
      if (section === "cooldown") return "Cool Down";
      return section;
    },
    []
  );

  const formatSets = useCallback((sets: number): string => {
    return sets === 1 ? "1 set" : `${sets} sets`;
  }, []);

  const formatReps = useCallback((reps: number): string => {
    return reps === 1 ? "1 rep" : `${reps} reps`;
  }, []);

  const warmupExercises = useMemo(
    () => workoutPlan?.exercises?.filter((ex) => ex.section === "warmup") || [],
    [workoutPlan]
  );
  const mainExercises = useMemo(
    () => workoutPlan?.exercises?.filter((ex) => ex.section === "main") || [],
    [workoutPlan]
  );
  const cooldownExercises = useMemo(
    () =>
      workoutPlan?.exercises?.filter((ex) => ex.section === "cooldown") || [],
    [workoutPlan]
  );

  if (isActuallyLoading || !workoutPlan) {
    const shimmerOpacity = shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.7, 0.95],
    });

    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.pageContainer}>
            {/* Hero Skeleton */}
            <Animated.View
              style={[
                styles.heroWrap,
                styles.skeletonHero,
                { opacity: shimmerOpacity },
              ]}
            />

            {/* Content Skeleton */}
            <View style={styles.cardContainer}>
              <View style={styles.innerPad}>
                <Animated.View
                  style={[styles.skeletonTitle, { opacity: shimmerOpacity }]}
                />
                <Animated.View
                  style={[styles.skeletonTags, { opacity: shimmerOpacity }]}
                />
                <Animated.View
                  style={[styles.skeletonStats, { opacity: shimmerOpacity }]}
                />
                <Animated.View
                  style={[
                    styles.skeletonDescription,
                    { opacity: shimmerOpacity },
                  ]}
                />

                {/* Exercise skeletons */}
                {[1, 2, 3].map((item) => (
                  <View key={item} style={styles.skeletonExerciseRow}>
                    <Animated.View
                      style={[
                        styles.skeletonThumb,
                        { opacity: shimmerOpacity },
                      ]}
                    />
                    <View style={styles.skeletonExerciseText}>
                      <Animated.View
                        style={[
                          styles.skeletonExerciseName,
                          { opacity: shimmerOpacity },
                        ]}
                      />
                      <Animated.View
                        style={[
                          styles.skeletonExerciseMeta,
                          { opacity: shimmerOpacity },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.pageContainer}>
          {/* Top Hero Image */}
          <View style={styles.heroWrap}>
            <ImageBackground
              source={
                workoutPlan.image_path && workoutPlan.image_path.trim() !== ""
                  ? { uri: workoutPlan.image_path }
                  : require("../../assets/images/onboarding_1.png")
              }
              resizeMode="cover"
              style={[
                Platform.OS === "web"
                  ? styles.heroImageWeb
                  : styles.heroImageNative,
              ]}
              imageStyle={styles.heroImageRadius}
            >
              <LinearGradient
                colors={["rgba(255,255,255,0)", "rgba(255,255,255,1)"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              <TouchableOpacity
                onPress={() => router.push("/(tabs)/workouts")}
                style={styles.backBtn}
                accessibilityLabel="Go back"
                accessibilityRole="button"
              >
                <Ionicons name="arrow-back" size={24} color="#ffffff" />
              </TouchableOpacity>

              <LinearGradient
                colors={getLevelColor(workoutPlan.level)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.levelBadgeTop}
              >
                <Text style={styles.levelBadgeText}>
                  {formatLevel(workoutPlan.level)}
                </Text>
              </LinearGradient>
            </ImageBackground>
          </View>

          {/* Content */}
          <View style={styles.cardContainer}>
            <View style={styles.innerPad}>
              <Text style={styles.title} numberOfLines={3} ellipsizeMode="tail">
                {workoutPlan.name || "Workout Plan"}
              </Text>

              {workoutPlan.tags && workoutPlan.tags.length > 0 && (
                <View style={styles.tagRow}>
                  {workoutPlan.tags.map((tag: WorkoutTag, index: number) => {
                    const tagColor = getRandomTagColor(index);
                    return (
                      <View
                        key={tag.id}
                        style={[
                          styles.tagPill,
                          { borderColor: tagColor.borderColor },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tagText,
                            { color: tagColor.textColor },
                          ]}
                        >
                          {tag.name}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {(workoutPlan.total_minutes || workoutPlan.total_calories) && (
                <View style={styles.statsRow}>
                  {workoutPlan.total_minutes && (
                    <View style={styles.statCell}>
                      <Ionicons name="time-outline" size={28} color="#14b8a6" />
                      <Text style={styles.statValue}>
                        {workoutPlan.total_minutes} mins
                      </Text>
                    </View>
                  )}
                  {workoutPlan.total_calories && (
                    <View style={styles.statCell}>
                      <Ionicons
                        name="flame-outline"
                        size={28}
                        color="#f59e0b"
                      />
                      <Text style={[styles.statValue, { color: "#f59e0b" }]}>
                        {workoutPlan.total_calories} kCal
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {workoutPlan.description &&
                workoutPlan.description.trim() !== "" && (
                  <View style={styles.descriptionBox}>
                    <Text style={styles.descriptionText}>
                      {workoutPlan.description}
                    </Text>
                  </View>
                )}

              {workoutPlan.motivation &&
                workoutPlan.motivation.trim() !== "" && (
                  <View style={styles.quoteBox}>
                    <Text style={styles.quoteText}>
                      "{workoutPlan.motivation}"
                    </Text>
                  </View>
                )}

              {warmupExercises.length > 0 && (
                <View style={styles.exercisesWrap}>
                  <Text style={styles.sectionTitle}>
                    {getSectionTitle("warmup", warmupExercises.length)}
                  </Text>
                  {warmupExercises.map((exercise, index) => (
                    <ExerciseRow
                      key={`warmup-${exercise.exercise_id}-${index}`}
                      exercise={exercise}
                      userGender={userGender}
                      getExerciseImageUrl={getExerciseImageUrl}
                      formatSets={formatSets}
                      formatReps={formatReps}
                      formatDuration={formatDuration}
                    />
                  ))}
                </View>
              )}

              {mainExercises.length > 0 && (
                <View style={styles.exercisesWrap}>
                  <Text style={styles.sectionTitle}>
                    {getSectionTitle("main", mainExercises.length)}
                  </Text>
                  {mainExercises.map((exercise, index) => (
                    <ExerciseRow
                      key={`main-${exercise.exercise_id}-${index}`}
                      exercise={exercise}
                      userGender={userGender}
                      getExerciseImageUrl={getExerciseImageUrl}
                      formatSets={formatSets}
                      formatReps={formatReps}
                      formatDuration={formatDuration}
                    />
                  ))}
                </View>
              )}

              {cooldownExercises.length > 0 && (
                <View style={styles.exercisesWrap}>
                  <Text style={styles.sectionTitle}>
                    {getSectionTitle("cooldown", cooldownExercises.length)}
                  </Text>
                  {cooldownExercises.map((exercise, index) => (
                    <ExerciseRow
                      key={`cooldown-${exercise.exercise_id}-${index}`}
                      exercise={exercise}
                      userGender={userGender}
                      getExerciseImageUrl={getExerciseImageUrl}
                      formatSets={formatSets}
                      formatReps={formatReps}
                      formatDuration={formatDuration}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Start Exercise Button */}
      <View style={styles.stickyButtonContainer}>
        <TouchableOpacity
          style={styles.startButton}
          activeOpacity={0.8}
          onPress={() =>
            router.push(`/(tabs)/exercise-session?planId=${planId}` as any)
          }
        >
          <LinearGradient
            colors={["#0d9488", "#14b8a6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.startButtonGradient}
          >
            <Ionicons name="play-circle" size={24} color="#ffffff" />
            <Text style={styles.startButtonText}>Start Workout</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ===========================
// Exercise Row Component (Memoized)
// ===========================

const ExerciseRow = React.memo(
  ({
    exercise,
    userGender,
    getExerciseImageUrl,
    formatSets,
    formatReps,
    formatDuration,
  }: {
    exercise: WorkoutPlanExerciseWithDetails;
    userGender: string;
    getExerciseImageUrl: (section: string, imageSlug: string) => string;
    formatSets: (sets: number) => string;
    formatReps: (reps: number) => string;
    formatDuration: (seconds: number) => string;
  }) => {
    return (
      <TouchableOpacity activeOpacity={0.85} style={styles.exerciseRow}>
        {exercise.exercise_details?.image_slug &&
        exercise.exercise_details.image_slug.trim() !== "" ? (
          Platform.OS === "web" ? (
            <img
              src={getExerciseImageUrl(
                exercise.section,
                exercise.exercise_details.image_slug
              )}
              alt={exercise.exercise_details.name || "Exercise"}
              style={{
                width: 80,
                height: 80,
                borderRadius: 10,
                backgroundColor: "#f5f5f5",
                objectFit: "contain",
              }}
            />
          ) : (
            <Image
              source={{
                uri: getExerciseImageUrl(
                  exercise.section,
                  exercise.exercise_details.image_slug
                ),
              }}
              style={styles.exerciseThumb}
              resizeMode="contain"
            />
          )
        ) : (
          <View style={styles.exerciseThumbPlaceholder}>
            <Ionicons name="fitness" size={24} color="#9ca3af" />
          </View>
        )}
        <View style={styles.exerciseTextCol}>
          <Text style={styles.exerciseName} numberOfLines={2}>
            {exercise.exercise_details?.name || "Exercise"}
          </Text>

          {exercise.exercise_details?.primary_muscle &&
            exercise.exercise_details.primary_muscle.trim() !== "" && (
              <Text style={styles.exerciseMuscle} numberOfLines={1}>
                Target: {exercise.exercise_details.primary_muscle}
              </Text>
            )}

          {(exercise.sets ||
            exercise.reps ||
            exercise.duration_seconds ||
            exercise.per_side) && (
            <View style={styles.exerciseMetaRow}>
              {exercise.sets && exercise.sets > 0 && (
                <View style={styles.metaItem}>
                  <Ionicons name="repeat" size={12} color="#6b7280" />
                  <Text style={styles.metaBadge}>
                    {formatSets(exercise.sets)}
                  </Text>
                </View>
              )}
              {exercise.reps && exercise.reps > 0 && (
                <View style={styles.metaItem}>
                  <Ionicons name="fitness" size={12} color="#6b7280" />
                  <Text style={styles.metaBadge}>
                    {formatReps(exercise.reps)}
                  </Text>
                </View>
              )}
              {exercise.duration_seconds && exercise.duration_seconds > 0 && (
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={12} color="#6b7280" />
                  <Text style={styles.metaBadge}>
                    {formatDuration(exercise.duration_seconds)}
                  </Text>
                </View>
              )}
              {exercise.per_side && (
                <View style={styles.metaItem}>
                  <Ionicons name="swap-horizontal" size={12} color="#6b7280" />
                  <Text style={styles.metaBadge}>Each side</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scroll: {
    flex: 1,
    ...(Platform.OS === "web"
      ? ({ WebkitOverflowScrolling: "touch" } as any)
      : null),
  },
  scrollContent: {
    paddingBottom: 100,
  },

  /** Wrapper:
   * Native → full width
   * Web → 60% centered with min/max
   */
  pageContainer: {
    height: "100%",
    paddingHorizontal: 16,
    marginTop: 16,
    ...(Platform.OS === "web"
      ? typeof window !== "undefined" && window.innerWidth > 768
        ? {
            alignSelf: "center",
            width: "60%",
            minWidth: 360,
            maxWidth: 1100,
          }
        : {
            alignSelf: "center",
            width: "85%",
            minWidth: 420,
            maxWidth: 1100,
          }
      : { width: "100%" }),
  },

  heroWrap: {
    width: "100%",
  },
  heroImageNative: {
    width: "100%",
    minHeight: 200,
    maxHeight: 260,
    justifyContent: "flex-start",
  },
  heroImageWeb: {
    width: "100%",
    aspectRatio: 16 / 9,
    maxHeight: 360,
    justifyContent: "flex-start",
    ...(Platform.OS === "web" && { objectFit: "cover" as any }),
  },
  heroImageRadius: {
    borderRadius: 16,
    ...(Platform.OS === "web" && { objectFit: "cover" as any }),
  },
  backBtn: {
    position: "absolute",
    top: 16,
    left: 12,
    backgroundColor: "rgba(13,148,136,0.7)",
    padding: 8,
    borderRadius: 999,
    zIndex: 10,
  },
  levelBadgeTop: {
    position: "absolute",
    top: 16,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    zIndex: 10,
  },

  cardContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 24,
    alignSelf: "center",
    width: "100%",
    marginTop: -16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
  },
  innerPad: {
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 8,
  },

  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0f766e",
    marginBottom: 6,
    ...(Platform.OS === "web" && {
      wordBreak: "break-word" as any,
      overflowWrap: "break-word" as any,
    }),
  },
  levelBadgeText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#0f766e",
    fontWeight: "700",
  },
  descriptionBox: {
    marginTop: 16,
    paddingHorizontal: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: "#000000",
    lineHeight: 18,
    textAlign: "justify",
  },

  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#ffffff",
  },
  tagText: {
    fontWeight: "700",
    fontSize: 13,
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(13,148,136,0.05)",
    borderColor: "rgba(13,148,136,0.15)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
  },
  statCell: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#115e59",
    marginTop: 4,
  },

  quoteBox: {
    marginTop: 20,
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 12,
  },
  quoteText: {
    color: "#0d9488",
    fontStyle: "italic",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    fontWeight: "600",
  },

  exercisesWrap: {
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f766e",
    marginBottom: 12,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(156,163,175,0.4)",
    ...(Platform.OS !== "web" && {
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    }),
    ...(Platform.OS === "web" &&
      ({ boxShadow: "0 2px 6px rgba(0,0,0,0.05)" } as any)),
  },
  exerciseThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
  },
  exerciseThumbWeb: {
    objectFit: "contain" as any,
  },
  exerciseThumbPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
  },
  exerciseTextCol: {
    flex: 1,
    marginLeft: 12,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2937",
    ...(Platform.OS === "web" && {
      wordBreak: "break-word" as any,
      overflowWrap: "break-word" as any,
    }),
  },
  exerciseMuscle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
    marginBottom: 6,
  },
  exerciseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 8,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginRight: 2,
  },
  metaBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
  },

  stickyButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(156,163,175,0.2)",
    ...(Platform.OS !== "web" && {
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: -2 },
      elevation: 8,
    }),
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web" &&
      ({ boxShadow: "0 -2px 8px rgba(0,0,0,0.1)" } as any)),
  },
  startButton: {
    borderRadius: 12,
    overflow: "hidden",
    ...(Platform.OS !== "web" && {
      shadowColor: "#0d9488",
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    }),
    marginHorizontal: 16,
    ...(Platform.OS === "web"
      ? typeof window !== "undefined" && window.innerWidth > 768
        ? {
            width: "60%",
            minWidth: 328,
            maxWidth: 1068,
          }
        : {
            width: "85%",
            minWidth: 388,
            maxWidth: 1068,
          }
      : { alignSelf: "stretch" }),
  },
  startButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 10,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.5,
  },

  // Skeleton loader styles
  skeletonHero: {
    backgroundColor: "#e5e7eb",
    minHeight: 200,
    borderRadius: 16,
  },
  skeletonTitle: {
    width: "70%",
    height: 32,
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    marginBottom: 16,
  },
  skeletonTags: {
    width: "50%",
    height: 28,
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    marginBottom: 18,
  },
  skeletonStats: {
    height: 80,
    backgroundColor: "#e5e7eb",
    borderRadius: 16,
    marginBottom: 16,
  },
  skeletonDescription: {
    height: 60,
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    marginBottom: 22,
  },
  skeletonExerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  skeletonThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#e5e7eb",
  },
  skeletonExerciseText: {
    flex: 1,
    marginLeft: 12,
  },
  skeletonExerciseName: {
    width: "80%",
    height: 17,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonExerciseMeta: {
    width: "60%",
    height: 12,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
  },
});

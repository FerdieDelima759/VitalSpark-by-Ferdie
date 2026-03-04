import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMobileWebRedirect } from "@/hooks/useMobileWebRedirect";
import { useBaseNutritionContext } from "@/contexts/BaseNutritionContext";
import { GeneralMealPlanFull } from "@/types/BaseNutrition";

export default function MealPlanDetailsScreen() {
  const params = useLocalSearchParams();
  const planId = params.id as string;
  const { getGeneralMealPlanFull, loadingState } = useBaseNutritionContext();
  const [mealPlan, setMealPlan] = useState<GeneralMealPlanFull | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useMobileWebRedirect(true);

  useEffect(() => {
    const loadMealPlan = async () => {
      if (!planId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const plan = await getGeneralMealPlanFull(planId);
        setMealPlan(plan);
      } catch (error) {
        console.error("Error loading meal plan:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMealPlan();
  }, [planId, getGeneralMealPlanFull]);

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

  if (isLoading || loadingState.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={styles.loadingText}>Loading meal plan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!mealPlan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Meal plan not found</Text>
          <Text style={styles.errorMessage}>
            The meal plan you're looking for doesn't exist or has been removed.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButtonHeader}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meal Plan Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Plan Header Card */}
        <View style={styles.headerCard}>
          <LinearGradient
            colors={["#0d9488", "#14b8a6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerCardContent}>
              <Text style={styles.planTitle}>{mealPlan.name}</Text>
              {mealPlan.description && (
                <Text style={styles.planDescription}>
                  {mealPlan.description}
                </Text>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Ionicons name="calendar" size={20} color="#0d9488" />
            </View>
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>
                {formatDuration(mealPlan.duration_days)}
              </Text>
            </View>
          </View>

          {mealPlan.estimated_daily_calories && (
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="flame" size={20} color="#f59e0b" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statLabel}>Daily Calories</Text>
                <Text style={styles.statValue}>
                  {formatCalories(mealPlan.estimated_daily_calories)}
                </Text>
              </View>
            </View>
          )}

          {mealPlan.goal && (
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="flag" size={20} color="#8b5cf6" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statLabel}>Goal</Text>
                <Text style={styles.statValue}>{mealPlan.goal}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Days Section */}
        {mealPlan.days && mealPlan.days.length > 0 ? (
          <View style={styles.daysSection}>
            <Text style={styles.sectionTitle}>Meal Plan Days</Text>
            {mealPlan.days.map((day, index) => (
              <View key={day.id} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayNumber}>Day {day.day_number}</Text>
                  {day.label && (
                    <Text style={styles.dayLabel}>{day.label}</Text>
                  )}
                </View>
                {day.notes && <Text style={styles.dayNotes}>{day.notes}</Text>}
                {day.meals && day.meals.length > 0 && (
                  <View style={styles.mealsContainer}>
                    {day.meals.map((dayMeal) => (
                      <View key={dayMeal.id} style={styles.mealItem}>
                        <View style={styles.mealHeader}>
                          <Text style={styles.mealNumber}>
                            Meal {dayMeal.meal_number}
                          </Text>
                          {dayMeal.typical_time_of_the_day && (
                            <Text style={styles.mealTime}>
                              {dayMeal.typical_time_of_the_day}
                            </Text>
                          )}
                        </View>
                        {dayMeal.meal && (
                          <>
                            <Text style={styles.mealName}>
                              {dayMeal.meal.name}
                            </Text>
                            {dayMeal.meal.description && (
                              <Text style={styles.mealDescription}>
                                {dayMeal.meal.description}
                              </Text>
                            )}

                            {/* Meal Items */}
                            {dayMeal.meal.items &&
                              dayMeal.meal.items.length > 0 && (
                                <View style={styles.mealItemsContainer}>
                                  <Text style={styles.mealItemsTitle}>
                                    Contents:
                                  </Text>
                                  {dayMeal.meal.items.map((item) => (
                                    <View
                                      key={item.id}
                                      style={styles.mealItemContent}
                                    >
                                      {item.item_type === "recipe" &&
                                      item.recipe ? (
                                        <View style={styles.recipeItem}>
                                          <View style={styles.recipeHeader}>
                                            <Ionicons
                                              name="book"
                                              size={16}
                                              color="#0d9488"
                                            />
                                            <Text style={styles.recipeName}>
                                              {item.recipe.name}
                                            </Text>
                                            {item.quantity && item.unit && (
                                              <Text style={styles.itemQuantity}>
                                                ({item.quantity} {item.unit})
                                              </Text>
                                            )}
                                          </View>
                                          {item.recipe.description && (
                                            <Text
                                              style={styles.recipeDescription}
                                            >
                                              {item.recipe.description}
                                            </Text>
                                          )}
                                          {item.recipe.ingredients &&
                                            item.recipe.ingredients.length >
                                              0 && (
                                              <View
                                                style={
                                                  styles.ingredientsContainer
                                                }
                                              >
                                                <Text
                                                  style={
                                                    styles.ingredientsTitle
                                                  }
                                                >
                                                  Ingredients:
                                                </Text>
                                                {item.recipe.ingredients.map(
                                                  (ingredient) => (
                                                    <View
                                                      key={ingredient.id}
                                                      style={
                                                        styles.ingredientItem
                                                      }
                                                    >
                                                      <Text
                                                        style={
                                                          styles.ingredientText
                                                        }
                                                      >
                                                        • {ingredient.quantity}{" "}
                                                        {ingredient.unit}{" "}
                                                        {ingredient.food
                                                          ?.name ||
                                                          "Unknown food"}
                                                      </Text>
                                                    </View>
                                                  )
                                                )}
                                              </View>
                                            )}
                                          {item.notes && (
                                            <Text style={styles.itemNotes}>
                                              {item.notes}
                                            </Text>
                                          )}
                                        </View>
                                      ) : item.item_type === "food" &&
                                        item.food ? (
                                        <View style={styles.foodItem}>
                                          <View style={styles.foodHeader}>
                                            <Ionicons
                                              name="nutrition"
                                              size={16}
                                              color="#f59e0b"
                                            />
                                            <Text style={styles.foodName}>
                                              {item.food.name}
                                            </Text>
                                            {item.quantity && item.unit && (
                                              <Text style={styles.itemQuantity}>
                                                ({item.quantity} {item.unit})
                                              </Text>
                                            )}
                                          </View>
                                          {item.food.brand && (
                                            <Text style={styles.foodBrand}>
                                              Brand: {item.food.brand}
                                            </Text>
                                          )}
                                          {item.food.serving_size && (
                                            <Text style={styles.foodServing}>
                                              Serving: {item.food.serving_size}
                                            </Text>
                                          )}
                                          <View style={styles.foodNutrition}>
                                            {item.food.calories !== null && (
                                              <Text
                                                style={styles.nutritionText}
                                              >
                                                Calories: {item.food.calories}
                                              </Text>
                                            )}
                                            {item.food.protein_g !== null && (
                                              <Text
                                                style={styles.nutritionText}
                                              >
                                                Protein: {item.food.protein_g}g
                                              </Text>
                                            )}
                                            {item.food.carbs_g !== null && (
                                              <Text
                                                style={styles.nutritionText}
                                              >
                                                Carbs: {item.food.carbs_g}g
                                              </Text>
                                            )}
                                            {item.food.fat_g !== null && (
                                              <Text
                                                style={styles.nutritionText}
                                              >
                                                Fat: {item.food.fat_g}g
                                              </Text>
                                            )}
                                          </View>
                                          {item.notes && (
                                            <Text style={styles.itemNotes}>
                                              {item.notes}
                                            </Text>
                                          )}
                                        </View>
                                      ) : null}
                                    </View>
                                  ))}
                                </View>
                              )}
                          </>
                        )}
                        {dayMeal.variant_label && (
                          <Text style={styles.variantLabel}>
                            {dayMeal.variant_label}
                          </Text>
                        )}
                        {dayMeal.notes && (
                          <Text style={styles.mealNotes}>{dayMeal.notes}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyDaysContainer}>
            <Ionicons name="calendar-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyDaysText}>No days configured</Text>
            <Text style={styles.emptyDaysSubtext}>
              This meal plan doesn't have any days set up yet.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#0d9488",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  backButtonHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
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
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0d9488",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  headerCard: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
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
    }),
  },
  headerGradient: {
    padding: 24,
  },
  headerCardContent: {
    alignItems: "center",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    lineHeight: 14,
  },
  statsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(13, 148, 136, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  daysSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 16,
  },
  dayCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0d9488",
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  dayNotes: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 16,
  },
  mealsContainer: {
    gap: 12,
  },
  mealItem: {
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  mealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  mealNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  mealTime: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  mealName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0d9488",
    marginBottom: 4,
  },
  mealDescription: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
    marginBottom: 12,
    fontStyle: "italic",
  },
  mealItemsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  mealItemsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mealItemContent: {
    marginBottom: 16,
  },
  recipeItem: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 3,
    borderLeftColor: "#0d9488",
  },
  recipeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  recipeName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },
  recipeDescription: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 16,
    marginBottom: 10,
    fontStyle: "italic",
  },
  ingredientsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  ingredientsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  ingredientItem: {
    marginBottom: 6,
    paddingLeft: 8,
  },
  ingredientText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  foodItem: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
  },
  foodHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  foodName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },
  foodBrand: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  foodServing: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 8,
  },
  foodNutrition: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  nutritionText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  itemQuantity: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0d9488",
  },
  itemNotes: {
    fontSize: 11,
    color: "#94a3b8",
    fontStyle: "italic",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  variantLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8b5cf6",
    marginBottom: 4,
    marginTop: 8,
  },
  mealNotes: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
    marginTop: 8,
    fontStyle: "italic",
  },
  emptyDaysContainer: {
    alignItems: "center",
    padding: 40,
    gap: 12,
  },
  emptyDaysText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptyDaysSubtext: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
});

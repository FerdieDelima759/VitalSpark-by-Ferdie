import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { UserProvider } from "../contexts/UserContext";
import { AuthProvider } from "../contexts/AuthContext";
import { WorkoutProvider } from "../contexts/WorkoutContext";
import { UserWorkoutProvider } from "../contexts/UserWorkoutContext";
import { WorkoutSessionProvider } from "../contexts/WorkoutSessionContext";
import { PlansProvider, usePlansContext } from "../contexts/PlansContext";
import { BaseNutritionProvider } from "../contexts/BaseNutritionContext";
import { useProtectedRoute } from "../hooks/useProtectedRoute";
import { initI18n } from "../i18n";
import { View, ActivityIndicator } from "react-native";
import PlanDialog from "../components/PlanDialog";
import "../global.css";

function RootLayoutNav() {
  useProtectedRoute();
  const { isPlanDialogVisible, hidePlanDialog, planDialogConfig } =
    usePlansContext();

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="index" />
      </Stack>
      <PlanDialog
        visible={isPlanDialogVisible}
        onDismiss={hidePlanDialog}
        showAllPlans={planDialogConfig.showAllPlans}
        highlightTier={planDialogConfig.highlightTier}
        onPlanSelect={planDialogConfig.onPlanSelect}
      />
    </>
  );
}

export default function RootLayout() {
  const [isI18nInitialized, setIsI18nInitialized] = useState(false);

  useEffect(() => {
    initI18n().then(() => {
      setIsI18nInitialized(true);
    });
  }, []);

  if (!isI18nInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <UserProvider>
        <PlansProvider>
          <WorkoutProvider>
            <UserWorkoutProvider>
              <WorkoutSessionProvider>
                <BaseNutritionProvider>
                  <RootLayoutNav />
                </BaseNutritionProvider>
              </WorkoutSessionProvider>
            </UserWorkoutProvider>
          </WorkoutProvider>
        </PlansProvider>
      </UserProvider>
    </AuthProvider>
  );
}

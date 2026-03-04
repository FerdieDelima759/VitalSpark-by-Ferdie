import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../../contexts/AuthContext";

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const hasRedirectedRef = useRef(false);
  const currentRoute = segments[1];



  const specialAuthPages = ["callback", "reset-password", "email-verify"];

  const isSpecialPage = currentRoute && specialAuthPages.includes(currentRoute);

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      hasRedirectedRef.current = false;
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (isSpecialPage) {
      return;
    }

    if (
      !isLoading &&
      isAuthenticated &&
      currentRoute &&
      !hasRedirectedRef.current
    ) {
      hasRedirectedRef.current = true;
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, isSpecialPage, currentRoute]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  if (isAuthenticated && !isSpecialPage) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "none",
        presentation: "card",
        animationDuration: 0,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          animation: "none",
          animationDuration: 0,
        }}
      />
      <Stack.Screen
        name="signup"
        options={{
          animation: "none",
          animationDuration: 0,
        }}
      />
      <Stack.Screen
        name="callback"
        options={{
          animation: "none",
          animationDuration: 0,
        }}
      />
      <Stack.Screen
        name="email-verify"
        options={{
          animation: "none",
          animationDuration: 0,
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          animation: "none",
          animationDuration: 0,
        }}
      />
      <Stack.Screen
        name="reset-password"
        options={{
          animation: "none",
          animationDuration: 0,
        }}
      />
    </Stack>
  );
}

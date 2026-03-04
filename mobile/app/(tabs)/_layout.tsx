import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        tabBarActiveTintColor: "#f59e0b",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarLabelStyle: { fontSize: 12 },
        tabBarStyle: {
          height: 70,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarHideOnKeyboard: true,
        headerBackground: () => (
          <LinearGradient
            colors={["#14b8a6", "#0f766e"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1.5, y: 1 }}
            style={{ flex: 1 }}
          />
        ),
        headerTintColor: "#ffffff",
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="meals"
        options={{
          title: "Meals",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "restaurant" : "restaurant-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="personal"
        options={{
          title: "Personal",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "sparkles" : "sparkles-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="workouts"
        options={{
          title: "Workouts",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "barbell" : "barbell-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="workout-details"
        options={{
          href: null,
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="manage-profile"
        options={{
          href: null,
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="exercise-session"
        options={{
          href: null,
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="user-exercise-session"
        options={{
          href: null,
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="user-workout-details"
        options={{
          href: null,
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="meal-plan-details"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      
      <Tabs.Screen
        name="my-profile"
        options={{
          title: "My Profile",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { clearAuthStorage } from "../../utils/supabase";

export default function EmailVerify() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [countdown, setCountdown] = useState(3);

  const status = params.status as "success" | "error";
  const message = params.message as string;

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      handleRedirect();
    }
  }, [countdown]);

  const handleRedirect = async () => {
    try {
      if (status === "success") {
        await clearAuthStorage();
      }
      router.replace("/(auth)/login");
    } catch (error) {
      router.replace("/(auth)/login");
    }
  };

  const isSuccess = status === "success";

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={["#00b3b3", "#009898", "#006666", "#004c4c", "#002f2f"]}
        locations={[0, 0.2, 0.5, 0.8, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          {isSuccess ? (
            <Ionicons name="checkmark-circle" size={80} color="#ffffff" />
          ) : (
            <Ionicons name="alert-circle" size={80} color="#ff6b6b" />
          )}
        </View>

        <Text
          style={{
            fontSize: 28,
            fontWeight: "800",
            color: "#ffffff",
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          {isSuccess ? "Email Verified!" : "Verification Issue"}
        </Text>

        <Text
          style={{
            fontSize: 16,
            color: "rgba(255, 255, 255, 0.9)",
            textAlign: "center",
            marginBottom: 32,
            lineHeight: 24,
            paddingHorizontal: 20,
          }}
        >
          {isSuccess
            ? message ||
              "Email verified successfully. Try logging in with your credentials"
            : message ||
              "An error occurred during verification.\nPlease try signing in or contact support."}
        </Text>

        <View
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            paddingHorizontal: 24,
            paddingVertical: 16,
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Ionicons name="time-outline" size={24} color="#ffffff" />
          <Text
            style={{
              fontSize: 16,
              color: "#ffffff",
              fontWeight: "600",
              marginLeft: 12,
            }}
          >
            Redirecting in {countdown}s...
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

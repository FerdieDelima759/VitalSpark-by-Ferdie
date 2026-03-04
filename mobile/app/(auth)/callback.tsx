import { useEffect } from "react";
import { View, ActivityIndicator, Text, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../utils/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    const timer = setTimeout(() => {
      handleCallback();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleCallback = async () => {
    try {
      if (Platform.OS === "web") {
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        const isPasswordRecovery = hash.includes("type=recovery");

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          router.replace({
            pathname: "/(auth)/email-verify",
            params: {
              status: "error",
              message: "Verification failed. Please try again.",
            },
          });
          return;
        }

        if (data.session) {
          if (isPasswordRecovery) {
            router.replace("/(auth)/reset-password");
            return;
          }

          router.replace({
            pathname: "/(auth)/email-verify",
            params: {
              status: "success",
              message:
                "Email verified successfully. Try logging in with your credentials",
            },
          });
        } else {
          router.replace({
            pathname: "/(auth)/email-verify",
            params: {
              status: "error",
              message:
                "Verification failed. No session found. Please try signing up again.",
            },
          });
        }
        return;
      }

      const { access_token, refresh_token, type } = params;

      if (type === "recovery") {
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: access_token as string,
            refresh_token: refresh_token as string,
          });

          if (error) {
            router.replace({
              pathname: "/(auth)/email-verify",
              params: {
                status: "error",
                message: "Invalid or expired reset link. Please try again.",
              },
            });
            return;
          }

          router.replace("/(auth)/reset-password");
        } else {
          router.replace({
            pathname: "/(auth)/email-verify",
            params: {
              status: "error",
              message: "Invalid reset link. Please request a new one.",
            },
          });
        }
        return;
      }

      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token: access_token as string,
          refresh_token: refresh_token as string,
        });

        if (error) {
          router.replace({
            pathname: "/(auth)/email-verify",
            params: {
              status: "error",
              message: "Verification failed. Please try again.",
            },
          });
          return;
        }

        if (data.session) {
          router.replace({
            pathname: "/(auth)/email-verify",
            params: {
              status: "success",
              message:
                "Email verified successfully. Try logging in with your credentials",
            },
          });
        } else {
          router.replace({
            pathname: "/(auth)/email-verify",
            params: {
              status: "error",
              message:
                "Verification failed. No session found. Please try signing up again.",
            },
          });
        }
      } else {
        router.replace({
          pathname: "/(auth)/email-verify",
          params: {
            status: "error",
            message: "No verification tokens found. Please try again.",
          },
        });
      }
    } catch (error) {
      router.replace({
        pathname: "/(auth)/email-verify",
        params: {
          status: "error",
          message: "An unexpected error occurred. Please try again.",
        },
      });
    }
  };

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
        }}
      >
        <ActivityIndicator size="large" color="#ffffff" />
        <Text
          style={{
            marginTop: 20,
            color: "#ffffff",
            fontSize: 16,
            fontWeight: "600",
          }}
        >
          Processing verification...
        </Text>
      </LinearGradient>
    </View>
  );
}

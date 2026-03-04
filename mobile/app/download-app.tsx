import { LinearGradient } from "expo-linear-gradient";
import { Image, Platform, Pressable, Text, View, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDesktopWebRedirect } from "../hooks/useMobileWebRedirect";
import Toast, { ToastProps } from "../components/Toast";
import { useRef, useState } from "react";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

const showAlert = (title: string, message: string) =>
  Alert.alert(title, message);

export default function DownloadAppScreen() {

  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);

  const showToast = (
    type: "success" | "error",
    title: string,
    message: string
  ) => {
    if (Platform.OS === "web") {
      const id = toastIdRef.current++;
      setToasts((prev) => [...prev, { id, type, title, message }]);
    } else {
      showAlert(title, message);
    }
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const handleGooglePlayPress = () => {
    showToast(
      "success",
      "Coming Soon",
      "Google Play Store download will be available soon!"
    );
  };

  const handleAppStorePress = () => {
    showToast(
      "success",
      "Coming Soon",
      "App Store download will be available soon!"
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <LinearGradient
        colors={["#00b3b3", "#009898", "#006666"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.3 }}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingVertical: 32,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <Image
              source={require("../assets/images/Logo_VitalSpark_White.png")}
              resizeMode="contain"
              style={{ width: 100, height: 100, marginBottom: 20 }}
              accessibilityIgnoresInvertColors
              accessibilityLabel="VitalSpark logo"
            />
            <View
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 16,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: "600",
                  letterSpacing: 1,
                }}
              >
                MOBILE APP ONLY
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: "white",
              borderRadius: 20,
              padding: 24,
              width: "100%",
              maxWidth: 400,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <View
              style={{
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: "#ecfdf5",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={32}
                  color="#0d9488"
                />
              </View>
            </View>

            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: "#0f172a",
                textAlign: "center",
                marginBottom: 8,
                lineHeight: 28,
              }}
            >
              Get the VitalSpark App
            </Text>

            <Text
              style={{
                fontSize: 14,
                color: "#64748b",
                textAlign: "center",
                marginBottom: 20,
                lineHeight: 20,
              }}
            >
              VitalSpark is designed for mobile. Download now to get started!
            </Text>

            <View style={{ gap: 12 }}>
              <Pressable
                onPress={handleAppStorePress}
                style={({ pressed }) => ({
                  backgroundColor: "#000",
                  borderRadius: 10,
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Image
                  source={require("../assets/images/IOS_Logo.png")}
                  resizeMode="contain"
                  style={{ width: 24, height: 24, marginRight: 16 }}
                  accessibilityIgnoresInvertColors
                />
                <View>
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 10,
                      marginBottom: 1,
                    }}
                  >
                    Download on the
                  </Text>
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    App Store
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={handleGooglePlayPress}
                style={({ pressed }) => ({
                  backgroundColor: "#000",
                  borderRadius: 10,
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Image
                  source={require("../assets/images/Google_Logo.png")}
                  resizeMode="contain"
                  style={{ width: 24, height: 24, marginRight: 16 }}
                  accessibilityIgnoresInvertColors
                />
                <View>
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 10,
                      marginBottom: 1,
                    }}
                  >
                    GET IT ON
                  </Text>
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    Google Play
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          <View style={{ marginTop: 24, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 11,
                color: "rgba(255, 255, 255, 0.8)",
                textAlign: "center",
              }}
            >
              Available for iOS 13.0+ and Android 8.0+
            </Text>
          </View>
        </View>
      </LinearGradient>

      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          onDismiss={() => dismissToast(toast.id)}
          index={index}
        />
      ))}
    </SafeAreaView>
  );
}

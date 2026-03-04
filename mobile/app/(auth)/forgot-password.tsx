import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../hooks/useAuth";
import Toast, { ToastProps } from "../../components/Toast";
import { useDesktopWebRedirect } from "../../hooks/useMobileWebRedirect";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

const showAlert = (title: string, message: string) =>
  Alert.alert(title, message);

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const emailInputRef = useRef<View>(null);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [dimensions, setDimensions] = useState(Dimensions.get("window"));
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);

  useDesktopWebRedirect();

  const isSmallScreen = useMemo(() => {
    if (Platform.OS !== "web") return false;
    return dimensions.width < 1280 || dimensions.height < 800;
  }, [dimensions]);

  const isLargeScreen = useMemo(() => {
    if (Platform.OS !== "web") return false;
    return dimensions.width >= 1440 && dimensions.height >= 1024;
  }, [dimensions]);

  const scale = useMemo(() => {
    if (Platform.OS !== "web") return 1;
    if (isSmallScreen) {
      const widthScale = Math.min(dimensions.width / 1280, 1);
      const heightScale = Math.min(dimensions.height / 800, 1);
      return Math.max(Math.min(widthScale, heightScale), 0.65);
    }
    if (isLargeScreen) {
      const widthScale = dimensions.width / 1280;
      const heightScale = dimensions.height / 800;
      return Math.min(widthScale, heightScale, 1.5);
    }

    return 1;
  }, [isSmallScreen, isLargeScreen, dimensions]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const style = document.createElement("style");
      style.textContent = `
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-background-clip: text;
          -webkit-text-fill-color: #0f172a !important;
          transition: background-color 5000s ease-in-out 0s;
          box-shadow: inset 0 0 20px 20px white !important;
        }
        
        input:focus,
        textarea:focus,
        select:focus {
          outline: none !important;
        }
        
        * {
          -webkit-tap-highlight-color: transparent;
        }
      `;
      document.head.appendChild(style);
      return () => {
        if (document.head.contains(style)) {
          document.head.removeChild(style);
        }
      };
    }
  }, []);

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

  const onSendResetLink = async () => {
    if (!email.trim()) {
      showToast("error", "Missing info", "Please enter your email address.");
      return;
    }

    if (!auth.validateEmail(email)) {
      showToast(
        "error",
        "Invalid Email",
        "Please enter a valid email address."
      );
      return;
    }

    setLoading(true);
    try {
      const response = await auth.sendPasswordResetEmail(email.trim());

      if (response.success) {
        showToast(
          "success",
          "Email Sent",
          "Password reset link has been sent to your email."
        );
        setTimeout(() => {
          router.push("/(auth)/login");
        }, 2000);
      } else {
        showToast("error", "Error", response.message);
      }
    } catch (error: any) {
      showToast(
        "error",
        "Error",
        error?.message || "Failed to send reset email."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.push("/(auth)/login");
  };

  const scrollToInput = (ref: React.RefObject<View | null>) => {
    if (Platform.OS === "web") return;

    setTimeout(() => {
      if (ref.current && scrollViewRef.current) {
        ref.current.measureLayout(
          scrollViewRef.current as any,
          (x, y) => {
            scrollViewRef.current?.scrollTo({
              y: y - 50,
              animated: true,
            });
          },
          () => {}
        );
      }
    }, 100);
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={["#00b3b3", "#009898", "#006666", "#004c4c", "#002f2f"]}
        locations={[0, 0.2, 0.5, 0.8, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView
        edges={["top"]}
        style={{
          width: "100%",
          paddingTop: Platform.OS === "android" ? 40 : 20,
          paddingBottom: 40,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Image
          source={require("../../assets/images/Logo_VitalSpark_White.png")}
          resizeMode="contain"
          style={{ width: 160 * scale, height: 160 * scale }}
          accessibilityIgnoresInvertColors
          accessibilityLabel="VitalSpark logo"
        />
      </SafeAreaView>

      <View
        style={{
          flex: 1,
          width: "100%",
          marginBottom: Platform.OS !== "web" ? -50 : 0,
        }}
      >
        <View
          style={{
            backgroundColor: "white",
            borderTopLeftRadius: 24 * scale,
            borderTopRightRadius: 24 * scale,
            width: "100%",
            flex: 1,
            paddingBottom: Platform.OS !== "web" ? 50 : 0,
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={{
                paddingHorizontal: 20 * scale,
                paddingTop: 32 * scale,
                paddingBottom:
                  Platform.OS === "web"
                    ? 30 * scale
                    : keyboardHeight > 0
                      ? keyboardHeight + 30
                      : 0,
                flexGrow: 1,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
              bounces={false}
            >
              <View
                style={{
                  width: "100%",
                  maxWidth: 600,
                  marginHorizontal: "auto",
                }}
              >
                <Pressable
                  onPress={handleBackToLogin}
                  hitSlop={8}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 24 * scale,
                  }}
                >
                  <Ionicons
                    name="arrow-back"
                    size={24 * scale}
                    color="#0d9488"
                  />
                  <Text
                    style={{
                      fontSize: 16 * scale,
                      color: "#0d9488",
                      marginLeft: 8 * scale,
                      fontWeight: "600",
                    }}
                  >
                    Back to Login
                  </Text>
                </Pressable>

                <Text
                  style={{
                    fontSize: 36 * scale,
                    fontWeight: "800",
                    color: "#f59e0b",
                    textAlign: "center",
                    marginBottom: 8 * scale,
                  }}
                  accessibilityRole="header"
                >
                  Forgot Password?
                </Text>
                <Text
                  style={{
                    fontSize: 14 * scale,
                    color: "#64748b",
                    textAlign: "center",
                    marginTop: 8 * scale,
                    marginBottom: 32 * scale,
                    lineHeight: 20 * scale,
                  }}
                >
                  No worries! Enter your email and we'll send you a link to
                  reset your password.
                </Text>

                <View style={{ marginBottom: 32 * scale }} ref={emailInputRef}>
                  <Text
                    style={{
                      fontSize: 14 * scale,
                      color: "#334155",
                      marginBottom: 8 * scale,
                    }}
                  >
                    Email
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderRadius: 16 * scale,
                      backgroundColor: "white",
                      paddingHorizontal: 16 * scale,
                      borderWidth: 1,
                      borderColor: isEmailFocused ? "#0d9488" : "#e2e8f0",
                    }}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={18 * scale}
                      color={isEmailFocused ? "#0d9488" : "#64748b"}
                    />
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="off"
                      placeholderTextColor="#94a3b8"
                      returnKeyType="done"
                      onSubmitEditing={onSendResetLink}
                      onFocus={() => {
                        setIsEmailFocused(true);
                        scrollToInput(emailInputRef);
                      }}
                      onBlur={() => setIsEmailFocused(false)}
                      style={
                        {
                          flex: 1,
                          paddingLeft: 12 * scale,
                          paddingVertical:
                            Platform.OS === "ios" ? 14 * scale : 12 * scale,
                          fontSize: 16 * scale,
                          color: "#0f172a",
                          backgroundColor: "white",
                          height: 48 * scale,
                          borderWidth: 0,
                          ...(Platform.OS === "web" && {
                            outlineStyle: "none",
                          }),
                        } as any
                      }
                      accessibilityLabel="Email address"
                    />
                  </View>
                </View>

                <Pressable
                  onPress={onSendResetLink}
                  disabled={loading}
                  style={{ width: "100%", marginBottom: 8 * scale }}
                >
                  <LinearGradient
                    colors={["#0d9488", "#0f766e"]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={{
                      width: "100%",
                      height: 52 * scale,
                      borderRadius: 16 * scale,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: loading ? 0.8 : 1,
                    }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size={18 * scale} />
                    ) : (
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: "600",
                          fontSize: 18 * scale,
                        }}
                      >
                        Send Reset Link
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>

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
    </View>
  );
}

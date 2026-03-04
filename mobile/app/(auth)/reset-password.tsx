import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
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
import Animated, { FadeInLeft, FadeOutLeft } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useURL } from "expo-linking";
import { auth } from "../../hooks/useAuth";
import Toast, { ToastProps } from "../../components/Toast";
import { useDesktopWebRedirect } from "../../hooks/useMobileWebRedirect";
import { supabase } from "../../utils/supabase";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

const showAlert = (title: string, message: string) =>
  Alert.alert(title, message);

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const url = useURL();
  const scrollViewRef = useRef<ScrollView>(null);
  const passwordInputRef = useRef<View>(null);
  const confirmPasswordInputRef = useRef<View>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPwdFocused, setIsPwdFocused] = useState(false);
  const [isConfirmPwdFocused, setIsConfirmPwdFocused] = useState(false);
  const [dimensions, setDimensions] = useState(Dimensions.get("window"));
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [passwordRequirements, setPasswordRequirements] = useState({
    minLength: false,
    hasNumber: false,
    hasUpperCase: false,
    hasLowerCase: false,
  });
  const [passwordsMatch, setPasswordsMatch] = useState(false);

  useDesktopWebRedirect();

  useEffect(() => {
    setPasswordRequirements({
      minLength: password.length >= 6,
      hasNumber: /\d/.test(password),
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
    });
  }, [password]);

  useEffect(() => {
    if (confirmPassword.length > 0) {
      setPasswordsMatch(password === confirmPassword && password.length > 0);
    } else {
      setPasswordsMatch(false);
    }
  }, [password, confirmPassword]);

  const parseUrlAndSetSession = async (urlString: string) => {
    try {
      if (
        !urlString.includes("vitalspark://") &&
        !urlString.includes("exp://")
      ) {
        return false;
      }

      let parsedUrl: URL;
      if (urlString.includes("vitalspark://")) {
        parsedUrl = new URL(urlString.replace("vitalspark://", "https://"));
      } else if (urlString.includes("exp://")) {
        parsedUrl = new URL(urlString.replace("exp://", "https://"));
      } else {
        return false;
      }

      const url = parsedUrl;
      let access_token = url.searchParams.get("access_token");
      let refresh_token = url.searchParams.get("refresh_token");

      if (!access_token && url.hash) {
        const hashParams = new URLSearchParams(url.hash.substring(1));
        access_token = hashParams.get("access_token");
        refresh_token = hashParams.get("refresh_token");
      }

      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          return false;
        }

        if (data.session) {
          setHasValidSession(true);
          return true;
        }
      }
    } catch (error) {
      return false;
    }
    return false;
  };

  useEffect(() => {
    const checkAndSetSession = async () => {
      if (params.error || params.error_code) {
        const errorDesc = decodeURIComponent(
          (params.error_description as string) || ""
        );
        showToast(
          "error",
          "Link Expired",
          errorDesc ||
            "This password reset link has expired. Please request a new one."
        );
        setTimeout(() => router.replace("/(auth)/forgot-password"), 2000);
        return;
      }

      if (url && url.includes("error=")) {
        const hashPart = url.split("#")[1] || "";
        const urlParams = new URLSearchParams(hashPart);
        const errorDesc = decodeURIComponent(
          urlParams.get("error_description") || ""
        );

        showToast(
          "error",
          "Link Expired",
          errorDesc ||
            "This password reset link has expired. Please request a new one."
        );
        setTimeout(() => router.replace("/(auth)/forgot-password"), 2000);
        return;
      }

      if (params.access_token && params.refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token: params.access_token as string,
          refresh_token: params.refresh_token as string,
        });

        if (error) {
          showToast(
            "error",
            "Session Error",
            "Failed to establish session. Please try again."
          );
        } else if (data.session) {
          setHasValidSession(true);
        }
        return;
      }

      if (url) {
        parseUrlAndSetSession(url);
      }
    };

    checkAndSetSession();
  }, [url, params]);

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        if (Platform.OS !== "web") {
          return;
        }

        showToast(
          "error",
          "Invalid Link",
          "Please click the password reset link from your email."
        );
        setTimeout(() => {
          router.replace("/(auth)/login");
        }, 2000);
        return;
      }

      setHasValidSession(true);
    };

    const timer = setTimeout(() => {
      checkSession();
    }, 200);

    return () => clearTimeout(timer);
  }, []);

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
        
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear {
          display: none !important;
        }
        
        input[type="password"]::-webkit-credentials-auto-fill-button,
        input[type="password"]::-webkit-textfield-decoration-container {
          display: none !important;
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

  const onResetPassword = async () => {
    if (!password.trim() || !confirmPassword.trim()) {
      showToast("error", "Missing info", "Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      showToast("error", "Password Mismatch", "Passwords do not match.");
      return;
    }

    const passwordValidation = auth.validatePassword(password);
    if (!passwordValidation.isValid) {
      showToast("error", "Invalid Password", passwordValidation.message || "");
      return;
    }

    if (!hasValidSession) {
      showToast(
        "error",
        "Invalid Session",
        "Your session has expired. Please request a new reset link."
      );
      setTimeout(() => {
        router.replace("/(auth)/login");
      }, 2000);
      return;
    }

    setLoading(true);
    try {
      const response = await auth.updatePassword(password);

      if (response.success) {
        showToast(
          "success",
          "Password Reset",
          "Your password has been reset successfully! Please login with your new password."
        );

        await auth.signOut();

        setTimeout(() => {
          router.replace("/(auth)/login");
        }, 2500);
      } else {
        showToast("error", "Reset Failed", response.message);
      }
    } catch (error: any) {
      showToast(
        "error",
        "Error",
        error?.message || "Failed to reset password."
      );
    } finally {
      setLoading(false);
    }
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
                  Reset Password
                </Text>

                {!hasValidSession && Platform.OS !== "web" ? (
                  <Animated.View
                    entering={FadeInLeft.duration(300)}
                    exiting={FadeOutLeft.duration(200)}
                    style={{
                      backgroundColor: "#fef3c7",
                      padding: 18 * scale,
                      borderRadius: 16 * scale,
                      marginTop: 12 * scale,
                      marginBottom: 32 * scale,
                      borderWidth: 1.5,
                      borderColor: "#fcd34d",
                      shadowColor: "#f59e0b",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 8,
                      elevation: 3,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 10 * scale,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: "#fbbf24",
                          borderRadius: 20 * scale,
                          width: 36 * scale,
                          height: 36 * scale,
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12 * scale,
                        }}
                      >
                        <Ionicons
                          name="mail-outline"
                          size={20 * scale}
                          color="#78350f"
                        />
                      </View>
                      <Text
                        style={{
                          fontSize: 17 * scale,
                          fontWeight: "700",
                          color: "#92400e",
                          flex: 1,
                        }}
                      >
                        Action Required
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 14 * scale,
                        color: "#78350f",
                        lineHeight: 22 * scale,
                        marginLeft: 48 * scale,
                      }}
                    >
                      Please open your email and tap the "Reset Password" link
                      to continue.
                    </Text>
                  </Animated.View>
                ) : hasValidSession ? (
                  <Animated.View
                    entering={FadeInLeft.duration(300).delay(100)}
                    exiting={FadeOutLeft.duration(200)}
                  >
                    <Text
                      style={{
                        fontSize: 14 * scale,
                        color: "#64748b",
                        textAlign: "center",
                        marginTop: 8 * scale,
                        marginBottom: 32 * scale,
                      }}
                    >
                      Enter your new password below.
                    </Text>
                  </Animated.View>
                ) : null}

                <View
                  style={{
                    marginBottom: 20 * scale,
                    opacity: hasValidSession ? 1 : 0.5,
                  }}
                  ref={passwordInputRef}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8 * scale,
                    }}
                  >
                    <Text style={{ fontSize: 14 * scale, color: "#334155" }}>
                      New Password
                    </Text>
                    <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                      <Text
                        style={{
                          fontSize: 14 * scale,
                          color: "#0d9488",
                          fontWeight: "500",
                        }}
                      >
                        {showPw ? "Hide" : "Show"}
                      </Text>
                    </Pressable>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderRadius: 16 * scale,
                      backgroundColor: "white",
                      paddingHorizontal: 16 * scale,
                      borderWidth: 1,
                      borderColor: isPwdFocused ? "#0d9488" : "#e2e8f0",
                    }}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={18 * scale}
                      color={isPwdFocused ? "#0d9488" : "#64748b"}
                    />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="•••••••"
                      secureTextEntry={!showPw}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete={
                        Platform.OS === "web" ? "new-password" : "off"
                      }
                      textContentType={
                        Platform.OS === "ios" ? "oneTimeCode" : undefined
                      }
                      placeholderTextColor="#94a3b8"
                      returnKeyType="next"
                      editable={hasValidSession}
                      onFocus={() => {
                        setIsPwdFocused(true);
                        scrollToInput(passwordInputRef);
                      }}
                      onBlur={() => setIsPwdFocused(false)}
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
                      accessibilityLabel="New password"
                    />
                  </View>

                  {password.length > 0 && (
                    <View
                      style={{
                        marginTop: 12 * scale,
                        paddingHorizontal: 4 * scale,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12 * scale,
                          color: "#64748b",
                          marginBottom: 8 * scale,
                          fontWeight: "600",
                        }}
                      >
                        Password must contain:
                      </Text>
                      <View style={{ gap: 6 * scale }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                          }}
                        >
                          <Ionicons
                            name={
                              passwordRequirements.minLength
                                ? "checkmark-circle"
                                : "close-circle"
                            }
                            size={16 * scale}
                            color={
                              passwordRequirements.minLength
                                ? "#10b981"
                                : "#94a3b8"
                            }
                            style={{ marginRight: 6 * scale }}
                          />
                          <Text
                            style={{
                              fontSize: 12 * scale,
                              color: passwordRequirements.minLength
                                ? "#10b981"
                                : "#64748b",
                            }}
                          >
                            At least 6 characters
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                          }}
                        >
                          <Ionicons
                            name={
                              passwordRequirements.hasUpperCase
                                ? "checkmark-circle"
                                : "close-circle"
                            }
                            size={16 * scale}
                            color={
                              passwordRequirements.hasUpperCase
                                ? "#10b981"
                                : "#94a3b8"
                            }
                            style={{ marginRight: 6 * scale }}
                          />
                          <Text
                            style={{
                              fontSize: 12 * scale,
                              color: passwordRequirements.hasUpperCase
                                ? "#10b981"
                                : "#64748b",
                            }}
                          >
                            One uppercase letter
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                          }}
                        >
                          <Ionicons
                            name={
                              passwordRequirements.hasLowerCase
                                ? "checkmark-circle"
                                : "close-circle"
                            }
                            size={16 * scale}
                            color={
                              passwordRequirements.hasLowerCase
                                ? "#10b981"
                                : "#94a3b8"
                            }
                            style={{ marginRight: 6 * scale }}
                          />
                          <Text
                            style={{
                              fontSize: 12 * scale,
                              color: passwordRequirements.hasLowerCase
                                ? "#10b981"
                                : "#64748b",
                            }}
                          >
                            One lowercase letter
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                          }}
                        >
                          <Ionicons
                            name={
                              passwordRequirements.hasNumber
                                ? "checkmark-circle"
                                : "close-circle"
                            }
                            size={16 * scale}
                            color={
                              passwordRequirements.hasNumber
                                ? "#10b981"
                                : "#94a3b8"
                            }
                            style={{ marginRight: 6 * scale }}
                          />
                          <Text
                            style={{
                              fontSize: 12 * scale,
                              color: passwordRequirements.hasNumber
                                ? "#10b981"
                                : "#64748b",
                            }}
                          >
                            One number
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>

                <View
                  style={{
                    marginBottom: 20 * scale,
                    opacity: hasValidSession ? 1 : 0.5,
                  }}
                  ref={confirmPasswordInputRef}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8 * scale,
                    }}
                  >
                    <Text style={{ fontSize: 14 * scale, color: "#334155" }}>
                      Confirm Password
                    </Text>
                    <Pressable
                      onPress={() => setShowConfirmPw((v) => !v)}
                      hitSlop={8}
                    >
                      <Text
                        style={{
                          fontSize: 14 * scale,
                          color: "#0d9488",
                          fontWeight: "500",
                        }}
                      >
                        {showConfirmPw ? "Hide" : "Show"}
                      </Text>
                    </Pressable>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderRadius: 16 * scale,
                      backgroundColor: "white",
                      paddingHorizontal: 16 * scale,
                      borderWidth: 1,
                      borderColor: isConfirmPwdFocused ? "#0d9488" : "#e2e8f0",
                    }}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={18 * scale}
                      color={isConfirmPwdFocused ? "#0d9488" : "#64748b"}
                    />
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="•••••••"
                      secureTextEntry={!showConfirmPw}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete={
                        Platform.OS === "web" ? "new-password" : "off"
                      }
                      textContentType={
                        Platform.OS === "ios" ? "oneTimeCode" : undefined
                      }
                      placeholderTextColor="#94a3b8"
                      returnKeyType="done"
                      editable={hasValidSession}
                      onSubmitEditing={onResetPassword}
                      onFocus={() => {
                        setIsConfirmPwdFocused(true);
                        scrollToInput(confirmPasswordInputRef);
                      }}
                      onBlur={() => setIsConfirmPwdFocused(false)}
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
                      accessibilityLabel="Confirm password"
                    />
                  </View>

                  {confirmPassword.length > 0 && (
                    <View
                      style={{
                        marginTop: 12 * scale,
                        paddingHorizontal: 4 * scale,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <Ionicons
                        name={
                          passwordsMatch ? "checkmark-circle" : "close-circle"
                        }
                        size={16 * scale}
                        color={passwordsMatch ? "#10b981" : "#ef4444"}
                        style={{ marginRight: 6 * scale }}
                      />
                      <Text
                        style={{
                          fontSize: 12 * scale,
                          color: passwordsMatch ? "#10b981" : "#ef4444",
                          fontWeight: "500",
                        }}
                      >
                        {passwordsMatch
                          ? "Passwords match"
                          : "Passwords do not match"}
                      </Text>
                    </View>
                  )}

                  <View style={{ marginBottom: 8 * scale }} />
                </View>

                <Pressable
                  onPress={onResetPassword}
                  disabled={loading || !hasValidSession}
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
                      opacity: loading || !hasValidSession ? 0.8 : 1,
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
                        Reset Password
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>

                <View
                  style={{
                    alignItems: "center",
                    marginTop: 16 * scale,
                  }}
                >
                  <Pressable
                    onPress={() => router.push("/(auth)/login")}
                    hitSlop={8}
                  >
                    <Text
                      style={{
                        fontSize: 14 * scale,
                        color: "#0d9488",
                        fontWeight: "600",
                      }}
                    >
                      Back to Login
                    </Text>
                  </Pressable>
                </View>
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

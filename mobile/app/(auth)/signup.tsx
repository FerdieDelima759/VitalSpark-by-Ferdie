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
import Dialog from "../../components/Dialog";
import { useDesktopWebRedirect } from "../../hooks/useMobileWebRedirect";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

const showAlert = (title: string, message: string) =>
  Alert.alert(title, message);

export default function SignUpScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const emailInputRef = useRef<View>(null);
  const passwordInputRef = useRef<View>(null);
  const confirmPasswordInputRef = useRef<View>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPwdFocused, setIsPwdFocused] = useState(false);
  const [isConfirmPwdFocused, setIsConfirmPwdFocused] = useState(false);
  const [dimensions, setDimensions] = useState(Dimensions.get("window"));
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
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

  const onSignUp = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      showToast("error", "Missing info", "Please fill in all fields.");
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

    if (password !== confirmPassword) {
      showToast("error", "Password Mismatch", "Passwords do not match.");
      return;
    }

    const passwordValidation = auth.validatePassword(password);
    if (!passwordValidation.isValid) {
      showToast("error", "Invalid Password", passwordValidation.message || "");
      return;
    }

    setLoading(true);
    try {
      const response = await auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (response.success) {
        if (Platform.OS === "web") {
          setShowEmailDialog(true);
        } else {
          showAlert(
            "Success! Check Your Email",
            "We've sent a verification link to your email address. Please check your inbox and verify your email to complete the registration."
          );
          setTimeout(() => {
            router.push("/(auth)/login");
          }, 2000);
        }
      } else {
        showToast("error", "Sign Up Failed", response.message);
      }
    } catch (error: any) {
      showToast(
        "error",
        "Error",
        error?.message || "Unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = () => {
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
                      ? keyboardHeight / 2
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
                  Sign Up
                </Text>
                <Text
                  style={{
                    fontSize: 14 * scale,
                    color: "#64748b",
                    textAlign: "center",
                    marginTop: 8 * scale,
                    marginBottom: 32 * scale,
                  }}
                >
                  Create your account to get started.
                </Text>

                <View style={{ marginBottom: 20 * scale }} ref={emailInputRef}>
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
                      returnKeyType="next"
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

                <View
                  style={{ marginBottom: 20 * scale }}
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
                      Create Password
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
                      accessibilityLabel="Create password"
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
                  style={{ marginBottom: 20 * scale }}
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
                      onSubmitEditing={onSignUp}
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
                  onPress={onSignUp}
                  disabled={loading}
                  style={{ width: "100%", marginBottom: 8 * scale }}
                >
                  <LinearGradient
                    colors={["#FFB300", "#FF8A00"]}
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
                        Sign Up
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>

                <View
                  style={{
                    alignItems: "center",
                    marginBottom: 32 * scale,
                  }}
                >
                  <Text style={{ fontSize: 14 * scale, color: "#64748b" }}>
                    Already have an account?{" "}
                    <Text
                      style={{
                        fontSize: 14 * scale,
                        color: "#0d9488",
                        fontWeight: "600",
                      }}
                      onPress={handleSignIn}
                    >
                      Sign In
                    </Text>
                  </Text>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>

      {Platform.OS === "web" && (
        <Dialog
          visible={showEmailDialog}
          onDismiss={() => {
            setShowEmailDialog(false);
            router.push("/(auth)/login");
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <Ionicons name="mail-outline" size={48} color="#0d9488" />
          </View>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#0f172a",
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            Check Your Email
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
            We've sent a verification link to{" "}
            <Text style={{ fontWeight: "600", color: "#0d9488" }}>{email}</Text>
            . Please check your inbox and verify your email to complete the
            registration.
          </Text>
          <Pressable
            onPress={() => {
              setShowEmailDialog(false);
              router.push("/(auth)/login");
            }}
            style={{ width: "100%" }}
          >
            <LinearGradient
              colors={["#0d9488", "#0f766e"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{
                width: "100%",
                height: 44,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "600",
                  fontSize: 14,
                }}
              >
                Got It
              </Text>
            </LinearGradient>
          </Pressable>
        </Dialog>
      )}

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

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useMobileWebRedirect } from "@/hooks/useMobileWebRedirect";

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [dimensions, setDimensions] = useState({
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  });
  const screenWidth = dimensions.width;
  const screenHeight = dimensions.height;
  const isWeb = Platform.OS === "web";

  useMobileWebRedirect(true);

  const getScaleFactor = () => {
    if (!isWeb) return 1;
    if (screenWidth >= 1280) return 1;
    if (screenWidth >= 1024) return 0.9;
    if (screenWidth >= 768) return 0.8;
    return 0.7;
  };
  const scaleFactor = getScaleFactor();

  const viewportHeight =
    isWeb && typeof window !== "undefined" ? window.innerHeight : screenHeight;

  const isSmallViewport = viewportHeight < 700 || screenWidth < 400;

  const [currentStreak] = useState<number>(7);

  const [height, setHeight] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [bmiResult, setBmiResult] = useState<number | null>(null);
  const [bmiCategory, setBmiCategory] = useState<string>("");
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isMetric, setIsMetric] = useState<boolean>(true);
  const [bmiModalOpen, setBmiModalOpen] = useState<boolean>(false);
  const [heightFocused, setHeightFocused] = useState<boolean>(false);
  const [weightFocused, setWeightFocused] = useState<boolean>(false);

  const keyboardVerticalOffset = useMemo(
    () => Math.max(insets.top, 16),
    [insets.top]
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  const calculateBMI = (): void => {
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);

    if (
      isNaN(heightNum) ||
      isNaN(weightNum) ||
      heightNum <= 0 ||
      weightNum <= 0
    ) {
      return;
    }

    setIsCalculating(true);

    setTimeout(() => {
      let heightInMeters: number;
      let weightInKg: number;

      if (isMetric) {
        heightInMeters = heightNum / 100;
        weightInKg = weightNum;
      } else {
        heightInMeters = heightNum * 0.0254;
        weightInKg = weightNum * 0.453592;
      }

      const bmi = weightInKg / (heightInMeters * heightInMeters);
      const rounded = parseFloat(bmi.toFixed(1));
      setBmiResult(rounded);

      if (rounded < 18.5) setBmiCategory("Underweight");
      else if (rounded < 25) setBmiCategory("Normal weight");
      else if (rounded < 30) setBmiCategory("Overweight");
      else setBmiCategory("Obese");

      setIsCalculating(false);
      setBmiModalOpen(true);
    }, 300);
  };

  const getBMICategoryColor = () => {
    if (!bmiCategory) return "#6b7280";
    if (bmiCategory === "Underweight") return "#f59e0b";
    if (bmiCategory === "Normal weight") return "#10b981";
    if (bmiCategory === "Overweight") return "#f59e0b";
    return "#ef4444";
  };

  const getBMICategoryBackground = () => {
    if (!bmiCategory) return "#f3f4f6";
    if (bmiCategory === "Underweight") return "#fef3c7";
    if (bmiCategory === "Normal weight") return "#d1fae5";
    if (bmiCategory === "Overweight") return "#fef3c7";
    return "#fee2e2";
  };

  const getBMIHealthTip = () => {
    if (!bmiCategory) return "";
    if (bmiCategory === "Underweight")
      return "Consider consulting a nutritionist to reach a healthy weight.";
    if (bmiCategory === "Normal weight")
      return "Great! Maintain your healthy lifestyle.";
    if (bmiCategory === "Overweight")
      return "Consider a balanced diet and regular exercise.";
    return "Please consult a healthcare professional for guidance.";
  };

  const convertToMetric = (): void => {
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);
    if (!isNaN(heightNum) && heightNum > 0) {
      const heightInCm = heightNum * 2.54;
      setHeight(heightInCm.toFixed(1));
    }
    if (!isNaN(weightNum) && weightNum > 0) {
      const weightInKg = weightNum * 0.453592;
      setWeight(weightInKg.toFixed(1));
    }
    setIsMetric(true);
    setBmiResult(null);
    setBmiCategory("");
  };

  const convertToImperial = (): void => {
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);
    if (!isNaN(heightNum) && heightNum > 0) {
      const heightInInches = heightNum * 0.393701;
      setHeight(heightInInches.toFixed(1));
    }
    if (!isNaN(weightNum) && weightNum > 0) {
      const weightInLbs = weightNum * 2.20462;
      setWeight(weightInLbs.toFixed(1));
    }
    setIsMetric(false);
    setBmiResult(null);
    setBmiCategory("");
  };

  const canCalculate = (): boolean => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    return !isNaN(h) && !isNaN(w) && h > 0 && w > 0 && !isCalculating;
  };

  const handleCloseBmiModal = (): void => {
    setBmiModalOpen(false);
    setHeight("");
    setWeight("");
    setBmiResult(null);
    setBmiCategory("");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#f8fafc",
            alignItems: isWeb ? "center" : "stretch",
            justifyContent: "flex-start",
          }}
        >
          <View
            style={[
              {
                flex: 1,
                backgroundColor: "#f8fafc",
                width: isWeb ? "85%" : "100%",
                maxWidth: 1024,
                alignSelf: "center",
              },
              isWeb && scaleFactor < 1
                ? { transform: [{ scale: scaleFactor }] }
                : null,
            ]}
          >
            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: isSmallViewport ? 16 : 20,
                paddingTop: isSmallViewport ? 16 : 24,
                paddingBottom: 96,
              }}
            >
              <View
                style={{
                  marginBottom: isSmallViewport ? 24 : 32,
                  marginTop: isSmallViewport ? 12 : 24,
                }}
              >
                <View style={{ marginBottom: 8 }}>
                  <Text
                    style={{
                      fontSize: isSmallViewport ? 28 : 32,
                      color: "#0f766e",
                      marginBottom: 4,
                      fontWeight: "900",
                    }}
                  >
                    Dashboard
                  </Text>
                  <Text
                    style={{
                      fontSize: isSmallViewport ? 14 : 16,
                      color: "#737373",
                    }}
                  >
                    Track your progress and stay healthy
                  </Text>
                  {user?.email && (
                    <Text
                      style={{
                        fontSize: isSmallViewport ? 12 : 13,
                        color: "#0f766e",
                        marginTop: 6,
                        fontWeight: "600",
                      }}
                    >
                      {user.email}
                    </Text>
                  )}
                </View>
                <View
                  style={{
                    height: 3,
                    backgroundColor: "#f59e0b",
                    borderRadius: 2,
                    width: 60,
                    marginTop: 4,
                  }}
                />
              </View>

              <View style={{ marginBottom: isSmallViewport ? 20 : 24 }}>
                <LinearGradient
                  colors={["#fbbf24", "#f59e0b", "#f97316"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={{
                    borderRadius: 16,
                    padding: isSmallViewport ? 14 : 16,
                    ...(Platform.OS !== "web" && {
                      shadowColor: "#f59e0b",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 8,
                      elevation: 4,
                    }),
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View
                        style={{
                          backgroundColor: "rgba(255,255,255,0.25)",
                          borderRadius: 6,
                          padding: 4,
                          marginRight: 6,
                        }}
                      >
                        <Ionicons name="flame" size={14} color="#fff" />
                      </View>
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: isSmallViewport ? 11 : 12,
                          fontWeight: "800",
                          letterSpacing: 1,
                        }}
                      >
                        Current Streak
                      </Text>
                    </View>

                    <View
                      style={{ flexDirection: "row", alignItems: "flex-end" }}
                    >
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 28 : 32,
                          fontWeight: "900",
                          color: "#fff",
                          lineHeight: isSmallViewport ? 28 : 32,
                        }}
                      >
                        {currentStreak}
                      </Text>
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: isSmallViewport ? 12 : 14,
                          fontWeight: "600",
                          marginLeft: 4,
                        }}
                      >
                        days
                      </Text>
                      <Text
                        style={{
                          color: "#ffedd5",
                          fontSize: isSmallViewport ? 12 : 14,
                          marginLeft: 4,
                        }}
                      >
                        🔥
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: isSmallViewport ? 13 : 14,
                        fontWeight: "600",
                      }}
                    >
                      Weekly Goal: 5 sessions
                    </Text>
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: isSmallViewport ? 13 : 14,
                        fontWeight: "700",
                      }}
                    >
                      3 / 5 done
                    </Text>
                  </View>

                  <View
                    style={{
                      height: 6,
                      backgroundColor: "rgba(255,255,255,0.3)",
                      borderRadius: 3,
                      marginBottom: 12,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        width: "60%",
                        backgroundColor: "#fff",
                        borderRadius: 3,
                      }}
                    />
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.95)",
                        borderRadius: 12,
                        paddingVertical: isSmallViewport ? 8 : 10,
                        paddingHorizontal: isSmallViewport ? 12 : 16,
                        ...(Platform.OS !== "web" && {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.2,
                          shadowRadius: 6,
                          elevation: 4,
                        }),
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.8)",
                      }}
                    >
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Ionicons
                          name="arrow-forward-circle"
                          size={16}
                          color="#f59e0b"
                        />
                        <Text
                          style={{
                            fontWeight: "800",
                            fontSize: isSmallViewport ? 13 : 14,
                            marginLeft: 8,
                            color: "#f59e0b",
                          }}
                        >
                          Keep it going
                        </Text>
                      </View>
                    </Pressable>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: isSmallViewport ? 11 : 12,
                          opacity: 0.9,
                          lineHeight: 16,
                        }}
                      >
                        Next session boosts your streak to {currentStreak + 1}{" "}
                        days.
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>

              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 20,
                  padding: isSmallViewport ? 18 : 24,
                  ...(Platform.OS !== "web" && {
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    elevation: 3,
                  }),
                  marginBottom: isSmallViewport ? 20 : 24,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: isSmallViewport ? 18 : 24,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: "#ccfbf1",
                      borderRadius: 12,
                      padding: 10,
                    }}
                  >
                    <Ionicons
                      name="fitness"
                      size={isSmallViewport ? 22 : 26}
                      color="#0f766e"
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: isSmallViewport ? 18 : 22,
                      fontWeight: "800",
                      color: "#171717",
                      marginLeft: 12,
                    }}
                  >
                    BMI Calculator
                  </Text>
                </View>

                <View style={{ marginBottom: isSmallViewport ? 18 : 24 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: isSmallViewport ? 18 : 24,
                    }}
                  >
                    <Pressable
                      onPress={convertToMetric}
                      style={{
                        backgroundColor: isMetric ? "#0f766e" : "#f3f4f6",
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderTopLeftRadius: 10,
                        borderBottomLeftRadius: 10,
                        borderWidth: 1,
                        borderColor: isMetric ? "#0f766e" : "#e5e7eb",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 13 : 14,
                          fontWeight: "700",
                          color: isMetric ? "#fff" : "#6b7280",
                        }}
                      >
                        Metric
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={convertToImperial}
                      style={{
                        backgroundColor: !isMetric ? "#0f766e" : "#f3f4f6",
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderTopRightRadius: 10,
                        borderBottomRightRadius: 10,
                        borderWidth: 1,
                        borderColor: !isMetric ? "#0f766e" : "#e5e7eb",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 13 : 14,
                          fontWeight: "700",
                          color: !isMetric ? "#fff" : "#6b7280",
                        }}
                      >
                        Imperial
                      </Text>
                    </Pressable>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      gap: isSmallViewport ? 12 : 16,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <Ionicons name="resize" size={18} color="#6b7280" />
                        <Text
                          style={{
                            color: "#404040",
                            fontWeight: "700",
                            marginLeft: 8,
                            fontSize: isSmallViewport ? 12 : 13,
                          }}
                        >
                          Height
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: "#f9fafb",
                          borderRadius: 14,
                          borderWidth: 2,
                          borderColor: height ? "#0f766e" : "#e5e7eb",
                          paddingHorizontal: 16,
                        }}
                      >
                        <TextInput
                          accessibilityLabel="Height input"
                          style={{
                            flex: 1,
                            paddingVertical: 14,
                            color: "#171717",
                            fontSize: 12,
                            fontWeight: "600",
                            ...(Platform.OS === "web" && {
                              outlineStyle: "none" as any,
                            }),
                          }}
                          placeholder={
                            heightFocused
                              ? ""
                              : isMetric
                                ? "Enter height"
                                : "Enter height"
                          }
                          placeholderTextColor="#9ca3af"
                          keyboardType="numeric"
                          value={height}
                          onChangeText={setHeight}
                          onFocus={() => setHeightFocused(true)}
                          onBlur={() => setHeightFocused(false)}
                        />
                        <Text
                          style={{
                            color: "#737373",
                            fontWeight: "600",
                            marginLeft: 8,
                            fontSize: isSmallViewport ? 12 : 13,
                          }}
                        >
                          {isMetric ? "cm" : "in"}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <Ionicons name="barbell" size={18} color="#6b7280" />
                        <Text
                          style={{
                            color: "#404040",
                            fontWeight: "700",
                            marginLeft: 8,
                            fontSize: isSmallViewport ? 12 : 13,
                          }}
                        >
                          Weight
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: "#f9fafb",
                          borderRadius: 14,
                          borderWidth: 2,
                          borderColor: weight ? "#0f766e" : "#e5e7eb",
                          paddingHorizontal: 16,
                        }}
                      >
                        <TextInput
                          accessibilityLabel="Weight input"
                          style={{
                            flex: 1,
                            paddingVertical: 14,
                            color: "#171717",
                            fontSize: 12,
                            fontWeight: "600",
                            ...(Platform.OS === "web" && {
                              outlineStyle: "none" as any,
                            }),
                          }}
                          placeholder={
                            weightFocused
                              ? ""
                              : isMetric
                                ? "Enter weight"
                                : "Enter weight"
                          }
                          placeholderTextColor="#9ca3af"
                          keyboardType="numeric"
                          value={weight}
                          onChangeText={setWeight}
                          onFocus={() => setWeightFocused(true)}
                          onBlur={() => setWeightFocused(false)}
                        />
                        <Text
                          style={{
                            color: "#737373",
                            fontWeight: "600",
                            marginLeft: 8,
                            fontSize: isSmallViewport ? 12 : 13,
                          }}
                        >
                          {isMetric ? "kg" : "lbs"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Pressable
                    onPress={calculateBMI}
                    disabled={!canCalculate()}
                    style={[
                      {
                        borderRadius: 16,
                        paddingVertical: isSmallViewport ? 16 : 18,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        ...(Platform.OS !== "web" && {
                          shadowColor: "#0f766e",
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: canCalculate() ? 0.3 : 0,
                          shadowRadius: 8,
                          elevation: canCalculate() ? 4 : 0,
                        }),
                        backgroundColor: canCalculate() ? "#0f766e" : "#cbd5e1",
                      },
                    ]}
                  >
                    <Ionicons
                      name={isCalculating ? "hourglass" : "calculator"}
                      size={22}
                      color="#ffffff"
                    />
                    <Text
                      style={{
                        color: "#ffffff",
                        fontWeight: "800",
                        fontSize: isSmallViewport ? 14 : 16,
                        marginLeft: 8,
                      }}
                    >
                      {isCalculating ? "Calculating..." : "Calculate BMI"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={bmiModalOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCloseBmiModal}
      >
        <Pressable
          onPress={handleCloseBmiModal}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        />

        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 20,
              width: "100%",
              maxWidth: 400,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              ...(Platform.OS !== "web" && {
                shadowColor: "#000",
                shadowOpacity: 0.3,
                shadowRadius: 15,
                shadowOffset: { width: 0, height: 8 },
                elevation: 15,
              }),
            }}
          >
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 20,
                paddingBottom: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#e5e7eb",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                  backgroundColor: getBMICategoryBackground(),
                }}
              >
                <Ionicons
                  name="fitness"
                  size={20}
                  color={getBMICategoryColor()}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: isSmallViewport ? 16 : 18,
                    fontWeight: "800",
                    color: "#111827",
                  }}
                >
                  Your BMI Result
                </Text>
                <Text
                  style={{
                    fontSize: isSmallViewport ? 13 : 14,
                    color: "#6b7280",
                    marginTop: 2,
                  }}
                >
                  Body Mass Index
                </Text>
              </View>
            </View>

            <ScrollView style={{ maxHeight: viewportHeight * 0.6 }}>
              <View style={{ padding: 20 }}>
                <View
                  style={{
                    backgroundColor: "#f8fafc",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: isSmallViewport ? 40 : 48,
                      fontWeight: "900",
                      color: getBMICategoryColor(),
                      marginBottom: 4,
                    }}
                  >
                    {bmiResult}
                  </Text>
                  <Text
                    style={{
                      fontSize: isSmallViewport ? 13 : 14,
                      color: "#6b7280",
                      fontWeight: "600",
                    }}
                  >
                    BMI Score
                  </Text>
                </View>

                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: "#f8fafc",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      fontSize: isSmallViewport ? 13 : 14,
                      color: "#6b7280",
                      marginBottom: 8,
                    }}
                  >
                    Classification
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: getBMICategoryBackground(),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: isSmallViewport ? 13 : 14,
                        fontWeight: "800",
                        color: getBMICategoryColor(),
                        letterSpacing: 0.5,
                      }}
                    >
                      {bmiCategory}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    backgroundColor: "#f8fafc",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <Ionicons
                      name={
                        bmiCategory === "Normal weight"
                          ? "checkmark-circle"
                          : "information-circle"
                      }
                      size={20}
                      color={getBMICategoryColor()}
                    />
                    <Text
                      style={{
                        fontSize: isSmallViewport ? 13 : 14,
                        fontWeight: "700",
                        color: "#111827",
                        marginLeft: 8,
                      }}
                    >
                      Health Recommendation
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: isSmallViewport ? 12 : 13,
                      color: "#6b7280",
                      lineHeight: 20,
                    }}
                  >
                    {getBMIHealthTip()}
                  </Text>
                </View>

                <View>
                  <Text
                    style={{
                      fontSize: isSmallViewport ? 13 : 14,
                      fontWeight: "800",
                      color: "#111827",
                      marginBottom: 12,
                    }}
                  >
                    BMI Ranges
                  </Text>
                  <View style={{ rowGap: 8 }}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          marginRight: 12,
                          backgroundColor: "#f59e0b",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 12 : 13,
                          color: "#6b7280",
                          flex: 1,
                        }}
                      >
                        Underweight
                      </Text>
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 12 : 13,
                          color: "#6b7280",
                          fontWeight: "600",
                        }}
                      >
                        &lt; 18.5
                      </Text>
                    </View>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          marginRight: 12,
                          backgroundColor: "#10b981",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 12 : 13,
                          color: "#6b7280",
                          flex: 1,
                        }}
                      >
                        Normal weight
                      </Text>
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 12 : 13,
                          color: "#6b7280",
                          fontWeight: "600",
                        }}
                      >
                        18.5 - 24.9
                      </Text>
                    </View>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          marginRight: 12,
                          backgroundColor: "#f59e0b",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 12 : 13,
                          color: "#6b7280",
                          flex: 1,
                        }}
                      >
                        Overweight
                      </Text>
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 12 : 13,
                          color: "#6b7280",
                          fontWeight: "600",
                        }}
                      >
                        25.0 - 29.9
                      </Text>
                    </View>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          marginRight: 12,
                          backgroundColor: "#ef4444",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 12 : 13,
                          color: "#6b7280",
                          flex: 1,
                        }}
                      >
                        Obese
                      </Text>
                      <Text
                        style={{
                          fontSize: isSmallViewport ? 12 : 13,
                          color: "#6b7280",
                          fontWeight: "600",
                        }}
                      >
                        ≥ 30.0
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View
              style={{
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderTopWidth: 1,
                borderTopColor: "#e5e7eb",
                flexDirection: "row",
                justifyContent: "flex-end",
              }}
            >
              <TouchableOpacity
                onPress={handleCloseBmiModal}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: "#3b82f6",
                }}
              >
                <Text
                  style={{
                    fontSize: isSmallViewport ? 14 : 16,
                    fontWeight: "700",
                    color: "#fff",
                  }}
                >
                  Got it
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

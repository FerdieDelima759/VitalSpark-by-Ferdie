import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "@/node_modules/react-i18next";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOnboardingHeader } from "../../contexts/OnboardingHeaderContext";
import { useDesktopWebRedirect } from "@/hooks/useMobileWebRedirect";
import { useUserData } from "../../hooks/useUserData";
import { useUserContext } from "../../contexts/UserContext";
import { auth } from "../../hooks/useAuth";

type Unit = "kg" | "lb";

const RULER_ITEM_WIDTH = 10;

interface RulerMarkProps {
  mark: number;
  unit: Unit;
  majorInterval: number;
  mediumInterval: number;
}

const RulerMark = React.memo(
  ({ mark, unit, majorInterval, mediumInterval }: RulerMarkProps) => {
    const isMajor = mark % majorInterval === 0;
    const isMedium = !isMajor && mark % mediumInterval === 0;

    return (
      <View
        style={{
          width: RULER_ITEM_WIDTH,
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 1,
            height: isMajor ? 30 : isMedium ? 20 : 10,
            backgroundColor: isMajor ? "#f59e0b" : "#9ca3af",
          }}
        />
        {isMajor && mark > 0 && (
          <Text
            style={{
              position: "absolute",
              top: 35,
              color: "#e5e7eb",
              fontSize: 12,
            }}
          >
            {mark}
          </Text>
        )}
      </View>
    );
  }
);

export default function WeightOnboarding() {
  const { t } = useTranslation("common");
  const { setHeader } = useOnboardingHeader();
  const [unit, setUnit] = useState<Unit>("kg");
  const [weight, setWeight] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [dimensions, setDimensions] = useState({
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  });
  const { upsertUserProfile } = useUserData();
  const { userProfile } = useUserContext();
  const weightRef = useRef(weight);
  const unitRef = useRef(unit);

  useEffect(() => {
    weightRef.current = weight;
  }, [weight]);

  useEffect(() => {
    unitRef.current = unit;
  }, [unit]);

  useDesktopWebRedirect();

  const screenWidth = dimensions.width;
  const screenHeight = dimensions.height;
  const isWeb = Platform.OS === "web";

  const RULER_CENTER_OFFSET = screenWidth / 2;
  const [centerOffset, setCenterOffset] = useState<number>(RULER_CENTER_OFFSET);

  const getScaleFactor = () => {
    if (!isWeb) return 1;
    if (screenWidth >= 1280) return 1;
    if (screenWidth >= 1024) return 0.85;
    if (screenWidth >= 768) return 0.75;
    return 0.65;
  };
  const scaleFactor = getScaleFactor();

  const viewportHeight =
    isWeb && typeof window !== "undefined" ? window.innerHeight : screenHeight;

  const isSmallViewport = viewportHeight < 700;
  const topMargin = isSmallViewport
    ? isWeb && screenWidth < 1280
      ? 8
      : 16
    : 0;
  const titleSize = isSmallViewport ? 22 : 26;
  const subtitleSize = isSmallViewport ? 14 : 16;

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  const KG_MAX = 300;
  const LB_MAX = 660;

  const getOffsetForWeight = (weightKg: number, ofUnit: Unit) => {
    if (ofUnit === "kg") return Math.max(0, weightKg) * RULER_ITEM_WIDTH;
    const pounds = Math.max(0, weightKg) * 2.20462;
    return pounds * RULER_ITEM_WIDTH;
  };

  useEffect(() => {
    if (userProfile && userProfile.weight) {
      const loadedWeight = userProfile.weight;
      const loadedUnit = (userProfile.weight_unit as Unit) || "kg";

      setWeight(loadedWeight);
      setUnit(loadedUnit);

      if (isWeb) {
        if (loadedUnit === "kg") {
          setInputValue(Math.round(loadedWeight).toString());
        } else {
          const pounds = loadedWeight * 2.20462;
          setInputValue(pounds.toFixed(1));
        }
      }

      if (!isWeb) {
        requestAnimationFrame(() => {
          const targetX = getOffsetForWeight(loadedWeight, loadedUnit);
          scrollViewRef.current?.scrollTo({ x: targetX, animated: false });
        });
      }
    }
  }, [userProfile, isWeb]);

  const handleContinue = async () => {
    if (!(weight > 0)) return;
    setBusy(true);
    setError(null);
    try {
      const { data: user } = await auth.getCurrentUser();
      if (user) {
        const result = await upsertUserProfile({
          user_id: user.id,
          weight: weight,
          weight_unit: unit,
          current_step: Math.max(userProfile?.current_step || 6, 7),
          is_onboarding_complete: false,
        });

        if (!result.success) {
          console.error("Failed to save weight:", result.error);
          setError("Failed to save your weight. Please try again.");
          setBusy(false);
          return;
        }
      }

      setHeader({ animation: "slide_from_right" });
      router.push("/(onboarding)/fitness" as any);
    } catch (e: any) {
      console.error("Weight save error:", e);
      setError(e?.message ?? "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setHeader({ animation: "slide_from_left" });
    router.push("/(onboarding)/height");
  };

  const onNext = () => {
    if (weight > 0) handleContinue();
  };

  useEffect(() => {
    setHeader({
      currentStep: 6,
      totalSteps: 9,
      onBack,
      onNext,
      nextDisabled: busy || !(weight > 0),
      backIconColor: "#ffffff",
      nextIconColor: "#ffffff",
    });
  }, [setHeader, busy, weight]);

  const kgDisplay = Math.round(weight);
  const lbDisplay = Math.round(weight * 2.20462);

  const rulerMarks = useMemo(() => {
    const marks =
      unit === "kg"
        ? Array.from({ length: KG_MAX + 1 }, (_, i) => i)
        : Array.from({ length: LB_MAX + 1 }, (_, i) => i);
    return marks;
  }, [unit]);

  const { majorInterval, mediumInterval } = useMemo(() => {
    return {
      majorInterval: unit === "kg" ? 10 : 20,
      mediumInterval: unit === "kg" ? 5 : 10,
    };
  }, [unit]);

  const handleScroll = useCallback((event: any) => {
    const scrollX = event.nativeEvent.contentOffset.x;
    let newWeightKg: number;
    const currentUnit = unitRef.current;

    if (currentUnit === "kg") {
      const kgVal = Math.round(scrollX / RULER_ITEM_WIDTH);
      newWeightKg = Math.max(0, Math.min(KG_MAX, kgVal));
    } else {
      const pounds = Math.round(scrollX / RULER_ITEM_WIDTH);
      const poundsClamped = Math.max(0, Math.min(LB_MAX, pounds));
      newWeightKg = poundsClamped / 2.20462;
    }

    const currentWeight = weightRef.current;
    if (Math.abs(newWeightKg - currentWeight) >= 1) {
      setWeight(newWeightKg);
    }
  }, []);

  const handleScrollBeginDrag = useCallback(() => {
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  }, []);

  const handleScrollEndDrag = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150) as any;
  }, []);

  const handleMomentumScrollEnd = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 100) as any;
  }, []);

  const handleWebInputChange = (text: string) => {
    setInputValue(text);
    const numValue = parseFloat(text);
    if (!isNaN(numValue) && numValue >= 0) {
      let weightInKg: number;
      if (unit === "kg") {
        weightInKg = Math.min(numValue, KG_MAX);
      } else {
        weightInKg = Math.min(numValue / 2.20462, KG_MAX);
      }
      setWeight(weightInKg);
    }
  };

  useEffect(() => {
    if (isWeb) {
      if (weight > 0) {
        if (unit === "kg") {
          setInputValue(Math.round(weight).toString());
        } else {
          const pounds = weight * 2.20462;
          setInputValue(pounds.toFixed(1));
        }
      } else {
        setInputValue("");
      }
    }
  }, [weight, unit, isWeb]);

  const toggleUnit = (newUnit: Unit) => {
    if (unit === newUnit || isScrolling) return;
    const currentWeight = weight;
    setUnit(newUnit);

    if (!isWeb && currentWeight > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const targetX = getOffsetForWeight(currentWeight, newUnit);
          scrollViewRef.current?.scrollTo({ x: targetX, animated: false });
        });
      });
    }
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleRulerLayout = (e: any) => {
    const w = e.nativeEvent.layout.width;
    const nextOffset = Math.max(0, w / 2);
    if (Math.abs(nextOffset - centerOffset) > 1) {
      setCenterOffset(nextOffset);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#101A2C" }}>
      <View
        style={{
          flex: 1,
          backgroundColor: "#101A2C",
          alignItems: isWeb ? "center" : "stretch",
          justifyContent: "flex-start",
        }}
      >
        <View
          style={[
            {
              flex: 1,
              backgroundColor: "#101A2C",
              paddingHorizontal: isSmallViewport ? 16 : 24,
              paddingTop: isSmallViewport ? 8 : 16,
              paddingBottom: isSmallViewport ? 16 : 32,
              width: isWeb ? "80%" : "100%",
              maxWidth: 960,
              maxHeight: isWeb ? viewportHeight - 80 : undefined,
              alignSelf: "center",
            },
            isWeb && scaleFactor < 1
              ? { transform: [{ scale: scaleFactor }] }
              : null,
          ]}
        >
          <View style={{ flex: 1, justifyContent: "space-between" }}>
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                paddingBottom: isSmallViewport ? 8 : 16,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ marginTop: topMargin, marginBottom: 24 }}>
                <Text
                  style={{
                    color: "#f59e0b",
                    fontSize: titleSize,
                    fontWeight: "700",
                    textAlign: "center",
                    marginBottom: 10,
                    letterSpacing: 0.5,
                  }}
                >
                  {t("onboarding.whatsYourWeight")}
                </Text>
                <Text
                  style={{
                    color: "#e5e7eb",
                    fontSize: subtitleSize,
                    textAlign: "center",
                    lineHeight: 22,
                    opacity: 0.8,
                  }}
                >
                  {t("onboarding.weightHelpsCalculateNeeds")}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  marginVertical: 24,
                }}
              >
                <TouchableOpacity
                  onPress={() => toggleUnit("kg")}
                  style={{
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    backgroundColor: unit === "kg" ? "#f59e0b" : "#374151",
                    borderTopLeftRadius: 9999,
                    borderBottomLeftRadius: 9999,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "700",
                      color: unit === "kg" ? "#ffffff" : "#d1d5db",
                    }}
                  >
                    KG
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => toggleUnit("lb")}
                  style={{
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    backgroundColor: unit === "lb" ? "#f59e0b" : "#374151",
                    borderTopRightRadius: 9999,
                    borderBottomRightRadius: 9999,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "700",
                      color: unit === "lb" ? "#ffffff" : "#d1d5db",
                    }}
                  >
                    LB
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={{
                  alignItems: "center",
                  marginVertical: 24,
                }}
              >
                <Text
                  style={{
                    color: "#f59e0b",
                    fontSize: 72,
                    fontWeight: "700",
                  }}
                >
                  {unit === "kg" ? kgDisplay : lbDisplay}
                </Text>
                <Text style={{ color: "#f59e0b", fontSize: 24 }}>
                  {unit === "kg" ? "kg" : "lb"}
                </Text>
              </View>

              {isWeb ? (
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    height: 160,
                    paddingHorizontal: 24,
                  }}
                >
                  <Text
                    style={{
                      color: "#e5e7eb",
                      fontSize: 16,
                      marginBottom: 16,
                      textAlign: "center",
                    }}
                  >
                    Enter your weight in{" "}
                    {unit === "kg" ? "kilograms" : "pounds"}
                  </Text>
                  <TextInput
                    style={
                      {
                        backgroundColor: "#374151",
                        color: "#ffffff",
                        fontSize: 24,
                        fontWeight: "700",
                        textAlign: "center",
                        paddingHorizontal: 20,
                        paddingVertical: 15,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: "#6b7280",
                        minWidth: 150,
                        ...(Platform.OS === "web" && {
                          outlineStyle: "none",
                        }),
                      } as any
                    }
                    value={inputValue}
                    onChangeText={handleWebInputChange}
                    placeholder={unit === "kg" ? "e.g., 70" : "e.g., 154"}
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                  />
                </View>
              ) : (
                <View
                  style={{
                    position: "relative",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 160,
                  }}
                  onLayout={handleRulerLayout}
                >
                  <ScrollView
                    ref={scrollViewRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleScroll}
                    onScrollBeginDrag={handleScrollBeginDrag}
                    onScrollEndDrag={handleScrollEndDrag}
                    onMomentumScrollEnd={handleMomentumScrollEnd}
                    scrollEventThrottle={32}
                    contentContainerStyle={{ paddingHorizontal: centerOffset }}
                    snapToInterval={RULER_ITEM_WIDTH}
                    decelerationRate="normal"
                    bounces={false}
                    bouncesZoom={false}
                    directionalLockEnabled
                    removeClippedSubviews
                    scrollsToTop={false}
                    persistentScrollbar={false}
                  >
                    {rulerMarks.map((mark: number) => (
                      <RulerMark
                        key={mark}
                        mark={mark}
                        unit={unit}
                        majorInterval={majorInterval}
                        mediumInterval={mediumInterval}
                      />
                    ))}
                  </ScrollView>
                  <View
                    style={{
                      position: "absolute",
                      width: 2,
                      height: 40,
                      backgroundColor: "#f59e0b",
                      alignSelf: "center",
                      transform: [{ translateX: 4 }],
                    }}
                  />
                </View>
              )}

              {error && (
                <Text
                  style={{
                    color: "#ef4444",
                    textAlign: "center",
                    marginTop: 16,
                    fontSize: 14,
                  }}
                >
                  {error}
                </Text>
              )}
            </ScrollView>

            <View style={{ paddingBottom: isSmallViewport ? 0 : 8 }}>
              <TouchableOpacity
                disabled={busy || !(weight > 0)}
                onPress={handleContinue}
                style={{
                  width: "100%",
                  paddingVertical: isSmallViewport ? 14 : 18,
                  borderRadius: 14,
                  backgroundColor: weight > 0 && !busy ? "#059669" : "#d1d5db",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: isWeb ? (screenWidth < 1280 ? -24 : 10) : 0,
                  ...(Platform.OS !== "web" && {
                    shadowColor: "#000",
                    shadowOpacity: 0.12,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 2,
                  }),
                }}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "700",
                      fontSize: isSmallViewport ? 16 : 18,
                    }}
                  >
                    {t("onboarding.continue")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

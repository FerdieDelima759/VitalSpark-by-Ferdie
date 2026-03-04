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

type Unit = "cm" | "ft";

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
            {unit === "cm" ? mark : mark / 12}
          </Text>
        )}
      </View>
    );
  }
);

export default function HeightOnboarding() {
  const { t } = useTranslation("common");
  const { setHeader } = useOnboardingHeader();
  const [unit, setUnit] = useState<Unit>("cm");
  const [height, setHeight] = useState(0);
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

  const heightRef = useRef(height);
  const unitRef = useRef(unit);

  useEffect(() => {
    heightRef.current = height;
  }, [height]);

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

  const CM_MAX = 250;
  const FT_MAX = 10;

  const getOffsetForHeight = (heightCm: number, ofUnit: Unit) => {
    if (ofUnit === "cm") return Math.max(0, heightCm) * RULER_ITEM_WIDTH;
    const inches = Math.max(0, heightCm) / 2.54;
    return inches * RULER_ITEM_WIDTH;
  };

  useEffect(() => {
    if (userProfile && userProfile.height) {
      const loadedHeight = userProfile.height;
      const loadedUnit = (userProfile.height_unit as Unit) || "cm";

      setHeight(loadedHeight);
      setUnit(loadedUnit);

      if (isWeb) {
        if (loadedUnit === "cm") {
          setInputValue(Math.round(loadedHeight).toString());
        } else {
          const totalInches = loadedHeight / 2.54;
          const feet = totalInches / 12;
          setInputValue(feet.toFixed(1));
        }
      }

      if (!isWeb) {
        requestAnimationFrame(() => {
          const targetX = getOffsetForHeight(loadedHeight, loadedUnit);
          scrollViewRef.current?.scrollTo({ x: targetX, animated: false });
        });
      }
    }
  }, [userProfile, isWeb]);

  const handleContinue = async () => {
    if (!(height > 0)) return;
    setBusy(true);
    setError(null);
    try {
      const { data: user } = await auth.getCurrentUser();
      if (user) {
        const result = await upsertUserProfile({
          user_id: user.id,
          height: height,
          height_unit: unit,
          current_step: Math.max(userProfile?.current_step || 5, 6),
          is_onboarding_complete: false,
        });

        if (!result.success) {
          console.error("Failed to save height:", result.error);
          setError("Failed to save your height. Please try again.");
          setBusy(false);
          return;
        }
      }

      setHeader({ animation: "slide_from_right" });
      router.push("/(onboarding)/weight" as any);
    } catch (e: any) {
      console.error("Height save error:", e);
      setError(e?.message ?? "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setHeader({ animation: "slide_from_left" });
    router.push("/(onboarding)/location");
  };

  const onNext = () => {
    if (height > 0) handleContinue();
  };

  useEffect(() => {
    setHeader({
      currentStep: 5,
      totalSteps: 9,
      onBack,
      onNext,
      nextDisabled: busy || !(height > 0),
      backIconColor: "#ffffff",
      nextIconColor: "#ffffff",
    });
  }, [setHeader, busy, height]);

  const cmDisplay = Math.round(height);
  const feetInches = () => {
    const totalInches = Math.round(height / 2.54);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return { feet, inches };
  };

  const rulerMarks = useMemo(() => {
    const marks =
      unit === "cm"
        ? Array.from({ length: CM_MAX + 1 }, (_, i) => i)
        : Array.from({ length: FT_MAX * 12 + 1 }, (_, i) => i);
    return marks;
  }, [unit]);

  const { majorInterval, mediumInterval } = useMemo(() => {
    return {
      majorInterval: unit === "cm" ? 10 : 12,
      mediumInterval: unit === "cm" ? 5 : 6,
    };
  }, [unit]);

  const handleScroll = useCallback((event: any) => {
    const scrollX = event.nativeEvent.contentOffset.x;
    let newHeightCm: number;
    const currentUnit = unitRef.current;

    if (currentUnit === "cm") {
      const cmVal = Math.round(scrollX / RULER_ITEM_WIDTH);
      newHeightCm = Math.max(0, Math.min(CM_MAX, cmVal));
    } else {
      const inches = Math.round(scrollX / RULER_ITEM_WIDTH);
      const inchesClamped = Math.max(0, Math.min(FT_MAX * 12, inches));
      newHeightCm = inchesClamped * 2.54;
    }

    const currentHeight = heightRef.current;
    if (Math.abs(newHeightCm - currentHeight) >= 1) {
      setHeight(newHeightCm);
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
      let heightInCm: number;
      if (unit === "cm") {
        heightInCm = Math.min(numValue, CM_MAX);
      } else {
        const totalInches = numValue * 12;
        heightInCm = Math.min(totalInches * 2.54, CM_MAX);
      }
      setHeight(heightInCm);
    }
  };

  useEffect(() => {
    if (isWeb) {
      if (height > 0) {
        if (unit === "cm") {
          setInputValue(Math.round(height).toString());
        } else {
          const totalInches = height / 2.54;
          const feet = totalInches / 12;
          setInputValue(feet.toFixed(1));
        }
      } else {
        setInputValue("");
      }
    }
  }, [height, unit, isWeb]);

  const toggleUnit = (newUnit: Unit) => {
    if (unit === newUnit || isScrolling) return;
    const currentHeight = height;
    setUnit(newUnit);

    if (!isWeb && currentHeight > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const targetX = getOffsetForHeight(currentHeight, newUnit);
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
                  {t("onboarding.whatsYourHeight")}
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
                  {t("onboarding.heightHelpsCalculateNeeds")}
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
                  onPress={() => toggleUnit("cm")}
                  style={{
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    backgroundColor: unit === "cm" ? "#f59e0b" : "#374151",
                    borderTopLeftRadius: 9999,
                    borderBottomLeftRadius: 9999,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "700",
                      color: unit === "cm" ? "#ffffff" : "#d1d5db",
                    }}
                  >
                    CM
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => toggleUnit("ft")}
                  style={{
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    backgroundColor: unit === "ft" ? "#f59e0b" : "#374151",
                    borderTopRightRadius: 9999,
                    borderBottomRightRadius: 9999,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "700",
                      color: unit === "ft" ? "#ffffff" : "#d1d5db",
                    }}
                  >
                    FT
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={{
                  alignItems: "center",
                  marginVertical: 24,
                }}
              >
                {unit === "cm" ? (
                  <>
                    <Text
                      style={{
                        color: "#f59e0b",
                        fontSize: 72,
                        fontWeight: "700",
                      }}
                    >
                      {cmDisplay}
                    </Text>
                    <Text style={{ color: "#f59e0b", fontSize: 24 }}>cm</Text>
                  </>
                ) : (
                  <>
                    <Text
                      style={{
                        color: "#f59e0b",
                        fontSize: 72,
                        fontWeight: "700",
                      }}
                    >
                      {`${feetInches().feet}' ${feetInches().inches}"`}
                    </Text>
                    <Text style={{ color: "#f59e0b", fontSize: 24 }}>ft</Text>
                  </>
                )}
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
                    Enter your height in{" "}
                    {unit === "cm" ? "centimeters" : "feet"}
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
                    placeholder={unit === "cm" ? "e.g., 175" : "e.g., 5.8"}
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
                disabled={busy || !(height > 0)}
                onPress={handleContinue}
                style={{
                  width: "100%",
                  paddingVertical: isSmallViewport ? 14 : 18,
                  borderRadius: 14,
                  backgroundColor: height > 0 && !busy ? "#059669" : "#d1d5db",
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

import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "@/node_modules/react-i18next";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOnboardingHeader } from "../../contexts/OnboardingHeaderContext";
import { useDesktopWebRedirect } from "@/hooks/useMobileWebRedirect";
import { useUserData } from "../../hooks/useUserData";
import { useUserContext } from "../../contexts/UserContext";
import { auth } from "../../hooks/useAuth";
import muscularDiagrams from "../../assets/images/Muscular";

const preloadMuscularImages = (gender: string) => {
  const genderImages =
    gender === "female" ? muscularDiagrams.female : muscularDiagrams.male;
  const imageSources = Object.values(genderImages);
  return imageSources.map((source, index) => (
    <Image
      key={`preload-${gender}-${index}`}
      source={source}
      style={{ width: 1, height: 1, opacity: 0, position: "absolute" }}
      resizeMode="contain"
    />
  ));
};

interface TargetMuscleOption {
  code: string;
  label: string;
}

const targetMuscleOptions: TargetMuscleOption[] = [
  { code: "fullBody", label: "targetMuscles.fullBody" },
  { code: "chest", label: "targetMuscles.chest" },
  { code: "glutes", label: "targetMuscles.glutes" },
  { code: "upperBody", label: "targetMuscles.upperBody" },
  { code: "core", label: "targetMuscles.core" },
  { code: "legs", label: "targetMuscles.legs" },
  { code: "back", label: "targetMuscles.back" },
  { code: "shoulders", label: "targetMuscles.shoulders" },
  { code: "lowerBody", label: "targetMuscles.lowerBody" },
  { code: "arms", label: "targetMuscles.arms" },
];

export default function TargetMuscleGroupOnboarding() {
  const { t } = useTranslation("common");
  const { setHeader } = useOnboardingHeader();
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  });
  const { upsertUserProfile } = useUserData();
  const { userProfile } = useUserContext();

  useDesktopWebRedirect();

  const screenWidth = dimensions.width;
  const screenHeight = dimensions.height;
  const isWeb = Platform.OS === "web";

  const userGender = userProfile?.gender === "female" ? "female" : "male";

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
  const isSmallWeb = isWeb && screenWidth < 768;
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

  useEffect(() => {
    if (userProfile && userProfile.target_muscle_groups) {
      setSelectedMuscles(userProfile.target_muscle_groups);
    }
  }, [userProfile]);

  const handleMuscleSelection = (muscleCode: string) => {
    setSelectedMuscles((prev) =>
      prev.includes(muscleCode)
        ? prev.filter((m) => m !== muscleCode)
        : [...prev, muscleCode]
    );
  };

  const getImageSource = () => {
    const genderImages =
      userGender === "female" ? muscularDiagrams.female : muscularDiagrams.male;

    if (selectedMuscles.length === 0) return genderImages.muscular_body;

    const last = selectedMuscles[selectedMuscles.length - 1];
    switch (last) {
      case "core":
        return genderImages.core;
      case "chest":
        return genderImages.chest;
      case "upperBody":
        return genderImages.upper_body;
      case "shoulders":
        return genderImages.shoulder;
      case "arms":
        return genderImages.arms;
      case "back":
        return genderImages.back;
      case "legs":
        return genderImages.leg;
      case "glutes":
        return genderImages.glutes;
      case "lowerBody":
        return genderImages.lower_body;
      case "fullBody":
        return genderImages.full_body;
      default:
        return genderImages.muscular_body;
    }
  };

  const handleContinue = async () => {
    if (!isValid) return;
    setBusy(true);
    setError(null);
    try {
      const { data: user } = await auth.getCurrentUser();
      if (user) {
        const result = await upsertUserProfile({
          user_id: user.id,
          target_muscle_groups: selectedMuscles,
          current_step: Math.max(userProfile?.current_step || 8, 9),
          is_onboarding_complete: false,
        });

        if (!result.success) {
          console.error("Failed to save target muscles:", result.error);
          setError("Failed to save your target muscles. Please try again.");
          setBusy(false);
          return;
        }
      }

      setHeader({ animation: "slide_from_right" });
      router.push("/(onboarding)/dietary" as any);
    } catch (e: any) {
      console.error("Target muscles save error:", e);
      setError(e?.message ?? "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setHeader({ animation: "slide_from_left" });
    router.push("/(onboarding)/fitness");
  };

  const onNext = () => {
    if (isValid) handleContinue();
  };

  const isValid = selectedMuscles.length > 0;

  useEffect(() => {
    setHeader({
      currentStep: 8,
      totalSteps: 9,
      onBack,
      onNext,
      nextDisabled: busy || !isValid,
      backIconColor: "#ffffff",
      nextIconColor: "#ffffff",
    });
  }, [setHeader, busy, isValid]);

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
              paddingLeft: isSmallViewport ? 16 : 24,
              paddingRight: isWeb ? (isSmallViewport ? 16 : 24) : 0,
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
                  {t("onboarding.yourTargetMuscles")}
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
                  {t("onboarding.tellUsAboutTargetMuscles")}
                </Text>
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
              </View>

              <View
                style={{
                  flexDirection: isSmallWeb ? "column" : "row",
                  gap: 24,
                  flex: 1,
                  ...(Platform.OS === "web" && {
                    minWidth: 0,
                    overflow: "hidden",
                  }),
                }}
              >
                <View
                  style={{
                    flex: 1,
                    zIndex: 2,
                    overflow: "visible",
                  }}
                >
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 14,
                      fontWeight: "500",
                      marginBottom: 12,
                      letterSpacing: 0.3,
                    }}
                  >
                    {t("onboarding.targetMuscles")}
                  </Text>
                  <View
                    style={{
                      gap: 4,
                      ...(Platform.OS === "web" && {
                        flexDirection: "row",
                        flexWrap: "wrap",
                        justifyContent: "flex-start",
                        minWidth: 0,
                        overflow: "hidden",
                      }),
                    }}
                  >
                    {targetMuscleOptions.map((muscle) => (
                      <TouchableOpacity
                        key={muscle.code}
                        disabled={busy}
                        onPress={() => handleMuscleSelection(muscle.code)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 9,
                          paddingHorizontal: 12,
                          backgroundColor: "transparent",
                          borderRadius: 12,
                          ...(Platform.OS === "web" && {
                            width: "49%",
                            flexGrow: 0,
                            justifyContent: "flex-start",
                            flexShrink: 1,
                            marginBottom: 6,
                            minWidth: 0,
                          }),
                        }}
                        activeOpacity={0.7}
                      >
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            borderWidth: 2,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: selectedMuscles.includes(
                              muscle.code
                            )
                              ? "#f59e0b"
                              : "transparent",
                            borderColor: selectedMuscles.includes(muscle.code)
                              ? "#f59e0b"
                              : "#374151",
                          }}
                        >
                          {selectedMuscles.includes(muscle.code) && (
                            <Text
                              style={{
                                color: "#fff",
                                fontSize: 12,
                                fontWeight: "700",
                              }}
                            >
                              ✓
                            </Text>
                          )}
                        </View>
                        <Text
                          style={{
                            fontWeight: "400",
                            fontSize: 16,
                            marginLeft: 12,
                            color: selectedMuscles.includes(muscle.code)
                              ? "#f59e0b"
                              : "#e5e7eb",
                            zIndex: 50,
                            ...(Platform.OS === "web" && {
                              overflow: "visible",
                              flexShrink: 0,
                            }),
                          }}
                        >
                          {t(muscle.label)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {!isSmallWeb && (
                  <View
                    style={{
                      flex: 1,
                      position: "relative",
                      zIndex: 10,
                      overflow: "visible",
                      paddingBottom: 12,
                      ...(Platform.OS === "web" && { minWidth: 0 }),
                    }}
                  >
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 16,
                        bottom: isWeb ? 0 : 30,
                        left: 0,
                        justifyContent: "flex-end",
                        alignItems: "flex-end",
                      }}
                    >
                      <Image
                        source={getImageSource()}
                        style={{
                          ...(Platform.OS === "web"
                            ? screenWidth > 768
                              ? {
                                  left: 20,
                                  width: "100%",
                                  top: 0,
                                  height: "100%",
                                }
                              : {
                                  left: 30,
                                  width: "150%",
                                  top: 165,
                                  height: "150%",
                                }
                            : {
                                left: 50,
                                width: "180%",
                                top: 50,
                                height: "100%",
                              }),
                        }}
                        resizeMode="contain"
                        fadeDuration={0}
                      />
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            <View
              style={{
                paddingBottom: isSmallViewport ? 0 : 8,
                paddingRight: isWeb ? 0 : 18,
                zIndex: 5,
              }}
            >
              <TouchableOpacity
                disabled={busy || !isValid}
                onPress={handleContinue}
                style={{
                  width: "100%",
                  paddingVertical: isSmallViewport ? 14 : 18,
                  borderRadius: 14,
                  backgroundColor: isValid && !busy ? "#059669" : "#d1d5db",
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
      {preloadMuscularImages(userGender)}
    </SafeAreaView>
  );
}

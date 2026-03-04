import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "@/node_modules/react-i18next";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOnboardingHeader } from "../../contexts/OnboardingHeaderContext";
import { generateOnboardingAffirmations } from "../../lib/huggingface";
import { useUserData } from "../../hooks/useUserData";
import { useUserContext } from "../../contexts/UserContext";
import { auth } from "../../hooks/useAuth";
import { useDesktopWebRedirect } from "@/hooks/useMobileWebRedirect";

interface MoodOption {
  code: string;
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
}

const moods: MoodOption[] = [
  {
    code: "happy",
    label: "moods.happy",
    emoji: "😊",
    color: "#059669",
    bgColor: "rgba(209, 250, 229, 0.8)",
  },
  {
    code: "calm",
    label: "moods.calm",
    emoji: "😌",
    color: "#0ea5e9",
    bgColor: "rgba(224, 242, 254, 0.8)",
  },
  {
    code: "energetic",
    label: "moods.energetic",
    emoji: "⚡",
    color: "#f59e0b",
    bgColor: "rgba(254, 243, 199, 0.8)",
  },
  {
    code: "anxious",
    label: "moods.anxious",
    emoji: "😰",
    color: "#8b5cf6",
    bgColor: "rgba(237, 233, 254, 0.8)",
  },
  {
    code: "tired",
    label: "moods.tired",
    emoji: "😴",
    color: "#64748b",
    bgColor: "rgba(248, 250, 252, 0.8)",
  },
];

export default function MoodOnboarding() {
  const { t } = useTranslation("common");
  const { setHeader } = useOnboardingHeader();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affirmation, setAffirmation] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [initializing, setInitializing] = useState(true);
  const [dimensions, setDimensions] = useState({
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  });
  const screenWidth = dimensions.width;
  const screenHeight = dimensions.height;
  const { fetchUserProfile, upsertUserProfile } = useUserData();
  const { userProfile, loadingState } = useUserContext();
  const isWeb = Platform.OS === "web";
  const isLoadingProfile = initializing || loadingState.isLoading;

  useDesktopWebRedirect();

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
      ? -24
      : 24
    : 0;
  const titleSize = isSmallViewport ? 22 : 26;
  const subtitleSize = isSmallViewport ? 14 : 16;
  const moodButtonSize = screenWidth > 400 ? 100 : 90;
  const moodButtonSpacing = isSmallViewport ? 12 : 16;
  const moodEmojiSize = isSmallViewport ? 26 : 30;
  const moodLabelSize = isSmallViewport ? 13 : 14;

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadExistingMood = async () => {
      if (!initializing) {
        return;
      }

      if (loadingState.isLoading) {
        return;
      }

      if (userProfile?.current_mood) {
        setSelectedMood(userProfile.current_mood);
        setInitializing(false);
        return;
      }

      const { data: user } = await auth.getCurrentUser();

      if (!isMounted) {
        return;
      }

      if (!user) {
        setInitializing(false);
        return;
      }

      const result = await fetchUserProfile(user.id);

      if (!isMounted) {
        return;
      }

      if (result.success && result.data?.current_mood) {
        setSelectedMood(result.data.current_mood);
      }

      setInitializing(false);
    };

    loadExistingMood();

    return () => {
      isMounted = false;
    };
  }, [initializing, loadingState.isLoading, userProfile, fetchUserProfile]);

  useEffect(() => {
    if (selectedMood) {
      const userProfileData = {
        preferred_language: userProfile?.preferred_language || "en",
        current_mood: selectedMood,
      };
      const affirmations = generateOnboardingAffirmations(userProfileData);
      setAffirmation(affirmations[0]);
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    } else {
      setAffirmation(null);
      fadeAnim.setValue(0);
    }
  }, [selectedMood, fadeAnim, userProfile?.preferred_language]);

  const handleMoodSelect = (moodCode: string) => {
    setSelectedMood(moodCode);
    setError(null);
  };

  const handleContinue = async () => {
    if (!selectedMood) return;
    setBusy(true);
    setError(null);
    try {
      const { data: user } = await auth.getCurrentUser();
      if (user && selectedMood) {
        const result = await upsertUserProfile({
          user_id: user.id,
          current_mood: selectedMood,
          current_step: Math.max(userProfile?.current_step || 2, 3),
          is_onboarding_complete: false,
        });

        if (!result.success) {
          console.error("Failed to save mood:", result.error);
          setError("Failed to save your mood. Please try again.");
          setBusy(false);
          return;
        }
      }

      setHeader({ animation: "slide_from_right" });
      router.push("/(onboarding)/profile");
    } catch (e: any) {
      console.error("Mood save error:", e);
      setError(e?.message ?? "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setHeader({ animation: "slide_from_left" });
    router.push("/(onboarding)/language");
  };

  const onNext = () => {
    if (selectedMood) {
      handleContinue();
    }
  };

  useEffect(() => {
    setHeader({
      currentStep: 2,
      totalSteps: 9,
      onBack,
      onNext,
      canGoBack: true,
      nextDisabled: busy || !selectedMood || isLoadingProfile,
      backIconColor: "#ffffff",
      nextIconColor: "#ffffff",
    });
  }, [setHeader, busy, selectedMood, isLoadingProfile]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#101A2C" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
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
              <View style={{ marginTop: topMargin }}>
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
                  {t("onboarding.howFeeling")}
                </Text>
                <Text
                  style={{
                    color: "#e5e7eb",
                    fontSize: subtitleSize,
                    textAlign: "center",
                    marginBottom: isSmallViewport ? 12 : 16,
                  }}
                >
                  {t("onboarding.pickMood")}
                </Text>
                {error && (
                  <Text
                    style={{
                      color: "#dc2626",
                      textAlign: "center",
                      marginBottom: 12,
                    }}
                  >
                    {error}
                  </Text>
                )}
              </View>

              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {isLoadingProfile ? (
                  <View style={{ alignItems: "center" }}>
                    <ActivityIndicator size="large" color="#f59e0b" />
                    <Text
                      style={{
                        color: "#e5e7eb",
                        marginTop: 12,
                        fontSize: subtitleSize,
                        textAlign: "center",
                      }}
                    >
                      {t("common.loading")}
                    </Text>
                  </View>
                ) : (
                  <View style={{ alignItems: "center", width: "100%" }}>
                    <>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "center",
                          marginBottom: moodButtonSpacing,
                        }}
                      >
                        {moods.slice(0, 3).map((mood) => (
                          <TouchableOpacity
                            key={mood.code}
                            disabled={busy}
                            onPress={() => handleMoodSelect(mood.code)}
                            style={{
                              width: isSmallViewport ? 80 : moodButtonSize,
                              height: isSmallViewport ? 80 : 100,
                              marginHorizontal: 8,
                              borderRadius: 18,
                              backgroundColor:
                                selectedMood === mood.code
                                  ? mood.bgColor
                                  : "#18223A",
                              borderWidth: selectedMood === mood.code ? 3 : 1.5,
                              borderColor:
                                selectedMood === mood.code
                                  ? mood.color
                                  : "#233056",
                              alignItems: "center",
                              justifyContent: "center",
                              ...(Platform.OS !== "web" && {
                                shadowColor:
                                  selectedMood === mood.code
                                    ? mood.color
                                    : "#000",
                                shadowOpacity:
                                  selectedMood === mood.code ? 0.18 : 0.08,
                                shadowRadius: 8,
                                shadowOffset: { width: 0, height: 2 },
                                elevation: selectedMood === mood.code ? 5 : 2,
                              }),
                              transform:
                                selectedMood === mood.code
                                  ? [{ scale: 1.06 }]
                                  : [],
                            }}
                            activeOpacity={0.85}
                          >
                            <Text
                              style={{
                                fontSize: moodEmojiSize,
                                marginBottom: 4,
                              }}
                            >
                              {mood.emoji}
                            </Text>
                            <Text
                              style={{
                                fontWeight: "700",
                                fontSize: moodLabelSize,
                                color:
                                  selectedMood === mood.code
                                    ? mood.color
                                    : "#e5e7eb",
                                textAlign: "center",
                                letterSpacing: 0.2,
                              }}
                            >
                              {t(mood.label)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "center",
                        }}
                      >
                        {moods.slice(3, 5).map((mood) => (
                          <TouchableOpacity
                            key={mood.code}
                            disabled={busy}
                            onPress={() => handleMoodSelect(mood.code)}
                            style={{
                              width: isSmallViewport ? 80 : moodButtonSize,
                              height: isSmallViewport ? 80 : 100,
                              marginHorizontal: 8,
                              borderRadius: 18,
                              backgroundColor:
                                selectedMood === mood.code
                                  ? mood.bgColor
                                  : "#18223A",
                              borderWidth: selectedMood === mood.code ? 3 : 1.5,
                              borderColor:
                                selectedMood === mood.code
                                  ? mood.color
                                  : "#233056",
                              alignItems: "center",
                              justifyContent: "center",
                              ...(Platform.OS !== "web" && {
                                shadowColor:
                                  selectedMood === mood.code
                                    ? mood.color
                                    : "#000",
                                shadowOpacity:
                                  selectedMood === mood.code ? 0.18 : 0.08,
                                shadowRadius: 8,
                                shadowOffset: { width: 0, height: 2 },
                                elevation: selectedMood === mood.code ? 5 : 2,
                              }),
                              transform:
                                selectedMood === mood.code
                                  ? [{ scale: 1.06 }]
                                  : [],
                            }}
                            activeOpacity={0.85}
                          >
                            <Text
                              style={{
                                fontSize: moodEmojiSize,
                                marginBottom: 4,
                              }}
                            >
                              {mood.emoji}
                            </Text>
                            <Text
                              style={{
                                fontWeight: "700",
                                fontSize: moodLabelSize,
                                color:
                                  selectedMood === mood.code
                                    ? mood.color
                                    : "#e5e7eb",
                                textAlign: "center",
                                letterSpacing: 0.2,
                              }}
                            >
                              {t(mood.label)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>

                    {affirmation && (
                      <Animated.View
                        style={{
                          opacity: fadeAnim,
                          borderRadius: 12,
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          marginTop: isSmallViewport ? 48 : 62,
                          width: "90%",
                          alignSelf: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: "#f59e0b",
                            fontSize: isSmallViewport ? 16 : 18,
                            fontWeight: "500",
                            textAlign: "center",
                            lineHeight: isSmallViewport ? 18 : 20,
                          }}
                        >
                          ✨ {affirmation}
                        </Text>
                      </Animated.View>
                    )}
                  </View>
                )}
              </View>

              <View style={{ paddingBottom: isSmallViewport ? 0 : 8 }}>
                <TouchableOpacity
                  disabled={busy || !selectedMood || isLoadingProfile}
                  onPress={handleContinue}
                  style={{
                    width: "100%",
                    paddingVertical: isSmallViewport ? 14 : 18,
                    borderRadius: 14,
                    backgroundColor:
                      selectedMood && !busy && !isLoadingProfile
                        ? "#059669"
                        : "#d1d5db",
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "@/node_modules/react-i18next";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { generateOnboardingCompletionMessage } from "../../lib/huggingface";
import { useDesktopWebRedirect } from "@/hooks/useMobileWebRedirect";
import { useUserData } from "../../hooks/useUserData";
import { useUserContext } from "../../contexts/UserContext";
import { auth } from "../../hooks/useAuth";

export default function FinishOnboarding() {
  const { t, i18n } = useTranslation("common");
  const { upsertUserProfile } = useUserData();
  const { userProfile } = useUserContext();

  const [motivationalMessage, setMotivationalMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [pulseAnim] = useState(new Animated.Value(1));
  const [sparkleAnim] = useState(new Animated.Value(0));

  const [dimensions, setDimensions] = useState({
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  });

  useDesktopWebRedirect();

  const screenWidth = dimensions.width;
  const screenHeight = dimensions.height;
  const isWeb = Platform.OS === "web";
  const isMobile = !isWeb;

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

  const isSmallWeb = isWeb && screenWidth < 1280;
  const isSmallMobile = !isWeb && (screenWidth < 375 || screenHeight < 700);
  const isVerySmallMobile = !isWeb && (screenWidth < 360 || screenHeight < 650);

  const titleFontSize = isVerySmallMobile
    ? 28
    : isSmallMobile
      ? 30
      : isMobile
        ? 34
        : isSmallWeb
          ? 40
          : 46;
  const subtitleFontSize = isVerySmallMobile
    ? 16
    : isSmallMobile
      ? 17
      : isMobile
        ? 19
        : isSmallWeb
          ? 21
          : 24;
  const descriptionFontSize = isVerySmallMobile
    ? 14
    : isSmallMobile
      ? 14
      : isMobile
        ? 15
        : 16;
  const motivationalFontSize = isVerySmallMobile
    ? 15
    : isSmallMobile
      ? 16
      : isMobile
        ? 17
        : 19;
  const sparkleFontSize = isVerySmallMobile
    ? 30
    : isSmallMobile
      ? 33
      : isMobile
        ? 36
        : 42;

  const containerPadding = isVerySmallMobile
    ? 16
    : isSmallMobile
      ? 20
      : isMobile
        ? 24
        : isSmallWeb
          ? 32
          : 40;
  const verticalSpacing = isVerySmallMobile
    ? 16
    : isSmallMobile
      ? 20
      : isMobile
        ? 24
        : isSmallWeb
          ? 32
          : 40;
  const sectionMarginBottom = isVerySmallMobile
    ? 28
    : isSmallMobile
      ? 32
      : isMobile
        ? 36
        : isSmallWeb
          ? 44
          : 52;

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  const createFallbackMotivation = (
    name: string,
    mood?: string,
    goal?: string
  ) => {
    const userLanguage = userProfile?.preferred_language || i18n.language;

    const moodMessages = {
      en: {
        happy: "Your positive energy is perfect for this journey!",
        calm: "Your peaceful mindset will guide you to success.",
        energetic: "That energy will fuel your transformation!",
        stressed: "We're here to support you through this.",
        anxious: "Your courage to start shows real strength.",
        confident: "Your confidence will drive your success!",
        motivated: "Channel that motivation into lasting change!",
        tired: "Rest is important, and we'll help you find your energy!",
      },
      es: {
        happy: "¡Tu energía positiva es perfecta para este viaje!",
        calm: "Tu mentalidad pacífica te guiará al éxito.",
        energetic: "¡Esa energía impulsará tu transformación!",
        stressed: "Estamos aquí para apoyarte en esto.",
        anxious: "Tu valentía para empezar muestra verdadera fuerza.",
        confident: "¡Tu confianza impulsará tu éxito!",
        motivated: "¡Canaliza esa motivación en un cambio duradero!",
        tired:
          "¡El descanso es importante y te ayudaremos a encontrar tu energía!",
      },
      fil: {
        happy: "Perfect ang inyong positive energy para sa journey na ito!",
        calm: "Ang inyong peaceful mindset ay magdadala sa inyo sa success.",
        energetic: "Ang energy na yan ay magpo-power sa inyong transformation!",
        stressed: "Nandito kami para suportahan kayo dito.",
        anxious:
          "Ang courage ninyo na magsimula ay nagpapakita ng tunay na strength.",
        confident: "Ang confidence ninyo ay magdadrive sa inyong success!",
        motivated: "I-channel ninyo ang motivation na yan sa lasting change!",
        tired:
          "Importante ang rest at tutulungan namin kayong makahanap ng energy!",
      },
    } as const;

    const goalMessages = {
      en: {
        weight_loss: "weight loss goals",
        muscle_gain: "muscle building",
        general_fitness: "fitness goals",
        endurance: "endurance training",
        flexibility: "flexibility goals",
        mental_health: "wellness journey",
      },
      es: {
        weight_loss: "objetivos de pérdida de peso",
        muscle_gain: "desarrollo muscular",
        general_fitness: "objetivos de fitness",
        endurance: "entrenamiento de resistencia",
        flexibility: "objetivos de flexibilidad",
        mental_health: "viaje de bienestar",
      },
      fil: {
        weight_loss: "weight loss goals",
        muscle_gain: "muscle building",
        general_fitness: "fitness goals",
        endurance: "endurance training",
        flexibility: "flexibility goals",
        mental_health: "wellness journey",
      },
    } as const;

    const templates = {
      en: "{name}, {moodMessage} Let's achieve your {goalMessage} together!",
      es: "{name}, {moodMessage} ¡Logremos tus {goalMessage} juntos!",
      fil: "{name}, {moodMessage} Sama-sama nating maaabot ang inyong {goalMessage}!",
    } as const;

    const langMoodMessages =
      (moodMessages as any)[userLanguage] || moodMessages.en;
    const langGoalMessages =
      (goalMessages as any)[userLanguage] || goalMessages.en;
    const template = (templates as any)[userLanguage] || templates.en;

    const moodPart =
      langMoodMessages[mood as keyof typeof langMoodMessages] ||
      langMoodMessages.motivated;
    const goalPart =
      langGoalMessages[goal as keyof typeof langGoalMessages] ||
      langGoalMessages.general_fitness;

    return template
      .replace("{name}", name)
      .replace("{moodMessage}", moodPart)
      .replace("{goalMessage}", goalPart);
  };

  // Generate motivational message
  useEffect(() => {
    const generateMotivation = () => {
      const name =
        userProfile?.nickname ||
        userProfile?.full_name?.split?.(" ")?.[0] ||
        t("onboarding.finish.fallbackName");

      setGeneratingMessage(true);
      try {
        const profileForMessage = {
          ...userProfile,
          preferred_language: userProfile?.preferred_language || i18n.language,
          nickname: name,
        };

        const message = generateOnboardingCompletionMessage(profileForMessage);
        setMotivationalMessage(message);
      } catch {
        const fallbackMessage = createFallbackMotivation(
          name,
          userProfile?.current_mood,
          userProfile?.fitness_goal
        );
        setMotivationalMessage(fallbackMessage);
      } finally {
        setGeneratingMessage(false);
      }
    };

    generateMotivation();
  }, [
    i18n.language,
    userProfile?.nickname,
    userProfile?.full_name,
    userProfile?.current_mood,
    userProfile?.fitness_goal,
    userProfile?.preferred_language,
  ]);

  // Start animations
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 800,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim, slideAnim, sparkleAnim, pulseAnim]);

  // Navigation handlers
  const handleReview = () => {
    router.push("/(onboarding)/language");
  };

  const handleCreateProfile = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data: user } = await auth.getCurrentUser();
      if (user) {
        const result = await upsertUserProfile({
          user_id: user.id,
          is_onboarding_complete: true,
          current_step: 10,
        });

        if (!result.success) {
          console.error("Failed to complete onboarding:", result.error);
          setError(
            t("onboarding.finish.failedToCompleteOnboarding") ||
              "Failed to complete onboarding. Please try again."
          );
          setBusy(false);
          return;
        }
      }

      router.replace("/(tabs)/home");
    } catch (e: any) {
      console.error("Finish onboarding error:", e);
      setError(
        e?.message ||
          t("onboarding.finish.failedToCompleteOnboarding") ||
          "Failed to complete onboarding"
      );
    } finally {
      setBusy(false);
    }
  };

  const displayName =
    userProfile?.nickname ||
    userProfile?.full_name?.split?.(" ")?.[0] ||
    t("onboarding.finish.fallbackName") ||
    "Friend";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#0b1220" }}
      edges={["top", "bottom"]}
    >
      <LinearGradient
        colors={["#0b1220", "#0f1829", "#0a0f1a"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            height: 300,
            width: 300,
            borderRadius: 150,
            backgroundColor: "rgba(16, 185, 129, 0.08)",
            opacity: 0.6,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: -100,
            left: -60,
            height: 280,
            width: 280,
            borderRadius: 140,
            backgroundColor: "rgba(251, 191, 36, 0.08)",
            opacity: 0.6,
          }}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "transparent",
              alignItems: isWeb ? "center" : "stretch",
              justifyContent: "flex-start",
            }}
          >
            <View
              style={[
                {
                  flex: 1,
                  backgroundColor: "transparent",
                  paddingHorizontal: containerPadding,
                  paddingTop: verticalSpacing,
                  paddingBottom: 0,
                  width: isWeb ? "90%" : "100%",
                  maxWidth: 900,
                  alignSelf: "center",
                },
                isWeb && scaleFactor < 1
                  ? { transform: [{ scale: scaleFactor }] }
                  : null,
              ]}
            >
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                  flexGrow: 1,
                  paddingBottom: isVerySmallMobile
                    ? 32
                    : isSmallMobile
                      ? 36
                      : isMobile
                        ? 40
                        : 48,
                }}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: isWeb ? viewportHeight - 200 : undefined,
                  }}
                >
                  <Animated.View
                    style={{
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }],
                      alignItems: "center",
                      marginTop: isVerySmallMobile
                        ? 8
                        : isSmallMobile
                          ? 12
                          : isMobile
                            ? 20
                            : isSmallWeb
                              ? 32
                              : 40,
                      marginBottom: sectionMarginBottom,
                      position: "relative",
                    }}
                  >
                    <Animated.View
                      style={{
                        opacity: sparkleAnim,
                        transform: [
                          {
                            rotate: sparkleAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["-20deg", "20deg"],
                            }),
                          },
                          {
                            scale: sparkleAnim.interpolate({
                              inputRange: [0, 0.5, 1],
                              outputRange: [1, 1.4, 1],
                            }),
                          },
                        ],
                        position: "absolute",
                        top: isVerySmallMobile ? -16 : -20,
                        right: isVerySmallMobile
                          ? 5
                          : isSmallMobile
                            ? 8
                            : isMobile
                              ? 10
                              : 20,
                      }}
                    >
                      <Text style={{ fontSize: sparkleFontSize }}>✨</Text>
                    </Animated.View>

                    <Text
                      style={{
                        fontSize: titleFontSize,
                        fontWeight: "800",
                        color: "#fbbf24",
                        letterSpacing: isVerySmallMobile ? 0.3 : 0.5,
                        textAlign: "center",
                        marginBottom: isVerySmallMobile ? 12 : 16,
                        lineHeight: isVerySmallMobile
                          ? 34
                          : isSmallMobile
                            ? 38
                            : isMobile
                              ? 42
                              : isSmallWeb
                                ? 48
                                : 54,
                        paddingHorizontal: isVerySmallMobile ? 8 : 0,
                      }}
                    >
                      {t("onboarding.finish.welcome")}, {displayName}!
                    </Text>

                    <Text
                      style={{
                        fontSize: subtitleFontSize,
                        fontWeight: "600",
                        color: "#34d399",
                        marginBottom: isVerySmallMobile
                          ? 16
                          : isSmallMobile
                            ? 20
                            : 24,
                        textAlign: "center",
                        lineHeight: isVerySmallMobile
                          ? 22
                          : isSmallMobile
                            ? 24
                            : isMobile
                              ? 26
                              : 32,
                        paddingHorizontal: isVerySmallMobile ? 8 : 0,
                      }}
                    >
                      {t("onboarding.finish.youAreInGoodHands")}
                    </Text>

                    <Text
                      style={{
                        fontSize: descriptionFontSize,
                        color: "#d1d5db",
                        lineHeight: isVerySmallMobile
                          ? 22
                          : isSmallMobile
                            ? 24
                            : 26,
                        textAlign: "center",
                        paddingHorizontal: isVerySmallMobile
                          ? 8
                          : isMobile
                            ? 4
                            : 24,
                        maxWidth: 600,
                      }}
                    >
                      {t("onboarding.finish.supportDescription")}
                    </Text>
                  </Animated.View>

                  {(motivationalMessage || generatingMessage) && (
                    <Animated.View
                      style={{
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                        width: "100%",
                        marginBottom: isVerySmallMobile
                          ? 36
                          : isSmallMobile
                            ? 40
                            : 48,
                      }}
                    >
                      <View
                        style={{
                          paddingHorizontal: isVerySmallMobile
                            ? 16
                            : isSmallMobile
                              ? 20
                              : isMobile
                                ? 24
                                : 32,
                          paddingVertical: isVerySmallMobile
                            ? 16
                            : isSmallMobile
                              ? 20
                              : isMobile
                                ? 24
                                : 28,
                        }}
                      >
                        {generatingMessage ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              paddingVertical: 12,
                            }}
                          >
                            <ActivityIndicator size="small" color="#fbbf24" />
                            <Text
                              style={{
                                marginLeft: 14,
                                color: "#d1d5db",
                                fontStyle: "italic",
                                fontSize: 15,
                              }}
                            >
                              {t("onboarding.finish.craftingMessage")}
                            </Text>
                          </View>
                        ) : (
                          <View>
                            <Text
                              style={{
                                textAlign: "center",
                                color: "#fbbf24",
                                fontSize: motivationalFontSize,
                                fontWeight: "700",
                                lineHeight: isVerySmallMobile
                                  ? 24
                                  : isSmallMobile
                                    ? 26
                                    : 30,
                                letterSpacing: isVerySmallMobile ? 0.2 : 0.3,
                              }}
                            >
                              {motivationalMessage}
                            </Text>

                            {/* Decorative bottom accent */}
                            <View
                              style={{
                                marginTop: isVerySmallMobile ? 12 : 16,
                                height: isVerySmallMobile ? 2 : 3,
                                width: isVerySmallMobile ? 50 : 60,
                                backgroundColor: "rgba(251, 191, 36, 0.3)",
                                borderRadius: 2,
                                alignSelf: "center",
                              }}
                            />
                          </View>
                        )}
                      </View>
                    </Animated.View>
                  )}

                  <Animated.View
                    style={{
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }],
                      width: "100%",
                      marginBottom: isVerySmallMobile ? 16 : 20,
                    }}
                  >
                    <View
                      style={{
                        borderRadius: isVerySmallMobile ? 14 : 16,
                        backgroundColor: "rgba(254, 240, 138, 0.06)",
                        borderWidth: 1,
                        borderColor: "rgba(254, 240, 138, 0.15)",
                        paddingHorizontal: isVerySmallMobile
                          ? 14
                          : isSmallMobile
                            ? 16
                            : isMobile
                              ? 18
                              : 20,
                        paddingVertical: isVerySmallMobile
                          ? 12
                          : isSmallMobile
                            ? 13
                            : isMobile
                              ? 14
                              : 16,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: isVerySmallMobile
                              ? 18
                              : isSmallMobile
                                ? 20
                                : 22,
                            marginRight: isVerySmallMobile ? 10 : 14,
                          }}
                        >
                          ⚠️
                        </Text>
                        <Text
                          style={{
                            flex: 1,
                            fontSize: isVerySmallMobile
                              ? 12
                              : isMobile
                                ? 13
                                : 14,
                            color: "#fef08a",
                            fontWeight: "500",
                            lineHeight: isVerySmallMobile ? 18 : 22,
                          }}
                        >
                          {t("onboarding.finish.reviewReminder")}
                        </Text>
                      </View>
                    </View>
                  </Animated.View>

                  <Animated.View
                    style={{
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }],
                      width: "100%",
                      marginBottom: isVerySmallMobile
                        ? 24
                        : isSmallMobile
                          ? 28
                          : 32,
                    }}
                  >
                    <TouchableOpacity
                      onPress={handleReview}
                      disabled={busy}
                      activeOpacity={0.8}
                      style={{
                        borderRadius: isVerySmallMobile ? 14 : 16,
                        overflow: "hidden",
                        ...(Platform.OS !== "web" && {
                          shadowColor: "#000",
                          shadowOpacity: 0.15,
                          shadowRadius: 8,
                          shadowOffset: { width: 0, height: 4 },
                          elevation: 3,
                        }),
                      }}
                    >
                      <LinearGradient
                        colors={["#374151", "#1f2937"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          borderWidth: 1.5,
                          borderColor: "rgba(156, 163, 175, 0.25)",
                          paddingVertical: isVerySmallMobile
                            ? 14
                            : isSmallMobile
                              ? 16
                              : isMobile
                                ? 18
                                : 20,
                          paddingHorizontal: isVerySmallMobile ? 20 : 24,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: isVerySmallMobile ? 18 : 20,
                              marginRight: isVerySmallMobile ? 8 : 10,
                            }}
                          >
                            📝
                          </Text>
                          <Text
                            style={{
                              color: "#f9fafb",
                              fontWeight: "600",
                              fontSize: isVerySmallMobile
                                ? 14
                                : isSmallMobile
                                  ? 15
                                  : isMobile
                                    ? 16
                                    : 18,
                              letterSpacing: 0.3,
                            }}
                          >
                            {t("onboarding.finish.reviewInformation")}
                          </Text>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>

                  {error && (
                    <Animated.View
                      style={{ opacity: fadeAnim, width: "100%", marginTop: 8 }}
                    >
                      <View
                        style={{
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: "rgba(248, 113, 113, 0.2)",
                          backgroundColor: "rgba(127, 29, 29, 0.4)",
                          padding: 16,
                        }}
                      >
                        <Text
                          style={{
                            color: "#fecaca",
                            textAlign: "center",
                            lineHeight: 22,
                          }}
                        >
                          {error}
                        </Text>
                      </View>
                    </Animated.View>
                  )}

                  <Animated.View
                    style={{
                      opacity: fadeAnim,
                      marginTop: isVerySmallMobile
                        ? 16
                        : isSmallMobile
                          ? 20
                          : isMobile
                            ? 24
                            : 32,
                      marginBottom: isVerySmallMobile ? 12 : 16,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#9ca3af",
                        fontSize: isVerySmallMobile ? 12 : isMobile ? 13 : 14,
                        textAlign: "center",
                        fontWeight: "500",
                        letterSpacing: 0.2,
                        paddingHorizontal: isVerySmallMobile ? 8 : 0,
                      }}
                    >
                      {t("onboarding.finish.journeyStarts")}
                    </Text>
                  </Animated.View>

                  <Animated.View
                    style={{
                      opacity: fadeAnim,
                      transform: [{ scale: pulseAnim }],
                      width: "95%",
                      alignSelf: "center",
                      borderRadius: isVerySmallMobile ? 14 : 16,
                      overflow: "hidden",
                      marginTop: isVerySmallMobile
                        ? 24
                        : isSmallMobile
                          ? 28
                          : isMobile
                            ? 32
                            : 40,
                      ...(Platform.OS !== "web" && {
                        shadowColor: "#10b981",
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.4,
                        shadowRadius: 24,
                        elevation: 10,
                      }),
                    }}
                  >
                    <TouchableOpacity
                      onPress={handleCreateProfile}
                      disabled={busy}
                      activeOpacity={0.85}
                      style={{
                        borderRadius: isVerySmallMobile ? 14 : 16,
                        overflow: "hidden",
                      }}
                    >
                      <LinearGradient
                        colors={["#10b981", "#059669", "#047857"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          paddingVertical: isVerySmallMobile
                            ? 14
                            : isSmallMobile
                              ? 16
                              : isMobile
                                ? 18
                                : 22,
                          paddingHorizontal: isVerySmallMobile ? 24 : 28,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {busy ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <>
                              <Text
                                style={{
                                  fontSize: isVerySmallMobile
                                    ? 22
                                    : isSmallMobile
                                      ? 24
                                      : isMobile
                                        ? 26
                                        : 28,
                                  marginRight: isVerySmallMobile
                                    ? 10
                                    : isSmallMobile
                                      ? 12
                                      : 14,
                                }}
                              >
                                ❤️
                              </Text>
                              <View style={{ alignItems: "center" }}>
                                <Text
                                  style={{
                                    color: "#ffffff",
                                    fontWeight: "800",
                                    fontSize: isVerySmallMobile
                                      ? 15
                                      : isSmallMobile
                                        ? 16
                                        : isMobile
                                          ? 17
                                          : 19,
                                    letterSpacing: isVerySmallMobile
                                      ? 0.4
                                      : 0.6,
                                    marginBottom: 2,
                                  }}
                                >
                                  {t("onboarding.finish.itsGoodToGo")}
                                </Text>
                                <Text
                                  style={{
                                    color: "rgba(209, 250, 229, 0.95)",
                                    fontSize: isVerySmallMobile
                                      ? 12
                                      : isMobile
                                        ? 13
                                        : 14,
                                    fontWeight: "500",
                                    letterSpacing: 0.3,
                                  }}
                                >
                                  {t("onboarding.finish.createMyProfile")}
                                </Text>
                              </View>
                            </>
                          )}
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "@/node_modules/react-i18next";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { setLanguage } from "../../i18n";
import { useOnboardingHeader } from "../../contexts/OnboardingHeaderContext";
import { generateOnboardingAffirmations } from "../../lib/huggingface";
import { useUserData } from "../../hooks/useUserData";
import { useUserContext } from "../../contexts/UserContext";
import { auth } from "../../hooks/useAuth";
import { useDesktopWebRedirect } from "@/hooks/useMobileWebRedirect";

const bgImage = require("../../assets/images/Onboarding_background.jpg");

interface LanguageOption {
  code: string;
  label: string;
  nativeLabel?: string;
}

const languages: LanguageOption[] = [
  { code: "en", label: "languages.en", nativeLabel: "languages.en_native" },
  { code: "fil", label: "languages.fil", nativeLabel: "languages.fil_native" },
  { code: "es", label: "languages.es", nativeLabel: "languages.es_native" },
];

export default function LanguageOnboarding() {
  const { t } = useTranslation("common");
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setHeader } = useOnboardingHeader();
  const [error, setError] = useState<string | null>(null);
  const [affirmation, setAffirmation] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [dimensions, setDimensions] = useState({
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  });
  const { upsertUserProfile, upsertUserRole } = useUserData();
  const { userProfile } = useUserContext();

  useDesktopWebRedirect();

  const screenWidth = dimensions.width;
  const screenHeight = dimensions.height;
  const isWeb = Platform.OS === "web";

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
  const isSmallWeb = isWeb && screenWidth < 1280;
  const isMobile = !isWeb;

  const topMargin = isMobile
    ? 24
    : isSmallViewport
      ? isSmallWeb
        ? 8
        : 16
      : isSmallWeb
        ? 16
        : 32;

  const titleSize = isMobile ? 32 : isSmallWeb ? 26 : isSmallViewport ? 28 : 32;
  const subtitleSize = isMobile
    ? 16
    : isSmallWeb
      ? 14
      : isSmallViewport
        ? 14
        : 16;
  const buttonHeight = isMobile
    ? 48
    : isSmallWeb
      ? 52
      : isSmallViewport
        ? 50
        : 60;
  const languageButtonTextSize = isMobile ? 16 : isSmallViewport ? 15 : 16;
  const languageButtonSubTextSize = isMobile ? 13 : isSmallViewport ? 12 : 13;
  const affirmationTextSize = isMobile
    ? 16
    : isSmallWeb
      ? 15
      : isSmallViewport
        ? 16
        : 18;

  // Handle dimension changes (window resize)
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  // Load existing language preference if available
  useEffect(() => {
    if (userProfile?.preferred_language) {
      setSelectedLanguage(userProfile.preferred_language);
    }
  }, [userProfile]);

  // Generate an affirmation when a language is selected (purely local)
  useEffect(() => {
    if (selectedLanguage) {
      const userProfileData = { preferred_language: selectedLanguage };
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
  }, [selectedLanguage, fadeAnim]);

  const handleLanguageSelect = async (languageCode: string | null) => {
    setBusy(true);
    setError(null);
    try {
      // Set the language in i18n
      await setLanguage((languageCode as "en" | "fil" | "es") ?? "en");

      // Save to user profile if user is authenticated
      const { data: user } = await auth.getCurrentUser();
      if (user && languageCode) {
        // Save user profile
        const result = await upsertUserProfile({
          user_id: user.id,
          preferred_language: languageCode,
          current_step: Math.max(userProfile?.current_step || 1, 2),
          is_onboarding_complete: false,
        });

        if (!result.success) {
          console.error("Failed to save language preference:", result.error);
        }

        // Save user role as member (no UI for this)
        const roleResult = await upsertUserRole({
          user_id: user.id,
          role: "member",
        });

        if (!roleResult.success) {
          console.error("Failed to save user role:", roleResult.error);
        }
      }

      setHeader({ animation: "slide_from_right" });
      router.push("/(onboarding)/mood"); // Navigate to mood onboarding
    } catch (e: any) {
      console.error("Language update error:", e);
      setError(e?.message ?? t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const onNext = () => {
    if (selectedLanguage) {
      handleLanguageSelect(selectedLanguage);
    }
  };

  useEffect(() => {
    setHeader({
      currentStep: 1,
      totalSteps: 9,
      onNext,
      canGoBack: false,
      nextDisabled: busy || !selectedLanguage,
      backIconColor: "#ffffff",
      nextIconColor: "#ffffff",
    });
  }, [setHeader, busy, selectedLanguage]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ImageBackground
          source={bgImage}
          style={{ flex: 1, width: "100%", height: "100%" }}
          resizeMode="cover"
          imageStyle={
            Platform.OS === "web" ? { alignSelf: "flex-start" } : undefined
          }
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              alignItems: isWeb ? "center" : "stretch",
              justifyContent: "flex-start",
            }}
          >
            <View
              style={{
                flex: 1,
                width: isWeb ? "80%" : "100%",
                maxWidth: 960,
                alignSelf: "center",
              }}
            >
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                  flexGrow: 1,
                  minHeight: isWeb ? viewportHeight - 120 : undefined,
                  paddingHorizontal: isMobile ? 20 : isSmallWeb ? 16 : 24,
                  paddingTop: isMobile
                    ? 32
                    : isSmallWeb
                      ? 12
                      : isSmallViewport
                        ? 8
                        : 16,
                  paddingBottom: isMobile
                    ? 32
                    : isSmallWeb
                      ? 20
                      : isSmallViewport
                        ? 16
                        : 32,
                  justifyContent: "space-between",
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={{ marginTop: topMargin, alignItems: "center" }}>
                  <Text
                    style={{
                      fontSize: titleSize,
                      fontWeight: "bold",
                      textAlign: "center",
                      marginBottom: isMobile
                        ? 16
                        : isSmallWeb
                          ? 10
                          : isSmallViewport
                            ? 12
                            : 16,
                    }}
                  >
                    <Text style={{ color: "#fff" }}>
                      {t("app.welcome_to")}{" "}
                    </Text>
                    <Text style={{ color: "#48bb78" }}>{t("app.name")}</Text>
                  </Text>
                  <Text
                    style={{
                      color: "#e5e7eb",
                      fontSize: subtitleSize,
                      textAlign: "center",
                      lineHeight: isMobile
                        ? 20
                        : isSmallWeb
                          ? 18
                          : isSmallViewport
                            ? 20
                            : 24,
                      marginBottom: isMobile
                        ? 16
                        : isSmallWeb
                          ? 16
                          : isSmallViewport
                            ? 20
                            : 32,
                    }}
                  >
                    {t("app.description")}
                  </Text>
                </View>

                <View
                  style={{ justifyContent: "center", alignItems: "center" }}
                >
                  {error && (
                    <Text
                      style={{
                        color: "#dc2626",
                        textAlign: "center",
                        marginBottom: 16,
                      }}
                    >
                      {error}
                    </Text>
                  )}

                  <View style={{ alignItems: "center", width: "100%" }}>
                    <Text
                      style={{
                        color: "#f59e0b",
                        fontSize: isMobile
                          ? 20
                          : isSmallWeb
                            ? 17
                            : isSmallViewport
                              ? 18
                              : 20,
                        fontWeight: "600",
                        textAlign: "center",
                        marginBottom: isMobile ? 8 : isSmallWeb ? 8 : 12,
                      }}
                    >
                      {t("onboarding.chooseLanguage")}
                    </Text>
                    <Text
                      style={{
                        color: "#ffffff",
                        fontSize: subtitleSize,
                        textAlign: "center",
                        marginBottom: isMobile
                          ? 42
                          : isSmallWeb
                            ? 16
                            : isSmallViewport
                              ? 20
                              : 32,
                      }}
                    >
                      {t("onboarding.chooseLanguageDescription")}
                    </Text>

                    {languages.map((lang) => (
                      <TouchableOpacity
                        key={lang.code}
                        disabled={busy}
                        onPress={async () => {
                          setSelectedLanguage(lang.code);
                          try {
                            await setLanguage(lang.code as "en" | "fil" | "es");
                          } catch {}
                        }}
                        style={{
                          width: "90%",
                          height: buttonHeight,
                          borderRadius: 12,
                          borderWidth: 2,
                          marginBottom: isMobile
                            ? 8
                            : isSmallWeb
                              ? 8
                              : isSmallViewport
                                ? 10
                                : 12,
                          paddingHorizontal: isMobile
                            ? 12
                            : isSmallWeb
                              ? 12
                              : 16,
                          backgroundColor:
                            selectedLanguage === lang.code
                              ? "rgba(209, 250, 229, 0.8)"
                              : "rgba(248, 250, 252, 0.8)",
                          borderColor:
                            selectedLanguage === lang.code
                              ? "#059669"
                              : "#e5e7eb",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <View>
                          <Text
                            style={{
                              fontWeight: "600",
                              fontSize: languageButtonTextSize,
                              color:
                                selectedLanguage === lang.code
                                  ? "#047857"
                                  : "#0f172a",
                            }}
                          >
                            {t(lang.label)}
                          </Text>
                          {lang.nativeLabel && (
                            <Text
                              style={{
                                fontSize: languageButtonSubTextSize,
                                color:
                                  selectedLanguage === lang.code
                                    ? "#059669"
                                    : "#64748b",
                              }}
                            >
                              {t(lang.nativeLabel)}
                            </Text>
                          )}
                        </View>
                        {selectedLanguage === lang.code && (
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              backgroundColor: "#059669",
                              borderRadius: 12,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: "#fff",
                                fontWeight: "bold",
                                fontSize: 15,
                              }}
                            >
                              ✓
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}

                    {affirmation && (
                      <Animated.View
                        style={{
                          opacity: fadeAnim,
                          borderRadius: 12,
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          marginTop: isMobile
                            ? 24
                            : isSmallWeb
                              ? 12
                              : isSmallViewport
                                ? 20
                                : 32,
                          width: "90%",
                        }}
                      >
                        <Text
                          style={{
                            color: "#f59e0b",
                            fontSize: affirmationTextSize,
                            fontWeight: "500",
                            textAlign: "center",
                            lineHeight: isMobile
                              ? 20
                              : isSmallWeb
                                ? 17
                                : isSmallViewport
                                  ? 18
                                  : 20,
                          }}
                        >
                          ✨ {affirmation}
                        </Text>
                      </Animated.View>
                    )}
                  </View>
                </View>

                <View
                  style={{
                    width: "100%",
                    paddingTop: isMobile
                      ? 12
                      : isSmallWeb
                        ? 12
                        : isSmallViewport
                          ? 16
                          : 24,
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: isMobile ? 13 : subtitleSize,
                      textAlign: "center",
                      marginBottom: isMobile
                        ? 10
                        : isSmallWeb
                          ? 8
                          : isSmallViewport
                            ? 10
                            : 12,
                      fontWeight: "500",
                    }}
                  >
                    {t("onboarding.setupProfile")}
                  </Text>
                  <TouchableOpacity
                    disabled={busy || !selectedLanguage}
                    onPress={() =>
                      selectedLanguage && handleLanguageSelect(selectedLanguage)
                    }
                    style={{
                      width: "100%",
                      paddingVertical: 16,
                      borderRadius: 12,
                      backgroundColor:
                        selectedLanguage && !busy ? "#059669" : "#9ca3af",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text
                        style={{
                          color: "#ffffff",
                          fontWeight: "bold",
                          fontSize: 18,
                        }}
                      >
                        {t("onboarding.start")}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </ImageBackground>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

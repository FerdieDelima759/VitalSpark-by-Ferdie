import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "@/node_modules/react-i18next";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
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

interface GenderOption {
  code: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface AgeRangeOption {
  code: string;
  label: string;
}

const genderOptions: GenderOption[] = [
  { code: "male", label: "genders.male", icon: "male" },
  { code: "female", label: "genders.female", icon: "female" },
  {
    code: "non_binary",
    label: "genders.non_binary",
    icon: "male-female",
  },
  {
    code: "prefer_not_to_say",
    label: "genders.prefer_not_to_say",
    icon: "help-circle-outline",
  },
];

const ageRangeOptions: AgeRangeOption[] = [
  { code: "18", label: "onboarding.ageRangeBelow18" },
  { code: "18-25", label: "onboarding.ageRange18to25" },
  { code: "26-35", label: "onboarding.ageRange26to35" },
  { code: "36-45", label: "onboarding.ageRange36to45" },
  { code: "46+", label: "onboarding.ageRange46plus" },
];

export default function ProfileOnboarding() {
  const { setHeader } = useOnboardingHeader();
  const { t, i18n } = useTranslation("common");
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [selectedAgeRange, setSelectedAgeRange] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affirmation, setAffirmation] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isNicknameFocused, setIsNicknameFocused] = useState(false);
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

  // More aggressive scaling for devices < 1280
  const getScaleFactor = () => {
    if (!isWeb) return 1;
    if (screenWidth >= 1280) return 1;
    if (screenWidth >= 1024) return 0.85;
    if (screenWidth >= 768) return 0.75;
    return 0.65;
  };
  const scaleFactor = getScaleFactor();

  // Use window.innerHeight on web to account for browser chrome
  const viewportHeight =
    isWeb && typeof window !== "undefined" ? window.innerHeight : screenHeight;

  // Responsive sizing based on viewport
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

  // Preload existing user profile data
  useEffect(() => {
    if (userProfile) {
      if (userProfile.full_name) {
        setFullName(userProfile.full_name);
      }
      if (userProfile.nickname) {
        setNickname(userProfile.nickname);
      }
      if (userProfile.age_range) {
        setSelectedAgeRange(userProfile.age_range);
      }
      if (userProfile.gender) {
        setSelectedGender(userProfile.gender);
      }
    }
  }, [userProfile]);

  useEffect(() => {
    if (selectedGender && (fullName.trim() || nickname.trim())) {
      const userProfileData = {
        first_name: fullName.split(" ")[0],
        nickname: nickname,
        gender: selectedGender,
        preferred_language: i18n.language,
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
  }, [fullName, nickname, selectedGender, fadeAnim, i18n.language]);

  const handleContinue = async () => {
    if (!isValid) return;
    setBusy(true);
    setError(null);
    try {
      const { data: user } = await auth.getCurrentUser();
      if (user) {
        const result = await upsertUserProfile({
          user_id: user.id,
          full_name: fullName.trim(),
          nickname: nickname.trim(),
          age_range: selectedAgeRange || undefined,
          gender: selectedGender || undefined,
          current_step: Math.max(userProfile?.current_step || 3, 4),
          is_onboarding_complete: false,
        });

        if (!result.success) {
          console.error("Failed to save profile:", result.error);
          setError("Failed to save your profile. Please try again.");
          setBusy(false);
          return;
        }
      }

      setHeader({ animation: "slide_from_right" });
      router.push("/(onboarding)/location");
    } catch (e: any) {
      console.error("Profile save error:", e);
      setError(e?.message ?? "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setHeader({ animation: "slide_from_left" });
    router.push("/(onboarding)/mood");
  };

  const onNext = () => {
    if (isValid) handleContinue();
  };

  const isValid =
    fullName.trim().length > 0 && !!selectedAgeRange && !!selectedGender;

  useEffect(() => {
    setHeader({
      currentStep: 3,
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
                  {t("onboarding.letsGetToKnowYou")}
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
                  {t("onboarding.tellUsAboutYourself")}
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

              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: "#e5e7eb",
                    marginBottom: 8,
                    fontWeight: "600",
                  }}
                >
                  {t("onboarding.whatsYourFullName")}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderRadius: 14,
                    backgroundColor: "#18223A",
                    paddingHorizontal: 16,
                    borderWidth: 2,
                    borderColor: isNameFocused ? "#f59e0b" : "#233056",
                  }}
                >
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={isNameFocused ? "#f59e0b" : "#64748b"}
                  />
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder={t("onboarding.enterFullName")}
                    placeholderTextColor="#64748b"
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                    onFocus={() => setIsNameFocused(true)}
                    onBlur={() => setIsNameFocused(false)}
                    style={
                      {
                        flex: 1,
                        paddingLeft: 12,
                        paddingVertical: Platform.OS === "ios" ? 16 : 14,
                        fontSize: 16,
                        color: "#e5e7eb",
                        backgroundColor: "transparent",
                        ...(Platform.OS === "web" && {
                          outlineStyle: "none",
                        }),
                      } as any
                    }
                  />
                </View>
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: "#e5e7eb",
                    marginBottom: 8,
                    fontWeight: "600",
                  }}
                >
                  {t("onboarding.whatShouldWeCallYou")}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderRadius: 14,
                    backgroundColor: "#18223A",
                    paddingHorizontal: 16,
                    borderWidth: 2,
                    borderColor: isNicknameFocused ? "#f59e0b" : "#233056",
                  }}
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={20}
                    color={isNicknameFocused ? "#f59e0b" : "#64748b"}
                  />
                  <TextInput
                    value={nickname}
                    onChangeText={setNickname}
                    placeholder={t("onboarding.enterNickname")}
                    placeholderTextColor="#64748b"
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                    onFocus={() => setIsNicknameFocused(true)}
                    onBlur={() => setIsNicknameFocused(false)}
                    style={
                      {
                        flex: 1,
                        paddingLeft: 12,
                        paddingVertical: Platform.OS === "ios" ? 16 : 14,
                        fontSize: 16,
                        color: "#e5e7eb",
                        backgroundColor: "transparent",
                        ...(Platform.OS === "web" && {
                          outlineStyle: "none",
                        }),
                      } as any
                    }
                  />
                </View>
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: "#e5e7eb",
                    marginBottom: 12,
                    fontWeight: "600",
                  }}
                >
                  {t("onboarding.howOldAreYou")}
                </Text>
                <View style={{ gap: 10 }}>
                  {ageRangeOptions.map((ageRange) => (
                    <Pressable
                      key={ageRange.code}
                      onPress={() => setSelectedAgeRange(ageRange.code)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 14,
                        borderRadius: 12,
                        backgroundColor:
                          selectedAgeRange === ageRange.code
                            ? "#f59e0b20"
                            : "#18223A",
                        borderWidth: 2,
                        borderColor:
                          selectedAgeRange === ageRange.code
                            ? "#f59e0b"
                            : "#233056",
                      }}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor:
                            selectedAgeRange === ageRange.code
                              ? "#f59e0b"
                              : "#64748b",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                        }}
                      >
                        {selectedAgeRange === ageRange.code && (
                          <View
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 5,
                              backgroundColor: "#f59e0b",
                            }}
                          />
                        )}
                      </View>
                      <Text
                        style={{
                          fontSize: 15,
                          color:
                            selectedAgeRange === ageRange.code
                              ? "#f59e0b"
                              : "#e5e7eb",
                          fontWeight:
                            selectedAgeRange === ageRange.code ? "600" : "400",
                        }}
                      >
                        {t(ageRange.label)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: "#e5e7eb",
                    marginBottom: 12,
                    fontWeight: "600",
                  }}
                >
                  {t("onboarding.whatsYourGender")}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  {genderOptions.map((gender) => (
                    <TouchableOpacity
                      key={gender.code}
                      disabled={busy}
                      onPress={() => setSelectedGender(gender.code)}
                      style={{
                        width: screenWidth > 400 ? "48%" : "47%",
                        padding: 16,
                        borderRadius: 14,
                        backgroundColor:
                          selectedGender === gender.code
                            ? "#059669"
                            : "#18223A",
                        borderWidth: 2,
                        borderColor:
                          selectedGender === gender.code
                            ? "#059669"
                            : "#233056",
                        alignItems: "center",
                        justifyContent: "center",
                        ...(Platform.OS !== "web" && {
                          shadowColor:
                            selectedGender === gender.code ? "#059669" : "#000",
                          shadowOpacity:
                            selectedGender === gender.code ? 0.3 : 0.08,
                          shadowRadius: 8,
                          shadowOffset: { width: 0, height: 2 },
                          elevation: selectedGender === gender.code ? 5 : 2,
                        }),
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={gender.icon}
                        size={28}
                        color={
                          selectedGender === gender.code ? "#fff" : "#64748b"
                        }
                        style={{ marginBottom: 6 }}
                      />
                      <Text
                        style={{
                          fontWeight: "600",
                          fontSize: 13,
                          color:
                            selectedGender === gender.code ? "#fff" : "#e5e7eb",
                          textAlign: "center",
                        }}
                      >
                        {t(gender.label)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {affirmation && (
                <Animated.View
                  style={{
                    opacity: fadeAnim,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    marginBottom: 24,
                  }}
                >
                  <Text
                    style={{
                      color: "#f59e0b",
                      fontSize: 16,
                      fontWeight: "500",
                      textAlign: "center",
                      lineHeight: 20,
                    }}
                  >
                    ✨ {affirmation}
                  </Text>
                </Animated.View>
              )}

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
                  marginTop: 8,
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
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/node_modules/react-i18next";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Keyboard,
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
import { useDesktopWebRedirect } from "@/hooks/useMobileWebRedirect";
import { useUserData } from "../../hooks/useUserData";
import { useUserContext } from "../../contexts/UserContext";
import { auth } from "../../hooks/useAuth";
import { generateDietaryAffirmations } from "../../lib/huggingface";

interface DietaryPreferenceOption {
  code: string;
  label: string;
}

interface HealthConditionOption {
  code: string;
  label: string;
}

const dietaryPreferenceOptions: DietaryPreferenceOption[] = [
  { code: "vegan", label: "dietaryPreferences.vegan" },
  { code: "keto", label: "dietaryPreferences.keto" },
  { code: "paleo", label: "dietaryPreferences.paleo" },
  { code: "mediterranean", label: "dietaryPreferences.mediterranean" },
  { code: "balanced", label: "dietaryPreferences.balanced" },
  { code: "glutenFree", label: "dietaryPreferences.glutenFree" },
  { code: "flexitarian", label: "dietaryPreferences.flexitarian" },
  { code: "filipinoHeritage", label: "dietaryPreferences.filipinoHeritage" },
];

const healthConditionOptions: HealthConditionOption[] = [
  { code: "acidReflux", label: "healthConditions.acidReflux" },
  { code: "highBloodPressure", label: "healthConditions.highBloodPressure" },
  { code: "diabetes", label: "healthConditions.diabetes" },
  { code: "other", label: "healthConditions.other" },
];

const weekDays = [
  { code: "monday", label: "weekDays.monday" },
  { code: "tuesday", label: "weekDays.tuesday" },
  { code: "wednesday", label: "weekDays.wednesday" },
  { code: "thursday", label: "weekDays.thursday" },
  { code: "friday", label: "weekDays.friday" },
  { code: "saturday", label: "weekDays.saturday" },
  { code: "sunday", label: "weekDays.sunday" },
];

export default function DietaryOnboarding() {
  const { t, i18n } = useTranslation("common");
  const { setHeader } = useOnboardingHeader();
  const [selectedDietaryPreference, setSelectedDietaryPreference] = useState<
    string | null
  >(null);
  const [weeklyBudget, setWeeklyBudget] = useState(50);
  const [currency] = useState({ currency: "USD", symbol: "$" });
  const [selectedMealPlanDays, setSelectedMealPlanDays] = useState<string[]>(
    []
  );
  const [selectedHealthConditions, setSelectedHealthConditions] = useState<
    string[]
  >([]);
  const [otherHealthConditions, setOtherHealthConditions] = useState<string[]>(
    []
  );
  const [currentOtherCondition, setCurrentOtherCondition] = useState("");
  const [showDietaryPreferenceDropdown, setShowDietaryPreferenceDropdown] =
    useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affirmation, setAffirmation] = useState<string | null>(null);
  const [showAffirmation, setShowAffirmation] = useState(false);
  const [firstHealthConditionSelected, setFirstHealthConditionSelected] =
    useState(false);
  const [loading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const affirmationDelayTimer = useRef<NodeJS.Timeout | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [customConditionInputY, setCustomConditionInputY] = useState(0);
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
  const isMobile = !isWeb;

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

  const topMargin = isMobile
    ? 0
    : isSmallViewport
      ? isSmallWeb
        ? 8
        : 16
      : isSmallWeb
        ? 16
        : 32;

  const titleSize = isMobile ? 28 : isSmallWeb ? 24 : isSmallViewport ? 22 : 28;
  const subtitleSize = isMobile
    ? 15
    : isSmallWeb
      ? 14
      : isSmallViewport
        ? 14
        : 16;

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (userProfile) {
      if (userProfile.dietary_preference) {
        setSelectedDietaryPreference(userProfile.dietary_preference);
      }
      if (userProfile.weekly_budget) {
        setWeeklyBudget(userProfile.weekly_budget);
      }
      if (
        userProfile.meal_plan_duration &&
        userProfile.meal_plan_duration.length > 0
      ) {
        setSelectedMealPlanDays(userProfile.meal_plan_duration);
      }
      if (
        userProfile.health_conditions &&
        userProfile.health_conditions.length > 0
      ) {
        const standardConditions = healthConditionOptions.map((c) => c.code);
        const standard = userProfile.health_conditions.filter((c) =>
          standardConditions.includes(c)
        );
        const custom = userProfile.health_conditions.filter(
          (c) => !standardConditions.includes(c)
        );

        setSelectedHealthConditions(
          custom.length > 0 ? [...standard, "other"] : standard
        );
        if (custom.length > 0) {
          setOtherHealthConditions(custom);
        }
      }
    }
  }, [userProfile]);

  const handleHealthConditionSelection = (conditionCode: string) => {
    setSelectedHealthConditions((prev) =>
      prev.includes(conditionCode)
        ? prev.filter((c) => c !== conditionCode)
        : [...prev, conditionCode]
    );
  };

  const addCustomHealthCondition = () => {
    if (
      currentOtherCondition.trim() &&
      !otherHealthConditions.includes(currentOtherCondition.trim())
    ) {
      setOtherHealthConditions((prev) => [
        ...prev,
        currentOtherCondition.trim(),
      ]);
      setCurrentOtherCondition("");
    }
  };

  const removeCustomHealthCondition = (condition: string) => {
    setOtherHealthConditions((prev) => prev.filter((c) => c !== condition));
  };

  const generateDietaryAffirmation = () => {
    const selectedConditionsList = [
      ...selectedHealthConditions.filter((c) => c !== "other"),
      ...(selectedHealthConditions.includes("other")
        ? otherHealthConditions
        : []),
    ];

    const userProfileData = {
      dietary_preference: selectedDietaryPreference || undefined,
      weekly_budget: weeklyBudget,
      currency: currency.currency,
      meal_plan_duration: selectedMealPlanDays.join(",") || undefined,
      health_conditions: selectedConditionsList,
      preferred_language: i18n.language,
      has_health_conditions: selectedConditionsList.length > 0,
      is_budget_conscious: weeklyBudget <= 30,
      has_dietary_restrictions: selectedDietaryPreference !== "balanced",
      prefers_cultural_food: selectedDietaryPreference === "filipinoHeritage",
    };

    const affs = generateDietaryAffirmations(userProfileData);
    const chosen = affs?.[0] ?? null;

    if (chosen) {
      setAffirmation(chosen);
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }
  };

  useEffect(() => {
    if (selectedHealthConditions.length > 0 && !firstHealthConditionSelected) {
      setFirstHealthConditionSelected(true);
      setShowAffirmation(false);
      if (affirmationDelayTimer.current)
        clearTimeout(affirmationDelayTimer.current);

      affirmationDelayTimer.current = setTimeout(() => {
        setShowAffirmation(true);
        generateDietaryAffirmation();
      }, 150) as any;
    }

    if (selectedHealthConditions.length === 0) {
      setFirstHealthConditionSelected(false);
      setShowAffirmation(false);
      if (affirmationDelayTimer.current)
        clearTimeout(affirmationDelayTimer.current);
      setAffirmation(null);
    }

    return () => {
      if (affirmationDelayTimer.current)
        clearTimeout(affirmationDelayTimer.current);
    };
  }, [selectedHealthConditions]);

  const handleContinue = async () => {
    if (!isValid) return;
    setBusy(true);
    setError(null);
    try {
      const { data: user } = await auth.getCurrentUser();
      if (user) {
        const healthConditionsList = [
          ...selectedHealthConditions.filter((c) => c !== "other"),
          ...(selectedHealthConditions.includes("other")
            ? otherHealthConditions
            : []),
        ];

        const result = await upsertUserProfile({
          user_id: user.id,
          dietary_preference: selectedDietaryPreference || undefined,
          weekly_budget: weeklyBudget,
          weekly_budget_currency: currency.currency,
          meal_plan_duration: selectedMealPlanDays,
          health_conditions: healthConditionsList,
          current_step: Math.max(userProfile?.current_step || 9, 10),
          is_onboarding_complete: false,
        });

        if (!result.success) {
          console.error("Failed to save dietary data:", result.error);
          setError(
            "Failed to save your dietary preferences. Please try again."
          );
          setBusy(false);
          return;
        }
      }

      setHeader({ animation: "slide_from_right" });
      router.push("/(onboarding)/finish" as any);
    } catch (e: any) {
      console.error("Dietary save error:", e);
      setError(e?.message ?? "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setHeader({ animation: "slide_from_left" });
    router.push("/(onboarding)/target-muscle-group");
  };

  const onNext = () => {
    if (isValid) handleContinue();
  };

  const isValid =
    !!selectedDietaryPreference && selectedMealPlanDays.length > 0;

  useEffect(() => {
    setHeader({
      currentStep: 9,
      totalSteps: 9,
      onBack,
      onNext,
      nextDisabled: busy || !isValid,
      backIconColor: "#ffffff",
      nextIconColor: "#ffffff",
    });
  }, [setHeader, busy, isValid]);

  const renderForm = () => (
    <View style={{ flexGrow: 1, flex: 1 }}>
      {loading ? (
        <View style={{ alignItems: "center", marginVertical: 40 }}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={{ color: "#e5e7eb", marginTop: 12, fontSize: 16 }}>
            {t("common.loading")}
          </Text>
        </View>
      ) : (
        <>
          <View style={{ marginBottom: isMobile ? 24 : 32 }}>
            <Text
              style={{
                color: "#ffffff",
                fontSize: subtitleSize,
                fontWeight: "500",
                marginBottom: 12,
                letterSpacing: 0.3,
              }}
            >
              {t("onboarding.dietaryPreference")}
            </Text>
            <View style={{ position: "relative", zIndex: 10 }}>
              <TouchableOpacity
                onPress={() =>
                  setShowDietaryPreferenceDropdown(
                    !showDietaryPreferenceDropdown
                  )
                }
                style={{
                  width: "100%",
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderRadius: 14,
                  backgroundColor: "#18223A",
                  borderWidth: 1,
                  borderColor: selectedDietaryPreference
                    ? "#f59e0b"
                    : "#374151",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: selectedDietaryPreference ? "#e5e7eb" : "#9ca3af",
                    fontSize: isMobile ? 15 : 16,
                    flex: 1,
                  }}
                >
                  {selectedDietaryPreference
                    ? t(
                        dietaryPreferenceOptions.find(
                          (o) => o.code === selectedDietaryPreference
                        )?.label || ""
                      )
                    : t("onboarding.selectDietaryPreference")}
                </Text>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 16,
                    transform: [
                      {
                        rotate: showDietaryPreferenceDropdown
                          ? "180deg"
                          : "0deg",
                      },
                    ],
                  }}
                >
                  ▼
                </Text>
              </TouchableOpacity>

              {showDietaryPreferenceDropdown && (
                <View
                  style={{
                    backgroundColor: "#18223A",
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#374151",
                    marginTop: 4,
                    overflow: "hidden",
                    zIndex: 1000,
                    ...(Platform.OS !== "web" && {
                      elevation: 10,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                    }),
                  }}
                >
                  {dietaryPreferenceOptions.map((option, index) => (
                    <Pressable
                      key={option.code}
                      onPress={() => {
                        setSelectedDietaryPreference(option.code);
                        setShowDietaryPreferenceDropdown(false);
                      }}
                      style={{
                        paddingHorizontal: isMobile ? 16 : 20,
                        paddingVertical: isMobile ? 12 : 16,
                        borderBottomWidth:
                          index < dietaryPreferenceOptions.length - 1 ? 1 : 0,
                        borderBottomColor: "#374151",
                      }}
                    >
                      <Text
                        style={{
                          color:
                            selectedDietaryPreference === option.code
                              ? "#f59e0b"
                              : "#e5e7eb",
                          fontSize: isMobile ? 14 : 16,
                          fontWeight:
                            selectedDietaryPreference === option.code
                              ? "600"
                              : "400",
                        }}
                      >
                        {t(option.label)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Weekly Budget */}
          <View style={{ marginBottom: isMobile ? 24 : 32 }}>
            <Text
              style={{
                color: "#ffffff",
                fontSize: subtitleSize,
                fontWeight: "500",
                marginBottom: 12,
                letterSpacing: 0.3,
              }}
            >
              {t("onboarding.weeklyBudget")}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{
                  color: "#e5e7eb",
                  fontSize: 18,
                  fontWeight: "600",
                  marginRight: 8,
                }}
              >
                {currency.symbol}
              </Text>
              <TextInput
                style={
                  {
                    flex: 1,
                    marginRight: 8,
                    paddingHorizontal: 20,
                    paddingVertical: isMobile ? 12 : 14,
                    borderRadius: 14,
                    backgroundColor: "#18223A",
                    color: "#e5e7eb",
                    fontSize: isMobile ? 15 : 16,
                    borderWidth: 1,
                    borderColor: "#374151",
                    textAlign: "right",
                    ...(Platform.OS === "web" && {
                      outlineStyle: "none",
                    }),
                  } as any
                }
                keyboardType="numeric"
                value={weeklyBudget.toString()}
                onChangeText={(val) => {
                  const num = parseInt(val.replace(/[^0-9]/g, ""), 10);
                  setWeeklyBudget(isNaN(num) ? 0 : num);
                }}
                placeholder={t("onboarding.weeklyBudget")}
                placeholderTextColor="#9ca3af"
                maxLength={6}
              />
              <Text
                style={{
                  color: "#e5e7eb",
                  fontSize: 16,
                  marginLeft: 2,
                }}
              >
                {currency.currency}
              </Text>
            </View>
          </View>

          {/* Meal Plan Duration (select days) */}
          <View style={{ marginBottom: isMobile ? 24 : 32 }}>
            <Text
              style={{
                color: "#ffffff",
                fontSize: subtitleSize,
                fontWeight: "500",
                marginBottom: 12,
                letterSpacing: 0.3,
              }}
            >
              {t("onboarding.mealPlanDuration")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 12,
              }}
            >
              {weekDays.map((day) => (
                <TouchableOpacity
                  key={day.code}
                  onPress={() =>
                    setSelectedMealPlanDays((prev) =>
                      prev.includes(day.code)
                        ? prev.filter((d) => d !== day.code)
                        : [...prev, day.code]
                    )
                  }
                  style={{
                    paddingHorizontal: isMobile ? 12 : 16,
                    paddingVertical: isMobile ? 10 : 12,
                    borderRadius: 12,
                    borderWidth: 2,
                    minWidth: 48,
                    alignItems: "center",
                    marginBottom: 8,
                    borderColor: selectedMealPlanDays.includes(day.code)
                      ? "#f59e0b"
                      : "#374151",
                    backgroundColor: selectedMealPlanDays.includes(day.code)
                      ? "#f59e0b22"
                      : "#18223A",
                  }}
                >
                  <Text
                    style={{
                      fontSize: isMobile ? 13 : 14,
                      fontWeight: "600",
                      color: selectedMealPlanDays.includes(day.code)
                        ? "#f59e0b"
                        : "#e5e7eb",
                    }}
                  >
                    {t(day.label)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Health Conditions */}
          <View style={{ marginBottom: isMobile ? 24 : 32 }}>
            <Text
              style={{
                color: "#ffffff",
                fontSize: subtitleSize,
                fontWeight: "500",
                marginBottom: 12,
                letterSpacing: 0.3,
              }}
            >
              {t("onboarding.healthConditionsTitle")}
            </Text>
            <Text
              style={{
                color: "#9ca3af",
                fontSize: isMobile ? 13 : 14,
                marginBottom: 16,
              }}
            >
              {t("onboarding.healthConditionsSubtitle")}
            </Text>
            {healthConditionOptions.map((option) => (
              <TouchableOpacity
                key={option.code}
                onPress={() => handleHealthConditionSelection(option.code)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 8,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 2,
                    marginRight: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    borderColor: selectedHealthConditions.includes(option.code)
                      ? "#f59e0b"
                      : "#9ca3af",
                    backgroundColor: selectedHealthConditions.includes(
                      option.code
                    )
                      ? "#f59e0b"
                      : "transparent",
                  }}
                >
                  {selectedHealthConditions.includes(option.code) && (
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
                    fontSize: isMobile ? 15 : 16,
                    flex: 1,
                    color: selectedHealthConditions.includes(option.code)
                      ? "#e5e7eb"
                      : "#9ca3af",
                  }}
                >
                  {t(option.label)}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Custom health conditions */}
            {selectedHealthConditions.includes("other") && (
              <View
                style={{ marginTop: 16 }}
                onLayout={(event) => {
                  const { y } = event.nativeEvent.layout;
                  setCustomConditionInputY(y);
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TextInput
                    style={
                      {
                        flex: 1,
                        marginRight: 12,
                        paddingHorizontal: 20,
                        paddingVertical: isMobile ? 12 : 14,
                        borderRadius: 14,
                        backgroundColor: "#18223A",
                        color: "#e5e7eb",
                        fontSize: isMobile ? 15 : 16,
                        borderWidth: 1,
                        borderColor: "#374151",
                        ...(Platform.OS === "web" && {
                          outlineStyle: "none",
                        }),
                      } as any
                    }
                    placeholder={t("onboarding.specifyOtherCondition")}
                    placeholderTextColor="#9ca3af"
                    value={currentOtherCondition}
                    onChangeText={setCurrentOtherCondition}
                    onSubmitEditing={addCustomHealthCondition}
                    returnKeyType="done"
                    onFocus={() => {
                      if (Platform.OS !== "web" && customConditionInputY > 0) {
                        setTimeout(() => {
                          scrollViewRef.current?.scrollTo({
                            y: customConditionInputY - 150,
                            animated: true,
                          });
                        }, 300);
                      }
                    }}
                  />
                  <TouchableOpacity
                    onPress={addCustomHealthCondition}
                    style={{
                      backgroundColor: currentOtherCondition.trim()
                        ? "#f59e0b"
                        : "#374151",
                      borderRadius: 8,
                      paddingHorizontal: 16,
                      paddingVertical: 16,
                    }}
                    disabled={!currentOtherCondition.trim()}
                  >
                    <Text
                      style={{
                        color: currentOtherCondition.trim()
                          ? "#000"
                          : "#9ca3af",
                        fontWeight: "600",
                      }}
                    >
                      +
                    </Text>
                  </TouchableOpacity>
                </View>
                {otherHealthConditions.map((condition, index) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "#18223A",
                      padding: 12,
                      borderRadius: 12,
                      marginTop: 8,
                      borderWidth: 1,
                      borderColor: "#f59e0b",
                    }}
                  >
                    <Text
                      style={{
                        color: "#e5e7eb",
                        flex: 1,
                        fontSize: isMobile ? 15 : 16,
                      }}
                    >
                      {condition}
                    </Text>
                    <TouchableOpacity
                      onPress={() => removeCustomHealthCondition(condition)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: "#ef4444",
                        alignItems: "center",
                        justifyContent: "center",
                        marginLeft: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 16,
                          fontWeight: "700",
                          lineHeight: 20,
                        }}
                      >
                        ✕
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {affirmation &&
            showAffirmation &&
            selectedHealthConditions.length > 0 && (
              <Animated.View
                style={{
                  opacity: fadeAnim,
                  marginBottom: isMobile ? 24 : 32,
                  paddingHorizontal: isMobile ? 16 : 20,
                  paddingVertical: isMobile ? 12 : 16,
                }}
              >
                <Text
                  style={{
                    color: "#f59e0b",
                    fontSize: isMobile ? 15 : 16,
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
            style={{
              width: "100%",
              paddingVertical: isMobile ? 16 : 18,
              borderRadius: 14,
              backgroundColor: isValid && !busy ? "#059669" : "#d1d5db",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 16,
              marginBottom: 24,
              ...(Platform.OS !== "web" && {
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }),
            }}
            onPress={handleContinue}
            disabled={!isValid || busy}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "700",
                  fontSize: isMobile ? 17 : 18,
                  textAlign: "center",
                }}
              >
                {t("onboarding.continue")}
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#101A2C" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
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
                paddingTop: isMobile ? 32 : isSmallWeb ? 12 : 16,
                paddingBottom: isMobile ? 32 : isSmallWeb ? 20 : 32,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
              nestedScrollEnabled={true}
            >
              <Pressable
                onPress={() => setShowDietaryPreferenceDropdown(false)}
                style={{ flexGrow: 1, flex: 1 }}
              >
                <View style={{ marginTop: topMargin, marginBottom: 32 }}>
                  <Text
                    style={{
                      color: "#f59e0b",
                      fontSize: titleSize,
                      fontWeight: "700",
                      textAlign: "center",
                      marginBottom: isMobile ? 8 : 10,
                      letterSpacing: 0.5,
                    }}
                  >
                    {t("onboarding.dietaryPreferences")}
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
                    {t("onboarding.helpUsPersonalizeMealPlanning")}
                  </Text>
                </View>
                {error && (
                  <Text
                    style={{
                      color: "#ef4444",
                      fontSize: isMobile ? 13 : 14,
                      textAlign: "center",
                      marginBottom: 16,
                    }}
                  >
                    {error}
                  </Text>
                )}
                {renderForm()}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

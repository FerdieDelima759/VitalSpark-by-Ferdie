import Slider from "@react-native-community/slider";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/node_modules/react-i18next";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOnboardingHeader } from "../../contexts/OnboardingHeaderContext";
import { generateFitnessAffirmations } from "../../lib/huggingface";
import { useDesktopWebRedirect } from "@/hooks/useMobileWebRedirect";
import { useUserData } from "../../hooks/useUserData";
import { useUserContext } from "../../contexts/UserContext";
import { auth } from "../../hooks/useAuth";

interface FitnessGoalOption {
  code: string;
  label: string;
}

interface FitnessLevelOption {
  code: string;
  label: string;
}

interface WorkoutLocationOption {
  code: string;
  label: string;
}

interface EquipmentOption {
  code: string;
  label: string;
}

interface WeekDay {
  code: string;
  label: string;
  selected: boolean;
}

const fitnessGoalOptions: FitnessGoalOption[] = [
  { code: "loseWeight", label: "fitnessGoals.loseWeight" },
  { code: "buildMuscle", label: "fitnessGoals.buildMuscle" },
  {
    code: "improveCardiovascular",
    label: "fitnessGoals.improveCardiovascular",
  },
  { code: "increaseStrength", label: "fitnessGoals.increaseStrength" },
  { code: "enhanceFlexibility", label: "fitnessGoals.enhanceFlexibility" },
  { code: "buildStrength", label: "fitnessGoals.buildStrength" },
  { code: "getToned", label: "fitnessGoals.getToned" },
  { code: "getLean", label: "fitnessGoals.getLean" },
  { code: "mobility", label: "fitnessGoals.mobility" },
  { code: "endurance", label: "fitnessGoals.endurance" },
  { code: "bodyBuilding", label: "fitnessGoals.bodyBuilding" },
  { code: "stayHealthy", label: "fitnessGoals.stayHealthy" },
];

const fitnessLevelOptions: FitnessLevelOption[] = [
  { code: "beginner", label: "fitnessLevels.beginner" },
  { code: "intermediate", label: "fitnessLevels.intermediate" },
  { code: "advanced", label: "fitnessLevels.advanced" },
];

const workoutLocationOptions: WorkoutLocationOption[] = [
  { code: "home", label: "workoutLocations.home" },
  { code: "gym", label: "workoutLocations.gym" },
];

const homeEquipmentOptions: EquipmentOption[] = [
  { code: "none", label: "equipments.none" },
  { code: "dumbbells", label: "equipments.dumbbells" },
  { code: "resistanceBands", label: "equipments.resistanceBands" },
  { code: "pullUpBar", label: "equipments.pullUpBar" },
  { code: "yogaMat", label: "equipments.yogaMat" },
  { code: "kettleBells", label: "equipments.kettleBells" },
  { code: "barBell", label: "equipments.barBell" },
  { code: "treadmill", label: "equipments.treadmill" },
  { code: "jumpingRope", label: "equipments.jumpingRope" },
  { code: "other", label: "equipments.other" },
];

const gymEquipmentOptions: EquipmentOption[] = [
  { code: "fullGymAccess", label: "equipments.fullGymAccess" },
];

export default function FitnessOnboarding() {
  const { t, i18n } = useTranslation("common");
  const { setHeader } = useOnboardingHeader();
  const [selectedFitnessGoal, setSelectedFitnessGoal] = useState<string | null>(
    null
  );
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>([]);
  const [otherEquipments, setOtherEquipments] = useState<string[]>([]);
  const [currentOtherEquipment, setCurrentOtherEquipment] = useState("");
  const [workoutDuration, setWorkoutDuration] = useState(30);
  const [weeklyFrequency, setWeeklyFrequency] = useState<WeekDay[]>([
    { code: "monday", label: "weekDays.monday", selected: false },
    { code: "tuesday", label: "weekDays.tuesday", selected: false },
    { code: "wednesday", label: "weekDays.wednesday", selected: false },
    { code: "thursday", label: "weekDays.thursday", selected: false },
    { code: "friday", label: "weekDays.friday", selected: false },
    { code: "saturday", label: "weekDays.saturday", selected: false },
    { code: "sunday", label: "weekDays.sunday", selected: false },
  ]);
  const [showFitnessGoalDropdown, setShowFitnessGoalDropdown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affirmation, setAffirmation] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [loading] = useState(false);
  const [affirmationTimer, setAffirmationTimer] =
    useState<NodeJS.Timeout | null>(null);
  const [affirmationGenerated, setAffirmationGenerated] =
    useState<boolean>(false);
  const [dimensions, setDimensions] = useState({
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  });
  const { upsertUserProfile } = useUserData();
  const { userProfile } = useUserContext();
  const scrollViewRef = useRef<ScrollView>(null);
  const [customEquipmentInputY, setCustomEquipmentInputY] = useState(0);

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

  // Preload existing fitness data
  useEffect(() => {
    if (userProfile) {
      if (userProfile.fitness_goal) {
        setSelectedFitnessGoal(userProfile.fitness_goal);
      }
      if (userProfile.fitness_level) {
        setSelectedLevel(userProfile.fitness_level);
      }
      if (userProfile.workout_location) {
        setSelectedLocation(userProfile.workout_location);
      }
      if (userProfile.equipment_list && userProfile.equipment_list.length > 0) {
        const standardEquipment = homeEquipmentOptions
          .map((eq) => eq.code)
          .concat(gymEquipmentOptions.map((eq) => eq.code));

        const standard = userProfile.equipment_list.filter((eq) =>
          standardEquipment.includes(eq)
        );
        const custom = userProfile.equipment_list.filter(
          (eq) => !standardEquipment.includes(eq)
        );

        setSelectedEquipments(
          custom.length > 0 ? [...standard, "other"] : standard
        );
        if (custom.length > 0) {
          setOtherEquipments(custom);
        }
      }
      if (userProfile.workout_duration_minutes) {
        setWorkoutDuration(userProfile.workout_duration_minutes);
      }
      if (
        userProfile.weekly_frequency &&
        userProfile.weekly_frequency.length > 0
      ) {
        setWeeklyFrequency((prev) =>
          prev.map((day) => ({
            ...day,
            selected: userProfile.weekly_frequency?.includes(day.code) || false,
          }))
        );
      }
    }
  }, [userProfile]);

  useEffect(() => {
    const hasSelectedDays = weeklyFrequency.some((d) => d.selected);
    if (!hasSelectedDays) {
      setAffirmation(null);
      fadeAnim.setValue(0);
      setAffirmationGenerated(false);
    }
  }, [
    selectedFitnessGoal,
    selectedLevel,
    selectedLocation,
    selectedEquipments,
    otherEquipments,
    workoutDuration,
    weeklyFrequency,
    i18n.language,
  ]);

  const generateLocalAffirmation = () => {
    const selectedDays = weeklyFrequency.filter((d) => d.selected).length;
    const equipmentList = [
      ...selectedEquipments.filter((eq) => eq !== "other"),
      ...(selectedEquipments.includes("other") ? otherEquipments : []),
    ];

    const userProfile = {
      fitness_goal: selectedFitnessGoal || "",
      fitness_level: selectedLevel || "",
      workout_location: selectedLocation || "",
      equipment_list: equipmentList,
      workout_duration: workoutDuration,
      weekly_frequency: selectedDays,
      selected_days: weeklyFrequency
        .filter((d) => d.selected)
        .map((d) => d.code),
      preferred_language: i18n.language,
      has_equipment:
        equipmentList.length > 0 && !equipmentList.includes("none"),
      is_beginner: selectedLevel === "beginner",
      works_out_at_home: selectedLocation === "home",
      high_frequency: selectedDays >= 5,
      short_workouts: workoutDuration <= 30,
      long_workouts: workoutDuration >= 60,
    };

    const msgs = generateFitnessAffirmations(userProfile);
    const chosen = msgs?.[0] ?? null;

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

  const handleEquipmentSelection = (equipmentCode: string) => {
    setSelectedEquipments((prev) => {
      if (equipmentCode === "none") {
        if (prev.includes("none")) {
          return prev.filter((eq) => eq !== "none");
        } else {
          setOtherEquipments([]);
          setCurrentOtherEquipment("");
          return ["none"];
        }
      } else {
        const withoutNone = prev.filter((eq) => eq !== "none");
        if (withoutNone.includes(equipmentCode)) {
          return withoutNone.filter((eq) => eq !== equipmentCode);
        } else {
          return [...withoutNone, equipmentCode];
        }
      }
    });
  };

  const handleWeeklyFrequencyToggle = (dayCode: string) => {
    const hadAnyDaySelected = weeklyFrequency.some((d) => d.selected);
    const isSelectingNewDay = !weeklyFrequency.find((d) => d.code === dayCode)
      ?.selected;

    setWeeklyFrequency((prev) =>
      prev.map((d) =>
        d.code === dayCode ? { ...d, selected: !d.selected } : d
      )
    );

    if (isSelectingNewDay && !hadAnyDaySelected && !affirmationGenerated) {
      if (affirmationTimer) clearTimeout(affirmationTimer);

      const timer = setTimeout(() => {
        try {
          const texts = generateFitnessAffirmations({
            fitness_goal: selectedFitnessGoal || "",
            fitness_level: selectedLevel || "",
            workout_location: selectedLocation || "",
            current_mood: "excited",
          });

          setAffirmation(texts?.[0] || null);
          setAffirmationGenerated(true);
          fadeAnim.setValue(0);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }).start();
        } catch (e) {}
      }, 2000);

      setAffirmationTimer(timer as any);
    }
  };

  const addCustomEquipment = () => {
    if (
      currentOtherEquipment.trim() &&
      !otherEquipments.includes(currentOtherEquipment.trim())
    ) {
      setOtherEquipments((prev) => [...prev, currentOtherEquipment.trim()]);
      setCurrentOtherEquipment("");
    }
  };

  const removeCustomEquipment = (equipment: string) => {
    setOtherEquipments((prev) => prev.filter((eq) => eq !== equipment));
  };

  const handleContinue = async () => {
    if (!isValid) return;
    setBusy(true);
    setError(null);
    try {
      if (!affirmation) generateLocalAffirmation();

      const { data: user } = await auth.getCurrentUser();
      if (user) {
        const equipmentList = [
          ...selectedEquipments.filter((eq) => eq !== "other"),
          ...(selectedEquipments.includes("other") ? otherEquipments : []),
        ];

        const selectedDays = weeklyFrequency
          .filter((d) => d.selected)
          .map((d) => d.code);

        const result = await upsertUserProfile({
          user_id: user.id,
          fitness_goal: selectedFitnessGoal || undefined,
          fitness_level: selectedLevel || undefined,
          workout_location: selectedLocation || undefined,
          equipment_list: equipmentList,
          workout_duration_minutes: workoutDuration,
          weekly_frequency: selectedDays,
          current_step: Math.max(userProfile?.current_step || 7, 8),
          is_onboarding_complete: false,
        });

        if (!result.success) {
          console.error("Failed to save fitness data:", result.error);
          setError(
            "Failed to save your fitness preferences. Please try again."
          );
          setBusy(false);
          return;
        }
      }

      setHeader({ animation: "slide_from_right" });
      router.push("/(onboarding)/target-muscle-group");
    } catch (e: any) {
      console.error("Fitness save error:", e);
      setError(e?.message ?? "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setHeader({ animation: "slide_from_left" });
    router.push("/(onboarding)/weight");
  };

  const isValid =
    !!selectedFitnessGoal &&
    !!selectedLevel &&
    !!selectedLocation &&
    weeklyFrequency.some((d) => d.selected) &&
    (selectedLocation === "gym" ||
      (selectedEquipments.length > 0 &&
        (!selectedEquipments.includes("other") || otherEquipments.length > 0)));

  const equipmentOptions =
    selectedLocation === "home" ? homeEquipmentOptions : gymEquipmentOptions;

  useEffect(() => {
    setHeader({
      currentStep: 7,
      totalSteps: 9,
      onBack,
      onNext: () => isValid && handleContinue(),
      nextDisabled: busy || !isValid,
      backIconColor: "#ffffff",
      nextIconColor: "#ffffff",
    });
  }, [setHeader, busy, isValid]);

  useEffect(() => {
    return () => {
      if (affirmationTimer) clearTimeout(affirmationTimer);
    };
  }, [affirmationTimer]);

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
          <View
            style={{
              marginBottom: showFitnessGoalDropdown ? 0 : isMobile ? 24 : 32,
            }}
          >
            <Text style={[styles.sectionLabel, { fontSize: subtitleSize }]}>
              {t("onboarding.fitnessGoal")}
            </Text>
            <View
              style={{
                position: "relative",
                zIndex: 10,
              }}
            >
              <TouchableOpacity
                onPress={() =>
                  setShowFitnessGoalDropdown(!showFitnessGoalDropdown)
                }
                disabled={busy}
                style={[
                  styles.dropdown,
                  { borderColor: selectedFitnessGoal ? "#f59e0b" : "#374151" },
                ]}
              >
                <Text
                  style={{
                    fontSize: isMobile ? 15 : 16,
                    color: selectedFitnessGoal ? "#e5e7eb" : "#9ca3af",
                  }}
                >
                  {selectedFitnessGoal
                    ? t(
                        fitnessGoalOptions.find(
                          (g) => g.code === selectedFitnessGoal
                        )?.label || ""
                      )
                    : t("onboarding.selectFitnessGoal")}
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    color: "#9ca3af",
                    transform: [
                      {
                        rotate: showFitnessGoalDropdown ? "180deg" : "0deg",
                      },
                    ],
                  }}
                >
                  ▼
                </Text>
              </TouchableOpacity>

              {showFitnessGoalDropdown && (
                <View
                  style={[
                    styles.dropdownOptions,
                    { marginBottom: isMobile ? 16 : 24 },
                  ]}
                >
                  {fitnessGoalOptions.map((goal, index) => (
                    <Pressable
                      key={goal.code}
                      onPress={() => {
                        setSelectedFitnessGoal(goal.code);
                        setShowFitnessGoalDropdown(false);
                      }}
                      style={[
                        styles.dropdownOption,
                        {
                          borderBottomWidth:
                            index < fitnessGoalOptions.length - 1 ? 1 : 0,
                          paddingHorizontal: isMobile ? 16 : 20,
                          paddingVertical: isMobile ? 12 : 16,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: isMobile ? 14 : 16,
                          color:
                            selectedFitnessGoal === goal.code
                              ? "#f59e0b"
                              : "#e5e7eb",
                          fontWeight:
                            selectedFitnessGoal === goal.code ? "600" : "400",
                        }}
                      >
                        {t(goal.label)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Level */}
          <View style={{ marginBottom: isMobile ? 24 : 32 }}>
            <Text style={[styles.sectionLabel, { fontSize: subtitleSize }]}>
              {t("onboarding.level")}
            </Text>
            <View style={{ gap: isMobile ? 10 : 12 }}>
              {fitnessLevelOptions.map((level) => (
                <TouchableOpacity
                  key={level.code}
                  disabled={busy}
                  onPress={() => setSelectedLevel(level.code)}
                  style={styles.radioOption}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.radioButton,
                      {
                        borderColor:
                          selectedLevel === level.code ? "#f59e0b" : "#374151",
                      },
                    ]}
                  >
                    {selectedLevel === level.code && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.radioText,
                      {
                        color:
                          selectedLevel === level.code ? "#f59e0b" : "#e5e7eb",
                        fontSize: isMobile ? 15 : 16,
                      },
                    ]}
                  >
                    {t(level.label)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Location */}
          <View style={{ marginBottom: isMobile ? 24 : 32 }}>
            <Text style={[styles.sectionLabel, { fontSize: subtitleSize }]}>
              {t("onboarding.workoutLocation")}
            </Text>
            <View style={{ gap: isMobile ? 10 : 12 }}>
              {workoutLocationOptions.map((location) => (
                <TouchableOpacity
                  key={location.code}
                  disabled={busy}
                  onPress={() => {
                    setSelectedLocation(location.code);
                    setSelectedEquipments([]);
                    setOtherEquipments([]);
                    setCurrentOtherEquipment("");
                  }}
                  style={styles.radioOption}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.radioButton,
                      {
                        borderColor:
                          selectedLocation === location.code
                            ? "#f59e0b"
                            : "#374151",
                      },
                    ]}
                  >
                    {selectedLocation === location.code && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.radioText,
                      {
                        color:
                          selectedLocation === location.code
                            ? "#f59e0b"
                            : "#e5e7eb",
                        fontSize: isMobile ? 15 : 16,
                      },
                    ]}
                  >
                    {t(location.label)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Equipment */}
          {selectedLocation && (
            <View style={{ marginBottom: isMobile ? 24 : 32 }}>
              <Text style={[styles.sectionLabel, { fontSize: subtitleSize }]}>
                {t("onboarding.equipments")}
              </Text>
              <View style={styles.equipmentGrid}>
                {(selectedLocation === "home"
                  ? homeEquipmentOptions
                  : gymEquipmentOptions
                ).map((equipment) => {
                  const isNoneSelected = selectedEquipments.includes("none");
                  const isDisabled =
                    isNoneSelected && equipment.code !== "none";
                  const isSelected = selectedEquipments.includes(
                    equipment.code
                  );

                  return (
                    <TouchableOpacity
                      key={equipment.code}
                      disabled={busy || isDisabled}
                      onPress={() => handleEquipmentSelection(equipment.code)}
                      style={[
                        styles.equipmentCard,
                        {
                          opacity: isDisabled ? 0.5 : 1,
                          borderColor: isDisabled
                            ? "#374151"
                            : isSelected
                              ? "#f59e0b"
                              : "#374151",
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          {
                            backgroundColor: isSelected
                              ? "#f59e0b"
                              : "transparent",
                            borderColor: isSelected ? "#f59e0b" : "#374151",
                          },
                        ]}
                      >
                        {isSelected && (
                          <Text
                            style={{
                              color: "#fff",
                              fontSize: 12,
                              fontWeight: "bold",
                            }}
                          >
                            ✓
                          </Text>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.equipmentCardText,
                          {
                            color: isSelected
                              ? "#f59e0b"
                              : isDisabled
                                ? "#6b7280"
                                : "#e5e7eb",
                            fontSize: isMobile ? 13 : 14,
                          },
                        ]}
                      >
                        {t(equipment.label)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom equipment when at home */}
              {selectedLocation === "home" &&
                selectedEquipments.includes("other") &&
                !selectedEquipments.includes("none") && (
                  <View
                    style={{ marginTop: 16 }}
                    onLayout={(event) => {
                      const { y } = event.nativeEvent.layout;
                      setCustomEquipmentInputY(y);
                    }}
                  >
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <TextInput
                        value={currentOtherEquipment}
                        onChangeText={setCurrentOtherEquipment}
                        placeholder={t("onboarding.specifyOtherEquipment")}
                        placeholderTextColor="#9ca3af"
                        style={[
                          styles.textInput,
                          {
                            flex: 1,
                            marginRight: 12,
                            fontSize: isMobile ? 15 : 16,
                          },
                        ]}
                        onSubmitEditing={addCustomEquipment}
                        returnKeyType="done"
                        onFocus={() => {
                          if (
                            Platform.OS !== "web" &&
                            customEquipmentInputY > 0
                          ) {
                            setTimeout(() => {
                              scrollViewRef.current?.scrollTo({
                                y: customEquipmentInputY - 150,
                                animated: true,
                              });
                            }, 300);
                          }
                        }}
                      />
                      <TouchableOpacity
                        onPress={addCustomEquipment}
                        disabled={!currentOtherEquipment.trim()}
                        style={{
                          backgroundColor: currentOtherEquipment.trim()
                            ? "#f59e0b"
                            : "#374151",
                          borderRadius: 8,
                          paddingHorizontal: 16,
                          paddingVertical: 16,
                        }}
                      >
                        <Text
                          style={{
                            color: currentOtherEquipment.trim()
                              ? "#000"
                              : "#9ca3af",
                            fontWeight: "600",
                          }}
                        >
                          +
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {otherEquipments.length > 0 && (
                      <View style={{ gap: 8, marginTop: 12 }}>
                        {otherEquipments.map((equipment, index) => (
                          <View key={index} style={styles.customEquipmentItem}>
                            <Text
                              style={[
                                styles.customEquipmentText,
                                { fontSize: isMobile ? 15 : 16 },
                              ]}
                            >
                              {equipment}
                            </Text>
                            <TouchableOpacity
                              onPress={() => removeCustomEquipment(equipment)}
                              style={styles.removeButton}
                            >
                              <Text style={styles.removeButtonText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
            </View>
          )}

          {/* Duration */}
          <View style={{ marginBottom: isMobile ? 24 : 32 }}>
            <Text style={[styles.sectionLabel, { fontSize: subtitleSize }]}>
              {t("onboarding.workoutDuration")}
            </Text>
            <View style={{ alignItems: "center", marginTop: 16 }}>
              <Text
                style={[styles.sliderValue, { fontSize: isMobile ? 16 : 18 }]}
              >
                {workoutDuration} minutes
              </Text>
              <Slider
                style={{ width: "100%", height: 40 }}
                minimumValue={15}
                maximumValue={120}
                step={15}
                value={workoutDuration}
                onValueChange={setWorkoutDuration}
                minimumTrackTintColor="#f59e0b"
                maximumTrackTintColor="#374151"
                thumbTintColor="#f59e0b"
              />
              <View style={styles.sliderLabels}>
                <Text
                  style={[styles.sliderLabel, { fontSize: isMobile ? 11 : 12 }]}
                >
                  15 min
                </Text>
                <Text
                  style={[styles.sliderLabel, { fontSize: isMobile ? 11 : 12 }]}
                >
                  120 min
                </Text>
              </View>
            </View>
          </View>

          {/* Weekly Frequency */}
          <View style={{ marginBottom: isMobile ? 24 : 32 }}>
            <Text style={[styles.sectionLabel, { fontSize: subtitleSize }]}>
              {t("onboarding.weeklyFrequency")}
            </Text>
            <View style={styles.weekDaysContainer}>
              {weeklyFrequency.map((day) => (
                <TouchableOpacity
                  key={day.code}
                  disabled={busy}
                  onPress={() => handleWeeklyFrequencyToggle(day.code)}
                  style={[
                    styles.weekDayCard,
                    {
                      backgroundColor: day.selected ? "#f59e0b" : "#18223A",
                      borderColor: day.selected ? "#f59e0b" : "#374151",
                      paddingHorizontal: isMobile ? 12 : 16,
                      paddingVertical: isMobile ? 10 : 12,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.weekDayText,
                      {
                        color: day.selected ? "#ffffff" : "#e5e7eb",
                        fontSize: isMobile ? 13 : 14,
                      },
                    ]}
                  >
                    {t(day.label)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Affirmation */}
          {affirmation && weeklyFrequency.some((d) => d.selected) && (
            <Animated.View
              style={{
                opacity: fadeAnim,
                marginBottom: isMobile ? 24 : 32,
                paddingHorizontal: isMobile ? 16 : 20,
                paddingVertical: isMobile ? 12 : 16,
              }}
            >
              <Text
                style={[
                  styles.affirmationText,
                  { fontSize: isMobile ? 15 : 16 },
                ]}
              >
                ✨ {affirmation}
              </Text>
            </Animated.View>
          )}

          {/* Continue */}
          <TouchableOpacity
            disabled={busy || !isValid}
            onPress={handleContinue}
            style={[
              styles.continueButton,
              {
                backgroundColor: isValid && !busy ? "#059669" : "#d1d5db",
                paddingVertical: isMobile ? 16 : 18,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={[
                  styles.continueButtonText,
                  { fontSize: isMobile ? 17 : 18 },
                ]}
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
    <SafeAreaView style={styles.safeArea}>
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
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexGrow: 1,
                minHeight: isWeb ? viewportHeight - 120 : undefined,
                paddingHorizontal: isMobile ? 20 : isSmallWeb ? 16 : 24,
                paddingTop: isMobile ? 32 : isSmallWeb ? 12 : 16,
                paddingBottom: isMobile ? 32 : isSmallWeb ? 20 : 32,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
              nestedScrollEnabled={true}
            >
              <Pressable
                onPress={() => setShowFitnessGoalDropdown(false)}
                style={{ flexGrow: 1, flex: 1 }}
              >
                <View style={[styles.titleContainer, { marginTop: topMargin }]}>
                  <Text
                    style={[
                      styles.title,
                      { fontSize: titleSize, marginBottom: isMobile ? 8 : 10 },
                    ]}
                  >
                    {t("onboarding.yourFitnessGoals")}
                  </Text>
                  <Text style={[styles.subtitle, { fontSize: subtitleSize }]}>
                    {t("onboarding.tellUsAboutFitnessPreferences")}
                  </Text>
                </View>
                {error && (
                  <Text
                    style={[styles.errorText, { fontSize: isMobile ? 13 : 14 }]}
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#101A2C" },
  titleContainer: { marginBottom: 32 },
  title: {
    color: "#f59e0b",
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  subtitle: {
    color: "#e5e7eb",
    textAlign: "center",
    lineHeight: 22,
    opacity: 0.8,
  },
  sectionLabel: {
    color: "#ffffff",
    fontWeight: "500",
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  dropdown: {
    width: "100%",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "#18223A",
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownOptions: {
    backgroundColor: "#18223A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    marginTop: 4,
    zIndex: 1000,
    ...(Platform.OS !== "web" && {
      elevation: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    }),
  },
  dropdownOption: {
    borderBottomColor: "#374151",
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: "transparent",
    marginRight: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#f59e0b",
  },
  radioText: { fontWeight: "400", flex: 1 },
  textInput: {
    width: "100%",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "#18223A",
    color: "#e5e7eb",
    borderWidth: 1,
    borderColor: "#374151",
  },
  sliderValue: { color: "#f59e0b", fontWeight: "600", marginBottom: 8 },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 4,
  },
  sliderLabel: { color: "#9ca3af" },
  weekDaysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  weekDayCard: {
    borderRadius: 12,
    borderWidth: 2,
    minWidth: 48,
    alignItems: "center",
  },
  weekDayText: { fontWeight: "600" },
  affirmationText: {
    color: "#f59e0b",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
  continueButton: {
    width: "100%",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS !== "web" && {
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    }),
    marginBottom: 8,
  },
  continueButtonText: { color: "#fff", fontWeight: "700" },
  errorText: { color: "#ef4444", textAlign: "center", marginBottom: 16 },
  customEquipmentItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#18223A",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  customEquipmentText: { color: "#e5e7eb", flex: 1 },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  removeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    lineHeight: 20,
  },
  equipmentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  equipmentCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    width: "48%",
    backgroundColor: "#18223A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  equipmentCardText: { fontWeight: "400", flex: 1, marginLeft: 12 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});

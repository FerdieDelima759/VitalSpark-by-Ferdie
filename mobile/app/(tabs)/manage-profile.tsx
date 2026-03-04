import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "@/node_modules/react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/contexts/AuthContext";
import { useUserContext } from "@/contexts/UserContext";
import { useUserData } from "@/hooks/useUserData";
import { useMobileWebRedirect } from "@/hooks/useMobileWebRedirect";
import Toast from "@/components/Toast";
import countriesData from "@/lib/data/countries.json";
import subdivisionsData from "@/lib/data/subdivisions.json";
import { supabase } from "@/utils/supabase";

// Equipment options from fitness.tsx
const homeEquipmentOptions = [
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

const gymEquipmentOptions = [
  { code: "fullGymAccess", label: "equipments.fullGymAccess" },
];

// Dietary preference options
const dietaryPreferenceOptions = [
  { code: "vegan", label: "dietaryPreferences.vegan" },
  { code: "keto", label: "dietaryPreferences.keto" },
  { code: "paleo", label: "dietaryPreferences.paleo" },
  { code: "mediterranean", label: "dietaryPreferences.mediterranean" },
  { code: "balanced", label: "dietaryPreferences.balanced" },
  { code: "glutenFree", label: "dietaryPreferences.glutenFree" },
  { code: "flexitarian", label: "dietaryPreferences.flexitarian" },
  { code: "filipinoHeritage", label: "dietaryPreferences.filipinoHeritage" },
];

// Health condition options
const healthConditionOptions = [
  { code: "acidReflux", label: "healthConditions.acidReflux" },
  { code: "highBloodPressure", label: "healthConditions.highBloodPressure" },
  { code: "diabetes", label: "healthConditions.diabetes" },
  { code: "other", label: "healthConditions.other" },
];

// Target Muscle Group options
const targetMuscleGroupOptions = [
  { code: "fullBody", label: "targetMuscles.fullBody" },
  { code: "upperBody", label: "targetMuscles.upperBody" },
  { code: "lowerBody", label: "targetMuscles.lowerBody" },
  { code: "core", label: "targetMuscles.core" },
  { code: "arms", label: "targetMuscles.arms" },
  { code: "chest", label: "targetMuscles.chest" },
  { code: "back", label: "targetMuscles.back" },
  { code: "shoulders", label: "targetMuscles.shoulders" },
  { code: "legs", label: "targetMuscles.legs" },
  { code: "glutes", label: "targetMuscles.glutes" },
];

// Format text for database (converts camelCase to Title Case with spaces)
const formatTextForDatabase = (text: string): string => {
  if (!text) return text;
  const formatted = text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(" ")
    .map((word) => {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
  return formatted;
};

// Toast interface
interface ToastMessage {
  id: string;
  type: "success" | "error";
  title: string;
  message: string;
}

interface ProfileFieldProps {
  label: string;
  value: string | number | string[] | undefined;
  icon: string;
  onEdit?: () => void;
  isEditable?: boolean;
  formatValue?: (value: any) => string;
}

const ProfileField = ({
  label,
  value,
  icon,
  onEdit,
  isEditable = false,
  formatValue,
}: ProfileFieldProps) => {
  const { t } = useTranslation("common");
  const displayValue = formatValue
    ? formatValue(value)
    : String(value ?? t("common.notSet"));
  return (
    <View className="flex-row items-center py-3 px-4">
      <View className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 items-center justify-center mr-3">
        <Ionicons name={icon as any} size={18} color="#b45309" />
      </View>
      <View className="flex-1">
        <Text className="text-slate-500 text-[12px] uppercase tracking-wide mb-1">
          {label}
        </Text>
        <Text className="text-slate-900 font-semibold text-[15px] leading-5">
          {displayValue}
        </Text>
      </View>
      {isEditable && onEdit && (
        <TouchableOpacity
          onPress={onEdit}
          className="w-10 h-10 rounded-full items-center justify-center"
        >
          <Ionicons name="pencil" size={18} color="#14b8a6" />
        </TouchableOpacity>
      )}
    </View>
  );
};

// Specialized ProfileField for custom displays
const CustomProfileField = ({
  label,
  value,
  icon,
  onEdit,
  isEditable = false,
  customDisplay,
}: {
  label: string;
  value: any;
  icon: string;
  onEdit?: () => void;
  isEditable?: boolean;
  customDisplay: React.ReactNode;
}) => {
  return (
    <View className="py-3 px-4">
      <View className="flex-row items-start">
        <View className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 items-center justify-center mr-3 mt-1">
          <Ionicons name={icon as any} size={18} color="#b45309" />
        </View>
        <View className="flex-1">
          <Text className="text-slate-500 text-[12px] uppercase tracking-wide mb-2">
            {label}
          </Text>
          {customDisplay}
        </View>
        {isEditable && onEdit && (
          <TouchableOpacity
            onPress={onEdit}
            className="w-10 h-10 rounded-full items-center justify-center ml-2"
          >
            <Ionicons name="pencil" size={18} color="#14b8a6" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <View className="bg-white rounded-2xl border border-slate-200 mb-5 overflow-hidden">
    <View className="px-4 py-3 border-b border-slate-100 flex-row items-center">
      <View className="w-1.5 h-5 rounded-full bg-amber-500 mr-2" />
      <Text className="text-[12px] tracking-wider font-bold text-slate-700 uppercase">
        {title}
      </Text>
    </View>
    <View className="px-2 py-2">{children}</View>
  </View>
);

const Divider = () => <View className="h-[1px] bg-slate-100 mx-2" />;

// Array fields that need special handling
const arrayFields = [
  "equipment_list",
  "weekly_frequency",
  "target_muscle_groups",
  "meal_plan_duration",
  "health_conditions",
];

// Weekly frequency display component
const WeeklyFrequencyDisplay = ({
  frequency,
}: {
  frequency: string[] | undefined;
}) => {
  const { t } = useTranslation("common");
  if (!frequency || frequency.length === 0) {
    return (
      <Text className="text-slate-500 text-[15px]">{t("common.notSet")}</Text>
    );
  }
  return (
    <View className="flex-row flex-wrap gap-2">
      {frequency.map((day, index) => {
        const dayLabel = t(`weekDays.${day}`);
        const displayLabel = dayLabel.includes("weekDays.")
          ? day.substring(0, 3).toUpperCase()
          : dayLabel.substring(0, 3).toUpperCase();
        return (
          <View
            key={day}
            className="bg-teal-100 border border-teal-200 rounded-full px-3 py-1"
          >
            <Text className="text-teal-700 text-xs font-medium">
              {displayLabel}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// Target muscle groups display component
const TargetMusclesDisplay = ({
  muscles,
}: {
  muscles: string[] | undefined;
}) => {
  const { t } = useTranslation("common");
  if (!muscles || muscles.length === 0) {
    return (
      <Text className="text-slate-500 text-[15px]">{t("common.notSet")}</Text>
    );
  }
  const getMuscleDisplayName = (muscle: string) => {
    const translation = t(`targetMuscles.${muscle}`);
    return translation.includes("targetMuscles.") ? muscle : translation;
  };
  return (
    <View className="flex-row flex-wrap gap-2">
      {muscles.map((muscle, index) => (
        <View
          key={muscle}
          className="bg-amber-100 border border-amber-200 rounded-full px-3 py-1"
        >
          <Text className="text-amber-800 text-xs font-medium">
            {getMuscleDisplayName(muscle)}
          </Text>
        </View>
      ))}
    </View>
  );
};

// Equipment list display component
const EquipmentDisplay = ({
  equipment,
}: {
  equipment: string[] | undefined;
}) => {
  const { t } = useTranslation("common");
  if (!equipment || equipment.length === 0) {
    return (
      <Text className="text-slate-500 text-[15px]">{t("common.notSet")}</Text>
    );
  }
  const getEquipmentDisplayName = (item: string) => {
    const allStandardOptions = [
      ...homeEquipmentOptions,
      ...gymEquipmentOptions,
    ];
    let matchingOption = allStandardOptions.find(
      (option) => option.code.toLowerCase() === item.toLowerCase()
    );
    if (!matchingOption) {
      matchingOption = allStandardOptions.find(
        (option) => formatTextForDatabase(option.code) === item
      );
    }
    if (matchingOption) {
      const translation = t(matchingOption.label);
      return translation.includes("equipments.") ? item : translation;
    }
    const translation = t(`equipments.${item}`);
    return translation.includes("equipments.") ? item : translation;
  };
  return (
    <View className="space-y-1">
      {equipment.map((item, index) => (
        <View key={item} className="flex-row items-center">
          <View className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2" />
          <Text className="text-slate-900 text-[15px] flex-1">
            {getEquipmentDisplayName(item)}
          </Text>
        </View>
      ))}
    </View>
  );
};

// Meal plan duration display component
const MealPlanDurationDisplay = ({
  duration,
}: {
  duration: string[] | undefined;
}) => {
  const { t } = useTranslation("common");
  if (!duration || duration.length === 0) {
    return (
      <Text className="text-slate-500 text-[15px]">{t("common.notSet")}</Text>
    );
  }
  return (
    <View className="flex-row flex-wrap gap-2">
      {duration.map((d, index) => {
        const translation = t(`mealPlanDuration.${d}`);
        const displayLabel = translation.includes("mealPlanDuration.")
          ? d.substring(0, 3).toUpperCase()
          : translation.substring(0, 3).toUpperCase();
        return (
          <View
            key={d}
            className="bg-teal-100 border border-teal-200 rounded-full px-3 py-1"
          >
            <Text className="text-teal-700 text-xs font-medium">
              {displayLabel}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// Health conditions display component
const HealthConditionsDisplay = ({
  conditions,
}: {
  conditions: string[] | undefined;
}) => {
  const { t } = useTranslation("common");
  if (!conditions || conditions.length === 0) {
    return (
      <Text className="text-slate-500 text-[15px]">{t("common.notSet")}</Text>
    );
  }
  const getConditionDisplayName = (condition: string) => {
    const matchingOption = healthConditionOptions.find(
      (option) =>
        formatTextForDatabase(option.code) === condition ||
        option.code === condition ||
        option.code.toLowerCase() === condition.toLowerCase()
    );
    if (matchingOption) {
      const translation = t(matchingOption.label);
      return translation.includes("healthConditions.")
        ? condition
        : translation;
    }
    return condition;
  };
  return (
    <View className="space-y-1">
      {conditions.map((condition, index) => (
        <View key={`${condition}-${index}`} className="flex-row items-center">
          <View className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2" />
          <Text className="text-slate-900 text-[15px] flex-1">
            {getConditionDisplayName(condition)}
          </Text>
        </View>
      ))}
    </View>
  );
};

export default function ManageProfile() {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const { userProfile, refreshUserData } = useUserContext();
  const { updateUserProfile, isLoading: dataLoading } = useUserData();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [radioModalVisible, setRadioModalVisible] = useState(false);
  const [selectedRadioValue, setSelectedRadioValue] = useState<string>("");
  const [ageRangeModalVisible, setAgeRangeModalVisible] = useState(false);
  const [selectedAgeRange, setSelectedAgeRange] = useState<string>("");
  const [genderModalVisible, setGenderModalVisible] = useState(false);
  const [selectedGender, setSelectedGender] = useState<string>("");
  const [heightModalVisible, setHeightModalVisible] = useState(false);
  const [heightValue, setHeightValue] = useState<string>("");
  const [heightUnit, setHeightUnit] = useState<string>("cm");
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightValue, setWeightValue] = useState<string>("");
  const [weightUnit, setWeightUnit] = useState<string>("kg");
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [countrySearch, setCountrySearch] = useState<string>("");
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [selectedState, setSelectedState] = useState<string>("");
  const [stateSearch, setStateSearch] = useState<string>("");
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [fitnessGoalModalVisible, setFitnessGoalModalVisible] = useState(false);
  const [selectedFitnessGoal, setSelectedFitnessGoal] = useState<string>("");
  const [workoutLocationModalVisible, setWorkoutLocationModalVisible] =
    useState(false);
  const [selectedWorkoutLocation, setSelectedWorkoutLocation] =
    useState<string>("");
  const [equipmentModalVisible, setEquipmentModalVisible] = useState(false);
  const [selectedEquipmentList, setSelectedEquipmentList] = useState<string[]>(
    []
  );
  const [otherEquipmentList, setOtherEquipmentList] = useState<string[]>([]);
  const [currentOtherEquipment, setCurrentOtherEquipment] =
    useState<string>("");
  const [workoutDurationModalVisible, setWorkoutDurationModalVisible] =
    useState(false);
  const [workoutDurationValue, setWorkoutDurationValue] = useState<number>(30);
  const [weeklyFrequencyModalVisible, setWeeklyFrequencyModalVisible] =
    useState(false);
  const [selectedWeeklyDays, setSelectedWeeklyDays] = useState<string[]>([]);
  const [mealPlanDurationModalVisible, setMealPlanDurationModalVisible] =
    useState(false);
  const [selectedMealPlanDays, setSelectedMealPlanDays] = useState<string[]>(
    []
  );
  const [dietaryPreferenceModalVisible, setDietaryPreferenceModalVisible] =
    useState(false);
  const [selectedDietaryPreference, setSelectedDietaryPreference] =
    useState<string>("");
  const [healthConditionsModalVisible, setHealthConditionsModalVisible] =
    useState(false);
  const [selectedHealthConditions, setSelectedHealthConditions] = useState<
    string[]
  >([]);
  const [otherHealthConditions, setOtherHealthConditions] = useState<string[]>(
    []
  );
  const [currentOtherHealthCondition, setCurrentOtherHealthCondition] =
    useState<string>("");
  const [targetMuscleGroupsModalVisible, setTargetMuscleGroupsModalVisible] =
    useState(false);
  const [selectedTargetMuscleGroups, setSelectedTargetMuscleGroups] = useState<
    string[]
  >([]);
  const [changePasswordModalVisible, setChangePasswordModalVisible] =
    useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [logoutConfirmDialogVisible, setLogoutConfirmDialogVisible] =
    useState(false);

  useMobileWebRedirect(true);
  // Toast helper function
  const showToast = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    const title = type === "success" ? t("common.success") : t("common.error");

    if (Platform.OS === "web") {
      // Show toast notification on web
      const newToast: ToastMessage = {
        id: Date.now().toString(),
        type,
        title,
        message,
      };
      setToasts((prev) => [...prev, newToast]);
    } else {
      // Show native alert on mobile
      Alert.alert(title, message);
    }
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const handleForgotPasswordClick = () => {
    setChangePasswordModalVisible(false);

    setTimeout(() => setLogoutConfirmDialogVisible(true), 500);
  };

  const handleConfirmLogout = async () => {
    setLogoutConfirmDialogVisible(false);
    setChangePasswordModalVisible(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setCurrentPasswordError("");
    setNewPasswordError("");
    setConfirmPasswordError("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);

    try {
      // Sign out first
      await supabase.auth.signOut({ scope: "global" });

      // Show success message and wait for user acknowledgment
      if (Platform.OS === "web") {
        // Show toast notification on web
        showToast(t("profile.loggedOutRedirecting"));
        // Add delay for web to show the toast before redirect
        await new Promise((resolve) => setTimeout(resolve, 1500));
        // Redirect to forgot password page
        router.replace("/(auth)/forgot-password");
      } else {
        // Show native alert on mobile and wait for user to dismiss
        await new Promise<void>((resolve) => {
          Alert.alert(t("common.success"), t("profile.loggedOutRedirecting"), [
            {
              text: t("common.ok"),
              onPress: () => {
                resolve();
                // Redirect after user dismisses
                router.replace("/(auth)/forgot-password");
              },
            },
          ]);
        });
      }
    } catch (error) {
      showToast(t("profile.loggedOutRedirecting"));
      // Still redirect even if there's an error
      setTimeout(() => {
        router.replace("/(auth)/forgot-password");
      }, 1000);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadUserProfile();
    }
  }, [user?.id]);

  const loadUserProfile = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      await refreshUserData();
      const heightUnit = String(userProfile?.height_unit || "cm");
      const weightUnit = String(userProfile?.weight_unit || "kg");
      setHeightUnit(heightUnit);
      setWeightUnit(weightUnit);
    } catch (error) {
      showToast("Failed to load profile data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEditField = (fieldName: string, currentValue: any) => {
    setEditingField(fieldName);

    // Handle fitness level with radio buttons
    if (fieldName === "fitness_level") {
      setSelectedRadioValue(String(currentValue ?? ""));
      setRadioModalVisible(true);
      return;
    }

    // Handle fitness goal
    if (fieldName === "fitness_goal") {
      let normalizedGoal = String(currentValue ?? "");
      const fitnessGoalOptions = [
        { value: "loseWeight", label: "Lose Weight" },
        { value: "buildMuscle", label: "Build Muscle" },
        { value: "improveCardiovascular", label: "Improve Cardiovascular" },
        { value: "increaseStrength", label: "Increase Strength" },
        { value: "enhanceFlexibility", label: "Enhance Flexibility" },
        { value: "buildStrength", label: "Build Strength" },
        { value: "getToned", label: "Get Toned" },
        { value: "getLean", label: "Get Lean" },
        { value: "mobility", label: "Mobility" },
        { value: "endurance", label: "Endurance" },
        { value: "bodyBuilding", label: "Body Building" },
        { value: "stayHealthy", label: "Stay Healthy" },
      ];
      const matchedOption = fitnessGoalOptions.find(
        (option) =>
          option.value === normalizedGoal ||
          option.value.toLowerCase() === normalizedGoal.toLowerCase() ||
          option.label === normalizedGoal ||
          option.label.toLowerCase() === normalizedGoal.toLowerCase() ||
          formatTextForDatabase(option.value) === normalizedGoal
      );
      if (matchedOption) {
        normalizedGoal = matchedOption.value;
      }
      setSelectedFitnessGoal(normalizedGoal);
      setFitnessGoalModalVisible(true);
      return;
    }

    // Handle workout location
    if (fieldName === "workout_location") {
      setSelectedWorkoutLocation(String(currentValue ?? ""));
      setWorkoutLocationModalVisible(true);
      return;
    }

    // Handle dietary preference
    if (fieldName === "dietary_preference") {
      let matchedCode = "";
      if (currentValue) {
        const valueStr = String(currentValue);
        matchedCode =
          dietaryPreferenceOptions.find(
            (option) =>
              option.code === valueStr ||
              option.code.toLowerCase() === valueStr.toLowerCase() ||
              formatTextForDatabase(option.code) === valueStr
          )?.code || valueStr;
      }
      setSelectedDietaryPreference(matchedCode);
      setDietaryPreferenceModalVisible(true);
      return;
    }

    // Handle age range
    if (fieldName === "age_range") {
      setSelectedAgeRange(String(currentValue ?? ""));
      setAgeRangeModalVisible(true);
      return;
    }

    // Handle gender
    if (fieldName === "gender") {
      setSelectedGender(String(currentValue ?? ""));
      setGenderModalVisible(true);
      return;
    }

    // Handle height
    if (fieldName === "height") {
      const height = currentValue || 0;
      const storedUnit = userProfile?.height_unit || "cm";
      if (storedUnit === "cm") {
        setHeightValue(String(height));
        setHeightUnit("cm");
      } else {
        const totalInches = height / 2.54;
        const feet = Math.floor(totalInches / 12);
        const inches = Math.round(totalInches % 12);
        setHeightValue(`${feet}.${inches}`);
        setHeightUnit("ft");
      }
      setHeightModalVisible(true);
      return;
    }

    // Handle weight
    if (fieldName === "weight") {
      const weight = currentValue || 0;
      const storedUnit = userProfile?.weight_unit || "kg";
      if (storedUnit === "kg") {
        setWeightValue(String(weight));
        setWeightUnit("kg");
      } else {
        const pounds = weight * 2.20462;
        setWeightValue(pounds.toFixed(1));
        setWeightUnit("lbs");
      }
      setWeightModalVisible(true);
      return;
    }

    // Handle country
    if (fieldName === "country") {
      setSelectedCountry(String(currentValue ?? ""));
      setCountrySearch("");
      setCountryModalVisible(true);
      return;
    }

    // Handle region_province
    if (fieldName === "region_province") {
      if (!userProfile?.country) {
        setSelectedCountry("");
        setCountrySearch("");
        setCountryModalVisible(true);
        return;
      }
      setSelectedState(String(currentValue ?? ""));
      setStateSearch("");
      const countrySubdivisions =
        subdivisionsData[userProfile.country as keyof typeof subdivisionsData];
      if (countrySubdivisions) {
        const stateNames = countrySubdivisions.map(
          (subdivision) => subdivision.name
        );
        setAvailableStates(stateNames);
      } else {
        setAvailableStates([]);
      }
      setStateModalVisible(true);
      return;
    }

    // Handle equipment_list
    if (fieldName === "equipment_list") {
      const equipmentList = Array.isArray(currentValue) ? currentValue : [];
      const allStandardOptions = [
        ...homeEquipmentOptions,
        ...gymEquipmentOptions,
      ];
      const standardEquipment: string[] = [];
      const customEquipment: string[] = [];
      equipmentList.forEach((eq: string) => {
        const exactMatch = allStandardOptions.find(
          (option) => option.code === eq
        );
        if (exactMatch) {
          standardEquipment.push(exactMatch.code);
          return;
        }
        const caseInsensitiveMatch = allStandardOptions.find(
          (option) => option.code.toLowerCase() === eq.toLowerCase()
        );
        if (caseInsensitiveMatch) {
          standardEquipment.push(caseInsensitiveMatch.code);
          return;
        }
        const formattedMatch = allStandardOptions.find(
          (option) => formatTextForDatabase(option.code) === eq
        );
        if (formattedMatch) {
          standardEquipment.push(formattedMatch.code);
          return;
        }
        const nameMatch = allStandardOptions.find((option) => {
          const translatedName = t(option.label);
          return (
            translatedName.toLowerCase() === eq.toLowerCase() ||
            option.code.toLowerCase().replace(/\s+/g, "") ===
              eq.toLowerCase().replace(/\s+/g, "")
          );
        });
        if (nameMatch) {
          standardEquipment.push(nameMatch.code);
          return;
        }
        customEquipment.push(eq);
      });
      if (customEquipment.length > 0) {
        setSelectedEquipmentList([...standardEquipment, "other"]);
        setOtherEquipmentList(customEquipment);
      } else {
        setSelectedEquipmentList(standardEquipment);
        setOtherEquipmentList([]);
      }
      setCurrentOtherEquipment("");
      setEquipmentModalVisible(true);
      return;
    }

    // Handle workout_duration_minutes
    if (fieldName === "workout_duration_minutes") {
      setWorkoutDurationValue(Number(currentValue) || 30);
      setWorkoutDurationModalVisible(true);
      return;
    }

    // Handle weekly_frequency
    if (fieldName === "weekly_frequency") {
      const frequencyList = Array.isArray(currentValue) ? currentValue : [];
      const normalizedDays = frequencyList.map((day: string) =>
        day.toLowerCase()
      );
      setSelectedWeeklyDays(normalizedDays);
      setWeeklyFrequencyModalVisible(true);
      return;
    }

    // Handle meal_plan_duration
    if (fieldName === "meal_plan_duration") {
      const durationList = Array.isArray(currentValue) ? currentValue : [];
      const normalizedDays = durationList.map((day: string) =>
        day.toLowerCase()
      );
      setSelectedMealPlanDays(normalizedDays);
      setMealPlanDurationModalVisible(true);
      return;
    }

    // Handle health_conditions
    if (fieldName === "health_conditions") {
      const conditionsList = Array.isArray(currentValue) ? currentValue : [];
      const standardConditions: string[] = [];
      const customConditions: string[] = [];
      conditionsList.forEach((condition: string) => {
        const exactMatch = healthConditionOptions.find(
          (option) => option.code === condition
        );
        if (exactMatch) {
          standardConditions.push(exactMatch.code);
          return;
        }
        const caseInsensitiveMatch = healthConditionOptions.find(
          (option) => option.code.toLowerCase() === condition.toLowerCase()
        );
        if (caseInsensitiveMatch) {
          standardConditions.push(caseInsensitiveMatch.code);
          return;
        }
        const formattedMatch = healthConditionOptions.find(
          (option) => formatTextForDatabase(option.code) === condition
        );
        if (formattedMatch) {
          standardConditions.push(formattedMatch.code);
          return;
        }
        customConditions.push(condition);
      });
      if (customConditions.length > 0) {
        setSelectedHealthConditions([...standardConditions, "other"]);
        setOtherHealthConditions(customConditions);
      } else {
        setSelectedHealthConditions(standardConditions);
        setOtherHealthConditions([]);
      }
      setCurrentOtherHealthCondition("");
      setHealthConditionsModalVisible(true);
      return;
    }

    // Handle target_muscle_groups
    if (fieldName === "target_muscle_groups") {
      const musclesList = Array.isArray(currentValue) ? currentValue : [];
      const normalizedMuscles = musclesList.map((muscle: string) => {
        const exactMatch = targetMuscleGroupOptions.find(
          (option) => option.code === muscle
        );
        if (exactMatch) return exactMatch.code;
        const caseMatch = targetMuscleGroupOptions.find(
          (option) => option.code.toLowerCase() === muscle.toLowerCase()
        );
        if (caseMatch) return caseMatch.code;
        const formattedMatch = targetMuscleGroupOptions.find(
          (option) => formatTextForDatabase(option.code) === muscle
        );
        if (formattedMatch) return formattedMatch.code;
        return muscle;
      });
      setSelectedTargetMuscleGroups(normalizedMuscles);
      setTargetMuscleGroupsModalVisible(true);
      return;
    }

    // Handle array values properly
    if (Array.isArray(currentValue)) {
      setEditValue(currentValue.join(", "));
    } else {
      setEditValue(String(currentValue ?? ""));
    }
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!user?.id || !editingField || saving) return;
    try {
      setSaving(true);
      const updateData: any = {};
      if (arrayFields.includes(editingField)) {
        updateData[editingField] = editValue
          ? editValue
              .split(",")
              .map((item) => item.trim())
              .filter((item) => item.length > 0)
          : [];
      } else if (editingField === "weekly_budget") {
        updateData[editingField] = Number(editValue) || 0;
      } else {
        updateData[editingField] = editValue;
      }
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        const fieldDisplayName = editingField
          ?.replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        showToast(`Failed to update ${fieldDisplayName}`, "error");
        return;
      }
      await refreshUserData();
      setEditModalVisible(false);
      setEditingField(null);
      setEditValue("");
      const fieldDisplayName = editingField
        ?.replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      showToast(`${fieldDisplayName} updated successfully`);
    } catch (error) {
      showToast("Failed to update profile", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRadioEdit = async () => {
    if (!user?.id || !editingField || saving) return;
    try {
      setSaving(true);
      const updateData: any = {};
      updateData[editingField] = selectedRadioValue;
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        const fieldDisplayName = editingField
          ?.replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        showToast(`Failed to update ${fieldDisplayName}`, "error");
        return;
      }
      await refreshUserData();
      setRadioModalVisible(false);
      setEditingField(null);
      setSelectedRadioValue("");
      const fieldDisplayName =
        editingField === "fitness_level"
          ? "Fitness Level"
          : editingField
              ?.replace(/_/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase());
      showToast(`${fieldDisplayName} updated successfully`);
    } catch (error) {
      showToast("Failed to update profile", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAgeRangeEdit = async () => {
    if (!user?.id || !editingField || saving) return;
    try {
      setSaving(true);
      const updateData: any = {};
      updateData[editingField] = selectedAgeRange;
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("Failed to update Age Range", "error");
        return;
      }
      await refreshUserData();
      setAgeRangeModalVisible(false);
      setEditingField(null);
      setSelectedAgeRange("");
      showToast("Age Range updated successfully");
    } catch (error) {
      showToast("Failed to update Age Range", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGenderEdit = async () => {
    if (!user?.id || !editingField || saving) return;
    try {
      setSaving(true);
      const updateData: any = {};
      updateData[editingField] = selectedGender;
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("Failed to update Gender", "error");
        return;
      }
      await refreshUserData();
      setGenderModalVisible(false);
      setEditingField(null);
      setSelectedGender("");
      showToast("Gender updated successfully");
    } catch (error) {
      showToast("Failed to update Gender", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHeightEdit = async () => {
    if (!user?.id || !editingField || saving) return;
    try {
      setSaving(true);
      const updateData: any = {};
      let heightInCm = 0;
      if (heightUnit === "cm") {
        heightInCm = parseFloat(heightValue) || 0;
      } else {
        const feetValue = parseFloat(heightValue) || 0;
        const feet = Math.floor(feetValue);
        const inches = Math.round((feetValue - feet) * 10);
        const totalInches = feet * 12 + inches;
        heightInCm = totalInches * 2.54;
      }
      updateData[editingField] = heightInCm;
      updateData.height_unit = heightUnit;
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("Failed to update Height", "error");
        return;
      }
      await refreshUserData();
      setHeightModalVisible(false);
      setEditingField(null);
      setHeightValue("");
      setHeightUnit("cm");
      showToast("Height updated successfully");
    } catch (error) {
      showToast("Failed to update Height", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWeightEdit = async () => {
    if (!user?.id || !editingField || saving) return;
    try {
      setSaving(true);
      const updateData: any = {};
      let weightInKg = 0;
      if (weightUnit === "kg") {
        weightInKg = parseFloat(weightValue) || 0;
      } else {
        const pounds = parseFloat(weightValue) || 0;
        weightInKg = pounds / 2.20462;
      }
      updateData[editingField] = weightInKg;
      updateData.weight_unit = weightUnit;
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("Failed to update Weight", "error");
        return;
      }
      await refreshUserData();
      setWeightModalVisible(false);
      setEditingField(null);
      setWeightValue("");
      setWeightUnit("kg");
      showToast("Weight updated successfully");
    } catch (error) {
      showToast("Failed to update Weight", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCountryEdit = async () => {
    if (!user?.id || saving) return;
    try {
      setSaving(true);
      const updateData = {
        country: selectedCountry,
        // Clear region_province when country changes
        region_province: "",
      };
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("Failed to update country", "error");
        return;
      }
      await refreshUserData();
      setCountryModalVisible(false);
      setSelectedCountry("");
      setCountrySearch("");
      showToast("Country updated successfully");
    } catch (error) {
      showToast("Failed to update country", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStateEdit = async () => {
    if (!user?.id || saving) return;
    try {
      setSaving(true);
      const updateData = {
        region_province: selectedState,
      };
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("Failed to update Region/Province", "error");
        return;
      }
      await refreshUserData();
      setStateModalVisible(false);
      setEditingField(null);
      setSelectedState("");
      setStateSearch("");
      setAvailableStates([]);
      showToast("Location updated successfully");
    } catch (error) {
      showToast("Failed to update Region/Province", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFitnessGoalEdit = async () => {
    if (!user?.id || !editingField || saving) return;
    try {
      setSaving(true);
      const updateData: any = {};
      updateData[editingField] = selectedFitnessGoal;
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("Failed to update fitness goal", "error");
        return;
      }
      await refreshUserData();
      setFitnessGoalModalVisible(false);
      setEditingField(null);
      setSelectedFitnessGoal("");
      showToast("Fitness goal updated successfully");
    } catch (error) {
      showToast("Failed to update fitness goal", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWorkoutLocationEdit = async () => {
    if (!user?.id || !editingField || saving) return;
    try {
      setSaving(true);
      const updateData: any = {};
      updateData[editingField] = selectedWorkoutLocation;
      updateData.equipment_list = [];
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("Failed to update workout location", "error");
        return;
      }
      await refreshUserData();
      setWorkoutLocationModalVisible(false);
      setEditingField(null);
      setSelectedWorkoutLocation("");

      if (Platform.OS === "web") {
        // For web: show toast first, then open equipment modal
        showToast(t("profile.workoutLocationUpdatedSelectEquipment"));
        setTimeout(() => {
          setEditingField("equipment_list");
          setSelectedEquipmentList([]);
          setOtherEquipmentList([]);
          setCurrentOtherEquipment("");
          setEquipmentModalVisible(true);
        }, 500);
      } else {
        // For mobile: show alert and open equipment modal when user dismisses it
        Alert.alert(
          t("common.success"),
          t("profile.workoutLocationUpdatedSelectEquipment"),
          [
            {
              text: t("common.ok"),
              onPress: () => {
                setEditingField("equipment_list");
                setSelectedEquipmentList([]);
                setOtherEquipmentList([]);
                setCurrentOtherEquipment("");
                setEquipmentModalVisible(true);
              },
            },
          ]
        );
      }
    } catch (error) {
      showToast("Failed to update workout location", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDietaryPreferenceEdit = async () => {
    if (!user?.id || !editingField || saving) return;
    try {
      setSaving(true);
      const updateData: any = {};
      updateData[editingField] = formatTextForDatabase(
        selectedDietaryPreference
      );
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("Failed to update dietary preference", "error");
        return;
      }
      await refreshUserData();
      setDietaryPreferenceModalVisible(false);
      setEditingField(null);
      setSelectedDietaryPreference("");
      showToast("Dietary preference updated successfully");
    } catch (error) {
      showToast("Failed to update dietary preference", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEquipmentEdit = async () => {
    if (!user?.id || saving) return;
    try {
      setSaving(true);
      const equipmentList = [
        ...selectedEquipmentList.filter((eq) => eq !== "other"),
      ];
      if (
        selectedEquipmentList.includes("other") &&
        otherEquipmentList.length > 0
      ) {
        equipmentList.push(...otherEquipmentList);
      }
      const formattedEquipmentList = equipmentList.map((equipment) =>
        formatTextForDatabase(String(equipment))
      );
      const updateData = {
        equipment_list:
          formattedEquipmentList.length > 0 ? formattedEquipmentList : [],
      };
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("Failed to update equipment", "error");
        return;
      }
      await refreshUserData();
      setEquipmentModalVisible(false);
      setEditingField(null);
      setSelectedEquipmentList([]);
      setOtherEquipmentList([]);
      setCurrentOtherEquipment("");
      showToast("Equipment updated successfully");
    } catch (error) {
      showToast("Failed to update equipment", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEquipmentSelection = (equipmentCode: string) => {
    setSelectedEquipmentList((prev) => {
      if (equipmentCode === "none") {
        if (prev.includes("none")) {
          return prev.filter((eq) => eq !== "none");
        } else {
          setOtherEquipmentList([]);
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

  const addCustomEquipment = () => {
    if (
      currentOtherEquipment.trim() &&
      !otherEquipmentList.includes(currentOtherEquipment.trim())
    ) {
      setOtherEquipmentList((prev) => [...prev, currentOtherEquipment.trim()]);
      setCurrentOtherEquipment("");
    }
  };

  const removeCustomEquipment = (equipment: string) => {
    setOtherEquipmentList((prev) => prev.filter((eq) => eq !== equipment));
  };

  const handleHealthConditionSelection = (conditionCode: string) => {
    setSelectedHealthConditions((prev) => {
      if (prev.includes(conditionCode)) {
        return prev.filter((cond) => cond !== conditionCode);
      } else {
        return [...prev, conditionCode];
      }
    });
  };

  const addCustomHealthCondition = () => {
    if (
      currentOtherHealthCondition.trim() &&
      !otherHealthConditions.includes(currentOtherHealthCondition.trim())
    ) {
      setOtherHealthConditions((prev) => [
        ...prev,
        currentOtherHealthCondition.trim(),
      ]);
      setCurrentOtherHealthCondition("");
    }
  };

  const removeCustomHealthCondition = (condition: string) => {
    setOtherHealthConditions((prev) =>
      prev.filter((cond) => cond !== condition)
    );
  };

  const handleSaveWorkoutDurationEdit = async () => {
    if (!user?.id || !editingField || saving) return;
    try {
      setSaving(true);
      const updateData: any = {};
      updateData[editingField] = workoutDurationValue;
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("Failed to update workout duration", "error");
        return;
      }
      await refreshUserData();
      setWorkoutDurationModalVisible(false);
      setEditingField(null);
      setWorkoutDurationValue(30);
      showToast("Workout duration updated successfully");
    } catch (error) {
      showToast("Failed to update workout duration", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleWeeklyDayToggle = (day: string) => {
    setSelectedWeeklyDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  const handleSaveWeeklyFrequencyEdit = async () => {
    if (!user?.id || !editingField || saving) return;
    try {
      setSaving(true);
      const formattedDays = selectedWeeklyDays.map((day) =>
        formatTextForDatabase(day)
      );
      const updateData: any = {};
      updateData[editingField] = formattedDays;
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("Failed to update weekly frequency", "error");
        return;
      }
      await refreshUserData();
      setWeeklyFrequencyModalVisible(false);
      setEditingField(null);
      setSelectedWeeklyDays([]);
      showToast("Weekly frequency updated successfully");
    } catch (error) {
      showToast("Failed to update weekly frequency", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleMealPlanDayToggle = (day: string) => {
    setSelectedMealPlanDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  const handleTargetMuscleGroupToggle = (muscle: string) => {
    setSelectedTargetMuscleGroups((prev) => {
      if (prev.includes(muscle)) {
        return prev.filter((m) => m !== muscle);
      } else {
        return [...prev, muscle];
      }
    });
  };

  const handleSaveMealPlanDurationEdit = async () => {
    if (!user?.id || !editingField || saving) return;
    try {
      setSaving(true);
      const formattedDays = selectedMealPlanDays.map((day) =>
        formatTextForDatabase(day)
      );
      const updateData: any = {};
      updateData[editingField] = formattedDays;
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("Failed to update meal plan duration", "error");
        return;
      }
      await refreshUserData();
      setMealPlanDurationModalVisible(false);
      setEditingField(null);
      setSelectedMealPlanDays([]);
      showToast("Meal plan duration updated successfully");
    } catch (error) {
      showToast("Failed to update meal plan duration", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHealthConditionsEdit = async () => {
    if (!user?.id || saving) return;
    try {
      setSaving(true);
      const standardConditions = selectedHealthConditions.filter(
        (cond) => cond !== "other"
      );
      const formattedStandardConditions = standardConditions.map((condition) =>
        formatTextForDatabase(String(condition))
      );
      const formattedConditionsList = [...formattedStandardConditions];
      if (
        selectedHealthConditions.includes("other") &&
        otherHealthConditions.length > 0
      ) {
        formattedConditionsList.push(...otherHealthConditions);
      }
      const updateData = {
        health_conditions:
          formattedConditionsList.length > 0 ? formattedConditionsList : [],
      };
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("Failed to update health conditions", "error");
        return;
      }
      await refreshUserData();
      setHealthConditionsModalVisible(false);
      setEditingField(null);
      setSelectedHealthConditions([]);
      setOtherHealthConditions([]);
      setCurrentOtherHealthCondition("");
      showToast("Health conditions updated successfully");
    } catch (error) {
      showToast("Failed to update health conditions", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTargetMuscleGroupsEdit = async () => {
    if (!user?.id || saving) return;
    try {
      setSaving(true);
      const formattedMuscleGroups = selectedTargetMuscleGroups.map((muscle) =>
        formatTextForDatabase(String(muscle))
      );
      const updateData = {
        target_muscle_groups:
          formattedMuscleGroups.length > 0 ? formattedMuscleGroups : [],
      };
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("Failed to update target muscle groups", "error");
        return;
      }
      await refreshUserData();
      setTargetMuscleGroupsModalVisible(false);
      setEditingField(null);
      setSelectedTargetMuscleGroups([]);
      showToast("Target muscle groups updated successfully");
    } catch (error) {
      showToast("Failed to update target muscle groups", "error");
    } finally {
      setSaving(false);
    }
  };

  const validateNewPassword = (pwd: string): string => {
    if (!pwd) return "";
    if (pwd.length < 8) {
      return t("profile.passwordMustBe8Chars");
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])/.test(pwd)) {
      return t("profile.passwordMustContainUpperLower");
    }
    if (!/(?=.*\d)/.test(pwd)) {
      return t("profile.passwordMustContainNumber");
    }
    return "";
  };

  const handleNewPasswordChange = (text: string) => {
    setNewPassword(text);
    const error = validateNewPassword(text);
    setNewPasswordError(error);
    if (confirmNewPassword) {
      if (text !== confirmNewPassword) {
        setConfirmPasswordError(t("profile.passwordsDoNotMatch"));
      } else {
        setConfirmPasswordError("");
      }
    }
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmNewPassword(text);
    if (!text) {
      setConfirmPasswordError("");
    } else if (text !== newPassword) {
      setConfirmPasswordError(t("profile.passwordsDoNotMatch"));
    } else {
      setConfirmPasswordError("");
    }
  };

  const handleChangePassword = async () => {
    if (!user?.id) return;
    setCurrentPasswordError("");
    setNewPasswordError("");
    setConfirmPasswordError("");

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      if (!currentPassword)
        setCurrentPasswordError(t("profile.currentPasswordRequired"));
      if (!newPassword) setNewPasswordError(t("profile.newPasswordRequired"));
      if (!confirmNewPassword)
        setConfirmPasswordError(t("profile.pleaseConfirmPassword"));
      showToast(t("profile.fillAllPasswordFields"), "error");
      return;
    }

    const passwordValidationError = validateNewPassword(newPassword);
    if (passwordValidationError) {
      setNewPasswordError(passwordValidationError);
      showToast(passwordValidationError, "error");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setConfirmPasswordError(t("profile.passwordsDoNotMatch"));
      showToast(t("profile.passwordsDoNotMatch"), "error");
      return;
    }

    setPasswordLoading(true);
    try {
      const { data: sessionData, error: verifyError } =
        await supabase.auth.getSession();

      if (verifyError || !sessionData.session) {
        showToast(t("profile.pleaseLogInAgain"), "error");
        setPasswordLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email || "",
        password: currentPassword,
      });

      if (signInError) {
        setCurrentPasswordError(t("profile.currentPasswordIncorrect"));
        showToast(t("profile.currentPasswordIncorrect"), "error");
        setPasswordLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        showToast(
          updateError.message || t("profile.failedToUpdatePassword"),
          "error"
        );
        setPasswordLoading(false);
        return;
      }

      showToast(t("profile.passwordUpdatedSuccessfully"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setCurrentPasswordError("");
      setNewPasswordError("");
      setConfirmPasswordError("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setChangePasswordModalVisible(false);

      setTimeout(async () => {
        try {
          await supabase.auth.signOut({ scope: "global" });
          router.replace("/(auth)/login");
        } catch (signOutError) {
          router.replace("/(auth)/login");
        }
      }, 1500);
    } catch (error: any) {
      showToast(error?.message || "An unexpected error occurred", "error");
    } finally {
      setPasswordLoading(false);
    }
  };

  const formatArrayValue = (value: string[] | undefined) => {
    if (!value || value.length === 0) return t("common.notSet");
    return value.join(", ");
  };

  const getCurrencySymbol = (currencyCode: string | undefined): string => {
    const currencySymbols: Record<string, string> = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      JPY: "¥",
      CNY: "¥",
      PHP: "₱",
      INR: "₹",
      AUD: "A$",
      CAD: "C$",
      SGD: "S$",
    };
    return currencySymbols[currencyCode || "USD"] || "$";
  };

  const formatCurrency = (
    amount: number | undefined,
    currency: string | undefined
  ) => {
    if (!amount && amount !== 0) return t("common.notSet");
    // Ensure amount is a valid number before calling toFixed
    if (typeof amount !== "number" || isNaN(amount)) return t("common.notSet");
    const symbol = getCurrencySymbol(currency);
    return `${symbol} ${amount.toFixed(2)}`;
  };

  const formatHeight = () => {
    const height = userProfile?.height;
    if (!height) return t("common.notSet");
    const unit = userProfile?.height_unit || "cm";
    return `${height} ${unit}`;
  };

  const formatWeight = () => {
    const weight = userProfile?.weight;
    if (!weight) return t("common.notSet");
    const unit = userProfile?.weight_unit || "kg";
    return `${weight} ${unit}`;
  };

  const formatWorkoutDuration = (minutes: number | undefined) => {
    if (!minutes) return t("common.notSet");
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const getMoodDisplay = (mood: string | undefined) => {
    if (!mood) return t("common.notSet");
    const translation = t(`moods.${mood}`);
    return translation.includes("moods.") ? mood : translation;
  };

  const getGenderDisplay = (gender: string | undefined) => {
    if (!gender) return t("common.notSet");
    const translation = t(`genders.${gender}`);
    return translation.includes("genders.") ? gender : translation;
  };

  const getFitnessLevelDisplay = (level: string | undefined) => {
    if (!level) return t("common.notSet");
    const translation = t(`fitnessLevels.${level}`);
    return translation.includes("fitnessLevels.") ? level : translation;
  };

  const getWorkoutLocationDisplay = (location: string | undefined) => {
    if (!location) return t("common.notSet");
    const translation = t(`workoutLocations.${location}`);
    return translation.includes("workoutLocations.") ? location : translation;
  };

  const getDietaryPreferenceDisplay = (preference: string | undefined) => {
    if (!preference) return t("common.notSet");
    const translation = t(`dietaryPreferences.${preference}`);
    return translation.includes("dietaryPreferences.")
      ? preference
      : translation;
  };

  const getAgeRangeDisplay = (ageRange: string | undefined) => {
    if (!ageRange) return t("common.notSet");
    const ageRangeKeyMap: Record<string, string> = {
      "below-18": "ageRanges.below18",
      "18-25": "ageRanges.range1825",
      "26-35": "ageRanges.range2635",
      "36-45": "ageRanges.range3645",
      "46+": "ageRanges.range46plus",
    };
    const translationKey = ageRangeKeyMap[ageRange];
    return translationKey ? t(translationKey) : ageRange;
  };

  const getTargetMusclesDisplay = (muscles: string[] | undefined) => {
    if (!muscles || muscles.length === 0) return t("common.notSet");
    return muscles
      .map((muscle) => t(`targetMuscles.${muscle}`) || muscle)
      .join(", ");
  };

  const getEquipmentDisplay = (equipment: string[] | undefined) => {
    if (!equipment || equipment.length === 0) return t("common.notSet");
    return equipment
      .map((eq) => {
        const allStandardOptions = [
          ...homeEquipmentOptions,
          ...gymEquipmentOptions,
        ];
        let matchingOption = allStandardOptions.find(
          (option) => option.code.toLowerCase() === eq.toLowerCase()
        );
        if (!matchingOption) {
          matchingOption = allStandardOptions.find(
            (option) => formatTextForDatabase(option.code) === eq
          );
        }
        if (matchingOption) {
          const translation = t(matchingOption.label);
          return translation.includes("equipments.") ? eq : translation;
        }
        const translation = t(`equipments.${eq}`);
        return translation.includes("equipments.") ? eq : translation;
      })
      .join(", ");
  };

  const getHealthConditionsDisplay = (conditions: string[] | undefined) => {
    if (!conditions || conditions.length === 0) return t("common.notSet");
    return conditions
      .map((condition) => t(`healthConditions.${condition}`) || condition)
      .join(", ");
  };

  const getWeeklyFrequencyDisplay = (frequency: string[] | undefined) => {
    if (!frequency || frequency.length === 0) return t("common.notSet");
    return frequency.map((day) => t(`weekDays.${day}`) || day).join(", ");
  };

  const getMealPlanDurationDisplay = (duration: string[] | undefined) => {
    if (!duration || duration.length === 0) return t("common.notSet");
    return duration.map((d) => t(`mealPlanDuration.${d}`) || d).join(", ");
  };

  const getCountryDisplay = (country: string | undefined) => {
    if (!country) return t("common.notSet");
    return country;
  };

  const getRegionDisplay = (region: string | undefined) => {
    if (!region) return t("common.notSet");
    return region;
  };

  const getFitnessGoalDisplay = (goal: string | undefined) => {
    if (!goal) return t("common.notSet");
    const translation = t(`fitnessGoals.${goal}`);
    return translation.includes("fitnessGoals.") ? goal : translation;
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#14b8a6" />
          <Text className="text-slate-600 text-lg mt-4">
            {t("profile.loadingProfile")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView className="flex-1 bg-slate-50">
        {/* Header with Back Button */}
        <View className="bg-white pt-10 pb-5 px-6 border-b border-slate-200">
          <View className="flex-row items-center mb-3">
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/my-profile")}
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
            >
              <Ionicons name="arrow-back" size={20} color="#b45309" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-slate-900 text-3xl font-extrabold mt-1">
                {t("profile.manageProfile")}
              </Text>
            </View>
          </View>
          <Text className="text-slate-600 text-[13px] mt-1 ml-12">
            {t("profile.viewEditProfile")}
          </Text>
          <View className="h-1 w-16 bg-amber-500 rounded-full mt-3 ml-12" />
        </View>

        <ScrollView className="flex-1 px-6 py-5">
          {/* Personal Information */}
          <SectionCard title={t("profile.personalInformation")}>
            <ProfileField
              label={t("profile.fullName")}
              value={userProfile?.full_name || t("common.notSet")}
              icon="person"
              onEdit={() =>
                handleEditField("full_name", userProfile?.full_name)
              }
              isEditable
            />
            <Divider />
            <ProfileField
              label={t("profile.nickname")}
              value={userProfile?.nickname || t("common.notSet")}
              icon="at"
              onEdit={() => handleEditField("nickname", userProfile?.nickname)}
              isEditable
            />
            <Divider />
            <ProfileField
              label={t("profile.ageRange")}
              value={userProfile?.age_range || t("common.notSet")}
              icon="calendar"
              formatValue={getAgeRangeDisplay}
              onEdit={() =>
                handleEditField("age_range", userProfile?.age_range)
              }
              isEditable
            />
            <Divider />
            <ProfileField
              label={t("profile.gender")}
              value={userProfile?.gender || t("common.notSet")}
              icon="male-female"
              formatValue={getGenderDisplay}
              onEdit={() => handleEditField("gender", userProfile?.gender)}
              isEditable
            />
          </SectionCard>

          {/* Physical Information */}
          <SectionCard title={t("profile.physicalInformation")}>
            <ProfileField
              label={t("profile.height")}
              value={userProfile?.height || t("common.notSet")}
              icon="resize"
              formatValue={formatHeight}
              onEdit={() => handleEditField("height", userProfile?.height)}
              isEditable
            />
            <Divider />
            <ProfileField
              label={t("profile.weight")}
              value={userProfile?.weight || t("common.notSet")}
              icon="fitness"
              formatValue={formatWeight}
              onEdit={() => handleEditField("weight", userProfile?.weight)}
              isEditable
            />
          </SectionCard>

          {/* Location Information */}
          <SectionCard title={t("profile.location")}>
            <ProfileField
              label={t("profile.country")}
              value={userProfile?.country || t("common.notSet")}
              icon="globe"
              formatValue={getCountryDisplay}
              onEdit={() => handleEditField("country", userProfile?.country)}
              isEditable
            />
            <Divider />
            <ProfileField
              label={t("profile.regionProvince")}
              value={userProfile?.region_province || t("common.notSet")}
              icon="location"
              formatValue={getRegionDisplay}
              onEdit={() =>
                handleEditField("region_province", userProfile?.region_province)
              }
              isEditable
            />
          </SectionCard>

          {/* Fitness Information */}
          <SectionCard title={t("profile.fitnessWorkout")}>
            <ProfileField
              label={t("profile.fitnessGoal")}
              value={userProfile?.fitness_goal || t("common.notSet")}
              icon="trophy"
              formatValue={getFitnessGoalDisplay}
              onEdit={() =>
                handleEditField("fitness_goal", userProfile?.fitness_goal)
              }
              isEditable
            />
            <Divider />
            <ProfileField
              label={t("profile.fitnessLevel")}
              value={userProfile?.fitness_level || t("common.notSet")}
              icon="trending-up"
              formatValue={getFitnessLevelDisplay}
              onEdit={() =>
                handleEditField("fitness_level", userProfile?.fitness_level)
              }
              isEditable
            />
            <Divider />
            <ProfileField
              label={t("profile.workoutLocation")}
              value={userProfile?.workout_location || t("common.notSet")}
              icon="home"
              formatValue={getWorkoutLocationDisplay}
              onEdit={() =>
                handleEditField(
                  "workout_location",
                  userProfile?.workout_location
                )
              }
              isEditable
            />
            <Divider />
            <CustomProfileField
              label={t("profile.equipment")}
              value={userProfile?.equipment_list || []}
              icon="barbell"
              customDisplay={
                <EquipmentDisplay equipment={userProfile?.equipment_list} />
              }
              onEdit={() =>
                handleEditField("equipment_list", userProfile?.equipment_list)
              }
              isEditable
            />
            <Divider />
            <ProfileField
              label={t("profile.workoutDuration")}
              value={
                userProfile?.workout_duration_minutes || t("common.notSet")
              }
              icon="time"
              formatValue={formatWorkoutDuration}
              onEdit={() =>
                handleEditField(
                  "workout_duration_minutes",
                  userProfile?.workout_duration_minutes
                )
              }
              isEditable
            />
            <Divider />
            <CustomProfileField
              label={t("profile.weeklyFrequency")}
              value={userProfile?.weekly_frequency || []}
              icon="calendar-outline"
              customDisplay={
                <WeeklyFrequencyDisplay
                  frequency={userProfile?.weekly_frequency}
                />
              }
              onEdit={() =>
                handleEditField(
                  "weekly_frequency",
                  userProfile?.weekly_frequency
                )
              }
              isEditable
            />
            <Divider />
            <CustomProfileField
              label={t("profile.targetMuscleGroups")}
              value={userProfile?.target_muscle_groups || []}
              icon="body"
              customDisplay={
                <TargetMusclesDisplay
                  muscles={userProfile?.target_muscle_groups}
                />
              }
              onEdit={() =>
                handleEditField(
                  "target_muscle_groups",
                  userProfile?.target_muscle_groups
                )
              }
              isEditable
            />
          </SectionCard>

          {/* Dietary Information */}
          <SectionCard title={t("profile.dietaryNutrition")}>
            <ProfileField
              label={t("profile.dietaryPreference")}
              value={userProfile?.dietary_preference || t("common.notSet")}
              icon="restaurant"
              formatValue={getDietaryPreferenceDisplay}
              onEdit={() =>
                handleEditField(
                  "dietary_preference",
                  userProfile?.dietary_preference
                )
              }
              isEditable
            />
            <Divider />
            <ProfileField
              label={t("profile.weeklyBudget")}
              value={userProfile?.weekly_budget || t("common.notSet")}
              icon="card"
              formatValue={(value) =>
                formatCurrency(
                  value,
                  userProfile?.weekly_budget_currency || "USD"
                )
              }
              onEdit={() =>
                handleEditField("weekly_budget", userProfile?.weekly_budget)
              }
              isEditable
            />
            <Divider />
            <CustomProfileField
              label={t("profile.mealPlanDuration")}
              value={userProfile?.meal_plan_duration || []}
              icon="calendar"
              customDisplay={
                <MealPlanDurationDisplay
                  duration={userProfile?.meal_plan_duration}
                />
              }
              onEdit={() =>
                handleEditField(
                  "meal_plan_duration",
                  userProfile?.meal_plan_duration
                )
              }
              isEditable
            />
          </SectionCard>

          {/* Health Information */}
          <SectionCard title={t("profile.healthWellness")}>
            <CustomProfileField
              label={t("profile.healthConditions")}
              value={userProfile?.health_conditions || []}
              icon="medical"
              customDisplay={
                <HealthConditionsDisplay
                  conditions={userProfile?.health_conditions}
                />
              }
              onEdit={() =>
                handleEditField(
                  "health_conditions",
                  userProfile?.health_conditions
                )
              }
              isEditable
            />
          </SectionCard>

          {/* Account Information */}
          <SectionCard title={t("profile.accountInformation")}>
            <ProfileField
              label={t("profile.memberSince")}
              value={userProfile?.created_at || t("common.notSet")}
              icon="calendar"
              formatValue={(value) =>
                value
                  ? new Date(value).toLocaleDateString()
                  : t("common.notSet")
              }
              isEditable={false}
            />
            <Divider />
            <TouchableOpacity
              onPress={() => setChangePasswordModalVisible(true)}
              className="flex-row items-center justify-between py-4 px-4 active:bg-slate-50"
            >
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-4">
                  <Ionicons name="key" size={20} color="#3b82f6" />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-medium text-slate-500 mb-0.5">
                    {t("profile.password")}
                  </Text>
                  <Text className="text-blue-600 text-[15px] font-semibold">
                    {t("profile.changePassword")}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </SectionCard>

          <View className="h-10" />
        </ScrollView>

        {/* Edit Text Modal */}
        <Modal
          visible={editModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEditModalVisible(false)}
        >
          <Pressable
            onPress={() => setEditModalVisible(false)}
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
                padding: 20,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 15,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 15,
                    }),
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                Edit{" "}
                {editingField
                  ?.replace(/_/g, " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
              </Text>
              <TextInput
                value={editValue}
                onChangeText={setEditValue}
                placeholder={
                  arrayFields.includes(editingField || "")
                    ? `Enter items separated by commas`
                    : `Enter ${editingField?.replace(/_/g, " ")}`
                }
                style={{
                  borderWidth: 1,
                  borderColor: "#d1d5db",
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 16,
                  marginBottom: 20,
                  backgroundColor: "#f9fafb",
                }}
                keyboardType={
                  editingField === "weekly_budget" ? "numeric" : "default"
                }
                multiline={arrayFields.includes(editingField || "")}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setEditModalVisible(false)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveEdit}
                  disabled={saving}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: saving ? 0.7 : 1,
                    minWidth: 80,
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Radio Button Modal for Fitness Level */}
        <Modal
          visible={radioModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setRadioModalVisible(false)}
        >
          <Pressable
            onPress={() => setRadioModalVisible(false)}
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
                padding: 20,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 15,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 15,
                    }),
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 20,
                  textAlign: "center",
                }}
              >
                {t("profile.selectFitnessLevel")}
              </Text>
              <View style={{ marginBottom: 20 }}>
                {["beginner", "intermediate", "advanced"].map((level) => (
                  <TouchableOpacity
                    key={level}
                    onPress={() => setSelectedRadioValue(level)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      marginBottom: 8,
                      backgroundColor:
                        selectedRadioValue === level ? "#f0fdfa" : "#f9fafb",
                      borderWidth: 1,
                      borderColor:
                        selectedRadioValue === level ? "#14b8a6" : "#e5e7eb",
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor:
                          selectedRadioValue === level ? "#14b8a6" : "#d1d5db",
                        marginRight: 12,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selectedRadioValue === level && (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: "#14b8a6",
                          }}
                        />
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color:
                          selectedRadioValue === level ? "#0f766e" : "#374151",
                      }}
                    >
                      {t(`fitnessLevels.${level}`) ||
                        level.charAt(0).toUpperCase() + level.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setRadioModalVisible(false)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveRadioEdit}
                  disabled={saving}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: saving ? 0.7 : 1,
                    minWidth: 80,
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Age Range Modal */}
        <Modal
          visible={ageRangeModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAgeRangeModalVisible(false)}
        >
          <Pressable
            onPress={() => setAgeRangeModalVisible(false)}
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
                padding: 20,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 15,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 15,
                    }),
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 20,
                  textAlign: "center",
                }}
              >
                {t("profile.selectAgeRange")}
              </Text>
              <View style={{ marginBottom: 20 }}>
                {[
                  { value: "below-18", labelKey: "ageRanges.below18" },
                  { value: "18-25", labelKey: "ageRanges.range1825" },
                  { value: "26-35", labelKey: "ageRanges.range2635" },
                  { value: "36-45", labelKey: "ageRanges.range3645" },
                  { value: "46+", labelKey: "ageRanges.range46plus" },
                ].map((ageRange) => (
                  <TouchableOpacity
                    key={ageRange.value}
                    onPress={() => setSelectedAgeRange(ageRange.value)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      marginBottom: 8,
                      backgroundColor:
                        selectedAgeRange === ageRange.value
                          ? "#f0fdfa"
                          : "#f9fafb",
                      borderWidth: 1,
                      borderColor:
                        selectedAgeRange === ageRange.value
                          ? "#14b8a6"
                          : "#e5e7eb",
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor:
                          selectedAgeRange === ageRange.value
                            ? "#14b8a6"
                            : "#d1d5db",
                        marginRight: 12,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selectedAgeRange === ageRange.value && (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: "#14b8a6",
                          }}
                        />
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color:
                          selectedAgeRange === ageRange.value
                            ? "#0f766e"
                            : "#374151",
                      }}
                    >
                      {t(ageRange.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setAgeRangeModalVisible(false)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveAgeRangeEdit}
                  disabled={saving}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: saving ? 0.7 : 1,
                    minWidth: 80,
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Gender Modal */}
        <Modal
          visible={genderModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setGenderModalVisible(false)}
        >
          <Pressable
            onPress={() => setGenderModalVisible(false)}
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
                padding: 20,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 15,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 15,
                    }),
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 20,
                  textAlign: "center",
                }}
              >
                {t("profile.selectGender")}
              </Text>
              <View style={{ marginBottom: 20 }}>
                {[
                  { value: "male", labelKey: "genders.male" },
                  { value: "female", labelKey: "genders.female" },
                  { value: "non_binary", labelKey: "genders.non_binary" },
                  {
                    value: "prefer_not_to_say",
                    labelKey: "genders.prefer_not_to_say",
                  },
                  { value: "other", labelKey: "genders.other" },
                ].map((gender) => (
                  <TouchableOpacity
                    key={gender.value}
                    onPress={() => setSelectedGender(gender.value)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      marginBottom: 8,
                      backgroundColor:
                        selectedGender === gender.value ? "#f0fdfa" : "#f9fafb",
                      borderWidth: 1,
                      borderColor:
                        selectedGender === gender.value ? "#14b8a6" : "#e5e7eb",
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor:
                          selectedGender === gender.value
                            ? "#14b8a6"
                            : "#d1d5db",
                        marginRight: 12,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selectedGender === gender.value && (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: "#14b8a6",
                          }}
                        />
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color:
                          selectedGender === gender.value
                            ? "#0f766e"
                            : "#374151",
                      }}
                    >
                      {t(gender.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setGenderModalVisible(false)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveGenderEdit}
                  disabled={saving}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: saving ? 0.7 : 1,
                    minWidth: 80,
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Height Modal */}
        <Modal
          visible={heightModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setHeightModalVisible(false)}
        >
          <Pressable
            onPress={() => setHeightModalVisible(false)}
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
                padding: 20,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 15,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 15,
                    }),
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 20,
                  textAlign: "center",
                }}
              >
                {t("profile.enterHeight")}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  marginBottom: 20,
                  backgroundColor: "#f3f4f6",
                  borderRadius: 12,
                  padding: 4,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    if (heightUnit !== "cm" && heightValue) {
                      const feetValue = parseFloat(heightValue);
                      if (!isNaN(feetValue)) {
                        const feet = Math.floor(feetValue);
                        const inches = Math.round((feetValue - feet) * 10);
                        const totalInches = feet * 12 + inches;
                        const cm = totalInches * 2.54;
                        setHeightValue(cm.toFixed(1));
                      }
                    }
                    setHeightUnit("cm");
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    backgroundColor:
                      heightUnit === "cm" ? "#14b8a6" : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: heightUnit === "cm" ? "#fff" : "#374151",
                      textAlign: "center",
                    }}
                  >
                    cm
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (heightUnit !== "ft" && heightValue) {
                      const cm = parseFloat(heightValue);
                      if (!isNaN(cm)) {
                        const totalInches = cm / 2.54;
                        const feet = Math.floor(totalInches / 12);
                        const inches = Math.round(totalInches % 12);
                        setHeightValue(`${feet}.${inches}`);
                      }
                    }
                    setHeightUnit("ft");
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    backgroundColor:
                      heightUnit === "ft" ? "#14b8a6" : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: heightUnit === "ft" ? "#fff" : "#374151",
                      textAlign: "center",
                    }}
                  >
                    ft
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ marginBottom: 20, alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: 8,
                  }}
                >
                  Height ({heightUnit.toLowerCase()})
                </Text>
                <TextInput
                  value={heightValue}
                  onChangeText={setHeightValue}
                  placeholder={`Enter height in ${heightUnit}`}
                  keyboardType="numeric"
                  style={{
                    fontSize: 24,
                    paddingVertical: 12,
                    paddingHorizontal: 0,
                    borderBottomWidth: 3,
                    borderBottomColor: "#f59e0b",
                    color: "#111827",
                    width: "60%",
                    textAlign: "center",
                  }}
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setHeightModalVisible(false)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveHeightEdit}
                  disabled={saving}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: saving ? 0.7 : 1,
                    minWidth: 80,
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Weight Modal */}
        <Modal
          visible={weightModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setWeightModalVisible(false)}
        >
          <Pressable
            onPress={() => setWeightModalVisible(false)}
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
                padding: 20,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 15,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 15,
                    }),
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 20,
                  textAlign: "center",
                }}
              >
                {t("profile.enterWeight")}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  marginBottom: 20,
                  backgroundColor: "#f3f4f6",
                  borderRadius: 12,
                  padding: 4,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    if (weightUnit !== "kg" && weightValue) {
                      const pounds = parseFloat(weightValue);
                      if (!isNaN(pounds)) {
                        const kg = pounds / 2.20462;
                        setWeightValue(kg.toFixed(1));
                      }
                    }
                    setWeightUnit("kg");
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    backgroundColor:
                      weightUnit === "kg" ? "#14b8a6" : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: weightUnit === "kg" ? "#fff" : "#374151",
                      textAlign: "center",
                    }}
                  >
                    kg
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (weightUnit !== "lbs" && weightValue) {
                      const kg = parseFloat(weightValue);
                      if (!isNaN(kg)) {
                        const pounds = kg * 2.20462;
                        setWeightValue(pounds.toFixed(1));
                      }
                    }
                    setWeightUnit("lbs");
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    backgroundColor:
                      weightUnit === "lbs" ? "#14b8a6" : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: weightUnit === "lbs" ? "#fff" : "#374151",
                      textAlign: "center",
                    }}
                  >
                    lbs
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ marginBottom: 20, alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: 8,
                  }}
                >
                  Weight ({weightUnit.toLowerCase()})
                </Text>
                <TextInput
                  value={weightValue}
                  onChangeText={setWeightValue}
                  placeholder={`Enter weight in ${weightUnit}`}
                  keyboardType="numeric"
                  style={{
                    fontSize: 24,
                    paddingVertical: 12,
                    paddingHorizontal: 0,
                    borderBottomWidth: 3,
                    borderBottomColor: "#f59e0b",
                    color: "#111827",
                    width: "60%",
                    textAlign: "center",
                  }}
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setWeightModalVisible(false)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveWeightEdit}
                  disabled={saving}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: saving ? 0.7 : 1,
                    minWidth: 80,
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Change Password Modal */}
        <Modal
          visible={changePasswordModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setChangePasswordModalVisible(false)}
        >
          <Pressable
            onPress={() => setChangePasswordModalVisible(false)}
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
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 20,
            }}
          >
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 20,
                padding: 24,
                width: "100%",
                maxWidth: 500,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 15,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 15,
                    }),
              }}
            >
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "700",
                  color: "#0f172a",
                  marginBottom: 8,
                  textAlign: "center",
                }}
              >
                {t("profile.changePassword")}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: "#64748b",
                  marginBottom: 20,
                  textAlign: "center",
                }}
              >
                {t("profile.enterCurrentPasswordDescription")}
              </Text>
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#475569",
                    marginBottom: 8,
                  }}
                >
                  {t("profile.currentPassword")}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#f8fafc",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    borderWidth: 0.5,
                    borderColor: currentPasswordError
                      ? "#ef4444"
                      : currentPassword
                        ? "#0f172a"
                        : "#e2e8f0",
                  }}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={
                      currentPasswordError
                        ? "#ef4444"
                        : currentPassword
                          ? "#0f172a"
                          : "#64748b"
                    }
                  />
                  <TextInput
                    value={currentPassword}
                    onChangeText={(text) => {
                      setCurrentPassword(text);
                      if (currentPasswordError) setCurrentPasswordError("");
                    }}
                    placeholder="Enter current password"
                    secureTextEntry={!showCurrentPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      fontSize: 15,
                      color: "#0f172a",
                    }}
                    placeholderTextColor="#94a3b8"
                  />
                  <TouchableOpacity
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                    hitSlop={8}
                    style={{ padding: 4 }}
                  >
                    <Ionicons
                      name={
                        showCurrentPassword ? "eye-off-outline" : "eye-outline"
                      }
                      size={20}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                </View>
                {currentPasswordError ? (
                  <Text
                    style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}
                  >
                    {currentPasswordError}
                  </Text>
                ) : null}
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#475569",
                    marginBottom: 8,
                  }}
                >
                  {t("profile.newPassword")}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#f8fafc",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    borderWidth: 0.5,
                    borderColor: newPasswordError
                      ? "#ef4444"
                      : newPassword && !newPasswordError
                        ? "#10b981"
                        : "#e2e8f0",
                  }}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={
                      newPasswordError
                        ? "#ef4444"
                        : newPassword && !newPasswordError
                          ? "#10b981"
                          : "#64748b"
                    }
                  />
                  <TextInput
                    value={newPassword}
                    onChangeText={handleNewPasswordChange}
                    placeholder="Enter new password"
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      fontSize: 15,
                      color: "#0f172a",
                    }}
                    placeholderTextColor="#94a3b8"
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={{ padding: 4 }}
                  >
                    <Ionicons
                      name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                </View>
                {newPasswordError ? (
                  <Text
                    style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}
                  >
                    {newPasswordError}
                  </Text>
                ) : newPassword && !newPasswordError ? (
                  <Text
                    style={{ color: "#0f766e", fontSize: 12, marginTop: 4 }}
                  >
                    {t("profile.passwordMeetsRequirements")}
                  </Text>
                ) : null}
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#475569",
                    marginBottom: 8,
                  }}
                >
                  {t("profile.confirmNewPassword")}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#f8fafc",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    borderWidth: 0.5,
                    borderColor: confirmPasswordError
                      ? "#ef4444"
                      : confirmNewPassword && !confirmPasswordError
                        ? "#10b981"
                        : "#e2e8f0",
                  }}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={
                      confirmPasswordError
                        ? "#ef4444"
                        : confirmNewPassword && !confirmPasswordError
                          ? "#10b981"
                          : "#64748b"
                    }
                  />
                  <TextInput
                    value={confirmNewPassword}
                    onChangeText={handleConfirmPasswordChange}
                    placeholder="Confirm new password"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      fontSize: 15,
                      color: "#0f172a",
                    }}
                    placeholderTextColor="#94a3b8"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ padding: 4 }}
                  >
                    <Ionicons
                      name={
                        showConfirmPassword ? "eye-off-outline" : "eye-outline"
                      }
                      size={20}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                </View>
                {confirmPasswordError ? (
                  <Text
                    style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}
                  >
                    {confirmPasswordError}
                  </Text>
                ) : confirmNewPassword && !confirmPasswordError ? (
                  <Text
                    style={{ color: "#0f766e", fontSize: 12, marginTop: 4 }}
                  >
                    {t("profile.passwordsMatch")}
                  </Text>
                ) : null}
              </View>

              <View
                style={{
                  backgroundColor: "#ccfbf1",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: "#99f6e4",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: "#0f766e",
                    marginBottom: 4,
                    fontWeight: "500",
                  }}
                >
                  {t("profile.passwordRequirement1")}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: "#0f766e",
                    marginBottom: 4,
                    fontWeight: "500",
                  }}
                >
                  {t("profile.passwordRequirement2")}
                </Text>
                <Text
                  style={{ fontSize: 12, color: "#0f766e", fontWeight: "500" }}
                >
                  {t("profile.passwordRequirement3")}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleForgotPasswordClick}
                style={{ alignItems: "center", marginBottom: 20 }}
              >
                <Text
                  style={{ fontSize: 14, color: "#f59e42", fontWeight: "600" }}
                >
                  {t("profile.forgotCurrentPassword")}
                </Text>
              </TouchableOpacity>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    setChangePasswordModalVisible(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmNewPassword("");
                    setCurrentPasswordError("");
                    setNewPasswordError("");
                    setConfirmPasswordError("");
                    setShowCurrentPassword(false);
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                  }}
                  disabled={passwordLoading}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleChangePassword}
                  disabled={passwordLoading}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: passwordLoading ? 0.7 : 1,
                    minWidth: 80,
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {passwordLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {t("profile.updatePassword")}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Country Selection Modal */}
        <Modal
          visible={countryModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCountryModalVisible(false)}
        >
          <Pressable
            onPress={() => setCountryModalVisible(false)}
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
                borderRadius: 16,
                width: "100%",
                maxWidth: 350,
                maxHeight: "70%",
                borderWidth: 1,
                borderColor: "#e5e7eb",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 10px 25px rgba(0,0,0,0.2)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.2,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 10,
                    }),
              }}
            >
              <View
                style={{
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: "#e5e7eb",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "600", color: "#111827" }}
                >
                  {t("profile.selectCountry")}
                </Text>
                <TouchableOpacity
                  onPress={() => setCountryModalVisible(false)}
                  style={{ padding: 4 }}
                >
                  <Text style={{ fontSize: 18, color: "#6b7280" }}>×</Text>
                </TouchableOpacity>
              </View>
              <View style={{ padding: 16, paddingBottom: 8 }}>
                <TextInput
                  placeholder="Search country..."
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                  style={{
                    borderWidth: 1,
                    borderColor: "#d1d5db",
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 14,
                    backgroundColor: "#f9fafb",
                  }}
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <ScrollView
                style={{ maxHeight: 300, paddingRight: 8 }}
                showsVerticalScrollIndicator={true}
              >
                {countriesData
                  .filter((country) =>
                    country.name
                      .toLowerCase()
                      .includes(countrySearch.toLowerCase())
                  )
                  .map((country, index) => (
                    <TouchableOpacity
                      key={country.name}
                      onPress={() => {
                        setSelectedCountry(country.name);
                      }}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderBottomWidth:
                          index <
                          countriesData.filter((c) =>
                            c.name
                              .toLowerCase()
                              .includes(countrySearch.toLowerCase())
                          ).length -
                            1
                            ? 1
                            : 0,
                        borderBottomColor: "#f3f4f6",
                        backgroundColor:
                          selectedCountry === country.name
                            ? "#f0fdfa"
                            : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight:
                            selectedCountry === country.name ? "500" : "400",
                          color:
                            selectedCountry === country.name
                              ? "#0f766e"
                              : "#374151",
                        }}
                      >
                        {country.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
              <View
                style={{
                  padding: 16,
                  borderTopWidth: 1,
                  borderTopColor: "#e5e7eb",
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <TouchableOpacity
                  onPress={() => setCountryModalVisible(false)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "500",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveCountryEdit}
                  disabled={!selectedCountry || saving}
                  style={{
                    borderRadius: 6,
                    overflow: "hidden",
                    minWidth: 70,
                  }}
                >
                  {selectedCountry && !saving ? (
                    <LinearGradient
                      colors={["#0f766e", "#14b8a6"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "500",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        alignItems: "center",
                        backgroundColor: "#d1d5db",
                      }}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "500",
                            color: "#9ca3af",
                          }}
                        >
                          Save
                        </Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* State/Region Selection Modal */}
        <Modal
          visible={stateModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setStateModalVisible(false)}
        >
          <Pressable
            onPress={() => setStateModalVisible(false)}
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
                borderRadius: 16,
                width: "100%",
                maxWidth: 350,
                maxHeight: "70%",
                borderWidth: 1,
                borderColor: "#e5e7eb",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 10px 25px rgba(0,0,0,0.2)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.2,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 10,
                    }),
              }}
            >
              <View
                style={{
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: "#e5e7eb",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flex: 1,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setStateModalVisible(false);
                      setCountryModalVisible(true);
                    }}
                    style={{ padding: 4, marginRight: 8 }}
                  >
                    <Text style={{ fontSize: 16, color: "#6b7280" }}>←</Text>
                  </TouchableOpacity>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#111827",
                    }}
                  >
                    Select Region/State
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setStateModalVisible(false)}
                  style={{ padding: 4 }}
                >
                  <Text style={{ fontSize: 18, color: "#6b7280" }}>×</Text>
                </TouchableOpacity>
              </View>
              {availableStates.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text
                    style={{
                      color: "#6b7280",
                      fontSize: 14,
                      textAlign: "center",
                    }}
                  >
                    {t("profile.pleaseSelectCountryFirst")}
                  </Text>
                </View>
              ) : (
                <>
                  <View style={{ padding: 16, paddingBottom: 8 }}>
                    <TextInput
                      placeholder="Search region/state..."
                      value={stateSearch}
                      onChangeText={setStateSearch}
                      style={{
                        borderWidth: 1,
                        borderColor: "#d1d5db",
                        borderRadius: 8,
                        padding: 10,
                        fontSize: 14,
                        backgroundColor: "#f9fafb",
                      }}
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <ScrollView
                    style={{ maxHeight: 300, paddingRight: 8 }}
                    showsVerticalScrollIndicator={true}
                  >
                    {availableStates
                      .filter((state) =>
                        state.toLowerCase().includes(stateSearch.toLowerCase())
                      )
                      .map((state, index) => (
                        <TouchableOpacity
                          key={state}
                          onPress={() => setSelectedState(state)}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            borderBottomWidth:
                              index <
                              availableStates.filter((s) =>
                                s
                                  .toLowerCase()
                                  .includes(stateSearch.toLowerCase())
                              ).length -
                                1
                                ? 1
                                : 0,
                            borderBottomColor: "#f3f4f6",
                            backgroundColor:
                              selectedState === state
                                ? "#f0fdfa"
                                : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight:
                                selectedState === state ? "500" : "400",
                              color:
                                selectedState === state ? "#0f766e" : "#374151",
                            }}
                          >
                            {state}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </>
              )}
              <View
                style={{
                  padding: 16,
                  borderTopWidth: 1,
                  borderTopColor: "#e5e7eb",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    setStateModalVisible(false);
                    setCountryModalVisible(true);
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "500",
                      color: "#374151",
                    }}
                  >
                    {t("common.back")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveStateEdit}
                  disabled={
                    availableStates.length === 0 || !selectedState || saving
                  }
                  style={{
                    borderRadius: 6,
                    overflow: "hidden",
                    minWidth: 70,
                  }}
                >
                  {availableStates.length > 0 && selectedState && !saving ? (
                    <LinearGradient
                      colors={["#0f766e", "#14b8a6"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "500",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        alignItems: "center",
                        backgroundColor: "#d1d5db",
                      }}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "500",
                            color: "#9ca3af",
                          }}
                        >
                          Save
                        </Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Fitness Goal Modal */}
        <Modal
          visible={fitnessGoalModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setFitnessGoalModalVisible(false)}
        >
          <Pressable
            onPress={() => setFitnessGoalModalVisible(false)}
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
                maxHeight: "80%",
                overflow: "hidden",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 15,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 15,
                    }),
              }}
            >
              <View style={{ padding: 20, paddingBottom: 0 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: "#111827",
                    marginBottom: 16,
                    textAlign: "center",
                  }}
                >
                  {t("profile.selectFitnessGoal")}
                </Text>
              </View>
              <ScrollView
                style={{ maxHeight: 350, paddingHorizontal: 20 }}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: 10 }}
              >
                {[
                  { value: "loseWeight", labelKey: "fitnessGoals.loseWeight" },
                  {
                    value: "buildMuscle",
                    labelKey: "fitnessGoals.buildMuscle",
                  },
                  {
                    value: "improveCardiovascular",
                    labelKey: "fitnessGoals.improveCardiovascular",
                  },
                  {
                    value: "increaseStrength",
                    labelKey: "fitnessGoals.increaseStrength",
                  },
                  {
                    value: "enhanceFlexibility",
                    labelKey: "fitnessGoals.enhanceFlexibility",
                  },
                  {
                    value: "buildStrength",
                    labelKey: "fitnessGoals.buildStrength",
                  },
                  { value: "getToned", labelKey: "fitnessGoals.getToned" },
                  { value: "getLean", labelKey: "fitnessGoals.getLean" },
                  { value: "mobility", labelKey: "fitnessGoals.mobility" },
                  { value: "endurance", labelKey: "fitnessGoals.endurance" },
                  {
                    value: "bodyBuilding",
                    labelKey: "fitnessGoals.bodyBuilding",
                  },
                  {
                    value: "stayHealthy",
                    labelKey: "fitnessGoals.stayHealthy",
                  },
                ].map((goal) => (
                  <TouchableOpacity
                    key={goal.value}
                    onPress={() => setSelectedFitnessGoal(goal.value)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      marginBottom: 8,
                      backgroundColor:
                        selectedFitnessGoal === goal.value
                          ? "#f0fdfa"
                          : "#f9fafb",
                      borderWidth: 1,
                      borderColor:
                        selectedFitnessGoal === goal.value
                          ? "#14b8a6"
                          : "#e5e7eb",
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor:
                          selectedFitnessGoal === goal.value
                            ? "#14b8a6"
                            : "#d1d5db",
                        marginRight: 12,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selectedFitnessGoal === goal.value && (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: "#14b8a6",
                          }}
                        />
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color:
                          selectedFitnessGoal === goal.value
                            ? "#0f766e"
                            : "#374151",
                      }}
                    >
                      {t(goal.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#e5e7eb",
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setFitnessGoalModalVisible(false)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveFitnessGoalEdit}
                  disabled={saving}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: saving ? 0.7 : 1,
                    minWidth: 80,
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Workout Location Modal */}
        <Modal
          visible={workoutLocationModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setWorkoutLocationModalVisible(false)}
        >
          <Pressable
            onPress={() => setWorkoutLocationModalVisible(false)}
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
                overflow: "hidden",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 15,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 15,
                    }),
              }}
            >
              <View style={{ padding: 20, paddingBottom: 0 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: "#111827",
                    marginBottom: 16,
                    textAlign: "center",
                  }}
                >
                  {t("profile.selectWorkoutLocation")}
                </Text>
              </View>
              <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
                {[
                  { value: "home", labelKey: "workoutLocations.home" },
                  { value: "gym", labelKey: "workoutLocations.gym" },
                ].map((location) => (
                  <TouchableOpacity
                    key={location.value}
                    onPress={() => setSelectedWorkoutLocation(location.value)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      marginBottom: 8,
                      backgroundColor:
                        selectedWorkoutLocation === location.value
                          ? "#f0fdfa"
                          : "#f9fafb",
                      borderWidth: 1,
                      borderColor:
                        selectedWorkoutLocation === location.value
                          ? "#14b8a6"
                          : "#e5e7eb",
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor:
                          selectedWorkoutLocation === location.value
                            ? "#14b8a6"
                            : "#d1d5db",
                        marginRight: 12,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selectedWorkoutLocation === location.value && (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: "#14b8a6",
                          }}
                        />
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color:
                          selectedWorkoutLocation === location.value
                            ? "#0f766e"
                            : "#374151",
                      }}
                    >
                      {t(location.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#e5e7eb",
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setWorkoutLocationModalVisible(false)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveWorkoutLocationEdit}
                  disabled={saving}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: saving ? 0.7 : 1,
                    minWidth: 80,
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Equipment Modal */}
        <Modal
          visible={equipmentModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEquipmentModalVisible(false)}
        >
          <Pressable
            onPress={() => setEquipmentModalVisible(false)}
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
                maxHeight: "80%",
                overflow: "hidden",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 15,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 15,
                    }),
              }}
            >
              <View style={{ padding: 20, paddingBottom: 0 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: "#111827",
                    marginBottom: 4,
                    textAlign: "center",
                  }}
                >
                  {t("profile.selectEquipment")}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: "#64748b",
                    marginBottom: 16,
                    textAlign: "center",
                  }}
                >
                  {userProfile?.workout_location === "gym"
                    ? t("profile.gymEquipment")
                    : t("profile.homeEquipment")}
                </Text>
              </View>
              <ScrollView
                style={{ maxHeight: 350, paddingHorizontal: 20 }}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: 10 }}
              >
                {(userProfile?.workout_location === "gym"
                  ? gymEquipmentOptions
                  : homeEquipmentOptions
                ).map((equipment) => (
                  <TouchableOpacity
                    key={equipment.code}
                    onPress={() => handleEquipmentSelection(equipment.code)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      marginBottom: 8,
                      backgroundColor: selectedEquipmentList.includes(
                        equipment.code
                      )
                        ? "#f0fdfa"
                        : "#f9fafb",
                      borderWidth: 1,
                      borderColor: selectedEquipmentList.includes(
                        equipment.code
                      )
                        ? "#14b8a6"
                        : "#e5e7eb",
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        borderWidth: 2,
                        borderColor: selectedEquipmentList.includes(
                          equipment.code
                        )
                          ? "#14b8a6"
                          : "#d1d5db",
                        marginRight: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: selectedEquipmentList.includes(
                          equipment.code
                        )
                          ? "#14b8a6"
                          : "transparent",
                      }}
                    >
                      {selectedEquipmentList.includes(equipment.code) && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color: selectedEquipmentList.includes(equipment.code)
                          ? "#0f766e"
                          : "#374151",
                      }}
                    >
                      {t(equipment.label) || equipment.code}
                    </Text>
                  </TouchableOpacity>
                ))}

                {selectedEquipmentList.includes("other") && (
                  <View style={{ marginTop: 12 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: "#374151",
                        marginBottom: 8,
                      }}
                    >
                      {t("profile.customEquipment")}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        marginBottom: 8,
                        gap: 8,
                      }}
                    >
                      <TextInput
                        value={currentOtherEquipment}
                        onChangeText={setCurrentOtherEquipment}
                        placeholder={t("profile.enterEquipmentName")}
                        style={{
                          flex: 1,
                          borderWidth: 1,
                          borderColor: "#d1d5db",
                          borderRadius: 8,
                          padding: 10,
                          fontSize: 14,
                          backgroundColor: "#f9fafb",
                        }}
                        placeholderTextColor="#9ca3af"
                      />
                      <TouchableOpacity
                        onPress={addCustomEquipment}
                        style={{
                          backgroundColor: "#14b8a6",
                          borderRadius: 8,
                          paddingHorizontal: 16,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "600" }}>
                          {t("common.add")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {otherEquipmentList.map((item) => (
                      <View
                        key={item}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          backgroundColor: "#f0fdfa",
                          borderRadius: 8,
                          marginBottom: 4,
                        }}
                      >
                        <Text style={{ fontSize: 14, color: "#0f766e" }}>
                          {item}
                        </Text>
                        <TouchableOpacity
                          onPress={() => removeCustomEquipment(item)}
                        >
                          <Ionicons
                            name="close-circle"
                            size={20}
                            color="#ef4444"
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#e5e7eb",
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setEquipmentModalVisible(false)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveEquipmentEdit}
                  disabled={saving}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: saving ? 0.7 : 1,
                    minWidth: 80,
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Workout Duration Modal */}
        <Modal
          visible={workoutDurationModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setWorkoutDurationModalVisible(false)}
        >
          <Pressable
            onPress={() => setWorkoutDurationModalVisible(false)}
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
                overflow: "hidden",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 15,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 15,
                    }),
              }}
            >
              <View style={{ padding: 20, paddingBottom: 0 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: "#111827",
                    marginBottom: 16,
                    textAlign: "center",
                  }}
                >
                  {t("profile.workoutDuration")}
                </Text>
              </View>

              <View style={{ paddingHorizontal: 20 }}>
                <View style={{ marginBottom: 24, alignItems: "center" }}>
                  <Text
                    style={{
                      fontSize: 48,
                      fontWeight: "700",
                      color: "#14b8a6",
                      marginBottom: 4,
                    }}
                  >
                    {workoutDurationValue >= 60
                      ? `${Math.floor(workoutDurationValue / 60)}h ${
                          workoutDurationValue % 60 > 0
                            ? `${workoutDurationValue % 60}m`
                            : ""
                        }`.trim()
                      : `${workoutDurationValue}m`}
                  </Text>
                  <Text style={{ fontSize: 13, color: "#64748b" }}>
                    {workoutDurationValue} {t("profile.minutesTotal")}
                  </Text>
                </View>

                {/* Quick Select Buttons */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    marginBottom: 20,
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  {[30, 45, 60, 90].map((duration) => (
                    <TouchableOpacity
                      key={duration}
                      onPress={() => setWorkoutDurationValue(duration)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor:
                          workoutDurationValue === duration
                            ? "#14b8a6"
                            : "#f3f4f6",
                        borderWidth: 1,
                        borderColor:
                          workoutDurationValue === duration
                            ? "#14b8a6"
                            : "#e5e7eb",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color:
                            workoutDurationValue === duration
                              ? "#fff"
                              : "#374151",
                        }}
                      >
                        {duration >= 60 ? `${duration / 60}h` : `${duration}m`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Slider with +/- buttons */}
                <View style={{ marginBottom: 20 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() =>
                        setWorkoutDurationValue((prev) =>
                          Math.max(15, prev - 5)
                        )
                      }
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        backgroundColor: "#f3f4f6",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: "#e5e7eb",
                      }}
                    >
                      <Ionicons name="remove" size={20} color="#374151" />
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                      <Slider
                        value={workoutDurationValue}
                        onValueChange={setWorkoutDurationValue}
                        minimumValue={15}
                        maximumValue={180}
                        step={5}
                        minimumTrackTintColor="#14b8a6"
                        maximumTrackTintColor="#e5e7eb"
                        thumbTintColor="#14b8a6"
                      />
                    </View>

                    <TouchableOpacity
                      onPress={() =>
                        setWorkoutDurationValue((prev) =>
                          Math.min(180, prev + 5)
                        )
                      }
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        backgroundColor: "#f3f4f6",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: "#e5e7eb",
                      }}
                    >
                      <Ionicons name="add" size={20} color="#374151" />
                    </TouchableOpacity>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 8,
                      paddingHorizontal: 8,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: "#9ca3af" }}>
                      15 min
                    </Text>
                    <Text style={{ fontSize: 12, color: "#9ca3af" }}>
                      3 hours
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#e5e7eb",
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setWorkoutDurationModalVisible(false)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveWorkoutDurationEdit}
                  disabled={saving}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: saving ? 0.7 : 1,
                    minWidth: 80,
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Weekly Frequency Modal */}
        <Modal
          visible={weeklyFrequencyModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setWeeklyFrequencyModalVisible(false)}
        >
          <Pressable
            onPress={() => setWeeklyFrequencyModalVisible(false)}
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
                padding: 20,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 15,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 15,
                    }),
              }}
            >
              <View style={{ padding: 20, paddingBottom: 0 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: "#111827",
                    marginBottom: 16,
                    textAlign: "center",
                  }}
                >
                  {t("profile.selectWeeklyFrequency")}
                </Text>
              </View>
              <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
                {[
                  "monday",
                  "tuesday",
                  "wednesday",
                  "thursday",
                  "friday",
                  "saturday",
                  "sunday",
                ].map((day) => (
                  <TouchableOpacity
                    key={day}
                    onPress={() => handleWeeklyDayToggle(day)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      marginBottom: 8,
                      backgroundColor: selectedWeeklyDays.includes(day)
                        ? "#f0fdfa"
                        : "#f9fafb",
                      borderWidth: 1,
                      borderColor: selectedWeeklyDays.includes(day)
                        ? "#14b8a6"
                        : "#e5e7eb",
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        borderWidth: 2,
                        borderColor: selectedWeeklyDays.includes(day)
                          ? "#14b8a6"
                          : "#d1d5db",
                        marginRight: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: selectedWeeklyDays.includes(day)
                          ? "#14b8a6"
                          : "transparent",
                      }}
                    >
                      {selectedWeeklyDays.includes(day) && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color: selectedWeeklyDays.includes(day)
                          ? "#0f766e"
                          : "#374151",
                      }}
                    >
                      {t(`weekDays.${day}`) ||
                        day.charAt(0).toUpperCase() + day.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#e5e7eb",
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setWeeklyFrequencyModalVisible(false)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveWeeklyFrequencyEdit}
                  disabled={saving}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: saving ? 0.7 : 1,
                    minWidth: 80,
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Target Muscle Groups Modal */}
        <Modal
          visible={targetMuscleGroupsModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setTargetMuscleGroupsModalVisible(false)}
        >
          <Pressable
            onPress={() => setTargetMuscleGroupsModalVisible(false)}
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
                maxHeight: "80%",
                overflow: "hidden",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 15,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 15,
                    }),
              }}
            >
              <View style={{ padding: 20, paddingBottom: 0 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: "#111827",
                    marginBottom: 16,
                    textAlign: "center",
                  }}
                >
                  {t("profile.selectTargetMuscleGroups")}
                </Text>
              </View>
              <ScrollView
                style={{ maxHeight: 350, paddingHorizontal: 20 }}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: 10 }}
              >
                {targetMuscleGroupOptions.map((muscle) => (
                  <TouchableOpacity
                    key={muscle.code}
                    onPress={() => handleTargetMuscleGroupToggle(muscle.code)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      marginBottom: 8,
                      backgroundColor: selectedTargetMuscleGroups.includes(
                        muscle.code
                      )
                        ? "#f0fdfa"
                        : "#f9fafb",
                      borderWidth: 1,
                      borderColor: selectedTargetMuscleGroups.includes(
                        muscle.code
                      )
                        ? "#14b8a6"
                        : "#e5e7eb",
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        borderWidth: 2,
                        borderColor: selectedTargetMuscleGroups.includes(
                          muscle.code
                        )
                          ? "#14b8a6"
                          : "#d1d5db",
                        marginRight: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: selectedTargetMuscleGroups.includes(
                          muscle.code
                        )
                          ? "#14b8a6"
                          : "transparent",
                      }}
                    >
                      {selectedTargetMuscleGroups.includes(muscle.code) && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color: selectedTargetMuscleGroups.includes(muscle.code)
                          ? "#0f766e"
                          : "#374151",
                      }}
                    >
                      {t(muscle.label) || muscle.code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#e5e7eb",
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setTargetMuscleGroupsModalVisible(false)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveTargetMuscleGroupsEdit}
                  disabled={saving}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: saving ? 0.7 : 1,
                    minWidth: 80,
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Dietary Preference Modal */}
        <Modal
          visible={dietaryPreferenceModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDietaryPreferenceModalVisible(false)}
        >
          <Pressable
            onPress={() => setDietaryPreferenceModalVisible(false)}
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
                maxHeight: "80%",
                overflow: "hidden",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 15,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 15,
                    }),
              }}
            >
              <View style={{ padding: 20, paddingBottom: 0 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: "#111827",
                    marginBottom: 16,
                    textAlign: "center",
                  }}
                >
                  {t("profile.selectDietaryPreference")}
                </Text>
              </View>
              <ScrollView
                style={{ maxHeight: 350, paddingHorizontal: 20 }}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: 10 }}
              >
                {dietaryPreferenceOptions.map((preference) => (
                  <TouchableOpacity
                    key={preference.code}
                    onPress={() =>
                      setSelectedDietaryPreference(preference.code)
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      marginBottom: 8,
                      backgroundColor:
                        selectedDietaryPreference === preference.code
                          ? "#f0fdfa"
                          : "#f9fafb",
                      borderWidth: 1,
                      borderColor:
                        selectedDietaryPreference === preference.code
                          ? "#14b8a6"
                          : "#e5e7eb",
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor:
                          selectedDietaryPreference === preference.code
                            ? "#14b8a6"
                            : "#d1d5db",
                        marginRight: 12,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selectedDietaryPreference === preference.code && (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: "#14b8a6",
                          }}
                        />
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color:
                          selectedDietaryPreference === preference.code
                            ? "#0f766e"
                            : "#374151",
                      }}
                    >
                      {t(preference.label) || preference.code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#e5e7eb",
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setDietaryPreferenceModalVisible(false)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveDietaryPreferenceEdit}
                  disabled={saving}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: saving ? 0.7 : 1,
                    minWidth: 80,
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Meal Plan Duration Modal */}
        <Modal
          visible={mealPlanDurationModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMealPlanDurationModalVisible(false)}
        >
          <Pressable
            onPress={() => setMealPlanDurationModalVisible(false)}
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
                overflow: "hidden",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 15,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 15,
                    }),
              }}
            >
              <View style={{ padding: 20, paddingBottom: 0 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: "#111827",
                    marginBottom: 16,
                    textAlign: "center",
                  }}
                >
                  {t("profile.selectMealPlanDuration")}
                </Text>
              </View>
              <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
                {[
                  "monday",
                  "tuesday",
                  "wednesday",
                  "thursday",
                  "friday",
                  "saturday",
                  "sunday",
                ].map((day) => (
                  <TouchableOpacity
                    key={day}
                    onPress={() => handleMealPlanDayToggle(day)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      marginBottom: 8,
                      backgroundColor: selectedMealPlanDays.includes(day)
                        ? "#f0fdfa"
                        : "#f9fafb",
                      borderWidth: 1,
                      borderColor: selectedMealPlanDays.includes(day)
                        ? "#14b8a6"
                        : "#e5e7eb",
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        borderWidth: 2,
                        borderColor: selectedMealPlanDays.includes(day)
                          ? "#14b8a6"
                          : "#d1d5db",
                        marginRight: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: selectedMealPlanDays.includes(day)
                          ? "#14b8a6"
                          : "transparent",
                      }}
                    >
                      {selectedMealPlanDays.includes(day) && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color: selectedMealPlanDays.includes(day)
                          ? "#0f766e"
                          : "#374151",
                      }}
                    >
                      {t(`weekDays.${day}`) ||
                        day.charAt(0).toUpperCase() + day.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#e5e7eb",
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setMealPlanDurationModalVisible(false)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveMealPlanDurationEdit}
                  disabled={saving}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: saving ? 0.7 : 1,
                    minWidth: 80,
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Health Conditions Modal */}
        <Modal
          visible={healthConditionsModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setHealthConditionsModalVisible(false)}
        >
          <Pressable
            onPress={() => setHealthConditionsModalVisible(false)}
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
                maxHeight: "80%",
                overflow: "hidden",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 15,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 15,
                    }),
              }}
            >
              <View style={{ padding: 20, paddingBottom: 0 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: "#111827",
                    marginBottom: 16,
                    textAlign: "center",
                  }}
                >
                  {t("profile.selectHealthConditions")}
                </Text>
              </View>
              <ScrollView
                style={{ maxHeight: 350, paddingHorizontal: 20 }}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: 10 }}
              >
                {healthConditionOptions.map((condition) => (
                  <TouchableOpacity
                    key={condition.code}
                    onPress={() =>
                      handleHealthConditionSelection(condition.code)
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      marginBottom: 8,
                      backgroundColor: selectedHealthConditions.includes(
                        condition.code
                      )
                        ? "#f0fdfa"
                        : "#f9fafb",
                      borderWidth: 1,
                      borderColor: selectedHealthConditions.includes(
                        condition.code
                      )
                        ? "#14b8a6"
                        : "#e5e7eb",
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        borderWidth: 2,
                        borderColor: selectedHealthConditions.includes(
                          condition.code
                        )
                          ? "#14b8a6"
                          : "#d1d5db",
                        marginRight: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: selectedHealthConditions.includes(
                          condition.code
                        )
                          ? "#14b8a6"
                          : "transparent",
                      }}
                    >
                      {selectedHealthConditions.includes(condition.code) && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color: selectedHealthConditions.includes(condition.code)
                          ? "#0f766e"
                          : "#374151",
                      }}
                    >
                      {t(condition.label) || condition.code}
                    </Text>
                  </TouchableOpacity>
                ))}

                {selectedHealthConditions.includes("other") && (
                  <View style={{ marginTop: 12 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: "#374151",
                        marginBottom: 8,
                      }}
                    >
                      {t("profile.otherHealthConditions")}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        marginBottom: 8,
                        gap: 8,
                      }}
                    >
                      <TextInput
                        value={currentOtherHealthCondition}
                        onChangeText={setCurrentOtherHealthCondition}
                        placeholder={t("profile.enterCondition")}
                        style={{
                          flex: 1,
                          borderWidth: 1,
                          borderColor: "#d1d5db",
                          borderRadius: 8,
                          padding: 10,
                          fontSize: 14,
                          backgroundColor: "#f9fafb",
                        }}
                        placeholderTextColor="#9ca3af"
                      />
                      <TouchableOpacity
                        onPress={addCustomHealthCondition}
                        style={{
                          backgroundColor: "#14b8a6",
                          borderRadius: 8,
                          paddingHorizontal: 16,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "600" }}>
                          {t("common.add")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {otherHealthConditions.map((item) => (
                      <View
                        key={item}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          backgroundColor: "#f0fdfa",
                          borderRadius: 8,
                          marginBottom: 4,
                        }}
                      >
                        <Text style={{ fontSize: 14, color: "#0f766e" }}>
                          {item}
                        </Text>
                        <TouchableOpacity
                          onPress={() => removeCustomHealthCondition(item)}
                        >
                          <Ionicons
                            name="close-circle"
                            size={20}
                            color="#ef4444"
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#e5e7eb",
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setHealthConditionsModalVisible(false)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveHealthConditionsEdit}
                  disabled={saving}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: saving ? 0.7 : 1,
                    minWidth: 80,
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#fff",
                        }}
                      >
                        {t("common.save")}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Toast Notifications - Web Only */}
        {Platform.OS === "web" &&
          toasts.map((toast, index) => (
            <Toast
              key={toast.id}
              type={toast.type}
              title={toast.title}
              message={toast.message}
              onDismiss={() => dismissToast(toast.id)}
              index={index}
            />
          ))}
      </SafeAreaView>

      {/* Logout Confirmation Modal - Covers entire screen including bottom tabs */}
      <Modal
        visible={logoutConfirmDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutConfirmDialogVisible(false)}
        statusBarTranslucent
      >
        <Pressable
          onPress={() => setLogoutConfirmDialogVisible(false)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
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
              padding: 24,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              ...(Platform.OS === "web"
                ? { boxShadow: "0 20px 50px rgba(0,0,0,0.3)" as any }
                : {
                    shadowColor: "#000",
                    shadowOpacity: 0.3,
                    shadowRadius: 15,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 15,
                  }),
            }}
          >
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: "#fef3c7",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <Ionicons name="warning" size={32} color="#f59e0b" />
              </View>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 12,
                  textAlign: "center",
                }}
              >
                {t("profile.forgotPasswordTitle")}
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  color: "#64748b",
                  marginBottom: 24,
                  textAlign: "center",
                  lineHeight: 22,
                }}
              >
                {t("profile.forgotPasswordLogoutMessage")}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  width: "100%",
                }}
              >
                <TouchableOpacity
                  onPress={() => setLogoutConfirmDialogVisible(false)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirmLogout}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <LinearGradient
                    colors={["#0f766e", "#14b8a6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "600",
                        color: "#fff",
                      }}
                    >
                      {t("common.continue")}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

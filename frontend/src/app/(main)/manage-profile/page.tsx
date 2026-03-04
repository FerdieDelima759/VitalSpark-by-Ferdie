"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { UserProfile } from "@/types/UserProfile";
import Dialog from "@/components/Dialog";
import Toast, { ToastProps } from "@/components/Toast";
import Loader from "@/components/Loader";
import countriesData from "@/lib/data/countries.json";
import subdivisionsData from "@/lib/data/subdivisions.json";
import { supabase } from "@/lib/api/supabase";
import {
  HiUser,
  HiPencil,
  HiCalendar,
  HiGlobeAlt,
  HiArrowLeft,
  HiArrowsUpDown,
  HiBolt,
  HiKey,
  HiEye,
  HiEyeSlash,
  HiMoon,
  HiArrowRightOnRectangle,
} from "react-icons/hi2";

// Equipment options
const homeEquipmentOptions = [
  { code: "none", label: "None" },
  { code: "dumbbells", label: "Dumbbells" },
  { code: "resistanceBands", label: "Resistance Bands" },
  { code: "pullUpBar", label: "Pull Up Bar" },
  { code: "yogaMat", label: "Yoga Mat" },
  { code: "kettleBells", label: "Kettle Bells" },
  { code: "barBell", label: "Bar Bell" },
  { code: "treadmill", label: "Treadmill" },
  { code: "jumpingRope", label: "Jumping Rope" },
  { code: "other", label: "Other" },
];

const gymEquipmentOptions = [
  { code: "fullGymAccess", label: "Full Gym Access" },
];

// Dietary preference options
const dietaryPreferenceOptions = [
  { code: "vegan", label: "Vegan" },
  { code: "keto", label: "Keto" },
  { code: "paleo", label: "Paleo" },
  { code: "mediterranean", label: "Mediterranean" },
  { code: "balanced", label: "Balanced" },
  { code: "glutenFree", label: "Gluten Free" },
  { code: "flexitarian", label: "Flexitarian" },
  { code: "filipinoHeritage", label: "Filipino Heritage" },
];

// Health condition options
const healthConditionOptions = [
  { code: "acidReflux", label: "Acid Reflux" },
  { code: "highBloodPressure", label: "High Blood Pressure" },
  { code: "diabetes", label: "Diabetes" },
  { code: "other", label: "Other" },
];

// Target Muscle Group options
const targetMuscleGroupOptions = [
  { code: "fullBody", label: "Full Body" },
  { code: "upperBody", label: "Upper Body" },
  { code: "lowerBody", label: "Lower Body" },
  { code: "core", label: "Core" },
  { code: "arms", label: "Arms" },
  { code: "chest", label: "Chest" },
  { code: "back", label: "Back" },
  { code: "shoulders", label: "Shoulders" },
  { code: "legs", label: "Legs" },
  { code: "glutes", label: "Glutes" },
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
interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

interface ProfileFieldProps {
  label: string;
  value: string | number | string[] | undefined;
  icon: React.ReactNode;
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
  const displayValue = formatValue
    ? formatValue(value)
    : String(value ?? "Not set");
  return (
    <div className="flex items-center py-2.5 px-3.5">
      <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center mr-2.5">
        <div className="text-amber-700">{icon}</div>
      </div>
      <div className="flex-1">
        <div className="text-slate-500 text-xs uppercase tracking-wide mb-1">
          {label}
        </div>
        <div className="text-slate-900 font-semibold text-xs sm:text-sm leading-5">
          {displayValue}
        </div>
      </div>
      {isEditable && onEdit && (
        <button
          onClick={onEdit}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-teal-50 transition-colors"
        >
          <HiPencil className="w-4 h-4 text-teal-600" />
        </button>
      )}
    </div>
  );
};

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="bg-white rounded-xl border border-slate-200 mb-4 overflow-hidden">
    <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center">
      <div className="w-1.5 h-5 rounded-full bg-amber-500 mr-2" />
      <div className="text-xs tracking-wider font-bold text-slate-700 uppercase">
        {title}
      </div>
    </div>
    <div className="px-2 py-2">{children}</div>
  </div>
);

const Divider = () => <div className="h-px bg-slate-100 mx-2" />;

// Weekly frequency display component
const WeeklyFrequencyDisplay = ({
  frequency,
}: {
  frequency: string[] | undefined;
}) => {
  if (!frequency || frequency.length === 0) {
    return <div className="text-slate-500 text-sm">Not set</div>;
  }
  const dayLabels: Record<string, string> = {
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
  };
  return (
    <div className="flex flex-wrap gap-2">
      {frequency.map((day) => {
        const dayKey = day.toLowerCase();
        const displayLabel =
          dayLabels[dayKey] || day.substring(0, 3).toUpperCase();
        return (
          <div
            key={day}
            className="bg-teal-100 border border-teal-200 rounded-full px-3 py-1"
          >
            <span className="text-teal-700 text-xs font-medium">
              {displayLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Target muscle groups display component
const TargetMusclesDisplay = ({
  muscles,
}: {
  muscles: string[] | undefined;
}) => {
  if (!muscles || muscles.length === 0) {
    return <div className="text-slate-500 text-sm">Not set</div>;
  }
  const getMuscleDisplayName = (muscle: string) => {
    const option = targetMuscleGroupOptions.find(
      (opt) => opt.code.toLowerCase() === muscle.toLowerCase(),
    );
    return option ? option.label : muscle;
  };
  return (
    <div className="flex flex-wrap gap-2">
      {muscles.map((muscle) => (
        <div
          key={muscle}
          className="bg-amber-100 border border-amber-200 rounded-full px-3 py-1"
        >
          <span className="text-amber-800 text-xs font-medium">
            {getMuscleDisplayName(muscle)}
          </span>
        </div>
      ))}
    </div>
  );
};

// Equipment list display component
const EquipmentDisplay = ({
  equipment,
}: {
  equipment: string[] | undefined;
}) => {
  if (!equipment || equipment.length === 0) {
    return <div className="text-slate-500 text-sm">Not set</div>;
  }
  const getEquipmentDisplayName = (item: string) => {
    const allStandardOptions = [
      ...homeEquipmentOptions,
      ...gymEquipmentOptions,
    ];
    let matchingOption = allStandardOptions.find(
      (option) => option.code.toLowerCase() === item.toLowerCase(),
    );
    if (!matchingOption) {
      matchingOption = allStandardOptions.find(
        (option) => formatTextForDatabase(option.code) === item,
      );
    }
    return matchingOption ? matchingOption.label : item;
  };
  return (
    <div className="space-y-1">
      {equipment.map((item) => (
        <div key={item} className="flex items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2" />
          <span className="text-slate-900 text-sm flex-1">
            {getEquipmentDisplayName(item)}
          </span>
        </div>
      ))}
    </div>
  );
};

// Meal plan duration display component
const MealPlanDurationDisplay = ({
  duration,
}: {
  duration: string[] | undefined;
}) => {
  if (!duration || duration.length === 0) {
    return <div className="text-slate-500 text-sm">Not set</div>;
  }
  const dayLabels: Record<string, string> = {
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
  };
  return (
    <div className="flex flex-wrap gap-2">
      {duration.map((d) => {
        const dayKey = d.toLowerCase();
        const displayLabel =
          dayLabels[dayKey] || d.substring(0, 3).toUpperCase();
        return (
          <div
            key={d}
            className="bg-teal-100 border border-teal-200 rounded-full px-3 py-1"
          >
            <span className="text-teal-700 text-xs font-medium">
              {displayLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Health conditions display component
const HealthConditionsDisplay = ({
  conditions,
}: {
  conditions: string[] | undefined;
}) => {
  if (!conditions || conditions.length === 0) {
    return <div className="text-slate-500 text-sm">Not set</div>;
  }
  const getConditionDisplayName = (condition: string) => {
    const matchingOption = healthConditionOptions.find(
      (option) =>
        formatTextForDatabase(option.code) === condition ||
        option.code === condition ||
        option.code.toLowerCase() === condition.toLowerCase(),
    );
    return matchingOption ? matchingOption.label : condition;
  };
  return (
    <div className="space-y-1">
      {conditions.map((condition, index) => (
        <div key={`${condition}-${index}`} className="flex items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2" />
          <span className="text-slate-900 text-sm flex-1">
            {getConditionDisplayName(condition)}
          </span>
        </div>
      ))}
    </div>
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
  icon: React.ReactNode;
  onEdit?: () => void;
  isEditable?: boolean;
  customDisplay: React.ReactNode;
}) => {
  return (
    <div className="py-2.5 px-3.5">
      <div className="flex items-start">
        <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center mr-2.5 mt-1">
          <div className="text-amber-700">{icon}</div>
        </div>
        <div className="flex-1">
          <div className="text-slate-500 text-xs uppercase tracking-wide mb-2">
            {label}
          </div>
          {customDisplay}
        </div>
        {isEditable && onEdit && (
          <button
            onClick={onEdit}
            className="w-10 h-10 rounded-full flex items-center justify-center ml-2 hover:bg-teal-50 transition-colors"
          >
            <HiPencil className="w-4 h-4 text-teal-600" />
          </button>
        )}
      </div>
    </div>
  );
};

// Array fields that need special handling
const arrayFields = [
  "equipment_list",
  "weekly_frequency",
  "target_muscle_groups",
  "meal_plan_duration",
  "health_conditions",
];

export default function ManageProfile() {
  const router = useRouter();
  const { user } = useAuth();
  const { fetchUserProfile, updateUserProfile } = useUserData();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
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
    [],
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
    [],
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
    [],
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

  // Toast helper function
  const showToast = (
    type: "success" | "error",
    title: string,
    message: string,
  ) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
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
      const result = await fetchUserProfile(user.id);
      if (result.success && result.data) {
        setUserProfile(result.data);
        const heightUnit = String(result.data.height_unit || "cm");
        const weightUnit = String(result.data.weight_unit || "kg");
        setHeightUnit(heightUnit);
        setWeightUnit(weightUnit);
      } else {
        showToast("error", "Error", "Failed to load profile data");
      }
    } catch (error) {
      showToast("error", "Error", "Failed to load profile data");
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
          (subdivision) => subdivision.name,
        );
        setAvailableStates(stateNames);
      } else {
        setAvailableStates([]);
      }
      setStateModalVisible(true);
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
          formatTextForDatabase(option.value) === normalizedGoal,
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
          (option) => option.code === eq,
        );
        if (exactMatch) {
          standardEquipment.push(exactMatch.code);
          return;
        }
        const caseInsensitiveMatch = allStandardOptions.find(
          (option) => option.code.toLowerCase() === eq.toLowerCase(),
        );
        if (caseInsensitiveMatch) {
          standardEquipment.push(caseInsensitiveMatch.code);
          return;
        }
        const formattedMatch = allStandardOptions.find(
          (option) => formatTextForDatabase(option.code) === eq,
        );
        if (formattedMatch) {
          standardEquipment.push(formattedMatch.code);
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
        day.toLowerCase(),
      );
      setSelectedWeeklyDays(normalizedDays);
      setWeeklyFrequencyModalVisible(true);
      return;
    }

    // Handle meal_plan_duration
    if (fieldName === "meal_plan_duration") {
      const durationList = Array.isArray(currentValue) ? currentValue : [];
      const normalizedDays = durationList.map((day: string) =>
        day.toLowerCase(),
      );
      setSelectedMealPlanDays(normalizedDays);
      setMealPlanDurationModalVisible(true);
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
              formatTextForDatabase(option.code) === valueStr,
          )?.code || valueStr;
      }
      setSelectedDietaryPreference(matchedCode);
      setDietaryPreferenceModalVisible(true);
      return;
    }

    // Handle health_conditions
    if (fieldName === "health_conditions") {
      const conditionsList = Array.isArray(currentValue) ? currentValue : [];
      const standardConditions: string[] = [];
      const customConditions: string[] = [];
      conditionsList.forEach((condition: string) => {
        const exactMatch = healthConditionOptions.find(
          (option) => option.code === condition,
        );
        if (exactMatch) {
          standardConditions.push(exactMatch.code);
          return;
        }
        const caseInsensitiveMatch = healthConditionOptions.find(
          (option) => option.code.toLowerCase() === condition.toLowerCase(),
        );
        if (caseInsensitiveMatch) {
          standardConditions.push(caseInsensitiveMatch.code);
          return;
        }
        const formattedMatch = healthConditionOptions.find(
          (option) => formatTextForDatabase(option.code) === condition,
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
          (option) => option.code === muscle,
        );
        if (exactMatch) return exactMatch.code;
        const caseMatch = targetMuscleGroupOptions.find(
          (option) => option.code.toLowerCase() === muscle.toLowerCase(),
        );
        if (caseMatch) return caseMatch.code;
        const formattedMatch = targetMuscleGroupOptions.find(
          (option) => formatTextForDatabase(option.code) === muscle,
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
        showToast("error", "Error", `Failed to update ${fieldDisplayName}`);
        return;
      }
      await loadUserProfile();
      setEditModalVisible(false);
      setEditingField(null);
      setEditValue("");
      const fieldDisplayName = editingField
        ?.replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      showToast(
        "success",
        "Success",
        `${fieldDisplayName} updated successfully`,
      );
    } catch (error) {
      showToast("error", "Error", "Failed to update profile");
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
        showToast("error", "Error", `Failed to update ${fieldDisplayName}`);
        return;
      }
      await loadUserProfile();
      setRadioModalVisible(false);
      setEditingField(null);
      setSelectedRadioValue("");
      const fieldDisplayName =
        editingField === "fitness_level"
          ? "Fitness Level"
          : editingField
              ?.replace(/_/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase());
      showToast(
        "success",
        "Success",
        `${fieldDisplayName} updated successfully`,
      );
    } catch (error) {
      showToast("error", "Error", "Failed to update profile");
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
        showToast("error", "Error", "Failed to update Age Range");
        return;
      }
      await loadUserProfile();
      setAgeRangeModalVisible(false);
      setEditingField(null);
      setSelectedAgeRange("");
      showToast("success", "Success", "Age Range updated successfully");
    } catch (error) {
      showToast("error", "Error", "Failed to update Age Range");
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
        showToast("error", "Error", "Failed to update Gender");
        return;
      }
      await loadUserProfile();
      setGenderModalVisible(false);
      setEditingField(null);
      setSelectedGender("");
      showToast("success", "Success", "Gender updated successfully");
    } catch (error) {
      showToast("error", "Error", "Failed to update Gender");
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
        showToast("error", "Error", "Failed to update Height");
        return;
      }
      await loadUserProfile();
      setHeightModalVisible(false);
      setEditingField(null);
      setHeightValue("");
      setHeightUnit("cm");
      showToast("success", "Success", "Height updated successfully");
    } catch (error) {
      showToast("error", "Error", "Failed to update Height");
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
        showToast("error", "Error", "Failed to update Weight");
        return;
      }
      await loadUserProfile();
      setWeightModalVisible(false);
      setEditingField(null);
      setWeightValue("");
      setWeightUnit("kg");
      showToast("success", "Success", "Weight updated successfully");
    } catch (error) {
      showToast("error", "Error", "Failed to update Weight");
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
        showToast("error", "Error", "Failed to update country");
        return;
      }
      await loadUserProfile();
      setCountryModalVisible(false);
      setSelectedCountry("");
      setCountrySearch("");
      showToast("success", "Success", "Country updated successfully");
    } catch (error) {
      showToast("error", "Error", "Failed to update country");
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
        showToast("error", "Error", "Failed to update Region/Province");
        return;
      }
      await loadUserProfile();
      setStateModalVisible(false);
      setEditingField(null);
      setSelectedState("");
      setStateSearch("");
      setAvailableStates([]);
      showToast("success", "Success", "Location updated successfully");
    } catch (error) {
      showToast("error", "Error", "Failed to update Region/Province");
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
        showToast("error", "Error", "Failed to update fitness goal");
        return;
      }
      await loadUserProfile();
      setFitnessGoalModalVisible(false);
      setEditingField(null);
      setSelectedFitnessGoal("");
      showToast("success", "Success", "Fitness goal updated successfully");
    } catch (error) {
      showToast("error", "Error", "Failed to update fitness goal");
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
        showToast("error", "Error", "Failed to update workout location");
        return;
      }
      await loadUserProfile();
      setWorkoutLocationModalVisible(false);
      setEditingField(null);
      setSelectedWorkoutLocation("");
      showToast(
        "success",
        "Success",
        "Workout location updated. Please select equipment.",
      );
      setTimeout(() => {
        setEditingField("equipment_list");
        setSelectedEquipmentList([]);
        setOtherEquipmentList([]);
        setCurrentOtherEquipment("");
        setEquipmentModalVisible(true);
      }, 500);
    } catch (error) {
      showToast("error", "Error", "Failed to update workout location");
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
        formatTextForDatabase(String(equipment)),
      );
      const updateData = {
        equipment_list:
          formattedEquipmentList.length > 0 ? formattedEquipmentList : [],
      };
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("error", "Error", "Failed to update equipment");
        return;
      }
      await loadUserProfile();
      setEquipmentModalVisible(false);
      setEditingField(null);
      setSelectedEquipmentList([]);
      setOtherEquipmentList([]);
      setCurrentOtherEquipment("");
      showToast("success", "Success", "Equipment updated successfully");
    } catch (error) {
      showToast("error", "Error", "Failed to update equipment");
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

  const handleSaveWorkoutDurationEdit = async () => {
    if (!user?.id || !editingField || saving) return;
    try {
      setSaving(true);
      const updateData: any = {};
      updateData[editingField] = workoutDurationValue;
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("error", "Error", "Failed to update workout duration");
        return;
      }
      await loadUserProfile();
      setWorkoutDurationModalVisible(false);
      setEditingField(null);
      setWorkoutDurationValue(30);
      showToast("success", "Success", "Workout duration updated successfully");
    } catch (error) {
      showToast("error", "Error", "Failed to update workout duration");
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
        formatTextForDatabase(day),
      );
      const updateData: any = {};
      updateData[editingField] = formattedDays;
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("error", "Error", "Failed to update weekly frequency");
        return;
      }
      await loadUserProfile();
      setWeeklyFrequencyModalVisible(false);
      setEditingField(null);
      setSelectedWeeklyDays([]);
      showToast("success", "Success", "Weekly frequency updated successfully");
    } catch (error) {
      showToast("error", "Error", "Failed to update weekly frequency");
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

  const handleSaveMealPlanDurationEdit = async () => {
    if (!user?.id || !editingField || saving) return;
    try {
      setSaving(true);
      const formattedDays = selectedMealPlanDays.map((day) =>
        formatTextForDatabase(day),
      );
      const updateData: any = {};
      updateData[editingField] = formattedDays;
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("error", "Error", "Failed to update meal plan duration");
        return;
      }
      await loadUserProfile();
      setMealPlanDurationModalVisible(false);
      setEditingField(null);
      setSelectedMealPlanDays([]);
      showToast(
        "success",
        "Success",
        "Meal plan duration updated successfully",
      );
    } catch (error) {
      showToast("error", "Error", "Failed to update meal plan duration");
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
        selectedDietaryPreference,
      );
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("error", "Error", "Failed to update dietary preference");
        return;
      }
      await loadUserProfile();
      setDietaryPreferenceModalVisible(false);
      setEditingField(null);
      setSelectedDietaryPreference("");
      showToast(
        "success",
        "Success",
        "Dietary preference updated successfully",
      );
    } catch (error) {
      showToast("error", "Error", "Failed to update dietary preference");
    } finally {
      setSaving(false);
    }
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
      prev.filter((cond) => cond !== condition),
    );
  };

  const handleSaveHealthConditionsEdit = async () => {
    if (!user?.id || saving) return;
    try {
      setSaving(true);
      const standardConditions = selectedHealthConditions.filter(
        (cond) => cond !== "other",
      );
      const formattedStandardConditions = standardConditions.map((condition) =>
        formatTextForDatabase(String(condition)),
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
        showToast("error", "Error", "Failed to update health conditions");
        return;
      }
      await loadUserProfile();
      setHealthConditionsModalVisible(false);
      setEditingField(null);
      setSelectedHealthConditions([]);
      setOtherHealthConditions([]);
      setCurrentOtherHealthCondition("");
      showToast("success", "Success", "Health conditions updated successfully");
    } catch (error) {
      showToast("error", "Error", "Failed to update health conditions");
    } finally {
      setSaving(false);
    }
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

  const handleSaveTargetMuscleGroupsEdit = async () => {
    if (!user?.id || saving) return;
    try {
      setSaving(true);
      const formattedMuscleGroups = selectedTargetMuscleGroups.map((muscle) =>
        formatTextForDatabase(String(muscle)),
      );
      const updateData = {
        target_muscle_groups:
          formattedMuscleGroups.length > 0 ? formattedMuscleGroups : [],
      };
      const result = await updateUserProfile(user.id, updateData);
      if (!result.success) {
        showToast("error", "Error", "Failed to update target muscle groups");
        return;
      }
      await loadUserProfile();
      setTargetMuscleGroupsModalVisible(false);
      setEditingField(null);
      setSelectedTargetMuscleGroups([]);
      showToast(
        "success",
        "Success",
        "Target muscle groups updated successfully",
      );
    } catch (error) {
      showToast("error", "Error", "Failed to update target muscle groups");
    } finally {
      setSaving(false);
    }
  };

  const validateNewPassword = (pwd: string): string => {
    if (!pwd) return "";
    if (pwd.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])/.test(pwd)) {
      return "Password must contain both uppercase and lowercase letters";
    }
    if (!/(?=.*\d)/.test(pwd)) {
      return "Password must contain at least one number";
    }
    return "";
  };

  const handleNewPasswordChange = (text: string) => {
    setNewPassword(text);
    const error = validateNewPassword(text);
    setNewPasswordError(error);
    if (confirmNewPassword) {
      if (text !== confirmNewPassword) {
        setConfirmPasswordError("Passwords do not match");
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
      setConfirmPasswordError("Passwords do not match");
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
        setCurrentPasswordError("Current password is required");
      if (!newPassword) setNewPasswordError("New password is required");
      if (!confirmNewPassword)
        setConfirmPasswordError("Please confirm your password");
      showToast("error", "Error", "Please fill in all password fields");
      return;
    }

    const passwordValidationError = validateNewPassword(newPassword);
    if (passwordValidationError) {
      setNewPasswordError(passwordValidationError);
      showToast("error", "Error", passwordValidationError);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setConfirmPasswordError("Passwords do not match");
      showToast("error", "Error", "Passwords do not match");
      return;
    }

    setPasswordLoading(true);
    try {
      const { data: sessionData, error: verifyError } =
        await supabase.auth.getSession();

      if (verifyError || !sessionData.session) {
        showToast("error", "Error", "Please log in again");
        setPasswordLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email || "",
        password: currentPassword,
      });

      if (signInError) {
        setCurrentPasswordError("Current password is incorrect");
        showToast("error", "Error", "Current password is incorrect");
        setPasswordLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        showToast(
          "error",
          "Error",
          updateError.message || "Failed to update password",
        );
        setPasswordLoading(false);
        return;
      }

      showToast("success", "Success", "Password updated successfully");
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
          await supabase.auth.signOut();
          router.push("/auth/login");
        } catch (signOutError) {
          router.push("/auth/login");
        }
      }, 1500);
    } catch (error: any) {
      showToast(
        "error",
        "Error",
        error?.message || "An unexpected error occurred",
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  // Format helpers
  const formatHeight = () => {
    const height = userProfile?.height;
    if (!height) return "Not set";
    const unit = userProfile?.height_unit || "cm";
    return `${height} ${unit}`;
  };

  const formatWeight = () => {
    const weight = userProfile?.weight;
    if (!weight) return "Not set";
    const unit = userProfile?.weight_unit || "kg";
    return `${weight} ${unit}`;
  };

  const getGenderDisplay = (gender: string | undefined) => {
    if (!gender) return "Not set";
    const genderMap: Record<string, string> = {
      male: "Male",
      female: "Female",
      non_binary: "Non-binary",
      prefer_not_to_say: "Prefer not to say",
    };
    return genderMap[gender] || gender;
  };

  const getFitnessLevelDisplay = (level: string | undefined) => {
    if (!level) return "Not set";
    const levelMap: Record<string, string> = {
      beginner: "Beginner",
      intermediate: "Intermediate",
      advanced: "Advanced",
    };
    return levelMap[level] || level;
  };

  const getAgeRangeDisplay = (ageRange: string | undefined) => {
    if (!ageRange) return "Not set";
    const ageRangeMap: Record<string, string> = {
      "below-18": "Below 18",
      "18-25": "18-25",
      "26-35": "26-35",
      "36-45": "36-45",
      "46+": "46+",
    };
    return ageRangeMap[ageRange] || ageRange;
  };

  const formatWorkoutDuration = (minutes: number | undefined) => {
    if (!minutes) return "Not set";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const getFitnessGoalDisplay = (goal: string | undefined) => {
    if (!goal) return "Not set";
    const goalMap: Record<string, string> = {
      loseWeight: "Lose Weight",
      buildMuscle: "Build Muscle",
      improveCardiovascular: "Improve Cardiovascular",
      increaseStrength: "Increase Strength",
      enhanceFlexibility: "Enhance Flexibility",
      buildStrength: "Build Strength",
      getToned: "Get Toned",
      getLean: "Get Lean",
      mobility: "Mobility",
      endurance: "Endurance",
      bodyBuilding: "Body Building",
      stayHealthy: "Stay Healthy",
    };
    return goalMap[goal] || goal;
  };

  const getWorkoutLocationDisplay = (location: string | undefined) => {
    if (!location) return "Not set";
    const locationMap: Record<string, string> = {
      home: "Home",
      gym: "Gym",
      outdoor: "Outdoor",
      both: "Both",
    };
    return locationMap[location.toLowerCase()] || location;
  };

  const getDietaryPreferenceDisplay = (preference: string | undefined) => {
    if (!preference) return "Not set";
    const option = dietaryPreferenceOptions.find(
      (opt) =>
        opt.code.toLowerCase() === preference.toLowerCase() ||
        formatTextForDatabase(opt.code) === preference,
    );
    return option ? option.label : preference;
  };

  const formatCurrency = (
    amount: number | undefined,
    currency: string | undefined,
  ) => {
    if (!amount && amount !== 0) return "Not set";
    if (typeof amount !== "number" || isNaN(amount)) return "Not set";
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
    const symbol = currencySymbols[currency || "USD"] || "$";
    return `${symbol} ${amount.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader size="lg" text="Loading profile..." textColor="slate" />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50">
        {/* App Header */}
        <div className="bg-white pt-6 pb-2 px-5 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Image
                src="/images/Logo_VitalSpark.png"
                alt="VitalSpark"
                width={28}
                height={28}
                className="object-contain"
              />
              <span className="text-xs sm:text-sm font-semibold text-slate-700">
                VitalSpark by Ferdie
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
              >
                <HiMoon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => router.replace("/auth/logout")}
                className="inline-flex items-center justify-center px-3 h-8 rounded-full bg-white text-slate-600 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors"
              >
                <HiArrowRightOnRectangle className="w-4 h-4 mr-1" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Header with Back Button */}
        <div className="bg-white pt-4 pb-4 px-5 border-b border-slate-200">
          <div className="flex items-center mb-3">
            <button
              onClick={() => router.push("/my-profile")}
              className="w-9 h-9 rounded-full flex items-center justify-center mr-2.5 hover:bg-amber-50 transition-colors"
            >
              <HiArrowLeft className="w-5 h-5 text-amber-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-slate-900 text-2xl font-extrabold mt-1">
                Manage Profile
              </h1>
            </div>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm mt-1 ml-11">
            View and edit your profile information
          </p>
          <div className="h-1 w-16 bg-amber-500 rounded-full mt-3 ml-12" />
        </div>

        <div className="px-5 py-4 max-w-3xl mx-auto">
          {/* Personal Information */}
          <SectionCard title="Personal Information">
            <ProfileField
              label="Full Name"
              value={userProfile?.full_name || "Not set"}
              icon={<HiUser className="w-5 h-5" />}
              onEdit={() =>
                handleEditField("full_name", userProfile?.full_name)
              }
              isEditable
            />
            <Divider />
            <ProfileField
              label="Nickname"
              value={userProfile?.nickname || "Not set"}
              icon={<HiUser className="w-5 h-5" />}
              onEdit={() => handleEditField("nickname", userProfile?.nickname)}
              isEditable
            />
            <Divider />
            <ProfileField
              label="Age Range"
              value={userProfile?.age_range || "Not set"}
              icon={<HiCalendar className="w-5 h-5" />}
              formatValue={getAgeRangeDisplay}
              onEdit={() =>
                handleEditField("age_range", userProfile?.age_range)
              }
              isEditable
            />
            <Divider />
            <ProfileField
              label="Gender"
              value={userProfile?.gender || "Not set"}
              icon={<HiUser className="w-5 h-5" />}
              formatValue={getGenderDisplay}
              onEdit={() => handleEditField("gender", userProfile?.gender)}
              isEditable
            />
          </SectionCard>

          {/* Physical Information */}
          <SectionCard title="Physical Information">
            <ProfileField
              label="Height"
              value={userProfile?.height || "Not set"}
              icon={<HiArrowsUpDown className="w-5 h-5" />}
              formatValue={formatHeight}
              onEdit={() => handleEditField("height", userProfile?.height)}
              isEditable
            />
            <Divider />
            <ProfileField
              label="Weight"
              value={userProfile?.weight || "Not set"}
              icon={<HiBolt className="w-5 h-5" />}
              formatValue={formatWeight}
              onEdit={() => handleEditField("weight", userProfile?.weight)}
              isEditable
            />
          </SectionCard>

          {/* Location Information */}
          <SectionCard title="Location">
            <ProfileField
              label="Country"
              value={userProfile?.country || "Not set"}
              icon={<HiGlobeAlt className="w-5 h-5" />}
              onEdit={() => handleEditField("country", userProfile?.country)}
              isEditable
            />
            <Divider />
            <ProfileField
              label="Region/Province"
              value={userProfile?.region_province || "Not set"}
              icon={<HiGlobeAlt className="w-5 h-5" />}
              onEdit={() =>
                handleEditField("region_province", userProfile?.region_province)
              }
              isEditable
            />
          </SectionCard>

          {/* Fitness Information */}
          <SectionCard title="Fitness & Workout">
            <ProfileField
              label="Fitness Goal"
              value={userProfile?.fitness_goal || "Not set"}
              icon={<HiBolt className="w-5 h-5" />}
              formatValue={getFitnessGoalDisplay}
              onEdit={() =>
                handleEditField("fitness_goal", userProfile?.fitness_goal)
              }
              isEditable
            />
            <Divider />
            <ProfileField
              label="Fitness Level"
              value={userProfile?.fitness_level || "Not set"}
              icon={<HiBolt className="w-5 h-5" />}
              formatValue={getFitnessLevelDisplay}
              onEdit={() =>
                handleEditField("fitness_level", userProfile?.fitness_level)
              }
              isEditable
            />
            <Divider />
            <ProfileField
              label="Workout Location"
              value={userProfile?.workout_location || "Not set"}
              icon={<HiBolt className="w-5 h-5" />}
              formatValue={getWorkoutLocationDisplay}
              onEdit={() =>
                handleEditField(
                  "workout_location",
                  userProfile?.workout_location,
                )
              }
              isEditable
            />
            <Divider />
            <CustomProfileField
              label="Equipment"
              value={userProfile?.equipment_list || []}
              icon={<HiBolt className="w-5 h-5" />}
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
              label="Workout Duration"
              value={userProfile?.workout_duration_minutes || "Not set"}
              icon={<HiBolt className="w-5 h-5" />}
              formatValue={formatWorkoutDuration}
              onEdit={() =>
                handleEditField(
                  "workout_duration_minutes",
                  userProfile?.workout_duration_minutes,
                )
              }
              isEditable
            />
            <Divider />
            <CustomProfileField
              label="Weekly Frequency"
              value={userProfile?.weekly_frequency || []}
              icon={<HiCalendar className="w-5 h-5" />}
              customDisplay={
                <WeeklyFrequencyDisplay
                  frequency={userProfile?.weekly_frequency}
                />
              }
              onEdit={() =>
                handleEditField(
                  "weekly_frequency",
                  userProfile?.weekly_frequency,
                )
              }
              isEditable
            />
            <Divider />
            <CustomProfileField
              label="Target Muscle Groups"
              value={userProfile?.target_muscle_groups || []}
              icon={<HiBolt className="w-5 h-5" />}
              customDisplay={
                <TargetMusclesDisplay
                  muscles={userProfile?.target_muscle_groups}
                />
              }
              onEdit={() =>
                handleEditField(
                  "target_muscle_groups",
                  userProfile?.target_muscle_groups,
                )
              }
              isEditable
            />
          </SectionCard>

          {/* Dietary Information */}
          <SectionCard title="Dietary & Nutrition">
            <ProfileField
              label="Dietary Preference"
              value={userProfile?.dietary_preference || "Not set"}
              icon={<HiBolt className="w-5 h-5" />}
              formatValue={getDietaryPreferenceDisplay}
              onEdit={() =>
                handleEditField(
                  "dietary_preference",
                  userProfile?.dietary_preference,
                )
              }
              isEditable
            />
            <Divider />
            <ProfileField
              label="Weekly Budget"
              value={userProfile?.weekly_budget || "Not set"}
              icon={<HiBolt className="w-5 h-5" />}
              formatValue={(value) =>
                formatCurrency(
                  value,
                  userProfile?.weekly_budget_currency || "USD",
                )
              }
              onEdit={() =>
                handleEditField("weekly_budget", userProfile?.weekly_budget)
              }
              isEditable
            />
            <Divider />
            <CustomProfileField
              label="Meal Plan Duration"
              value={userProfile?.meal_plan_duration || []}
              icon={<HiCalendar className="w-5 h-5" />}
              customDisplay={
                <MealPlanDurationDisplay
                  duration={userProfile?.meal_plan_duration}
                />
              }
              onEdit={() =>
                handleEditField(
                  "meal_plan_duration",
                  userProfile?.meal_plan_duration,
                )
              }
              isEditable
            />
          </SectionCard>

          {/* Health Information */}
          <SectionCard title="Health & Wellness">
            <CustomProfileField
              label="Health Conditions"
              value={userProfile?.health_conditions || []}
              icon={<HiBolt className="w-5 h-5" />}
              customDisplay={
                <HealthConditionsDisplay
                  conditions={userProfile?.health_conditions}
                />
              }
              onEdit={() =>
                handleEditField(
                  "health_conditions",
                  userProfile?.health_conditions,
                )
              }
              isEditable
            />
          </SectionCard>

          {/* Account Information */}
          <SectionCard title="Account Information">
            <ProfileField
              label="Member Since"
              value={userProfile?.created_at || "Not set"}
              icon={<HiCalendar className="w-5 h-5" />}
              formatValue={(value) =>
                value ? new Date(value).toLocaleDateString() : "Not set"
              }
              isEditable={false}
            />
            <Divider />
            <button
              onClick={() => setChangePasswordModalVisible(true)}
              className="w-full flex items-center justify-between py-4 px-4 hover:bg-slate-50 transition-colors rounded-lg"
            >
              <div className="flex items-center flex-1">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                  <HiKey className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-slate-500 text-xs uppercase tracking-wide mb-1">
                    Password
                  </div>
                  <div className="text-blue-600 text-sm font-semibold">
                    Change Password
                  </div>
                </div>
              </div>
              <HiArrowLeft className="w-5 h-5 text-slate-400 rotate-180" />
            </button>
          </SectionCard>
        </div>
      </div>

      {/* Toast Notifications */}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          onDismiss={() => dismissToast(toast.id)}
          index={toasts.indexOf(toast)}
        />
      ))}

      {/* Edit Text Modal */}
      <Dialog
        visible={editModalVisible}
        onDismiss={() => {
          if (!saving) {
            setEditModalVisible(false);
            setEditingField(null);
            setEditValue("");
          }
        }}
        dismissible={!saving}
        maxWidth={500}
      >
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-3 text-center">
            Edit{" "}
            {editingField
              ?.replace(/_/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase())}
          </h3>
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={
              arrayFields.includes(editingField || "")
                ? "Enter items separated by commas"
                : `Enter ${editingField?.replace(/_/g, " ")}`
            }
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mb-4 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
            disabled={saving}
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                if (!saving) {
                  setEditModalVisible(false);
                  setEditingField(null);
                  setEditValue("");
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader size="sm" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Radio Button Modal for Fitness Level */}
      <Dialog
        visible={radioModalVisible}
        onDismiss={() => {
          if (!saving) {
            setRadioModalVisible(false);
            setEditingField(null);
            setSelectedRadioValue("");
          }
        }}
        dismissible={!saving}
        maxWidth={400}
      >
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-4 text-center">
            Select Fitness Level
          </h3>
          <div className="mb-5 space-y-2">
            {["beginner", "intermediate", "advanced"].map((level) => (
              <button
                key={level}
                onClick={() => setSelectedRadioValue(level)}
                className={`w-full flex items-center p-2.5 rounded-lg border-2 transition-colors ${
                  selectedRadioValue === level
                    ? "bg-teal-50 border-teal-500"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 mr-2.5 flex items-center justify-center ${
                    selectedRadioValue === level
                      ? "border-teal-500"
                      : "border-slate-300"
                  }`}
                >
                  {selectedRadioValue === level && (
                    <div className="w-2 h-2 rounded-full bg-teal-500" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    selectedRadioValue === level
                      ? "text-teal-700"
                      : "text-slate-700"
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                if (!saving) {
                  setRadioModalVisible(false);
                  setEditingField(null);
                  setSelectedRadioValue("");
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveRadioEdit}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader size="sm" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Age Range Modal */}
      <Dialog
        visible={ageRangeModalVisible}
        onDismiss={() => {
          if (!saving) {
            setAgeRangeModalVisible(false);
            setEditingField(null);
            setSelectedAgeRange("");
          }
        }}
        dismissible={!saving}
        maxWidth={400}
      >
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-4 text-center">
            Select Age Range
          </h3>
          <div className="mb-5 space-y-2">
            {[
              { value: "below-18", label: "Below 18" },
              { value: "18-25", label: "18-25" },
              { value: "26-35", label: "26-35" },
              { value: "36-45", label: "36-45" },
              { value: "46+", label: "46+" },
            ].map((ageRange) => (
              <button
                key={ageRange.value}
                onClick={() => setSelectedAgeRange(ageRange.value)}
                className={`w-full flex items-center p-2.5 rounded-lg border-2 transition-colors ${
                  selectedAgeRange === ageRange.value
                    ? "bg-teal-50 border-teal-500"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 mr-2.5 flex items-center justify-center ${
                    selectedAgeRange === ageRange.value
                      ? "border-teal-500"
                      : "border-slate-300"
                  }`}
                >
                  {selectedAgeRange === ageRange.value && (
                    <div className="w-2 h-2 rounded-full bg-teal-500" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    selectedAgeRange === ageRange.value
                      ? "text-teal-700"
                      : "text-slate-700"
                  }`}
                >
                  {ageRange.label}
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                if (!saving) {
                  setAgeRangeModalVisible(false);
                  setEditingField(null);
                  setSelectedAgeRange("");
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAgeRangeEdit}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader size="sm" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Gender Modal */}
      <Dialog
        visible={genderModalVisible}
        onDismiss={() => {
          if (!saving) {
            setGenderModalVisible(false);
            setEditingField(null);
            setSelectedGender("");
          }
        }}
        dismissible={!saving}
        maxWidth={400}
      >
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-4 text-center">
            Select Gender
          </h3>
          <div className="mb-5 space-y-2">
            {[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "non_binary", label: "Non-binary" },
              { value: "prefer_not_to_say", label: "Prefer not to say" },
              { value: "other", label: "Other" },
            ].map((gender) => (
              <button
                key={gender.value}
                onClick={() => setSelectedGender(gender.value)}
                className={`w-full flex items-center p-2.5 rounded-lg border-2 transition-colors ${
                  selectedGender === gender.value
                    ? "bg-teal-50 border-teal-500"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 mr-2.5 flex items-center justify-center ${
                    selectedGender === gender.value
                      ? "border-teal-500"
                      : "border-slate-300"
                  }`}
                >
                  {selectedGender === gender.value && (
                    <div className="w-2 h-2 rounded-full bg-teal-500" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    selectedGender === gender.value
                      ? "text-teal-700"
                      : "text-slate-700"
                  }`}
                >
                  {gender.label}
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                if (!saving) {
                  setGenderModalVisible(false);
                  setEditingField(null);
                  setSelectedGender("");
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveGenderEdit}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader size="sm" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Height Modal */}
      <Dialog
        visible={heightModalVisible}
        onDismiss={() => {
          if (!saving) {
            setHeightModalVisible(false);
            setEditingField(null);
            setHeightValue("");
            setHeightUnit("cm");
          }
        }}
        dismissible={!saving}
        maxWidth={400}
      >
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-4 text-center">
            Enter Height
          </h3>
          <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => {
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
              className={`flex-1 py-1.5 px-3.5 rounded-lg text-sm font-semibold transition-colors ${
                heightUnit === "cm"
                  ? "bg-teal-600 text-white"
                  : "bg-transparent text-slate-700"
              }`}
            >
              cm
            </button>
            <button
              onClick={() => {
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
              className={`flex-1 py-1.5 px-3.5 rounded-lg text-sm font-semibold transition-colors ${
                heightUnit === "ft"
                  ? "bg-teal-600 text-white"
                  : "bg-transparent text-slate-700"
              }`}
            >
              ft
            </button>
          </div>
          <div className="mb-5 text-center">
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Height ({heightUnit.toLowerCase()})
            </label>
            <input
              type="text"
              value={heightValue}
              onChange={(e) => setHeightValue(e.target.value)}
              placeholder={`Enter height in ${heightUnit}`}
              className="text-xl font-bold text-center border-b-4 border-amber-500 pb-2.5 w-3/5 focus:outline-none focus:border-amber-600"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                if (!saving) {
                  setHeightModalVisible(false);
                  setEditingField(null);
                  setHeightValue("");
                  setHeightUnit("cm");
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveHeightEdit}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader size="sm" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Weight Modal */}
      <Dialog
        visible={weightModalVisible}
        onDismiss={() => {
          if (!saving) {
            setWeightModalVisible(false);
            setEditingField(null);
            setWeightValue("");
            setWeightUnit("kg");
          }
        }}
        dismissible={!saving}
        maxWidth={400}
      >
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-4 text-center">
            Enter Weight
          </h3>
          <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => {
                if (weightUnit !== "kg" && weightValue) {
                  const pounds = parseFloat(weightValue);
                  if (!isNaN(pounds)) {
                    const kg = pounds / 2.20462;
                    setWeightValue(kg.toFixed(1));
                  }
                }
                setWeightUnit("kg");
              }}
              className={`flex-1 py-1.5 px-3.5 rounded-lg text-sm font-semibold transition-colors ${
                weightUnit === "kg"
                  ? "bg-teal-600 text-white"
                  : "bg-transparent text-slate-700"
              }`}
            >
              kg
            </button>
            <button
              onClick={() => {
                if (weightUnit !== "lbs" && weightValue) {
                  const kg = parseFloat(weightValue);
                  if (!isNaN(kg)) {
                    const pounds = kg * 2.20462;
                    setWeightValue(pounds.toFixed(1));
                  }
                }
                setWeightUnit("lbs");
              }}
              className={`flex-1 py-1.5 px-3.5 rounded-lg text-sm font-semibold transition-colors ${
                weightUnit === "lbs"
                  ? "bg-teal-600 text-white"
                  : "bg-transparent text-slate-700"
              }`}
            >
              lbs
            </button>
          </div>
          <div className="mb-5 text-center">
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Weight ({weightUnit.toLowerCase()})
            </label>
            <input
              type="text"
              value={weightValue}
              onChange={(e) => setWeightValue(e.target.value)}
              placeholder={`Enter weight in ${weightUnit}`}
              className="text-xl font-bold text-center border-b-4 border-amber-500 pb-2.5 w-3/5 focus:outline-none focus:border-amber-600"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                if (!saving) {
                  setWeightModalVisible(false);
                  setEditingField(null);
                  setWeightValue("");
                  setWeightUnit("kg");
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveWeightEdit}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader size="sm" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Country Selection Modal */}
      <Dialog
        visible={countryModalVisible}
        onDismiss={() => {
          if (!saving) {
            setCountryModalVisible(false);
            setSelectedCountry("");
            setCountrySearch("");
          }
        }}
        dismissible={!saving}
        maxWidth={400}
        maxHeight="70vh"
        showCloseButton={false}
      >
        <div
          className="flex flex-col"
          style={{ height: "calc(70vh - 3rem)", minHeight: "400px" }}
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4 shrink-0">
            <h3 className="text-base font-semibold text-slate-900">
              Select Country
            </h3>
            <button
              onClick={() => {
                if (!saving) {
                  setCountryModalVisible(false);
                  setSelectedCountry("");
                  setCountrySearch("");
                }
              }}
              className="text-slate-500 hover:text-slate-700 text-xl"
            >
              ×
            </button>
          </div>
          <div className="mb-4 shrink-0">
            <input
              type="text"
              placeholder="Search country..."
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div
            className="flex-1 overflow-y-auto space-y-1 pr-2 min-h-0"
            style={{ maxHeight: "calc(70vh - 250px)" }}
          >
            {countriesData
              .filter((country) =>
                country.name
                  .toLowerCase()
                  .includes(countrySearch.toLowerCase()),
              )
              .map((country) => (
                <button
                  key={country.name}
                  onClick={() => setSelectedCountry(country.name)}
                  className={`w-full text-left py-2.5 px-3.5 rounded-lg transition-colors ${
                    selectedCountry === country.name
                      ? "bg-teal-50 text-teal-700 font-medium"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  {country.name}
                </button>
              ))}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 mt-4 shrink-0 bg-white sticky bottom-0 z-10">
            <button
              onClick={() => {
                if (!saving) {
                  setCountryModalVisible(false);
                  setSelectedCountry("");
                  setCountrySearch("");
                }
              }}
              disabled={saving}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCountryEdit}
              disabled={!selectedCountry || saving}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedCountry && !saving
                  ? "bg-gradient-to-r from-teal-700 to-teal-500 text-white hover:from-teal-800 hover:to-teal-600"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              }`}
            >
              {saving ? <Loader size="sm" /> : "Save"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* State/Region Selection Modal */}
      <Dialog
        visible={stateModalVisible}
        onDismiss={() => {
          if (!saving) {
            setStateModalVisible(false);
            setSelectedState("");
            setStateSearch("");
            setAvailableStates([]);
          }
        }}
        dismissible={!saving}
        maxWidth={400}
        maxHeight="70vh"
      >
        <div
          className="flex flex-col"
          style={{ height: "calc(70vh - 3rem)", minHeight: "400px" }}
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4 shrink-0">
            <div className="flex items-center flex-1">
              <button
                onClick={() => {
                  setStateModalVisible(false);
                  setCountryModalVisible(true);
                }}
                className="text-slate-500 hover:text-slate-700 text-xl mr-2"
              >
                ←
              </button>
              <h3 className="text-base font-semibold text-slate-900">
                Select Region/State
              </h3>
            </div>
            <button
              onClick={() => {
                if (!saving) {
                  setStateModalVisible(false);
                  setSelectedState("");
                  setStateSearch("");
                  setAvailableStates([]);
                }
              }}
              className="text-slate-500 hover:text-slate-700 text-xl"
            >
              ×
            </button>
          </div>
          {availableStates.length === 0 ? (
            <div className="py-10 text-center shrink-0">
              <p className="text-slate-500 text-sm">
                Please select a country first
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 shrink-0">
                <input
                  type="text"
                  placeholder="Search region/state..."
                  value={stateSearch}
                  onChange={(e) => setStateSearch(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div
                className="flex-1 overflow-y-auto space-y-1 pr-2 min-h-0"
                style={{ maxHeight: "calc(70vh - 250px)" }}
              >
                {availableStates
                  .filter((state) =>
                    state.toLowerCase().includes(stateSearch.toLowerCase()),
                  )
                  .map((state) => (
                    <button
                      key={state}
                      onClick={() => setSelectedState(state)}
                      className={`w-full text-left py-2.5 px-3.5 rounded-lg transition-colors ${
                        selectedState === state
                          ? "bg-teal-50 text-teal-700 font-medium"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      {state}
                    </button>
                  ))}
              </div>
            </>
          )}
          <div className="flex justify-between gap-2 pt-4 border-t border-slate-200 mt-4 shrink-0 bg-white sticky bottom-0 z-10">
            <button
              onClick={() => {
                setStateModalVisible(false);
                setCountryModalVisible(true);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSaveStateEdit}
              disabled={!selectedState || saving}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedState && !saving
                  ? "bg-gradient-to-r from-teal-700 to-teal-500 text-white hover:from-teal-800 hover:to-teal-600"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              }`}
            >
              {saving ? <Loader size="sm" /> : "Save"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Fitness Goal Modal */}
      <Dialog
        visible={fitnessGoalModalVisible}
        onDismiss={() => {
          if (!saving) {
            setFitnessGoalModalVisible(false);
            setEditingField(null);
            setSelectedFitnessGoal("");
          }
        }}
        dismissible={!saving}
        maxWidth={400}
      >
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-4 text-center">
            Select Fitness Goal
          </h3>
          <div className="mb-5 space-y-2 max-h-[400px] overflow-y-auto">
            {[
              { value: "loseWeight", label: "Lose Weight" },
              { value: "buildMuscle", label: "Build Muscle" },
              {
                value: "improveCardiovascular",
                label: "Improve Cardiovascular",
              },
              { value: "increaseStrength", label: "Increase Strength" },
              { value: "enhanceFlexibility", label: "Enhance Flexibility" },
              { value: "buildStrength", label: "Build Strength" },
              { value: "getToned", label: "Get Toned" },
              { value: "getLean", label: "Get Lean" },
              { value: "mobility", label: "Mobility" },
              { value: "endurance", label: "Endurance" },
              { value: "bodyBuilding", label: "Body Building" },
              { value: "stayHealthy", label: "Stay Healthy" },
            ].map((goal) => (
              <button
                key={goal.value}
                onClick={() => setSelectedFitnessGoal(goal.value)}
                className={`w-full flex items-center p-2.5 rounded-lg border-2 transition-colors ${
                  selectedFitnessGoal === goal.value
                    ? "bg-teal-50 border-teal-500"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 mr-2.5 flex items-center justify-center ${
                    selectedFitnessGoal === goal.value
                      ? "border-teal-500"
                      : "border-slate-300"
                  }`}
                >
                  {selectedFitnessGoal === goal.value && (
                    <div className="w-2 h-2 rounded-full bg-teal-500" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    selectedFitnessGoal === goal.value
                      ? "text-teal-700"
                      : "text-slate-700"
                  }`}
                >
                  {goal.label}
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                if (!saving) {
                  setFitnessGoalModalVisible(false);
                  setEditingField(null);
                  setSelectedFitnessGoal("");
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveFitnessGoalEdit}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader size="sm" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Workout Location Modal */}
      <Dialog
        visible={workoutLocationModalVisible}
        onDismiss={() => {
          if (!saving) {
            setWorkoutLocationModalVisible(false);
            setEditingField(null);
            setSelectedWorkoutLocation("");
          }
        }}
        dismissible={!saving}
        maxWidth={400}
      >
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-4 text-center">
            Select Workout Location
          </h3>
          <div className="mb-5 space-y-2">
            {[
              { value: "home", label: "Home" },
              { value: "gym", label: "Gym" },
              { value: "outdoor", label: "Outdoor" },
              { value: "both", label: "Both" },
            ].map((location) => (
              <button
                key={location.value}
                onClick={() => setSelectedWorkoutLocation(location.value)}
                className={`w-full flex items-center p-2.5 rounded-lg border-2 transition-colors ${
                  selectedWorkoutLocation === location.value
                    ? "bg-teal-50 border-teal-500"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 mr-2.5 flex items-center justify-center ${
                    selectedWorkoutLocation === location.value
                      ? "border-teal-500"
                      : "border-slate-300"
                  }`}
                >
                  {selectedWorkoutLocation === location.value && (
                    <div className="w-2 h-2 rounded-full bg-teal-500" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    selectedWorkoutLocation === location.value
                      ? "text-teal-700"
                      : "text-slate-700"
                  }`}
                >
                  {location.label}
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                if (!saving) {
                  setWorkoutLocationModalVisible(false);
                  setEditingField(null);
                  setSelectedWorkoutLocation("");
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveWorkoutLocationEdit}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader size="sm" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Equipment Modal - This is a complex modal, adding simplified version */}
      <Dialog
        visible={equipmentModalVisible}
        onDismiss={() => {
          if (!saving) {
            setEquipmentModalVisible(false);
            setEditingField(null);
            setSelectedEquipmentList([]);
            setOtherEquipmentList([]);
            setCurrentOtherEquipment("");
          }
        }}
        dismissible={!saving}
        maxWidth={500}
        maxHeight="80vh"
      >
        <div className="flex flex-col h-full">
          <h3 className="text-base font-bold text-slate-900 mb-3 text-center">
            Select Equipment
          </h3>
          <div className="flex-1 overflow-y-auto mb-4 space-y-2">
            {userProfile?.workout_location === "gym" ? (
              gymEquipmentOptions.map((option) => (
                <button
                  key={option.code}
                  onClick={() => handleEquipmentSelection(option.code)}
                  className={`w-full text-left p-2.5 rounded-lg border-2 transition-colors ${
                    selectedEquipmentList.includes(option.code)
                      ? "bg-teal-50 border-teal-500"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedEquipmentList.includes(option.code)}
                      onChange={() => {}}
                      className="mr-3 w-5 h-5"
                    />
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                </button>
              ))
            ) : (
              <>
                {homeEquipmentOptions.map((option) => (
                  <button
                    key={option.code}
                    onClick={() => handleEquipmentSelection(option.code)}
                    className={`w-full text-left p-2.5 rounded-lg border-2 transition-colors ${
                      selectedEquipmentList.includes(option.code)
                        ? "bg-teal-50 border-teal-500"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedEquipmentList.includes(option.code)}
                        onChange={() => {}}
                        className="mr-3 w-5 h-5"
                      />
                      <span className="text-sm font-medium">
                        {option.label}
                      </span>
                    </div>
                  </button>
                ))}
                {selectedEquipmentList.includes("other") && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={currentOtherEquipment}
                        onChange={(e) =>
                          setCurrentOtherEquipment(e.target.value)
                        }
                        placeholder="Enter custom equipment"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <button
                        onClick={addCustomEquipment}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium"
                      >
                        Add
                      </button>
                    </div>
                    <div className="space-y-1">
                      {otherEquipmentList.map((eq) => (
                        <div
                          key={eq}
                          className="flex items-center justify-between p-2 bg-white rounded"
                        >
                          <span className="text-sm">{eq}</span>
                          <button
                            onClick={() => removeCustomEquipment(eq)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => {
                if (!saving) {
                  setEquipmentModalVisible(false);
                  setEditingField(null);
                  setSelectedEquipmentList([]);
                  setOtherEquipmentList([]);
                  setCurrentOtherEquipment("");
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEquipmentEdit}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader size="sm" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Workout Duration Modal */}
      <Dialog
        visible={workoutDurationModalVisible}
        onDismiss={() => {
          if (!saving) {
            setWorkoutDurationModalVisible(false);
            setEditingField(null);
            setWorkoutDurationValue(30);
          }
        }}
        dismissible={!saving}
        maxWidth={400}
      >
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-4 text-center">
            Workout Duration
          </h3>
          <div className="mb-5 text-center">
            <input
              type="range"
              min="15"
              max="180"
              step="15"
              value={workoutDurationValue}
              onChange={(e) => setWorkoutDurationValue(Number(e.target.value))}
              className="w-full"
            />
            <div className="mt-4 text-3xl font-bold text-teal-700">
              {formatWorkoutDuration(workoutDurationValue)}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                if (!saving) {
                  setWorkoutDurationModalVisible(false);
                  setEditingField(null);
                  setWorkoutDurationValue(30);
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveWorkoutDurationEdit}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader size="sm" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Weekly Frequency Modal */}
      <Dialog
        visible={weeklyFrequencyModalVisible}
        onDismiss={() => {
          if (!saving) {
            setWeeklyFrequencyModalVisible(false);
            setEditingField(null);
            setSelectedWeeklyDays([]);
          }
        }}
        dismissible={!saving}
        maxWidth={400}
      >
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-4 text-center">
            Select Weekly Frequency
          </h3>
          <div className="mb-5 space-y-2">
            {[
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
              "sunday",
            ].map((day) => (
              <button
                key={day}
                onClick={() => handleWeeklyDayToggle(day)}
                className={`w-full flex items-center p-2.5 rounded-lg border-2 transition-colors ${
                  selectedWeeklyDays.includes(day)
                    ? "bg-teal-50 border-teal-500"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedWeeklyDays.includes(day)}
                  onChange={() => {}}
                  className="mr-3 w-5 h-5"
                />
                <span className="text-sm font-medium capitalize">{day}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                if (!saving) {
                  setWeeklyFrequencyModalVisible(false);
                  setEditingField(null);
                  setSelectedWeeklyDays([]);
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveWeeklyFrequencyEdit}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader size="sm" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Meal Plan Duration Modal */}
      <Dialog
        visible={mealPlanDurationModalVisible}
        onDismiss={() => {
          if (!saving) {
            setMealPlanDurationModalVisible(false);
            setEditingField(null);
            setSelectedMealPlanDays([]);
          }
        }}
        dismissible={!saving}
        maxWidth={400}
      >
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-4 text-center">
            Select Meal Plan Duration
          </h3>
          <div className="mb-5 space-y-2">
            {[
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
              "sunday",
            ].map((day) => (
              <button
                key={day}
                onClick={() => handleMealPlanDayToggle(day)}
                className={`w-full flex items-center p-2.5 rounded-lg border-2 transition-colors ${
                  selectedMealPlanDays.includes(day)
                    ? "bg-teal-50 border-teal-500"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedMealPlanDays.includes(day)}
                  onChange={() => {}}
                  className="mr-3 w-5 h-5"
                />
                <span className="text-sm font-medium capitalize">{day}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                if (!saving) {
                  setMealPlanDurationModalVisible(false);
                  setEditingField(null);
                  setSelectedMealPlanDays([]);
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveMealPlanDurationEdit}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader size="sm" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Dietary Preference Modal */}
      <Dialog
        visible={dietaryPreferenceModalVisible}
        onDismiss={() => {
          if (!saving) {
            setDietaryPreferenceModalVisible(false);
            setEditingField(null);
            setSelectedDietaryPreference("");
          }
        }}
        dismissible={!saving}
        maxWidth={400}
      >
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-4 text-center">
            Select Dietary Preference
          </h3>
          <div className="mb-5 space-y-2 max-h-[400px] overflow-y-auto">
            {dietaryPreferenceOptions.map((option) => (
              <button
                key={option.code}
                onClick={() => setSelectedDietaryPreference(option.code)}
                className={`w-full flex items-center p-2.5 rounded-lg border-2 transition-colors ${
                  selectedDietaryPreference === option.code
                    ? "bg-teal-50 border-teal-500"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 mr-2.5 flex items-center justify-center ${
                    selectedDietaryPreference === option.code
                      ? "border-teal-500"
                      : "border-slate-300"
                  }`}
                >
                  {selectedDietaryPreference === option.code && (
                    <div className="w-2 h-2 rounded-full bg-teal-500" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    selectedDietaryPreference === option.code
                      ? "text-teal-700"
                      : "text-slate-700"
                  }`}
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                if (!saving) {
                  setDietaryPreferenceModalVisible(false);
                  setEditingField(null);
                  setSelectedDietaryPreference("");
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDietaryPreferenceEdit}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader size="sm" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Health Conditions Modal */}
      <Dialog
        visible={healthConditionsModalVisible}
        onDismiss={() => {
          if (!saving) {
            setHealthConditionsModalVisible(false);
            setEditingField(null);
            setSelectedHealthConditions([]);
            setOtherHealthConditions([]);
            setCurrentOtherHealthCondition("");
          }
        }}
        dismissible={!saving}
        maxWidth={500}
        maxHeight="80vh"
      >
        <div className="flex flex-col h-full">
          <h3 className="text-base font-bold text-slate-900 mb-3 text-center">
            Select Health Conditions
          </h3>
          <div className="flex-1 overflow-y-auto mb-4 space-y-2">
            {healthConditionOptions.map((option) => (
              <button
                key={option.code}
                onClick={() => handleHealthConditionSelection(option.code)}
                className={`w-full text-left p-2.5 rounded-lg border-2 transition-colors ${
                  selectedHealthConditions.includes(option.code)
                    ? "bg-teal-50 border-teal-500"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedHealthConditions.includes(option.code)}
                    onChange={() => {}}
                    className="mr-3 w-5 h-5"
                  />
                  <span className="text-sm font-medium">{option.label}</span>
                </div>
              </button>
            ))}
            {selectedHealthConditions.includes("other") && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={currentOtherHealthCondition}
                    onChange={(e) =>
                      setCurrentOtherHealthCondition(e.target.value)
                    }
                    placeholder="Enter custom condition"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={addCustomHealthCondition}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-1">
                  {otherHealthConditions.map((condition) => (
                    <div
                      key={condition}
                      className="flex items-center justify-between p-2 bg-white rounded"
                    >
                      <span className="text-sm">{condition}</span>
                      <button
                        onClick={() => removeCustomHealthCondition(condition)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => {
                if (!saving) {
                  setHealthConditionsModalVisible(false);
                  setEditingField(null);
                  setSelectedHealthConditions([]);
                  setOtherHealthConditions([]);
                  setCurrentOtherHealthCondition("");
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveHealthConditionsEdit}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader size="sm" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Target Muscle Groups Modal */}
      <Dialog
        visible={targetMuscleGroupsModalVisible}
        onDismiss={() => {
          if (!saving) {
            setTargetMuscleGroupsModalVisible(false);
            setEditingField(null);
            setSelectedTargetMuscleGroups([]);
          }
        }}
        dismissible={!saving}
        maxWidth={400}
      >
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-4 text-center">
            Select Target Muscle Groups
          </h3>
          <div className="mb-5 space-y-2 max-h-[400px] overflow-y-auto">
            {targetMuscleGroupOptions.map((option) => (
              <button
                key={option.code}
                onClick={() => handleTargetMuscleGroupToggle(option.code)}
                className={`w-full text-left p-2.5 rounded-lg border-2 transition-colors ${
                  selectedTargetMuscleGroups.includes(option.code)
                    ? "bg-teal-50 border-teal-500"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedTargetMuscleGroups.includes(option.code)}
                    onChange={() => {}}
                    className="mr-3 w-5 h-5"
                  />
                  <span className="text-sm font-medium">{option.label}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                if (!saving) {
                  setTargetMuscleGroupsModalVisible(false);
                  setEditingField(null);
                  setSelectedTargetMuscleGroups([]);
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveTargetMuscleGroupsEdit}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader size="sm" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog
        visible={changePasswordModalVisible}
        onDismiss={() => {
          if (!passwordLoading) {
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
          }
        }}
        dismissible={!passwordLoading}
        maxWidth={500}
      >
        <div>
          <h3 className="text-xl font-bold text-slate-900 mb-2 text-center">
            Change Password
          </h3>
          <p className="text-sm text-slate-600 mb-5 text-center">
            Enter your current password to change it
          </p>

          {/* Current Password */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Current Password
            </label>
            <div
              className={`flex items-center bg-slate-50 rounded-lg px-4 border ${
                currentPasswordError
                  ? "border-red-500"
                  : currentPassword
                    ? "border-slate-900"
                    : "border-slate-300"
              }`}
            >
              <HiKey
                className={`w-5 h-5 mr-2 ${
                  currentPasswordError
                    ? "text-red-500"
                    : currentPassword
                      ? "text-slate-900"
                      : "text-slate-500"
                }`}
              />
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (currentPasswordError) setCurrentPasswordError("");
                }}
                placeholder="Enter current password"
                className="flex-1 py-3 px-2 text-sm bg-transparent focus:outline-none"
              />
              <button
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="p-1 text-slate-500 hover:text-slate-700"
              >
                {showCurrentPassword ? (
                  <HiEyeSlash className="w-5 h-5" />
                ) : (
                  <HiEye className="w-5 h-5" />
                )}
              </button>
            </div>
            {currentPasswordError && (
              <p className="text-red-500 text-xs mt-1">
                {currentPasswordError}
              </p>
            )}
          </div>

          {/* New Password */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              New Password
            </label>
            <div
              className={`flex items-center bg-slate-50 rounded-lg px-4 border ${
                newPasswordError
                  ? "border-red-500"
                  : newPassword && !newPasswordError
                    ? "border-green-500"
                    : "border-slate-300"
              }`}
            >
              <HiKey
                className={`w-5 h-5 mr-2 ${
                  newPasswordError
                    ? "text-red-500"
                    : newPassword && !newPasswordError
                      ? "text-green-500"
                      : "text-slate-500"
                }`}
              />
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => handleNewPasswordChange(e.target.value)}
                placeholder="Enter new password"
                className="flex-1 py-3 px-2 text-sm bg-transparent focus:outline-none"
              />
              <button
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="p-1 text-slate-500 hover:text-slate-700"
              >
                {showNewPassword ? (
                  <HiEyeSlash className="w-5 h-5" />
                ) : (
                  <HiEye className="w-5 h-5" />
                )}
              </button>
            </div>
            {newPasswordError ? (
              <p className="text-red-500 text-xs mt-1">{newPasswordError}</p>
            ) : newPassword && !newPasswordError ? (
              <p className="text-teal-600 text-xs mt-1">
                Password meets requirements
              </p>
            ) : null}
          </div>

          {/* Confirm Password */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Confirm New Password
            </label>
            <div
              className={`flex items-center bg-slate-50 rounded-lg px-4 border ${
                confirmPasswordError
                  ? "border-red-500"
                  : confirmNewPassword && !confirmPasswordError
                    ? "border-green-500"
                    : "border-slate-300"
              }`}
            >
              <HiKey
                className={`w-5 h-5 mr-2 ${
                  confirmPasswordError
                    ? "text-red-500"
                    : confirmNewPassword && !confirmPasswordError
                      ? "text-green-500"
                      : "text-slate-500"
                }`}
              />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmNewPassword}
                onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                placeholder="Confirm new password"
                className="flex-1 py-3 px-2 text-sm bg-transparent focus:outline-none"
              />
              <button
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="p-1 text-slate-500 hover:text-slate-700"
              >
                {showConfirmPassword ? (
                  <HiEyeSlash className="w-5 h-5" />
                ) : (
                  <HiEye className="w-5 h-5" />
                )}
              </button>
            </div>
            {confirmPasswordError ? (
              <p className="text-red-500 text-xs mt-1">
                {confirmPasswordError}
              </p>
            ) : confirmNewPassword && !confirmPasswordError ? (
              <p className="text-teal-600 text-xs mt-1">Passwords match</p>
            ) : null}
          </div>

          {/* Password Requirements */}
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-5">
            <p className="text-xs text-teal-700 font-medium mb-1">
              Password Requirements:
            </p>
            <ul className="text-xs text-teal-700 space-y-0.5">
              <li>• At least 8 characters long</li>
              <li>• Contains both uppercase and lowercase letters</li>
              <li>• Contains at least one number</li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                if (!passwordLoading) {
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
                }
              }}
              disabled={passwordLoading}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleChangePassword}
              disabled={passwordLoading}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {passwordLoading ? (
                <>
                  <Loader size="sm" />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

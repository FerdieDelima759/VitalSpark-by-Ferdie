"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useOnboardingHeader } from "@/contexts/OnboardingHeaderContext";
import { useUserData } from "@/hooks/useUserData";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/hooks/useAuth";
import Loader from "@/components/Loader";
import Toast, { ToastProps } from "@/components/Toast";

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

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

const fitnessGoalOptions: FitnessGoalOption[] = [
  { code: "loseWeight", label: "Lose Weight" },
  { code: "buildMuscle", label: "Build Muscle" },
  { code: "improveCardiovascular", label: "Improve Cardiovascular" },
  { code: "increaseStrength", label: "Increase Strength" },
  { code: "enhanceFlexibility", label: "Enhance Flexibility" },
  { code: "buildStrength", label: "Build Strength" },
  { code: "getToned", label: "Get Toned" },
  { code: "getLean", label: "Get Lean" },
  { code: "mobility", label: "Mobility" },
  { code: "endurance", label: "Endurance" },
  { code: "bodyBuilding", label: "Body Building" },
  { code: "stayHealthy", label: "Stay Healthy" },
];

const getFitnessGoalCode = (storedValue: string): string | null => {
  const byCode = fitnessGoalOptions.find((goal) => goal.code === storedValue);
  if (byCode) return byCode.code;
  const byLabel = fitnessGoalOptions.find((goal) => goal.label === storedValue);
  return byLabel ? byLabel.code : null;
};

const getFitnessGoalLabel = (code: string): string | null => {
  const goal = fitnessGoalOptions.find((item) => item.code === code);
  return goal ? goal.label : null;
};

const fitnessLevelOptions: FitnessLevelOption[] = [
  { code: "beginner", label: "Beginner" },
  { code: "intermediate", label: "Intermediate" },
  { code: "advanced", label: "Advanced" },
];

const workoutLocationOptions: WorkoutLocationOption[] = [
  { code: "home", label: "Home" },
  { code: "gym", label: "Gym" },
];

const homeEquipmentOptions: EquipmentOption[] = [
  { code: "none", label: "None" },
  { code: "dumbbells", label: "Dumbbells" },
  { code: "resistanceBands", label: "Resistance Bands" },
  { code: "pullUpBar", label: "Pull Up Bar" },
  { code: "yogaMat", label: "Yoga Mat" },
  { code: "kettleBells", label: "Kettle Bells" },
  { code: "barBell", label: "Barbell" },
  { code: "treadmill", label: "Treadmill" },
  { code: "jumpingRope", label: "Jumping Rope" },
  { code: "other", label: "Other" },
];

const gymEquipmentOptions: EquipmentOption[] = [
  { code: "fullGymAccess", label: "Full Gym Access" },
];

const weekDays: WeekDay[] = [
  { code: "monday", label: "Monday", selected: false },
  { code: "tuesday", label: "Tuesday", selected: false },
  { code: "wednesday", label: "Wednesday", selected: false },
  { code: "thursday", label: "Thursday", selected: false },
  { code: "friday", label: "Friday", selected: false },
  { code: "saturday", label: "Saturday", selected: false },
  { code: "sunday", label: "Sunday", selected: false },
];

export default function FitnessOnboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const { setHeader } = useOnboardingHeader();
  const [selectedFitnessGoal, setSelectedFitnessGoal] = useState<string | null>(
    null,
  );
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>([]);
  const [otherEquipments, setOtherEquipments] = useState<string[]>([]);
  const [currentOtherEquipment, setCurrentOtherEquipment] = useState("");
  const [workoutDuration, setWorkoutDuration] = useState(30);
  const [weeklyFrequency, setWeeklyFrequency] = useState<WeekDay[]>(weekDays);
  const [showFitnessGoalDropdown, setShowFitnessGoalDropdown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { upsertUserProfile, fetchUserProfile } = useUserData();
  const [userProfile, setUserProfile] = useState<any>(null);
  const fitnessGoalDropdownRef = useRef<HTMLDivElement>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);

  useEffect(() => {
    const loadProfile = async () => {
      if (user?.id) {
        const result = await fetchUserProfile(user.id);
        if (result.success && result.data) {
          setUserProfile(result.data);
          if (result.data.fitness_goal) {
            const goalCode = getFitnessGoalCode(result.data.fitness_goal);
            if (goalCode) setSelectedFitnessGoal(goalCode);
          }
          if (result.data.fitness_level)
            setSelectedLevel(result.data.fitness_level);
          if (result.data.workout_location)
            setSelectedLocation(result.data.workout_location);
          if (
            result.data.equipment_list &&
            result.data.equipment_list.length > 0
          ) {
            const standardEquipment = homeEquipmentOptions
              .map((eq) => eq.code)
              .concat(gymEquipmentOptions.map((eq) => eq.code));
            const standard = result.data.equipment_list.filter((eq: string) =>
              standardEquipment.includes(eq),
            );
            const custom = result.data.equipment_list.filter(
              (eq: string) => !standardEquipment.includes(eq),
            );
            setSelectedEquipments(
              custom.length > 0 ? [...standard, "other"] : standard,
            );
            if (custom.length > 0) {
              setOtherEquipments(custom);
            }
          }
          if (result.data.workout_duration_minutes) {
            setWorkoutDuration(result.data.workout_duration_minutes);
          }
          if (
            result.data.weekly_frequency &&
            result.data.weekly_frequency.length > 0
          ) {
            setWeeklyFrequency((prev) =>
              prev.map((day) => ({
                ...day,
                selected:
                  result.data?.weekly_frequency?.includes(day.code) || false,
              })),
            );
          }
        }
      }
    };
    loadProfile();
  }, [user, fetchUserProfile]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        fitnessGoalDropdownRef.current &&
        !fitnessGoalDropdownRef.current.contains(event.target as Node)
      ) {
        setShowFitnessGoalDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const showToast = (
    type: "success" | "error",
    title: string,
    message: string
  ) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const handleEquipmentSelection = (equipmentCode: string) => {
    setSelectedEquipments((prev) => {
      if (equipmentCode === "none") {
        return ["none"];
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
    setWeeklyFrequency((prev) => {
      const updated = prev.map((d) =>
        d.code === dayCode ? { ...d, selected: !d.selected } : d
      );
      const selectedCount = updated.filter((d) => d.selected).length;
      if (selectedCount > 5) {
        showToast(
          "error",
          "Too many days",
          "You can select a maximum of 5 days only."
        );
        return prev;
      }
      return updated;
    });
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

  const handleContinue = async () => {
    if (!isValid) return;
    setBusy(true);
    setError(null);
    try {
      const { data: currentUser } = await auth.getCurrentUser();
      if (!currentUser?.user) {
        setError("Please sign in again to continue onboarding.");
        return;
      }

      const equipmentList = [
        ...selectedEquipments.filter((eq) => eq !== "other"),
        ...(selectedEquipments.includes("other") ? otherEquipments : []),
      ];

      const selectedDays = weeklyFrequency
        .filter((d) => d.selected)
        .map((d) => d.code);

      const fitnessGoalLabel = selectedFitnessGoal
        ? getFitnessGoalLabel(selectedFitnessGoal)
        : null;
      const result = await upsertUserProfile({
        user_id: currentUser.user.id,
        fitness_goal: fitnessGoalLabel || undefined,
        fitness_level: selectedLevel || undefined,
        workout_location: selectedLocation || undefined,
        equipment_list: equipmentList,
        workout_duration_minutes: workoutDuration,
        weekly_frequency: selectedDays,
        plan_code: userProfile?.plan_code ?? "premium",
        current_step: Math.max(userProfile?.current_step || 7, 8),
        is_onboarding_complete: false,
      });

      if (!result.success) {
        console.error("Failed to save fitness data:", result.error);
        setError("Failed to save your fitness preferences. Please try again.");
        setBusy(false);
        return;
      }

      setHeader({ animation: "slide_from_right" });
      router.push("/onboarding/target-muscle-group");
    } catch (e: any) {
      console.error("Fitness save error:", e);
      setError(e?.message ?? "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setHeader({ animation: "slide_from_left" });
    router.push("/onboarding/weight");
  };

  useEffect(() => {
    setHeader({
      currentStep: 7,
      totalSteps: 9,
      onBack,
      onNext: () => isValid && handleContinue(),
      canGoBack: true,
      nextDisabled: busy || !isValid,
      backIconColor: "#ffffff",
      nextIconColor: "#ffffff",
    });
  }, [
    setHeader,
    busy,
    isValid,
    selectedFitnessGoal,
    selectedLevel,
    selectedLocation,
    selectedEquipments,
    otherEquipments,
    workoutDuration,
    weeklyFrequency,
  ]);

  return (
    <div
      className="bg-[#101A2C] flex justify-center pt-12"
      style={{
        minHeight: showFitnessGoalDropdown ? "calc(100vh + 500px)" : "100vh",
        paddingBottom: showFitnessGoalDropdown ? "500px" : "3rem",
      }}
    >
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-8">
          <h2 className="text-amber-500 text-2xl sm:text-3xl font-bold mb-2">
            Your Fitness Goals
          </h2>
          <p className="text-gray-300 text-base sm:text-lg">
            Tell us about your fitness preferences
          </p>
          {error && (
            <div className="mt-4 bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Fitness Goal */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Fitness Goal
            </label>
            <div className="relative" ref={fitnessGoalDropdownRef}>
              <button
                type="button"
                onClick={() =>
                  setShowFitnessGoalDropdown(!showFitnessGoalDropdown)
                }
                disabled={busy}
                className={`w-full bg-[#18223A] text-left py-4 px-5 rounded-xl border-2 transition-all ${
                  selectedFitnessGoal
                    ? "border-amber-500 text-gray-100"
                    : "border-gray-600 text-gray-400"
                } ${busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} flex items-center justify-between`}
              >
                <span>
                  {selectedFitnessGoal
                    ? fitnessGoalOptions.find(
                        (g) => g.code === selectedFitnessGoal,
                      )?.label
                    : "Select Fitness Goal"}
                </span>
                <span
                  className={`transform transition-transform ${
                    showFitnessGoalDropdown ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              {showFitnessGoalDropdown && (
                <div className="absolute z-50 w-full mt-2 bg-[#18223A] rounded-xl border border-gray-600 shadow-lg max-h-80 overflow-y-auto">
                  {fitnessGoalOptions.map((goal, index) => (
                    <button
                      key={goal.code}
                      type="button"
                      onClick={() => {
                        setSelectedFitnessGoal(goal.code);
                        setShowFitnessGoalDropdown(false);
                      }}
                      className={`w-full text-left px-5 py-3.5 hover:bg-[#101A2C] transition-colors border-b border-gray-700 last:border-b-0 ${
                        selectedFitnessGoal === goal.code
                          ? "text-amber-500 font-semibold bg-[#101A2C]"
                          : "text-gray-100"
                      }`}
                    >
                      {goal.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fitness Level */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Level
            </label>
            <div className="space-y-2">
              {fitnessLevelOptions.map((level) => (
                <button
                  key={level.code}
                  type="button"
                  disabled={busy}
                  onClick={() => setSelectedLevel(level.code)}
                  className={`w-full flex items-center p-4 rounded-xl border-2 transition-all ${
                    selectedLevel === level.code
                      ? "border-amber-500 bg-[#18223A]"
                      : "border-gray-600 bg-[#18223A] hover:border-gray-500"
                  } ${busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                      selectedLevel === level.code
                        ? "border-amber-500"
                        : "border-gray-600"
                    }`}
                  >
                    {selectedLevel === level.code && (
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    )}
                  </div>
                  <span
                    className={`font-medium ${
                      selectedLevel === level.code
                        ? "text-amber-500"
                        : "text-gray-300"
                    }`}
                  >
                    {level.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Workout Location */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Workout Location
            </label>
            <div className="space-y-2">
              {workoutLocationOptions.map((location) => (
                <button
                  key={location.code}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setSelectedLocation(location.code);
                    setSelectedEquipments([]);
                    setOtherEquipments([]);
                    setCurrentOtherEquipment("");
                  }}
                  className={`w-full flex items-center p-4 rounded-xl border-2 transition-all ${
                    selectedLocation === location.code
                      ? "border-amber-500 bg-[#18223A]"
                      : "border-gray-600 bg-[#18223A] hover:border-gray-500"
                  } ${busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                      selectedLocation === location.code
                        ? "border-amber-500"
                        : "border-gray-600"
                    }`}
                  >
                    {selectedLocation === location.code && (
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    )}
                  </div>
                  <span
                    className={`font-medium ${
                      selectedLocation === location.code
                        ? "text-amber-500"
                        : "text-gray-300"
                    }`}
                  >
                    {location.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Equipment */}
          {selectedLocation && (
            <div>
              <label className="block text-white text-sm font-semibold mb-2">
                Equipment
              </label>
              <div className="grid grid-cols-2 gap-2">
                {equipmentOptions.map((equipment) => {
                  const isNoneSelected = selectedEquipments.includes("none");
                  const isDisabled =
                    isNoneSelected && equipment.code !== "none";
                  const isSelected = selectedEquipments.includes(
                    equipment.code,
                  );

                  return (
                    <button
                      key={equipment.code}
                      type="button"
                      disabled={busy || isDisabled}
                      onClick={() => handleEquipmentSelection(equipment.code)}
                      className={`flex items-center p-3 rounded-xl border-2 transition-all ${
                        isDisabled
                          ? "border-gray-600 bg-[#18223A] opacity-50"
                          : isSelected
                            ? "border-amber-500 bg-[#18223A]"
                            : "border-gray-600 bg-[#18223A] hover:border-gray-500"
                      } ${busy || isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 mr-2 flex items-center justify-center ${
                          isSelected
                            ? "bg-amber-500 border-amber-500"
                            : "border-gray-600"
                        }`}
                      >
                        {isSelected && (
                          <span className="text-white text-xs font-bold">
                            ✓
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-sm font-medium flex-1 text-left ${
                          isSelected
                            ? "text-amber-500"
                            : isDisabled
                              ? "text-gray-500"
                              : "text-gray-300"
                        }`}
                      >
                        {equipment.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom equipment when at home */}
              {selectedLocation === "home" &&
                selectedEquipments.includes("other") &&
                !selectedEquipments.includes("none") && (
                  <div className="mt-4">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={currentOtherEquipment}
                        onChange={(e) =>
                          setCurrentOtherEquipment(e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomEquipment();
                          }
                        }}
                        placeholder="Specify other equipment"
                        className="flex-1 bg-[#18223A] text-gray-100 px-4 py-3 rounded-xl border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={addCustomEquipment}
                        disabled={!currentOtherEquipment.trim()}
                        className={`px-4 py-3 rounded-xl font-semibold ${
                          currentOtherEquipment.trim()
                            ? "bg-amber-500 text-black"
                            : "bg-gray-600 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        +
                      </button>
                    </div>
                    {otherEquipments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {otherEquipments.map((equipment, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-[#18223A] px-4 py-3 rounded-xl border border-amber-500"
                          >
                            <span className="text-gray-100">{equipment}</span>
                            <button
                              type="button"
                              onClick={() => removeCustomEquipment(equipment)}
                              className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center font-bold"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
            </div>
          )}

          {/* Workout Duration */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Workout Duration
            </label>
            <div className="text-center">
              <div className="text-amber-500 text-lg font-semibold mb-4">
                {workoutDuration} minutes
              </div>
              <input
                type="range"
                min="15"
                max="120"
                step="15"
                value={workoutDuration}
                onChange={(e) => setWorkoutDuration(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                style={{
                  background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${
                    ((workoutDuration - 15) / (120 - 15)) * 100
                  }%, #374151 ${((workoutDuration - 15) / (120 - 15)) * 100}%, #374151 100%)`,
                }}
              />
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>15 min</span>
                <span>120 min</span>
              </div>
            </div>
          </div>

          {/* Weekly Frequency */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Weekly Frequency
            </label>
            <div className="flex flex-wrap gap-2">
              {weeklyFrequency.map((day) => (
                <button
                  key={day.code}
                  type="button"
                  disabled={busy}
                  onClick={() => handleWeeklyFrequencyToggle(day.code)}
                  className={`px-4 py-2 rounded-xl border-2 transition-all ${
                    day.selected
                      ? "bg-amber-500 border-amber-500 text-white"
                      : "bg-[#18223A] border-gray-600 text-gray-300 hover:border-gray-500"
                  } ${busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span className="font-semibold text-sm">{day.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={busy || !isValid}
            onClick={handleContinue}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              isValid && !busy
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-gray-400 text-gray-200 cursor-not-allowed"
            }`}
          >
            {busy ? (
              <div className="flex items-center justify-center">
                <Loader size="sm" inline />
                <span className="ml-2">Loading...</span>
              </div>
            ) : (
              "Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

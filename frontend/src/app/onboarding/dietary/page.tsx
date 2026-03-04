"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useOnboardingHeader } from "@/contexts/OnboardingHeaderContext";
import { useUserData } from "@/hooks/useUserData";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/hooks/useAuth";
import Loader from "@/components/Loader";

interface DietaryPreferenceOption {
  code: string;
  label: string;
}

interface HealthConditionOption {
  code: string;
  label: string;
}

const dietaryPreferenceOptions: DietaryPreferenceOption[] = [
  { code: "vegan", label: "Vegan" },
  { code: "keto", label: "Keto" },
  { code: "paleo", label: "Paleo" },
  { code: "mediterranean", label: "Mediterranean" },
  { code: "balanced", label: "Balanced" },
  { code: "glutenFree", label: "Gluten Free" },
  { code: "flexitarian", label: "Flexitarian" },
  { code: "filipinoHeritage", label: "Filipino Heritage" },
];

const healthConditionOptions: HealthConditionOption[] = [
  { code: "acidReflux", label: "Acid Reflux" },
  { code: "highBloodPressure", label: "High Blood Pressure" },
  { code: "diabetes", label: "Diabetes" },
  { code: "other", label: "Other" },
];

const weekDays = [
  { code: "monday", label: "Monday" },
  { code: "tuesday", label: "Tuesday" },
  { code: "wednesday", label: "Wednesday" },
  { code: "thursday", label: "Thursday" },
  { code: "friday", label: "Friday" },
  { code: "saturday", label: "Saturday" },
  { code: "sunday", label: "Sunday" },
];

export default function DietaryOnboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const { setHeader } = useOnboardingHeader();
  const [selectedDietaryPreference, setSelectedDietaryPreference] = useState<
    string | null
  >(null);
  const [weeklyBudget, setWeeklyBudget] = useState<string>("");
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
  const { upsertUserProfile, fetchUserProfile } = useUserData();
  const [userProfile, setUserProfile] = useState<any>(null);
  const dietaryPreferenceDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (user?.id) {
        const result = await fetchUserProfile(user.id);
        if (result.success && result.data) {
          setUserProfile(result.data);
          if (result.data.dietary_preference) {
            setSelectedDietaryPreference(result.data.dietary_preference);
          }
          if (result.data.weekly_budget) {
            setWeeklyBudget(result.data.weekly_budget.toString());
          }
          if (
            result.data.meal_plan_duration &&
            result.data.meal_plan_duration.length > 0
          ) {
            setSelectedMealPlanDays(result.data.meal_plan_duration);
          }
          if (
            result.data.health_conditions &&
            result.data.health_conditions.length > 0
          ) {
            const standardConditions = healthConditionOptions.map(
              (c) => c.code
            );
            const standard = result.data.health_conditions.filter((c: string) =>
              standardConditions.includes(c)
            );
            const custom = result.data.health_conditions.filter(
              (c: string) => !standardConditions.includes(c)
            );
            setSelectedHealthConditions(
              custom.length > 0 ? [...standard, "other"] : standard
            );
            if (custom.length > 0) {
              setOtherHealthConditions(custom);
            }
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
        dietaryPreferenceDropdownRef.current &&
        !dietaryPreferenceDropdownRef.current.contains(event.target as Node)
      ) {
        setShowDietaryPreferenceDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  const isValid =
    !!selectedDietaryPreference && selectedMealPlanDays.length > 0;

  const handleContinue = async () => {
    if (!isValid) return;
    setBusy(true);
    setError(null);
    try {
      const { data: currentUser } = await auth.getCurrentUser();
      if (currentUser?.user) {
        const healthConditionsList = [
          ...selectedHealthConditions.filter((c) => c !== "other"),
          ...(selectedHealthConditions.includes("other")
            ? otherHealthConditions
            : []),
        ];

        // Default to 50 if no budget is entered
        const budgetValue =
          weeklyBudget.trim() === ""
            ? 50
            : parseInt(weeklyBudget.replace(/[^0-9]/g, ""), 10) || 50;

        const result = await upsertUserProfile({
          user_id: currentUser.user.id,
          dietary_preference: selectedDietaryPreference || undefined,
          weekly_budget: budgetValue,
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
      router.push("/onboarding/finish");
    } catch (e: any) {
      console.error("Dietary save error:", e);
      setError(e?.message ?? "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setHeader({ animation: "slide_from_left" });
    router.push("/onboarding/target-muscle-group");
  };

  const onNext = () => {
    if (isValid) handleContinue();
  };

  useEffect(() => {
    setHeader({
      currentStep: 9,
      totalSteps: 9,
      onBack,
      onNext,
      canGoBack: true,
      nextDisabled: busy || !isValid,
      backIconColor: "#ffffff",
      nextIconColor: "#ffffff",
    });
  }, [
    setHeader,
    busy,
    isValid,
    selectedDietaryPreference,
    selectedMealPlanDays,
  ]);

  return (
    <div
      className="bg-[#101A2C] flex justify-center pt-12"
      style={{
        minHeight: showDietaryPreferenceDropdown
          ? "calc(100vh + 300px)"
          : "100vh",
        paddingBottom: showDietaryPreferenceDropdown ? "300px" : "3rem",
      }}
    >
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-8">
          <h2 className="text-amber-500 text-2xl sm:text-3xl font-bold mb-2">
            Dietary Preferences
          </h2>
          <p className="text-gray-300 text-base sm:text-lg">
            Help us personalize your meal planning
          </p>
          {error && (
            <div className="mt-4 bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Dietary Preference */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Dietary Preference
            </label>
            <div className="relative" ref={dietaryPreferenceDropdownRef}>
              <button
                type="button"
                onClick={() =>
                  setShowDietaryPreferenceDropdown(
                    !showDietaryPreferenceDropdown
                  )
                }
                disabled={busy}
                className={`w-full bg-[#18223A] text-left py-4 px-5 rounded-xl border-2 transition-all ${
                  selectedDietaryPreference
                    ? "border-amber-500 text-gray-100"
                    : "border-gray-600 text-gray-400"
                } ${
                  busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                } flex items-center justify-between`}
              >
                <span>
                  {selectedDietaryPreference
                    ? dietaryPreferenceOptions.find(
                        (o) => o.code === selectedDietaryPreference
                      )?.label
                    : "Select Dietary Preference"}
                </span>
                <span
                  className={`transform transition-transform ${
                    showDietaryPreferenceDropdown ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              {showDietaryPreferenceDropdown && (
                <div className="absolute z-50 w-full mt-2 bg-[#18223A] rounded-xl border border-gray-600 shadow-lg max-h-80 overflow-y-auto">
                  {dietaryPreferenceOptions.map((option, index) => (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => {
                        setSelectedDietaryPreference(option.code);
                        setShowDietaryPreferenceDropdown(false);
                      }}
                      className={`w-full text-left px-5 py-3.5 hover:bg-[#101A2C] transition-colors border-b border-gray-700 last:border-b-0 ${
                        selectedDietaryPreference === option.code
                          ? "text-amber-500 font-semibold bg-[#101A2C]"
                          : "text-gray-100"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Weekly Budget */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Weekly Budget
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-100 text-lg font-semibold">
                {currency.symbol}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={weeklyBudget}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9]/g, "");
                  setWeeklyBudget(cleaned);
                }}
                placeholder="50"
                className="flex-1 bg-[#18223A] text-gray-100 px-4 py-3 rounded-xl border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 text-right placeholder:text-gray-500"
                maxLength={6}
              />
              <span className="text-gray-100 text-base">
                {currency.currency}
              </span>
            </div>
          </div>

          {/* Meal Plan Duration */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Meal Plan Duration
            </label>
            <div className="flex flex-wrap gap-2 mt-3">
              {weekDays.map((day) => (
                <button
                  key={day.code}
                  type="button"
                  onClick={() =>
                    setSelectedMealPlanDays((prev) =>
                      prev.includes(day.code)
                        ? prev.filter((d) => d !== day.code)
                        : [...prev, day.code]
                    )
                  }
                  className={`px-4 py-2 rounded-xl border-2 transition-all ${
                    selectedMealPlanDays.includes(day.code)
                      ? "bg-amber-500/20 border-amber-500 text-amber-500"
                      : "bg-[#18223A] border-gray-600 text-gray-300 hover:border-gray-500"
                  }`}
                >
                  <span className="font-semibold text-sm">{day.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Health Conditions */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Health Conditions
            </label>
            <p className="text-gray-400 text-sm mb-4">
              Select any health conditions that may affect your dietary needs
              (optional)
            </p>
            <div className="space-y-2">
              {healthConditionOptions.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => handleHealthConditionSelection(option.code)}
                  className="w-full flex items-center p-3 rounded-xl hover:bg-[#18223A] transition-colors"
                >
                  <div
                    className={`w-5 h-5 rounded border-2 mr-3 flex items-center justify-center flex-shrink-0 ${
                      selectedHealthConditions.includes(option.code)
                        ? "bg-amber-500 border-amber-500"
                        : "border-gray-500"
                    }`}
                  >
                    {selectedHealthConditions.includes(option.code) && (
                      <span className="text-white text-xs font-bold">✓</span>
                    )}
                  </div>
                  <span
                    className={`font-medium ${
                      selectedHealthConditions.includes(option.code)
                        ? "text-gray-100"
                        : "text-gray-400"
                    }`}
                  >
                    {option.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom health conditions */}
            {selectedHealthConditions.includes("other") && (
              <div className="mt-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={currentOtherCondition}
                    onChange={(e) => setCurrentOtherCondition(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomHealthCondition();
                      }
                    }}
                    placeholder="Specify other condition"
                    className="flex-1 bg-[#18223A] text-gray-100 px-4 py-3 rounded-xl border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={addCustomHealthCondition}
                    disabled={!currentOtherCondition.trim()}
                    className={`px-4 py-3 rounded-xl font-semibold ${
                      currentOtherCondition.trim()
                        ? "bg-amber-500 text-black"
                        : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    +
                  </button>
                </div>
                {otherHealthConditions.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {otherHealthConditions.map((condition, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-[#18223A] px-4 py-3 rounded-xl border border-amber-500"
                      >
                        <span className="text-gray-100">{condition}</span>
                        <button
                          type="button"
                          onClick={() => removeCustomHealthCondition(condition)}
                          className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center font-bold ml-3"
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

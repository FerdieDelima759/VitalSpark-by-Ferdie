"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useOnboardingHeader } from "@/contexts/OnboardingHeaderContext";
import { useUserData } from "@/hooks/useUserData";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/hooks/useAuth";
import Loader from "@/components/Loader";

export default function WeightOnboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const { setHeader } = useOnboardingHeader();
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"kg" | "lbs">("kg");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { upsertUserProfile, fetchUserProfile } = useUserData();
  const [userProfile, setUserProfile] = useState<any>(null);
  const previousUnitRef = useRef<"kg" | "lbs">("kg");

  useEffect(() => {
    const loadProfile = async () => {
      if (user?.id) {
        const result = await fetchUserProfile(user.id);
        if (result.success && result.data) {
          setUserProfile(result.data);
          if (result.data.weight) setWeight(result.data.weight.toString());
          if (result.data.weight_unit) {
            const loadedUnit = result.data.weight_unit as "kg" | "lbs";
            setUnit(loadedUnit);
            previousUnitRef.current = loadedUnit;
          }
        }
      }
    };
    loadProfile();
  }, [user, fetchUserProfile]);

  // Auto-convert weight when unit changes
  useEffect(() => {
    if (weight && previousUnitRef.current !== unit && weight.trim() !== "") {
      const weightNum = parseFloat(weight);
      if (!isNaN(weightNum) && weightNum > 0) {
        let convertedWeight: number;
        if (previousUnitRef.current === "kg" && unit === "lbs") {
          // Convert kg to lbs
          convertedWeight = weightNum * 2.20462;
        } else if (previousUnitRef.current === "lbs" && unit === "kg") {
          // Convert lbs to kg
          convertedWeight = weightNum / 2.20462;
        } else {
          convertedWeight = weightNum;
        }
        setWeight(convertedWeight.toFixed(2));
        previousUnitRef.current = unit;
      }
    }
  }, [unit, weight]);

  const handleContinue = async () => {
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      setError("Please enter a valid weight");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data: currentUser } = await auth.getCurrentUser();
      if (!currentUser?.user) {
        setError("Please sign in again to continue onboarding.");
        return;
      }

      const result = await upsertUserProfile({
        user_id: currentUser.user.id,
        weight: weightNum,
        weight_unit: unit,
        plan_code: userProfile?.plan_code ?? "premium",
        current_step: Math.max(userProfile?.current_step || 6, 7),
        is_onboarding_complete: false,
      });

      if (!result.success) {
        setError("Failed to save weight. Please try again.");
        setBusy(false);
        return;
      }

      setHeader({ animation: "slide_from_right" });
      router.push("/onboarding/fitness");
    } catch (e: any) {
      setError(e?.message ?? "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setHeader({ animation: "slide_from_left" });
    router.push("/onboarding/height");
  };

  useEffect(() => {
    setHeader({
      currentStep: 6,
      totalSteps: 9,
      onBack,
      onNext: handleContinue,
      canGoBack: true,
      nextDisabled: busy || !weight || parseFloat(weight) <= 0,
      backIconColor: "#ffffff",
      nextIconColor: "#ffffff",
    });
  }, [setHeader, busy, weight]);

  return (
    <div className="flex min-h-dvh bg-[#101A2C] items-start justify-center px-4 sm:px-5 md:px-6 pt-20 sm:pt-24 pb-5 sm:pb-7">
      <div className="w-full max-w-2xl mx-auto relative">
        <div className="w-full max-w-2xl mx-auto">
          <div className="text-center -mt-12 mb-4 sm:mb-6">
            <h2 className="text-amber-500 text-lg sm:text-xl md:text-2xl font-bold mb-1 sm:mb-1.5">
              What's your weight?
            </h2>
            <p className="text-gray-300 text-xs sm:text-sm md:text-base">
              This helps us calculate your BMI and create personalized plans
            </p>
            {error && (
              <div className="mt-3 bg-red-500/20 border border-red-500 text-red-200 px-4 py-2.5 rounded-lg text-sm sm:text-base">
                {error}
              </div>
            )}
          </div>

          <div className="w-full max-w-md mx-auto space-y-4 sm:space-y-5">
            <div className="flex justify-center gap-3 sm:gap-4">
              <button
                onClick={() => {
                  previousUnitRef.current = unit;
                  setUnit("kg");
                }}
                className={`px-5 sm:px-6 py-2 rounded-lg font-semibold text-sm sm:text-base transition-all ${
                  unit === "kg"
                    ? "bg-teal-600 text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                Metric (kg)
              </button>
              <button
                onClick={() => {
                  previousUnitRef.current = unit;
                  setUnit("lbs");
                }}
                className={`px-5 sm:px-6 py-2 rounded-lg font-semibold text-sm sm:text-base transition-all ${
                  unit === "lbs"
                    ? "bg-teal-600 text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                Imperial (lbs)
              </button>
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">
                Weight ({unit})
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder={`Enter your weight in ${unit}`}
                className="w-full bg-gray-800 text-white text-sm sm:text-base py-3 sm:py-3.5 px-4 rounded-lg sm:rounded-xl border-2 border-gray-600 focus:border-amber-500 outline-none placeholder:text-gray-500"
              />
            </div>

            <div className="mt-12"></div>

            <button
              disabled={busy || !weight || parseFloat(weight) <= 0}
              onClick={handleContinue}
              className={`w-full py-3 sm:py-3.5 rounded-xl font-semibold text-sm sm:text-base transition-all ${
                weight && parseFloat(weight) > 0 && !busy
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
    </div>
  );
}

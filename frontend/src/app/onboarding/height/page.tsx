"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useOnboardingHeader } from "@/contexts/OnboardingHeaderContext";
import { useUserData } from "@/hooks/useUserData";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/hooks/useAuth";
import Loader from "@/components/Loader";

export default function HeightOnboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const { setHeader } = useOnboardingHeader();
  const [height, setHeight] = useState("");
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { upsertUserProfile, fetchUserProfile } = useUserData();
  const [userProfile, setUserProfile] = useState<any>(null);
  const previousUnitRef = useRef<"cm" | "in">("cm");

  useEffect(() => {
    const loadProfile = async () => {
      if (user?.id) {
        const result = await fetchUserProfile(user.id);
        if (result.success && result.data) {
          setUserProfile(result.data);
          if (result.data.height) setHeight(result.data.height.toString());
          if (result.data.height_unit) {
            const loadedUnit = result.data.height_unit as "cm" | "in";
            setUnit(loadedUnit);
            previousUnitRef.current = loadedUnit;
          }
        }
      }
    };
    loadProfile();
  }, [user, fetchUserProfile]);

  // Auto-convert height when unit changes
  useEffect(() => {
    if (height && previousUnitRef.current !== unit && height.trim() !== "") {
      const heightNum = parseFloat(height);
      if (!isNaN(heightNum) && heightNum > 0) {
        let convertedHeight: number;
        if (previousUnitRef.current === "cm" && unit === "in") {
          // Convert cm to in
          convertedHeight = heightNum / 2.54;
        } else if (previousUnitRef.current === "in" && unit === "cm") {
          // Convert in to cm
          convertedHeight = heightNum * 2.54;
        } else {
          convertedHeight = heightNum;
        }
        setHeight(convertedHeight.toFixed(2));
        previousUnitRef.current = unit;
      }
    }
  }, [unit, height]);

  const handleContinue = async () => {
    const heightNum = parseFloat(height);
    if (isNaN(heightNum) || heightNum <= 0) {
      setError("Please enter a valid height");
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
        height: heightNum,
        height_unit: unit,
        plan_code: userProfile?.plan_code ?? "premium",
        current_step: Math.max(userProfile?.current_step || 5, 6),
        is_onboarding_complete: false,
      });

      if (!result.success) {
        setError("Failed to save height. Please try again.");
        setBusy(false);
        return;
      }

      setHeader({ animation: "slide_from_right" });
      router.push("/onboarding/weight");
    } catch (e: any) {
      setError(e?.message ?? "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setHeader({ animation: "slide_from_left" });
    router.push("/onboarding/location");
  };

  useEffect(() => {
    setHeader({
      currentStep: 5,
      totalSteps: 9,
      onBack,
      onNext: handleContinue,
      canGoBack: true,
      nextDisabled: busy || !height || parseFloat(height) <= 0,
      backIconColor: "#ffffff",
      nextIconColor: "#ffffff",
    });
  }, [setHeader, busy, height]);

  return (
    <div className="min-h-screen bg-[#101A2C] flex items-center justify-center py-12">
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-8">
          <h2 className="text-amber-500 text-2xl sm:text-3xl font-bold mb-2">
            What's your height?
          </h2>
          <p className="text-gray-300 text-base sm:text-lg">
            This helps us personalize your fitness plan
          </p>
          {error && (
            <div className="mt-4 bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="flex justify-center gap-4 mb-6">
            <button
              onClick={() => {
                previousUnitRef.current = unit;
                setUnit("cm");
              }}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                unit === "cm"
                  ? "bg-teal-600 text-white"
                  : "bg-gray-700 text-gray-300"
              }`}
            >
              Metric (cm)
            </button>
            <button
              onClick={() => {
                previousUnitRef.current = unit;
                setUnit("in");
              }}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                unit === "in"
                  ? "bg-teal-600 text-white"
                  : "bg-gray-700 text-gray-300"
              }`}
            >
              Imperial (in)
            </button>
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Height ({unit})
            </label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder={`Enter your height in ${unit}`}
              className="w-full bg-gray-800 text-white py-4 px-4 rounded-xl border-2 border-gray-600 focus:border-amber-500 outline-none placeholder:text-gray-500"
            />
          </div>

          <button
            disabled={busy || !height || parseFloat(height) <= 0}
            onClick={handleContinue}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              height && parseFloat(height) > 0 && !busy
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


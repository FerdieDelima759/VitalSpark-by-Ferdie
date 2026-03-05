"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOnboardingHeader } from "@/contexts/OnboardingHeaderContext";
import { useUserData } from "@/hooks/useUserData";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/hooks/useAuth";
import Loader from "@/components/Loader";

interface TargetMuscleOption {
  code: string;
  label: string;
}

const targetMuscleOptions: TargetMuscleOption[] = [
  { code: "fullBody", label: "Full Body" },
  { code: "chest", label: "Chest" },
  { code: "glutes", label: "Glutes" },
  { code: "upperBody", label: "Upper Body" },
  { code: "core", label: "Core" },
  { code: "legs", label: "Legs" },
  { code: "back", label: "Back" },
  { code: "shoulders", label: "Shoulders" },
  { code: "lowerBody", label: "Lower Body" },
  { code: "arms", label: "Arms" },
];

export default function TargetMuscleGroupOnboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const { setHeader } = useOnboardingHeader();
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { upsertUserProfile, fetchUserProfile } = useUserData();
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (user?.id) {
        const result = await fetchUserProfile(user.id);
        if (result.success && result.data) {
          setUserProfile(result.data);
          if (result.data.target_muscle_groups) {
            setSelectedMuscles(result.data.target_muscle_groups);
          }
        }
      }
    };
    loadProfile();
  }, [user, fetchUserProfile]);

  const userGender = userProfile?.gender === "female" ? "female" : "male";

  const handleMuscleSelection = (muscleCode: string) => {
    setSelectedMuscles((prev) =>
      prev.includes(muscleCode)
        ? prev.filter((m) => m !== muscleCode)
        : [...prev, muscleCode],
    );
  };

  const getImageSource = () => {
    if (selectedMuscles.length === 0) {
      return `/images/Muscular/${userGender}/${userGender}_muscular_body_diagram.png`;
    }

    const last = selectedMuscles[selectedMuscles.length - 1];
    const imageMap: Record<string, string> = {
      core: `${userGender}_core_diagram.png`,
      chest: `${userGender}_chest_diagram.png`,
      upperBody: `${userGender}_upper_body_diagram.png`,
      shoulders: `${userGender}_shoulder_diagram.png`,
      arms: `${userGender}_arms_diagram.png`,
      back: `${userGender}_back_diagram.png`,
      legs: `${userGender}_leg_diagram.png`,
      glutes: `${userGender}_glutes_diagram.png`,
      lowerBody: `${userGender}_lower_body_diagram.png`,
      fullBody: `${userGender}_full_body_diagram.png`,
    };

    const imageName =
      imageMap[last] || `${userGender}_muscular_body_diagram.png`;
    return `/images/Muscular/${userGender}/${imageName}`;
  };

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

      const result = await upsertUserProfile({
        user_id: currentUser.user.id,
        target_muscle_groups: selectedMuscles,
        plan_code: userProfile?.plan_code ?? "premium",
        current_step: Math.max(userProfile?.current_step || 8, 9),
        is_onboarding_complete: false,
      });

      if (!result.success) {
        console.error("Failed to save target muscles:", result.error);
        setError("Failed to save your target muscles. Please try again.");
        setBusy(false);
        return;
      }

      setHeader({ animation: "slide_from_right" });
      router.push("/onboarding/dietary");
    } catch (e: any) {
      console.error("Target muscles save error:", e);
      setError(e?.message ?? "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setHeader({ animation: "slide_from_left" });
    router.push("/onboarding/fitness");
  };

  const onNext = () => {
    if (isValid) handleContinue();
  };

  const isValid = selectedMuscles.length > 0;

  useEffect(() => {
    setHeader({
      currentStep: 8,
      totalSteps: 9,
      onBack,
      onNext,
      canGoBack: true,
      nextDisabled: busy || !isValid,
      backIconColor: "#ffffff",
      nextIconColor: "#ffffff",
    });
  }, [setHeader, busy, isValid, selectedMuscles]);

  return (
    <div className="min-h-screen bg-[#101A2C] flex justify-center pt-12 pb-12">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-8">
          <h2 className="text-amber-500 text-2xl sm:text-3xl font-bold mb-2">
            Your Target Muscles
          </h2>
          <p className="text-gray-300 text-base sm:text-lg">
            Tell us about your target muscles
          </p>
          {error && (
            <div className="mt-4 bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Muscle Groups Selection */}
          <div className="flex-1">
            <label className="block text-white text-sm font-semibold mb-4">
              Target Muscles
            </label>
            <div className="flex flex-col gap-2">
              {targetMuscleOptions.map((muscle) => (
                <button
                  key={muscle.code}
                  type="button"
                  disabled={busy}
                  onClick={() => handleMuscleSelection(muscle.code)}
                  className={`flex items-center p-3 rounded-xl border-2 transition-all ${
                    selectedMuscles.includes(muscle.code)
                      ? "border-amber-500 bg-[#18223A]"
                      : "border-gray-600 bg-[#18223A] hover:border-gray-500"
                  } ${busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 mr-3 flex items-center justify-center flex-shrink-0 ${
                      selectedMuscles.includes(muscle.code)
                        ? "bg-amber-500 border-amber-500"
                        : "border-gray-600"
                    }`}
                  >
                    {selectedMuscles.includes(muscle.code) && (
                      <span className="text-white text-xs font-bold">✓</span>
                    )}
                  </div>
                  <span
                    className={`font-medium text-sm sm:text-base ${
                      selectedMuscles.includes(muscle.code)
                        ? "text-amber-500"
                        : "text-gray-300"
                    }`}
                  >
                    {muscle.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Image Display - Hidden on small screens, shown on desktop */}
          <div className="hidden lg:flex flex-1 items-center justify-center relative min-h-[500px]">
            <div className="relative w-full h-full max-h-[700px] flex items-center justify-center">
              <div className="relative w-full h-full">
                <img
                  src={getImageSource()}
                  alt="Muscle diagram"
                  className="object-contain w-full h-full"
                  style={{ maxHeight: "700px" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Image Display for Mobile/Tablet - Below the selection */}
        <div className="lg:hidden mt-8 flex justify-center">
          <div className="relative w-full max-w-sm h-[400px]">
            <img
              src={getImageSource()}
              alt="Muscle diagram"
              className="object-contain w-full h-full"
            />
          </div>
        </div>

        <div className="mt-8">
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

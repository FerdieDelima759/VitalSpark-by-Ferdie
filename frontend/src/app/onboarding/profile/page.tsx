"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOnboardingHeader } from "@/contexts/OnboardingHeaderContext";
import { generateOnboardingAffirmations } from "@/lib/huggingface";
import { useUserData } from "@/hooks/useUserData";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/hooks/useAuth";
import Loader from "@/components/Loader";
import { HiUser, HiSparkles } from "react-icons/hi2";

interface GenderOption {
  code: string;
  label: string;
}

interface AgeRangeOption {
  code: string;
  label: string;
}

const genderOptions: GenderOption[] = [
  { code: "male", label: "Male" },
  { code: "female", label: "Female" },
  { code: "non_binary", label: "Non-binary" },
  { code: "prefer_not_to_say", label: "Prefer not to say" },
];

const ageRangeOptions: AgeRangeOption[] = [
  { code: "18", label: "Below 18" },
  { code: "18-25", label: "18-25" },
  { code: "26-35", label: "26-35" },
  { code: "36-45", label: "36-45" },
  { code: "46+", label: "46+" },
];

export default function ProfileOnboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const { setHeader } = useOnboardingHeader();
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [selectedAgeRange, setSelectedAgeRange] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affirmation, setAffirmation] = useState<string | null>(null);
  const [showAffirmation, setShowAffirmation] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isNicknameFocused, setIsNicknameFocused] = useState(false);
  const { upsertUserProfile, fetchUserProfile } = useUserData();
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (user?.id) {
        const result = await fetchUserProfile(user.id);
        if (result.success && result.data) {
          setUserProfile(result.data);
          if (result.data.full_name) setFullName(result.data.full_name);
          if (result.data.nickname) setNickname(result.data.nickname);
          if (result.data.age_range) setSelectedAgeRange(result.data.age_range);
          if (result.data.gender) setSelectedGender(result.data.gender);
        }
      }
    };
    loadProfile();
  }, [user, fetchUserProfile]);

  useEffect(() => {
    if (selectedGender && (fullName.trim() || nickname.trim())) {
      const userProfileData = {
        first_name: fullName.split(" ")[0],
        nickname: nickname,
        gender: selectedGender,
        preferred_language: userProfile?.preferred_language || "en",
      };
      const affirmations = generateOnboardingAffirmations(userProfileData);
      setAffirmation(affirmations[0]);
      setShowAffirmation(true);
    } else {
      setAffirmation(null);
      setShowAffirmation(false);
    }
  }, [fullName, nickname, selectedGender, userProfile?.preferred_language]);

  const handleContinue = async () => {
    if (!isValid) return;
    setBusy(true);
    setError(null);
    try {
      const { data: currentUser } = await auth.getCurrentUser();
      if (currentUser?.user) {
        const result = await upsertUserProfile({
          user_id: currentUser.user.id,
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
      router.push("/onboarding/location");
    } catch (e: any) {
      console.error("Profile save error:", e);
      setError(e?.message ?? "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setHeader({ animation: "slide_from_left" });
    router.push("/onboarding/mood");
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
    <div className="min-h-screen bg-[#101A2C] flex items-center justify-center py-12">
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-8">
          <h2 className="text-amber-500 text-2xl sm:text-3xl font-bold mb-2">
            Let's get to know you
          </h2>
          <p className="text-gray-300 text-base sm:text-lg">
            Tell us a bit about yourself
          </p>
          {error && (
            <div className="mt-4 bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              What's your full name?
            </label>
            <div
              className={`flex items-center bg-gray-800 rounded-xl px-4 border-2 transition-colors ${
                isNameFocused ? "border-amber-500" : "border-gray-600"
              }`}
            >
              <HiUser
                className={`text-xl mr-3 ${
                  isNameFocused ? "text-amber-500" : "text-gray-500"
                }`}
              />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                onFocus={() => setIsNameFocused(true)}
                onBlur={() => setIsNameFocused(false)}
                className="flex-1 bg-transparent text-white py-4 outline-none placeholder:text-gray-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              What should we call you?
            </label>
            <div
              className={`flex items-center bg-gray-800 rounded-xl px-4 border-2 transition-colors ${
                isNicknameFocused ? "border-amber-500" : "border-gray-600"
              }`}
            >
              <HiSparkles
                className={`text-xl mr-3 ${
                  isNicknameFocused ? "text-amber-500" : "text-gray-500"
                }`}
              />
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter your nickname"
                onFocus={() => setIsNicknameFocused(true)}
                onBlur={() => setIsNicknameFocused(false)}
                className="flex-1 bg-transparent text-white py-4 outline-none placeholder:text-gray-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              How old are you?
            </label>
            <div className="space-y-2">
              {ageRangeOptions.map((ageRange) => (
                <button
                  key={ageRange.code}
                  onClick={() => setSelectedAgeRange(ageRange.code)}
                  className={`w-full flex items-center p-4 rounded-xl border-2 transition-all ${
                    selectedAgeRange === ageRange.code
                      ? "bg-amber-500/20 border-amber-500"
                      : "bg-gray-800 border-gray-600 hover:border-gray-500"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                      selectedAgeRange === ageRange.code
                        ? "border-amber-500"
                        : "border-gray-500"
                    }`}
                  >
                    {selectedAgeRange === ageRange.code && (
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                    )}
                  </div>
                  <span
                    className={`font-medium ${
                      selectedAgeRange === ageRange.code
                        ? "text-amber-500"
                        : "text-gray-300"
                    }`}
                  >
                    {ageRange.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              What's your gender?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {genderOptions.map((gender) => (
                <button
                  key={gender.code}
                  disabled={busy}
                  onClick={() => setSelectedGender(gender.code)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedGender === gender.code
                      ? "bg-green-600 border-green-600"
                      : "bg-gray-800 border-gray-600 hover:border-gray-500"
                  } ${busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span
                    className={`font-semibold text-sm ${
                      selectedGender === gender.code ? "text-white" : "text-gray-300"
                    }`}
                  >
                    {gender.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {showAffirmation && affirmation && (
            <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl px-6 py-4 animate-fade-in">
              <p className="text-amber-200 text-base sm:text-lg font-medium text-center">
                ✨ {affirmation}
              </p>
            </div>
          )}

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


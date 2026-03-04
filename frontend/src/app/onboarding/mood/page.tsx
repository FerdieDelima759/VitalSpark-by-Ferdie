"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOnboardingHeader } from "@/contexts/OnboardingHeaderContext";
import { generateOnboardingAffirmations } from "@/lib/huggingface";
import { useUserData } from "@/hooks/useUserData";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/hooks/useAuth";
import Loader from "@/components/Loader";

interface MoodOption {
  code: string;
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
}

const moods: MoodOption[] = [
  {
    code: "happy",
    label: "Happy",
    emoji: "😊",
    color: "#059669",
    bgColor: "rgba(209, 250, 229, 0.8)",
  },
  {
    code: "calm",
    label: "Calm",
    emoji: "😌",
    color: "#0ea5e9",
    bgColor: "rgba(224, 242, 254, 0.8)",
  },
  {
    code: "energetic",
    label: "Energetic",
    emoji: "⚡",
    color: "#f59e0b",
    bgColor: "rgba(254, 243, 199, 0.8)",
  },
  {
    code: "anxious",
    label: "Anxious",
    emoji: "😰",
    color: "#8b5cf6",
    bgColor: "rgba(237, 233, 254, 0.8)",
  },
  {
    code: "tired",
    label: "Tired",
    emoji: "😴",
    color: "#64748b",
    bgColor: "rgba(248, 250, 252, 0.8)",
  },
];

export default function MoodOnboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const { setHeader } = useOnboardingHeader();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affirmation, setAffirmation] = useState<string | null>(null);
  const [showAffirmation, setShowAffirmation] = useState(false);
  const { upsertUserProfile, fetchUserProfile } = useUserData();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (user?.id) {
        setIsLoadingProfile(true);
        const result = await fetchUserProfile(user.id);
        if (result.success && result.data) {
          setUserProfile(result.data);
          if (result.data.current_mood) {
            setSelectedMood(result.data.current_mood);
          }
        }
        setIsLoadingProfile(false);
      } else {
        setIsLoadingProfile(false);
      }
    };
    loadProfile();
  }, [user, fetchUserProfile]);

  useEffect(() => {
    if (selectedMood && userProfile?.preferred_language) {
      const userProfileData = {
        preferred_language: userProfile.preferred_language,
        current_mood: selectedMood,
      };
      const affirmations = generateOnboardingAffirmations(userProfileData);
      setAffirmation(affirmations[0]);
      setShowAffirmation(true);
    } else {
      setAffirmation(null);
      setShowAffirmation(false);
    }
  }, [selectedMood, userProfile?.preferred_language]);

  const handleContinue = async () => {
    if (!selectedMood) return;
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
        current_mood: selectedMood,
        plan_code: userProfile?.plan_code ?? "premium",
        current_step: Math.max(userProfile?.current_step || 2, 3),
        is_onboarding_complete: false,
      });

      if (!result.success) {
        console.error("Failed to save mood:", result.error);
        setError("Failed to save your mood. Please try again.");
        setBusy(false);
        return;
      }

      setHeader({ animation: "slide_from_right" });
      router.push("/onboarding/profile");
    } catch (e: any) {
      console.error("Mood save error:", e);
      setError(e?.message ?? "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setHeader({ animation: "slide_from_left" });
    router.push("/onboarding/language");
  };

  const onNext = () => {
    if (selectedMood) {
      handleContinue();
    }
  };

  useEffect(() => {
    setHeader({
      currentStep: 2,
      totalSteps: 9,
      onBack,
      onNext,
      canGoBack: true,
      nextDisabled: busy || !selectedMood || isLoadingProfile,
      backIconColor: "#ffffff",
      nextIconColor: "#ffffff",
    });
  }, [setHeader, busy, selectedMood, isLoadingProfile]);

  return (
    <div className="min-h-screen bg-[#101A2C] flex items-center justify-center py-12">
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-8">
          <h2 className="text-amber-500 text-2xl sm:text-3xl font-bold mb-2">
            How are you feeling?
          </h2>
          <p className="text-gray-300 text-base sm:text-lg">
            Pick a mood that best describes you right now
          </p>
          {error && (
            <div className="mt-4 bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {isLoadingProfile ? (
          <div className="flex items-center justify-center py-12">
            <Loader size="lg" text="Loading..." textColor="slate" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {moods.slice(0, 3).map((mood) => (
                <button
                  key={mood.code}
                  disabled={busy}
                  onClick={() => setSelectedMood(mood.code)}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    selectedMood === mood.code
                      ? `border-[${mood.color}] bg-[${mood.bgColor}]`
                      : "border-gray-600 bg-gray-800 hover:border-gray-500"
                  } ${busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  style={{
                    borderColor: selectedMood === mood.code ? mood.color : undefined,
                    backgroundColor: selectedMood === mood.code ? mood.bgColor : undefined,
                    transform: selectedMood === mood.code ? "scale(1.05)" : undefined,
                  }}
                >
                  <div className="text-4xl mb-2">{mood.emoji}</div>
                  <div
                    className={`font-semibold text-sm ${
                      selectedMood === mood.code ? `text-[${mood.color}]` : "text-gray-300"
                    }`}
                    style={{
                      color: selectedMood === mood.code ? mood.color : undefined,
                    }}
                  >
                    {mood.label}
                  </div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {moods.slice(3, 5).map((mood) => (
                <button
                  key={mood.code}
                  disabled={busy}
                  onClick={() => setSelectedMood(mood.code)}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    selectedMood === mood.code
                      ? `border-[${mood.color}] bg-[${mood.bgColor}]`
                      : "border-gray-600 bg-gray-800 hover:border-gray-500"
                  } ${busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  style={{
                    borderColor: selectedMood === mood.code ? mood.color : undefined,
                    backgroundColor: selectedMood === mood.code ? mood.bgColor : undefined,
                    transform: selectedMood === mood.code ? "scale(1.05)" : undefined,
                  }}
                >
                  <div className="text-4xl mb-2">{mood.emoji}</div>
                  <div
                    className={`font-semibold text-sm ${
                      selectedMood === mood.code ? `text-[${mood.color}]` : "text-gray-300"
                    }`}
                    style={{
                      color: selectedMood === mood.code ? mood.color : undefined,
                    }}
                  >
                    {mood.label}
                  </div>
                </button>
              ))}
            </div>

            {showAffirmation && affirmation && (
              <div className="mb-8 bg-amber-500/20 border border-amber-500/50 rounded-xl px-6 py-4 animate-fade-in">
                <p className="text-amber-200 text-base sm:text-lg font-medium text-center">
                  ✨ {affirmation}
                </p>
              </div>
            )}

            <button
              disabled={busy || !selectedMood || isLoadingProfile}
              onClick={handleContinue}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                selectedMood && !busy && !isLoadingProfile
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
          </>
        )}
      </div>
    </div>
  );
}


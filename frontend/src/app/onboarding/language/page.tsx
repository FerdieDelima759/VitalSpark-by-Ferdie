"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOnboardingHeader } from "@/contexts/OnboardingHeaderContext";
import { generateOnboardingAffirmations } from "@/lib/huggingface";
import { useUserData } from "@/hooks/useUserData";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/hooks/useAuth";
import Loader from "@/components/Loader";
import Image from "next/image";

interface LanguageOption {
  code: string;
  label: string;
  nativeLabel?: string;
}

const languages: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English - US" },
  { code: "fil", label: "Filipino", nativeLabel: "Tagalog" },
  { code: "es", label: "Español", nativeLabel: "Spanish" },
];

export default function LanguageOnboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setHeader } = useOnboardingHeader();
  const [error, setError] = useState<string | null>(null);
  const [affirmation, setAffirmation] = useState<string | null>(null);
  const [showAffirmation, setShowAffirmation] = useState(false);
  const { upsertUserProfile, upsertUserRole, fetchUserProfile } = useUserData();
  const [userProfile, setUserProfile] = useState<any>(null);

  // Load existing language preference if available
  useEffect(() => {
    const loadProfile = async () => {
      if (user?.id) {
        const result = await fetchUserProfile(user.id);
        if (result.success && result.data) {
          setUserProfile(result.data);
          if (result.data.preferred_language) {
            setSelectedLanguage(result.data.preferred_language);
          }
        }
      }
    };
    loadProfile();
  }, [user, fetchUserProfile]);

  // Generate an affirmation when a language is selected
  useEffect(() => {
    if (selectedLanguage) {
      const userProfileData = { preferred_language: selectedLanguage };
      const affirmations = generateOnboardingAffirmations(userProfileData);
      setAffirmation(affirmations[0]);
      setShowAffirmation(true);
    } else {
      setAffirmation(null);
      setShowAffirmation(false);
    }
  }, [selectedLanguage]);

  const handleLanguageSelect = async (languageCode: string | null) => {
    setBusy(true);
    setError(null);
    try {
      // Save to user profile if user is authenticated
      const { data: currentUser } = await auth.getCurrentUser();
      if (currentUser?.user && languageCode) {
        // Save user profile
        const result = await upsertUserProfile({
          user_id: currentUser.user.id,
          preferred_language: languageCode,
          current_step: Math.max(userProfile?.current_step || 1, 2),
          is_onboarding_complete: false,
        });

        if (!result.success) {
          console.error("Failed to save language preference:", result.error);
        }

        // Save user role as member (no UI for this)
        const roleResult = await upsertUserRole({
          user_id: currentUser.user.id,
          role: "member",
        });

        if (!roleResult.success) {
          console.error("Failed to save user role:", roleResult.error);
        }
      }

      setHeader({ animation: "slide_from_right" });
      router.push("/onboarding/mood");
    } catch (e: any) {
      console.error("Language update error:", e);
      setError(e?.message ?? "An error occurred");
    } finally {
      setBusy(false);
    }
  };

  const onNext = () => {
    if (selectedLanguage) {
      handleLanguageSelect(selectedLanguage);
    }
  };

  useEffect(() => {
    setHeader({
      currentStep: 1,
      totalSteps: 9,
      onNext,
      canGoBack: false,
      nextDisabled: busy || !selectedLanguage,
      backIconColor: "#ffffff",
      nextIconColor: "#ffffff",
    });
  }, [setHeader, busy, selectedLanguage]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background Image */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/images/Onboarding_background.jpg"
          alt="Background"
          fill
          className="object-cover object-center"
          priority
          quality={90}
        />
      </div>

      {/* Dark Overlay */}
      <div className="fixed inset-0 z-10 bg-black/80" />

      {/* Content */}
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-4xl">
          <div className="flex flex-col justify-between min-h-[calc(100vh-200px)]">
            {/* Top Section - Welcome */}
            <div className="text-center mb-8 sm:mb-12">
              <h1 className="text-3xl sm:text-4xl font-bold mb-2 sm:mb-4">
                <span className="text-white">Welcome to </span>
                <span className="text-[#48bb78]">VitalSpark</span>
              </h1>
              <p className="text-[#e5e7eb] text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
                We're so glad you're here. VitalSpark is a space to care for your energy, comfort, and culture - through mindful coaching, comforting meals, and reflective journaling.
              </p>
            </div>

            {/* Middle Section - Language Selection */}
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-md mx-auto">
                {error && (
                  <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6 text-center">
                    {error}
                  </div>
                )}

                <div className="text-center mb-6 sm:mb-8">
                  <h2 className="text-[#f59e0b] text-xl sm:text-2xl font-semibold mb-2">
                    Choose Your Language
                  </h2>
                  <p className="text-white text-sm sm:text-base">
                    Select your preferred language for the best experience.
                  </p>
                </div>

                <div className="space-y-3 mb-6 sm:mb-8">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      disabled={busy}
                      onClick={() => {
                        setSelectedLanguage(lang.code);
                      }}
                      className={`w-full h-14 sm:h-16 px-4 sm:px-6 rounded-xl border-2 transition-all flex items-center justify-between ${
                        selectedLanguage === lang.code
                          ? "bg-[rgba(209,250,229,0.8)] border-[#059669] shadow-lg"
                          : "bg-[rgba(248,250,252,0.8)] border-[#e5e7eb] hover:border-gray-400"
                      } ${busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div className="text-left">
                        <div
                          className={`font-semibold text-base sm:text-lg ${
                            selectedLanguage === lang.code
                              ? "text-[#047857]"
                              : "text-[#0f172a]"
                          }`}
                        >
                          {lang.label}
                        </div>
                        {lang.nativeLabel && (
                          <div
                            className={`text-sm ${
                              selectedLanguage === lang.code
                                ? "text-[#059669]"
                                : "text-[#64748b]"
                            }`}
                          >
                            {lang.nativeLabel}
                          </div>
                        )}
                      </div>
                      {selectedLanguage === lang.code && (
                        <div className="w-6 h-6 bg-[#059669] rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">✓</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {showAffirmation && affirmation && (
                  <div className="mb-6 sm:mb-8 bg-[#f59e0b]/20 border border-[#f59e0b]/50 rounded-xl px-4 sm:px-6 py-3 sm:py-4 animate-fade-in">
                    <p className="text-[#f59e0b] text-sm sm:text-base font-medium text-center">
                      ✨ {affirmation}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section - Start Button */}
            <div className="w-full max-w-md mx-auto mt-6 sm:mt-8">
              <p className="text-white text-sm text-center mb-3 sm:mb-4 font-medium">
                Let's setup your profile
              </p>
              <button
                disabled={busy || !selectedLanguage}
                onClick={() =>
                  selectedLanguage && handleLanguageSelect(selectedLanguage)
                }
                className={`w-full py-4 sm:py-5 rounded-xl font-bold text-lg sm:text-xl transition-all ${
                  selectedLanguage && !busy
                    ? "bg-[#059669] hover:bg-[#047857] text-white shadow-lg hover:shadow-xl"
                    : "bg-[#9ca3af] text-gray-200 cursor-not-allowed"
                }`}
              >
                {busy ? (
                  <div className="flex items-center justify-center">
                    <Loader size="sm" inline />
                    <span className="ml-2">Loading...</span>
                  </div>
                ) : (
                  "Get Started"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


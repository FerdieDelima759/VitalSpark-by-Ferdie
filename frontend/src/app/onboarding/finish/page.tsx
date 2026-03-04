"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { generateOnboardingCompletionMessage } from "@/lib/huggingface";
import { useUserData } from "@/hooks/useUserData";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/hooks/useAuth";
import Loader from "@/components/Loader";

export default function FinishOnboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const { upsertUserProfile, fetchUserProfile } = useUserData();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [motivationalMessage, setMotivationalMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (user?.id) {
        const result = await fetchUserProfile(user.id);
        if (result.success && result.data) {
          setUserProfile(result.data);
          try {
            const message = generateOnboardingCompletionMessage(result.data);
            setMotivationalMessage(message);
          } catch {
            const name =
              result.data.nickname ||
              result.data.full_name?.split(" ")[0] ||
              "Friend";
            setMotivationalMessage(
              `${name}, you're all set! Let's achieve your fitness goals together!`
            );
          }
        }
      }
    };
    loadProfile();
  }, [user, fetchUserProfile]);

  const handleCreateProfile = async () => {
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
        is_onboarding_complete: true,
        plan_code: userProfile?.plan_code ?? "premium",
        current_step: 10,
      });

      if (!result.success) {
        console.error("Failed to complete onboarding:", result.error);
        setError("Failed to complete onboarding. Please try again.");
        setBusy(false);
        return;
      }

      router.replace("/");
    } catch (e: any) {
      console.error("Finish onboarding error:", e);
      setError(e?.message || "Failed to complete onboarding");
    } finally {
      setBusy(false);
    }
  };

  const displayName =
    userProfile?.nickname ||
    userProfile?.full_name?.split?.(" ")?.[0] ||
    "Friend";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b1220] via-[#0f1829] to-[#0a0f1a] flex items-center justify-center py-12">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center">
          <div className="mb-8">
            <div className="text-6xl mb-4 animate-pulse">✨</div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-amber-400 mb-4">
              Welcome, {displayName}!
            </h1>
            <p className="text-green-400 text-xl sm:text-2xl font-semibold mb-6">
              You're in good hands
            </p>
            <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto">
              We're here to support you on your fitness and nutrition journey
              with personalized plans and guidance.
            </p>
          </div>

          {motivationalMessage && (
            <div className="mb-8 bg-amber-500/20 border border-amber-500/50 rounded-xl px-6 py-4 max-w-2xl mx-auto">
              <p className="text-amber-200 text-lg sm:text-xl font-semibold text-center">
                {motivationalMessage}
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg max-w-2xl mx-auto">
              {error}
            </div>
          )}

          <div className="mb-8">
            <p className="text-gray-400 text-sm mb-4">
              Your journey to better health starts now
            </p>
            <button
              onClick={handleCreateProfile}
              disabled={busy}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? (
                <div className="flex items-center justify-center">
                  <Loader size="sm" inline />
                  <span className="ml-2">Creating your profile...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <span className="mr-2">❤️</span>
                  <span>It's good to go - Create my profile</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


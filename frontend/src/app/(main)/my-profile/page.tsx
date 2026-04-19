"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { UserProfile } from "@/types/UserProfile";
import Dialog from "@/components/Dialog";
import Toast, { ToastProps } from "@/components/Toast";
import Loader from "@/components/Loader";
import {
  HiUser,
  HiArrowRightOnRectangle,
  HiCog6Tooth,
  HiBell,
  HiMoon,
  HiLanguage,
  HiQuestionMarkCircle,
  HiChatBubbleLeftRight,
  HiStar,
  HiInformationCircle,
  HiDocumentText,
  HiShieldCheck,
  HiChevronRight,
} from "react-icons/hi2";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

export default function MyProfilePage() {
  const router = useRouter();
  const { user, signOut, isLoading: isAuthLoading } = useAuth();
  const { fetchUserProfile, updateUserProfile } = useUserData();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bmiModalOpen, setBmiModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);

  const resolveThemePreference = (): "light" | "dark" => {
    if (typeof window === "undefined") return "light";

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const applyThemePreference = (theme: "light" | "dark"): void => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  };

  const loadUserProfile = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const result = await fetchUserProfile(user.id);
      if (result.success && result.data) {
        setUserProfile(result.data);
        setSelectedLanguage(result.data.preferred_language || "en");
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserProfile, user?.id]);

  useEffect(() => {
    if (isAuthLoading) {
      setIsLoading(true);
      return;
    }

    if (!user?.id) {
      setIsLoading(false);
      setUserProfile(null);
      return;
    }

    void loadUserProfile();
  }, [isAuthLoading, loadUserProfile, user?.id]);

  useEffect(() => {
    const initialTheme = resolveThemePreference();
    applyThemePreference(initialTheme);
    setDarkModeEnabled(initialTheme === "dark");
  }, []);

  const handleDarkModeToggle = (enabled: boolean): void => {
    const nextTheme: "light" | "dark" = enabled ? "dark" : "light";
    setDarkModeEnabled(enabled);
    localStorage.setItem("theme", nextTheme);
    applyThemePreference(nextTheme);
  };

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

  const calculateBMI = (): string | null => {
    const height = userProfile?.height;
    const weight = userProfile?.weight;
    const heightUnit = userProfile?.height_unit;
    const weightUnit = userProfile?.weight_unit;

    if (!height || !weight) return null;

    // Convert height to meters
    let heightInMeters: number;
    if (heightUnit === "inches") {
      heightInMeters = height * 0.0254;
    } else if (heightUnit === "feet") {
      heightInMeters = height * 0.3048;
    } else {
      heightInMeters = height / 100; // cm to meters
    }

    // Convert weight to kg
    let weightInKg: number;
    if (weightUnit === "lbs" || weightUnit === "pounds") {
      weightInKg = weight * 0.453592;
    } else {
      weightInKg = weight;
    }

    return (weightInKg / (heightInMeters * heightInMeters)).toFixed(1);
  };

  const getBMIClassification = (bmi: string | null) => {
    if (!bmi) return null;

    const bmiValue = parseFloat(bmi);
    if (bmiValue < 18.5) {
      return {
        label: "Underweight",
        color: "#3b82f6",
        bgColor: "#dbeafe",
      };
    } else if (bmiValue >= 18.5 && bmiValue <= 24.9) {
      return {
        label: "Healthy Weight",
        color: "#10b981",
        bgColor: "#d1fae5",
      };
    } else if (bmiValue >= 25.0 && bmiValue <= 29.9) {
      return {
        label: "Overweight",
        color: "#f59e0b",
        bgColor: "#fef3c7",
      };
    } else {
      return {
        label: "Obesity",
        color: "#ef4444",
        bgColor: "#fee2e2",
      };
    }
  };

  const formatHeight = (): string => {
    const height = userProfile?.height;
    const heightUnit = userProfile?.height_unit;

    if (!height) return "N/A";

    if (heightUnit === "inches") {
      const feet = Math.floor(height / 12);
      const inches = Math.round(height % 12);
      return `${feet}'${inches}"`;
    } else if (heightUnit === "feet") {
      return `${height} ft`;
    } else {
      return `${height} cm`;
    }
  };

  const formatWeight = (): string => {
    const weight = userProfile?.weight;
    const weightUnit = userProfile?.weight_unit;

    if (!weight) return "N/A";

    const unit = weightUnit || "kg";
    return `${weight} ${unit}`;
  };

  const getPlanBadgeText = (): string => {
    const planCode = userProfile?.plan_code?.toLowerCase();
    if (planCode === "premium") return "Premium Member";
    if (planCode === "pro") return "Pro Member";
    return "VitalSpark Member";
  };

  const getPlanBadgeColors = (): { bg: string; text: string } => {
    const planCode = userProfile?.plan_code?.toLowerCase();
    if (planCode === "premium") return { bg: "#fef3c7", text: "#f59e0b" };
    if (planCode === "pro") return { bg: "#dbeafe", text: "#3b82f6" };
    return { bg: "#fef3c7", text: "#f59e0b" };
  };

  const getLanguageDisplay = (langCode: string | undefined): string => {
    if (!langCode) return "English";
    const languageMap: Record<string, string> = {
      en: "English",
      es: "Spanish",
      fil: "Filipino",
    };
    return languageMap[langCode] || "English";
  };

  const handleLanguageEdit = () => {
    const currentLang = userProfile?.preferred_language || "en";
    setSelectedLanguage(currentLang);
    setLanguageModalVisible(true);
  };

  const handleSaveLanguage = async () => {
    if (!user?.id || !selectedLanguage || savingLanguage) return;
    try {
      setSavingLanguage(true);
      const updateData = { preferred_language: selectedLanguage };
      const result = await updateUserProfile(user.id, updateData);

      if (!result.success) {
        showToast("error", "Error", "Failed to update language preference.");
      } else {
        setUserProfile((prev) =>
          prev ? { ...prev, preferred_language: selectedLanguage } : null
        );
        showToast("success", "Success", "Language preference saved.");
        setLanguageModalVisible(false);
      }
    } catch {
      showToast("error", "Error", "Failed to update language preference.");
    } finally {
      setSavingLanguage(false);
    }
  };

  const handleSignOut = () => {
    setConfirmOpen(true);
  };

  const confirmSignOut = async () => {
    if (busy) return;
    if (!user) return;

    try {
      setBusy(true);
      await signOut();
      router.push("/auth/login");
    } catch {
      showToast("error", "Error", "Failed to sign out. Please try again.");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827]">
        <Loader size="lg" text="Loading..." textColor="slate" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const bmiValue = calculateBMI();
  const bmiClassification = getBMIClassification(bmiValue);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827]">
      {/* Hero Band */}
      <div className="bg-gradient-to-br from-[#0d9488] via-[#0f766e] to-[#134e4a] rounded-b-[22px] px-6 pt-8 pb-32">
        <div className="max-w-4xl mx-auto">
          <p className="text-white/90 text-xs font-semibold tracking-[2px] uppercase mb-1">
            Account
          </p>
          <h1 className="text-4xl font-extrabold text-white mb-2">
            My Profile
          </h1>
          <p className="text-[#ccfbf1] text-sm">
            Manage your identity and preferences
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 -mt-24 pb-20">
        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-lg p-6 mb-6">
          {/* Profile Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#f59e0b] via-[#d97706] to-[#b45309] flex items-center justify-center">
              <HiUser className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Email and Member Badge */}
          <div className="text-center mb-6">
            <p className="text-base font-bold text-gray-900 dark:text-slate-100 mb-2">
              {user?.email || "User"}
            </p>
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: getPlanBadgeColors().bg,
                color: getPlanBadgeColors().text,
              }}
            >
              {getPlanBadgeText()}
            </span>
          </div>

          {/* Height, Weight, BMI - 3 Columns */}
          <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-200 dark:border-slate-700">
            <div className="flex-1 text-center">
              <p className="text-[11px] text-gray-500 dark:text-slate-400 uppercase tracking-[1px] mb-1">
                Height
              </p>
              <p className="text-base font-bold text-gray-900 dark:text-slate-100">
                {formatHeight()}
              </p>
            </div>
            <div className="w-px h-12 bg-gray-200 dark:bg-slate-700 mx-2" />
            <div className="flex-1 text-center">
              <p className="text-[11px] text-gray-500 dark:text-slate-400 uppercase tracking-[1px] mb-1">
                Weight
              </p>
              <p className="text-base font-bold text-gray-900 dark:text-slate-100">
                {formatWeight()}
              </p>
            </div>
            <div className="w-px h-12 bg-gray-200 dark:bg-slate-700 mx-2" />
            <div className="flex-1 text-center">
              <div className="flex items-center justify-center mb-1">
                <p className="text-[11px] text-gray-500 dark:text-slate-400 uppercase tracking-[1px]">
                  BMI
                </p>
                {bmiValue && (
                  <button
                    onClick={() => setBmiModalOpen(true)}
                    className="ml-1 w-4 h-4 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: bmiClassification?.bgColor || "#f3f4f6",
                    }}
                  >
                    <HiInformationCircle
                      className="w-3 h-3"
                      style={{
                        color: bmiClassification?.color || "#6b7280",
                      }}
                    />
                  </button>
                )}
              </div>
              <p className="text-base font-bold text-gray-900 dark:text-slate-100">
                {bmiValue || "N/A"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/manage-profile")}
              className="flex-1 bg-gradient-to-r from-[#f59e0b] to-[#d97706] hover:from-[#d97706] hover:to-[#b45309] text-white font-semibold rounded-2xl py-3 px-4 flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <HiCog6Tooth className="w-4 h-4" />
              <span className="text-sm">Manage Profile</span>
            </button>
            {user && (
              <button
                onClick={handleSignOut}
                className="min-w-[100px] bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#dc2626] hover:to-[#b91c1c] text-white font-semibold rounded-2xl py-3 px-4 flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <HiArrowRightOnRectangle className="w-4 h-4" />
                <span className="text-sm">Sign Out</span>
              </button>
            )}
          </div>
        </div>

        {/* Preferences Section */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm mb-6 overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-700 px-4 py-3">
            <p className="text-xs tracking-[2px] font-bold text-gray-500 dark:text-slate-400 uppercase">
              Preferences
            </p>
          </div>
          <div className="p-2">
            {/* Notifications Toggle */}
            <div className="flex items-center rounded-xl p-3 hover:bg-gray-50 dark:bg-slate-800/60 dark:hover:bg-slate-800/70 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-3 shrink-0">
                <HiBell className="w-5 h-5 text-[#0f766e]" />
              </div>
              <div className="flex-1 pr-3">
                <p className="text-[15px] font-semibold text-gray-900 dark:text-slate-100 mb-0.5">
                  Push Notifications
                </p>
                <p className="text-[13px] text-gray-500 dark:text-slate-400">
                  Receive workout reminders
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#0f766e] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:dark:bg-slate-100 after:border-gray-300 after:dark:border-slate-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#a7f3d0] dark:peer-checked:bg-emerald-500/70" />
              </label>
            </div>

            <div className="h-px bg-gray-200 dark:bg-slate-700 mx-3 my-0" />

            {/* Dark Mode Toggle */}
            <div className="flex items-center rounded-xl p-3 hover:bg-gray-50 dark:bg-slate-800/60 dark:hover:bg-slate-800/70 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-3 shrink-0">
                <HiMoon className="w-5 h-5 text-[#0f766e]" />
              </div>
              <div className="flex-1 pr-3">
                <p className="text-[15px] font-semibold text-gray-900 dark:text-slate-100 mb-0.5">
                  Dark Mode
                </p>
                <p className="text-[13px] text-gray-500 dark:text-slate-400">Use dark theme</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={darkModeEnabled}
                  onChange={(e) => handleDarkModeToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#0f766e] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:dark:bg-slate-100 after:border-gray-300 after:dark:border-slate-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#a7f3d0] dark:peer-checked:bg-emerald-500/70" />
              </label>
            </div>

            <div className="h-px bg-gray-200 dark:bg-slate-700 mx-3 my-0" />

            {/* Language Setting */}
            <button
              onClick={handleLanguageEdit}
              className="w-full flex items-center rounded-xl p-3 hover:bg-gray-50 dark:bg-slate-800/60 dark:hover:bg-slate-800/70 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-3 shrink-0">
                <HiLanguage className="w-5 h-5 text-[#0f766e]" />
              </div>
              <div className="flex-1 pr-3 text-left">
                <p className="text-[15px] font-semibold text-gray-900 dark:text-slate-100 mb-0.5">
                  Language
                </p>
                <p className="text-[13px] text-gray-500 dark:text-slate-400">
                  {getLanguageDisplay(userProfile?.preferred_language)}
                </p>
              </div>
              <HiChevronRight className="w-5 h-5 text-gray-400 dark:text-slate-500 shrink-0" />
            </button>
          </div>
        </div>

        {/* Support Section */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm mb-6 overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-700 px-4 py-3">
            <p className="text-xs tracking-[2px] font-bold text-gray-500 dark:text-slate-400 uppercase">
              Support
            </p>
          </div>
          <div className="p-2">
            <button
              onClick={() =>
                showToast("success", "Coming Soon", "Help Center is coming soon!")
              }
              className="w-full flex items-center rounded-xl p-3 hover:bg-gray-50 dark:bg-slate-800/60 dark:hover:bg-slate-800/70 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-3 shrink-0">
                <HiQuestionMarkCircle className="w-5 h-5 text-[#0f766e]" />
              </div>
              <div className="flex-1 pr-3 text-left">
                <p className="text-[15px] font-semibold text-gray-900 dark:text-slate-100 mb-0.5">
                  Help Center
                </p>
                <p className="text-[13px] text-gray-500 dark:text-slate-400">
                  Get answers to your questions
                </p>
              </div>
              <HiChevronRight className="w-5 h-5 text-gray-400 dark:text-slate-500 shrink-0" />
            </button>

            <div className="h-px bg-gray-200 dark:bg-slate-700 mx-3 my-0" />

            <button
              onClick={() =>
                showToast(
                  "success",
                  "Coming Soon",
                  "Contact Support is coming soon!"
                )
              }
              className="w-full flex items-center rounded-xl p-3 hover:bg-gray-50 dark:bg-slate-800/60 dark:hover:bg-slate-800/70 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-3 shrink-0">
                <HiChatBubbleLeftRight className="w-5 h-5 text-[#0f766e]" />
              </div>
              <div className="flex-1 pr-3 text-left">
                <p className="text-[15px] font-semibold text-gray-900 dark:text-slate-100 mb-0.5">
                  Contact Support
                </p>
                <p className="text-[13px] text-gray-500 dark:text-slate-400">
                  Get help from our team
                </p>
              </div>
              <HiChevronRight className="w-5 h-5 text-gray-400 dark:text-slate-500 shrink-0" />
            </button>

            <div className="h-px bg-gray-200 dark:bg-slate-700 mx-3 my-0" />

            <button
              onClick={() =>
                showToast("success", "Thank You", "We appreciate your feedback!")
              }
              className="w-full flex items-center rounded-xl p-3 hover:bg-gray-50 dark:bg-slate-800/60 dark:hover:bg-slate-800/70 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-3 shrink-0">
                <HiStar className="w-5 h-5 text-[#0f766e]" />
              </div>
              <div className="flex-1 pr-3 text-left">
                <p className="text-[15px] font-semibold text-gray-900 dark:text-slate-100 mb-0.5">
                  Rate VitalSpark
                </p>
                <p className="text-[13px] text-gray-500 dark:text-slate-400">
                  Share your feedback
                </p>
              </div>
              <HiChevronRight className="w-5 h-5 text-gray-400 dark:text-slate-500 shrink-0" />
            </button>
          </div>
        </div>

        {/* About Section */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm mb-6 overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-700 px-4 py-3">
            <p className="text-xs tracking-[2px] font-bold text-gray-500 dark:text-slate-400 uppercase">
              About
            </p>
          </div>
          <div className="p-2">
            <div className="flex items-center rounded-xl p-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-3 shrink-0">
                <HiInformationCircle className="w-5 h-5 text-[#0f766e]" />
              </div>
              <div className="flex-1 pr-3">
                <p className="text-[15px] font-semibold text-gray-900 dark:text-slate-100 mb-0.5">
                  App Version
                </p>
                <p className="text-[13px] text-gray-500 dark:text-slate-400">1.0.0</p>
              </div>
            </div>

            <div className="h-px bg-gray-200 dark:bg-slate-700 mx-3 my-0" />

            <button
              onClick={() =>
                showToast("success", "Coming Soon", "Terms of Service coming soon!")
              }
              className="w-full flex items-center rounded-xl p-3 hover:bg-gray-50 dark:bg-slate-800/60 dark:hover:bg-slate-800/70 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-3 shrink-0">
                <HiDocumentText className="w-5 h-5 text-[#0f766e]" />
              </div>
              <div className="flex-1 pr-3 text-left">
                <p className="text-[15px] font-semibold text-gray-900 dark:text-slate-100">
                  Terms of Service
                </p>
              </div>
              <HiChevronRight className="w-5 h-5 text-gray-400 dark:text-slate-500 shrink-0" />
            </button>

            <div className="h-px bg-gray-200 dark:bg-slate-700 mx-3 my-0" />

            <button
              onClick={() =>
                showToast("success", "Coming Soon", "Privacy Policy coming soon!")
              }
              className="w-full flex items-center rounded-xl p-3 hover:bg-gray-50 dark:bg-slate-800/60 dark:hover:bg-slate-800/70 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-3 shrink-0">
                <HiShieldCheck className="w-5 h-5 text-[#0f766e]" />
              </div>
              <div className="flex-1 pr-3 text-left">
                <p className="text-[15px] font-semibold text-gray-900 dark:text-slate-100">
                  Privacy Policy
                </p>
              </div>
              <HiChevronRight className="w-5 h-5 text-gray-400 dark:text-slate-500 shrink-0" />
            </button>
          </div>
        </div>
      </main>

      {/* BMI Information Dialog */}
      <Dialog
        visible={bmiModalOpen}
        onDismiss={() => setBmiModalOpen(false)}
        dismissible={true}
        maxWidth="clamp(26rem, 58vw, 56rem)"
        showCloseButton={false}
      >
        <div>
          {/* Header */}
          <div className="flex items-center pb-4 mb-4 border-b border-gray-200 dark:border-slate-700">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mr-3"
              style={{ backgroundColor: bmiClassification?.bgColor || "#f3f4f6" }}
            >
              <HiInformationCircle
                className="w-5 h-5"
                style={{ color: bmiClassification?.color || "#6b7280" }}
              />
            </div>
            <div className="flex-1">
              <h3 className="text-[clamp(1rem,1.2vw,1.5rem)] font-extrabold text-slate-900 dark:text-slate-100">
                BMI Result
              </h3>
              <p className="text-[clamp(0.75rem,0.8vw,1rem)] text-gray-600 dark:text-slate-300 mt-0.5">
                Body Mass Index
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* BMI Score + Classification */}
            <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-4 items-center text-center">
                <div>
                  <p className="text-[clamp(0.75rem,0.85vw,1rem)] text-gray-600 dark:text-slate-300 font-semibold mb-1">
                    BMI Score
                  </p>
                  <p
                    className="text-[clamp(2.25rem,4vw,3.75rem)] font-black mb-1"
                    style={{ color: bmiClassification?.color || "#6b7280" }}
                  >
                    {bmiValue}
                  </p>
                </div>
                <div>
                  <p className="text-[clamp(0.75rem,0.8vw,1rem)] text-gray-600 dark:text-slate-300 mb-2">
                    Classification
                  </p>
                  <div
                    className="inline-block px-4 py-2 rounded-full"
                    style={{
                      backgroundColor: bmiClassification?.bgColor || "#f3f4f6",
                    }}
                  >
                    <p
                      className="text-[clamp(0.75rem,0.85vw,1rem)] font-extrabold tracking-wide"
                      style={{ color: bmiClassification?.color || "#6b7280" }}
                    >
                      {bmiClassification?.label || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Health Recommendation */}
            <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 sm:p-6">
              <div className="flex items-center mb-2">
                <HiInformationCircle
                  className="w-5 h-5 mr-2"
                  style={{ color: bmiClassification?.color || "#6b7280" }}
                />
                <p className="text-[clamp(0.8rem,0.85vw,1rem)] font-bold text-slate-900 dark:text-slate-100">
                  Health Tip
                </p>
              </div>
              <p className="text-[clamp(0.65rem,0.72vw,0.82rem)] text-gray-600 dark:text-slate-300 whitespace-nowrap">
                BMI is a screening tool. Consult with a healthcare professional
                for personalized health advice.
              </p>
            </div>

            {/* BMI Ranges */}
            <div>
              <p className="text-[clamp(0.8rem,0.9vw,1rem)] font-extrabold text-slate-900 dark:text-slate-100 mb-3">
                BMI Ranges
              </p>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-[#3b82f6] mr-3" />
                  <span className="text-[clamp(0.75rem,0.85vw,1rem)] text-gray-600 dark:text-slate-300 flex-1">
                    Underweight
                  </span>
                  <span className="text-[clamp(0.75rem,0.85vw,1rem)] text-gray-600 dark:text-slate-300 font-semibold">
                    &lt; 18.5
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-[#10b981] mr-3" />
                  <span className="text-[clamp(0.75rem,0.85vw,1rem)] text-gray-600 dark:text-slate-300 flex-1">
                    Healthy Weight
                  </span>
                  <span className="text-[clamp(0.75rem,0.85vw,1rem)] text-gray-600 dark:text-slate-300 font-semibold">
                    18.5 - 24.9
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-[#f59e0b] mr-3" />
                  <span className="text-[clamp(0.75rem,0.85vw,1rem)] text-gray-600 dark:text-slate-300 flex-1">
                    Overweight
                  </span>
                  <span className="text-[clamp(0.75rem,0.85vw,1rem)] text-gray-600 dark:text-slate-300 font-semibold">
                    25.0 - 29.9
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-[#ef4444] mr-3" />
                  <span className="text-[clamp(0.75rem,0.85vw,1rem)] text-gray-600 dark:text-slate-300 flex-1">
                    Obesity
                  </span>
                  <span className="text-[clamp(0.75rem,0.85vw,1rem)] text-gray-600 dark:text-slate-300 font-semibold">
                    ≥ 30.0
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-4 mt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setBmiModalOpen(false)}
              className="px-5 sm:px-6 py-2.5 sm:py-3 bg-[#0f766e] hover:bg-[#0d6b63] text-white rounded-xl font-bold text-[clamp(0.75rem,0.85vw,1rem)] transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </Dialog>

      {/* Language Selection Dialog */}
      <Dialog
        visible={languageModalVisible}
        onDismiss={() => setLanguageModalVisible(false)}
        dismissible={!savingLanguage}
        maxWidth={400}
        showCloseButton={!savingLanguage}
      >
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-5 text-center">
            Select Language
          </h3>
          <div className="space-y-2 mb-5">
            {[
              { value: "en", label: "English" },
              { value: "es", label: "Spanish" },
              { value: "fil", label: "Filipino" },
            ].map((language) => (
              <button
                key={language.value}
                onClick={() => setSelectedLanguage(language.value)}
                className={`w-full flex items-center p-3 rounded-xl border-2 transition-all ${
                  selectedLanguage === language.value
                    ? "border-[#14b8a6] bg-[#f0fdfa] dark:bg-teal-950/40"
                    : "border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 hover:bg-gray-100 dark:hover:bg-slate-800"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                    selectedLanguage === language.value
                      ? "border-[#14b8a6]"
                      : "border-gray-300 dark:border-slate-600"
                  }`}
                >
                  {selectedLanguage === language.value && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#14b8a6]" />
                  )}
                </div>
                <span
                  className={`font-medium ${
                    selectedLanguage === language.value
                      ? "text-[#0f766e] dark:text-teal-300"
                      : "text-gray-700 dark:text-slate-200"
                  }`}
                >
                  {language.label}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setLanguageModalVisible(false)}
              disabled={savingLanguage}
              className="px-5 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveLanguage}
              disabled={savingLanguage}
              className="px-5 py-2.5 bg-gradient-to-r from-[#0f766e] to-[#14b8a6] hover:from-[#0d6b63] hover:to-[#0d9488] text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-70 flex items-center gap-2"
            >
              {savingLanguage ? (
                <>
                  <Loader size="sm" inline />
                  <span>Saving...</span>
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Sign Out Confirmation Dialog */}
      <Dialog
        visible={confirmOpen}
        onDismiss={!busy ? () => setConfirmOpen(false) : undefined}
        dismissible={!busy}
        maxWidth={400}
        showCloseButton={!busy}
      >
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Sign Out</h3>
          <p className="text-gray-600 dark:text-slate-300 mb-5">
            Are you sure you want to sign out? You&apos;ll need to sign in again to
            access your account.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
              className="px-5 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmSignOut}
              disabled={busy}
              className="px-5 py-2.5 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-70 flex items-center gap-2"
            >
              {busy ? (
                <>
                  <Loader size="sm" inline />
                  <span>Signing out...</span>
                </>
              ) : (
                "Sign Out"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Toast Notifications */}
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          onDismiss={() => dismissToast(toast.id)}
          index={index}
        />
      ))}
    </div>
  );
}


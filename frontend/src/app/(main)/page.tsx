"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Dialog from "@/components/Dialog";
import Loader from "@/components/Loader";
import {
  HiFire,
  HiArrowRightCircle,
  HiHeart,
  HiArrowsUpDown,
  HiBars3BottomLeft,
  HiCalculator,
  HiCheckCircle,
  HiInformationCircle,
  HiMoon,
  HiArrowRightOnRectangle,
} from "react-icons/hi2";

export default function Home() {
  const router = useRouter();
  const [currentStreak] = useState<number>(7);
  const [height, setHeight] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [bmiResult, setBmiResult] = useState<number | null>(null);
  const [bmiCategory, setBmiCategory] = useState<string>("");
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isMetric, setIsMetric] = useState<boolean>(true);
  const [bmiModalOpen, setBmiModalOpen] = useState<boolean>(false);
  const [heightFocused, setHeightFocused] = useState<boolean>(false);
  const [weightFocused, setWeightFocused] = useState<boolean>(false);

  const calculateBMI = (): void => {
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);

    if (
      isNaN(heightNum) ||
      isNaN(weightNum) ||
      heightNum <= 0 ||
      weightNum <= 0
    ) {
      return;
    }

    setIsCalculating(true);

    setTimeout(() => {
      let heightInMeters: number;
      let weightInKg: number;

      if (isMetric) {
        heightInMeters = heightNum / 100;
        weightInKg = weightNum;
      } else {
        heightInMeters = heightNum * 0.0254;
        weightInKg = weightNum * 0.453592;
      }

      const bmi = weightInKg / (heightInMeters * heightInMeters);
      const rounded = parseFloat(bmi.toFixed(1));
      setBmiResult(rounded);

      if (rounded < 18.5) setBmiCategory("Underweight");
      else if (rounded < 25) setBmiCategory("Normal weight");
      else if (rounded < 30) setBmiCategory("Overweight");
      else setBmiCategory("Obese");

      setIsCalculating(false);
      setBmiModalOpen(true);
    }, 300);
  };

  const getBMICategoryColor = (): string => {
    if (!bmiCategory) return "#6b7280";
    if (bmiCategory === "Underweight") return "#f59e0b";
    if (bmiCategory === "Normal weight") return "#10b981";
    if (bmiCategory === "Overweight") return "#f59e0b";
    return "#ef4444";
  };

  const getBMICategoryBackground = (): string => {
    if (!bmiCategory) return "#f3f4f6";
    if (bmiCategory === "Underweight") return "#fef3c7";
    if (bmiCategory === "Normal weight") return "#d1fae5";
    if (bmiCategory === "Overweight") return "#fef3c7";
    return "#fee2e2";
  };

  const getBMIHealthTip = (): string => {
    if (!bmiCategory) return "";
    if (bmiCategory === "Underweight")
      return "Consider consulting a nutritionist to reach a healthy weight.";
    if (bmiCategory === "Normal weight")
      return "Great! Maintain your healthy lifestyle.";
    if (bmiCategory === "Overweight")
      return "Consider a balanced diet and regular exercise.";
    return "Please consult a healthcare professional for guidance.";
  };

  const convertToMetric = (): void => {
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);
    if (!isNaN(heightNum) && heightNum > 0) {
      const heightInCm = heightNum * 2.54;
      setHeight(heightInCm.toFixed(1));
    }
    if (!isNaN(weightNum) && weightNum > 0) {
      const weightInKg = weightNum * 0.453592;
      setWeight(weightInKg.toFixed(1));
    }
    setIsMetric(true);
    setBmiResult(null);
    setBmiCategory("");
  };

  const convertToImperial = (): void => {
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);
    if (!isNaN(heightNum) && heightNum > 0) {
      const heightInInches = heightNum * 0.393701;
      setHeight(heightInInches.toFixed(1));
    }
    if (!isNaN(weightNum) && weightNum > 0) {
      const weightInLbs = weightNum * 2.20462;
      setWeight(weightInLbs.toFixed(1));
    }
    setIsMetric(false);
    setBmiResult(null);
    setBmiCategory("");
  };

  const canCalculate = (): boolean => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    return !isNaN(h) && !isNaN(w) && h > 0 && w > 0 && !isCalculating;
  };

  const handleCloseBmiModal = (): void => {
    setBmiModalOpen(false);
    setHeight("");
    setWeight("");
    setBmiResult(null);
    setBmiCategory("");
  };

  useEffect(() => {
    const root = document.documentElement;
    const savedTheme = localStorage.getItem("theme");
    const resolvedTheme =
      savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  }, []);

  const handleThemeToggle = (): void => {
    const root = document.documentElement;
    const nextTheme = root.classList.contains("dark") ? "light" : "dark";

    root.classList.remove("light", "dark");
    root.classList.add(nextTheme);
    localStorage.setItem("theme", nextTheme);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827]">
      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-5 py-4 sm:py-6">
        {/* App Header */}
        <div className="mb-4 -ml-1 -mt-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Image
                src="/images/Logo_VitalSpark.png"
                alt="VitalSpark"
                width={28}
                height={28}
                className="object-contain"
              />
              <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-300">
                VitalSpark by Ferdie
              </span>
            </div>
            <div className="flex items-center gap-2 -pr-16">
              <button
                type="button"
                onClick={handleThemeToggle}
                aria-label="Toggle theme"
                title="Toggle theme"
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white text-slate-600 shadow-sm hover:bg-slate-50 transition-colors dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <HiMoon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => router.replace("/auth/logout")}
                className="inline-flex items-center justify-center px-3 h-8 rounded-full bg-white text-slate-600 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <HiArrowRightOnRectangle className="w-4 h-4 mr-1" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Header */}
        <div className="mb-5 sm:mb-6">
          <div className="mb-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0f766e] dark:text-teal-300 mb-1">
              Dashboard
            </h2>
            <p className="text-sm sm:text-base text-[#737373] dark:text-slate-400">
              Track your progress and stay healthy
            </p>
          </div>
          <div className="h-1 bg-[#f59e0b] dark:bg-amber-400 rounded-full w-16 mt-1" />
        </div>

        {/* Streak Card */}
        <div className="mb-5 sm:mb-6">
          <div className="bg-gradient-to-b from-[#fbbf24] via-[#f59e0b] to-[#f97316] dark:from-amber-600 dark:via-orange-600 dark:to-rose-600 rounded-xl p-3.5 sm:p-5 shadow-lg dark:shadow-black/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <div className="bg-white/25 rounded-lg p-1.5 mr-2">
                  <HiFire className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-white text-[11px] sm:text-xs font-extrabold tracking-wide uppercase">
                  Current Streak
                </span>
              </div>
              <div className="flex items-end">
                <span className="text-2xl sm:text-3xl font-black text-white leading-none">
                  {currentStreak}
                </span>
                <span className="text-xs sm:text-sm text-white font-semibold ml-1">
                  days
                </span>
                <span className="text-xs sm:text-sm ml-1">{"\uD83D\uDD25"}</span>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-white text-xs sm:text-sm font-semibold">
                Weekly Goal: 5 sessions
              </span>
              <span className="text-white text-xs sm:text-sm font-bold">
                3 / 5 done
              </span>
            </div>

            <div className="h-1.5 bg-white/30 rounded-full mb-3 overflow-hidden">
              <div className="h-full w-3/5 bg-white rounded-full" />
            </div>

            <div className="flex items-center justify-between gap-3">
              <button className="bg-white/95 hover:bg-white dark:bg-slate-900/90 dark:hover:bg-slate-900 rounded-lg px-3.5 sm:px-5 py-2 sm:py-2.5 flex items-center gap-2 border border-white/80 dark:border-slate-700 shadow-md transition-colors">
                <HiArrowRightCircle className="w-3.5 h-3.5 text-[#f59e0b] dark:text-amber-300" />
                <span className="font-extrabold text-xs sm:text-sm text-[#f59e0b] dark:text-amber-300">
                  Keep it going
                </span>
              </button>
              <p className="text-white text-[11px] sm:text-xs opacity-90 flex-1 ml-2">
                Next session boosts your streak to {currentStreak + 1} days.
              </p>
            </div>
          </div>
        </div>

        {/* BMI Calculator Card */}
        <div className="bg-white dark:bg-slate-800/80 dark:border dark:border-slate-700 rounded-2xl shadow-lg p-4 sm:p-6 mb-5">
          <div className="flex items-center mb-5 sm:mb-6">
            <div className="bg-[#ccfbf1] dark:bg-teal-900/50 rounded-lg p-2 sm:p-2.5 mr-3">
              <HiHeart className="w-5 h-5 sm:w-6 sm:h-6 text-[#0f766e] dark:text-teal-300" />
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
              BMI Calculator
            </h3>
          </div>

          {/* Unit Toggle */}
          <div className="flex justify-center mb-5 sm:mb-6">
            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">
              <button
                onClick={convertToMetric}
                className={`px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-bold transition-colors ${
                  isMetric
                    ? "bg-[#0f766e] dark:bg-teal-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                Metric
              </button>
              <button
                onClick={convertToImperial}
                className={`px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-bold transition-colors border-l border-gray-200 dark:border-slate-700 ${
                  !isMetric
                    ? "bg-[#0f766e] dark:bg-teal-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                Imperial
              </button>
            </div>
          </div>

          {/* Input Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 mb-5">
            {/* Height Input */}
            <div>
              <div className="flex items-center mb-2">
                <HiArrowsUpDown className="w-4 h-4 text-gray-600 dark:text-slate-300 mr-2" />
                <label className="text-sm font-bold text-gray-700 dark:text-slate-200">
                  Height
                </label>
              </div>
              <div
                className={`flex items-center bg-gray-50 dark:bg-slate-900 rounded-xl border-2 px-3 transition-colors ${
                  height ? "border-[#0f766e] dark:border-teal-400" : "border-gray-200 dark:border-slate-700"
                }`}
              >
                <input
                  type="number"
                  placeholder="Enter height"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  onFocus={() => setHeightFocused(true)}
                  onBlur={() => setHeightFocused(false)}
                  className="flex-1 py-2.5 sm:py-3 text-sm text-slate-900 dark:text-slate-100 font-semibold bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <span className="text-sm text-gray-600 dark:text-slate-300 font-semibold ml-2">
                  {isMetric ? "cm" : "in"}
                </span>
              </div>
            </div>

            {/* Weight Input */}
            <div>
              <div className="flex items-center mb-2">
                <HiBars3BottomLeft className="w-4 h-4 text-gray-600 dark:text-slate-300 mr-2" />
                <label className="text-sm font-bold text-gray-700 dark:text-slate-200">
                  Weight
                </label>
              </div>
              <div
                className={`flex items-center bg-gray-50 dark:bg-slate-900 rounded-xl border-2 px-3 transition-colors ${
                  weight ? "border-[#0f766e] dark:border-teal-400" : "border-gray-200 dark:border-slate-700"
                }`}
              >
                <input
                  type="number"
                  placeholder="Enter weight"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  onFocus={() => setWeightFocused(true)}
                  onBlur={() => setWeightFocused(false)}
                  className="flex-1 py-2.5 sm:py-3 text-sm text-slate-900 dark:text-slate-100 font-semibold bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <span className="text-sm text-gray-600 dark:text-slate-300 font-semibold ml-2">
                  {isMetric ? "kg" : "lbs"}
                </span>
              </div>
            </div>
          </div>

          {/* Calculate Button */}
          <button
            onClick={calculateBMI}
            disabled={!canCalculate()}
            className={`w-full rounded-xl py-3 sm:py-4 flex items-center justify-center gap-2 font-extrabold text-sm sm:text-base transition-all ${
              canCalculate()
                ? "bg-[#0f766e] hover:bg-[#0d6b63] dark:bg-teal-500 dark:hover:bg-teal-400 text-white shadow-lg hover:shadow-xl"
                : "bg-gray-300 text-gray-500 dark:bg-slate-700 dark:text-slate-400 cursor-not-allowed"
            }`}
          >
            {isCalculating ? (
              <>
                <Loader size="sm" inline />
                <span>Calculating...</span>
              </>
            ) : (
              <>
                <HiCalculator className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Calculate BMI</span>
              </>
            )}
          </button>
        </div>
      </main>

      {/* BMI Result Modal */}
      <Dialog
        visible={bmiModalOpen}
        onDismiss={handleCloseBmiModal}
        dismissible={true}
        maxWidth={500}
        showCloseButton={false}
      >
        <div className="text-slate-900 dark:text-slate-100">
          {/* Header */}
          <div className="flex items-center pb-3 mb-3 border-b border-gray-200 dark:border-slate-700">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mr-3"
              style={{ backgroundColor: getBMICategoryBackground() }}
            >
              <HiHeart
                className="w-4 h-4"
                style={{ color: getBMICategoryColor() }}
              />
            </div>
            <div className="flex-1">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
                Your BMI Result
              </h3>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-0.5">Body Mass Index</p>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-3.5 max-h-[60vh] overflow-y-auto">
            {/* BMI Score */}
            <div className="bg-gray-50 dark:bg-slate-900/70 rounded-xl p-5 text-center">
              <p
                className="text-4xl sm:text-5xl font-black mb-1"
                style={{ color: getBMICategoryColor() }}
              >
                {bmiResult}
              </p>
              <p className="text-sm text-gray-600 dark:text-slate-400 font-semibold">BMI Score</p>
            </div>

            {/* Classification */}
            <div className="bg-gray-50 dark:bg-slate-900/70 rounded-xl p-5 text-center">
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">Classification</p>
              <div
                className="inline-block px-3.5 py-1.5 rounded-full"
                style={{ backgroundColor: getBMICategoryBackground() }}
              >
                <p
                  className="text-sm font-extrabold tracking-wide"
                  style={{ color: getBMICategoryColor() }}
                >
                  {bmiCategory}
                </p>
              </div>
            </div>

            {/* Health Recommendation */}
            <div className="bg-gray-50 dark:bg-slate-900/70 rounded-xl p-4 sm:p-5">
              <div className="flex items-center mb-2">
                {bmiCategory === "Normal weight" ? (
                  <HiCheckCircle
                    className="w-4 h-4 mr-2"
                    style={{ color: getBMICategoryColor() }}
                  />
                ) : (
                  <HiInformationCircle
                    className="w-4 h-4 mr-2"
                    style={{ color: getBMICategoryColor() }}
                  />
                )}
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Health Recommendation
                </p>
              </div>
              <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
                {getBMIHealthTip()}
              </p>
            </div>

            {/* BMI Ranges */}
            <div>
              <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mb-3">
                BMI Ranges
              </p>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] mr-3" />
                  <span className="text-sm text-gray-600 dark:text-slate-300 flex-1">
                    Underweight
                  </span>
                  <span className="text-sm text-gray-600 dark:text-slate-300 font-semibold">
                    &lt; 18.5
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10b981] mr-3" />
                  <span className="text-sm text-gray-600 dark:text-slate-300 flex-1">
                    Normal weight
                  </span>
                  <span className="text-sm text-gray-600 dark:text-slate-300 font-semibold">
                    18.5 - 24.9
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] mr-3" />
                  <span className="text-sm text-gray-600 dark:text-slate-300 flex-1">
                    Overweight
                  </span>
                  <span className="text-sm text-gray-600 dark:text-slate-300 font-semibold">
                    25.0 - 29.9
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] mr-3" />
                  <span className="text-sm text-gray-600 dark:text-slate-300 flex-1">Obese</span>
                  <span className="text-sm text-gray-600 dark:text-slate-300 font-semibold">
                    {"\u2265"} 30.0
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-3 mt-3 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={handleCloseBmiModal}
              className="px-4 sm:px-5 py-2 sm:py-2.5 bg-blue-500 hover:bg-blue-600 dark:bg-teal-500 dark:hover:bg-teal-400 text-white rounded-lg font-bold text-sm transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

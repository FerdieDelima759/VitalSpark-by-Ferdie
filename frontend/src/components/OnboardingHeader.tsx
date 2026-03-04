"use client";

import { useOnboardingHeader } from "@/contexts/OnboardingHeaderContext";
import { HiArrowLeft, HiArrowRight } from "react-icons/hi2";

export interface OnboardingHeaderProps {
  title?: string;
  currentStep: number;
  totalSteps: number;
  canGoNext?: boolean;
  canGoBack?: boolean;
  onBack?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  nextIconColor?: string;
  backIconColor?: string;
}

export default function OnboardingHeader({
  currentStep,
  totalSteps,
  canGoNext = true,
  canGoBack = true,
  onBack,
  onNext,
  nextDisabled,
  nextIconColor = "#e5e7eb",
  backIconColor = "#e5e7eb",
}: OnboardingHeaderProps) {
  const backDisabled = !canGoBack || !onBack;
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="relative flex items-center justify-center px-6 py-6 bg-[#101A2C]/95 backdrop-blur-sm">
      <button
        onClick={onBack}
        disabled={backDisabled}
        className={`absolute left-6 w-10 h-10 flex items-center justify-center ${
          backDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <HiArrowLeft
          className="text-2xl"
          style={{ color: !backDisabled ? backIconColor : "rgba(229,231,235,0.4)" }}
        />
      </button>

      <div className="flex-1 max-w-md mx-auto">
        <div className="w-full bg-gray-700/80 rounded-full h-2">
          <div
            className="bg-teal-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-center text-xs text-gray-300 mt-1">
          Step {currentStep} of {totalSteps}
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!!nextDisabled || !canGoNext}
        className={`absolute right-6 w-10 h-10 flex items-center justify-center ${
          !!nextDisabled || !canGoNext
            ? "opacity-40 cursor-not-allowed"
            : "cursor-pointer"
        }`}
      >
        <HiArrowRight
          className="text-2xl"
          style={{
            color:
              !nextDisabled && canGoNext
                ? nextIconColor
                : "rgba(229,231,235,0.4)",
          }}
        />
      </button>
    </div>
  );
}


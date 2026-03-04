"use client";

import React, { useState } from "react";
import { Plan, PlanTier } from "../types/Plan";
import { formatPlanFeatures } from "../utils/planFeatures";
import { HiCheckCircle, HiArrowRight } from "react-icons/hi2";

interface PlanCardProps {
  plan: Plan;
  tier: PlanTier;
  isCurrentPlan?: boolean;
  isRecommended?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}

const COLORS = {
  teal800: "#115e59",
  teal700: "#0f766e",
  teal500: "#14b8a6",
  slate900: "#0f172a",
  slate700: "#334155",
  slate500: "#64748b",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  white: "#ffffff",
};

const getTierIcon = (tier: PlanTier) => {
  switch (tier) {
    case "free":
      return "🌱";
    case "pro":
      return "⚡";
    case "premium":
      return "⭐";
    default:
      return "🌱";
  }
};

export default function PlanCard({
  plan,
  tier,
  isCurrentPlan = false,
  isRecommended = false,
  onSelect,
  compact = false,
}: PlanCardProps): React.ReactElement {
  const [isHovered, setIsHovered] = useState(false);

  // Color scheme based on current plan status and hover state
  const colorScheme = isCurrentPlan
    ? {
        badgeGradient: "from-teal-800 to-teal-600",
        badgeTextColor: "text-white",
        border: "border-teal-600",
        bulletColor: "text-teal-700",
        buttonGradient: "from-teal-700 to-teal-500",
        buttonTextColor: "text-white",
        title: "text-slate-900",
        price: "text-slate-900",
        feature: "text-slate-700",
        shadow: "shadow-lg",
      }
    : {
        badgeGradient: "from-slate-200 to-slate-100",
        badgeTextColor: "text-slate-600",
        border: isHovered ? "border-teal-400" : "border-slate-200",
        bulletColor: isHovered ? "text-teal-700" : "text-slate-600",
        buttonGradient: "from-slate-200 to-slate-100",
        buttonTextColor: "text-slate-700",
        title: "text-slate-900",
        price: "text-slate-900",
        feature: "text-slate-600",
        shadow: isHovered ? "shadow-lg" : "shadow-sm",
      };

  const displayFeatures = formatPlanFeatures(plan.features as any);

  return (
    <div
      className={`w-full h-full flex flex-col ${compact ? "mb-2.5" : "mb-4"} ${
        !isCurrentPlan ? "cursor-pointer" : "cursor-default"
      }`}
      onMouseEnter={() => !isCurrentPlan && setIsHovered(true)}
      onMouseLeave={() => !isCurrentPlan && setIsHovered(false)}
    >
      <div
        className={`${isCurrentPlan ? "bg-white" : "bg-slate-50"} rounded-2xl ${
          compact ? "p-3 rounded-xl" : "p-6"
        } border-2 ${colorScheme.border} transition-all duration-300 ${
          colorScheme.shadow
        } flex flex-col flex-1`}
      >
        {/* Header */}
        <div
          className={`flex items-center gap-3.5 ${
            compact ? "gap-2.5 mb-2.5" : "mb-3.5"
          }`}
        >
          <div
            className={`w-11 h-11 ${
              compact ? "w-8 h-8" : ""
            } rounded-full bg-gradient-to-br ${
              colorScheme.badgeGradient
            } flex items-center justify-center ${
              colorScheme.badgeTextColor
            } text-xl ${compact ? "text-base" : ""} font-bold`}
          >
            {getTierIcon(tier)}
          </div>

          <div className="flex-1">
            <h3
              className={`font-extrabold ${colorScheme.title} ${
                compact ? "text-base" : "text-xl"
              } tracking-tight`}
            >
              {plan.name}
            </h3>
            {isCurrentPlan && (
              <div className="flex items-center gap-1.5 self-start mt-1.5 px-2 py-0.5 rounded-full bg-teal-500/10">
                <HiCheckCircle className="w-3 h-3 text-teal-700" />
                <span className="text-xs font-extrabold text-teal-700 uppercase tracking-wider">
                  Current plan
                </span>
              </div>
            )}
            {!isCurrentPlan && isRecommended && (
              <div className="flex items-center gap-1 self-start mt-1 px-2 py-0.5 rounded-full bg-teal-500/10">
                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">
                  Recommended
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Price */}
        <div className={`${compact ? "mb-2.5" : "mb-4"}`}>
          {plan.price_usd === 0 ? (
            <p
              className={`font-extrabold ${colorScheme.price} ${
                compact ? "text-base" : "text-xl"
              }`}
            >
              Free
            </p>
          ) : (
            <div className="flex items-end">
              <span
                className={`font-extrabold ${colorScheme.price} ${
                  compact ? "text-sm mb-0.5" : "text-xl mb-0.5"
                } mr-0.5`}
              >
                $
              </span>
              <span
                className={`font-extrabold ${colorScheme.price} ${
                  compact ? "text-2xl leading-7" : "text-4xl leading-10"
                }`}
              >
                {plan.price_usd.toFixed(2)}
              </span>
              <span
                className={`font-semibold text-slate-500 ${
                  compact ? "text-xs mb-1" : "text-sm mb-1.5"
                } ml-1.5`}
              >
                /month
              </span>
            </div>
          )}
        </div>

        {/* Features */}
        {displayFeatures.length > 0 && (
          <div
            className={`flex-1 overflow-y-auto dialog-scrollbar min-h-0 ${
              compact ? "gap-1.5 mb-2.5" : "gap-2 mb-3"
            }`}
          >
            {displayFeatures.map((feature: string, i: number) => (
              <div key={i} className="flex items-start gap-2 py-0.5">
                <span
                  className={`font-bold ${colorScheme.bulletColor} ${
                    compact ? "text-sm leading-4" : "text-base leading-5"
                  } mt-0.5 shrink-0`}
                >
                  •
                </span>
                <p
                  className={`flex-1 font-semibold ${colorScheme.feature} ${
                    compact ? "text-xs leading-4" : "text-sm leading-5"
                  }`}
                >
                  {feature}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Button */}
        {onSelect && (
          <button
            onClick={onSelect}
            disabled={isCurrentPlan}
            className={`w-full rounded-xl overflow-hidden flex-shrink-0 ${
              isCurrentPlan ? "opacity-100" : ""
            }`}
          >
            <div
              className={`bg-gradient-to-br ${
                colorScheme.buttonGradient
              } flex items-center justify-center gap-2 ${
                compact ? "py-3.5 px-4.5" : "py-3.5 px-4.5"
              }`}
            >
              <span
                className={`${colorScheme.buttonTextColor} font-extrabold ${
                  compact ? "text-sm" : "text-base"
                } tracking-wide`}
              >
                {isCurrentPlan
                  ? "Current Plan"
                  : tier === "free"
                  ? "Get Started"
                  : "Upgrade Now"}
              </span>
              {!isCurrentPlan && (
                <HiArrowRight
                  className={`w-4.5 h-4.5 ${colorScheme.buttonTextColor}`}
                />
              )}
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

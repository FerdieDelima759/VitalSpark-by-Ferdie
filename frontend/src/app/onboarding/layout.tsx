"use client";

import { usePathname } from "next/navigation";
import { OnboardingHeaderProvider } from "@/contexts/OnboardingHeaderContext";
import { useOnboardingHeader } from "@/contexts/OnboardingHeaderContext";
import OnboardingHeader from "@/components/OnboardingHeader";
import { useMemo } from "react";

function OnboardingLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { headerConfig } = useOnboardingHeader();

  // Determine current step from route
  const currentRoute = pathname.split("/").pop() || "";
  const routeStepMap: Record<string, number> = {
    language: 1,
    mood: 2,
    profile: 3,
    location: 4,
    height: 5,
    weight: 6,
    fitness: 7,
    "target-muscle-group": 8,
    dietary: 9,
    finish: 9,
  };

  const currentStep = useMemo(() => {
    if (headerConfig.currentStep) {
      return headerConfig.currentStep;
    }
    return routeStepMap[currentRoute] || 1;
  }, [headerConfig.currentStep, currentRoute]);

  const handleBack = () => {
    if (headerConfig.canGoBack === false) {
      return;
    }

    if (headerConfig.onBack) {
      headerConfig.onBack();
    } else {
      window.history.back();
    }
  };

  const showHeader = currentRoute !== "finish";

  return (
    <div className="min-h-screen overflow-x-hidden">
      {showHeader && (
        <div className="relative z-30">
          <OnboardingHeader
            currentStep={currentStep}
            totalSteps={headerConfig.totalSteps || 10}
            canGoNext={headerConfig.canGoNext}
            canGoBack={headerConfig.canGoBack}
            onBack={handleBack}
            onNext={headerConfig.onNext}
            nextDisabled={headerConfig.nextDisabled}
            nextIconColor={headerConfig.nextIconColor}
            backIconColor={headerConfig.backIconColor}
          />
        </div>
      )}
      {children}
    </div>
  );
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingHeaderProvider>
      <OnboardingLayoutContent>{children}</OnboardingLayoutContent>
    </OnboardingHeaderProvider>
  );
}


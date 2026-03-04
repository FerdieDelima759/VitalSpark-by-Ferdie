import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { OnboardingHeaderProps } from "../components/OnboardingHeader";

// ===========================
// Context Type Definition
// ===========================

type AnimationType = "slide_from_right" | "slide_from_left" | "fade" | "none";

interface HeaderConfig extends Partial<OnboardingHeaderProps> {
  animation?: AnimationType;
}

interface OnboardingHeaderContextType {
  headerConfig: HeaderConfig;
  setHeader: (config: HeaderConfig) => void;
  resetHeader: () => void;
}

// ===========================
// Context Creation
// ===========================

const OnboardingHeaderContext = createContext<
  OnboardingHeaderContextType | undefined
>(undefined);

// ===========================
// Provider Props
// ===========================

interface OnboardingHeaderProviderProps {
  children: ReactNode;
}

// ===========================
// Default Configuration
// ===========================

const defaultHeaderConfig: HeaderConfig = {
  currentStep: 1,
  totalSteps: 10,
  canGoNext: true,
  canGoBack: true,
  nextDisabled: false,
  nextIconColor: "#e5e7eb",
  backIconColor: "#e5e7eb",
  animation: "none",
};

// ===========================
// Provider Component
// ===========================

export function OnboardingHeaderProvider({
  children,
}: OnboardingHeaderProviderProps): React.ReactElement {
  const [headerConfig, setHeaderConfig] =
    useState<HeaderConfig>(defaultHeaderConfig);

  const setHeader = useCallback((config: HeaderConfig) => {
    setHeaderConfig((prev) => ({
      ...prev,
      ...config,
    }));
  }, []);

  const resetHeader = useCallback(() => {
    setHeaderConfig(defaultHeaderConfig);
  }, []);

  const contextValue: OnboardingHeaderContextType = {
    headerConfig,
    setHeader,
    resetHeader,
  };

  return (
    <OnboardingHeaderContext.Provider value={contextValue}>
      {children}
    </OnboardingHeaderContext.Provider>
  );
}

// ===========================
// Custom Hook
// ===========================

export function useOnboardingHeader(): OnboardingHeaderContextType {
  const context = useContext(OnboardingHeaderContext);
  if (context === undefined) {
    throw new Error(
      "useOnboardingHeader must be used within an OnboardingHeaderProvider"
    );
  }
  return context;
}

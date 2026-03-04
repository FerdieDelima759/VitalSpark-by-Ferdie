import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { Plan, PlansLoadingState, PlanTier } from "../types/Plan";
import { supabase } from "../utils/supabase";

// ===========================
// Context Type Definition
// ===========================

interface PlanDialogConfig {
  showAllPlans?: boolean;
  highlightTier?: PlanTier;
  onPlanSelect?: (planCode: string, tier: PlanTier) => void;
}

interface PlansContextType {
  plans: Plan[];
  loadingState: PlansLoadingState;
  freePlan: Plan | null;
  proPlan: Plan | null;
  premiumPlan: Plan | null;
  getPlanByCode: (code: string) => Plan | null;
  getPlanByTier: (tier: PlanTier) => Plan | null;
  refreshPlans: () => Promise<void>;
  showPlanDialog: (config?: PlanDialogConfig) => void;
  hidePlanDialog: () => void;
  isPlanDialogVisible: boolean;
  planDialogConfig: PlanDialogConfig;
}

// ===========================
// Context Creation
// ===========================

const PlansContext = createContext<PlansContextType | undefined>(undefined);

// ===========================
// Provider Props
// ===========================

interface PlansProviderProps {
  children: ReactNode;
}

// ===========================
// Provider Component
// ===========================

export function PlansProvider({
  children,
}: PlansProviderProps): React.ReactElement {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingState, setLoadingState] = useState<PlansLoadingState>({
    isLoading: true,
    isUpdating: false,
    error: null,
  });
  const [isPlanDialogVisible, setIsPlanDialogVisible] = useState(false);
  const [planDialogConfig, setPlanDialogConfig] = useState<PlanDialogConfig>(
    {}
  );

  const fetchPlans = async (): Promise<void> => {
    try {
      setLoadingState((prev) => ({ ...prev, isLoading: true, error: null }));

      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("price_usd", { ascending: true });

      if (error) {
        console.error("Error fetching plans:", error);
        setLoadingState({
          isLoading: false,
          isUpdating: false,
          error: error.message,
        });
        return;
      }

      setPlans(data || []);
      setLoadingState({
        isLoading: false,
        isUpdating: false,
        error: null,
      });
    } catch (error: any) {
      console.error("Unexpected error fetching plans:", error);
      setLoadingState({
        isLoading: false,
        isUpdating: false,
        error: error.message || "An unexpected error occurred",
      });
    }
  };

  const refreshPlans = async (): Promise<void> => {
    setLoadingState((prev) => ({ ...prev, isUpdating: true }));
    await fetchPlans();
  };

  const getPlanByCode = useCallback(
    (code: string): Plan | null => {
      return plans.find((plan) => plan.code === code) || null;
    },
    [plans]
  );

  const getPlanByTier = useCallback(
    (tier: PlanTier): Plan | null => {
      const tierCodeMap: Record<PlanTier, string> = {
        free: "free",
        pro: "pro",
        premium: "premium",
      };
      return getPlanByCode(tierCodeMap[tier]);
    },
    [getPlanByCode]
  );

  const freePlan = getPlanByTier("free");
  const proPlan = getPlanByTier("pro");
  const premiumPlan = getPlanByTier("premium");

  const showPlanDialog = useCallback((config: PlanDialogConfig = {}) => {
    setPlanDialogConfig(config);
    setIsPlanDialogVisible(true);
  }, []);

  const hidePlanDialog = useCallback(() => {
    setIsPlanDialogVisible(false);
    setPlanDialogConfig({});
  }, []);

  useEffect(() => {
    fetchPlans();
  }, []);

  const contextValue: PlansContextType = {
    plans,
    loadingState,
    freePlan,
    proPlan,
    premiumPlan,
    getPlanByCode,
    getPlanByTier,
    refreshPlans,
    showPlanDialog,
    hidePlanDialog,
    isPlanDialogVisible,
    planDialogConfig,
  };

  return (
    <PlansContext.Provider value={contextValue}>
      {children}
    </PlansContext.Provider>
  );
}

// ===========================
// Custom Hook
// ===========================

export function usePlansContext(): PlansContextType {
  const context = useContext(PlansContext);
  if (context === undefined) {
    throw new Error("usePlansContext must be used within a PlansProvider");
  }
  return context;
}

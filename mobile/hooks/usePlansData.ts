import { useState, useCallback } from "react";
import { supabase } from "../utils/supabase";
import { Plan, PlanTier } from "../types/Plan";
import { usePlansContext } from "../contexts/PlansContext";

// ===========================
// Hook Interface
// ===========================

interface UsePlansDataReturn {
    // Plan operations
    fetchAllPlans: () => Promise<{ success: boolean; data?: Plan[]; error?: string }>;
    fetchPlanByCode: (
        code: string
    ) => Promise<{ success: boolean; data?: Plan; error?: string }>;
    fetchActivePlans: () => Promise<{ success: boolean; data?: Plan[]; error?: string }>;

    // Comparison helpers
    comparePlans: (codes: string[]) => Plan[];
    getTierUpgrade: (currentTier: PlanTier) => Plan | null;

    // State
    isLoading: boolean;
    error: string | null;
}

// ===========================
// Custom Hook
// ===========================

export function usePlansData(): UsePlansDataReturn {
    const { plans, getPlanByCode, getPlanByTier, refreshPlans } =
        usePlansContext();
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // ===========================
    // Error Handler
    // ===========================

    const handleError = useCallback((error: any): string => {
        if (error?.message) {
            return error.message;
        }
        return "An unexpected error occurred. Please try again.";
    }, []);

    // ===========================
    // Plan Operations
    // ===========================

    const fetchAllPlans = useCallback(async (): Promise<{
        success: boolean;
        data?: Plan[];
        error?: string;
    }> => {
        try {
            setIsLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from("plans")
                .select("*")
                .order("price_usd", { ascending: true });

            if (fetchError) {
                const errorMsg = handleError(fetchError);
                setError(errorMsg);
                return {
                    success: false,
                    error: errorMsg,
                };
            }

            return {
                success: true,
                data: data as Plan[],
            };
        } catch (err: any) {
            const errorMsg = handleError(err);
            setError(errorMsg);
            return {
                success: false,
                error: errorMsg,
            };
        } finally {
            setIsLoading(false);
        }
    }, [handleError]);

    const fetchPlanByCode = useCallback(
        async (
            code: string
        ): Promise<{ success: boolean; data?: Plan; error?: string }> => {
            try {
                setIsLoading(true);
                setError(null);

                if (!code.trim()) {
                    return {
                        success: false,
                        error: "Plan code is required",
                    };
                }

                const { data, error: fetchError } = await supabase
                    .from("plans")
                    .select("*")
                    .eq("code", code)
                    .single();

                if (fetchError) {
                    const errorMsg = handleError(fetchError);
                    setError(errorMsg);
                    return {
                        success: false,
                        error: errorMsg,
                    };
                }

                return {
                    success: true,
                    data: data as Plan,
                };
            } catch (err: any) {
                const errorMsg = handleError(err);
                setError(errorMsg);
                return {
                    success: false,
                    error: errorMsg,
                };
            } finally {
                setIsLoading(false);
            }
        },
        [handleError]
    );

    const fetchActivePlans = useCallback(async (): Promise<{
        success: boolean;
        data?: Plan[];
        error?: string;
    }> => {
        try {
            setIsLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from("plans")
                .select("*")
                .eq("is_active", true)
                .order("price_usd", { ascending: true });

            if (fetchError) {
                const errorMsg = handleError(fetchError);
                setError(errorMsg);
                return {
                    success: false,
                    error: errorMsg,
                };
            }

            return {
                success: true,
                data: data as Plan[],
            };
        } catch (err: any) {
            const errorMsg = handleError(err);
            setError(errorMsg);
            return {
                success: false,
                error: errorMsg,
            };
        } finally {
            setIsLoading(false);
        }
    }, [handleError]);

    // ===========================
    // Comparison Helpers
    // ===========================

    const comparePlans = useCallback(
        (codes: string[]): Plan[] => {
            return codes
                .map((code) => getPlanByCode(code))
                .filter((plan): plan is Plan => plan !== null);
        },
        [getPlanByCode]
    );

    const getTierUpgrade = useCallback(
        (currentTier: PlanTier): Plan | null => {
            if (currentTier === "free") {
                return getPlanByTier("pro");
            }
            if (currentTier === "pro") {
                return getPlanByTier("premium");
            }
            return null; // Already at premium
        },
        [getPlanByTier]
    );

    // ===========================
    // Return Hook Interface
    // ===========================

    return {
        // Plan operations
        fetchAllPlans,
        fetchPlanByCode,
        fetchActivePlans,

        // Comparison helpers
        comparePlans,
        getTierUpgrade,

        // State
        isLoading,
        error,
    };
}


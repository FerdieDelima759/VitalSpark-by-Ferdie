"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminSupabase } from "@/hooks/useAdminSupabase";
import Image from "next/image";
import Loader from "@/components/Loader";
import Dialog from "@/components/Dialog";
import Toast, { ToastProps } from "@/components/Toast";
import { HiArrowLeft, HiPencil, HiTrash, HiPlus } from "react-icons/hi2";
import { Plan, PlanFormData } from "@/types/Plan";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

export default function SubscriptionsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const adminClient = useAdminSupabase();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<{
    visible: boolean;
    planCode: string | null;
    planName: string | null;
    planCodes: string[] | null;
  }>({ visible: false, planCode: null, planName: null, planCodes: null });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [formData, setFormData] = useState<PlanFormData>({
    code: "",
    name: "",
    price_usd: 0,
    features: {},
    stripe_price_id: null,
    is_active: true,
  });
  const hasCheckedAuth = useRef(false);

  useEffect(() => {
    // Only check and redirect after both loading states are complete
    if (!isLoading && !isLoadingRole) {
      // Mark that we've completed the initial check
      if (!hasCheckedAuth.current) {
        hasCheckedAuth.current = true;
      }

      // Only redirect if we've confirmed the user is not authenticated or not admin
      if (!isAuthenticated) {
        router.push("/auth/login");
      } else if (hasCheckedAuth.current && !isAdmin) {
        router.push("/");
      }
    }
  }, [isAuthenticated, isAdmin, isLoading, isLoadingRole, router]);

  useEffect(() => {
    const fetchPlans = async () => {
      if (!adminClient) {
        setIsLoadingPlans(false);
        return;
      }

      try {
        setIsLoadingPlans(true);
        setError(null);

        const { data, error: fetchError } = await adminClient
          .from("plans")
          .select("*")
          .order("created_at", { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        setPlans(data || []);
      } catch (err: any) {
        console.error("Error fetching plans:", err);
        setError(err.message || "Failed to fetch plans");
        showToast("error", "Error", err.message || "Failed to fetch plans");
      } finally {
        setIsLoadingPlans(false);
      }
    };

    if (adminClient && isAdmin) {
      fetchPlans();
    }
  }, [adminClient, isAdmin]);

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

  const handleCreateClick = () => {
    setFormData({
      code: "",
      name: "",
      price_usd: 0,
      features: {},
      stripe_price_id: null,
      is_active: true,
    });
    setFeaturesJson("{}");
    setFeaturesError(null);
    setEditingPlan(null);
    setShowCreateDialog(true);
  };

  const handleEditClick = (plan: Plan) => {
    setFormData({
      code: plan.code,
      name: plan.name,
      price_usd: plan.price_usd,
      features: plan.features,
      stripe_price_id: plan.stripe_price_id,
      is_active: plan.is_active,
    });
    setFeaturesJson(JSON.stringify(plan.features, null, 2));
    setFeaturesError(null);
    setEditingPlan(plan);
    setShowCreateDialog(true);
  };

  const handleDeleteClick = (planCode: string, planName: string) => {
    setShowDeleteDialog({ visible: true, planCode, planName, planCodes: null });
  };

  const handleDeleteSelectedClick = () => {
    if (selectedPlans.length === 0) return;
    const selectedNames = plans
      .filter((p) => selectedPlans.includes(p.code))
      .map((p) => p.name);
    setShowDeleteDialog({
      visible: true,
      planCode: null,
      planName: selectedNames.length === 1 ? selectedNames[0] : null,
      planCodes: selectedPlans,
    });
  };

  const togglePlanSelection = (planCode: string) => {
    setSelectedPlans((prev) =>
      prev.includes(planCode)
        ? prev.filter((code) => code !== planCode)
        : [...prev, planCode]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPlans.length === plans.length) {
      setSelectedPlans([]);
    } else {
      setSelectedPlans(plans.map((p) => p.code));
    }
  };

  const formatConstraintError = (err: any, entityName: string): string => {
    const errorMessage = err?.message || err?.details || err?.hint || "";

    // Check if it's a foreign key constraint error
    if (
      errorMessage.includes("foreign key") ||
      errorMessage.includes("violates foreign key") ||
      errorMessage.includes("constraint") ||
      err?.code === "23503" ||
      err?.code === "23505"
    ) {
      // Try to extract referenced table/entity from error message
      let referencedEntity = "";

      const tableMatch =
        errorMessage.match(/table\s+["']?(\w+)["']?/i) ||
        errorMessage.match(/from\s+["']?(\w+)["']?/i) ||
        errorMessage.match(/in\s+["']?(\w+)["']?/i);

      if (tableMatch && tableMatch[1]) {
        const tableName = tableMatch[1];
        referencedEntity = tableName
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l: string) => l.toUpperCase());
      } else {
        referencedEntity = "user subscriptions";
      }

      return `Delete not allowed at this time, ${entityName} is associated with a ${referencedEntity}`;
    }

    return errorMessage || `Failed to delete ${entityName}`;
  };

  const handleSavePlan = async () => {
    if (!adminClient) {
      return;
    }

    if (!formData.code.trim() || !formData.name.trim()) {
      showToast("error", "Validation Error", "Code and name are required");
      return;
    }

    // Validate code
    const validCodes = ["free", "pro", "premium"];
    if (!validCodes.includes(formData.code.toLowerCase())) {
      showToast(
        "error",
        "Validation Error",
        `Code must be one of: ${validCodes.join(", ")}`
      );
      return;
    }

    // Validate features JSON
    if (featuresError) {
      showToast("error", "Validation Error", "Features must be valid JSON");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const planData = {
        code: formData.code.toLowerCase(),
        name: formData.name,
        price_usd: formData.price_usd,
        features: formData.features,
        stripe_price_id: formData.stripe_price_id || null,
        is_active: formData.is_active,
      };

      if (editingPlan) {
        // Update existing plan
        const { error: updateError } = await adminClient
          .from("plans")
          .update(planData)
          .eq("code", editingPlan.code);

        if (updateError) {
          throw updateError;
        }

        showToast(
          "success",
          "Plan Updated",
          `Plan ${planData.name} has been updated successfully.`
        );
      } else {
        // Create new plan
        const { error: insertError } = await adminClient
          .from("plans")
          .insert(planData);

        if (insertError) {
          throw insertError;
        }

        showToast(
          "success",
          "Plan Created",
          `Plan ${planData.name} has been created successfully.`
        );
      }

      // Refresh plans list
      const { data, error: fetchError } = await adminClient
        .from("plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (!fetchError && data) {
        setPlans(data);
      }

      setShowCreateDialog(false);
      setEditingPlan(null);
    } catch (err: any) {
      console.error("Error saving plan:", err);
      const errorMessage = err.message || "Failed to save plan";
      setError(errorMessage);
      showToast("error", "Save Failed", errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!adminClient) {
      return;
    }

    const planCodesToDelete =
      showDeleteDialog.planCodes ||
      (showDeleteDialog.planCode ? [showDeleteDialog.planCode] : []);

    if (planCodesToDelete.length === 0) {
      return;
    }

    try {
      setIsDeleting(true);

      const { error: deleteError } = await adminClient
        .from("plans")
        .delete()
        .in("code", planCodesToDelete);

      if (deleteError) {
        throw deleteError;
      }

      const count = planCodesToDelete.length;
      showToast(
        "success",
        "Plan Deleted",
        `${count} plan${count > 1 ? "s" : ""} deleted successfully.`
      );

      // Clear selections
      setSelectedPlans([]);

      // Refresh plans list
      setPlans(plans.filter((p) => !planCodesToDelete.includes(p.code)));
      setShowDeleteDialog({
        visible: false,
        planCode: null,
        planName: null,
        planCodes: null,
      });
    } catch (err: any) {
      console.error("Error deleting plan:", err);
      const errorMessage = formatConstraintError(err, "subscription plan");
      setError(errorMessage);
      showToast("error", "Delete Failed", errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const [featuresJson, setFeaturesJson] = useState<string>("");
  const [featuresError, setFeaturesError] = useState<string | null>(null);

  const handleFeaturesChange = (value: string) => {
    setFeaturesJson(value);
    try {
      const parsed = JSON.parse(value);
      setFormData({ ...formData, features: parsed });
      setFeaturesError(null);
    } catch (err) {
      // Invalid JSON - show error but allow editing
      setFeaturesError("Invalid JSON format");
    }
  };

  if (!isAuthenticated || !isAdmin) {
    if (!isLoading && !isLoadingRole) {
      return null; // Will redirect
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading || isLoadingRole ? (
          <div className="flex min-h-[calc(100vh-140px)] items-center justify-center">
            <Loader
              size="lg"
              text="Loading..."
              color="green"
              textColor="slate"
            />
          </div>
        ) : (
          <>
            {/* Page heading */}
            <div className="mb-6 sm:mb-8">
              <div className="mb-2">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => router.push("/admin")}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                  >
                    <HiArrowLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleCreateClick}
                    className="px-4 py-2 bg-[#0f766e] hover:bg-[#0d6b63] text-white rounded-lg font-medium transition-all shadow-md flex items-center gap-2"
                  >
                    <HiPlus className="text-lg" />
                    Create New
                  </button>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
                  Subscription Plans
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  Manage subscription plans and pricing
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Role: Admin</span>
                </div>
              </div>
              <div className="h-1 bg-[#f59e0b] rounded-full w-16 mt-1" />
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            {/* Delete Selected Button */}
            {selectedPlans.length > 0 && (
              <div className="mb-4 flex items-center gap-3">
                <button
                  onClick={handleDeleteSelectedClick}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-md flex items-center gap-2"
                >
                  <HiTrash className="text-lg" />
                  Delete Selected ({selectedPlans.length})
                </button>
                <button
                  onClick={() => setSelectedPlans([])}
                  className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            )}

            {isLoadingPlans ? (
              <div className="flex justify-center items-center py-12">
                <Loader size="md" text="Loading plans..." />
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 w-12">
                          <input
                            type="checkbox"
                            checked={
                              plans.length > 0 &&
                              selectedPlans.length === plans.length
                            }
                            onChange={toggleSelectAll}
                            className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                          />
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                          Code
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                          Name
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                          Price (USD)
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                          Stripe Price ID
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                          Status
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                          Created At
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {plans.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-6 py-8 text-center text-slate-500"
                          >
                            No plans found
                          </td>
                        </tr>
                      ) : (
                        plans.map((plan) => (
                          <tr key={plan.code} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={selectedPlans.includes(plan.code)}
                                onChange={() => togglePlanSelection(plan.code)}
                                className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                              />
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-900">
                              <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-md font-medium">
                                {plan.code}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                              {plan.name}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              ${plan.price_usd.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {plan.stripe_price_id || (
                                <span className="text-slate-400 italic">
                                  Not set
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {plan.is_active ? (
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md font-medium">
                                  Active
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-md font-medium">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {plan.created_at
                                ? new Date(plan.created_at).toLocaleDateString()
                                : "N/A"}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => handleEditClick(plan)}
                                  className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors text-sm flex items-center gap-1"
                                >
                                  <HiPencil className="text-base" />
                                  Edit
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteClick(plan.code, plan.name)
                                  }
                                  className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors text-sm flex items-center gap-1"
                                >
                                  <HiTrash className="text-base" />
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Create/Edit Plan Dialog */}
      <Dialog
        visible={showCreateDialog}
        onDismiss={() => !isSaving && setShowCreateDialog(false)}
        dismissible={!isSaving}
        maxWidth={600}
      >
        <div className="p-6">
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            {editingPlan ? "Edit Plan" : "Create New Plan"}
          </h3>

          <div className="space-y-4">
            {/* Code */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Code <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                disabled={!!editingPlan || isSaving}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Select code</option>
                <option value="free">free</option>
                <option value="pro">pro</option>
                <option value="premium">premium</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Code cannot be changed after creation
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                disabled={isSaving}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                placeholder="Plan name"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Price (USD) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price_usd}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    price_usd: parseFloat(e.target.value) || 0,
                  })
                }
                disabled={isSaving}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                placeholder="0.00"
              />
            </div>

            {/* Stripe Price ID */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Stripe Price ID
              </label>
              <input
                type="text"
                value={formData.stripe_price_id || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    stripe_price_id: e.target.value || null,
                  })
                }
                disabled={isSaving}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                placeholder="price_xxxxx"
              />
            </div>

            {/* Features */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Features (JSON)
              </label>
              <textarea
                value={featuresJson}
                onChange={(e) => handleFeaturesChange(e.target.value)}
                disabled={isSaving}
                rows={6}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 disabled:bg-gray-100 font-mono text-sm ${
                  featuresError
                    ? "border-red-300 focus:ring-red-500"
                    : "border-slate-300 focus:ring-amber-500"
                }`}
                placeholder='{"feature1": "value1", "feature2": "value2"}'
              />
              {featuresError ? (
                <p className="text-xs text-red-600 mt-1">{featuresError}</p>
              ) : (
                <p className="text-xs text-slate-500 mt-1">
                  Enter features as valid JSON object
                </p>
              )}
            </div>

            {/* Is Active */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                disabled={isSaving}
                className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
              />
              <label
                htmlFor="is_active"
                className="ml-2 text-sm font-medium text-slate-700"
              >
                Active
              </label>
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <button
              onClick={() => setShowCreateDialog(false)}
              disabled={isSaving}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePlan}
              disabled={isSaving}
              className="px-6 py-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-80 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader size="sm" inline />
                  <span>Saving...</span>
                </>
              ) : editingPlan ? (
                "Update"
              ) : (
                "Create"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        visible={showDeleteDialog.visible}
        onDismiss={() =>
          !isDeleting &&
          setShowDeleteDialog({
            visible: false,
            planCode: null,
            planName: null,
            planCodes: null,
          })
        }
        dismissible={!isDeleting}
        maxWidth={400}
      >
        <div className="text-center">
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            Delete Plan
            {showDeleteDialog.planCodes && showDeleteDialog.planCodes.length > 1
              ? "s"
              : ""}
          </h3>
          <p className="text-slate-600 mb-6">
            {showDeleteDialog.planCodes &&
            showDeleteDialog.planCodes.length > 1 ? (
              <>
                Are you sure you want to delete{" "}
                {showDeleteDialog.planCodes.length} plans?
                <br />
                <span className="text-sm text-red-600 mt-2 block">
                  This action cannot be undone.
                </span>
              </>
            ) : (
              <>
                Are you sure you want to delete plan{" "}
                <span className="font-semibold text-slate-900">
                  {showDeleteDialog.planName}
                </span>
                ?
                <br />
                <span className="text-sm text-red-600 mt-2 block">
                  This action cannot be undone.
                </span>
              </>
            )}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() =>
                setShowDeleteDialog({
                  visible: false,
                  planCode: null,
                  planName: null,
                  planCodes: null,
                })
              }
              disabled={isDeleting}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              No
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-80 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader size="sm" inline />
                  <span>Deleting...</span>
                </>
              ) : (
                "Yes"
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

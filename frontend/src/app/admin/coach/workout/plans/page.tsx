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
import {
  HiArrowLeft,
  HiPencil,
  HiTrash,
  HiPlus,
  HiXMark,
} from "react-icons/hi2";
import {
  CoachWorkoutPlan,
  CoachWorkoutPlanWithTags,
} from "@/types/CoachWorkout";
import { WorkoutTag } from "@/types/Workout";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

interface CoachWorkoutPlanFormData {
  name: string;
  description: string | null;
  motivation: string | null;
  level: string;
  total_minutes: number | null;
  total_calories: number | null;
  image_path: string | null;
  image_alt: string | null;
  duration_days: number | null;
  number_of_weeks: number | null;
  tier_code: string | null;
  category: string | null;
  total_exercises: number | null;
}

export default function CoachWorkoutPlansPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const adminClient = useAdminSupabase();
  const [coachWorkoutPlans, setCoachWorkoutPlans] = useState<
    CoachWorkoutPlanWithTags[]
  >([]);
  const [workoutTags, setWorkoutTags] = useState<WorkoutTag[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [workoutPlanMealLinks, setWorkoutPlanMealLinks] = useState<Set<string>>(
    new Set()
  );
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const [editingPlan, setEditingPlan] = useState<CoachWorkoutPlan | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<{
    visible: boolean;
    planId: string | null;
    planName: string | null;
    planIds: string[] | null;
  }>({ visible: false, planId: null, planName: null, planIds: null });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [formData, setFormData] = useState<CoachWorkoutPlanFormData>({
    name: "",
    description: null,
    motivation: null,
    level: "beginner",
    total_minutes: null,
    total_calories: null,
    image_path: null,
    image_alt: null,
    duration_days: null,
    number_of_weeks: null,
    tier_code: null,
    category: null,
    total_exercises: null,
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState<boolean>(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [tagSearchTerm, setTagSearchTerm] = useState<string>("");
  const [showTierCodeDropdown, setShowTierCodeDropdown] =
    useState<boolean>(false);
  const tierCodeDropdownRef = useRef<HTMLDivElement>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] =
    useState<boolean>(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [showLevelDropdown, setShowLevelDropdown] = useState<boolean>(false);
  const levelDropdownRef = useRef<HTMLDivElement>(null);
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
    const fetchData = async () => {
      if (!adminClient) {
        setIsLoadingPlans(false);
        return;
      }

      try {
        setIsLoadingPlans(true);
        setError(null);

        // Fetch coach workout plans
        const { data: plansData, error: plansError } = await adminClient
          .from("coach_workout_plans")
          .select("*")
          .order("created_at", { ascending: false });

        if (plansError) {
          throw plansError;
        }

        // Fetch all tags
        const { data: tagsData, error: tagsError } = await adminClient
          .from("workout_tags")
          .select("*")
          .order("name", { ascending: true });

        if (tagsError) {
          console.error("Error fetching tags:", tagsError);
        }

        setWorkoutTags(tagsData || []);

        // Fetch meal plan links for all workout plans
        const { data: mealLinksData, error: mealLinksError } = await adminClient
          .from("coach_workout_meal_plan_link")
          .select("plan_id");

        if (mealLinksError) {
          console.error("Error fetching meal plan links:", mealLinksError);
        }

        // Create a set of workout plan IDs that have meal plan links
        const plansWithMealLinks = new Set<string>();
        if (mealLinksData) {
          mealLinksData.forEach((link) => {
            plansWithMealLinks.add(link.plan_id);
          });
        }
        setWorkoutPlanMealLinks(plansWithMealLinks);

        // Fetch tags for each plan
        if (plansData && plansData.length > 0) {
          const plansWithTags = await Promise.all(
            plansData.map(async (plan) => {
              const { data: planTagsData, error: planTagsError } =
                await adminClient
                  .from("coach_workout_plan_tags")
                  .select("tag_id")
                  .eq("plan_id", plan.id);

              if (planTagsError) {
                console.error("Error fetching plan tags:", planTagsError);
                return { ...plan, tags: [] };
              }

              const tagIds = planTagsData?.map((pt) => pt.tag_id) || [];
              const tags = (tagsData || []).filter((tag) =>
                tagIds.includes(tag.id)
              );

              return { ...plan, tags };
            })
          );

          setCoachWorkoutPlans(plansWithTags);
        } else {
          setCoachWorkoutPlans([]);
        }
      } catch (err: any) {
        console.error("Error fetching coach workout plans:", err);
        setError(err.message || "Failed to fetch coach workout plans");
        showToast(
          "error",
          "Error",
          err.message || "Failed to fetch coach workout plans"
        );
      } finally {
        setIsLoadingPlans(false);
      }
    };

    if (adminClient && isAdmin) {
      fetchData();
    }
  }, [adminClient, isAdmin]);

  // Click outside handler for tag dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(event.target as Node)
      ) {
        setShowTagDropdown(false);
        setTagSearchTerm("");
      }
    };

    if (showTagDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showTagDropdown]);

  // Click outside handler for tier code dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tierCodeDropdownRef.current &&
        !tierCodeDropdownRef.current.contains(event.target as Node)
      ) {
        setShowTierCodeDropdown(false);
      }
    };

    if (showTierCodeDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showTierCodeDropdown]);

  // Click outside handler for category dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCategoryDropdown(false);
      }
    };

    if (showCategoryDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showCategoryDropdown]);

  // Click outside handler for level dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        levelDropdownRef.current &&
        !levelDropdownRef.current.contains(event.target as Node)
      ) {
        setShowLevelDropdown(false);
      }
    };

    if (showLevelDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showLevelDropdown]);

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
      name: "",
      description: null,
      motivation: null,
      level: "beginner",
      total_minutes: null,
      total_calories: null,
      image_path: null,
      image_alt: null,
      duration_days: null,
      number_of_weeks: null,
      tier_code: null,
      category: null,
      total_exercises: null,
    });
    setSelectedTags([]);
    setEditingPlan(null);
    setShowCreateDialog(true);
  };

  const handleEditClick = (plan: CoachWorkoutPlanWithTags) => {
    setFormData({
      name: plan.name,
      description: plan.description,
      motivation: plan.motivation,
      level: plan.level,
      total_minutes: plan.total_minutes,
      total_calories: plan.total_calories,
      image_path: plan.image_path,
      image_alt: plan.image_alt,
      duration_days: plan.duration_days,
      number_of_weeks: plan.number_of_weeks,
      tier_code: plan.tier_code,
      category: plan.category,
      total_exercises: plan.total_exercises,
    });
    setSelectedTags(plan.tags?.map((tag) => tag.id) || []);
    setEditingPlan(plan);
    setShowCreateDialog(true);
  };

  const handleDeleteClick = (plan: CoachWorkoutPlan) => {
    setShowDeleteDialog({
      visible: true,
      planId: plan.id,
      planName: plan.name,
      planIds: null,
    });
  };

  const handleDeleteSelectedClick = () => {
    if (selectedPlans.length === 0) return;
    const selectedNames = coachWorkoutPlans
      .filter((p) => selectedPlans.includes(p.id))
      .map((p) => p.name);
    setShowDeleteDialog({
      visible: true,
      planId: null,
      planName: selectedNames.length === 1 ? selectedNames[0] : null,
      planIds: selectedPlans,
    });
  };

  const togglePlanSelection = (planId: string) => {
    setSelectedPlans((prev) =>
      prev.includes(planId)
        ? prev.filter((id) => id !== planId)
        : [...prev, planId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPlans.length === coachWorkoutPlans.length) {
      setSelectedPlans([]);
    } else {
      setSelectedPlans(coachWorkoutPlans.map((p) => p.id));
    }
  };

  const handleSave = async () => {
    if (!adminClient) {
      showToast("error", "Error", "Admin client not available");
      return;
    }

    if (!user?.id) {
      showToast("error", "Error", "User not authenticated");
      return;
    }

    if (!formData.name.trim()) {
      showToast("error", "Validation Error", "Name is required");
      return;
    }

    try {
      setIsSaving(true);

      let planId: string;

      if (editingPlan) {
        // Update existing plan
        const { data, error: updateError } = await adminClient
          .from("coach_workout_plans")
          .update({
            name: formData.name.trim(),
            description: formData.description?.trim() || null,
            motivation: formData.motivation?.trim() || null,
            level: formData.level,
            total_minutes: formData.total_minutes || null,
            total_calories: formData.total_calories || null,
            image_path: formData.image_path?.trim() || null,
            image_alt: formData.image_alt?.trim() || null,
            duration_days: formData.duration_days || null,
            number_of_weeks: formData.number_of_weeks || null,
            tier_code: formData.tier_code || null,
            category: formData.category || null,
            total_exercises: formData.total_exercises || null,
          })
          .eq("id", editingPlan.id)
          .select()
          .single();

        if (updateError) {
          console.error("Update error:", updateError);
          throw updateError;
        }

        if (!data) {
          throw new Error("No data returned from update operation");
        }

        planId = editingPlan.id;
      } else {
        // Create new plan
        const { data, error: insertError } = await adminClient
          .from("coach_workout_plans")
          .insert({
            created_by: user.id,
            name: formData.name.trim(),
            description: formData.description?.trim() || null,
            motivation: formData.motivation?.trim() || null,
            level: formData.level,
            total_minutes: formData.total_minutes || null,
            total_calories: formData.total_calories || null,
            image_path: formData.image_path?.trim() || null,
            image_alt: formData.image_alt?.trim() || null,
            duration_days: formData.duration_days || null,
            number_of_weeks: formData.number_of_weeks || null,
            tier_code: formData.tier_code || null,
            category: formData.category || null,
            total_exercises: formData.total_exercises || null,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Insert error:", insertError);
          throw insertError;
        }

        if (!data) {
          throw new Error("No data returned from insert operation");
        }

        if (!data.id) {
          throw new Error("Inserted plan missing ID");
        }

        planId = data.id;
      }

      // Handle tags
      let tagsError: any = null;
      if (planId) {
        // Delete existing tags for this plan
        await adminClient
          .from("coach_workout_plan_tags")
          .delete()
          .eq("plan_id", planId);

        // Insert new tags
        if (selectedTags.length > 0) {
          const tagInserts = selectedTags.map((tagId) => ({
            plan_id: planId,
            tag_id: tagId,
          }));

          const { error: tagsInsertError } = await adminClient
            .from("coach_workout_plan_tags")
            .insert(tagInserts);

          if (tagsInsertError) {
            console.error("Error saving tags:", tagsInsertError);
            tagsError = tagsInsertError;
          }
        }
      }

      // Refresh data
      const { data: plansData, error: plansError } = await adminClient
        .from("coach_workout_plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (!plansError && plansData) {
        const plansWithTags = await Promise.all(
          plansData.map(async (plan) => {
            const { data: planTagsData } = await adminClient
              .from("coach_workout_plan_tags")
              .select("tag_id")
              .eq("plan_id", plan.id);

            const tagIds = planTagsData?.map((pt) => pt.tag_id) || [];
            const tags = workoutTags.filter((tag) => tagIds.includes(tag.id));

            return { ...plan, tags };
          })
        );

        setCoachWorkoutPlans(plansWithTags);
      }

      // Store editing state before closing dialog
      const wasEditing = !!editingPlan;

      // Close dialog first
      setShowCreateDialog(false);
      setEditingPlan(null);
      setSelectedTags([]);

      // Show success toast after dialog closes fully
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (wasEditing) {
            showToast(
              "success",
              "Success",
              "Coach workout plan updated successfully"
            );
          } else {
            showToast(
              "success",
              "Success",
              "Coach workout plan created successfully"
            );
          }
          // Show warning toast for tags error if it occurred
          if (tagsError) {
            setTimeout(() => {
              showToast(
                "error",
                "Warning",
                "Plan saved but tags failed to update"
              );
            }, 100);
          }
        }, 500);
      });
    } catch (err: any) {
      console.error("Error saving coach workout plan:", err);
      const errorMessage =
        err?.message ||
        err?.details ||
        err?.hint ||
        "Failed to save coach workout plan";

      // Close dialog first if it's still open
      if (showCreateDialog) {
        setShowCreateDialog(false);
        setEditingPlan(null);
        setSelectedTags([]);

        // Show error toast after dialog closes fully
        requestAnimationFrame(() => {
          setTimeout(() => {
            showToast("error", "Error", errorMessage);
          }, 500);
        });
      } else {
        // Dialog already closed, show toast immediately
        showToast("error", "Error", errorMessage);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!adminClient) {
      return;
    }

    const planIdsToDelete =
      showDeleteDialog.planIds ||
      (showDeleteDialog.planId ? [showDeleteDialog.planId] : []);

    if (planIdsToDelete.length === 0) {
      return;
    }

    try {
      setIsDeleting(true);

      // Delete tags first for all selected plans
      for (const planId of planIdsToDelete) {
        await adminClient
          .from("coach_workout_plan_tags")
          .delete()
          .eq("plan_id", planId);
      }

      // Delete plans
      const { error: deleteError } = await adminClient
        .from("coach_workout_plans")
        .delete()
        .in("id", planIdsToDelete);

      if (deleteError) {
        throw deleteError;
      }

      const count = planIdsToDelete.length;
      showToast(
        "success",
        "Success",
        `${count} coach workout plan${
          count > 1 ? "s" : ""
        } deleted successfully`
      );

      // Clear selections
      setSelectedPlans([]);

      // Refresh data
      const { data: plansData, error: plansError } = await adminClient
        .from("coach_workout_plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (!plansError && plansData) {
        const plansWithTags = await Promise.all(
          plansData.map(async (plan) => {
            const { data: planTagsData } = await adminClient
              .from("coach_workout_plan_tags")
              .select("tag_id")
              .eq("plan_id", plan.id);

            const tagIds = planTagsData?.map((pt) => pt.tag_id) || [];
            const tags = workoutTags.filter((tag) => tagIds.includes(tag.id));

            return { ...plan, tags };
          })
        );

        setCoachWorkoutPlans(plansWithTags);
      }

      setShowDeleteDialog({
        visible: false,
        planId: null,
        planName: null,
        planIds: null,
      });
    } catch (err: any) {
      console.error("Error deleting coach workout plan:", err);
      const errorMessage = formatConstraintError(err, "coach workout plan");
      showToast("error", "Error", errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const removeTag = (tagId: string) => {
    setSelectedTags((prev) => prev.filter((id) => id !== tagId));
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

      // Try to extract table name from error message
      const tableMatch =
        errorMessage.match(/table\s+["']?(\w+)["']?/i) ||
        errorMessage.match(/from\s+["']?(\w+)["']?/i) ||
        errorMessage.match(/in\s+["']?(\w+)["']?/i);

      if (tableMatch && tableMatch[1]) {
        const tableName = tableMatch[1];
        // Convert table name to readable format
        referencedEntity = tableName
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l: string) => l.toUpperCase());
      } else {
        // Default based on entity being deleted
        if (
          entityName.toLowerCase().includes("workout") ||
          entityName.toLowerCase().includes("plan")
        ) {
          referencedEntity = "daily plans or exercises";
        } else if (entityName.toLowerCase().includes("exercise")) {
          referencedEntity = "coach workout plans";
        } else {
          referencedEntity = "other records";
        }
      }

      return `Delete not allowed at this time, ${entityName} is associated with a ${referencedEntity}`;
    }

    // Return original error message if not a constraint error
    return errorMessage || `Failed to delete ${entityName}`;
  };

  if (!isAuthenticated || !isAdmin) {
    if (!isLoading && !isLoadingRole) {
      return null;
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading || isLoadingRole || isLoadingPlans ? (
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
                    type="button"
                    onClick={() => router.push("/admin")}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                  >
                    <HiArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        router.push("/admin/coach/workout/plans/exercises")
                      }
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all shadow-md flex items-center gap-2"
                    >
                      View all exercises
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateClick}
                      className="px-4 py-2 bg-[#0f766e] hover:bg-[#0d6b63] text-white rounded-lg font-medium transition-all shadow-md flex items-center gap-2"
                    >
                      <HiPlus className="text-lg" />
                      Create New
                    </button>
                  </div>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
                  Coach Workout Plans
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  Manage coach workout plans and exercises
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Role: Admin</span>
                </div>
              </div>
              <div className="h-1 bg-[#f59e0b] rounded-full w-16 mt-1" />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            {/* Delete Selected Button */}
            {selectedPlans.length > 0 && (
              <div className="mb-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDeleteSelectedClick}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-md flex items-center gap-2"
                >
                  <HiTrash className="text-lg" />
                  Delete Selected ({selectedPlans.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlans([])}
                  className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            )}

            {/* Coach Workout Plans Table */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider w-12">
                        <input
                          type="checkbox"
                          checked={
                            coachWorkoutPlans.length > 0 &&
                            selectedPlans.length === coachWorkoutPlans.length
                          }
                          onChange={toggleSelectAll}
                          className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Level
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Tags
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Daily Plan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Meal Plans
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {coachWorkoutPlans.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-6 py-12 text-center text-slate-500"
                        >
                          No coach workout plans found. Create your first one!
                        </td>
                      </tr>
                    ) : (
                      coachWorkoutPlans.map((plan) => (
                        <tr key={plan.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedPlans.includes(plan.id)}
                              onChange={() => togglePlanSelection(plan.id)}
                              className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-slate-900">
                              {plan.name}
                            </div>
                            {plan.description && (
                              <div className="text-xs text-slate-500 mt-1 max-w-xs line-clamp-2">
                                {plan.description}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-md">
                              {plan.level}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {plan.category || "-"}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {plan.tags && plan.tags.length > 0 ? (
                                plan.tags.map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-md"
                                  >
                                    {tag.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400 italic">
                                  No tags
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {plan.duration_days
                              ? `${plan.duration_days} days`
                              : plan.number_of_weeks
                              ? `${plan.number_of_weeks} weeks`
                              : plan.total_minutes
                              ? `${plan.total_minutes} min`
                              : "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/admin/coach/workout/plans/${plan.id}/daily`
                                )
                              }
                              className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-medium transition-all shadow-md text-sm flex items-center gap-2"
                            >
                              <HiPlus className="text-sm" />
                              Add Daily Plan
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {workoutPlanMealLinks.has(plan.id) ? (
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/admin/coach/workout/plans/${plan.id}/meal-plan`
                                  )
                                }
                                className="px-3 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-lg font-medium transition-all shadow-md text-sm flex items-center gap-2"
                              >
                                View Plan
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/admin/coach/workout/plans/${plan.id}/meal-plan`
                                  )
                                }
                                className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white rounded-lg font-medium transition-all shadow-md text-sm flex items-center gap-2"
                              >
                                <HiPlus className="text-sm" />
                                Attach
                              </button>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditClick(plan)}
                                className="text-amber-600 hover:text-amber-900 transition-colors"
                                title="Edit"
                              >
                                <HiPencil className="text-lg" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(plan)}
                                className="text-red-600 hover:text-red-900 transition-colors"
                                title="Delete"
                              >
                                <HiTrash className="text-lg" />
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
          </>
        )}
      </main>

      {/* Create/Edit Dialog */}
      <Dialog
        visible={showCreateDialog}
        onDismiss={() => {
          if (!isSaving) {
            setShowCreateDialog(false);
            setEditingPlan(null);
            setSelectedTags([]);
          }
        }}
        dismissible={!isSaving}
        maxWidth="80vw"
      >
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            {editingPlan
              ? "Edit Coach Workout Plan"
              : "Create Coach Workout Plan"}
          </h3>
          <div className="space-y-4">
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
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                placeholder="Enter workout plan name"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    description: e.target.value || null,
                  })
                }
                disabled={isSaving}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                placeholder="Enter description"
              />
            </div>

            {/* Motivation */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Motivation
              </label>
              <textarea
                value={formData.motivation || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    motivation: e.target.value || null,
                  })
                }
                disabled={isSaving}
                rows={2}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                placeholder="Enter motivation text"
              />
            </div>

            {/* Row: Level, Category */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Level <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={levelDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowLevelDropdown(!showLevelDropdown)}
                    disabled={isSaving}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl bg-white text-slate-700 font-medium shadow-sm hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:ring-offset-2 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 transition-all cursor-pointer text-left flex justify-between items-center"
                  >
                    <span
                      className={
                        formData.level ? "text-slate-700" : "text-slate-500"
                      }
                    >
                      {formData.level === "beginner"
                        ? "Beginner"
                        : formData.level === "intermediate"
                        ? "Intermediate"
                        : formData.level === "advanced"
                        ? "Advanced"
                        : "Select level"}
                    </span>
                    <span className="text-slate-400">▼</span>
                  </button>
                  {showLevelDropdown && (
                    <div className="absolute left-0 top-full mt-2 w-full bg-white border-2 border-slate-300 rounded-xl shadow-2xl z-[9999] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            level: "beginner",
                          });
                          setShowLevelDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100 first:rounded-t-xl"
                      >
                        Beginner
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            level: "intermediate",
                          });
                          setShowLevelDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100"
                      >
                        Intermediate
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            level: "advanced",
                          });
                          setShowLevelDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors last:rounded-b-xl"
                      >
                        Advanced
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Category
                </label>
                <div className="relative" ref={categoryDropdownRef}>
                  <button
                    type="button"
                    onClick={() =>
                      setShowCategoryDropdown(!showCategoryDropdown)
                    }
                    disabled={isSaving}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl bg-white text-slate-700 font-medium shadow-sm hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:ring-offset-2 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 transition-all cursor-pointer text-left flex justify-between items-center"
                  >
                    <span
                      className={
                        formData.category ? "text-slate-700" : "text-slate-500"
                      }
                    >
                      {formData.category || "Select category"}
                    </span>
                    <span className="text-slate-400">▼</span>
                  </button>
                  {showCategoryDropdown && (
                    <div className="absolute left-0 top-full mt-2 w-full bg-white border-2 border-slate-300 rounded-xl shadow-2xl z-[9999] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            category: null,
                          });
                          setShowCategoryDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100 first:rounded-t-xl"
                      >
                        Select category
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            category: "Core Awakening",
                          });
                          setShowCategoryDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100"
                      >
                        Core Awakening
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            category: "Gentle Mobility",
                          });
                          setShowCategoryDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100"
                      >
                        Gentle Mobility
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            category: "Cardio Clarity",
                          });
                          setShowCategoryDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100"
                      >
                        Cardio Clarity
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            category: "Strength & Stillness",
                          });
                          setShowCategoryDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100"
                      >
                        Strength & Stillness
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            category: "Soulful Challenges",
                          });
                          setShowCategoryDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors last:rounded-b-xl"
                      >
                        Soulful Challenges
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Tags
              </label>
              <div className="relative" ref={tagDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowTagDropdown(!showTagDropdown);
                    if (!showTagDropdown) {
                      setTagSearchTerm("");
                    }
                  }}
                  disabled={isSaving}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100 text-left flex justify-between items-center"
                >
                  <span className="text-slate-600">
                    {selectedTags.length > 0
                      ? `${selectedTags.length} tag(s) selected`
                      : "Select tags"}
                  </span>
                  <span className="text-slate-400">▼</span>
                </button>
                {showTagDropdown && (
                  <div className="absolute left-0 bottom-full mb-2 bg-white border border-slate-300 rounded-xl shadow-2xl z-[9999] min-w-full max-h-96 overflow-hidden flex flex-col">
                    {/* Search Input */}
                    <div className="p-3 border-b border-slate-200">
                      <input
                        type="text"
                        value={tagSearchTerm}
                        onChange={(e) => setTagSearchTerm(e.target.value)}
                        placeholder="Search tags..."
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                        autoFocus
                      />
                    </div>
                    {/* Tag List */}
                    <div className="overflow-y-auto max-h-60">
                      {(() => {
                        let filteredTags = workoutTags;

                        if (tagSearchTerm.trim()) {
                          const searchLower = tagSearchTerm
                            .toLowerCase()
                            .trim();
                          filteredTags = filteredTags.filter((tag) =>
                            tag.name.toLowerCase().includes(searchLower)
                          );
                        }

                        if (filteredTags.length === 0) {
                          return (
                            <div className="px-4 py-3 text-sm text-slate-500">
                              {tagSearchTerm.trim()
                                ? `No tags found matching "${tagSearchTerm}"`
                                : "No tags available"}
                            </div>
                          );
                        }

                        return filteredTags.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTag(tag.id)}
                            className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100 last:border-b-0 flex items-center justify-between"
                          >
                            <span>{tag.name}</span>
                            {selectedTags.includes(tag.id) && (
                              <span className="text-amber-600">✓</span>
                            )}
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
              {selectedTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedTags.map((tagId) => {
                    const tag = workoutTags.find((t) => t.id === tagId);
                    return tag ? (
                      <span
                        key={tagId}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-md"
                      >
                        {tag.name}
                        <button
                          type="button"
                          onClick={() => removeTag(tagId)}
                          disabled={isSaving}
                          className="hover:text-amber-900 disabled:opacity-50"
                        >
                          <HiXMark className="text-sm" />
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {/* Row: Total Minutes, Total Calories, Duration Days, Number of Weeks */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Total Minutes
                </label>
                <input
                  type="number"
                  value={formData.total_minutes || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      total_minutes: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  disabled={isSaving}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Total Calories
                </label>
                <input
                  type="number"
                  value={formData.total_calories || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      total_calories: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  disabled={isSaving}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Duration (Days)
                </label>
                <input
                  type="number"
                  value={formData.duration_days || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      duration_days: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  disabled={isSaving}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Number of Weeks
                </label>
                <input
                  type="number"
                  value={formData.number_of_weeks || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      number_of_weeks: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  disabled={isSaving}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Row: Total Exercises, Tier Code */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Total Exercises
                </label>
                <input
                  type="number"
                  value={formData.total_exercises || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      total_exercises: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  disabled={isSaving}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tier Code
                </label>
                <div className="relative" ref={tierCodeDropdownRef}>
                  <button
                    type="button"
                    onClick={() =>
                      setShowTierCodeDropdown(!showTierCodeDropdown)
                    }
                    disabled={isSaving}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl bg-white text-slate-700 font-medium shadow-sm hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:ring-offset-2 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 transition-all cursor-pointer text-left flex justify-between items-center"
                  >
                    <span
                      className={
                        formData.tier_code ? "text-slate-700" : "text-slate-500"
                      }
                    >
                      {formData.tier_code === "free"
                        ? "Free"
                        : formData.tier_code === "pro"
                        ? "Pro"
                        : formData.tier_code === "premium"
                        ? "Premium"
                        : "Select tier code"}
                    </span>
                    <span className="text-slate-400">▼</span>
                  </button>
                  {showTierCodeDropdown && (
                    <div className="absolute left-0 top-full mt-2 w-full bg-white border-2 border-slate-300 rounded-xl shadow-2xl z-[9999] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            tier_code: null,
                          });
                          setShowTierCodeDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100 first:rounded-t-xl"
                      >
                        Select tier code
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            tier_code: "free",
                          });
                          setShowTierCodeDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100"
                      >
                        Free
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            tier_code: "pro",
                          });
                          setShowTierCodeDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100"
                      >
                        Pro
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            tier_code: "premium",
                          });
                          setShowTierCodeDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors last:rounded-b-xl"
                      >
                        Premium
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row: Image Path, Image Alt */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Image Path
                </label>
                <input
                  type="text"
                  value={formData.image_path || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      image_path: e.target.value || null,
                    })
                  }
                  disabled={isSaving}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                  placeholder="Enter image path"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Image Alt Text
                </label>
                <input
                  type="text"
                  value={formData.image_alt || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      image_alt: e.target.value || null,
                    })
                  }
                  disabled={isSaving}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                  placeholder="Enter image alt text"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingPlan(null);
                setSelectedTags([]);
              }}
              disabled={isSaving}
              className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white rounded-lg font-medium transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader size="sm" inline />
                  Saving...
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
            planId: null,
            planName: null,
            planIds: null,
          })
        }
        dismissible={!isDeleting}
        maxWidth="80vw"
      >
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            Delete Coach Workout Plan
            {showDeleteDialog.planIds && showDeleteDialog.planIds.length > 1
              ? "s"
              : ""}
          </h3>
          <p className="text-slate-700 mb-6">
            {showDeleteDialog.planIds && showDeleteDialog.planIds.length > 1 ? (
              <>
                Are you sure you want to delete{" "}
                {showDeleteDialog.planIds.length} coach workout plans?
                <br />
                <span className="text-sm text-slate-600 mt-2 block">
                  This action cannot be undone.
                </span>
              </>
            ) : (
              <>
                Are you sure you want to delete the coach workout plan{" "}
                <span className="font-semibold">
                  &quot;{showDeleteDialog.planName}&quot;
                </span>
                ? This action cannot be undone.
              </>
            )}
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setShowDeleteDialog({
                  visible: false,
                  planId: null,
                  planName: null,
                  planIds: null,
                })
              }
              disabled={isDeleting}
              className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader size="sm" inline />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            type={toast.type}
            title={toast.title}
            message={toast.message}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}

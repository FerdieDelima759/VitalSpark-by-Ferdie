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
import { WorkoutPlanExerciseDetails } from "@/types/Workout";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

interface ExerciseFormData {
  name: string;
  default_safety_tip: string | null;
  primary_muscle: string | null;
  image_path: string | null;
  image_alt: string | null;
  image_slug: string | null;
  section: string;
}

export default function ExercisesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const adminClient = useAdminSupabase();
  const [exercises, setExercises] = useState<WorkoutPlanExerciseDetails[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const [editingExercise, setEditingExercise] =
    useState<WorkoutPlanExerciseDetails | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<{
    visible: boolean;
    exerciseId: string | null;
    exerciseName: string | null;
    exerciseIds: string[] | null;
  }>({
    visible: false,
    exerciseId: null,
    exerciseName: null,
    exerciseIds: null,
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [formData, setFormData] = useState<ExerciseFormData>({
    name: "",
    default_safety_tip: null,
    primary_muscle: null,
    image_path: null,
    image_alt: null,
    image_slug: null,
    section: "warmup",
  });
  const [dialogSection, setDialogSection] = useState<string>("warmup");
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
        setIsLoadingExercises(false);
        return;
      }

      try {
        setIsLoadingExercises(true);
        setError(null);

        const { data: exercisesData, error: exercisesError } = await adminClient
          .from("workout_plan_exercises_details")
          .select("*")
          .order("name", { ascending: true });

        if (exercisesError) {
          throw exercisesError;
        }

        setExercises(exercisesData || []);
      } catch (err: any) {
        console.error("Error fetching exercises:", err);
        setError(err.message || "Failed to fetch exercises");
        showToast("error", "Error", err.message || "Failed to fetch exercises");
      } finally {
        setIsLoadingExercises(false);
      }
    };

    if (adminClient && isAdmin) {
      fetchData();
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

  const handleCreateClick = (section: string) => {
    setFormData({
      name: "",
      default_safety_tip: null,
      primary_muscle: null,
      image_path: null,
      image_alt: null,
      image_slug: null,
      section: section,
    });
    setDialogSection(section);
    setEditingExercise(null);
    setShowCreateDialog(true);
  };

  const handleEditClick = (exercise: WorkoutPlanExerciseDetails) => {
    setFormData({
      name: exercise.name,
      default_safety_tip: exercise.default_safety_tip,
      primary_muscle: exercise.primary_muscle,
      image_path: exercise.image_path,
      image_alt: exercise.image_alt,
      image_slug: exercise.image_slug,
      section: exercise.section || "warmup",
    });
    setDialogSection(exercise.section || "warmup");
    setEditingExercise(exercise);
    setShowCreateDialog(true);
  };

  const handleDeleteClick = (exercise: WorkoutPlanExerciseDetails) => {
    setShowDeleteDialog({
      visible: true,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      exerciseIds: null,
    });
  };

  const handleDeleteSelectedClick = (section: string) => {
    const sectionExercises = getExercisesBySection(section);
    const selectedInSection = selectedExercises.filter((id) =>
      sectionExercises.some((ex) => ex.id === id)
    );
    if (selectedInSection.length === 0) return;
    setShowDeleteDialog({
      visible: true,
      exerciseId: null,
      exerciseName:
        selectedInSection.length === 1
          ? sectionExercises.find((ex) => ex.id === selectedInSection[0])
              ?.name || null
          : null,
      exerciseIds: selectedInSection,
    });
  };

  const toggleExerciseSelection = (exerciseId: string) => {
    setSelectedExercises((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId]
    );
  };

  const toggleSelectAll = (section: string) => {
    const sectionExercises = getExercisesBySection(section);
    const sectionIds = sectionExercises.map((ex) => ex.id);
    const allSelected = sectionIds.every((id) =>
      selectedExercises.includes(id)
    );

    if (allSelected) {
      setSelectedExercises((prev) =>
        prev.filter((id) => !sectionIds.includes(id))
      );
    } else {
      setSelectedExercises((prev) => [...new Set([...prev, ...sectionIds])]);
    }
  };

  const handleSave = async () => {
    if (!adminClient) {
      showToast("error", "Error", "Admin client not available");
      return;
    }

    if (!formData.name.trim()) {
      showToast("error", "Validation Error", "Name is required");
      return;
    }

    if (!formData.section) {
      showToast("error", "Validation Error", "Section is required");
      return;
    }

    try {
      setIsSaving(true);

      if (editingExercise) {
        // Update existing exercise
        const { error: updateError } = await adminClient
          .from("workout_plan_exercises_details")
          .update({
            name: formData.name.trim(),
            default_safety_tip: formData.default_safety_tip?.trim() || null,
            primary_muscle: formData.primary_muscle?.trim() || null,
            image_path: formData.image_path?.trim() || null,
            image_alt: formData.image_alt?.trim() || null,
            image_slug: formData.image_slug?.trim() || null,
            section: formData.section,
          })
          .eq("id", editingExercise.id);

        if (updateError) {
          throw updateError;
        }

        showToast("success", "Success", "Exercise updated successfully");
      } else {
        // Create new exercise
        const { error: insertError } = await adminClient
          .from("workout_plan_exercises_details")
          .insert({
            name: formData.name.trim(),
            default_safety_tip: formData.default_safety_tip?.trim() || null,
            primary_muscle: formData.primary_muscle?.trim() || null,
            image_path: formData.image_path?.trim() || null,
            image_alt: formData.image_alt?.trim() || null,
            image_slug: formData.image_slug?.trim() || null,
            section: formData.section,
          });

        if (insertError) {
          throw insertError;
        }

        showToast("success", "Success", "Exercise created successfully");
      }

      // Refresh data
      const { data: exercisesData, error: exercisesError } = await adminClient
        .from("workout_plan_exercises_details")
        .select("*")
        .order("name", { ascending: true });

      if (exercisesError) {
        throw exercisesError;
      }

      setExercises(exercisesData || []);
      // Store editing state before closing dialog
      const wasEditing = !!editingExercise;

      // Close dialog first
      setShowCreateDialog(false);
      setEditingExercise(null);

      // Show success toast after dialog closes fully
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (wasEditing) {
            showToast("success", "Success", "Exercise updated successfully");
          } else {
            showToast("success", "Success", "Exercise created successfully");
          }
        }, 500);
      });
    } catch (err: any) {
      console.error("Error saving exercise:", err);
      const errorMessage =
        err?.message || err?.details || err?.hint || "Failed to save exercise";

      // Close dialog first if it's still open
      if (showCreateDialog) {
        setShowCreateDialog(false);
        setEditingExercise(null);

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

    const exerciseIdsToDelete =
      showDeleteDialog.exerciseIds ||
      (showDeleteDialog.exerciseId ? [showDeleteDialog.exerciseId] : []);

    if (exerciseIdsToDelete.length === 0) {
      return;
    }

    try {
      setIsDeleting(true);

      const { error: deleteError } = await adminClient
        .from("workout_plan_exercises_details")
        .delete()
        .in("id", exerciseIdsToDelete);

      if (deleteError) {
        throw deleteError;
      }

      // Clear selections
      setSelectedExercises([]);

      // Refresh data
      const { data: exercisesData, error: exercisesError } = await adminClient
        .from("workout_plan_exercises_details")
        .select("*")
        .order("name", { ascending: true });

      if (!exercisesError && exercisesData) {
        setExercises(exercisesData);
      }

      const count = exerciseIdsToDelete.length;

      // Close dialog first
      setShowDeleteDialog({
        visible: false,
        exerciseId: null,
        exerciseName: null,
        exerciseIds: null,
      });

      // Show success toast after dialog closes fully
      requestAnimationFrame(() => {
        setTimeout(() => {
          showToast(
            "success",
            "Success",
            `${count} exercise${count > 1 ? "s" : ""} deleted successfully`
          );
        }, 500);
      });
    } catch (err: any) {
      console.error("Error deleting exercise:", err);
      const errorMessage = formatConstraintError(err, "exercise");

      // Close dialog first
      setShowDeleteDialog({
        visible: false,
        exerciseId: null,
        exerciseName: null,
        exerciseIds: null,
      });

      // Show error toast after dialog closes fully
      requestAnimationFrame(() => {
        setTimeout(() => {
          showToast("error", "Error", errorMessage);
        }, 500);
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getExercisesBySection = (section: string) => {
    return exercises.filter((exercise) => exercise.section === section);
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
        referencedEntity = "workout plans";
      }

      return `Delete not allowed at this time, ${entityName} is associated with a ${referencedEntity}`;
    }

    return errorMessage || `Failed to delete ${entityName}`;
  };

  const getSectionDisplayName = (section: string) => {
    switch (section) {
      case "warmup":
        return "Warm Up";
      case "main":
        return "Main";
      case "cooldown":
        return "Cool Down";
      default:
        return section;
    }
  };

  const generateImageSlug = (name: string): string => {
    if (!name.trim()) {
      return "";
    }
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters except spaces and hyphens
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
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
        {isLoading || isLoadingRole || isLoadingExercises ? (
          <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
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
                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => router.push("/admin/general/workouts")}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                  >
                    <HiArrowLeft className="h-5 w-5" />
                  </button>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
                  Exercise Management
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  Manage exercises for workout plans by section
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

            {/* Exercises by Section */}
            <div className="space-y-8">
              {/* Warm Up Section */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-slate-900">Warm Up</h3>
                  <div className="flex gap-2">
                    {selectedExercises.filter((id) =>
                      getExercisesBySection("warmup").some((ex) => ex.id === id)
                    ).length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSelectedClick("warmup")}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-md flex items-center gap-2"
                      >
                        <HiTrash className="text-lg" />
                        Delete Selected (
                        {
                          selectedExercises.filter((id) =>
                            getExercisesBySection("warmup").some(
                              (ex) => ex.id === id
                            )
                          ).length
                        }
                        )
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCreateClick("warmup")}
                      className="px-4 py-2 bg-gradient-to-r from-[#00b3b3] to-[#009898] hover:from-[#00a1a1] hover:to-[#008787] text-white rounded-lg font-medium transition-all shadow-md flex items-center gap-2"
                    >
                      <HiPlus className="text-lg" />
                      Add New Warm Up
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Safety Tip
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Primary Muscle
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {getExercisesBySection("warmup").length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-12 text-center text-slate-500"
                          >
                            No warm up exercises found. Create your first one!
                          </td>
                        </tr>
                      ) : (
                        getExercisesBySection("warmup").map((exercise) => (
                          <tr key={exercise.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={selectedExercises.includes(
                                  exercise.id
                                )}
                                onChange={() =>
                                  toggleExerciseSelection(exercise.id)
                                }
                                className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-slate-900">
                                {exercise.name}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-slate-600 max-w-xs line-clamp-2">
                                {exercise.default_safety_tip || "-"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                              {exercise.primary_muscle || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditClick(exercise)}
                                  className="text-amber-600 hover:text-amber-900 transition-colors"
                                  title="Edit"
                                >
                                  <HiPencil className="text-lg" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClick(exercise)}
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

              {/* Main Section */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-slate-900">Main</h3>
                  <div className="flex gap-2">
                    {selectedExercises.filter((id) =>
                      getExercisesBySection("main").some((ex) => ex.id === id)
                    ).length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSelectedClick("main")}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-md flex items-center gap-2"
                      >
                        <HiTrash className="text-lg" />
                        Delete Selected (
                        {
                          selectedExercises.filter((id) =>
                            getExercisesBySection("main").some(
                              (ex) => ex.id === id
                            )
                          ).length
                        }
                        )
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCreateClick("main")}
                      className="px-4 py-2 bg-gradient-to-r from-[#00b3b3] to-[#009898] hover:from-[#00a1a1] hover:to-[#008787] text-white rounded-lg font-medium transition-all shadow-md flex items-center gap-2"
                    >
                      <HiPlus className="text-lg" />
                      Add New Main
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider w-12">
                          <input
                            type="checkbox"
                            checked={
                              getExercisesBySection("main").length > 0 &&
                              getExercisesBySection("main").every((ex) =>
                                selectedExercises.includes(ex.id)
                              )
                            }
                            onChange={() => toggleSelectAll("main")}
                            className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Safety Tip
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Primary Muscle
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {getExercisesBySection("main").length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-12 text-center text-slate-500"
                          >
                            No main exercises found. Create your first one!
                          </td>
                        </tr>
                      ) : (
                        getExercisesBySection("main").map((exercise) => (
                          <tr key={exercise.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={selectedExercises.includes(
                                  exercise.id
                                )}
                                onChange={() =>
                                  toggleExerciseSelection(exercise.id)
                                }
                                className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-slate-900">
                                {exercise.name}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-slate-600 max-w-xs line-clamp-2">
                                {exercise.default_safety_tip || "-"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                              {exercise.primary_muscle || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditClick(exercise)}
                                  className="text-amber-600 hover:text-amber-900 transition-colors"
                                  title="Edit"
                                >
                                  <HiPencil className="text-lg" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClick(exercise)}
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

              {/* Cool Down Section */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-slate-900">
                    Cool Down
                  </h3>
                  <div className="flex gap-2">
                    {selectedExercises.filter((id) =>
                      getExercisesBySection("cooldown").some(
                        (ex) => ex.id === id
                      )
                    ).length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSelectedClick("cooldown")}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-md flex items-center gap-2"
                      >
                        <HiTrash className="text-lg" />
                        Delete Selected (
                        {
                          selectedExercises.filter((id) =>
                            getExercisesBySection("cooldown").some(
                              (ex) => ex.id === id
                            )
                          ).length
                        }
                        )
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCreateClick("cooldown")}
                      className="px-4 py-2 bg-gradient-to-r from-[#00b3b3] to-[#009898] hover:from-[#00a1a1] hover:to-[#008787] text-white rounded-lg font-medium transition-all shadow-md flex items-center gap-2"
                    >
                      <HiPlus className="text-lg" />
                      Add New Cool Down
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider w-12">
                          <input
                            type="checkbox"
                            checked={
                              getExercisesBySection("cooldown").length > 0 &&
                              getExercisesBySection("cooldown").every((ex) =>
                                selectedExercises.includes(ex.id)
                              )
                            }
                            onChange={() => toggleSelectAll("cooldown")}
                            className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Safety Tip
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Primary Muscle
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {getExercisesBySection("cooldown").length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-12 text-center text-slate-500"
                          >
                            No cool down exercises found. Create your first one!
                          </td>
                        </tr>
                      ) : (
                        getExercisesBySection("cooldown").map((exercise) => (
                          <tr key={exercise.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={selectedExercises.includes(
                                  exercise.id
                                )}
                                onChange={() =>
                                  toggleExerciseSelection(exercise.id)
                                }
                                className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-slate-900">
                                {exercise.name}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-slate-600 max-w-xs line-clamp-2">
                                {exercise.default_safety_tip || "-"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                              {exercise.primary_muscle || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditClick(exercise)}
                                  className="text-amber-600 hover:text-amber-900 transition-colors"
                                  title="Edit"
                                >
                                  <HiPencil className="text-lg" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClick(exercise)}
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
            setEditingExercise(null);
          }
        }}
        dismissible={!isSaving}
        maxWidth="80vw"
      >
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            {editingExercise
              ? "Edit Exercise"
              : `Add New ${getSectionDisplayName(dialogSection)} Exercise`}
          </h3>
          <div className="space-y-4">
            {/* Section (read-only when editing) */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Section <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.section}
                onChange={(e) =>
                  setFormData({ ...formData, section: e.target.value })
                }
                disabled={isSaving || !!editingExercise}
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl bg-white text-slate-700 font-medium shadow-sm hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:ring-offset-2 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 transition-all cursor-pointer"
              >
                <option value="warmup">Warm Up</option>
                <option value="main">Main</option>
                <option value="cooldown">Cool Down</option>
              </select>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  const newName = e.target.value;
                  const newSlug = generateImageSlug(newName);
                  setFormData({
                    ...formData,
                    name: newName,
                    image_slug: newSlug || null,
                  });
                }}
                disabled={isSaving}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                placeholder="Enter exercise name"
              />
            </div>

            {/* Default Safety Tip */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Default Safety Tip
              </label>
              <textarea
                value={formData.default_safety_tip || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    default_safety_tip: e.target.value || null,
                  })
                }
                disabled={isSaving}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                placeholder="Enter default safety tip"
              />
            </div>

            {/* Primary Muscle */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Primary Muscle
              </label>
              <input
                type="text"
                value={formData.primary_muscle || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    primary_muscle: e.target.value || null,
                  })
                }
                disabled={isSaving}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                placeholder="Enter primary muscle"
              />
            </div>

            {/* Row: Image Path, Image Alt, Image Slug */}
            <div className="grid grid-cols-3 gap-4">
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
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Image Slug
                  <span className="text-xs font-normal text-slate-500 ml-2">
                    (Auto-generated)
                  </span>
                </label>
                <input
                  type="text"
                  value={formData.image_slug || ""}
                  readOnly
                  disabled
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl bg-gray-50 text-slate-600 font-medium cursor-not-allowed"
                  placeholder="Auto-generated from name"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingExercise(null);
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
              ) : editingExercise ? (
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
            exerciseId: null,
            exerciseName: null,
            exerciseIds: null,
          })
        }
        dismissible={!isDeleting}
        maxWidth="80vw"
      >
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            Delete Exercise
            {showDeleteDialog.exerciseIds &&
            showDeleteDialog.exerciseIds.length > 1
              ? "s"
              : ""}
          </h3>
          <p className="text-slate-700 mb-6">
            {showDeleteDialog.exerciseIds &&
            showDeleteDialog.exerciseIds.length > 1 ? (
              <>
                Are you sure you want to delete{" "}
                {showDeleteDialog.exerciseIds.length} exercises?
                <br />
                <span className="text-sm text-slate-600 mt-2 block">
                  This action cannot be undone.
                </span>
              </>
            ) : (
              <>
                Are you sure you want to delete the exercise{" "}
                <span className="font-semibold">
                  &quot;{showDeleteDialog.exerciseName}&quot;
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
                  exerciseId: null,
                  exerciseName: null,
                  exerciseIds: null,
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

"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminSupabase } from "@/hooks/useAdminSupabase";
import Image from "next/image";
import Loader from "@/components/Loader";
import Dialog from "@/components/Dialog";
import Toast, { ToastProps } from "@/components/Toast";
import { HiArrowLeft, HiPencil, HiTrash, HiPlus } from "react-icons/hi2";
import {
  CoachWorkoutDailyPlan,
  CoachWorkoutDailyPlanExerciseWithDetails,
  CoachWorkoutPlanExerciseDetails,
} from "@/types/CoachWorkout";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

export default function DailyPlanExercisesPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;
  const dailyPlanId = params.dailyPlanId as string;
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const adminClient = useAdminSupabase();
  const [dailyPlan, setDailyPlan] = useState<CoachWorkoutDailyPlan | null>(
    null
  );
  const [exercises, setExercises] = useState<
    CoachWorkoutDailyPlanExerciseWithDetails[]
  >([]);
  const [availableExercises, setAvailableExercises] = useState<
    CoachWorkoutPlanExerciseDetails[]
  >([]);
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(true);
  const [isLoadingExercises, setIsLoadingExercises] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const [editingExercise, setEditingExercise] =
    useState<CoachWorkoutDailyPlanExerciseWithDetails | null>(null);
  const [showExerciseDialog, setShowExerciseDialog] = useState<boolean>(false);
  const [isSavingExercise, setIsSavingExercise] = useState<boolean>(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<{
    visible: boolean;
    exercise: CoachWorkoutDailyPlanExerciseWithDetails | null;
  }>({
    visible: false,
    exercise: null,
  });
  const [isDeletingExercise, setIsDeletingExercise] = useState<boolean>(false);
  const [showSectionDropdown, setShowSectionDropdown] =
    useState<boolean>(false);
  const sectionDropdownRef = useRef<HTMLDivElement>(null);
  const [showExerciseDropdown, setShowExerciseDropdown] =
    useState<boolean>(false);
  const exerciseDropdownRef = useRef<HTMLDivElement>(null);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState<string>("");
  const [exerciseFormData, setExerciseFormData] = useState<{
    exercise_id: string;
    position: number;
    section: string;
    safety_tip: string | null;
    sets: number | null;
    reps: number | null;
    duration_seconds: number | null;
    rest_seconds: number;
    per_side: boolean;
  }>({
    exercise_id: "",
    position: 1,
    section: "",
    safety_tip: null,
    sets: null,
    reps: null,
    duration_seconds: null,
    rest_seconds: 30,
    per_side: false,
  });
  const hasCheckedAuth = useRef(false);

  useEffect(() => {
    if (!isLoading && !isLoadingRole) {
      if (!hasCheckedAuth.current) {
        hasCheckedAuth.current = true;
      }
      if (!isAuthenticated) {
        router.push("/auth/login");
      } else if (hasCheckedAuth.current && !isAdmin) {
        router.push("/");
      }
    }
  }, [isAuthenticated, isAdmin, isLoading, isLoadingRole, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!adminClient || !dailyPlanId) {
        setIsLoadingPlan(false);
        setIsLoadingExercises(false);
        return;
      }

      try {
        setIsLoadingPlan(true);
        setIsLoadingExercises(true);
        setError(null);

        // Fetch daily plan
        const { data: planData, error: planError } = await adminClient
          .from("coach_workout_daily_plan")
          .select("*")
          .eq("id", dailyPlanId)
          .single();

        if (planError) {
          throw planError;
        }

        setDailyPlan(planData);

        // Fetch available exercises
        const { data: exercisesDetailsData, error: exercisesDetailsError } =
          await adminClient
            .from("coach_workout_plan_exercises_details")
            .select("*")
            .order("name", { ascending: true });

        if (exercisesDetailsError) {
          console.error(
            "Error fetching exercise details:",
            exercisesDetailsError
          );
        }

        setAvailableExercises(exercisesDetailsData || []);

        // Fetch exercises for this daily plan
        const { data: exercisesData, error: exercisesError } = await adminClient
          .from("coach_workout_daily_plan_exercises")
          .select("*")
          .eq("daily_plan_id", dailyPlanId)
          .order("position", { ascending: true });

        if (exercisesError) {
          throw exercisesError;
        }

        // Fetch exercise details if exercises exist
        let exercisesWithDetails: CoachWorkoutDailyPlanExerciseWithDetails[] =
          [];
        if (exercisesData && exercisesData.length > 0) {
          const exerciseIds = exercisesData.map((ex) => ex.exercise_id);
          const { data: detailsData, error: detailsError } = await adminClient
            .from("coach_workout_plan_exercises_details")
            .select("*")
            .in("id", exerciseIds);

          if (detailsError) {
            console.error("Error fetching exercise details:", detailsError);
          }

          // Create a map of details
          const detailsMap = new Map();
          detailsData?.forEach((detail) => {
            detailsMap.set(detail.id, detail);
          });

          // Combine exercises with details
          exercisesWithDetails = exercisesData.map((exercise) => ({
            ...exercise,
            exercise_details: detailsMap.get(exercise.exercise_id),
          }));
        }

        setExercises(exercisesWithDetails);
      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError(err.message || "Failed to fetch data");
        showToast("error", "Error", err.message || "Failed to fetch data");
      } finally {
        setIsLoadingPlan(false);
        setIsLoadingExercises(false);
      }
    };

    if (adminClient && isAdmin && dailyPlanId) {
      fetchData();
    }
  }, [adminClient, isAdmin, dailyPlanId]);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sectionDropdownRef.current &&
        !sectionDropdownRef.current.contains(event.target as Node)
      ) {
        setShowSectionDropdown(false);
      }
      if (
        exerciseDropdownRef.current &&
        !exerciseDropdownRef.current.contains(event.target as Node)
      ) {
        setShowExerciseDropdown(false);
        setExerciseSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Auto-calculate position when section changes
  useEffect(() => {
    if (showExerciseDialog && !editingExercise && exerciseFormData.section) {
      const newPosition = calculateNextPosition(exerciseFormData.section);
      setExerciseFormData((prev) => {
        if (prev.position !== newPosition) {
          return { ...prev, position: newPosition };
        }
        return prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseFormData.section, showExerciseDialog, editingExercise]);

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

  const calculateNextPosition = (section: string): number => {
    if (!exercises || exercises.length === 0) {
      if (section === "warmup") return 1;
      if (section === "main") return 101;
      if (section === "cooldown") return 201;
      return 1;
    }

    const sectionExercises = exercises.filter((ex) => ex.section === section);

    if (sectionExercises.length === 0) {
      if (section === "warmup") return 1;
      if (section === "main") return 101;
      if (section === "cooldown") return 201;
      return 1;
    }

    const maxPosition = Math.max(...sectionExercises.map((ex) => ex.position));
    return maxPosition + 1;
  };

  const handleAddExercise = () => {
    setExerciseFormData({
      exercise_id: "",
      position: 1,
      section: "",
      safety_tip: null,
      sets: null,
      reps: null,
      duration_seconds: null,
      rest_seconds: 30,
      per_side: false,
    });
    setEditingExercise(null);
    setExerciseSearchTerm("");
    setShowExerciseDialog(true);
  };

  const handleEditExercise = (
    exercise: CoachWorkoutDailyPlanExerciseWithDetails
  ) => {
    setExerciseFormData({
      exercise_id: exercise.exercise_id,
      position: exercise.position,
      section: exercise.section,
      safety_tip: exercise.safety_tip,
      sets: exercise.sets,
      reps: exercise.reps,
      duration_seconds: exercise.duration_seconds,
      rest_seconds: exercise.rest_seconds,
      per_side: exercise.per_side,
    });
    setEditingExercise(exercise);
    setShowExerciseDialog(true);
  };

  const handleDeleteClick = (
    exercise: CoachWorkoutDailyPlanExerciseWithDetails
  ) => {
    setShowDeleteDialog({ visible: true, exercise });
  };

  const handleDeleteExercise = async () => {
    const exercise = showDeleteDialog.exercise;
    if (!adminClient || !dailyPlanId || !exercise) {
      return;
    }

    try {
      setIsDeletingExercise(true);

      const { error: deleteError } = await adminClient
        .from("coach_workout_daily_plan_exercises")
        .delete()
        .eq("id", exercise.id);

      if (deleteError) {
        throw deleteError;
      }

      // Refresh exercises
      const { data: exercisesData } = await adminClient
        .from("coach_workout_daily_plan_exercises")
        .select("*")
        .eq("daily_plan_id", dailyPlanId)
        .order("position", { ascending: true });

      if (exercisesData && exercisesData.length > 0) {
        const exerciseIds = exercisesData.map((ex) => ex.exercise_id);
        const { data: detailsData } = await adminClient
          .from("coach_workout_plan_exercises_details")
          .select("*")
          .in("id", exerciseIds);

        const detailsMap = new Map();
        detailsData?.forEach((detail) => {
          detailsMap.set(detail.id, detail);
        });

        const exercisesWithDetails = exercisesData.map((ex) => ({
          ...ex,
          exercise_details: detailsMap.get(ex.exercise_id),
        }));

        setExercises(exercisesWithDetails);
      } else {
        setExercises([]);
      }

      setShowDeleteDialog({ visible: false, exercise: null });

      requestAnimationFrame(() => {
        setTimeout(() => {
          showToast("success", "Success", "Exercise deleted successfully");
        }, 500);
      });
    } catch (err: any) {
      console.error("Error deleting exercise:", err);
      const errorMessage =
        err?.message ||
        err?.details ||
        err?.hint ||
        "Failed to delete exercise";

      setShowDeleteDialog({ visible: false, exercise: null });

      requestAnimationFrame(() => {
        setTimeout(() => {
          showToast("error", "Error", errorMessage);
        }, 500);
      });
    } finally {
      setIsDeletingExercise(false);
    }
  };

  const handleSaveExercise = async () => {
    if (!adminClient || !dailyPlanId) {
      showToast("error", "Error", "Admin client not available");
      return;
    }

    if (!exerciseFormData.exercise_id) {
      showToast("error", "Validation Error", "Please select an exercise");
      return;
    }

    if (!exerciseFormData.section.trim()) {
      showToast("error", "Validation Error", "Section is required");
      return;
    }

    try {
      setIsSavingExercise(true);

      if (editingExercise) {
        // Update existing exercise
        const { error: updateError } = await adminClient
          .from("coach_workout_daily_plan_exercises")
          .update({
            position: exerciseFormData.position,
            section: exerciseFormData.section.trim(),
            safety_tip: exerciseFormData.safety_tip?.trim() || null,
            sets: exerciseFormData.sets || null,
            reps: exerciseFormData.reps || null,
            duration_seconds: exerciseFormData.duration_seconds || null,
            rest_seconds: exerciseFormData.rest_seconds,
            per_side: exerciseFormData.per_side,
          })
          .eq("id", editingExercise.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new exercise
        const { error: insertError } = await adminClient
          .from("coach_workout_daily_plan_exercises")
          .insert({
            daily_plan_id: dailyPlanId,
            day_number: dailyPlan?.day_number || 1,
            exercise_id: exerciseFormData.exercise_id,
            position: exerciseFormData.position,
            section: exerciseFormData.section.trim(),
            safety_tip: exerciseFormData.safety_tip?.trim() || null,
            sets: exerciseFormData.sets || null,
            reps: exerciseFormData.reps || null,
            duration_seconds: exerciseFormData.duration_seconds || null,
            rest_seconds: exerciseFormData.rest_seconds,
            per_side: exerciseFormData.per_side,
          });

        if (insertError) {
          throw insertError;
        }
      }

      // Refresh exercises
      const { data: exercisesData } = await adminClient
        .from("coach_workout_daily_plan_exercises")
        .select("*")
        .eq("daily_plan_id", dailyPlanId)
        .order("position", { ascending: true });

      if (exercisesData && exercisesData.length > 0) {
        const exerciseIds = exercisesData.map((ex) => ex.exercise_id);
        const { data: detailsData } = await adminClient
          .from("coach_workout_plan_exercises_details")
          .select("*")
          .in("id", exerciseIds);

        const detailsMap = new Map();
        detailsData?.forEach((detail) => {
          detailsMap.set(detail.id, detail);
        });

        const exercisesWithDetails = exercisesData.map((ex) => ({
          ...ex,
          exercise_details: detailsMap.get(ex.exercise_id),
        }));

        setExercises(exercisesWithDetails);
      }

      const wasEditing = !!editingExercise;

      setShowExerciseDialog(false);
      setEditingExercise(null);

      requestAnimationFrame(() => {
        setTimeout(() => {
          if (wasEditing) {
            showToast("success", "Success", "Exercise updated successfully");
          } else {
            showToast("success", "Success", "Exercise added successfully");
          }
        }, 500);
      });
    } catch (err: any) {
      console.error("Error saving exercise:", err);
      const errorMessage =
        err?.message || err?.details || err?.hint || "Failed to save exercise";

      if (showExerciseDialog) {
        setShowExerciseDialog(false);
        setEditingExercise(null);

        requestAnimationFrame(() => {
          setTimeout(() => {
            showToast("error", "Error", errorMessage);
          }, 500);
        });
      } else {
        showToast("error", "Error", errorMessage);
      }
    } finally {
      setIsSavingExercise(false);
    }
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
        {isLoading || isLoadingRole || isLoadingPlan || isLoadingExercises ? (
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
                    onClick={() =>
                      router.push(`/admin/coach/workout/plans/${planId}/daily`)
                    }
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
                      onClick={handleAddExercise}
                      className="px-4 py-2 bg-[#0f766e] hover:bg-[#0d6b63] text-white rounded-lg font-medium transition-all shadow-md flex items-center gap-2"
                    >
                      <HiPlus className="text-lg" />
                      Add Exercise
                    </button>
                  </div>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
                  Exercises - Day {dailyPlan?.day_number || "N/A"}
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  Manage exercises for this daily plan
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

            {/* Exercises List */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              {exercises.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  No exercises found. Add your first one!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Position
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Section
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Exercise
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Sets
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Reps
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Duration
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Rest
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {exercises.map((exercise) => (
                        <tr key={exercise.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {exercise.position}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {exercise.section}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-900">
                            {exercise.exercise_details?.name || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {exercise.sets || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {exercise.reps || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {exercise.duration_seconds
                              ? `${exercise.duration_seconds}s`
                              : "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {exercise.rest_seconds}s
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditExercise(exercise)}
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
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Exercise Dialog */}
      <Dialog
        visible={showExerciseDialog}
        onDismiss={() => {
          if (!isSavingExercise) {
            setShowExerciseDialog(false);
            setEditingExercise(null);
            setExerciseSearchTerm("");
            setShowExerciseDropdown(false);
          }
        }}
        dismissible={!isSavingExercise}
        maxWidth="80vw"
      >
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            {editingExercise ? "Edit Exercise" : "Add Exercise"}
          </h3>
          <div className="space-y-4">
            {/* Section and Position */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Section <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={sectionDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowSectionDropdown(!showSectionDropdown)}
                    disabled={isSavingExercise}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl bg-white text-slate-700 font-medium shadow-sm hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:ring-offset-2 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 transition-all cursor-pointer text-left flex justify-between items-center"
                  >
                    <span
                      className={
                        exerciseFormData.section
                          ? "text-slate-700"
                          : "text-slate-500"
                      }
                    >
                      {exerciseFormData.section === "warmup"
                        ? "Warm Up"
                        : exerciseFormData.section === "main"
                        ? "Main"
                        : exerciseFormData.section === "cooldown"
                        ? "Cool Down"
                        : "Select a section"}
                    </span>
                    <span className="text-slate-400">▼</span>
                  </button>
                  {showSectionDropdown && (
                    <div className="absolute left-0 top-full mt-2 w-full bg-white border-2 border-slate-300 rounded-xl shadow-2xl z-[9999] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          const newSection = "warmup";
                          const newPosition = editingExercise
                            ? exerciseFormData.position
                            : calculateNextPosition(newSection);
                          setExerciseFormData({
                            ...exerciseFormData,
                            section: newSection,
                            position: newPosition,
                          });
                          setShowSectionDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100 first:rounded-t-xl"
                      >
                        Warm Up
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newSection = "main";
                          const newPosition = editingExercise
                            ? exerciseFormData.position
                            : calculateNextPosition(newSection);
                          setExerciseFormData({
                            ...exerciseFormData,
                            section: newSection,
                            position: newPosition,
                          });
                          setShowSectionDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100"
                      >
                        Main
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newSection = "cooldown";
                          const newPosition = editingExercise
                            ? exerciseFormData.position
                            : calculateNextPosition(newSection);
                          setExerciseFormData({
                            ...exerciseFormData,
                            section: newSection,
                            position: newPosition,
                          });
                          setShowSectionDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors last:rounded-b-xl"
                      >
                        Cool Down
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Position <span className="text-red-500">*</span>
                  <span className="text-xs font-normal text-slate-500 ml-2">
                    (Auto-generated)
                  </span>
                </label>
                <input
                  type="number"
                  value={exerciseFormData.position}
                  readOnly
                  disabled
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl bg-gray-50 text-slate-600 font-medium cursor-not-allowed"
                />
              </div>
            </div>

            {/* Exercise Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Exercise <span className="text-red-500">*</span>
              </label>
              <div className="relative" ref={exerciseDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (!exerciseFormData.section) {
                      showToast(
                        "error",
                        "Validation",
                        "Please select a section first"
                      );
                      return;
                    }
                    setShowExerciseDropdown(!showExerciseDropdown);
                    if (!showExerciseDropdown) {
                      setExerciseSearchTerm("");
                    }
                  }}
                  disabled={isSavingExercise || !exerciseFormData.section}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl bg-white text-slate-700 font-medium shadow-sm hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:ring-offset-2 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 transition-all cursor-pointer text-left flex justify-between items-center"
                >
                  <span
                    className={
                      exerciseFormData.exercise_id
                        ? "text-slate-700"
                        : "text-slate-500"
                    }
                  >
                    {exerciseFormData.exercise_id
                      ? availableExercises.find(
                          (ex) => ex.id === exerciseFormData.exercise_id
                        )?.name || "Select an exercise"
                      : "Select an exercise"}
                  </span>
                  <span className="text-slate-400">▼</span>
                </button>
                {showExerciseDropdown && (
                  <div className="absolute left-0 top-full mt-2 w-full bg-white border-2 border-slate-300 rounded-xl shadow-2xl z-[9999] max-h-96 overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-slate-200">
                      <input
                        type="text"
                        value={exerciseSearchTerm}
                        onChange={(e) => setExerciseSearchTerm(e.target.value)}
                        placeholder="Search exercises..."
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto max-h-60">
                      {(() => {
                        let filteredExercises = exerciseFormData.section
                          ? availableExercises.filter(
                              (exercise) =>
                                exercise.section === exerciseFormData.section
                            )
                          : availableExercises;

                        if (exerciseSearchTerm.trim()) {
                          const searchLower = exerciseSearchTerm
                            .toLowerCase()
                            .trim();
                          filteredExercises = filteredExercises.filter(
                            (exercise) =>
                              exercise.name.toLowerCase().includes(searchLower)
                          );
                        }

                        if (filteredExercises.length === 0) {
                          return (
                            <div className="px-4 py-3 text-sm text-slate-500">
                              {exerciseSearchTerm.trim()
                                ? `No exercises found matching "${exerciseSearchTerm}"`
                                : exerciseFormData.section
                                ? `No exercises available for ${
                                    exerciseFormData.section === "warmup"
                                      ? "Warm Up"
                                      : exerciseFormData.section === "main"
                                      ? "Main"
                                      : "Cool Down"
                                  } section`
                                : "No exercises available. Please select a section first."}
                            </div>
                          );
                        }

                        return filteredExercises.map((exercise) => (
                          <button
                            key={exercise.id}
                            type="button"
                            onClick={() => {
                              setExerciseFormData({
                                ...exerciseFormData,
                                exercise_id: exercise.id,
                                safety_tip: exercise.default_safety_tip || null,
                              });
                              setShowExerciseDropdown(false);
                              setExerciseSearchTerm("");
                            }}
                            className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100 last:border-b-0"
                          >
                            {exercise.name}
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                )}
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExerciseDialog(false);
                      router.push("/admin/coach/workout/plans/exercises");
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                  >
                    Exercise not found? Add it here
                  </button>
                </div>
              </div>
            </div>

            {/* Safety Tip */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Safety Tip
              </label>
              <textarea
                value={exerciseFormData.safety_tip || ""}
                onChange={(e) =>
                  setExerciseFormData({
                    ...exerciseFormData,
                    safety_tip: e.target.value || null,
                  })
                }
                disabled={isSavingExercise}
                rows={2}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                placeholder="Enter safety tip (optional)"
              />
            </div>

            {/* Sets, Reps, Duration, Rest */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Sets
                </label>
                <input
                  type="number"
                  value={exerciseFormData.sets || ""}
                  onChange={(e) =>
                    setExerciseFormData({
                      ...exerciseFormData,
                      sets: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  disabled={isSavingExercise}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Reps
                </label>
                <input
                  type="number"
                  value={exerciseFormData.reps || ""}
                  onChange={(e) =>
                    setExerciseFormData({
                      ...exerciseFormData,
                      reps: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  disabled={isSavingExercise}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Duration (s)
                </label>
                <input
                  type="number"
                  value={exerciseFormData.duration_seconds || ""}
                  onChange={(e) =>
                    setExerciseFormData({
                      ...exerciseFormData,
                      duration_seconds: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  disabled={isSavingExercise}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Rest (s) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={exerciseFormData.rest_seconds}
                  onChange={(e) =>
                    setExerciseFormData({
                      ...exerciseFormData,
                      rest_seconds: parseInt(e.target.value) || 30,
                    })
                  }
                  disabled={isSavingExercise}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                />
              </div>
            </div>

            {/* Per Side */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={exerciseFormData.per_side}
                  onChange={(e) =>
                    setExerciseFormData({
                      ...exerciseFormData,
                      per_side: e.target.checked,
                    })
                  }
                  disabled={isSavingExercise}
                  className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                />
                <span className="text-sm font-semibold text-slate-700">
                  Per Side
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setShowExerciseDialog(false);
                setEditingExercise(null);
              }}
              disabled={isSavingExercise}
              className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveExercise}
              disabled={isSavingExercise}
              className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white rounded-lg font-medium transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {isSavingExercise ? (
                <>
                  <Loader size="sm" inline />
                  Saving...
                </>
              ) : editingExercise ? (
                "Update Exercise"
              ) : (
                "Add Exercise"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        visible={showDeleteDialog.visible}
        onDismiss={() =>
          !isDeletingExercise &&
          setShowDeleteDialog({ visible: false, exercise: null })
        }
        dismissible={!isDeletingExercise}
        maxWidth="80vw"
      >
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            Delete Exercise
          </h3>
          <p className="text-slate-700 mb-6">
            Are you sure you want to delete this exercise{" "}
            {showDeleteDialog.exercise?.exercise_details?.name && (
              <span className="font-semibold">
                &quot;{showDeleteDialog.exercise.exercise_details.name}&quot;
              </span>
            )}
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setShowDeleteDialog({ visible: false, exercise: null })
              }
              disabled={isDeletingExercise}
              className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteExercise}
              disabled={isDeletingExercise}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isDeletingExercise ? (
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

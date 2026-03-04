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
import {
  HiArrowLeft,
  HiPencil,
  HiTrash,
  HiPlus,
  HiClipboardDocument,
} from "react-icons/hi2";
import { CoachWorkoutDailyPlan, CoachWorkoutPlan } from "@/types/CoachWorkout";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

interface DailyPlanFormData {
  day_number: number;
  number_of_exercises: number;
  total_minutes: number | null;
  total_calories: number | null;
  daily_motivation: string | null;
  reminder: string | null;
  plan_goal: string | null;
}

export default function DailyPlansPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const adminClient = useAdminSupabase();
  const [plan, setPlan] = useState<CoachWorkoutPlan | null>(null);
  const [dailyPlans, setDailyPlans] = useState<CoachWorkoutDailyPlan[]>([]);
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(true);
  const [isLoadingDailyPlans, setIsLoadingDailyPlans] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const [editingDailyPlan, setEditingDailyPlan] =
    useState<CoachWorkoutDailyPlan | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<{
    visible: boolean;
    dailyPlanId: string | null;
    dayNumber: number | null;
  }>({
    visible: false,
    dailyPlanId: null,
    dayNumber: null,
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showReuseDialog, setShowReuseDialog] = useState<{
    visible: boolean;
    dailyPlan: CoachWorkoutDailyPlan | null;
  }>({
    visible: false,
    dailyPlan: null,
  });
  const [isReusing, setIsReusing] = useState<boolean>(false);
  const [selectedDailyPlanToReuse, setSelectedDailyPlanToReuse] =
    useState<string>("");
  const [showReuseDropdown, setShowReuseDropdown] = useState<boolean>(false);
  const reuseDropdownRef = useRef<HTMLDivElement>(null);
  const [previewExercises, setPreviewExercises] = useState<
    Array<{
      name: string;
      section: string;
    }>
  >([]);
  const [isLoadingPreviewExercises, setIsLoadingPreviewExercises] =
    useState<boolean>(false);
  const [reuseDialogExercises, setReuseDialogExercises] = useState<
    Array<{
      name: string;
      section: string;
    }>
  >([]);
  const [isLoadingReuseDialogExercises, setIsLoadingReuseDialogExercises] =
    useState<boolean>(false);
  const [formData, setFormData] = useState<DailyPlanFormData>({
    day_number: 1,
    number_of_exercises: 0,
    total_minutes: null,
    total_calories: null,
    daily_motivation: null,
    reminder: null,
    plan_goal: null,
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
    const fetchData = async () => {
      if (!adminClient || !planId) {
        setIsLoadingPlan(false);
        setIsLoadingDailyPlans(false);
        return;
      }

      try {
        setIsLoadingPlan(true);
        setIsLoadingDailyPlans(true);
        setError(null);

        // Fetch plan
        const { data: planData, error: planError } = await adminClient
          .from("coach_workout_plans")
          .select("*")
          .eq("id", planId)
          .single();

        if (planError) {
          throw planError;
        }

        setPlan(planData);

        // Fetch daily plans
        const { data: dailyPlansData, error: dailyPlansError } =
          await adminClient
            .from("coach_workout_daily_plan")
            .select("*")
            .eq("plan_id", planId)
            .order("day_number", { ascending: true });

        if (dailyPlansError) {
          throw dailyPlansError;
        }

        setDailyPlans(dailyPlansData || []);
      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError(err.message || "Failed to fetch data");
        showToast("error", "Error", err.message || "Failed to fetch data");
      } finally {
        setIsLoadingPlan(false);
        setIsLoadingDailyPlans(false);
      }
    };

    if (adminClient && isAdmin && planId) {
      fetchData();
    }
  }, [adminClient, isAdmin, planId]);

  // Click outside handler for reuse dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        reuseDropdownRef.current &&
        !reuseDropdownRef.current.contains(event.target as Node)
      ) {
        setShowReuseDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
    // Find the first available day number
    let nextDayNumber = 1;
    if (dailyPlans.length > 0) {
      const existingDayNumbers = new Set(dailyPlans.map((dp) => dp.day_number));
      // Find the first gap or use max + 1
      const maxDayNumber = Math.max(...dailyPlans.map((dp) => dp.day_number));
      for (let i = 1; i <= maxDayNumber; i++) {
        if (!existingDayNumbers.has(i)) {
          nextDayNumber = i;
          break;
        }
      }
      if (nextDayNumber === 1 && existingDayNumbers.has(1)) {
        nextDayNumber = maxDayNumber + 1;
      }
    }
    setFormData({
      day_number: nextDayNumber,
      number_of_exercises: 0,
      total_minutes: null,
      total_calories: null,
      daily_motivation: null,
      reminder: null,
      plan_goal: null,
    });
    setSelectedDailyPlanToReuse("");
    setShowReuseDropdown(false);
    setPreviewExercises([]);
    setEditingDailyPlan(null);
    setShowCreateDialog(true);
  };

  const handleSelectDailyPlanToReuse = async (dailyPlanId: string) => {
    setSelectedDailyPlanToReuse(dailyPlanId);
    if (dailyPlanId) {
      const selectedPlan = dailyPlans.find((dp) => dp.id === dailyPlanId);
      if (selectedPlan) {
        // Calculate next available day number
        let nextDayNumber = 1;
        if (dailyPlans.length > 0) {
          const existingDayNumbers = new Set(
            dailyPlans.map((dp) => dp.day_number)
          );
          const maxDayNumber = Math.max(
            ...dailyPlans.map((dp) => dp.day_number)
          );
          for (let i = 1; i <= maxDayNumber; i++) {
            if (!existingDayNumbers.has(i)) {
              nextDayNumber = i;
              break;
            }
          }
          if (nextDayNumber === 1 && existingDayNumbers.has(1)) {
            nextDayNumber = maxDayNumber + 1;
          }
        }
        setFormData({
          day_number: nextDayNumber,
          number_of_exercises: selectedPlan.number_of_exercises,
          total_minutes: selectedPlan.total_minutes,
          total_calories: selectedPlan.total_calories,
          daily_motivation: selectedPlan.daily_motivation,
          reminder: selectedPlan.reminder,
          plan_goal: selectedPlan.plan_goal,
        });

        // Fetch exercises for preview
        if (adminClient) {
          try {
            setIsLoadingPreviewExercises(true);
            const { data: exercisesData, error: exercisesError } =
              await adminClient
                .from("coach_workout_daily_plan_exercises")
                .select("exercise_id, section")
                .eq("daily_plan_id", dailyPlanId)
                .order("position", { ascending: true });

            if (exercisesError) {
              console.error("Error fetching exercises:", exercisesError);
              setPreviewExercises([]);
            } else if (exercisesData && exercisesData.length > 0) {
              // Fetch exercise details
              const exerciseIds = exercisesData.map((ex) => ex.exercise_id);
              const { data: detailsData, error: detailsError } =
                await adminClient
                  .from("coach_workout_plan_exercises_details")
                  .select("id, name")
                  .in("id", exerciseIds);

              if (detailsError) {
                console.error("Error fetching exercise details:", detailsError);
                setPreviewExercises([]);
              } else {
                // Create a map of exercise details
                const detailsMap = new Map();
                detailsData?.forEach((detail) => {
                  detailsMap.set(detail.id, detail.name);
                });

                // Combine exercises with their names
                const exercisesWithNames = exercisesData.map((exercise) => ({
                  name: detailsMap.get(exercise.exercise_id) || "Unknown",
                  section: exercise.section,
                }));

                setPreviewExercises(exercisesWithNames);
              }
            } else {
              setPreviewExercises([]);
            }
          } catch (err) {
            console.error("Error loading preview exercises:", err);
            setPreviewExercises([]);
          } finally {
            setIsLoadingPreviewExercises(false);
          }
        }
      }
    } else {
      // Reset to default if "None" is selected
      let nextDayNumber = 1;
      if (dailyPlans.length > 0) {
        const existingDayNumbers = new Set(
          dailyPlans.map((dp) => dp.day_number)
        );
        const maxDayNumber = Math.max(...dailyPlans.map((dp) => dp.day_number));
        for (let i = 1; i <= maxDayNumber; i++) {
          if (!existingDayNumbers.has(i)) {
            nextDayNumber = i;
            break;
          }
        }
        if (nextDayNumber === 1 && existingDayNumbers.has(1)) {
          nextDayNumber = maxDayNumber + 1;
        }
      }
      setFormData({
        day_number: nextDayNumber,
        number_of_exercises: 0,
        total_minutes: null,
        total_calories: null,
        daily_motivation: null,
        reminder: null,
        plan_goal: null,
      });
      setPreviewExercises([]);
    }
  };

  const handleEditClick = (dailyPlan: CoachWorkoutDailyPlan) => {
    setFormData({
      day_number: dailyPlan.day_number,
      number_of_exercises: dailyPlan.number_of_exercises,
      total_minutes: dailyPlan.total_minutes,
      total_calories: dailyPlan.total_calories,
      daily_motivation: dailyPlan.daily_motivation,
      reminder: dailyPlan.reminder,
      plan_goal: dailyPlan.plan_goal,
    });
    setSelectedDailyPlanToReuse("");
    setEditingDailyPlan(dailyPlan);
    setShowCreateDialog(true);
  };

  const handleDeleteClick = (dailyPlan: CoachWorkoutDailyPlan) => {
    setShowDeleteDialog({
      visible: true,
      dailyPlanId: dailyPlan.id,
      dayNumber: dailyPlan.day_number,
    });
  };

  const handleReuseClick = async (dailyPlan: CoachWorkoutDailyPlan) => {
    setShowReuseDialog({
      visible: true,
      dailyPlan,
    });

    // Fetch exercises for preview
    if (adminClient) {
      try {
        setIsLoadingReuseDialogExercises(true);
        const { data: exercisesData, error: exercisesError } = await adminClient
          .from("coach_workout_daily_plan_exercises")
          .select("exercise_id, section")
          .eq("daily_plan_id", dailyPlan.id)
          .order("position", { ascending: true });

        if (exercisesError) {
          console.error("Error fetching exercises:", exercisesError);
          setReuseDialogExercises([]);
        } else if (exercisesData && exercisesData.length > 0) {
          // Fetch exercise details
          const exerciseIds = exercisesData.map((ex) => ex.exercise_id);
          const { data: detailsData, error: detailsError } = await adminClient
            .from("coach_workout_plan_exercises_details")
            .select("id, name")
            .in("id", exerciseIds);

          if (detailsError) {
            console.error("Error fetching exercise details:", detailsError);
            setReuseDialogExercises([]);
          } else {
            // Create a map of exercise details
            const detailsMap = new Map();
            detailsData?.forEach((detail) => {
              detailsMap.set(detail.id, detail.name);
            });

            // Combine exercises with their names
            const exercisesWithNames = exercisesData.map((exercise) => ({
              name: detailsMap.get(exercise.exercise_id) || "Unknown",
              section: exercise.section,
            }));

            setReuseDialogExercises(exercisesWithNames);
          }
        } else {
          setReuseDialogExercises([]);
        }
      } catch (err) {
        console.error("Error loading exercises:", err);
        setReuseDialogExercises([]);
      } finally {
        setIsLoadingReuseDialogExercises(false);
      }
    }
  };

  const handleReuse = async () => {
    const sourceDailyPlan = showReuseDialog.dailyPlan;
    if (!adminClient || !planId || !sourceDailyPlan) {
      showToast("error", "Error", "Admin client or plan ID not available");
      return;
    }

    try {
      setIsReusing(true);

      // Calculate next available day number
      let nextDayNumber = 1;
      if (dailyPlans.length > 0) {
        const existingDayNumbers = new Set(
          dailyPlans.map((dp) => dp.day_number)
        );
        const maxDayNumber = Math.max(...dailyPlans.map((dp) => dp.day_number));
        for (let i = 1; i <= maxDayNumber; i++) {
          if (!existingDayNumbers.has(i)) {
            nextDayNumber = i;
            break;
          }
        }
        if (nextDayNumber === 1 && existingDayNumbers.has(1)) {
          nextDayNumber = maxDayNumber + 1;
        }
      }

      // Create new daily plan with copied data
      const { data: newDailyPlan, error: insertError } = await adminClient
        .from("coach_workout_daily_plan")
        .insert({
          plan_id: planId,
          day_number: nextDayNumber,
          number_of_exercises: sourceDailyPlan.number_of_exercises,
          total_minutes: sourceDailyPlan.total_minutes,
          total_calories: sourceDailyPlan.total_calories,
          daily_motivation: sourceDailyPlan.daily_motivation,
          reminder: sourceDailyPlan.reminder,
          plan_goal: sourceDailyPlan.plan_goal,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Fetch exercises from the source daily plan
      const { data: sourceExercises, error: exercisesError } = await adminClient
        .from("coach_workout_daily_plan_exercises")
        .select("*")
        .eq("daily_plan_id", sourceDailyPlan.id)
        .order("position", { ascending: true });

      if (exercisesError) {
        console.error("Error fetching source exercises:", exercisesError);
      }

      // Copy exercises to the new daily plan
      if (sourceExercises && sourceExercises.length > 0) {
        const exercisesToInsert = sourceExercises.map((exercise) => ({
          daily_plan_id: newDailyPlan.id,
          day_number: nextDayNumber,
          exercise_id: exercise.exercise_id,
          position: exercise.position,
          section: exercise.section,
          safety_tip: exercise.safety_tip,
          sets: exercise.sets,
          reps: exercise.reps,
          duration_seconds: exercise.duration_seconds,
          rest_seconds: exercise.rest_seconds,
          per_side: exercise.per_side,
        }));

        const { error: insertExercisesError } = await adminClient
          .from("coach_workout_daily_plan_exercises")
          .insert(exercisesToInsert);

        if (insertExercisesError) {
          console.error("Error copying exercises:", insertExercisesError);
          showToast(
            "error",
            "Warning",
            "Daily plan created but some exercises failed to copy"
          );
        }
      }

      // Refresh data
      const { data: dailyPlansData, error: dailyPlansError } = await adminClient
        .from("coach_workout_daily_plan")
        .select("*")
        .eq("plan_id", planId)
        .order("day_number", { ascending: true });

      if (dailyPlansError) {
        throw dailyPlansError;
      }

      setDailyPlans(dailyPlansData || []);

      // Close dialog
      setShowReuseDialog({
        visible: false,
        dailyPlan: null,
      });
      setReuseDialogExercises([]);

      // Show success toast
      requestAnimationFrame(() => {
        setTimeout(() => {
          showToast(
            "success",
            "Success",
            `Daily plan reused successfully as Day ${nextDayNumber}`
          );
        }, 500);
      });
    } catch (err: any) {
      console.error("Error reusing daily plan:", err);
      const errorMessage =
        err?.message ||
        err?.details ||
        err?.hint ||
        "Failed to reuse daily plan";

      setShowReuseDialog({
        visible: false,
        dailyPlan: null,
      });
      setReuseDialogExercises([]);

      requestAnimationFrame(() => {
        setTimeout(() => {
          showToast("error", "Error", errorMessage);
        }, 500);
      });
    } finally {
      setIsReusing(false);
    }
  };

  const handleSave = async () => {
    if (!adminClient || !planId) {
      showToast("error", "Error", "Admin client or plan ID not available");
      return;
    }

    if (!formData.day_number || formData.day_number < 1) {
      showToast("error", "Validation Error", "Day number must be at least 1");
      return;
    }

    // Check if day number already exists (when creating new)
    if (
      !editingDailyPlan &&
      dailyPlans.some((dp) => dp.day_number === formData.day_number)
    ) {
      showToast(
        "error",
        "Validation Error",
        "A daily plan with this day number already exists"
      );
      return;
    }

    // Check if day number already exists for another daily plan (when editing)
    if (
      editingDailyPlan &&
      dailyPlans.some(
        (dp) =>
          dp.day_number === formData.day_number && dp.id !== editingDailyPlan.id
      )
    ) {
      showToast(
        "error",
        "Validation Error",
        "A daily plan with this day number already exists"
      );
      return;
    }

    try {
      setIsSaving(true);

      if (editingDailyPlan) {
        // Update existing daily plan
        const { error: updateError } = await adminClient
          .from("coach_workout_daily_plan")
          .update({
            day_number: formData.day_number,
            number_of_exercises: formData.number_of_exercises,
            total_minutes: formData.total_minutes,
            total_calories: formData.total_calories,
            daily_motivation: formData.daily_motivation?.trim() || null,
            reminder: formData.reminder?.trim() || null,
            plan_goal: formData.plan_goal?.trim() || null,
          })
          .eq("id", editingDailyPlan.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new daily plan
        const { data: newDailyPlan, error: insertError } = await adminClient
          .from("coach_workout_daily_plan")
          .insert({
            plan_id: planId,
            day_number: formData.day_number,
            number_of_exercises: formData.number_of_exercises,
            total_minutes: formData.total_minutes,
            total_calories: formData.total_calories,
            daily_motivation: formData.daily_motivation?.trim() || null,
            reminder: formData.reminder?.trim() || null,
            plan_goal: formData.plan_goal?.trim() || null,
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        // If a daily plan was selected for reuse, copy its exercises
        if (selectedDailyPlanToReuse && newDailyPlan) {
          const sourceDailyPlan = dailyPlans.find(
            (dp) => dp.id === selectedDailyPlanToReuse
          );

          if (sourceDailyPlan) {
            // Fetch exercises from the source daily plan
            const { data: sourceExercises, error: exercisesError } =
              await adminClient
                .from("coach_workout_daily_plan_exercises")
                .select("*")
                .eq("daily_plan_id", sourceDailyPlan.id)
                .order("position", { ascending: true });

            if (exercisesError) {
              console.error("Error fetching source exercises:", exercisesError);
            }

            // Copy exercises to the new daily plan
            if (sourceExercises && sourceExercises.length > 0) {
              const exercisesToInsert = sourceExercises.map((exercise) => ({
                daily_plan_id: newDailyPlan.id,
                day_number: formData.day_number,
                exercise_id: exercise.exercise_id,
                position: exercise.position,
                section: exercise.section,
                safety_tip: exercise.safety_tip,
                sets: exercise.sets,
                reps: exercise.reps,
                duration_seconds: exercise.duration_seconds,
                rest_seconds: exercise.rest_seconds,
                per_side: exercise.per_side,
              }));

              const { error: insertExercisesError } = await adminClient
                .from("coach_workout_daily_plan_exercises")
                .insert(exercisesToInsert);

              if (insertExercisesError) {
                console.error("Error copying exercises:", insertExercisesError);
                showToast(
                  "error",
                  "Warning",
                  "Daily plan created but some exercises failed to copy"
                );
              }
            }
          }
        }
      }

      // Refresh data
      const { data: dailyPlansData, error: dailyPlansError } = await adminClient
        .from("coach_workout_daily_plan")
        .select("*")
        .eq("plan_id", planId)
        .order("day_number", { ascending: true });

      if (dailyPlansError) {
        throw dailyPlansError;
      }

      setDailyPlans(dailyPlansData || []);
      // Store editing state before closing dialog
      const wasEditing = !!editingDailyPlan;

      // Close dialog first
      setShowCreateDialog(false);
      setEditingDailyPlan(null);
      setSelectedDailyPlanToReuse("");
      setShowReuseDropdown(false);
      setPreviewExercises([]);

      // Show success toast after dialog closes fully
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (wasEditing) {
            showToast("success", "Success", "Daily plan updated successfully");
          } else {
            showToast("success", "Success", "Daily plan created successfully");
          }
        }, 500);
      });
    } catch (err: any) {
      console.error("Error saving daily plan:", err);
      const errorMessage =
        err?.message ||
        err?.details ||
        err?.hint ||
        "Failed to save daily plan";

      // Close dialog first if it's still open
      if (showCreateDialog) {
        setShowCreateDialog(false);
        setEditingDailyPlan(null);
        setSelectedDailyPlanToReuse("");
        setShowReuseDropdown(false);
        setPreviewExercises([]);

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
    if (!adminClient || !showDeleteDialog.dailyPlanId) {
      return;
    }

    try {
      setIsDeleting(true);

      const { error: deleteError } = await adminClient
        .from("coach_workout_daily_plan")
        .delete()
        .eq("id", showDeleteDialog.dailyPlanId);

      if (deleteError) {
        throw deleteError;
      }

      // Refresh data
      const { data: dailyPlansData, error: dailyPlansError } = await adminClient
        .from("coach_workout_daily_plan")
        .select("*")
        .eq("plan_id", planId)
        .order("day_number", { ascending: true });

      if (!dailyPlansError && dailyPlansData) {
        setDailyPlans(dailyPlansData);
      }

      // Close dialog first
      setShowDeleteDialog({
        visible: false,
        dailyPlanId: null,
        dayNumber: null,
      });

      // Show success toast after dialog closes fully
      requestAnimationFrame(() => {
        setTimeout(() => {
          showToast("success", "Success", "Daily plan deleted successfully");
        }, 500);
      });
    } catch (err: any) {
      console.error("Error deleting daily plan:", err);
      const errorMessage = formatConstraintError(err, "daily plan");

      // Close dialog first
      setShowDeleteDialog({
        visible: false,
        dailyPlanId: null,
        dayNumber: null,
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
        referencedEntity = "daily plan exercises";
      }

      return `Delete not allowed at this time, ${entityName} is associated with a ${referencedEntity}`;
    }

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
        {isLoading || isLoadingRole || isLoadingPlan || isLoadingDailyPlans ? (
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
              onClick={() => router.push("/admin/coach/workout/plans")}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
            >
                    <HiArrowLeft className="h-5 w-5" />
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
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
                  Daily Plans - {plan?.name || "Loading..."}
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  Manage daily plans for this coach workout plan
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

            {/* Daily Plans Table */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                        Day Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Plan Goal
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                        Number of Exercises
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                        Total Minutes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                        Total Calories
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Daily Motivation
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Reminder
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                        Add Exercises
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {dailyPlans.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-6 py-12 text-center text-slate-500"
                        >
                          No daily plans found. Create your first one!
                        </td>
                      </tr>
                    ) : (
                      dailyPlans.map((dailyPlan) => (
                        <tr key={dailyPlan.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 align-top">
                            Day {dailyPlan.day_number}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 align-top">
                            <div className="max-w-xs line-clamp-2">
                              {dailyPlan.plan_goal || "-"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 align-top">
                            {dailyPlan.number_of_exercises}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 align-top">
                            {dailyPlan.total_minutes
                              ? `${dailyPlan.total_minutes} min`
                              : "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 align-top">
                            {dailyPlan.total_calories
                              ? `${dailyPlan.total_calories} cal`
                              : "-"}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 align-top">
                            <div className="max-w-xs line-clamp-2">
                              {dailyPlan.daily_motivation || "-"}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 align-top">
                            <div className="max-w-xs line-clamp-2">
                              {dailyPlan.reminder || "-"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium align-top">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/admin/coach/workout/plans/${planId}/daily/${dailyPlan.id}/exercises`
                                )
                              }
                              className="px-3 py-1.5 bg-gradient-to-r from-[#00b3b3] to-[#009898] hover:from-[#00a1a1] hover:to-[#008787] text-white rounded-lg font-medium transition-all shadow-md text-sm flex items-center gap-1"
                              title="Add Exercises"
                            >
                              <HiPlus className="text-sm" />
                              Add
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium align-top">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleReuseClick(dailyPlan)}
                                className="text-blue-600 hover:text-blue-900 transition-colors"
                                title="Reuse Daily Plan"
                              >
                                <HiClipboardDocument className="text-lg" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditClick(dailyPlan)}
                                className="text-amber-600 hover:text-amber-900 transition-colors"
                                title="Edit"
                              >
                                <HiPencil className="text-lg" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(dailyPlan)}
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
            setEditingDailyPlan(null);
            setSelectedDailyPlanToReuse("");
            setShowReuseDropdown(false);
            setPreviewExercises([]);
          }
        }}
        dismissible={!isSaving}
        maxWidth="80vw"
      >
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            {editingDailyPlan ? "Edit Daily Plan" : "Add New Daily Plan"}
          </h3>
          {!editingDailyPlan && dailyPlans.length > 0 && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <HiClipboardDocument className="inline-block mr-2 text-amber-600" />
                Reuse from Existing Daily Plan (Optional)
              </label>
              <div className="relative" ref={reuseDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowReuseDropdown(!showReuseDropdown)}
                  disabled={isSaving}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl bg-white text-slate-700 font-medium shadow-sm hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:ring-offset-2 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 transition-all cursor-pointer text-left flex justify-between items-center"
                >
                  <span
                    className={
                      selectedDailyPlanToReuse
                        ? "text-slate-700"
                        : "text-slate-500"
                    }
                  >
                    {selectedDailyPlanToReuse
                      ? (() => {
                          const selectedPlan = dailyPlans.find(
                            (dp) => dp.id === selectedDailyPlanToReuse
                          );
                          return selectedPlan
                            ? `Day ${selectedPlan.day_number}${
                                selectedPlan.plan_goal
                                  ? ` - ${selectedPlan.plan_goal.substring(
                                      0,
                                      50
                                    )}${
                                      selectedPlan.plan_goal.length > 50
                                        ? "..."
                                        : ""
                                    }`
                                  : ""
                              }`
                            : "-- Create New Daily Plan --";
                        })()
                      : "-- Create New Daily Plan --"}
                  </span>
                  <span className="text-slate-400">▼</span>
                </button>
                {showReuseDropdown && (
                  <div className="absolute left-0 top-full mt-2 w-full bg-white border-2 border-slate-300 rounded-xl shadow-2xl z-[9999] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectDailyPlanToReuse("");
                        setShowReuseDropdown(false);
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100 first:rounded-t-xl"
                    >
                      -- Create New Daily Plan --
                    </button>
                    {dailyPlans.map((dp) => (
                      <button
                        key={dp.id}
                        type="button"
                        onClick={() => {
                          handleSelectDailyPlanToReuse(dp.id);
                          setShowReuseDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100 last:border-b-0 last:rounded-b-xl"
                      >
                        Day {dp.day_number}
                        {dp.plan_goal
                          ? ` - ${dp.plan_goal.substring(0, 50)}${
                              dp.plan_goal.length > 50 ? "..." : ""
                            }`
                          : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Select an existing daily plan to copy its data and exercises to
                a new day. The form will be pre-filled with the selected plan's
                information.
              </p>
              {/* Preview Exercises */}
              {selectedDailyPlanToReuse && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">
                    Connected Exercises ({previewExercises.length})
                  </h4>
                  {isLoadingPreviewExercises ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader size="sm" inline />
                      <span className="ml-2 text-sm text-slate-600">
                        Loading exercises...
                      </span>
                    </div>
                  ) : previewExercises.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                              Exercise Name
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                              Section
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {previewExercises.map((exercise, index) => (
                            <tr key={index} className="hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-900">
                                {exercise.name}
                              </td>
                              <td className="px-4 py-2 text-slate-600">
                                {exercise.section === "warmup"
                                  ? "Warm Up"
                                  : exercise.section === "main"
                                  ? "Main"
                                  : exercise.section === "cooldown"
                                  ? "Cool Down"
                                  : exercise.section}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-slate-500 text-center border border-slate-200 rounded-lg bg-white">
                      No exercises found for this daily plan.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="space-y-4">
            {/* Row: Day Number, Plan Goal */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Day Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.day_number}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      day_number: parseInt(e.target.value) || 1,
                    })
                  }
                  disabled={true}
                  readOnly
                  min="1"
                  className="w-full px-4 py-2 h-10 border border-slate-300 rounded-lg bg-gray-100 text-slate-600 cursor-not-allowed"
                  placeholder="Auto-generated"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Day number is automatically assigned
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Plan Goal
                </label>
                <textarea
                  value={formData.plan_goal || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      plan_goal: e.target.value || null,
                    })
                  }
                  disabled={isSaving}
                  rows={1}
                  className="w-full px-4 py-2 h-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100 resize-none overflow-hidden"
                  placeholder="Enter plan goal"
                />
              </div>
            </div>

            {/* Row: Number of Exercises, Total Minutes, Total Calories */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Number of Exercises
                </label>
                <input
                  type="number"
                  value={formData.number_of_exercises}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      number_of_exercises: parseInt(e.target.value) || 0,
                    })
                  }
                  disabled={isSaving}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                  placeholder="Enter number of exercises"
                />
              </div>
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
                  placeholder="Enter total minutes"
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
                  placeholder="Enter total calories"
                />
              </div>
            </div>

            {/* Row: Daily Motivation, Reminder */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Daily Motivation
                </label>
                <textarea
                  value={formData.daily_motivation || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      daily_motivation: e.target.value || null,
                    })
                  }
                  disabled={isSaving}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                  placeholder="Enter daily motivation"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Reminder
                </label>
                <textarea
                  value={formData.reminder || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reminder: e.target.value || null,
                    })
                  }
                  disabled={isSaving}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                  placeholder="Enter reminder"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingDailyPlan(null);
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
              ) : editingDailyPlan ? (
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
            dailyPlanId: null,
            dayNumber: null,
          })
        }
        dismissible={!isDeleting}
        maxWidth="80vw"
      >
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            Delete Daily Plan
          </h3>
          <p className="text-slate-700 mb-6">
            Are you sure you want to delete the daily plan for{" "}
            <span className="font-semibold">
              Day {showDeleteDialog.dayNumber}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setShowDeleteDialog({
                  visible: false,
                  dailyPlanId: null,
                  dayNumber: null,
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

      {/* Reuse Confirmation Dialog */}
      <Dialog
        visible={showReuseDialog.visible}
        onDismiss={() => {
          if (!isReusing) {
            setShowReuseDialog({
              visible: false,
              dailyPlan: null,
            });
            setReuseDialogExercises([]);
          }
        }}
        dismissible={!isReusing}
        maxWidth="80vw"
      >
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            Reuse Daily Plan
          </h3>
          <p className="text-slate-700 mb-4">
            Are you sure you want to reuse the daily plan for{" "}
            <span className="font-semibold">
              Day {showReuseDialog.dailyPlan?.day_number}
            </span>
            ? This will create a new daily plan with the next available day
            number and copy all exercises from this daily plan.
          </p>
          {/* Preview Exercises */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">
              Connected Exercises ({reuseDialogExercises.length})
            </h4>
            {isLoadingReuseDialogExercises ? (
              <div className="flex items-center justify-center py-4">
                <Loader size="sm" inline />
                <span className="ml-2 text-sm text-slate-600">
                  Loading exercises...
                </span>
              </div>
            ) : reuseDialogExercises.length > 0 ? (
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Exercise Name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Section
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {reuseDialogExercises.map((exercise, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-900">
                          {exercise.name}
                        </td>
                        <td className="px-4 py-2 text-slate-600">
                          {exercise.section === "warmup"
                            ? "Warm Up"
                            : exercise.section === "main"
                            ? "Main"
                            : exercise.section === "cooldown"
                            ? "Cool Down"
                            : exercise.section}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-sm text-slate-500 text-center border border-slate-200 rounded-lg bg-white">
                No exercises found for this daily plan.
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowReuseDialog({
                  visible: false,
                  dailyPlan: null,
                });
                setReuseDialogExercises([]);
              }}
              disabled={isReusing}
              className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReuse}
              disabled={isReusing}
              className="px-4 py-2 bg-gradient-to-r from-[#00b3b3] to-[#009898] hover:from-[#00a1a1] hover:to-[#008787] text-white rounded-lg font-medium transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {isReusing ? (
                <>
                  <Loader size="sm" inline />
                  Reusing...
                </>
              ) : (
                <>
                  <HiClipboardDocument className="text-lg" />
                  Reuse Daily Plan
                </>
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

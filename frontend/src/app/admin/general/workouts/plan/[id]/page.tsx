"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminSupabase } from "@/hooks/useAdminSupabase";
import Image from "next/image";
import Loader from "@/components/Loader";
import Toast, { ToastProps } from "@/components/Toast";
import {
  HiArrowLeft,
  HiPencil,
  HiXMark,
  HiCheck,
  HiPlus,
  HiTrash,
} from "react-icons/hi2";
import {
  WorkoutPlan,
  WorkoutTag,
  WorkoutPlanFull,
  WorkoutPlanExerciseWithDetails,
  WorkoutPlanExerciseDetails,
} from "@/types/Workout";
import Dialog from "@/components/Dialog";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

interface WorkoutPlanFormData {
  name: string;
  description: string | null;
  motivation: string | null;
  level: string;
  total_minutes: number | null;
  total_calories: number | null;
  is_free: boolean;
  image_path: string | null;
  image_alt: string | null;
  duration_days: number | null;
  tier_code: string | null;
  category: string | null;
  total_exercises: number | null;
}

export default function WorkoutPlanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const adminClient = useAdminSupabase();
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlanFull | null>(null);
  const [workoutTags, setWorkoutTags] = useState<WorkoutTag[]>([]);
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formData, setFormData] = useState<WorkoutPlanFormData>({
    name: "",
    description: null,
    motivation: null,
    level: "beginner",
    total_minutes: null,
    total_calories: null,
    is_free: true,
    image_path: null,
    image_alt: null,
    duration_days: null,
    tier_code: null,
    category: null,
    total_exercises: null,
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState<boolean>(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [showTierCodeDropdown, setShowTierCodeDropdown] =
    useState<boolean>(false);
  const tierCodeDropdownRef = useRef<HTMLDivElement>(null);
  const [availableExercises, setAvailableExercises] = useState<
    WorkoutPlanExerciseDetails[]
  >([]);
  const [editingExercise, setEditingExercise] =
    useState<WorkoutPlanExerciseWithDetails | null>(null);
  const [showExerciseDialog, setShowExerciseDialog] = useState<boolean>(false);
  const [isSavingExercise, setIsSavingExercise] = useState<boolean>(false);
  const [showSectionDropdown, setShowSectionDropdown] =
    useState<boolean>(false);
  const sectionDropdownRef = useRef<HTMLDivElement>(null);
  const [showExerciseDropdown, setShowExerciseDropdown] =
    useState<boolean>(false);
  const exerciseDropdownRef = useRef<HTMLDivElement>(null);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState<string>("");
  const [showDeleteExerciseDialog, setShowDeleteExerciseDialog] = useState<{
    visible: boolean;
    exercise: WorkoutPlanExerciseWithDetails | null;
  }>({ visible: false, exercise: null });
  const [isDeletingExercise, setIsDeletingExercise] = useState<boolean>(false);
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

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoadingRole && !isAdmin) {
      router.push("/");
    }
  }, [isAdmin, isLoadingRole, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!adminClient || !planId) {
        setIsLoadingPlan(false);
        return;
      }

      try {
        setIsLoadingPlan(true);
        setError(null);

        // Fetch workout plan
        const { data: planData, error: planError } = await adminClient
          .from("workout_plans")
          .select("*")
          .eq("id", planId)
          .single();

        if (planError) {
          throw planError;
        }

        if (!planData) {
          throw new Error("Workout plan not found");
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

        // Fetch available exercises
        const { data: exercisesDetailsData, error: exercisesDetailsError } =
          await adminClient
            .from("workout_plan_exercises_details")
            .select("*")
            .order("name", { ascending: true });

        if (exercisesDetailsError) {
          console.error(
            "Error fetching exercise details:",
            exercisesDetailsError
          );
        }

        setAvailableExercises(exercisesDetailsData || []);

        // Fetch tags for this plan
        const { data: planTagsData, error: planTagsError } = await adminClient
          .from("workout_plan_tags")
          .select("tag_id")
          .eq("plan_id", planId);

        if (planTagsError) {
          console.error("Error fetching plan tags:", planTagsError);
        }

        const tagIds = planTagsData?.map((pt) => pt.tag_id) || [];
        const tags = (tagsData || []).filter((tag) => tagIds.includes(tag.id));

        // Fetch exercises for this plan
        const { data: exercisesData, error: exercisesError } = await adminClient
          .from("workout_plan_exercises")
          .select("*")
          .eq("plan_id", planId)
          .order("position", { ascending: true });

        if (exercisesError) {
          console.error("Error fetching exercises:", exercisesError);
        }

        // Fetch exercise details if exercises exist
        let exercisesWithDetails: WorkoutPlanExerciseWithDetails[] = [];
        if (exercisesData && exercisesData.length > 0) {
          const exerciseIds = exercisesData.map((ex) => ex.exercise_id);
          const { data: detailsData, error: detailsError } = await adminClient
            .from("workout_plan_exercises_details")
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

        const planWithData: WorkoutPlanFull = {
          ...planData,
          tags,
          exercises: exercisesWithDetails,
        };

        setWorkoutPlan(planWithData);
        setFormData({
          name: planData.name,
          description: planData.description,
          motivation: planData.motivation,
          level: planData.level,
          total_minutes: planData.total_minutes,
          total_calories: planData.total_calories,
          is_free: planData.is_free,
          image_path: planData.image_path,
          image_alt: planData.image_alt,
          duration_days: planData.duration_days,
          tier_code: planData.tier_code,
          category: planData.category,
          total_exercises: planData.total_exercises,
        });
        setSelectedTags(tagIds);
      } catch (err: any) {
        console.error("Error fetching workout plan:", err);
        setError(err.message || "Failed to fetch workout plan");
        showToast(
          "error",
          "Error",
          err.message || "Failed to fetch workout plan"
        );
      } finally {
        setIsLoadingPlan(false);
      }
    };

    if (adminClient && isAdmin && planId) {
      fetchData();
    }
  }, [adminClient, isAdmin, planId]);

  // Click outside handler for tag dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(event.target as Node)
      ) {
        setShowTagDropdown(false);
      }
    };

    if (showTagDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showTagDropdown]);

  // Click outside handler for section dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sectionDropdownRef.current &&
        !sectionDropdownRef.current.contains(event.target as Node)
      ) {
        setShowSectionDropdown(false);
      }
    };

    if (showSectionDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSectionDropdown]);

  // Click outside handler for exercise dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exerciseDropdownRef.current &&
        !exerciseDropdownRef.current.contains(event.target as Node)
      ) {
        setShowExerciseDropdown(false);
        setExerciseSearchTerm("");
      }
    };

    if (showExerciseDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showExerciseDropdown]);

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

  // Auto-calculate position when section changes (only for new exercises)
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

  const handleEditClick = () => {
    if (workoutPlan) {
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    if (workoutPlan) {
      setFormData({
        name: workoutPlan.name,
        description: workoutPlan.description,
        motivation: workoutPlan.motivation,
        level: workoutPlan.level,
        total_minutes: workoutPlan.total_minutes,
        total_calories: workoutPlan.total_calories,
        is_free: workoutPlan.is_free,
        image_path: workoutPlan.image_path,
        image_alt: workoutPlan.image_alt,
        duration_days: workoutPlan.duration_days,
        tier_code: workoutPlan.tier_code,
        category: workoutPlan.category,
        total_exercises: workoutPlan.total_exercises,
      });
      const tagIds = workoutPlan.tags?.map((tag) => tag.id) || [];
      setSelectedTags(tagIds);
      setIsEditing(false);
    }
  };

  const handleSave = async () => {
    if (!adminClient || !planId) {
      showToast("error", "Error", "Admin client not available");
      return;
    }

    if (!formData.name.trim()) {
      showToast("error", "Validation Error", "Name is required");
      return;
    }

    try {
      setIsSaving(true);

      // Update plan
      const { data, error: updateError } = await adminClient
        .from("workout_plans")
        .update({
          name: formData.name.trim(),
          description: formData.description?.trim() || null,
          motivation: formData.motivation?.trim() || null,
          level: formData.level,
          total_minutes: formData.total_minutes || null,
          total_calories: formData.total_calories || null,
          is_free: formData.is_free,
          image_path: formData.image_path?.trim() || null,
          image_alt: formData.image_alt?.trim() || null,
          duration_days: formData.duration_days || null,
          tier_code: formData.tier_code?.trim() || null,
          category: formData.category?.trim() || null,
          total_exercises: formData.total_exercises || null,
        })
        .eq("id", planId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Handle tags
      // Delete existing tags for this plan
      await adminClient
        .from("workout_plan_tags")
        .delete()
        .eq("plan_id", planId);

      // Insert new tags
      if (selectedTags.length > 0) {
        const tagInserts = selectedTags.map((tagId) => ({
          plan_id: planId,
          tag_id: tagId,
        }));

        const { error: tagsError } = await adminClient
          .from("workout_plan_tags")
          .insert(tagInserts);

        if (tagsError) {
          console.error("Error saving tags:", tagsError);
          showToast("error", "Warning", "Plan saved but tags failed to update");
        }
      }

      // Refresh data
      const { data: planData, error: planError } = await adminClient
        .from("workout_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError) {
        throw planError;
      }

      // Fetch tags for this plan
      const { data: planTagsData } = await adminClient
        .from("workout_plan_tags")
        .select("tag_id")
        .eq("plan_id", planId);

      const tagIds = planTagsData?.map((pt) => pt.tag_id) || [];
      const tags = workoutTags.filter((tag) => tagIds.includes(tag.id));

      // Fetch exercises
      const { data: exercisesData } = await adminClient
        .from("workout_plan_exercises")
        .select("*")
        .eq("plan_id", planId)
        .order("position", { ascending: true });

      // Fetch exercise details if exercises exist
      let exercisesWithDetails: WorkoutPlanExerciseWithDetails[] = [];
      if (exercisesData && exercisesData.length > 0) {
        const exerciseIds = exercisesData.map((ex) => ex.exercise_id);
        const { data: detailsData } = await adminClient
          .from("workout_plan_exercises_details")
          .select("*")
          .in("id", exerciseIds);

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

      const planWithData: WorkoutPlanFull = {
        ...planData,
        tags,
        exercises: exercisesWithDetails,
      };

      setWorkoutPlan(planWithData);
      setIsEditing(false);

      // Show success toast after edit mode closes fully
      requestAnimationFrame(() => {
        setTimeout(() => {
          showToast("success", "Success", "Workout plan updated successfully");
        }, 500);
      });
    } catch (err: any) {
      console.error("Error saving workout plan:", err);
      showToast("error", "Error", err.message || "Failed to save workout plan");
    } finally {
      setIsSaving(false);
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

  const calculateNextPosition = (section: string): number => {
    if (!workoutPlan?.exercises || workoutPlan.exercises.length === 0) {
      // No existing exercises
      if (section === "warmup") return 1;
      if (section === "main") return 101;
      if (section === "cooldown") return 201;
      return 1;
    }

    // Filter exercises by section
    const sectionExercises = workoutPlan.exercises.filter(
      (ex) => ex.section === section
    );

    if (sectionExercises.length === 0) {
      // No exercises in this section yet
      if (section === "warmup") return 1;
      if (section === "main") return 101;
      if (section === "cooldown") return 201;
      return 1;
    }

    // Find the maximum position in this section
    const maxPosition = Math.max(...sectionExercises.map((ex) => ex.position));

    // Return next position
    return maxPosition + 1;
  };

  const handleAddExercise = () => {
    setExerciseFormData({
      exercise_id: "",
      position: 1, // Will be calculated when section is selected
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

  const handleEditExercise = (exercise: WorkoutPlanExerciseWithDetails) => {
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

  const handleDeleteExerciseClick = (
    exercise: WorkoutPlanExerciseWithDetails
  ) => {
    setShowDeleteExerciseDialog({ visible: true, exercise });
  };

  const handleDeleteExercise = async () => {
    const exercise = showDeleteExerciseDialog.exercise;
    if (!adminClient || !planId || !exercise) {
      showToast("error", "Error", "Admin client not available");
      return;
    }

    try {
      setIsDeletingExercise(true);
      const { error: deleteError } = await adminClient
        .from("workout_plan_exercises")
        .delete()
        .eq("plan_id", planId)
        .eq("exercise_id", exercise.exercise_id)
        .eq("position", exercise.position);

      if (deleteError) {
        throw deleteError;
      }

      // Close dialog first
      setShowDeleteExerciseDialog({ visible: false, exercise: null });

      // Show success toast after dialog closes
      setTimeout(() => {
        showToast("success", "Success", "Exercise deleted successfully");
      }, 300);

      // Refresh exercises
      const { data: exercisesData } = await adminClient
        .from("workout_plan_exercises")
        .select("*")
        .eq("plan_id", planId)
        .order("position", { ascending: true });

      if (exercisesData && exercisesData.length > 0) {
        const exerciseIds = exercisesData.map((ex) => ex.exercise_id);
        const { data: detailsData } = await adminClient
          .from("workout_plan_exercises_details")
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

        if (workoutPlan) {
          setWorkoutPlan({
            ...workoutPlan,
            exercises: exercisesWithDetails,
          });
        }
      } else {
        if (workoutPlan) {
          setWorkoutPlan({
            ...workoutPlan,
            exercises: [],
          });
        }
      }
    } catch (err: any) {
      console.error("Error deleting exercise:", err);
      const errorMessage =
        err?.message ||
        err?.details ||
        err?.hint ||
        "Failed to delete exercise";

      // Close dialog first
      setShowDeleteExerciseDialog({ visible: false, exercise: null });

      // Show error toast after dialog closes fully
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
    if (!adminClient || !planId) {
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
          .from("workout_plan_exercises")
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
          .eq("plan_id", planId)
          .eq("exercise_id", editingExercise.exercise_id)
          .eq("position", editingExercise.position);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new exercise
        const { error: insertError } = await adminClient
          .from("workout_plan_exercises")
          .insert({
            plan_id: planId,
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
        .from("workout_plan_exercises")
        .select("*")
        .eq("plan_id", planId)
        .order("position", { ascending: true });

      if (exercisesData && exercisesData.length > 0) {
        const exerciseIds = exercisesData.map((ex) => ex.exercise_id);
        const { data: detailsData } = await adminClient
          .from("workout_plan_exercises_details")
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

        if (workoutPlan) {
          setWorkoutPlan({
            ...workoutPlan,
            exercises: exercisesWithDetails,
          });
        }
      }

      // Store editing state before closing dialog
      const wasEditing = !!editingExercise;

      // Close dialog first
      setShowExerciseDialog(false);
      setEditingExercise(null);

      // Show success toast after dialog closes fully
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

      // Close dialog first if it's still open
      if (showExerciseDialog) {
        setShowExerciseDialog(false);
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
      setIsSavingExercise(false);
    }
  };

  if (isLoading || isLoadingRole || isLoadingPlan) {
    return (
      <div className="flex min-h-[calc(100vh-140px)] items-center justify-center">
        <Loader size="lg" text="Loading..." color="green" textColor="slate" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  if (!workoutPlan) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Workout Plan Not Found
          </h2>
          <p className="text-slate-600 mb-4">
            The workout plan you're looking for doesn't exist.
          </p>
          <button
            type="button"
            onClick={() => router.push("/admin/general/workouts")}
            className="px-4 py-2 bg-gradient-to-r from-[#00b3b3] to-[#009898] hover:from-[#00a1a1] hover:to-[#008787] text-white rounded-lg font-medium transition-all shadow-md"
          >
            Back to Workouts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page heading */}
        <div className="mb-6 sm:mb-8">
          <div className="mb-2">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => router.push("/admin/general/workouts")}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
              >
                <HiArrowLeft className="h-5 w-5" />
              </button>
              {!isEditing && (
                <button
                  type="button"
                  onClick={handleEditClick}
                  className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white rounded-lg font-medium transition-all shadow-md flex items-center gap-2"
                >
                  <HiPencil className="text-lg" />
                  Edit Plan
                </button>
              )}
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
              {isEditing ? "Edit Workout Plan" : workoutPlan.name}
            </h2>
            <p className="text-base sm:text-lg text-[#737373]">
              {isEditing
                ? "Update workout plan details"
                : "View and manage workout plan details"}
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

        {/* Content Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-8">
            {isEditing ? (
              /* Edit Form */
              <div className="space-y-6">
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
                    rows={4}
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
                    rows={3}
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
                    <select
                      value={formData.level}
                      onChange={(e) =>
                        setFormData({ ...formData, level: e.target.value })
                      }
                      disabled={isSaving}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Category
                    </label>
                    <input
                      type="text"
                      value={formData.category || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          category: e.target.value || null,
                        })
                      }
                      disabled={isSaving}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100"
                      placeholder="Enter category"
                    />
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
                      onClick={() => setShowTagDropdown(!showTagDropdown)}
                      disabled={isSaving}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-100 text-left flex justify-between items-center"
                    >
                      <span className="text-slate-600">
                        {selectedTags.length > 0
                          ? `${selectedTags.length} tag(s) selected`
                          : "Select tags"}
                      </span>
                      <span className="text-slate-400">Γû╝</span>
                    </button>
                    {showTagDropdown && (
                      <div className="absolute left-0 bottom-full mb-2 bg-white border border-slate-300 rounded-xl shadow-2xl z-[9999] min-w-full max-h-60 overflow-y-auto">
                        {workoutTags.length === 0 ? (
                          <div className="px-4 py-2 text-sm text-slate-500">
                            No tags available
                          </div>
                        ) : (
                          workoutTags.map((tag) => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleTag(tag.id)}
                              className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100 last:border-b-0 flex items-center justify-between"
                            >
                              <span>{tag.name}</span>
                              {selectedTags.includes(tag.id) && (
                                <span className="text-amber-600">Γ£ô</span>
                              )}
                            </button>
                          ))
                        )}
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

                {/* Row: Total Minutes, Total Calories, Duration Days */}
                <div className="grid grid-cols-3 gap-4">
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
                            formData.tier_code
                              ? "text-slate-700"
                              : "text-slate-500"
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
                        <span className="text-slate-400">Γû╝</span>
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

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
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
                    ) : (
                      <>
                        <HiCheck className="text-lg" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-4">
                      Basic Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Name
                        </label>
                        <p className="text-base text-slate-900 font-medium mt-1">
                          {workoutPlan.name}
                        </p>
                      </div>
                      {workoutPlan.description && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Description
                          </label>
                          <p className="text-base text-slate-700 mt-1">
                            {workoutPlan.description}
                          </p>
                        </div>
                      )}
                      {workoutPlan.motivation && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Motivation
                          </label>
                          <p className="text-base text-slate-700 mt-1">
                            {workoutPlan.motivation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-4">
                      Details
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Level
                        </label>
                        <p className="mt-1">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-md">
                            {workoutPlan.level}
                          </span>
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Category
                        </label>
                        <p className="text-base text-slate-700 mt-1">
                          {workoutPlan.category || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Status
                        </label>
                        <p className="mt-1">
                          {workoutPlan.is_free ? (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-md">
                              Free
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-800 rounded-md">
                              Paid
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {workoutPlan.tags && workoutPlan.tags.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {workoutPlan.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-md"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-4 pt-4 border-t border-slate-200">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Total Minutes
                    </label>
                    <p className="text-lg font-semibold text-slate-900">
                      {workoutPlan.total_minutes || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Total Calories
                    </label>
                    <p className="text-lg font-semibold text-slate-900">
                      {workoutPlan.total_calories || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Duration
                    </label>
                    <p className="text-lg font-semibold text-slate-900">
                      {workoutPlan.duration_days
                        ? `${workoutPlan.duration_days} days`
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Total Exercises
                    </label>
                    <p className="text-lg font-semibold text-slate-900">
                      {workoutPlan.total_exercises ||
                        workoutPlan.exercises?.length ||
                        0}
                    </p>
                  </div>
                </div>

                {/* Additional Info */}
                {(workoutPlan.tier_code || workoutPlan.image_path) && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                    {workoutPlan.tier_code && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          Tier Code
                        </label>
                        <p className="text-base text-slate-700">
                          {workoutPlan.tier_code}
                        </p>
                      </div>
                    )}
                    {workoutPlan.image_path && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          Image Path
                        </label>
                        <p className="text-base text-slate-700 break-all">
                          {workoutPlan.image_path}
                        </p>
                        {workoutPlan.image_alt && (
                          <p className="text-xs text-slate-500 mt-1">
                            Alt: {workoutPlan.image_alt}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Exercises Section */}
                <div className="pt-6 border-t border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-slate-700">
                      Exercises ({workoutPlan.exercises?.length || 0})
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddExercise}
                      className="px-4 py-2 bg-gradient-to-r from-[#00b3b3] to-[#009898] hover:from-[#00a1a1] hover:to-[#008787] text-white rounded-lg font-medium transition-all shadow-md flex items-center gap-2"
                    >
                      <HiPlus className="text-lg" />
                      Add Exercise
                    </button>
                  </div>
                  {workoutPlan.exercises && workoutPlan.exercises.length > 0 ? (
                    <div className="space-y-2">
                      {workoutPlan.exercises.map((exercise, index) => (
                        <div
                          key={`${exercise.plan_id}-${exercise.exercise_id}-${exercise.position}`}
                          className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-900">
                                Position {exercise.position} -{" "}
                                {exercise.section}
                              </p>
                              {exercise.exercise_details && (
                                <p className="text-xs text-slate-600 mt-1">
                                  {exercise.exercise_details.name}
                                </p>
                              )}
                              {exercise.safety_tip && (
                                <p className="text-xs text-amber-700 mt-1 italic">
                                  Safety: {exercise.safety_tip}
                                </p>
                              )}
                              <div className="flex gap-4 mt-2 text-xs text-slate-500">
                                {exercise.sets && (
                                  <span>Sets: {exercise.sets}</span>
                                )}
                                {exercise.reps && (
                                  <span>Reps: {exercise.reps}</span>
                                )}
                                {exercise.duration_seconds && (
                                  <span>
                                    Duration: {exercise.duration_seconds}s
                                  </span>
                                )}
                                <span>Rest: {exercise.rest_seconds}s</span>
                                {exercise.per_side && <span>Per Side</span>}
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                type="button"
                                onClick={() => handleEditExercise(exercise)}
                                className="text-amber-600 hover:text-amber-900 transition-colors"
                                title="Edit Exercise"
                              >
                                <HiPencil className="text-lg" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteExerciseClick(exercise)
                                }
                                className="text-red-600 hover:text-red-900 transition-colors"
                                title="Delete Exercise"
                              >
                                <HiTrash className="text-lg" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">
                      No exercises added yet. Click "Add Exercise" to get
                      started.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
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
            {/* Section and Position - Side by Side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Section */}
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
                    <span className="text-slate-400">Γû╝</span>
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
                          // Check if current exercise matches new section
                          const currentExercise = availableExercises.find(
                            (ex) => ex.id === exerciseFormData.exercise_id
                          );
                          const shouldClearExercise =
                            currentExercise &&
                            currentExercise.section !== newSection;
                          setExerciseFormData({
                            ...exerciseFormData,
                            section: newSection,
                            position: newPosition,
                            exercise_id: shouldClearExercise
                              ? ""
                              : exerciseFormData.exercise_id,
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
                          // Check if current exercise matches new section
                          const currentExercise = availableExercises.find(
                            (ex) => ex.id === exerciseFormData.exercise_id
                          );
                          const shouldClearExercise =
                            currentExercise &&
                            currentExercise.section !== newSection;
                          setExerciseFormData({
                            ...exerciseFormData,
                            section: newSection,
                            position: newPosition,
                            exercise_id: shouldClearExercise
                              ? ""
                              : exerciseFormData.exercise_id,
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
                          // Check if current exercise matches new section
                          const currentExercise = availableExercises.find(
                            (ex) => ex.id === exerciseFormData.exercise_id
                          );
                          const shouldClearExercise =
                            currentExercise &&
                            currentExercise.section !== newSection;
                          setExerciseFormData({
                            ...exerciseFormData,
                            section: newSection,
                            position: newPosition,
                            exercise_id: shouldClearExercise
                              ? ""
                              : exerciseFormData.exercise_id,
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

              {/* Position */}
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
                  disabled={
                    isSavingExercise ||
                    !!editingExercise ||
                    !exerciseFormData.section
                  }
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
                  <span className="text-slate-400">Γû╝</span>
                </button>
                {showExerciseDropdown && (
                  <div className="absolute left-0 top-full mt-2 w-full bg-white border-2 border-slate-300 rounded-xl shadow-2xl z-[9999] max-h-96 overflow-hidden flex flex-col">
                    {/* Search Input */}
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
                    {/* Exercise List */}
                    <div className="overflow-y-auto max-h-60">
                      {(() => {
                        // Filter exercises by selected section and search term
                        let filteredExercises = exerciseFormData.section
                          ? availableExercises.filter(
                              (exercise) =>
                                exercise.section === exerciseFormData.section
                            )
                          : availableExercises;

                        // Apply search filter
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

                        return filteredExercises.map((exercise, index) => (
                          <button
                            key={exercise.id}
                            type="button"
                            onClick={() => {
                              setExerciseFormData({
                                ...exerciseFormData,
                                exercise_id: exercise.id,
                                // Auto-fill safety tip from exercise's default_safety_tip
                                // Always fill when selecting a new exercise (user can edit it afterwards)
                                safety_tip: exercise.default_safety_tip || null,
                              });
                              setShowExerciseDropdown(false);
                              setExerciseSearchTerm("");
                            }}
                            className={`w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors border-b border-slate-100 ${
                              index === 0 ? "" : ""
                            } ${
                              index === filteredExercises.length - 1
                                ? "last:border-b-0"
                                : ""
                            }`}
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
                      router.push("/admin/general/workouts/exercises");
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

            {/* Row: Sets, Reps, Duration, Rest */}
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

      {/* Delete Exercise Confirmation Dialog */}
      <Dialog
        visible={showDeleteExerciseDialog.visible}
        onDismiss={() =>
          !isDeletingExercise &&
          setShowDeleteExerciseDialog({ visible: false, exercise: null })
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
            {showDeleteExerciseDialog.exercise?.exercise_details?.name && (
              <span className="font-semibold">
                &quot;{showDeleteExerciseDialog.exercise.exercise_details.name}
                &quot;
              </span>
            )}
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setShowDeleteExerciseDialog({ visible: false, exercise: null })
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

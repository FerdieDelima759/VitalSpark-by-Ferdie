"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState, useRef } from "react";
import Image from "next/image";
import { HiArrowLeft, HiPlus } from "react-icons/hi2";
import SelectBox from "@/components/SelectBox";
import Loader from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminSupabase } from "@/hooks/useAdminSupabase";
import { useCoachMealData } from "@/hooks/useCoachMealData";
import { useCoachWorkoutData } from "@/hooks/useCoachWorkoutData";
import Dialog from "@/components/Dialog";
import {
  CoachMealPlanFull,
  CoachMealItemWithDetails,
  CoachMealPlanDayFull,
} from "@/types/CoachMeal";
import { CoachWorkoutPlan } from "@/types/CoachWorkout";

interface WorkoutPlanMealPlansPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function WorkoutPlanMealPlansPage({
  params,
}: WorkoutPlanMealPlansPageProps) {
  const router = useRouter();
  const { id: workoutPlanId } = use(params);
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const adminClient = useAdminSupabase();
  const { fetchMealPlanFull, fetchMealPlans } = useCoachMealData();
  const { fetchCoachWorkoutPlanById } = useCoachWorkoutData();
  const hasCheckedAuth = useRef(false);
  const [workoutPlan, setWorkoutPlan] = useState<CoachWorkoutPlan | null>(null);
  const [mealPlans, setMealPlans] = useState<CoachMealPlanFull[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMealPlanDialog, setViewMealPlanDialog] = useState<{
    visible: boolean;
    mealPlan: CoachMealPlanFull | null;
  }>({ visible: false, mealPlan: null });
  const [attachDialogState, setAttachDialogState] = useState<{
    visible: boolean;
    selectedMealPlanId: string;
  }>({ visible: false, selectedMealPlanId: "" });
  const [isAttaching, setIsAttaching] = useState(false);
  const [allMealPlans, setAllMealPlans] = useState<CoachMealPlanFull[]>([]);

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
    const loadData = async () => {
      if (!adminClient || !workoutPlanId) {
        setIsLoadingData(false);
        return;
      }

      try {
        setIsLoadingData(true);
        setError(null);

        // Fetch workout plan
        const workoutPlanResult = await fetchCoachWorkoutPlanById(
          workoutPlanId
        );
        if (workoutPlanResult.success && workoutPlanResult.data) {
          setWorkoutPlan(workoutPlanResult.data);
        } else {
          setError("Workout plan not found");
          return;
        }

        // Fetch linked meal plans from coach_workout_meal_plan_link table
        const { data: linksData, error: linksError } = await adminClient
          .from("coach_workout_meal_plan_link")
          .select("*")
          .eq("plan_id", workoutPlanId);

        if (linksError) {
          console.error("Error fetching meal plan links:", linksError);
          setError("Failed to load meal plan links");
          setMealPlans([]);
          return;
        }

        // Fetch all meal plans for the attach dialog
        const allMealPlansResult = await fetchMealPlans();
        if (allMealPlansResult.success && allMealPlansResult.data) {
          // Fetch full details for all meal plans
          const allMealPlansData = await Promise.all(
            allMealPlansResult.data.map(async (plan) => {
              const mealPlanResult = await fetchMealPlanFull(plan.id);
              return mealPlanResult.success && mealPlanResult.data
                ? mealPlanResult.data
                : null;
            })
          );
          setAllMealPlans(
            allMealPlansData.filter(
              (plan) => plan !== null
            ) as CoachMealPlanFull[]
          );
        }

        if (linksData && linksData.length > 0) {
          // Fetch full details for each linked meal plan
          const mealPlansData = await Promise.all(
            linksData.map(async (link) => {
              const mealPlanResult = await fetchMealPlanFull(link.meal_plan_id);
              return mealPlanResult.success && mealPlanResult.data
                ? mealPlanResult.data
                : null;
            })
          );

          setMealPlans(
            mealPlansData.filter((plan) => plan !== null) as CoachMealPlanFull[]
          );
        } else {
          setMealPlans([]);
        }
      } catch (err: any) {
        console.error("Error loading data:", err);
        setError(err.message || "Failed to load data");
      } finally {
        setIsLoadingData(false);
      }
    };

    if (adminClient && isAdmin && workoutPlanId) {
      loadData();
    }
  }, [
    adminClient,
    isAdmin,
    workoutPlanId,
    fetchCoachWorkoutPlanById,
    fetchMealPlanFull,
    fetchMealPlans,
  ]);

  const formatCalories = (value: number | null | undefined) => {
    if (!value || Number.isNaN(value)) {
      return "—";
    }
    return new Intl.NumberFormat("en-US").format(value);
  };

  const formatTime = (value: string | null | undefined) => {
    if (!value) {
      return "Anytime";
    }
    try {
      return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "numeric",
      }).format(new Date(`1970-01-01T${value}`));
    } catch {
      return value;
    }
  };

  const renderMealItems = (items?: CoachMealItemWithDetails[]) => {
    if (!items || items.length === 0) {
      return (
        <p className="text-xs text-slate-500 mt-1">
          No specific food or recipe items listed.
        </p>
      );
    }

    return (
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-slate-100 bg-white px-2 py-1.5 text-xs text-slate-700"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {item.item_type === "recipe"
                  ? item.recipe?.name || "Recipe"
                  : item.food?.name || "Food"}
              </span>
              {item.quantity && (
                <span className="text-xs text-slate-500">
                  {item.quantity} {item.unit || ""}
                </span>
              )}
            </div>
            {item.notes && (
              <p className="mt-0.5 text-xs text-slate-500">{item.notes}</p>
            )}
          </li>
        ))}
      </ul>
    );
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
        {isLoading || isLoadingRole || isLoadingData ? (
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
                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                  >
                    <HiArrowLeft className="h-5 w-5" />
                  </button>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
                  {workoutPlan?.name || "Workout Plan"} - Meal Plans
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  View all meal plans attached to this workout plan
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Role: Admin</span>
                </div>
              </div>
              <div className="h-1 bg-[#f59e0b] rounded-full w-16 mt-1" />
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {workoutPlan && (
              <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  {workoutPlan.description && (
                    <p className="w-full text-slate-700">
                      {workoutPlan.description}
                    </p>
                  )}
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    Level: {workoutPlan.level}
                  </span>
                  {workoutPlan.category && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      Category: {workoutPlan.category}
                    </span>
                  )}
                  {workoutPlan.duration_days && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      Duration: {workoutPlan.duration_days} days
                    </span>
                  )}
                </div>
              </div>
            )}

            {mealPlans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-sm text-slate-500 mb-4">
                  No meal plans are attached to this workout plan yet.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setAttachDialogState({
                      visible: true,
                      selectedMealPlanId: "",
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-amber-500 hover:to-orange-600"
                >
                  <HiPlus className="h-4 w-4" />
                  Attach
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {mealPlans.map((mealPlan) => (
                  <div
                    key={mealPlan.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {mealPlan.name}
                        </h3>
                        {mealPlan.description && (
                          <p className="mt-1 text-sm text-slate-600">
                            {mealPlan.description}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          {mealPlan.goal && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                              {mealPlan.goal}
                            </span>
                          )}
                          {mealPlan.duration_days && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                              {mealPlan.duration_days} days
                            </span>
                          )}
                          {mealPlan.estimated_daily_calories && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                              {formatCalories(
                                mealPlan.estimated_daily_calories
                              )}{" "}
                              kcal/day
                            </span>
                          )}
                        </div>
                        {mealPlan.days && mealPlan.days.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-slate-500">
                              {mealPlan.days.length} day
                              {mealPlan.days.length !== 1 ? "s" : ""} scheduled
                            </p>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setViewMealPlanDialog({ visible: true, mealPlan })
                        }
                        className="ml-4 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                      >
                        View Plan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* View Meal Plan Dialog */}
        <Dialog
          visible={viewMealPlanDialog.visible}
          onDismiss={() =>
            setViewMealPlanDialog({ visible: false, mealPlan: null })
          }
          maxWidth={800}
          height="90vh"
        >
          {viewMealPlanDialog.mealPlan && (
            <div className="flex h-full flex-col overflow-hidden">
              <div className="flex-1 space-y-4 overflow-y-auto">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {viewMealPlanDialog.mealPlan.name}
                  </h3>
                  {viewMealPlanDialog.mealPlan.description && (
                    <p className="mt-1 text-sm text-slate-600">
                      {viewMealPlanDialog.mealPlan.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {viewMealPlanDialog.mealPlan.goal && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                      {viewMealPlanDialog.mealPlan.goal}
                    </span>
                  )}
                  {viewMealPlanDialog.mealPlan.duration_days && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                      {viewMealPlanDialog.mealPlan.duration_days} days
                    </span>
                  )}
                  {viewMealPlanDialog.mealPlan.estimated_daily_calories && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                      {formatCalories(
                        viewMealPlanDialog.mealPlan.estimated_daily_calories
                      )}{" "}
                      kcal/day
                    </span>
                  )}
                </div>

                {viewMealPlanDialog.mealPlan.days &&
                  viewMealPlanDialog.mealPlan.days.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-700">
                        Days ({viewMealPlanDialog.mealPlan.days.length})
                      </h4>
                      {viewMealPlanDialog.mealPlan.days.map(
                        (day: CoachMealPlanDayFull) => (
                          <div
                            key={day.id}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="mb-3">
                              <p className="text-sm font-semibold text-slate-900">
                                Day {day.day_number}
                                {day.label ? ` · ${day.label}` : ""}
                              </p>
                              {day.notes && (
                                <p className="text-xs text-slate-600 mt-1">
                                  {day.notes}
                                </p>
                              )}
                            </div>
                            {day.meals && day.meals.length > 0 ? (
                              <div className="space-y-2">
                                {day.meals.map((dayMeal) => (
                                  <div
                                    key={dayMeal.id}
                                    className="rounded-lg border border-slate-200 bg-white p-3"
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
                                          Meal {dayMeal.meal_number}
                                        </p>
                                        <h4 className="text-sm font-semibold text-slate-900 mt-0.5">
                                          {dayMeal.meal?.name ||
                                            "Untitled meal"}
                                        </h4>
                                        {dayMeal.meal?.goal && (
                                          <p className="text-xs text-slate-500 mt-0.5">
                                            {dayMeal.meal.goal}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 ml-2">
                                        {dayMeal.planned_time && (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                            {formatTime(dayMeal.planned_time)}
                                          </span>
                                        )}
                                        {dayMeal.variant_label && (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                            {dayMeal.variant_label}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {dayMeal.meal?.description && (
                                      <p className="text-xs text-slate-600 mb-2">
                                        {dayMeal.meal.description}
                                      </p>
                                    )}
                                    {renderMealItems(dayMeal.meal?.items)}
                                    {dayMeal.notes && (
                                      <p className="text-xs text-slate-500 mt-2 italic">
                                        Note: {dayMeal.notes}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic">
                                No meals scheduled for this day yet.
                              </p>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}
              </div>
              <div className="mt-auto flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() =>
                    setViewMealPlanDialog({ visible: false, mealPlan: null })
                  }
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </Dialog>

        {/* Attach Meal Plan Dialog */}
        <Dialog
          visible={attachDialogState.visible}
          onDismiss={() =>
            setAttachDialogState({ visible: false, selectedMealPlanId: "" })
          }
          maxWidth={560}
          height="75vh"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                !attachDialogState.selectedMealPlanId ||
                !workoutPlanId ||
                !adminClient
              ) {
                return;
              }

              try {
                setIsAttaching(true);
                setError(null);

                // Check if link already exists
                const { data: existingLink, error: checkError } =
                  await adminClient
                    .from("coach_workout_meal_plan_link")
                    .select("*")
                    .eq("plan_id", workoutPlanId)
                    .eq("meal_plan_id", attachDialogState.selectedMealPlanId)
                    .maybeSingle();

                if (checkError) {
                  throw new Error(
                    checkError.message || "Unable to check for existing link."
                  );
                }

                if (existingLink) {
                  setError(
                    "This meal plan is already linked to this workout plan."
                  );
                  return;
                }

                // Create the link
                const { error: insertError } = await adminClient
                  .from("coach_workout_meal_plan_link")
                  .insert({
                    plan_id: workoutPlanId,
                    meal_plan_id: attachDialogState.selectedMealPlanId,
                  });

                if (insertError) {
                  throw new Error(
                    insertError.message || "Unable to create link."
                  );
                }

                // Refresh data
                const { data: linksData } = await adminClient
                  .from("coach_workout_meal_plan_link")
                  .select("*")
                  .eq("plan_id", workoutPlanId);

                if (linksData && linksData.length > 0) {
                  const mealPlansData = await Promise.all(
                    linksData.map(async (link) => {
                      const mealPlanResult = await fetchMealPlanFull(
                        link.meal_plan_id
                      );
                      return mealPlanResult.success && mealPlanResult.data
                        ? mealPlanResult.data
                        : null;
                    })
                  );
                  setMealPlans(
                    mealPlansData.filter(
                      (plan) => plan !== null
                    ) as CoachMealPlanFull[]
                  );
                }

                setAttachDialogState({
                  visible: false,
                  selectedMealPlanId: "",
                });
              } catch (err: any) {
                setError(err.message || "Unable to attach meal plan.");
              } finally {
                setIsAttaching(false);
              }
            }}
            className="flex h-full flex-col overflow-hidden"
          >
            <div className="flex-1 space-y-4 overflow-y-auto">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Attach Meal Plan
                </h3>
                <p className="text-sm text-slate-500">
                  Link a meal plan to this workout plan. Users can then access
                  both plans together.
                </p>
              </div>
              <SelectBox
                label="Meal Plan"
                value={attachDialogState.selectedMealPlanId}
                onChange={(event) =>
                  setAttachDialogState((prev) => ({
                    ...prev,
                    selectedMealPlanId: event.target.value,
                  }))
                }
                isRequired
              >
                <option value="" disabled>
                  Select meal plan
                </option>
                {allMealPlans
                  .filter(
                    (plan) =>
                      !mealPlans.some(
                        (attachedPlan) => attachedPlan.id === plan.id
                      )
                  )
                  .map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
              </SelectBox>
              {attachDialogState.selectedMealPlanId && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {(() => {
                    const selectedPlan = allMealPlans.find(
                      (p) => p.id === attachDialogState.selectedMealPlanId
                    );
                    if (!selectedPlan) return null;
                    return (
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs font-semibold text-slate-600">
                            Name:
                          </span>
                          <p className="text-sm font-semibold text-slate-900">
                            {selectedPlan.name}
                          </p>
                        </div>
                        {selectedPlan.description && (
                          <div>
                            <span className="text-xs font-semibold text-slate-600">
                              Description:
                            </span>
                            <p className="text-sm text-slate-700">
                              {selectedPlan.description}
                            </p>
                          </div>
                        )}
                        {selectedPlan.goal && (
                          <div>
                            <span className="text-xs font-semibold text-slate-600">
                              Goal:
                            </span>
                            <p className="text-sm text-slate-700">
                              {selectedPlan.goal}
                            </p>
                          </div>
                        )}
                        {selectedPlan.duration_days && (
                          <div>
                            <span className="text-xs font-semibold text-slate-600">
                              Duration:
                            </span>
                            <p className="text-sm text-slate-700">
                              {selectedPlan.duration_days} days
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            <div className="mt-auto flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() =>
                  setAttachDialogState({
                    visible: false,
                    selectedMealPlanId: "",
                  })
                }
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                disabled={isAttaching}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-teal-600 hover:to-emerald-600 disabled:opacity-60"
                disabled={isAttaching || !attachDialogState.selectedMealPlanId}
              >
                {isAttaching ? "Attaching..." : "Attach"}
              </button>
            </div>
          </form>
        </Dialog>
      </main>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminSupabase } from "@/hooks/useAdminSupabase";
import Loader from "@/components/Loader";
import Dialog from "@/components/Dialog";
import Toast, { ToastProps } from "@/components/Toast";
import { HiArrowLeft, HiPencil, HiTrash, HiPlus } from "react-icons/hi2";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

export interface CoachInfo {
  id: string;
  full_name: string;
  title: string | null;
  tagline: string | null;
  about: string | null;
  specialties: string[] | null;
  profile_image_url: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

export interface CoachInfoFormData {
  full_name: string;
  title: string;
  tagline: string;
  about: string;
  specialties: string[];
  profile_image_url: string;
  is_active: boolean;
}

const defaultFormData: CoachInfoFormData = {
  full_name: "",
  title: "",
  tagline: "",
  about: "",
  specialties: [],
  profile_image_url: "",
  is_active: true,
};

export default function CoachesInfoPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const adminClient = useAdminSupabase();
  const [coaches, setCoaches] = useState<CoachInfo[]>([]);
  const [isLoadingCoaches, setIsLoadingCoaches] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const [editingCoach, setEditingCoach] = useState<CoachInfo | null>(null);
  const [showFormDialog, setShowFormDialog] = useState<boolean>(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<{
    visible: boolean;
    coachId: string | null;
    coachName: string | null;
    coachIds: string[] | null;
  }>({ visible: false, coachId: null, coachName: null, coachIds: null });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([]);
  const [formData, setFormData] = useState<CoachInfoFormData>(defaultFormData);
  const [specialtiesInput, setSpecialtiesInput] = useState<string>("");
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
    const fetchCoaches = async () => {
      if (!adminClient) {
        setIsLoadingCoaches(false);
        return;
      }
      try {
        setIsLoadingCoaches(true);
        setError(null);
        const { data, error: fetchError } = await adminClient
          .from("coaches_info")
          .select("*")
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;
        setCoaches(data || []);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch coaches";
        console.error("Error fetching coaches:", err);
        setError(message);
        showToast("error", "Error", message);
      } finally {
        setIsLoadingCoaches(false);
      }
    };

    if (adminClient && isAdmin) {
      fetchCoaches();
    }
  }, [adminClient, isAdmin]);

  const showToast = (
    type: "success" | "error",
    title: string,
    message: string,
  ) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleCreateClick = () => {
    setFormData(defaultFormData);
    setSpecialtiesInput("");
    setEditingCoach(null);
    setShowFormDialog(true);
  };

  const handleEditClick = (coach: CoachInfo) => {
    setFormData({
      full_name: coach.full_name,
      title: coach.title ?? "",
      tagline: coach.tagline ?? "",
      about: coach.about ?? "",
      specialties: coach.specialties ?? [],
      profile_image_url: coach.profile_image_url ?? "",
      is_active: coach.is_active ?? true,
    });
    setSpecialtiesInput((coach.specialties ?? []).join(", "));
    setEditingCoach(coach);
    setShowFormDialog(true);
  };

  const handleDeleteClick = (coachId: string, coachName: string) => {
    setShowDeleteDialog({ visible: true, coachId, coachName, coachIds: null });
  };

  const handleDeleteSelectedClick = () => {
    if (selectedCoaches.length === 0) return;
    const names = coaches
      .filter((c) => selectedCoaches.includes(c.id))
      .map((c) => c.full_name);
    setShowDeleteDialog({
      visible: true,
      coachId: null,
      coachName: names.length === 1 ? names[0] : null,
      coachIds: selectedCoaches,
    });
  };

  const toggleCoachSelection = (id: string) => {
    setSelectedCoaches((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedCoaches.length === coaches.length) {
      setSelectedCoaches([]);
    } else {
      setSelectedCoaches(coaches.map((c) => c.id));
    }
  };

  const handleSpecialtiesChange = (value: string) => {
    setSpecialtiesInput(value);
    const arr = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setFormData((prev) => ({ ...prev, specialties: arr }));
  };

  const handleSaveCoach = async () => {
    if (!adminClient) return;

    const fullName = formData.full_name.trim();
    if (!fullName) {
      showToast("error", "Validation Error", "Full name is required");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const payload = {
        full_name: fullName,
        title: formData.title.trim() || null,
        tagline: formData.tagline.trim() || null,
        about: formData.about.trim() || null,
        specialties:
          formData.specialties.length > 0 ? formData.specialties : null,
        profile_image_url: formData.profile_image_url.trim() || null,
        is_active: formData.is_active,
      };

      if (editingCoach) {
        const { error: updateError } = await adminClient
          .from("coaches_info")
          .update(payload)
          .eq("id", editingCoach.id);

        if (updateError) throw updateError;
        showToast("success", "Coach Updated", `${fullName} has been updated.`);
      } else {
        const { error: insertError } = await adminClient
          .from("coaches_info")
          .insert(payload);

        if (insertError) throw insertError;
        showToast("success", "Coach Created", `${fullName} has been added.`);
      }

      const { data, error: fetchError } = await adminClient
        .from("coaches_info")
        .select("*")
        .order("created_at", { ascending: false });

      if (!fetchError && data) setCoaches(data);
      setShowFormDialog(false);
      setEditingCoach(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save coach";
      console.error("Error saving coach:", err);
      setError(message);
      showToast("error", "Save Failed", message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!adminClient) return;

    const idsToDelete =
      showDeleteDialog.coachIds ||
      (showDeleteDialog.coachId ? [showDeleteDialog.coachId] : []);

    if (idsToDelete.length === 0) return;

    try {
      setIsDeleting(true);
      const { error: deleteError } = await adminClient
        .from("coaches_info")
        .delete()
        .in("id", idsToDelete);

      if (deleteError) throw deleteError;

      const count = idsToDelete.length;
      showToast(
        "success",
        "Coach Deleted",
        `${count} coach${count > 1 ? "es" : ""} deleted.`,
      );
      setSelectedCoaches([]);
      setCoaches((prev) => prev.filter((c) => !idsToDelete.includes(c.id)));
      setShowDeleteDialog({
        visible: false,
        coachId: null,
        coachName: null,
        coachIds: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      console.error("Error deleting coach:", err);
      setError(message);
      showToast("error", "Delete Failed", message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAuthenticated || !isAdmin) {
    if (!isLoading && !isLoadingRole) return null;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
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
                    Add Coach
                  </button>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
                  Coaches Info
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  Insert, update, and delete coach profiles and information
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

            {selectedCoaches.length > 0 && (
              <div className="mb-4 flex items-center gap-3">
                <button
                  onClick={handleDeleteSelectedClick}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-md flex items-center gap-2"
                >
                  <HiTrash className="text-lg" />
                  Delete Selected ({selectedCoaches.length})
                </button>
                <button
                  onClick={() => setSelectedCoaches([])}
                  className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            )}

            {isLoadingCoaches ? (
              <div className="flex justify-center items-center py-12">
                <Loader size="md" text="Loading coaches..." />
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 w-12">
                          <input
                            type="checkbox"
                            checked={
                              coaches.length > 0 &&
                              selectedCoaches.length === coaches.length
                            }
                            onChange={toggleSelectAll}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          />
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                          Coach
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                          Title
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                          Status
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                          Created
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {coaches.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-6 py-8 text-center text-slate-500"
                          >
                            No coaches found. Add one to get started.
                          </td>
                        </tr>
                      ) : (
                        coaches.map((coach) => (
                          <tr key={coach.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={selectedCoaches.includes(coach.id)}
                                onChange={() => toggleCoachSelection(coach.id)}
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                {coach.profile_image_url ? (
                                  <img
                                    src={coach.profile_image_url}
                                    alt=""
                                    className="h-10 w-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
                                    {coach.full_name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="font-medium text-slate-900">
                                  {coach.full_name}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {coach.title || "—"}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {coach.is_active ? (
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
                              {coach.created_at
                                ? new Date(
                                    coach.created_at,
                                  ).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => handleEditClick(coach)}
                                  className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors text-sm flex items-center gap-1"
                                >
                                  <HiPencil className="text-base" />
                                  Edit
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteClick(coach.id, coach.full_name)
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

      {/* Create/Edit Coach Dialog */}
      <Dialog
        visible={showFormDialog}
        onDismiss={() => !isSaving && setShowFormDialog(false)}
        dismissible={!isSaving}
        maxWidth={600}
        maxHeight="90vh"
      >
        <div className="flex flex-col min-h-0">
          <h3 className="text-2xl font-bold text-slate-900 mb-4 shrink-0">
            {editingCoach ? "Edit Coach" : "Add Coach"}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                disabled={isSaving}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                placeholder="e.g. Jane Smith"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                disabled={isSaving}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                placeholder="e.g. Head Coach"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Tagline
              </label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) =>
                  setFormData({ ...formData, tagline: e.target.value })
                }
                disabled={isSaving}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                placeholder="Short one-liner"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                About
              </label>
              <textarea
                value={formData.about}
                onChange={(e) =>
                  setFormData({ ...formData, about: e.target.value })
                }
                disabled={isSaving}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                placeholder="Bio or description"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Specialties
              </label>
              <input
                type="text"
                value={specialtiesInput}
                onChange={(e) => handleSpecialtiesChange(e.target.value)}
                disabled={isSaving}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                placeholder="Strength, Nutrition, Recovery (comma-separated)"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Profile image URL
              </label>
              <input
                type="url"
                value={formData.profile_image_url}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    profile_image_url: e.target.value,
                  })
                }
                disabled={isSaving}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="coach_is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                disabled={isSaving}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <label
                htmlFor="coach_is_active"
                className="ml-2 text-sm font-medium text-slate-700"
              >
                Active
              </label>
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <button
              onClick={() => setShowFormDialog(false)}
              disabled={isSaving}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCoach}
              disabled={isSaving}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-80 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader size="sm" inline />
                  <span>Saving...</span>
                </>
              ) : editingCoach ? (
                "Update"
              ) : (
                "Create"
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        visible={showDeleteDialog.visible}
        onDismiss={() =>
          !isDeleting &&
          setShowDeleteDialog({
            visible: false,
            coachId: null,
            coachName: null,
            coachIds: null,
          })
        }
        dismissible={!isDeleting}
        maxWidth={400}
      >
        <div className="text-center p-6">
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            Delete Coach
            {showDeleteDialog.coachIds && showDeleteDialog.coachIds.length > 1
              ? "es"
              : ""}
          </h3>
          <p className="text-slate-600 mb-6">
            {showDeleteDialog.coachIds &&
            showDeleteDialog.coachIds.length > 1 ? (
              <>
                Are you sure you want to delete{" "}
                {showDeleteDialog.coachIds.length} coaches?
                <br />
                <span className="text-sm text-red-600 mt-2 block">
                  This action cannot be undone.
                </span>
              </>
            ) : (
              <>
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-900">
                  {showDeleteDialog.coachName}
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
                  coachId: null,
                  coachName: null,
                  coachIds: null,
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

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminSupabase } from "@/hooks/useAdminSupabase";
import Loader from "@/components/Loader";
import Dialog from "@/components/Dialog";
import Toast, { ToastProps } from "@/components/Toast";
import { User } from "@supabase/supabase-js";
import { HiArrowLeft, HiPencil } from "react-icons/hi2";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

interface UserWithRole {
  id: string;
  email: string;
  authRole: string | null;
  userRole: string | null;
  plan_code: string | null;
  created_at: string;
}

export default function UsersManagementPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user: currentUser } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useUserRole();
  const adminClient = useAdminSupabase();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    visible: boolean;
    userId: string | null;
    userEmail: string | null;
    userIds: string[] | null;
  }>({ visible: false, userId: null, userEmail: null, userIds: null });
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [editingRole, setEditingRole] = useState<{
    userId: string | null;
    showDropdown: boolean;
  }>({ userId: null, showDropdown: false });
  const [isUpdatingRole, setIsUpdatingRole] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
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
    const fetchUsers = async () => {
      if (!adminClient) {
        setIsLoadingUsers(false);
        return;
      }

      try {
        setIsLoadingUsers(true);
        setError(null);

        // Fetch users from auth using admin client
        const { data: authUsers, error: authError } =
          await adminClient.auth.admin.listUsers();

        if (authError) {
          throw authError;
        }

        if (!authUsers?.users) {
          setUsers([]);
          return;
        }

        // Fetch all roles from user_role table
        const { data: userRoles, error: rolesError } = await adminClient
          .from("user_role")
          .select("*");

        if (rolesError) {
          console.error("Error fetching user roles:", rolesError);
        }

        // Fetch all user profiles to get plan_code
        const { data: userProfiles, error: profilesError } = await adminClient
          .from("user_profile")
          .select("user_id, plan_code");

        if (profilesError) {
          console.error("Error fetching user profiles:", profilesError);
        }

        // Create a map of user_id to role
        const roleMap = new Map<string, string>();
        userRoles?.forEach((ur) => {
          roleMap.set(ur.user_id, ur.role);
        });

        // Create a map of user_id to plan_code
        const planCodeMap = new Map<string, string>();
        userProfiles?.forEach((profile) => {
          if (profile.plan_code) {
            planCodeMap.set(profile.user_id, profile.plan_code);
          }
        });

        // Combine auth users with their roles and plan_code
        const usersWithRoles: UserWithRole[] = authUsers.users.map(
          (authUser: User) => ({
            id: authUser.id,
            email: authUser.email || "No email",
            authRole: authUser.role || null,
            userRole: roleMap.get(authUser.id) || null,
            plan_code: planCodeMap.get(authUser.id) || null,
            created_at: authUser.created_at,
          })
        );

        setUsers(usersWithRoles);
      } catch (err: any) {
        console.error("Error fetching users:", err);
        setError(err.message || "Failed to fetch users");
      } finally {
        setIsLoadingUsers(false);
      }
    };

    if (adminClient && isAdmin) {
      fetchUsers();
    }
  }, [adminClient, isAdmin]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingRole.showDropdown) {
        const target = event.target as HTMLElement;
        if (!target.closest(".role-dropdown-container")) {
          setEditingRole({ userId: null, showDropdown: false });
        }
      }
    };

    if (editingRole.showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [editingRole.showDropdown]);

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

  const handleDeleteClick = (userId: string, userEmail: string) => {
    setDeleteDialog({ visible: true, userId, userEmail, userIds: null });
  };

  const handleDeleteSelectedClick = () => {
    if (selectedUsers.length === 0) return;
    const selectedEmails = users
      .filter((u) => selectedUsers.includes(u.id))
      .map((u) => u.email);
    setDeleteDialog({
      visible: true,
      userId: null,
      userEmail: selectedEmails.length === 1 ? selectedEmails[0] : null,
      userIds: selectedUsers,
    });
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map((u) => u.id));
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
        referencedEntity = "other records";
      }

      return `Delete not allowed at this time, ${entityName} is associated with a ${referencedEntity}`;
    }

    return errorMessage || `Failed to delete ${entityName}`;
  };

  const handleDeleteConfirm = async () => {
    if (!adminClient) {
      return;
    }

    const userIdsToDelete =
      deleteDialog.userIds ||
      (deleteDialog.userId ? [deleteDialog.userId] : []);

    if (userIdsToDelete.length === 0) {
      return;
    }

    try {
      setIsDeleting(true);

      // Delete from auth.users using admin client
      for (const userId of userIdsToDelete) {
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(
          userId
        );

        if (deleteError) {
          throw deleteError;
        }

        // Also delete from user_role table if exists
        await adminClient.from("user_role").delete().eq("user_id", userId);
      }

      // Clear selections
      setSelectedUsers([]);

      // Refresh users list
      setUsers(users.filter((u) => !userIdsToDelete.includes(u.id)));
      const count = userIdsToDelete.length;
      setDeleteDialog({
        visible: false,
        userId: null,
        userEmail: null,
        userIds: null,
      });
      showToast(
        "success",
        "User Deleted",
        `${count} user${count > 1 ? "s" : ""} deleted successfully.`
      );
    } catch (err: any) {
      console.error("Error deleting user:", err);
      const errorMessage = formatConstraintError(err, "user");
      setError(errorMessage);
      showToast("error", "Delete Failed", errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    if (!adminClient) {
      return;
    }

    const normalizedRole = role.toLowerCase();
    if (normalizedRole !== "admin" && normalizedRole !== "member") {
      showToast("error", "Update Failed", "Invalid role selected.");
      return;
    }

    try {
      setIsUpdatingRole(true);
      setError(null);

      // Upsert role to user_role table
      const { error: upsertError } = await adminClient.from("user_role").upsert(
        {
          user_id: userId,
          role: normalizedRole,
        },
        {
          onConflict: "user_id",
        }
      );

      if (upsertError) {
        throw upsertError;
      }

      // Update local state
      setUsers(
        users.map((u) =>
          u.id === userId ? { ...u, userRole: normalizedRole } : u
        )
      );

      // Close dropdown
      setEditingRole({ userId: null, showDropdown: false });

      // Show success toast
      const userEmail = users.find((u) => u.id === userId)?.email || "user";
      showToast(
        "success",
        "Role Updated",
        `User role has been updated to ${normalizedRole} for ${userEmail}.`
      );
    } catch (err: any) {
      console.error("Error updating role:", err);
      const errorMessage = err.message || "Failed to update role";
      setError(errorMessage);
      showToast("error", "Update Failed", errorMessage);
    } finally {
      setIsUpdatingRole(false);
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
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => router.push("/admin")}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                  >
                    <HiArrowLeft className="h-5 w-5" />
                  </button>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f766e] mb-1">
                  Users
                </h2>
                <p className="text-base sm:text-lg text-[#737373]">
                  Manage user accounts and their roles
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
            {selectedUsers.length > 0 && (
              <div className="mb-4 flex items-center gap-3">
                <button
                  onClick={handleDeleteSelectedClick}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-md flex items-center gap-2"
                >
                  Delete Selected ({selectedUsers.length})
                </button>
                <button
                  onClick={() => setSelectedUsers([])}
                  className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            )}

            {isLoadingUsers ? (
              <div className="flex justify-center items-center py-12">
                <Loader size="md" text="Loading users..." />
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
                              users.length > 0 &&
                              selectedUsers.length === users.length
                            }
                            onChange={toggleSelectAll}
                            className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                          />
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                          Email
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                          Auth Role
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                          User Role
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                          Created At
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                          Plan Code
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {users.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-6 py-8 text-center text-slate-500"
                          >
                            No users found
                          </td>
                        </tr>
                      ) : (
                        users.map((user) => (
                          <tr key={user.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={selectedUsers.includes(user.id)}
                                onChange={() => toggleUserSelection(user.id)}
                                disabled={user.id === currentUser?.id}
                                className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500 disabled:opacity-50"
                              />
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-900">
                              {user.email}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {user.authRole || (
                                <span className="text-slate-400 italic">
                                  No role
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              <div className="relative inline-flex items-center gap-2 role-dropdown-container">
                                {user.userRole ? (
                                  <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-md font-medium">
                                    {user.userRole}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">
                                    No role
                                  </span>
                                )}
                                <button
                                  onClick={() =>
                                    setEditingRole({
                                      userId: user.id,
                                      showDropdown:
                                        editingRole.userId === user.id
                                          ? !editingRole.showDropdown
                                          : true,
                                    })
                                  }
                                  disabled={isUpdatingRole}
                                  className="flex items-center gap-2 px-3 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md font-medium transition-colors disabled:opacity-50"
                                >
                                  <HiPencil className="text-base" />
                                  Update
                                </button>
                                {editingRole.userId === user.id &&
                                  editingRole.showDropdown && (
                                    <div className="absolute left-0 top-full mt-2 bg-white border border-slate-300 rounded-xl shadow-2xl z-[9999] min-w-[140px] overflow-hidden">
                                      <button
                                        onClick={() =>
                                          handleUpdateRole(user.id, "member")
                                        }
                                        disabled={isUpdatingRole}
                                        className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-b border-slate-100"
                                      >
                                        Member
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleUpdateRole(user.id, "admin")
                                        }
                                        disabled={isUpdatingRole}
                                        className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                      >
                                        Admin
                                      </button>
                                    </div>
                                  )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {new Date(user.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {user.plan_code ? (
                                <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded-md font-medium">
                                  {user.plan_code}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">
                                  No plan
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() =>
                                  handleDeleteClick(user.id, user.email)
                                }
                                disabled={user.id === currentUser?.id}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
                                title={
                                  user.id === currentUser?.id
                                    ? "Cannot delete your own account"
                                    : "Delete user"
                                }
                              >
                                Delete
                              </button>
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        visible={deleteDialog.visible}
        onDismiss={() =>
          !isDeleting &&
          setDeleteDialog({
            visible: false,
            userId: null,
            userEmail: null,
            userIds: null,
          })
        }
        dismissible={!isDeleting}
        maxWidth={400}
      >
        <div className="text-center">
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            Delete User
            {deleteDialog.userIds && deleteDialog.userIds.length > 1 ? "s" : ""}
          </h3>
          <p className="text-slate-600 mb-6">
            {deleteDialog.userIds && deleteDialog.userIds.length > 1 ? (
              <>
                Are you sure you want to delete {deleteDialog.userIds.length}{" "}
                users?
                <br />
                <span className="text-sm text-red-600 mt-2 block">
                  This action cannot be undone.
                </span>
              </>
            ) : (
              <>
                Are you sure you want to delete user{" "}
                <span className="font-semibold text-slate-900">
                  {deleteDialog.userEmail}
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
                setDeleteDialog({
                  visible: false,
                  userId: null,
                  userEmail: null,
                  userIds: null,
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

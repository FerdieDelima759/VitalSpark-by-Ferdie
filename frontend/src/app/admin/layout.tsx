"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminFromStorage, getUserSessionData } from "@/utils/sessionStorage";
import BottomNavBar from "@/components/BottomNavBar";
import Loader from "@/components/Loader";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  // Read from session storage directly to avoid API calls on every navigation
  const [isAdmin, setIsAdmin] = useState(() => isAdminFromStorage());

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    // Check session storage for admin status
    const sessionData = getUserSessionData();
    const adminStatus = sessionData.isAdmin;
    setIsAdmin(adminStatus);

    if (!adminStatus) {
      router.push("/");
      return;
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <Loader size="lg" text="Loading..." textColor="slate" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <main className="flex-1 pb-[70px]">{children}</main>
      <BottomNavBar />
    </div>
  );
}

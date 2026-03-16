"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Toast, { ToastProps } from "@/components/Toast";
import Image from "next/image";
import { useScale } from "@/hooks/useScale";
import { HiArrowRightOnRectangle, HiCheckCircle } from "react-icons/hi2";
import Loader from "@/components/Loader";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

export default function LogoutPage() {
  const router = useRouter();
  const { scale } = useScale();
  const { signOut, isAuthenticated, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const hasLoggedOut = useRef(false);
  const redirectTimeoutRef = useRef<number | null>(null);
  const fallbackRedirectTimeoutRef = useRef<number | null>(null);

  const clearRedirectTimers = useCallback(() => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
    if (fallbackRedirectTimeoutRef.current) {
      clearTimeout(fallbackRedirectTimeoutRef.current);
      fallbackRedirectTimeoutRef.current = null;
    }
  }, []);

  const redirectToLogin = useCallback(
    (reason?: string) => {
      const target = reason
        ? `/auth/login?reason=${encodeURIComponent(reason)}`
        : "/auth/login";

      clearRedirectTimers();
      router.replace(target);

      // Fallback hard redirect for production edge cases where client routing stalls.
      if (typeof window !== "undefined") {
        fallbackRedirectTimeoutRef.current = window.setTimeout(() => {
          if (window.location.pathname !== "/auth/login") {
            window.location.replace(target);
          }
        }, 700);
      }
    },
    [clearRedirectTimers, router],
  );

  useEffect(() => {
    return () => {
      clearRedirectTimers();
    };
  }, [clearRedirectTimers]);

  useEffect(() => {
    // If not authenticated, redirect to login
    if (!authLoading && !isAuthenticated) {
      redirectToLogin();
    }
  }, [isAuthenticated, authLoading, redirectToLogin]);

  const showToast = (
    type: "success" | "error",
    title: string,
    message: string,
  ) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const handleLogout = async () => {
    if (hasLoggedOut.current) return;

    setLoading(true);
    setIsLoggingOut(true);
    hasLoggedOut.current = true;

    try {
      await signOut();
      showToast(
        "success",
        "Logged Out",
        "You have been successfully logged out.",
      );

      // Redirect to login after a short delay
      redirectTimeoutRef.current = window.setTimeout(() => {
        redirectToLogin("logged-out");
      }, 1500);
    } catch (error: unknown) {
      hasLoggedOut.current = false;
      setIsLoggingOut(false);
      showToast(
        "error",
        "Logout Failed",
        (error instanceof Error ? error.message : null) ||
          "An error occurred while logging out. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#00b3b3] via-[#009898] to-[#002f2f]">
        <Loader size="lg" text="Loading..." textColor="white" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#00b3b3] via-[#009898] to-[#002f2f]">
        <Loader size="lg" text="Redirecting to login..." textColor="white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#00b3b3] via-[#009898] to-[#002f2f]">
      {/* Logo Section */}
      <div
        className="w-full flex justify-center items-center"
        style={{ paddingTop: 20 * scale, paddingBottom: 40 * scale }}
      >
        <Image
          src="/images/Logo_VitalSpark_Vertical.png"
          alt="VitalSpark Logo"
          width={160 * scale}
          height={160 * scale}
          priority
          className="object-contain"
          style={{ width: 160 * scale, height: 160 * scale }}
        />
      </div>

      {/* Form Section */}
      <div
        className="flex-1 bg-white mt-auto"
        style={{
          borderTopLeftRadius: 24 * scale,
          borderTopRightRadius: 24 * scale,
        }}
      >
        <div
          className="max-w-[600px] mx-auto"
          style={{
            paddingLeft: 20 * scale,
            paddingRight: 20 * scale,
            paddingTop: 32 * scale,
            paddingBottom: 30 * scale,
          }}
        >
          {isLoggingOut ? (
            <>
              {/* Success State */}
              <div className="text-center">
                <div
                  className="flex justify-center mb-6"
                  style={{ marginTop: 20 * scale }}
                >
                  <div
                    className="bg-green-100 rounded-full p-4"
                    style={{
                      width: 80 * scale,
                      height: 80 * scale,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <HiCheckCircle
                      className="text-green-600"
                      style={{ fontSize: 48 * scale }}
                    />
                  </div>
                </div>
                <h1
                  className="font-extrabold text-slate-900 text-center"
                  style={{
                    fontSize: 36 * scale,
                    marginBottom: 8 * scale,
                  }}
                >
                  Logging Out...
                </h1>
                <p
                  className="text-slate-500 text-center"
                  style={{
                    fontSize: 16 * scale,
                    marginTop: 8 * scale,
                    marginBottom: 32 * scale,
                  }}
                >
                  You are being logged out. Redirecting to login...
                </p>
                <div className="flex justify-center">
                  <Loader size="md" text="Please wait..." textColor="slate" />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Logout Confirmation */}
              <div className="text-center mb-8">
                <div
                  className="flex justify-center mb-6"
                  style={{ marginTop: 20 * scale }}
                >
                  <div
                    className="bg-amber-100 rounded-full p-4"
                    style={{
                      width: 80 * scale,
                      height: 80 * scale,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <HiArrowRightOnRectangle
                      className="text-amber-600"
                      style={{ fontSize: 48 * scale }}
                    />
                  </div>
                </div>
                <h1
                  className="font-extrabold text-amber-500 text-center"
                  style={{
                    fontSize: 36 * scale,
                    marginBottom: 8 * scale,
                  }}
                >
                  Log Out
                </h1>
                <p
                  className="text-slate-500 text-center"
                  style={{
                    fontSize: 16 * scale,
                    marginTop: 8 * scale,
                    marginBottom: 32 * scale,
                  }}
                >
                  Are you sure you want to log out? You&apos;ll need to sign in
                  again
                  to access your account.
                </p>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold rounded-2xl mb-4 disabled:opacity-80 flex items-center justify-center gap-2"
                style={{
                  height: 52 * scale,
                  fontSize: 18 * scale,
                }}
              >
                {loading ? (
                  <>
                    <Loader size="sm" inline />
                    <span>Logging Out...</span>
                  </>
                ) : (
                  <>
                    <HiArrowRightOnRectangle style={{ fontSize: 20 * scale }} />
                    <span>Log Out</span>
                  </>
                )}
              </button>

              {/* Cancel Button */}
              <button
                onClick={() => router.replace("/")}
                disabled={loading}
                className="w-full bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-2xl disabled:opacity-80 hover:bg-slate-50 transition-colors"
                style={{
                  height: 52 * scale,
                  fontSize: 18 * scale,
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

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

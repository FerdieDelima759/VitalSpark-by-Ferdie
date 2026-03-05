"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { auth } from "@/hooks/useAuth";
import Toast, { ToastProps } from "@/components/Toast";
import Image from "next/image";
import { HiEnvelope } from "react-icons/hi2";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  useEffect(() => {
    const handleUserInteraction = () => {
      setIsUserInteracting(true);
    };

    document.addEventListener("focusin", handleUserInteraction);
    document.addEventListener("click", handleUserInteraction);
    document.addEventListener("keydown", handleUserInteraction);

    return () => {
      document.removeEventListener("focusin", handleUserInteraction);
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("keydown", handleUserInteraction);
    };
  }, []);

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

  const onSendResetLink = async () => {
    if (!email.trim()) {
      showToast("error", "Missing info", "Please enter your email address.");
      return;
    }

    if (!auth.validateEmail(email)) {
      showToast(
        "error",
        "Invalid Email",
        "Please enter a valid email address.",
      );
      return;
    }

    setLoading(true);
    try {
      const response = await auth.sendPasswordResetEmail(email.trim());

      if (response.success) {
        showToast(
          "success",
          "Email Sent",
          "Password reset link has been sent to your email.",
        );
        setTimeout(() => {
          router.push("/auth/login");
        }, 2000);
      } else {
        showToast("error", "Error", response.message);
      }
    } catch (error: any) {
      showToast(
        "error",
        "Error",
        error?.message || "Failed to send reset email.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.push("/auth/login");
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background:
          "linear-gradient(to bottom, #00b3b3 0%, #009898 50%, #002f2f 100%)",
      }}
    >
      {/* Logo Section */}
      <div className="w-full flex justify-center items-center pt-4 pb-6 sm:pt-5 sm:pb-7">
        <Image
          src="/images/Logo_VitalSpark_White.png"
          alt="VitalSpark Logo"
          width={140}
          height={140}
          priority
          className="object-contain"
          style={{ width: 140, height: 140 }}
        />
      </div>

      {/* Form Section */}
      <div className="flex-1 bg-white mt-auto rounded-t-3xl">
        <div className="max-w-md mx-auto px-5 pt-7 pb-6 sm:pt-8">
          <button
            onClick={handleBackToLogin}
            className="flex items-center text-teal-600 font-semibold text-base mb-5"
          >
            <span className="mr-2">←</span>
            Back to Login
          </button>

          <h1 className="font-extrabold text-amber-500 text-center text-xl sm:text-2xl mb-2">
            Forgot Password?
          </h1>
          <p className="text-slate-500 text-center text-xs leading-4 mt-1 mb-6 sm:mb-7">
            No worries! Enter your email and we'll send you a link to reset your
            password.
          </p>

          {/* Email Input */}
          <div className="mb-6">
            <label className="text-slate-700 block text-sm mb-2">Email</label>
            <div
              className="flex items-center bg-white border border-slate-200"
              style={{
                borderRadius: 16,
                paddingLeft: 16,
                paddingRight: 16,
              }}
            >
              <HiEnvelope
                className="text-slate-400"
                style={{ marginRight: 12, fontSize: 16 }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                readOnly={!isUserInteracting}
                onFocus={(e) => {
                  if (!isUserInteracting) {
                    e.target.removeAttribute("readonly");
                    setIsUserInteracting(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSendResetLink();
                }}
                className="flex-1 placeholder:text-sm text-slate-900 bg-white outline-none placeholder:text-slate-400"
                style={{
                  paddingTop: 12,
                  paddingBottom: 12,
                  paddingLeft: 0,
                  fontSize: 16,
                  height: 48,
                }}
              />
            </div>
          </div>

          {/* Send Reset Link Button */}
          <button
            onClick={onSendResetLink}
            disabled={loading}
            className="w-full text-white font-semibold rounded-2xl mb-2 disabled:opacity-80 flex items-center justify-center bg-linear-to-r from-teal-600 to-teal-700"
            style={{
              height: 52,
              fontSize: 18,
            }}
          >
            {loading ? (
              <span className="animate-spin" style={{ fontSize: 18 }}>
                ⏳
              </span>
            ) : (
              "Send Reset Link"
            )}
          </button>
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

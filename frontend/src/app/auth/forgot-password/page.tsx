"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { auth } from "@/hooks/useAuth";
import Toast, { ToastProps } from "@/components/Toast";
import Image from "next/image";
import { useScale } from "@/hooks/useScale";
import { HiEnvelope } from "react-icons/hi2";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { scale } = useScale();
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

    const showToast = (type: 'success' | 'error', title: string, message: string) => {
        const id = toastIdRef.current++;
        setToasts((prev) => [...prev, { id, type, title, message }]);
    };

    const dismissToast = (id: number) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };

    const onSendResetLink = async () => {
        if (!email.trim()) {
            showToast('error', 'Missing info', 'Please enter your email address.');
            return;
        }

        if (!auth.validateEmail(email)) {
            showToast('error', 'Invalid Email', 'Please enter a valid email address.');
            return;
        }

        setLoading(true);
        try {
            const response = await auth.sendPasswordResetEmail(email.trim());

            if (response.success) {
                showToast('success', 'Email Sent', 'Password reset link has been sent to your email.');
                setTimeout(() => {
                    router.push('/auth/login');
                }, 2000);
            } else {
                showToast('error', 'Error', response.message);
            }
        } catch (error: any) {
            showToast('error', 'Error', error?.message || 'Failed to send reset email.');
        } finally {
            setLoading(false);
        }
    };

    const handleBackToLogin = () => {
        router.push('/auth/login');
    };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#00b3b3] via-[#009898] to-[#002f2f]">
      {/* Logo Section */}
      <div
        className="w-full flex justify-center items-center"
        style={{ paddingTop: 20 * scale, paddingBottom: 40 * scale }}
      >
        <Image
          src="/images/Logo_VitalSpark_White.png"
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
          <button
            onClick={handleBackToLogin}
            className="flex items-center text-teal-600 font-semibold"
            style={{ marginBottom: 24 * scale, fontSize: 16 * scale }}
          >
            <span style={{ marginRight: 8 * scale }}>←</span>
            Back to Login
          </button>

          <h1
            className="font-extrabold text-amber-500 text-center"
            style={{
              fontSize: 36 * scale,
              marginBottom: 8 * scale,
            }}
          >
            Forgot Password?
          </h1>
          <p
            className="text-slate-500 text-center"
            style={{
              fontSize: 14 * scale,
              marginTop: 8 * scale,
              marginBottom: 32 * scale,
              lineHeight: 20 * scale,
            }}
          >
            No worries! Enter your email and we'll send you a link to reset
            your password.
          </p>

          {/* Email Input */}
          <div style={{ marginBottom: 32 * scale }}>
            <label
              className="text-slate-700 block"
              style={{ fontSize: 14 * scale, marginBottom: 8 * scale }}
            >
              Email
            </label>
            <div
              className="flex items-center bg-white border border-slate-200"
              style={{
                borderRadius: 16 * scale,
                paddingLeft: 16 * scale,
                paddingRight: 16 * scale,
              }}
            >
              <HiEnvelope
                className="text-slate-400"
                style={{ marginRight: 12 * scale, fontSize: 18 * scale }}
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
                className="flex-1 text-slate-900 bg-white outline-none placeholder:text-slate-400"
                style={{
                  paddingTop: 12 * scale,
                  paddingBottom: 12 * scale,
                  paddingLeft: 0,
                  fontSize: 16 * scale,
                  height: 48 * scale,
                }}
              />
            </div>
          </div>

          {/* Send Reset Link Button */}
          <button
            onClick={onSendResetLink}
            disabled={loading}
            className="w-full bg-gradient-to-r from-teal-600 to-teal-700 text-white font-semibold rounded-2xl mb-2 disabled:opacity-80 flex items-center justify-center"
            style={{
              height: 52 * scale,
              fontSize: 18 * scale,
            }}
          >
            {loading ? (
              <span className="animate-spin" style={{ fontSize: 18 * scale }}>
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


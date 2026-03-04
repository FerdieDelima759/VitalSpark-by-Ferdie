"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { auth } from "@/hooks/useAuth";
import Toast, { ToastProps } from "@/components/Toast";
import Image from "next/image";
import { useScale } from "@/hooks/useScale";
import { HiLockClosed } from "react-icons/hi2";
import Loader from "@/components/Loader";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const { scale } = useScale();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
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

    const onResetPassword = async () => {
        if (!password.trim() || !confirmPassword.trim()) {
            showToast('error', 'Missing info', 'Please fill in all fields.');
            return;
        }

        if (password !== confirmPassword) {
            showToast('error', 'Password Mismatch', 'Passwords do not match.');
            return;
        }

        const passwordValidation = auth.validatePassword(password);
        if (!passwordValidation.isValid) {
            showToast('error', 'Invalid Password', passwordValidation.message || '');
            return;
        }

        setLoading(true);
        try {
            const response = await auth.updatePassword(password);

            if (response.success) {
                showToast('success', 'Success', 'Password reset successfully.');
                setTimeout(() => {
                    router.push('/auth/login');
                }, 2000);
            } else {
                showToast('error', 'Error', response.message);
            }
        } catch (error: any) {
            showToast('error', 'Error', error?.message || 'Failed to reset password.');
        } finally {
            setLoading(false);
        }
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
          <h1
            className="font-extrabold text-amber-500 text-center"
            style={{
              fontSize: 36 * scale,
              marginBottom: 8 * scale,
            }}
          >
            Reset Password
          </h1>
          <p
            className="text-slate-500 text-center"
            style={{
              fontSize: 14 * scale,
              marginTop: 8 * scale,
              marginBottom: 32 * scale,
            }}
          >
            Enter your new password below.
          </p>

          {/* New Password Input */}
          <div style={{ marginBottom: 20 * scale }}>
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 8 * scale }}
            >
              <label
                className="text-slate-700"
                style={{ fontSize: 14 * scale }}
              >
                New Password
              </label>
              <button
                onClick={() => setShowPw(!showPw)}
                className="text-teal-600 font-medium"
                style={{ fontSize: 14 * scale }}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            <div
              className="flex items-center bg-white border border-slate-200"
              style={{
                borderRadius: 16 * scale,
                paddingLeft: 16 * scale,
                paddingRight: 16 * scale,
              }}
            >
              <HiLockClosed
                className="text-slate-400"
                style={{ marginRight: 12 * scale, fontSize: 18 * scale }}
              />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="•••••••"
                autoComplete="new-password"
                readOnly={!isUserInteracting}
                onFocus={(e) => {
                  if (!isUserInteracting) {
                    e.target.removeAttribute("readonly");
                    setIsUserInteracting(true);
                  }
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

          {/* Confirm Password Input */}
          <div style={{ marginBottom: 20 * scale }}>
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 8 * scale }}
            >
              <label
                className="text-slate-700"
                style={{ fontSize: 14 * scale }}
              >
                Confirm Password
              </label>
              <button
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                className="text-teal-600 font-medium"
                style={{ fontSize: 14 * scale }}
              >
                {showConfirmPw ? "Hide" : "Show"}
              </button>
            </div>
            <div
              className="flex items-center bg-white border border-slate-200"
              style={{
                borderRadius: 16 * scale,
                paddingLeft: 16 * scale,
                paddingRight: 16 * scale,
              }}
            >
              <HiLockClosed
                className="text-slate-400"
                style={{ marginRight: 12 * scale, fontSize: 18 * scale }}
              />
              <input
                type={showConfirmPw ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="•••••••"
                autoComplete="new-password"
                readOnly={!isUserInteracting}
                onFocus={(e) => {
                  if (!isUserInteracting) {
                    e.target.removeAttribute("readonly");
                    setIsUserInteracting(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onResetPassword();
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

          {/* Reset Password Button */}
          <button
            onClick={onResetPassword}
            disabled={loading}
            className="w-full bg-gradient-to-r from-teal-600 to-teal-700 text-white font-semibold rounded-2xl mb-2 disabled:opacity-80 flex items-center justify-center"
            style={{
              height: 52 * scale,
              fontSize: 18 * scale,
            }}
          >
            {loading ? (
              <Loader size="sm" inline />
            ) : (
              "Reset Password"
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


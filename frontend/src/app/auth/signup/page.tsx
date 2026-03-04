"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { auth } from "@/hooks/useAuth";
import Toast, { ToastProps } from "@/components/Toast";
import Dialog from "@/components/Dialog";
import Image from "next/image";
import { useScale } from "@/hooks/useScale";
import { HiEnvelope, HiLockClosed, HiCheck, HiXMark } from "react-icons/hi2";
import Loader from "@/components/Loader";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

export default function SignUpPage() {
  const router = useRouter();
  const { scale } = useScale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
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
  const [passwordRequirements, setPasswordRequirements] = useState({
    minLength: false,
    hasNumber: false,
    hasUpperCase: false,
    hasLowerCase: false,
  });
  const [passwordsMatch, setPasswordsMatch] = useState(false);

  useEffect(() => {
    setPasswordRequirements({
      minLength: password.length >= 6,
      hasNumber: /\d/.test(password),
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
    });
  }, [password]);

  useEffect(() => {
    if (confirmPassword.length > 0) {
      setPasswordsMatch(password === confirmPassword && password.length > 0);
    } else {
      setPasswordsMatch(false);
    }
  }, [password, confirmPassword]);

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

  const onSignUp = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      showToast("error", "Missing info", "Please fill in all fields.");
      return;
    }

    if (!auth.validateEmail(email)) {
      showToast(
        "error",
        "Invalid Email",
        "Please enter a valid email address."
      );
      return;
    }

    if (password !== confirmPassword) {
      showToast("error", "Password Mismatch", "Passwords do not match.");
      return;
    }

    const passwordValidation = auth.validatePassword(password);
    if (!passwordValidation.isValid) {
      showToast("error", "Invalid Password", passwordValidation.message || "");
      return;
    }

    setLoading(true);
    try {
      const response = await auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (response.success) {
        setShowEmailDialog(true);
      } else {
        showToast("error", "Sign Up Failed", response.message);
      }
    } catch (error: any) {
      showToast(
        "error",
        "Error",
        error?.message || "Unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = () => {
    router.push("/auth/login");
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
            Sign Up
          </h1>
          <p
            className="text-slate-500 text-center"
            style={{
              fontSize: 14 * scale,
              marginTop: 8 * scale,
              marginBottom: 32 * scale,
            }}
          >
            Create your account to get started.
          </p>

          {/* Email Input */}
          <div style={{ marginBottom: 20 * scale }}>
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

          {/* Password Input */}
          <div style={{ marginBottom: 20 * scale }}>
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 8 * scale }}
            >
              <label
                className="text-slate-700"
                style={{ fontSize: 14 * scale }}
              >
                Create Password
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

            {password.length > 0 && (
              <div
                style={{
                  marginTop: 12 * scale,
                  paddingLeft: 4 * scale,
                  paddingRight: 4 * scale,
                }}
              >
                <div
                  className="text-slate-500 font-semibold"
                  style={{ fontSize: 12 * scale, marginBottom: 8 * scale }}
                >
                  Password must contain:
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6 * scale,
                  }}
                >
                  {[
                    { key: "minLength", label: "At least 6 characters" },
                    { key: "hasUpperCase", label: "One uppercase letter" },
                    { key: "hasLowerCase", label: "One lowercase letter" },
                    { key: "hasNumber", label: "One number" },
                  ].map((req) => (
                    <div key={req.key} className="flex items-center">
                      {passwordRequirements[
                        req.key as keyof typeof passwordRequirements
                      ] ? (
                        <HiCheck
                          className="text-green-500 mr-1.5"
                          style={{ fontSize: 16 * scale }}
                        />
                      ) : (
                        <HiXMark
                          className="text-slate-400 mr-1.5"
                          style={{ fontSize: 16 * scale }}
                        />
                      )}
                      <span
                        className={`${
                          passwordRequirements[
                            req.key as keyof typeof passwordRequirements
                          ]
                            ? "text-green-600"
                            : "text-slate-500"
                        }`}
                        style={{ fontSize: 12 * scale }}
                      >
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                  if (e.key === "Enter") onSignUp();
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

            {confirmPassword.length > 0 && (
              <div
                className="flex items-center"
                style={{ marginTop: 12 * scale }}
              >
                {passwordsMatch ? (
                  <HiCheck
                    className="text-green-500 mr-1.5"
                    style={{ fontSize: 16 * scale }}
                  />
                ) : (
                  <HiXMark
                    className="text-red-500 mr-1.5"
                    style={{ fontSize: 16 * scale }}
                  />
                )}
                <span
                  className={`font-medium ${
                    passwordsMatch ? "text-green-600" : "text-red-600"
                  }`}
                  style={{ fontSize: 12 * scale }}
                >
                  {passwordsMatch
                    ? "Passwords match"
                    : "Passwords do not match"}
                </span>
              </div>
            )}
          </div>

          {/* Sign Up Button */}
          <button
            onClick={onSignUp}
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold rounded-2xl mb-2 disabled:opacity-80 flex items-center justify-center"
            style={{
              height: 52 * scale,
              fontSize: 18 * scale,
            }}
          >
            {loading ? <Loader size="sm" inline /> : "Sign Up"}
          </button>

          {/* Sign In Link */}
          <div className="text-center" style={{ marginTop: 32 * scale }}>
            <span className="text-slate-500" style={{ fontSize: 14 * scale }}>
              Already have an account?{" "}
              <button
                onClick={handleSignIn}
                className="text-teal-600 font-semibold"
                style={{ fontSize: 14 * scale }}
              >
                Sign In
              </button>
            </span>
          </div>
        </div>
      </div>

      {/* Email Verification Dialog */}
      <Dialog
        visible={showEmailDialog}
        onDismiss={() => {
          setShowEmailDialog(false);
          router.push("/auth/login");
        }}
      >
        <div className="text-center mb-4">
          <div className="flex justify-center mb-4">
            <HiEnvelope
              style={{ fontSize: 48 * scale }}
              className="text-teal-600"
            />
          </div>
        </div>
        <h2 className="text-lg font-bold text-slate-900 text-center mb-2">
          Check Your Email
        </h2>
        <p className="text-sm text-slate-600 text-center mb-5 leading-5">
          We've sent a verification link to{" "}
          <span className="font-semibold text-teal-600">{email}</span>. Please
          check your inbox and verify your email to complete the registration.
        </p>
        <button
          onClick={() => {
            setShowEmailDialog(false);
            router.push("/auth/login");
          }}
          className="w-full bg-gradient-to-r from-teal-600 to-teal-700 text-white font-semibold py-3 rounded-lg"
        >
          Got It
        </button>
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

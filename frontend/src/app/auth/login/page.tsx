"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { auth } from "@/hooks/useAuth";
import Toast, { ToastProps } from "@/components/Toast";
import Image from "next/image";
import { useScale } from "@/hooks/useScale";
import { HiEnvelope, HiLockClosed } from "react-icons/hi2";
import Loader from "@/components/Loader";

interface ToastState extends Omit<ToastProps, "onDismiss"> {
  id: number;
}

const AUTH_STEP_TIMEOUT_MS = 8000;

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        window.clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
};

export default function LoginPage() {
  const router = useRouter();
  const { scale } = useScale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastIdRef = useRef(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [shouldShowRecoveryHint, setShouldShowRecoveryHint] = useState(false);

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Always clear browser storage on login route entry.
    try {
      window.localStorage.clear();
    } catch {}
    try {
      window.sessionStorage.clear();
    } catch {}

    const params = new URLSearchParams(window.location.search);
    setShouldShowRecoveryHint(params.get("reason") === "inactive");
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

  const onSignIn = async () => {
    if (loading) {
      return;
    }

    if (!email.trim() || !password.trim()) {
      showToast(
        "error",
        "Missing info",
        "Please enter both email and password.",
      );
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
      const response = await withTimeout(
        auth.signIn({
          email: email.trim(),
          password: password,
        }),
        AUTH_STEP_TIMEOUT_MS,
        "auth.signIn",
      );

      if (!response.success) {
        showToast("error", "Login Failed", response.message);
      } else {
        // Fetch and store user data and role after successful login
        try {
          const { supabase } = await import("@/lib/api/supabase");
          const { setUserSessionData } = await import("@/utils/sessionStorage");
          const {
            data: { user },
          } = await withTimeout(
            supabase.auth.getUser(),
            AUTH_STEP_TIMEOUT_MS,
            "supabase.auth.getUser",
          );

          if (user) {
            // Fetch user profile
            const { data: profileRows, error: profileError } = await supabase
              .from("user_profile")
              .select("*")
              .eq("user_id", user.id)
              .limit(1);

            const profileData = profileRows?.[0] ?? null;

            // Fetch user role
            const { data: roleRows, error: roleError } = await supabase
              .from("user_role")
              .select("*")
              .eq("user_id", user.id)
              .limit(1);

            const roleData = roleRows?.[0] ?? null;

            if (profileError) {
              console.error(
                "Error fetching user profile after login:",
                profileError,
              );
            }
            if (roleError) {
              console.error("Error fetching user role after login:", roleError);
            }

            // Store user data in session storage
            const isAdmin = roleData?.role?.toLowerCase() === "admin";
            setUserSessionData({
              userId: user.id,
              userRole: roleData?.role || null,
              isAdmin,
              userProfile: profileData || null,
            });

            // Check onboarding status
            if (profileError || !profileData) {
              router.push("/onboarding/language");
              return;
            }

            // Profile exists - check completion
            if (profileData.is_onboarding_complete) {
              router.push("/");
            } else {
              // Route to current step
              const routes = [
                "/onboarding/language",
                "/onboarding/mood",
                "/onboarding/profile",
                "/onboarding/location",
                "/onboarding/height",
                "/onboarding/weight",
                "/onboarding/fitness",
                "/onboarding/target-muscle-group",
                "/onboarding/dietary",
                "/onboarding/finish",
              ];
              const step = profileData.current_step || 1;
              // If step is 9 or higher, go to finish
              if (step >= 9) {
                router.push("/onboarding/finish");
              } else {
                router.push(routes[step - 1] || routes[0]);
              }
            }
          } else {
            router.push("/");
          }
        } catch (error) {
          console.error("Error fetching user data after login:", error);
          router.push("/");
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unexpected error occurred.";
      showToast("error", "Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push("/auth/forgot-password");
  };

  const handleSignUp = () => {
    router.push("/auth/signup");
  };

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
          width={180 * scale}
          height={180 * scale}
          priority
          className="object-contain"
          style={{ width: 180 * scale, height: 160 * scale }}
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
            Login
          </h1>
          <p
            className="text-slate-500 text-center"
            style={{
              fontSize: 14 * scale,
              marginTop: 8 * scale,
              marginBottom: 32 * scale,
            }}
          >
            Welcome back. Please enter your details.
          </p>

          {shouldShowRecoveryHint && (
            <div
              className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-center"
              style={{
                fontSize: 13 * scale,
                padding: `${10 * scale}px ${12 * scale}px`,
                marginBottom: 16 * scale,
              }}
            >
              You were signed out after inactivity.
            </div>
          )}

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
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSignIn();
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
                Password
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
                autoComplete="current-password"
                readOnly={!isUserInteracting}
                onFocus={(e) => {
                  if (!isUserInteracting) {
                    e.target.removeAttribute("readonly");
                    setIsUserInteracting(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSignIn();
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

            <div className="flex justify-end" style={{ marginTop: 8 * scale }}>
              <button
                onClick={handleForgotPassword}
                className="text-teal-600 font-medium"
                style={{ fontSize: 14 * scale }}
              >
                Forgot Password?
              </button>
            </div>
          </div>

          {/* Sign In Button */}
          <button
            onClick={onSignIn}
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold rounded-2xl mb-2 disabled:opacity-80 flex items-center justify-center"
            style={{
              height: 52 * scale,
              fontSize: 18 * scale,
            }}
          >
            {loading ? <Loader size="sm" inline /> : "Sign In"}
          </button>

          {/* Sign Up Link */}
          <div className="text-center" style={{ marginTop: 32 * scale }}>
            <span className="text-slate-500" style={{ fontSize: 14 * scale }}>
              New here?{" "}
              <button
                onClick={handleSignUp}
                className="text-teal-600 font-semibold"
                style={{ fontSize: 14 * scale }}
              >
                Create an account
              </button>
            </span>
          </div>
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

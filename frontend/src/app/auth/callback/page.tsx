"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/api/supabase";
import Image from "next/image";
import { useScale } from "@/hooks/useScale";

const CALLBACK_TIMEOUT_MS = 15000;

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

export default function AuthCallbackPage() {
  const { scale } = useScale();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const hardRedirect = (url: string) => {
      window.location.replace(url);
    };

    const handleCallback = async () => {
      try {
        const currentUrl = new URL(window.location.href);
        const hashParams = new URLSearchParams(
          window.location.hash.startsWith("#")
            ? window.location.hash.slice(1)
            : window.location.hash,
        );
        const searchParams = currentUrl.searchParams;

        const code = searchParams.get("code");
        const typeFromHash = hashParams.get("type");
        const typeFromQuery = searchParams.get("type");
        const isPasswordRecovery =
          typeFromHash === "recovery" || typeFromQuery === "recovery";

        if (code) {
          const { error } = await withTimeout(
            supabase.auth.exchangeCodeForSession(code),
            CALLBACK_TIMEOUT_MS,
            "supabase.auth.exchangeCodeForSession",
          );
          if (error) {
            hardRedirect(
              "/auth/email-verify?status=error&message=Verification failed. Please try again.",
            );
            return;
          }
        } else if (window.location.hash) {
          // Let Supabase process hash fragments first when needed.
          await new Promise((resolve) => window.setTimeout(resolve, 400));
        }

        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          CALLBACK_TIMEOUT_MS,
          "supabase.auth.getSession",
        );

        if (error) {
          hardRedirect(
            "/auth/email-verify?status=error&message=Verification failed. Please try again.",
          );
          return;
        }

        if (data.session) {
          if (isPasswordRecovery) {
            hardRedirect("/auth/reset-password");
            return;
          }

          hardRedirect(
            "/auth/email-verify?status=success&message=Email verified successfully. Try logging in with your credentials",
          );
          return;
        }

        hardRedirect(
          "/auth/email-verify?status=error&message=Verification failed. No session found. Please try signing up again.",
        );
      } catch {
        hardRedirect(
          "/auth/email-verify?status=error&message=An unexpected error occurred. Please try again.",
        );
      } finally {
        if (isMounted) {
          setIsProcessing(false);
        }
      }
    };

    const timer = window.setTimeout(() => {
      void handleCallback();
    }, 100);

    const watchdog = window.setTimeout(() => {
      hardRedirect(
        "/auth/email-verify?status=error&message=Verification timed out. Please try again.",
      );
    }, CALLBACK_TIMEOUT_MS + 1000);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
      window.clearTimeout(watchdog);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#00b3b3] via-[#009898] to-[#002f2f]">
      <div className="text-white text-center">
        <Image
          src="/images/Logo_VitalSpark_Vertical.png"
          alt="VitalSpark Logo"
          width={120 * scale}
          height={120 * scale}
          priority
          className="object-contain mx-auto"
          style={{
            width: 120 * scale,
            height: 120 * scale,
            marginBottom: 24 * scale,
          }}
        />
        {isProcessing && (
          <div
            className="animate-spin"
            style={{ fontSize: 36 * scale, marginBottom: 16 * scale }}
          >
            ⏳
          </div>
        )}
        <p className="font-semibold" style={{ fontSize: 18 * scale }}>
          Processing verification...
        </p>
      </div>
    </div>
  );
}

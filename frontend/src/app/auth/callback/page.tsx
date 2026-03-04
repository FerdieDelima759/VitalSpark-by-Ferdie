"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/api/supabase";
import Image from "next/image";
import { useScale } from "@/hooks/useScale";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { scale } = useScale();
  const [isProcessing, setIsProcessing] = useState(true);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Check if it's a password recovery link
                const hash = typeof window !== 'undefined' ? window.location.hash : '';
                const isPasswordRecovery = hash.includes('type=recovery');

                // Wait for Supabase to process the hash
                if (hash) {
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }

                const { data, error } = await supabase.auth.getSession();

                if (error) {
                    router.replace(
                        '/auth/email-verify?status=error&message=Verification failed. Please try again.'
                    );
                    return;
                }

                if (data.session) {
                    if (isPasswordRecovery) {
                        router.replace('/auth/reset-password');
                        return;
                    }

                    router.replace(
                        '/auth/email-verify?status=success&message=Email verified successfully. Try logging in with your credentials'
                    );
                } else {
                    router.replace(
                        '/auth/email-verify?status=error&message=Verification failed. No session found. Please try signing up again.'
                    );
                }
            } catch (error) {
                router.replace(
                    '/auth/email-verify?status=error&message=An unexpected error occurred. Please try again.'
                );
            } finally {
                setIsProcessing(false);
            }
        };

        const timer = setTimeout(() => {
            handleCallback();
        }, 100);

        return () => clearTimeout(timer);
    }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#00b3b3] via-[#009898] to-[#002f2f]">
      <div className="text-white text-center">
        <Image
          src="/images/Logo_VitalSpark_White.png"
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
        <p
          className="font-semibold"
          style={{ fontSize: 18 * scale }}
        >
          Processing verification...
        </p>
      </div>
    </div>
  );
}


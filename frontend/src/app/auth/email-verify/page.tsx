"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useScale } from "@/hooks/useScale";
import { HiCheckCircle, HiXCircle } from "react-icons/hi2";

function EmailVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { scale } = useScale();
  const status = searchParams.get("status");
  const message = searchParams.get("message");

  const isSuccess = status === "success";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#00b3b3] via-[#009898] to-[#002f2f]"
      style={{ paddingLeft: 16 * scale, paddingRight: 16 * scale }}
    >
      <div
        className="bg-white rounded-2xl w-full text-center"
        style={{
          borderRadius: 16 * scale,
          padding: 32 * scale,
          maxWidth: 600 * scale,
        }}
      >
        <Image
          src="/images/Logo_VitalSpark_Colored.png"
          alt="VitalSpark Logo"
          width={100 * scale}
          height={100 * scale}
          priority
          className="object-contain mx-auto"
          style={{
            width: 100 * scale,
            height: 100 * scale,
            marginBottom: 16 * scale,
          }}
        />
        <div style={{ marginBottom: 16 * scale }} className="flex justify-center">
          {isSuccess ? (
            <HiCheckCircle
              style={{ fontSize: 48 * scale }}
              className="text-green-500"
            />
          ) : (
            <HiXCircle
              style={{ fontSize: 48 * scale }}
              className="text-red-500"
            />
          )}
        </div>
        <h1
          className="font-bold text-slate-900"
          style={{
            fontSize: 24 * scale,
            marginBottom: 8 * scale,
          }}
        >
          {isSuccess ? "Email Verified!" : "Verification Failed"}
        </h1>
        <p
          className="text-slate-600"
          style={{
            fontSize: 14 * scale,
            marginBottom: 24 * scale,
          }}
        >
          {message || "Please check your email."}
        </p>
        <button
          onClick={() => router.push("/auth/login")}
          className="w-full bg-gradient-to-r from-teal-600 to-teal-700 text-white font-semibold rounded-lg"
          style={{
            height: 52 * scale,
            fontSize: 18 * scale,
            borderRadius: 8 * scale,
          }}
        >
          Go to Login
        </button>
      </div>
    </div>
  );
}

export default function EmailVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#00b3b3] via-[#009898] to-[#002f2f]">
          <div className="bg-white rounded-2xl p-8 max-w-96 text-center">
            <div className="animate-pulse">Loading...</div>
          </div>
        </div>
      }
    >
      <EmailVerifyContent />
    </Suspense>
  );
}


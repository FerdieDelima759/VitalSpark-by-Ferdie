"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CoachWorkoutPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/personal");
  }, [router]);
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600" />
    </div>
  );
}

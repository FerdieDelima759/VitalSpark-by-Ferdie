"use client";

import { useEffect, useState } from "react";
import { useImageGeneration } from "@/contexts/ImageGenerationContext";

/**
 * Global Image Generation Progress Indicator
 * Shows a floating progress bar when image generation is in progress
 * Can be placed in the root layout to show progress across all pages
 */
export function ImageGenerationProgress() {
  const { isProcessingImages, currentImageGenDay, imageGenStats } =
    useImageGeneration();
  const [isRetracted, setIsRetracted] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      const savedState = localStorage.getItem("image-gen-toast-retracted");
      return savedState === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("image-gen-toast-retracted", isRetracted ? "1" : "0");
    } catch {
      // Ignore storage access issues
    }
  }, [isRetracted]);

  // Don't show if not processing
  const remaining = Math.max(0, imageGenStats.total - imageGenStats.uploaded);
  if (!isProcessingImages && remaining === 0) {
    return null;
  }

  const progress =
    imageGenStats.total > 0
      ? Math.round((imageGenStats.uploaded / imageGenStats.total) * 100)
      : 0;
  const displayDay = currentImageGenDay
    ? currentImageGenDay
        .split("|")
        .slice(0, 2)
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" | ")
    : null;

  return (
    <div className="fixed right-0 z-[9999] pointer-events-none top-[calc(env(safe-area-inset-top)+1rem)] lg:top-6">
      {isRetracted ? (
        <button
          type="button"
          onClick={() => setIsRetracted(false)}
          className="pointer-events-auto flex items-center gap-2 rounded-l-xl border border-gray-200 bg-white px-3 py-2 shadow-lg dark:bg-slate-900 dark:border-slate-700"
          aria-label="Show image generation progress"
          title="Show image generation progress"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4 text-teal-600"
            aria-hidden="true"
          >
            <path
              d="M12.5 4.5L7 10l5.5 5.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-xs font-medium text-gray-700 dark:text-slate-200">
            {imageGenStats.uploaded}/{imageGenStats.total}
          </span>
        </button>
      ) : (
        <div className="pointer-events-auto mr-4 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:bg-slate-900 dark:border-slate-700">
          <div className="flex items-start gap-3">
            {/* Spinner */}
            {isProcessingImages && (
              <div className="shrink-0 mt-0.5">
                <svg
                  className="animate-spin h-5 w-5 text-teal-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            )}

            <div className="flex-1 min-w-0">
              {/* Title */}
              <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                {isProcessingImages
                  ? `Generating images${displayDay ? ` - ${displayDay}` : ""}`
                  : "Image generation paused"}
              </div>

              {/* Stats */}
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {imageGenStats.uploaded} / {imageGenStats.total} uploaded
              </div>

              {/* Progress bar */}
              <div className="mt-2 h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsRetracted(true)}
              className="shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              aria-label="Hide image generation progress"
              title="Hide"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="none"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  d="M7.5 4.5L13 10l-5.5 5.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {/* Hint */}
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
            Processing continues in background
          </p>
        </div>
      )}
    </div>
  );
}

export default ImageGenerationProgress;

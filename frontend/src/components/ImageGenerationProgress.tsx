"use client";

import { useImageGeneration } from "@/contexts/ImageGenerationContext";

/**
 * Global Image Generation Progress Indicator
 * Shows a floating progress bar when image generation is in progress
 * Can be placed in the root layout to show progress across all pages
 */
export function ImageGenerationProgress() {
  const { isProcessingImages, currentImageGenDay, imageGenStats } =
    useImageGeneration();

  // Don't show if not processing
  const remaining = Math.max(0, imageGenStats.total - imageGenStats.uploaded);
  if (!isProcessingImages && remaining === 0) {
    return null;
  }

  const progress =
    imageGenStats.total > 0
      ? Math.round((imageGenStats.uploaded / imageGenStats.total) * 100)
      : 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-64">
      <div className="flex items-center gap-3">
        {/* Spinner */}
        {isProcessingImages && (
          <div className="shrink-0">
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

        <div className="flex-1">
          {/* Title */}
          <div className="text-sm font-medium text-gray-900">
            {isProcessingImages
              ? `Generating images${currentImageGenDay ? ` - ${currentImageGenDay}` : ""}`
              : "Image generation paused"}
          </div>

          {/* Stats */}
          <div className="text-xs text-gray-500 mt-0.5">
            {imageGenStats.uploaded} / {imageGenStats.total} uploaded
            {imageGenStats.failed > 0 && (
              <span className="text-amber-600 ml-2">
                ({imageGenStats.failed} failed)
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-400 mt-2">
        Processing continues in background
      </p>
    </div>
  );
}

export default ImageGenerationProgress;

"use client";

import { useEffect, useState } from "react";

export interface ToastProps {
  type: "success" | "error";
  message: string;
  title?: string;
  duration?: number;
  onDismiss: () => void;
  index?: number;
}

export default function Toast({
  type,
  message,
  title,
  duration = 4000,
  onDismiss,
  index = 0,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onDismiss();
      }, 200);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const colors = {
    success: {
      background: "rgba(34, 139, 34, 0.95)",
      icon: "#ffffff",
      text: "#ffffff",
    },
    error: {
      background: "rgba(220, 38, 38, 0.9)",
      icon: "#ffffff",
      text: "#ffffff",
    },
  };

  const colorScheme = colors[type];
  const iconName = type === "success" ? "✓" : "✕";

  // Calculate vertical offset for stacked toasts
  const toastHeight = 70;
  const verticalOffset = index * toastHeight;

  return (
    <div
      className={`fixed top-4 right-4 z-[9999] min-w-[240px] max-w-[320px] rounded-lg p-3 shadow-lg transition-all duration-200 ${
        isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      }`}
      style={{
        backgroundColor: colorScheme.background,
        top: `${16 + verticalOffset}px`,
        color: colorScheme.text,
      }}
    >
      <div className="flex items-start">
        <span
          className="mr-2 mt-0.5 text-lg font-bold"
          style={{ color: colorScheme.icon }}
        >
          {iconName}
        </span>
        <div className="flex-1 mr-1">
          {title && <div className="text-sm font-semibold mb-1">{title}</div>}
          <div className="text-xs leading-4 opacity-90">{message}</div>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onDismiss(), 200);
          }}
          className="p-1 opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: colorScheme.text }}
        >
          <span className="text-base">×</span>
        </button>
      </div>
    </div>
  );
}

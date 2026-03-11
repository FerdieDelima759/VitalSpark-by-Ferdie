"use client";

import { ReactNode } from "react";

export interface DialogProps {
  visible: boolean;
  onDismiss?: () => void;
  children: ReactNode;
  dismissible?: boolean;
  maxWidth?: number | string;
  maxHeight?: number | string;
  height?: number | string;
  showCloseButton?: boolean;
}

export default function Dialog({
  visible,
  onDismiss,
  children,
  dismissible = true,
  maxWidth = 450,
  maxHeight = 600,
  height,
  showCloseButton = true,
}: DialogProps) {
  if (!visible) return null;

  const handleBackdropClick = () => {
    if (dismissible && onDismiss) {
      onDismiss();
    }
  };

  const maxWidthValue =
    typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth;
  const maxHeightValue =
    typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight;
  const heightValue =
    typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div
        className={`relative w-full flex flex-col rounded-3xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-[0_24px_70px_rgba(2,6,23,0.35)] dark:shadow-[0_32px_90px_rgba(2,6,23,0.7)] ${
          !height && maxHeight === 600 ? "max-h-[90vh]" : ""
        }`}
        style={{
          maxWidth: maxWidthValue,
          maxHeight: height ? undefined : maxHeightValue,
          height: heightValue,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="text-xl">&times;</span>
          </button>
        )}

        <div
          className={`overflow-y-auto flex-1 dialog-scrollbar ${
            showCloseButton && onDismiss ? "pt-12 px-6 pb-6" : "p-6"
          }`}
          style={{ overflowX: "visible", position: "relative" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

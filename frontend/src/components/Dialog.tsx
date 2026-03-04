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
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl relative w-full flex flex-col ${
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
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <span className="text-xl">×</span>
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

"use client";

import React from "react";

const LIGHT_PAGE_BG = "#f8fafc";
const DARK_OVERSCROLL_BG = "#0b1020";

function updateOverscrollBackground() {
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const overscrollColor = isDark ? DARK_OVERSCROLL_BG : LIGHT_PAGE_BG;

  document.documentElement.style.backgroundColor = overscrollColor;
  document.body.style.backgroundColor = overscrollColor;
}

export default function ThemeBackground({
  children,
}: {
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const root = document.documentElement;
    const savedTheme = localStorage.getItem("theme");
    const resolvedTheme =
      savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    updateOverscrollBackground();

    const observer = new MutationObserver(() => {
      updateOverscrollBackground();
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
    };
  }, []);

  return children;
}


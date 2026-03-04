"use client";

export const THEME_STORAGE_KEY = "theme";

export type ThemePreference = "light" | "dark";

export const isValidThemePreference = (
  value: string | null,
): value is ThemePreference => {
  return value === "light" || value === "dark";
};

export const clearLocalStoragePreserveTheme = (): void => {
  if (typeof window === "undefined") return;

  const theme = window.localStorage.getItem(THEME_STORAGE_KEY);
  window.localStorage.clear();

  if (isValidThemePreference(theme)) {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
};


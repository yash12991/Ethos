"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

type ThemeSettingsContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  resolvedTheme: "light" | "dark";
  systemTheme: "light" | "dark";
  highContrast: boolean;
  setHighContrast: (value: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
};

const ThemeSettingsContext = createContext<ThemeSettingsContextValue | null>(null);

const STORAGE_KEY = "theme";
const HIGH_CONTRAST_KEY = "hr_high_contrast";
const REDUCED_MOTION_KEY = "hr_reduced_motion";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function resolveTheme(mode: ThemeMode, prefersDark: boolean): "light" | "dark" {
  if (mode === "system") {
    return prefersDark ? "dark" : "light";
  }
  return mode;
}

export function ThemeSettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const storedHighContrast = window.localStorage.getItem(HIGH_CONTRAST_KEY);
    const storedReducedMotion = window.localStorage.getItem(REDUCED_MOTION_KEY);

    setHighContrast(storedHighContrast === "true");
    setReducedMotion(storedReducedMotion === "true");

    if (isThemeMode(stored)) {
      setThemeState(stored);
      setInitialized(true);
      return;
    }
    setThemeState("light");
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = (mode: ThemeMode) => {
      setSystemTheme(media.matches ? "dark" : "light");
      const resolved = resolveTheme(mode, media.matches);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(resolved);
      document.body.classList.remove("light", "dark");
      document.body.classList.add(resolved);
      setResolvedTheme(resolved);
    };

    apply(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);

    if (theme !== "system") {
      return;
    }

    const handleSchemeChange = () => {
      setSystemTheme(media.matches ? "dark" : "light");
      apply("system");
    };

    media.addEventListener("change", handleSchemeChange);
    return () => {
      media.removeEventListener("change", handleSchemeChange);
    };
  }, [theme, initialized]);

  useEffect(() => {
    if (!initialized) return;
    document.body.classList.toggle("hr-high-contrast", highContrast);
    window.localStorage.setItem(HIGH_CONTRAST_KEY, String(highContrast));
  }, [highContrast, initialized]);

  useEffect(() => {
    if (!initialized) return;
    document.body.classList.toggle("hr-reduced-motion", reducedMotion);
    window.localStorage.setItem(REDUCED_MOTION_KEY, String(reducedMotion));
  }, [reducedMotion, initialized]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: setThemeState,
      resolvedTheme,
      systemTheme,
      highContrast,
      setHighContrast,
      reducedMotion,
      setReducedMotion,
    }),
    [theme, resolvedTheme, systemTheme, highContrast, reducedMotion]
  );

  return <ThemeSettingsContext.Provider value={value}>{children}</ThemeSettingsContext.Provider>;
}

export function useThemeSettings() {
  const context = useContext(ThemeSettingsContext);
  if (!context) {
    throw new Error("useThemeSettings must be used within ThemeSettingsProvider");
  }
  return context;
}

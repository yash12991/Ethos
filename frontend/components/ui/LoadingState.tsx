"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_MESSAGES = [
  "Analyzing reports...",
  "Fetching case data...",
  "Scanning patterns...",
  "Loading messages...",
  "Preparing dashboard...",
] as const;

type LoadingStateProps = {
  messages?: readonly string[];
  intervalMs?: number;
  className?: string;
  fullScreen?: boolean;
  showSkeletonCards?: boolean;
};

type ResolvedTheme = "light" | "dark";

function resolveThemeFromStorage(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("theme");
  if (stored === "dark") return "dark";
  if (stored === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useResolvedThemeFromStorage() {
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    setResolvedTheme(resolveThemeFromStorage());

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onStorage = (event: StorageEvent) => {
      if (event.key === "theme") {
        setResolvedTheme(resolveThemeFromStorage());
      }
    };

    const onMediaChange = () => {
      const stored = window.localStorage.getItem("theme");
      if (!stored || stored === "system") {
        setResolvedTheme(resolveThemeFromStorage());
      }
    };

    window.addEventListener("storage", onStorage);
    media.addEventListener("change", onMediaChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      media.removeEventListener("change", onMediaChange);
    };
  }, []);

  return resolvedTheme;
}

export function LoadingState({
  messages = DEFAULT_MESSAGES,
  intervalMs = 1500,
  className = "",
  fullScreen = true,
  showSkeletonCards = true,
}: LoadingStateProps) {
  const resolvedTheme = useResolvedThemeFromStorage();
  const isDark = resolvedTheme === "dark";
  const safeMessages = useMemo(
    () => (messages.length > 0 ? messages : DEFAULT_MESSAGES),
    [messages]
  );

  const [index, setIndex] = useState(0);
  const [showLongWaitText, setShowLongWaitText] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % safeMessages.length);
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [intervalMs, safeMessages.length]);

  useEffect(() => {
    setShowLongWaitText(false);
    const timeout = window.setTimeout(() => {
      setShowLongWaitText(true);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, []);

  const activeMessage = showLongWaitText
    ? "Still working... large dataset detected"
    : safeMessages[index];

  return (
    <section
      className={`flex w-full items-center justify-center ${
        fullScreen ? "min-h-screen" : "min-h-[360px]"
      } ${isDark ? "bg-black" : "bg-transparent"} ${className}`}
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={`w-full max-w-3xl rounded-2xl border p-6 shadow-sm backdrop-blur ${
          isDark
            ? "border-neutral-800 bg-black"
            : "border-slate-200 bg-white/80"
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <div
              className={`absolute h-12 w-12 rounded-full border-2 ${
                isDark ? "border-violet-500/30" : "border-violet-300/40"
              }`}
            />
            <div className="h-6 w-6 rounded-full bg-violet-500/80 animate-pulse" />
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={activeMessage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className={`text-center text-sm font-medium ${
                isDark ? "text-slate-200" : "text-slate-700"
              }`}
            >
              {activeMessage}
            </motion.p>
          </AnimatePresence>

          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${isDark ? "bg-slate-500" : "bg-slate-400"}`} />
            <span className={`h-1.5 w-1.5 rounded-full animate-pulse [animation-delay:150ms] ${isDark ? "bg-slate-500" : "bg-slate-400"}`} />
            <span className={`h-1.5 w-1.5 rounded-full animate-pulse [animation-delay:300ms] ${isDark ? "bg-slate-500" : "bg-slate-400"}`} />
          </div>
        </div>

        {showSkeletonCards ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={`loading-card-${i}`}
                className={`rounded-xl border p-4 ${
                  isDark
                    ? "border-neutral-800 bg-neutral-950"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className={`h-3 w-24 rounded animate-pulse ${isDark ? "bg-neutral-800" : "bg-slate-200"}`} />
                <div className={`mt-3 h-7 w-16 rounded animate-pulse ${isDark ? "bg-neutral-800" : "bg-slate-200"}`} />
                <div className={`mt-3 h-3 w-32 rounded animate-pulse ${isDark ? "bg-neutral-800" : "bg-slate-200"}`} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

type LoadingTableSkeletonProps = {
  rows?: number;
  cols?: number;
  className?: string;
};

export function LoadingTableSkeleton({
  rows = 6,
  cols = 5,
  className = "",
}: LoadingTableSkeletonProps) {
  const resolvedTheme = useResolvedThemeFromStorage();
  const isDark = resolvedTheme === "dark";

  return (
    <div
      className={`rounded-xl border p-3 ${
        isDark ? "border-neutral-800 bg-black" : "border-slate-200 bg-white"
      } ${className}`}
      aria-hidden="true"
    >
      <div className="space-y-2">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((_, index) => (
            <div
              key={`head-${index}`}
              className={`h-3 rounded animate-pulse ${isDark ? "bg-neutral-800" : "bg-slate-200"}`}
            />
          ))}
        </div>

        {Array.from({ length: rows }).map((_, row) => (
          <div
            key={`row-${row}`}
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((__, col) => (
              <div
                key={`cell-${row}-${col}`}
                className={`relative h-8 overflow-hidden rounded ${isDark ? "bg-neutral-900" : "bg-slate-100"}`}
              >
                <motion.div
                  className={`absolute inset-y-0 -left-1/2 w-1/2 bg-linear-to-r from-transparent to-transparent ${
                    isDark ? "via-white/10" : "via-white/70"
                  }`}
                  animate={{ x: ["0%", "300%"] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

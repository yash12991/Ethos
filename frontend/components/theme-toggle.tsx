"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useThemeSettings } from "@/components/theme-settings-provider";

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useThemeSettings();
    const pathname = usePathname();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="fixed right-4 top-4 z-50 h-10 w-10 md:right-16" aria-hidden="true" />;
    }

    const isHrDashboardRoute = pathname === "/hr/dashboard" || pathname.startsWith("/hr/dashboard/");
    const isEmployeeDashboardRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

    if (!isHrDashboardRoute && !isEmployeeDashboardRoute) {
        return null;
    }

    const isDark = resolvedTheme === "dark";

    return (
        <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="fixed right-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-slate-700 shadow-sm backdrop-blur md:right-16 dark:border-neutral-700 dark:bg-neutral-900/90 dark:text-neutral-200"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Light mode" : "Dark mode"}
        >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
    );
}

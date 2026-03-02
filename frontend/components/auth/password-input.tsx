"use client";

import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useId, useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

type PasswordInputProps = {
  label: string;
  placeholder?: string;
  register: UseFormRegisterReturn;
  error?: string;
  autoComplete?: string;
  showLabel?: boolean;
  accent?: "blue" | "rose" | "violet";
};

export function PasswordInput({
  label,
  placeholder,
  register,
  error,
  autoComplete,
  showLabel = true,
  accent = "blue",
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = useId();
  const accentIconClass =
    accent === "rose" ? "text-rose-600" : accent === "violet" ? "text-violet-600" : "text-blue-600";
  const accentInputClass =
    accent === "rose"
      ? "focus:border-rose-500 focus:ring-rose-200"
      : accent === "violet"
        ? "focus:border-violet-500 focus:ring-violet-200"
        : "focus:border-blue-500 focus:ring-blue-200";

  return (
    <div className="space-y-2">
      {showLabel ? (
        <label htmlFor={inputId} className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <KeyRound className={`h-4 w-4 ${accentIconClass}`} />
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          id={inputId}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-label={showLabel ? undefined : label}
          className={`w-full rounded-xl border border-slate-300 bg-white/80 px-3 py-2.5 pr-11 text-slate-900 outline-none transition focus:ring-2 ${accentInputClass}`}
          {...register}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

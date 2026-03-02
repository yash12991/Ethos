export type StrengthLevel = "Weak" | "Medium" | "Strong";

export function getPasswordStrength(password: string): StrengthLevel {
  if (password.length < 8) return "Weak";

  let score = 0;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length >= 12) score += 1;

  if (score >= 4) return "Strong";
  if (score >= 2) return "Medium";
  return "Weak";
}

type StrengthIndicatorProps = {
  password: string;
};

const levelStyle: Record<StrengthLevel, string> = {
  Weak: "bg-red-500",
  Medium: "bg-amber-500",
  Strong: "bg-emerald-500",
};

export function StrengthIndicator({ password }: StrengthIndicatorProps) {
  const level = getPasswordStrength(password);
  const widthClass =
    level === "Weak" ? "w-1/3" : level === "Medium" ? "w-2/3" : "w-full";

  return (
    <div className="space-y-1" aria-live="polite">
      <div className="h-2 w-full rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-300 ${widthClass} ${levelStyle[level]}`}
        />
      </div>
      <p className="text-xs font-medium text-slate-600">Strength: {level}</p>
    </div>
  );
}

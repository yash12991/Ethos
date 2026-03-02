import type { ReactNode } from "react";

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function AuthCard({ title, subtitle, children, footer, className }: AuthCardProps) {
  return (
    <section
      aria-labelledby="auth-title"
      className={`w-full max-w-xl rounded-3xl border border-white/40 bg-linear-to-br from-white/90 via-white/85 to-blue-50/70 p-6 shadow-xl shadow-blue-950/10 backdrop-blur-xl sm:p-8 ${className ?? ""}`}
    >
      <header className="mb-6 space-y-2 text-center sm:mb-8">
        <h1 id="auth-title" className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          {title}
        </h1>
        {subtitle ? <p className="text-sm leading-relaxed text-slate-600 sm:text-base">{subtitle}</p> : null}
      </header>

      {children}

      {footer ? <footer className="mt-6 border-t border-slate-200/70 pt-4">{footer}</footer> : null}
    </section>
  );
}

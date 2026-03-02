"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ShieldCheck, Sparkles, UserRound, X, KeyRound, ArrowRight, ArrowLeft } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordInput } from "@/components/auth/password-input";
import { loginAnonUser } from "@/lib/auth-api";
import { useAuth } from "@/components/auth/auth-context";

type LoginFormValues = {
  alias: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [switchingTo, setSwitchingTo] = useState<"user" | "hr" | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryPhraseInput, setRecoveryPhraseInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginFormValues>({
    mode: "onChange",
    defaultValues: {
      alias: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      setAuthError(null);
      const response = await loginAnonUser(values);
      if (response.data) {
        login(response.data.user, response.data.tokens);
        router.push("/dashboard");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in.";
      setAuthError(message);
    }
  };

  const handleRoleSwitch = (target: "user" | "hr") => {
    if (switchingTo || target === "user") return;
    setSwitchingTo(target);
    window.setTimeout(() => {
      router.push("/hr/login");
    }, 180);
  };

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl grid-cols-1 overflow-hidden rounded-[2.5rem] border border-foreground/15 ring-1 ring-primary/15 bg-card/40 shadow-2xl shadow-primary/5 md:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.1fr_1fr] animate-in fade-in duration-700">
        <section className="relative isolate hidden overflow-hidden lg:block">
          <Image src="/granient.jpeg" alt="ETHOS secure gradient" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-black/35" />

          <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] backdrop-blur-lg animate-pulse-slow">
                <ShieldCheck className="h-4 w-4" />
                Anonymous Access
              </span>
              <h1 className="font-logo text-5xl font-black tracking-[0.22em]">ETHOS</h1>
              <p className="max-w-md text-lg leading-relaxed text-white/85">
                Securely sign in to continue anonymous reporting and case tracking.
              </p>
            </div>

            <div className="rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-md animate-float">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/80">Privacy Notice</p>
              <p className="mt-3 text-sm leading-relaxed text-white/90">
                Your identity remains isolated from investigators throughout the process.
              </p>
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center bg-linear-to-b from-white/20 to-transparent px-6 py-12 md:px-12">
          <div className="absolute -top-16 right-10 h-56 w-56 rounded-full bg-rose-200/40 blur-3xl animate-pulse-slow" />
          <div className="absolute -bottom-16 left-6 h-48 w-48 rounded-full bg-pink-200/40 blur-3xl animate-pulse-slow" />

          <div
            className={`relative z-10 w-full transition-all duration-200 ${
              switchingTo === "hr"
                ? "translate-x-2 scale-[0.985] opacity-0"
                : "translate-x-0 scale-100 opacity-100"
            } animate-[fadeSlideIn_450ms_ease-out]`}
          >
            <Link
              href="/"
              className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Home
            </Link>

            <div className="mb-4 grid grid-cols-2 rounded-xl border border-slate-200 bg-white/80 p-1">
              <button
                type="button"
                disabled
                className="rounded-lg bg-rose-600 px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.12em] text-white"
              >
                Login as User
              </button>
              <button
                type="button"
                onClick={() => handleRoleSwitch("hr")}
                disabled={Boolean(switchingTo)}
                className="rounded-lg px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.12em] text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {switchingTo === "hr" ? "Switching..." : "Login as HR"}
              </button>
            </div>

            <AuthCard
              title="Anonymous Login"
              subtitle="Access your report workspace with your anonymous alias and password."
              className="animate-in fade-in slide-in-from-bottom-2 duration-500"
              footer={
                <p className="text-center text-sm text-slate-600">
                  New here?{" "}
                  <Link href="/auth/signup" className="font-semibold text-rose-700 hover:text-rose-800">
                    Create Anonymous Account
                  </Link>
                </p>
              }
            >
              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="space-y-2">
                  <label htmlFor="alias" className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <UserRound className="h-4 w-4 text-rose-600" />
                    Anonymous Alias
                  </label>
                  <input
                    id="alias"
                    type="text"
                    placeholder="e.g. Lomira482"
                    autoComplete="username"
                    aria-invalid={Boolean(errors.alias)}
                    className="w-full rounded-xl border border-slate-300 bg-linear-to-br from-white/90 to-rose-50/70 px-3 py-2.5 text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-200"
                    {...register("alias", { required: "Anonymous alias is required." })}
                  />
                  {errors.alias ? <p className="text-xs text-red-600">{errors.alias.message}</p> : null}
                </div>

                <PasswordInput
                  label="Password"
                  accent="rose"
                  placeholder="Enter password"
                  autoComplete="current-password"
                  register={register("password", {
                    required: "Password is required.",
                  })}
                  error={errors.password?.message}
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-sm font-medium text-rose-700 hover:text-rose-800"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!isValid || isSubmitting}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-rose-700 hover:shadow-lg hover:shadow-rose-200 disabled:cursor-not-allowed disabled:bg-rose-300"
                >
                  {isSubmitting ? (
                    <>
                      <Sparkles className="h-4 w-4 animate-pulse" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Anonymous Login
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
                {authError ? <p className="text-xs text-red-600">{authError}</p> : null}
              </form>
            </AuthCard>
          </div>
        </section>
      </div>

      {showForgotModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-white/40 bg-linear-to-br from-white/95 via-rose-50/90 to-pink-100/80 p-6 shadow-2xl shadow-rose-900/20 animate-in fade-in zoom-in-95 duration-300">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 transition hover:bg-white hover:text-slate-700"
              aria-label="Close forgot password dialog"
            >
              <X className="h-4 w-4" />
            </button>

            <p className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-rose-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Recovery Check
            </p>

            <h2 className="mt-4 text-2xl font-bold text-slate-900">Forgot Password</h2>
            <p className="mt-2 text-sm text-slate-600">
              Enter the recovery phrase linked to your anonymous account.
            </p>

            <div className="mt-5 space-y-2">
              <label htmlFor="recovery-phrase" className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <KeyRound className="h-4 w-4 text-rose-600" />
                Enter Phrase
              </label>
              <input
                id="recovery-phrase"
                type="text"
                value={recoveryPhraseInput}
                onChange={(event) => setRecoveryPhraseInput(event.target.value)}
                placeholder="Enter your recovery phrase"
                className="h-11 w-full rounded-xl border border-slate-300 bg-linear-to-br from-white to-rose-50/70 px-3 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-200"
              />
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="h-10 flex-1 rounded-xl border border-slate-300 bg-white/80 text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!recoveryPhraseInput.trim()}
                className="h-10 flex-1 rounded-xl bg-rose-600 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

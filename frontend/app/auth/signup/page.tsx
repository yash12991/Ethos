"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, RefreshCcw, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordInput } from "@/components/auth/password-input";
import { RecoveryModal } from "@/components/auth/recovery-modal";
import { StrengthIndicator } from "@/components/auth/strength-indicator";
import { registerAnonUser } from "@/lib/auth-api";
import { useAuth } from "@/components/auth/auth-context";
import {
  fetchAliasSuggestions,
  fetchRecoveryPhrase,
} from "@/lib/mock-auth";

type SignupFormValues = {
  password: string;
  confirmPassword: string;
  acknowledgeRisk: boolean;
};

export default function SignupPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [selectedAlias, setSelectedAlias] = useState("");
  const [isAliasLoading, setIsAliasLoading] = useState(true);
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid, isSubmitting },
  } = useForm<SignupFormValues>({
    mode: "onChange",
    defaultValues: {
      password: "",
      confirmPassword: "",
      acknowledgeRisk: false,
    },
  });

  const password = useWatch({ control, name: "password", defaultValue: "" });
  const acknowledgeRisk = useWatch({
    control,
    name: "acknowledgeRisk",
    defaultValue: false,
  });

  const loadAliasSuggestions = async () => {
    setIsAliasLoading(true);
    const response = await fetchAliasSuggestions();
    const randomAlias = response.aliases[Math.floor(Math.random() * response.aliases.length)] ?? "";
    setSelectedAlias(randomAlias);
    setIsAliasLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAliasSuggestions();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const onSubmit = async (values: SignupFormValues) => {
    if (!selectedAlias) {
      setAuthError("Alias unavailable. Please refresh and try again.");
      await loadAliasSuggestions();
      return;
    }

    try {
      setAuthError(null);
      const response = await registerAnonUser({
        alias: selectedAlias,
        password: values.password,
      });

      if (response.data) {
        login(response.data.user, response.data.tokens);
        const phrase = await fetchRecoveryPhrase();
        setRecoveryPhrase(phrase);
        setShowRecoveryModal(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create account.";
      setAuthError(message);
    }
  };

  const canSubmit = Boolean(selectedAlias) && acknowledgeRisk && isValid && !isAliasLoading;

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
                Secure Registration
              </span>
              <h1 className="font-logo text-5xl font-black tracking-[0.22em]">ETHOS</h1>
              <p className="max-w-md text-lg leading-relaxed text-white/85">
                Your username is system-generated, your password is yours, and your identity stays protected.
              </p>
            </div>

            <div className="rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-md animate-float">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/80">Account Setup</p>
              <p className="mt-3 text-sm leading-relaxed text-white/90">
                Save your recovery phrase safely. It is required to regain access later.
              </p>
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center bg-linear-to-b from-white/20 to-transparent px-6 py-4 md:px-10">
          <div className="absolute -top-16 right-10 h-56 w-56 rounded-full bg-rose-200/40 blur-3xl animate-pulse-slow" />
          <div className="absolute -bottom-16 left-6 h-48 w-48 rounded-full bg-pink-200/40 blur-3xl animate-pulse-slow" />

          <div className="relative z-10 w-full animate-[fadeSlideIn_450ms_ease-out]">
            <Link
              href="/"
              className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Home
            </Link>

            <AuthCard
              title="Create Anonymous Account"
              subtitle=""
              className="max-w-2xl p-4 sm:p-5"
              footer={
                <p className="text-center text-sm text-slate-600">
                  Already have an account?{" "}
                  <Link href="/auth/login" className="font-semibold text-rose-700 hover:text-rose-800">
                    Anonymous Login
                  </Link>
                </p>
              }
            >
              <form className="space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
                <section className="space-y-2 rounded-2xl border border-slate-200/70 bg-linear-to-br from-white/90 to-rose-50/60 p-2.5">
                  <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <UserRound className="h-4 w-4 text-rose-600" />
                    System Generated Username
                  </h2>
                  <div className="flex gap-2">
                    <input
                      value={selectedAlias}
                      readOnly
                      placeholder={isAliasLoading ? "Generating username..." : "Username unavailable"}
                      className="h-10 flex-1 rounded-xl border border-slate-300 bg-linear-to-br from-white/90 to-rose-50/70 px-3 text-sm font-semibold text-slate-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void loadAliasSuggestions();
                      }}
                      disabled={isAliasLoading}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-linear-to-br from-white to-rose-50/60 px-3 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                      aria-label="Refresh generated username"
                    >
                      <RefreshCcw size={16} className={isAliasLoading ? "animate-spin" : ""} />
                    </button>
                  </div>
                </section>

                <section className="space-y-2.5 rounded-2xl border border-slate-200/70 bg-linear-to-br from-white/90 to-rose-100/55 p-2.5">
                  <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <KeyRound className="h-4 w-4 text-rose-600" />
                    Password Setup
                  </h2>
                  <PasswordInput
                    label="Password"
                    showLabel={false}
                    accent="rose"
                    placeholder="Enter password"
                    autoComplete="new-password"
                    register={register("password", {
                      required: "Password is required.",
                      minLength: {
                        value: 8,
                        message: "Password must be at least 8 characters.",
                      },
                    })}
                    error={errors.password?.message}
                  />
                  <StrengthIndicator password={password} />
                  <PasswordInput
                    label="Confirm Password"
                    accent="rose"
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    register={register("confirmPassword", {
                      required: "Please confirm your password.",
                      validate: (value) => value === password || "Passwords do not match.",
                    })}
                    error={errors.confirmPassword?.message}
                  />
                </section>

                <section className="rounded-2xl border border-slate-200/70 bg-linear-to-br from-white/90 to-pink-50/55 p-2.5">
                  <h2 className="mb-1.5 inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <CheckCircle2 className="h-4 w-4 text-rose-600" />
                    Confirmation
                  </h2>
                  <label className="flex items-start gap-2 text-xs text-slate-700 sm:text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-400"
                      aria-invalid={Boolean(errors.acknowledgeRisk)}
                      {...register("acknowledgeRisk", {
                        required:
                          "You must acknowledge account recovery responsibility before continuing.",
                      })}
                    />
                    I understand that if I lose my password and recovery phrase, I may permanently lose access.
                  </label>
                  {errors.acknowledgeRisk ? (
                    <p className="mt-2 text-xs text-red-600">{errors.acknowledgeRisk.message}</p>
                  ) : null}
                </section>

                <button
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-rose-700 hover:shadow-lg hover:shadow-rose-200 disabled:cursor-not-allowed disabled:bg-rose-300"
                >
                  {isSubmitting ? (
                    <>
                      <Sparkles className="h-4 w-4 animate-pulse" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create Anonymous Account
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

      <RecoveryModal
        isOpen={showRecoveryModal}
        phrase={recoveryPhrase}
        onContinue={() => {
          setShowRecoveryModal(false);
          router.push("/dashboard");
        }}
      />
    </main>
  );
}

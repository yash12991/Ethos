"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordInput } from "@/components/auth/password-input";
import { loginHrUser, verifyHrOtp } from "@/lib/auth-api";
import { useAuth } from "@/components/auth/auth-context";

type HrLoginFormValues = {
  companyId: string;
  password: string;
};

export default function HrLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [switchingTo, setSwitchingTo] = useState<"user" | "hr" | null>(null);
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [companyIdentity, setCompanyIdentity] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<HrLoginFormValues>({
    mode: "onChange",
    defaultValues: {
      companyId: "",
      password: "",
    },
  });

  const onSubmit = async (values: HrLoginFormValues) => {
    try {
      setAuthError(null);
      setOtpHint(null);

      const response = await loginHrUser({
        email: values.companyId,
        password: values.password,
      });

      const data = response.data;
      if (!data) return;

      if (data.requiresOtp && data.challengeId) {
        setCompanyIdentity(data.email || values.companyId);
        setChallengeId(data.challengeId);
        setOtp(["", "", "", "", "", ""]);
        setStep("otp");
        setOtpHint(data.otpPreview ? `OTP (dev): ${data.otpPreview}` : null);
        return;
      }

      if (data.user && data.tokens) {
        login(data.user, data.tokens);
        router.push("/hr/dashboard");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in.";
      setAuthError(message);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const nextDigit = value.replace(/\D/g, "").slice(-1);
    setOtp((previous) => {
      const updated = [...previous];
      updated[index] = nextDigit;
      return updated;
    });

    if (nextDigit && index < otpRefs.current.length - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpSubmit = async () => {
    if (otp.some((digit) => !digit) || !challengeId) {
      return;
    }

    setOtpSubmitting(true);
    setAuthError(null);

    try {
      const response = await verifyHrOtp({
        challengeId,
        otp: otp.join(""),
      });

      const data = response.data;
      if (data?.user && data.tokens) {
        login(data.user, data.tokens);
        router.push("/hr/dashboard");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "OTP verification failed.";
      setAuthError(message);
    } finally {
      setOtpSubmitting(false);
    }
  };

  const handleRoleSwitch = (target: "user" | "hr") => {
    if (switchingTo || target === "hr") return;
    setSwitchingTo(target);
    window.setTimeout(() => {
      router.push("/auth/login");
    }, 180);
  };

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl grid-cols-1 overflow-hidden rounded-[2.5rem] border border-foreground/15 ring-1 ring-violet-300/40 bg-card/40 shadow-2xl shadow-violet-200/30 md:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.1fr_1fr] animate-in fade-in duration-700">
        <section className="relative isolate hidden overflow-hidden lg:block">
          <Image src="/loginHR.jpeg" alt="HR leadership workspace" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-black/35" />

          <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] backdrop-blur-lg animate-pulse-slow">
                <ShieldCheck className="h-4 w-4" />
                HR Governance Portal
              </span>
              <h1 className="font-logo text-5xl font-black tracking-[0.22em]">ETHOS</h1>
              <p className="max-w-md text-lg leading-relaxed text-white/85">
                Secure company access for compliance response, case governance, and protected workforce support.
              </p>
            </div>

            <div className="rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-md animate-float">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/80">Enterprise Security</p>
              <p className="mt-3 text-sm leading-relaxed text-white/90">
                Every case interaction is audited while preserving whistleblower anonymity and evidence integrity.
              </p>
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center bg-linear-to-b from-white/20 to-transparent px-6 py-12 md:px-12">
          <div className="absolute -top-16 right-10 h-56 w-56 rounded-full bg-violet-200/40 blur-3xl animate-pulse-slow" />
          <div className="absolute -bottom-16 left-6 h-48 w-48 rounded-full bg-purple-200/40 blur-3xl animate-pulse-slow" />

          <div
            className={`relative z-10 w-full transition-all duration-200 ${
              switchingTo === "user"
                ? "-translate-x-2 scale-[0.985] opacity-0"
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
                onClick={() => handleRoleSwitch("user")}
                disabled={Boolean(switchingTo)}
                className="rounded-lg px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.12em] text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {switchingTo === "user" ? "Switching..." : "Login as User"}
              </button>
              <button
                type="button"
                disabled
                className="rounded-lg bg-violet-600 px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.12em] text-white"
              >
                Login as HR
              </button>
            </div>

            <AuthCard
              title={step === "credentials" ? "HR Company Login" : "Verify OTP"}
              subtitle={
                step === "credentials"
                  ? "Authorized company access only."
                  : `Enter OTP sent to ${companyIdentity || "your registered email"}.`
              }
              className="animate-in fade-in slide-in-from-bottom-2 duration-500"
            >
              {step === "credentials" ? (
                <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
                  <div className="space-y-2">
                    <label htmlFor="companyId" className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Building2 className="h-4 w-4 text-violet-600" />
                      HR Email
                    </label>
                    <div className="relative">
                      <BriefcaseBusiness className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-600/80" />
                      <input
                        id="companyId"
                        type="email"
                        placeholder="e.g. hr@company.com"
                        autoComplete="username"
                        aria-invalid={Boolean(errors.companyId)}
                        className="w-full rounded-xl border border-slate-300 bg-linear-to-br from-white/90 to-violet-50/70 px-3 py-2.5 pl-10 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                        {...register("companyId", { required: "HR email is required." })}
                      />
                    </div>
                    {errors.companyId ? <p className="text-xs text-red-600">{errors.companyId.message}</p> : null}
                  </div>

                  <PasswordInput
                    label="Password"
                    accent="violet"
                    placeholder="Enter password"
                    autoComplete="current-password"
                    register={register("password", {
                      required: "Password is required.",
                    })}
                    error={errors.password?.message}
                  />

                  <button
                    type="submit"
                    disabled={!isValid || isSubmitting}
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-200 disabled:cursor-not-allowed disabled:bg-violet-300"
                  >
                    {isSubmitting ? (
                      <>
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <KeyRound className="h-4 w-4" />
                        Continue
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-violet-200/70 bg-linear-to-br from-violet-50/80 to-white p-4">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">
                      <ShieldCheck className="h-4 w-4" />
                      Two-Factor Verification
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Enter the 6-digit OTP sent to your company email.
                    </p>
                    {otpHint ? <p className="mt-2 text-xs text-violet-700">{otpHint}</p> : null}
                  </div>

                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    {otp.map((digit, index) => (
                      <input
                        key={`otp-${index}`}
                        ref={(element) => {
                          otpRefs.current[index] = element;
                        }}
                        value={digit}
                        onChange={(event) => handleOtpChange(index, event.target.value)}
                        onKeyDown={(event) => handleOtpKeyDown(index, event)}
                        inputMode="numeric"
                        maxLength={1}
                        className="h-12 w-11 rounded-xl border border-violet-200 bg-linear-to-b from-white to-violet-50 text-center text-lg font-bold text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 sm:h-14 sm:w-12"
                        aria-label={`OTP digit ${index + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleOtpSubmit}
                    disabled={otp.some((digit) => !digit) || otpSubmitting}
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-200 disabled:cursor-not-allowed disabled:bg-violet-300"
                  >
                    {otpSubmitting ? (
                      <>
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        Verifying OTP...
                      </>
                    ) : (
                      <>
                        Verify and Continue
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep("credentials");
                      setOtp(["", "", "", "", "", ""]);
                      setChallengeId("");
                    }}
                    className="w-full rounded-xl border border-violet-200 bg-white/80 px-4 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-50"
                  >
                    Change Credentials
                  </button>
                </div>
              )}
              {authError ? <p className="text-xs text-red-600">{authError}</p> : null}
            </AuthCard>
          </div>
        </section>
      </div>
    </main>
  );
}

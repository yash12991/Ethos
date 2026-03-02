import Link from "next/link";
import { cookies } from "next/headers";
import { AlertTriangle, Bell, BookOpen, ChevronRight, HeartHandshake, ShieldCheck, Users } from "lucide-react";
import { ModernBackground } from "@/components/modern-background";

const safetyPillars = [
  {
    title: "Immediate Safety First",
    description:
      "If you are in immediate physical danger, contact emergency services first and move to a secure location.",
    icon: AlertTriangle,
  },
  {
    title: "Preserve Evidence Carefully",
    description:
      "Keep records, screenshots, dates, and related messages. Do not alter original files or delete relevant context.",
    icon: BookOpen,
  },
  {
    title: "Use Protected Channels",
    description:
      "Submit reports only through trusted and authorized ETHOS workflows to maintain confidentiality and integrity.",
    icon: ShieldCheck,
  },
  {
    title: "Seek Trusted Support",
    description:
      "Reach out to a trusted colleague, advocate, or HR liaison for emotional and procedural support.",
    icon: HeartHandshake,
  },
];

const safeActions = [
  "Document what happened with date, time, and location.",
  "Record who was present and any direct witnesses.",
  "Store files in a private and protected folder.",
  "Use neutral language and factual wording in your report.",
  "Keep your access key in a private location.",
  "Avoid sharing case details on public channels.",
];


const reportingJourney = [
  {
    step: "01",
    title: "Prepare Safely",
    description: "Capture facts first, prioritize immediate safety, and collect evidence without modifying originals.",
  },
  {
    step: "02",
    title: "Submit Securely",
    description: "Use ETHOS secure channels to file your complaint with objective details and clear chronology.",
  },
  {
    step: "03",
    title: "Track Privately",
    description: "Continue communication through protected workflows and keep your access key confidential.",
  },
];

export default async function SafetyGuidePage() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("authUser")?.value;
  let isHrUser = false;

  if (authCookie) {
    try {
      const parsed = JSON.parse(authCookie) as { userType?: string };
      isHrUser = parsed.userType === "hr";
    } catch {
      isHrUser = false;
    }
  }

  const isAuthenticated = Boolean(authCookie);
  const portalHref = isAuthenticated ? (isHrUser ? "/hr/dashboard" : "/dashboard") : "/auth/login";
  const portalLabel = isAuthenticated ? (isHrUser ? "Go to HR Dashboard" : "Go to User Dashboard") : "Enter Portal";

  return (
    <div className="relative min-h-screen text-foreground transition-colors duration-500">
      <ModernBackground />

      <header className="fixed top-0 w-full border-b border-foreground/[0.03] bg-background/60 backdrop-blur-2xl z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <span className="font-extrabold text-2xl tracking-tighter text-foreground/90 font-logo">ETHOS</span>
          </Link>

          <div className="flex items-center gap-10">
            <nav className="hidden lg:flex items-center gap-10 text-[13px] font-bold uppercase tracking-widest text-muted-foreground/80">
              <Link href="/safety-guide" className="text-primary transition-colors">Safety Guide</Link>
              <Link href="/legal-framework" className="hover:text-primary transition-colors">Legal Framework</Link>
            </nav>

            <div className="h-6 w-px bg-foreground/[0.08] hidden lg:block" />

            <Link
              href={portalHref}
              className="hidden sm:block bg-foreground text-background px-7 py-2.5 rounded-full font-bold text-xs uppercase tracking-widest hover:translate-y-[-2px] hover:shadow-xl transition-all active:scale-95"
            >
              {portalLabel}
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-28 pb-24 space-y-14">
        <section className="max-w-6xl mx-auto px-6">
          <article className="rounded-[3rem] border border-foreground/[0.05] bg-background/70 glass p-10 md:p-20 text-center">
            <div className="inline-flex items-center gap-2.5 px-6 py-2 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-[0.3em] mb-6">
              <Bell className="w-3.5 h-3.5" />
              Certified Disclosure Protocol
            </div>

            <h1 className="text-4xl md:text-7xl font-black tracking-[-0.035em] leading-tight text-balance">
              A professional safety guide for calm, secure reporting.
            </h1>

            <p className="mt-8 text-lg md:text-2xl text-muted-foreground leading-relaxed font-medium max-w-4xl mx-auto">
              Follow this playbook before submitting an ETHOS complaint. It keeps evidence intact, preserves anonymity, and shows investigators exactly what happened—without exposing you.
            </p>

            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/dashboard/file-complaint"
                className="group w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-10 py-5 rounded-2xl font-bold text-sm uppercase tracking-[0.3em] flex items-center justify-center gap-2.5 transition-all hover:-translate-y-0.5 shadow-2xl shadow-primary/30"
              >
                File complaint
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/legal-framework"
                className="w-full sm:w-auto border border-foreground/[0.08] bg-card/40 hover:bg-card/60 px-10 py-5 rounded-2xl font-bold text-sm uppercase tracking-[0.3em] transition-all"
              >
                Review obligations
              </Link>
            </div>

            <p className="mt-8 text-[12px] uppercase tracking-[0.45em] font-bold text-muted-foreground/80">
              HR and legal teams share this link with every workforce.
            </p>
          </article>
        </section>

        <section className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col gap-6">
            <div className="rounded-[2.5rem] border border-foreground/[0.04] bg-white/[0.02] glass p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.45em] text-muted-foreground">Core protections</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {safetyPillars.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className="rounded-[1.75rem] border border-foreground/[0.05] bg-background/60 p-8 hover:-translate-y-1 transition-all"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-6 text-primary">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-extrabold tracking-tight mb-3">{item.title}</h2>
                    <p className="text-muted-foreground text-[15px] leading-relaxed font-medium">{item.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <article className="lg:col-span-3 rounded-[2.5rem] border border-accent/15 bg-linear-to-br from-primary/5 via-background/40 to-accent/5 p-10">
              <div className="inline-flex items-center gap-2 text-primary font-black text-[11px] uppercase tracking-[0.22em] mb-6">
                <Users className="w-4 h-4" />
                Step-by-step checklist
              </div>

              <ol className="space-y-5 list-decimal pl-5 marker:text-primary marker:font-black">
                {safeActions.map((action) => (
                  <li key={action} className="text-[15px] md:text-base font-medium leading-relaxed text-muted-foreground">
                    {action}
                  </li>
                ))}
              </ol>
            </article>

            <article className="lg:col-span-2 rounded-[2.5rem] border border-foreground/[0.04] glass bg-card/40 p-10">
              <h3 className="text-2xl font-black tracking-tight mb-4">Important note</h3>
              <p className="text-muted-foreground font-medium leading-relaxed mb-8">
                ETHOS preserves confidentiality and data integrity, but regulatory duties may still require direct legal
                consultation. Confirm local obligations before sharing sensitive material externally.
              </p>

              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-foreground text-background font-bold text-xs uppercase tracking-[0.3em] hover:opacity-90 transition-opacity"
              >
                Continue to secure access
                <ChevronRight className="w-4 h-4" />
              </Link>
            </article>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6">
          <div className="rounded-[2.5rem] border border-foreground/[0.05] bg-background/60 glass p-10">
            <div className="inline-flex items-center gap-2 text-primary font-black text-[11px] uppercase tracking-[0.22em] mb-8">
              <Users className="w-4 h-4" />
              Reporting journey
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {reportingJourney.map((item) => (
                <article
                  key={item.step}
                  className="rounded-[1.75rem] border border-foreground/[0.04] bg-card/40 p-6 flex flex-col gap-3"
                >
                  <p className="text-4xl font-black text-foreground/10">{item.step}</p>
                  <h3 className="text-xl font-extrabold tracking-tight">{item.title}</h3>
                  <p className="text-muted-foreground text-[15px] leading-relaxed font-medium flex-1">{item.description}</p>
                  <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground/70">Encrypted thread</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6">
          <div className="rounded-[2.5rem] border border-foreground/[0.04] bg-zinc-950 text-white p-10 md:p-14 text-center">
            <h3 className="text-3xl md:text-5xl font-black tracking-tight">Report with confidence, not exposure.</h3>
            <p className="mt-5 text-white/75 max-w-3xl mx-auto text-sm md:text-base font-medium leading-relaxed">
              ETHOS combines anonymous intake, legal-grade evidence handling, and human support so teams can respond
              fast without compromising the reporter’s identity.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/dashboard/file-complaint"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-[0.35em] hover:opacity-90 transition-opacity"
              >
                Start secure report
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl border border-white/20 text-white font-black text-xs uppercase tracking-[0.35em] hover:bg-white/10 transition-colors"
              >
                Back to home
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

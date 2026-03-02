import Link from "next/link";
import { cookies } from "next/headers";
import { Bell, BookOpen, CheckCircle2, ChevronRight, FileText, Gavel, Scale, ShieldCheck } from "lucide-react";
import { ModernBackground } from "@/components/modern-background";

const legalPillars = [
  {
    title: "Due Process",
    description:
      "Every complaint should be reviewed with procedural fairness, clear chronology, and documented case handling.",
    icon: Scale,
  },
  {
    title: "Confidential Handling",
    description:
      "Case information should be shared strictly on a need-to-know basis with role-based access and secure storage.",
    icon: ShieldCheck,
  },
  {
    title: "Non-retaliation Principle",
    description:
      "Reporters must be protected against retaliation and adverse action during and after case investigation.",
    icon: Gavel,
  },
  {
    title: "Record Integrity",
    description:
      "Preserve evidence and communication records in original form to support auditable and lawful outcomes.",
    icon: FileText,
  },
];

const frameworkChecklist = [
  "Capture objective facts, dates, and scope of incident.",
  "Separate allegation statements from assumptions.",
  "Preserve source records in tamper-resistant storage.",
  "Limit access by investigator and policy role.",
  "Maintain timeline of all case interactions.",
  "Close cases with documented rationale and action.",
];

export default async function LegalFrameworkPage() {
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
              <Link href="/safety-guide" className="hover:text-primary transition-colors">Safety Guide</Link>
              <Link href="/legal-framework" className="text-primary transition-colors">Legal Framework</Link>
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

      <main className="pt-28 pb-28 space-y-16">
        <section className="max-w-6xl mx-auto px-6">
          <article className="rounded-[3rem] border border-foreground/[0.04] bg-background/70 glass p-10 md:p-20 text-center">
            <div className="inline-flex items-center gap-2.5 px-6 py-2 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-[0.3em] mb-6">
              <Bell className="w-3.5 h-3.5" />
              Legal & Compliance Foundations
            </div>

            <h1 className="text-4xl md:text-7xl font-black tracking-[-0.035em] leading-tight text-balance">
              Legal Framework for protected reporting.
            </h1>

            <p className="mt-8 text-lg md:text-2xl text-muted-foreground leading-relaxed font-medium max-w-4xl mx-auto">
              A practical baseline for lawful, fair, and confidential handling of reports. Use this framework to keep each case review structured, defensible, and policy-aligned.
            </p>

            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/dashboard/file-complaint"
                className="group w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-10 py-5 rounded-2xl font-bold text-sm uppercase tracking-[0.3em] flex items-center justify-center gap-2.5 transition-all hover:-translate-y-0.5 shadow-2xl shadow-primary/30"
              >
                File Complaint
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/safety-guide"
                className="w-full sm:w-auto border border-foreground/[0.08] bg-card/40 hover:bg-card/60 px-10 py-5 rounded-2xl font-bold text-sm uppercase tracking-[0.3em] transition-all"
              >
                Open Safety Guide
              </Link>
            </div>
          </article>
        </section>

        <section className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col gap-6">
            <div className="rounded-[2.5rem] border border-foreground/[0.04] bg-white/[0.02] glass p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.45em] text-muted-foreground">Compliance anchors</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {legalPillars.map((item) => {
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
                <BookOpen className="w-4 h-4" />
                Case handling checklist
              </div>

              <ol className="space-y-5 list-decimal pl-5 marker:text-primary marker:font-black">
                {frameworkChecklist.map((item) => (
                  <li key={item} className="text-[15px] md:text-base font-medium leading-relaxed text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ol>
            </article>

            <article className="lg:col-span-2 rounded-[2.5rem] border border-foreground/[0.04] glass bg-card/40 p-10">
              <h3 className="text-2xl font-black tracking-tight mb-4">Jurisdiction note</h3>
              <p className="text-muted-foreground font-medium leading-relaxed mb-8">
                This framework reinforces consistent intake, but local legislation and collective agreements may change consent, retention, or disclosure requirements. Validate obligations with counsel before cross-border sharing.
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
      </main>
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  Bot,
  ClipboardList,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { useAuth } from "@/components/auth/auth-context";
import { listMyComplaints, type ComplaintRecord } from "@/lib/auth-api";

function complaintDisplayStatus(complaint: ComplaintRecord): "pending" | "resolved" | "rejected" {
  if (complaint.display_status) return complaint.display_status;
  if (complaint.status === "resolved") return "resolved";
  if (complaint.status === "rejected") return "rejected";
  return "pending";
}

export default function DashboardPage() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const anonAlias = user?.anon_alias || "Anonymous";
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const items = await listMyComplaints();
        if (active) setComplaints(items);
      } catch {
        if (active) setComplaints([]);
      } finally {
        if (active) setLoadingComplaints(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = complaints.length;
    const active = complaints.filter((item) => complaintDisplayStatus(item) === "pending").length;
    const resolved = complaints.filter((item) => complaintDisplayStatus(item) === "resolved").length;
    const rejected = complaints.filter((item) => complaintDisplayStatus(item) === "rejected").length;
    return { total, active, resolved, rejected };
  }, [complaints]);

  const recentComplaints = useMemo(
    () => [...complaints].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 4),
    [complaints]
  );

  const toStatusLabel = (status: "pending" | "resolved" | "rejected") => {
    if (status === "resolved") return "Resolved";
    if (status === "rejected") return "Rejected";
    return "Pending";
  };

  const links = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "File Complaint",
      href: "/dashboard/file-complaint",
      icon: <FilePlus2 className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "My Complaints",
      href: "/dashboard/my-complaints",
      icon: <ClipboardList className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Messages",
      href: "/dashboard/messages",
      icon: <MessageSquare className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Ethos AI",
      href: "/dashboard/support",
      icon: <Bot className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Profile",
      href: "/dashboard/profile",
      icon: <UserRound className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Logout",
      href: "#",
      onClick: logout,
      icon: <LogOut className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
  ];

  return (
    <main className="employee-theme-page h-screen w-screen overflow-hidden bg-linear-to-b from-slate-100 via-indigo-50/30 to-rose-50/20">
      <div className="flex h-full w-full flex-col overflow-hidden border border-slate-200 bg-white/90 shadow-2xl shadow-slate-900/5 backdrop-blur-xl md:flex-row">
        <Sidebar open={open} setOpen={setOpen}>
          <SidebarBody className="justify-between gap-10">
            <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
              {open ? <BrandLogo /> : <BrandIcon />}
              <div className="mt-8 flex flex-col gap-2">
                {links.map((link, idx) => (
                  <SidebarLink key={idx} link={link} />
                ))}
              </div>
            </div>
            <SidebarLink
              link={{
                label: "Employee",
                href: "/dashboard",
                icon: (
                  <Image
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80"
                    className="h-7 w-7 flex-shrink-0 rounded-full"
                    width={50}
                    height={50}
                    alt="Employee avatar"
                  />
                ),
              }}
            />
          </SidebarBody>
        </Sidebar>

        <section className="flex-1 overflow-y-auto">
          <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-slate-200 bg-white/80 px-5 py-4 backdrop-blur-xl md:flex-row md:items-center md:justify-between md:px-8">
            <div>
              <h1 className="font-logo text-3xl font-black tracking-[0.14em] text-slate-900">ETHOS DASHBOARD</h1>
            </div>

            <nav className="flex items-center gap-2 pt-12 md:mr-16 md:gap-3 md:pt-0">
              <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                <Bell className="h-4 w-4" />
                Alerts
              </button>
              <button
                onClick={logout}
                className="inline-flex h-10 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Exit Dashboard
              </button>
            </nav>
          </header>

          <section className="space-y-5 p-5 md:p-8">
            <article className="rounded-2xl border border-indigo-100 bg-linear-to-r from-indigo-50/70 via-white to-sky-50/60 p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Anonymous Session</p>
              <div className="mt-2 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <h2 className="text-lg font-semibold text-slate-900"> {anonAlias.toUpperCase()}</h2>
                <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Your identity is protected.
                </p>
              </div>
            </article>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total Complaints" value={String(stats.total)} subtext="All-time reports" trend={loadingComplaints ? "Loading..." : "Synced with backend"} tone="indigo" />
              <StatCard label="Active Cases" value={String(stats.active)} subtext="Submitted + under review" trend="Track in My Complaints" tone="amber" />
              <StatCard label="Resolved Cases" value={String(stats.resolved)} subtext="Resolved successfully" trend="Latest backend data" tone="emerald" />
              <StatCard label="Rejected Cases" value={String(stats.rejected)} subtext="Closed as rejected" trend="Review details page" tone="rose" />
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2">
                <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Recent Complaints</h3>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th className="pb-2">Complaint ID</th>
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2 text-right">View</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700">
                      {recentComplaints.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
                          <td className="py-3 font-medium text-slate-900">{row.complaint_code}</td>
                          <td className="py-3">{new Date(row.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                          <td className="py-3">
                            <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                              {toStatusLabel(complaintDisplayStatus(row))}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <Link
                              href="/dashboard/my-complaints"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              View <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {!loadingComplaints && recentComplaints.length === 0 ? (
                        <tr>
                          <td className="py-3 text-slate-600" colSpan={4}>No complaints filed yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Case Progress Snapshot</h3>
                <div className="mt-6">
                  <div className="relative h-2 rounded-full bg-slate-200">
                    <div className="h-2 w-[68%] rounded-full bg-linear-to-r from-indigo-600 to-violet-600" />
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] font-semibold text-slate-600">
                    <span>Submitted</span>
                    <span>HR Review</span>
                    <span>Committee</span>
                    <span className="text-right">Closed</span>
                  </div>
                </div>

                <h4 className="mt-8 text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Latest Message Preview</h4>
                <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/70 p-3 text-sm text-violet-900">
                  You have 1 new message
                </div>
                <Link
                  href="/dashboard/messages"
                  className="mt-3 inline-flex rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  View Chat
                </Link>
              </article>
            </div>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Quick Actions</h3>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/dashboard/file-complaint"
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <FilePlus2 className="h-4 w-4" />
                  File New Complaint
                </Link>
                <Link
                  href="/dashboard/messages"
                  className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                >
                  <MessageSquare className="h-4 w-4" />
                  Open Messages
                </Link>
                <Link
                  href="/dashboard/my-complaints"
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <Upload className="h-4 w-4" />
                  Upload Evidence
                </Link>
              </div>
            </article>

            <div className="grid gap-4 xl:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2">
                <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Recent Activity</h3>
                <div className="mt-4 space-y-3">
                  {[
                    { text: "Complaint AX-2041 moved to HR Review" },
                    { text: "New message received from HR for AX-1932" },
                    { text: "Evidence uploaded successfully to AX-1988" },
                  ].map((item) => (
                    <div key={item.text} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      {item.text}
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Action Center</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
                    2 cases need your response within 48 hours.
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
                    Keep evidence uploads under 20MB per file.
                  </div>
                </div>
              </article>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value, subtext, trend, tone }: { label: string; value: string; subtext: string; trend: string; tone: "indigo" | "amber" | "emerald" | "rose" }) {
  const toneStyles = {
    indigo: "border-indigo-200 bg-indigo-50/70 text-indigo-700",
    amber: "border-amber-200 bg-amber-50/70 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-700",
    rose: "border-rose-200 bg-rose-50/70 text-rose-700",
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{subtext}</p>
      <p className={`mt-3 inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold ${toneStyles[tone]}`}>{trend}</p>
    </article>
  );
}

const BrandLogo = () => {
  return (
    <Link href="/" className="flex items-center py-1 text-sm">
      <span className="font-semibold tracking-[0.14em] text-white">ETHOS</span>
    </Link>
  );
};

const BrandIcon = () => {
  return (
    <Link href="/" className="flex items-center py-1 text-sm">
      <ShieldCheck className="h-5 w-5 text-white" />
    </Link>
  );
};

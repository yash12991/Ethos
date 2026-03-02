"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  FileSearch,
  History,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Search,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { LoadingState } from "@/components/ui/LoadingState";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { useAuth } from "@/components/auth/auth-context";
import { fetchHrHistory, type ComplaintRecord, type HrQueueRecord } from "@/lib/auth-api";

function statusLabel(status: ComplaintRecord["status"]) {
  if (status === "under_review") return "Under Review";
  if (status === "resolved") return "Resolved";
  if (status === "rejected") return "Rejected";
  return "Submitted";
}

function statusTone(status: ComplaintRecord["status"]) {
  if (status === "under_review") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "resolved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function priorityLabel(score: number) {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function formatDate(value: string | null) {
  if (!value) return "Not specified";
  return new Date(value).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export default function HrHistoryPage() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

  const [historyRows, setHistoryRows] = useState<HrQueueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "resolved" | "rejected">("all");

  const links = [
    {
      label: "HR Dashboard",
      href: "/hr/dashboard",
      icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Queue",
      href: "/hr/dashboard/queue",
      icon: <ClipboardList className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "History",
      href: "/hr/dashboard/history",
      icon: <History className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Evidence & Timeline",
      href: "/hr/dashboard/evidence-timeline",
      icon: <FileSearch className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Pattern Detection",
      href: "/hr/dashboard/pattern-detection",
      icon: <Users className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Messages",
      href: "/hr/dashboard/messages",
      icon: <MessageSquare className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Notifications",
      href: "/hr/dashboard/notifications",
      icon: <TriangleAlert className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Logs",
      href: "/hr/dashboard/logs",
      icon: <ShieldCheck className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Logout",
      href: "#",
      onClick: logout,
      icon: <LogOut className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
  ];

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const data = await fetchHrHistory();
        if (!active) return;
        const safeData = Array.isArray(data) ? data : [];
        setHistoryRows(safeData);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load history.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    let rows = [...historyRows];

    const query = search.trim().toLowerCase();
    if (query.length > 0) {
      rows = rows.filter((item) => {
        return (
          item.complaint_code.toLowerCase().includes(query) ||
          item.accused_employee_hash.toLowerCase().includes(query)
        );
      });
    }

    if (statusFilter !== "all") {
      rows = rows.filter((item) => item.status === statusFilter);
    }

    rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return rows;
  }, [historyRows, search, statusFilter]);

  const summary = useMemo(() => {
    const total = historyRows.length;
    const resolved = historyRows.filter((item) => item.status === "resolved").length;
    const rejected = historyRows.filter((item) => item.status === "rejected").length;
    return { total, resolved, rejected };
  }, [historyRows]);

  return (
    <main className="hr-theme-page hr-theme-queue h-screen w-screen overflow-hidden bg-linear-to-b from-slate-100 via-white to-blue-50/40">
      <div className="hr-theme-shell flex h-full w-full flex-col overflow-hidden border border-slate-200/70 bg-white/85 shadow-2xl shadow-slate-900/5 backdrop-blur-xl md:flex-row">
        <Sidebar open={open} setOpen={setOpen}>
          <SidebarBody className="justify-between gap-10">
            <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
              {open ? <HrBrandLogo /> : <HrBrandIcon />}
              <div className="mt-8 flex flex-col gap-2">
                {links.map((link, idx) => (
                  <SidebarLink key={idx} link={link} />
                ))}
              </div>
            </div>
            <SidebarLink
              link={{
                label: "HR Manager",
                href: "/hr/dashboard",
                icon: (
                  <Image
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80"
                    className="h-7 w-7 flex-shrink-0 rounded-full"
                    width={50}
                    height={50}
                    alt="HR manager avatar"
                  />
                ),
              }}
            />
          </SidebarBody>
        </Sidebar>

        <section className="flex-1 overflow-x-hidden overflow-y-auto">
          <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 px-5 py-4 backdrop-blur-xl md:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-black tracking-[0.12em] text-slate-900">Case History</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Closed complaints handled by you are listed here. Cases from other HR users are not shown.
                </p>
              </div>
            </div>
          </header>

          {error ? (
            <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 md:mx-8">{error}</div>
          ) : null}

          {loading ? (
            <LoadingState
              fullScreen={false}
              className="min-h-[calc(100vh-16rem)] px-5 py-6 md:px-8"
              messages={[
                "Collecting complaint history...",
                "Preparing records...",
                "Loading closed cases...",
              ]}
            />
          ) : (
            <section className="p-5 md:p-8">
              <div className="grid gap-4 sm:grid-cols-3">
                <SummaryCard label="Total Closed" value={summary.total} tone="slate" />
                <SummaryCard label="Resolved" value={summary.resolved} tone="sky" />
                <SummaryCard label="Rejected" value={summary.rejected} tone="rose" />
              </div>

              <div className="mt-5">
                <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">History List</h2>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search complaint or accused"
                          className="h-9 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-700 outline-none ring-violet-500 transition focus:ring-2"
                        />
                      </label>

                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none"
                      >
                        <option value="all">All Closed</option>
                        <option value="resolved">Resolved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-hidden">
                    <table className="w-full table-fixed text-left text-sm leading-5">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                          <th className="w-[22%] pb-2 pr-2">Complaint ID</th>
                          <th className="w-[16%] pb-2 pr-2">Status</th>
                          <th className="w-[12%] pb-2 pr-2">Priority</th>
                          <th className="w-[12%] pb-2 pr-2">Severity</th>
                          <th className="w-[18%] pb-2 pr-2">Incident Date</th>
                          <th className="w-[20%] pb-2">Closed At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((item) => (
                          <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                            <td className="py-2 pr-2 font-semibold text-slate-900">{item.complaint_code}</td>
                            <td className="py-2 pr-2">
                              <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(item.status)}`}>
                                {item.status_label || statusLabel(item.status)}
                              </span>
                            </td>
                            <td className="py-2 pr-2 text-slate-700">{priorityLabel(item.severity_score)}</td>
                            <td className="py-2 pr-2 text-slate-700">{item.severity_score}</td>
                            <td className="py-2 pr-2 text-slate-700">{formatDate(item.incident_date)}</td>
                            <td className="py-2 text-slate-700">{formatDate(item.updated_at)}</td>
                          </tr>
                        ))}

                        {filteredRows.length === 0 ? (
                          <tr>
                            <td className="py-4 text-slate-600" colSpan={6}>
                              No history found for your resolved/rejected cases.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </article>
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "slate" | "sky" | "rose" }) {
  const tones = {
    slate: "border-slate-200 bg-white",
    sky: "border-sky-200 bg-sky-50/70",
    rose: "border-rose-200 bg-rose-50/70",
  };

  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
    </article>
  );
}

const HrBrandLogo = () => {
  return (
    <Link href="/" className="flex items-center py-1 text-sm">
      <span className="font-semibold tracking-[0.14em] text-white">ETHOS</span>
    </Link>
  );
};

const HrBrandIcon = () => {
  return (
    <Link href="/" className="flex items-center py-1 text-sm">
      <ShieldCheck className="h-5 w-5 text-white" />
    </Link>
  );
};

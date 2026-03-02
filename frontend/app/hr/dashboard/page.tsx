"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ClipboardList,
  FileSearch,
  History,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { LoadingState, LoadingTableSkeleton } from "@/components/ui/LoadingState";
import { useAuth } from "@/components/auth/auth-context";
import {
  fetchHrDashboardDepartmentRisk,
  fetchHrDashboardOverview,
  type HrDashboardOverviewRecord,
  type HrDepartmentRiskRecord,
} from "@/lib/auth-api";

function deltaPercent(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function formatDelta(delta: number) {
  if (delta > 0) return `+${delta}%`;
  if (delta < 0) return `${delta}%`;
  return "0%";
}

const EMPTY_OVERVIEW: HrDashboardOverviewRecord = {
  total_today: 0,
  total_yesterday: 0,
  total_month: 0,
  under_hr_review: 0,
  under_committee_review: 0,
  active_cases: 0,
  closed_cases: 0,
  high_risk_cases: 0,
  stale_cases: 0,
  status_funnel: {
    submitted: 0,
    under_review: 0,
    resolved: 0,
    rejected: 0,
  },
  weekly_trend: [0, 0, 0, 0, 0, 0, 0],
  pattern_profile_count: 0,
  alerts: [],
};

export default function HrDashboardPage() {
  const [open, setOpen] = useState(false);
  const { logout, user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewData, setOverviewData] = useState<HrDashboardOverviewRecord>(EMPTY_OVERVIEW);
  const [departmentRisk, setDepartmentRisk] = useState<HrDepartmentRiskRecord[]>([]);
  const [departmentRiskLoading, setDepartmentRiskLoading] = useState(true);

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
    setOverviewLoading(true);

    (async () => {
      try {
        const overview = await fetchHrDashboardOverview();

        if (!active) return;
        setOverviewData(overview || EMPTY_OVERVIEW);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load HR dashboard overview.");
      } finally {
        if (active) setOverviewLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setDepartmentRiskLoading(true);

    (async () => {
      try {
        const data = await fetchHrDashboardDepartmentRisk();
        if (!active) return;
        setDepartmentRisk(Array.isArray(data) ? data : []);
      } catch {
        if (!active) return;
        setDepartmentRisk([]);
      } finally {
        if (active) setDepartmentRiskLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const overview = useMemo(() => {
    return {
      totalToday: overviewData.total_today,
      totalMonth: overviewData.total_month,
      activeCases: overviewData.active_cases,
      underHrReview: overviewData.under_hr_review,
      underCommitteeReview: overviewData.under_committee_review,
      closedCases: overviewData.closed_cases,
      highRiskCases: overviewData.high_risk_cases,
      staleCases: overviewData.stale_cases,
      todayDelta: deltaPercent(overviewData.total_today, overviewData.total_yesterday),
    };
  }, [overviewData]);

  const weeklyTrend =
    Array.isArray(overviewData.weekly_trend) && overviewData.weekly_trend.length === 7
      ? overviewData.weekly_trend
      : [0, 0, 0, 0, 0, 0, 0];

  const statusMix = useMemo(() => {
    const submitted = overviewData.status_funnel.submitted || 0;
    const underReview = overviewData.status_funnel.under_review || 0;
    const resolved = overviewData.status_funnel.resolved || 0;
    const rejected = overviewData.status_funnel.rejected || 0;
    const max = Math.max(submitted, underReview, resolved, rejected, 1);

    return {
      rows: [
        { label: "Submitted", value: submitted, tone: "bg-sky-500" },
        { label: "Under Review", value: underReview, tone: "bg-amber-500" },
        { label: "Resolved", value: resolved, tone: "bg-emerald-500" },
        { label: "Rejected", value: rejected, tone: "bg-rose-500" },
      ],
      max,
    };
  }, [overviewData.status_funnel]);

  const alertsPreview = useMemo(() => {
    const safeAlerts = overviewData.alerts || [];
    if (safeAlerts.length === 0) {
      return [
        { label: "No active pattern alerts", count: 0 },
        { label: "No risk spike alerts", count: 0 },
        { label: "No credibility alerts", count: 0 },
      ];
    }

    return safeAlerts
      .slice(0, 3)
      .map((item) => ({ label: item.label || item.type || "Alert", count: item.count || 0 }));
  }, [overviewData.alerts]);

  return (
    <main className="hr-theme-page hr-theme-dashboard h-screen w-screen overflow-hidden bg-linear-to-b from-slate-100 via-white to-blue-50/40">
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

        <section className="flex-1 overflow-y-auto">
          <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 px-5 py-4 backdrop-blur-xl md:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-3xl font-black tracking-[0.12em] text-slate-900">HR Dashboard</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Queue operations are moved to the dedicated Queue page. This dashboard now focuses on trends, risk, and governance insights.
                </p>
              </div>

              <div className="flex items-center gap-2 md:mr-20">
                <Link
                  href="/hr/dashboard/queue"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <ClipboardList className="h-4 w-4" />
                  Open Queue
                </Link>
                <Link
                  href="/hr/dashboard/history"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <History className="h-4 w-4" />
                  Open History
                </Link>
                <button
                  onClick={logout}
                  className="inline-flex h-10 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          {error ? (
            <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 md:mx-8">{error}</div>
          ) : null}

          {overviewLoading ? (
            <LoadingState
              fullScreen={false}
              className="min-h-[calc(100vh-14rem)] px-5 py-6 md:px-8"
              showSkeletonCards
            />
          ) : (
          <section className="space-y-5 p-5 md:p-8">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard title="Complaints Today" value={overview.totalToday} sub={`Δ ${formatDelta(overview.todayDelta)}`} tone="violet" />
              <MetricCard title="This Month" value={overview.totalMonth} sub="Current cycle" tone="blue" />
              <MetricCard title="Active Cases" value={overview.activeCases} sub="HR + committee" tone="amber" />
              <MetricCard title="Pattern Profiles" value={overviewData.pattern_profile_count} sub="Tracked accused" tone="emerald" />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Complaint Trend (Last 7 Days)</h2>
                <div className="mt-4">
                  <TrendChart values={weeklyTrend} />
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Risk Snapshot</h2>
                <div className="mt-4 space-y-2.5 text-sm">
                  <RiskLine label="High-Risk Open Cases" value={overview.highRiskCases} tone="rose" />
                  <RiskLine label="Cases Pending > 7 Days" value={overview.staleCases} tone="amber" />
                  <RiskLine label="Under HR Review" value={overview.underHrReview} tone="sky" />
                  <RiskLine label="Under Committee Review" value={overview.underCommitteeReview} tone="violet" />
                  <RiskLine label="Closed Cases" value={overview.closedCases} tone="emerald" />
                </div>
              </article>
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Status Distribution</h2>
                <div className="mt-4 space-y-3">
                  {statusMix.rows.map((item) => {
                    const width = Math.max(6, Math.round((item.value / statusMix.max) * 100));
                    return (
                      <div key={item.label}>
                        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
                          <span>{item.label}</span>
                          <span>{item.value}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div className={`h-2 rounded-full ${item.tone}`} style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Priority Alerts</h2>
                <div className="mt-4 space-y-2.5">
                  {alertsPreview.map((alert, index) => (
                    <div key={`${alert.label}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <p className="font-semibold text-slate-800">{alert.label}</p>
                      <p className="text-xs text-slate-600">Count: {alert.count}</p>
                    </div>
                  ))}
                </div>
                <Link
                  href="/hr/dashboard/pattern-detection"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Bell className="h-3.5 w-3.5" />
                  View Pattern Alerts
                </Link>
              </article>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Top Department Risk</h2>
                {departmentRiskLoading ? (
                  <LoadingTableSkeleton className="mt-4" rows={6} cols={5} />
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.1em] text-slate-500">
                          <th className="pb-2">Area</th>
                          <th className="pb-2 text-right">High</th>
                          <th className="pb-2 text-right">Medium</th>
                          <th className="pb-2 text-right">Low</th>
                          <th className="pb-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departmentRisk.map((item) => (
                          <tr key={item.name} className="border-b border-slate-100 last:border-b-0">
                            <td className="py-2.5 font-semibold text-slate-900">{item.name}</td>
                            <td className="py-2.5 text-right text-rose-700">{item.high}</td>
                            <td className="py-2.5 text-right text-amber-700">{item.medium}</td>
                            <td className="py-2.5 text-right text-sky-700">{item.low}</td>
                            <td className="py-2.5 text-right font-semibold text-slate-800">{item.total}</td>
                          </tr>
                        ))}

                        {departmentRisk.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-3 text-slate-600">
                              No department risk data available.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>

              <article className="rounded-2xl border border-slate-200 bg-linear-to-br from-slate-50 to-violet-50 p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Governance Notes</h2>
                <div className="mt-4 space-y-2.5 text-sm text-slate-700">
                  <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">Queue workflow maintained in dedicated Queue page for cleaner incident operations.</p>
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">Identity protection active: analyst views remain complaint-code based.</p>
                  <p className="rounded-lg border border-slate-300 bg-white px-3 py-2">Use Pattern Detection page for profile-level trends and deeper risk analytics.</p>
                </div>

                <p className="mt-4 inline-flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5" />
                  Risk flags support triage and review prioritization. Final decisions require human assessment.
                </p>
              </article>
            </section>
          </section>
          )}
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  title,
  value,
  sub,
  tone,
}: {
  title: string;
  value: number;
  sub: string;
  tone: "violet" | "blue" | "amber" | "emerald";
}) {
  const toneClasses = {
    violet: "border-violet-200 bg-violet-50/70",
    blue: "border-blue-200 bg-blue-50/70",
    amber: "border-amber-200 bg-amber-50/70",
    emerald: "border-emerald-200 bg-emerald-50/70",
  };

  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-600">{title}</p>
      <p className="mt-1 text-3xl font-black text-slate-900">{value}</p>
      <p className="text-xs text-slate-600">{sub}</p>
    </article>
  );
}

function TrendChart({ values }: { values: number[] }) {
  const safeValues = values.length > 0 ? values : [0];
  const labels = ["D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "Today"];
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);

  const width = 620;
  const height = 220;
  const paddingX = 30;
  const paddingY = 20;

  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;

  const points = safeValues.map((value, index) => {
    const x = paddingX + (index * plotWidth) / Math.max(safeValues.length - 1, 1);
    const normalized = (value - min) / Math.max(max - min, 1);
    const y = paddingY + (1 - normalized) * plotHeight;
    return { x, y, value };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? paddingX} ${height - paddingY} L ${points[0]?.x ?? paddingX} ${height - paddingY} Z`;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full" role="img" aria-label="Complaints trend line chart">
        <defs>
          <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((step) => {
          const y = paddingY + (plotHeight * step) / 3;
          return (
            <line
              key={step}
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          );
        })}

        <path d={areaPath} fill="url(#trendArea)" />
        <path d={linePath} fill="none" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((point, index) => (
          <g key={`${point.x}-${point.y}-${index}`}>
            <circle cx={point.x} cy={point.y} r="4" fill="#7c3aed" />
            <text x={point.x} y={height - 6} textAnchor="middle" className="fill-slate-500" fontSize="10" fontWeight="600">
              {labels[index] || `D-${safeValues.length - 1 - index}`}
            </text>
            <text x={point.x} y={point.y - 10} textAnchor="middle" className="fill-slate-700" fontSize="10" fontWeight="700">
              {point.value}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function RiskLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "rose" | "amber" | "sky" | "violet" | "emerald";
}) {
  const toneMap = {
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${toneMap[tone]}`}>
      <span className="font-medium">{label}</span>
      <span className="text-lg font-black">{value}</span>
    </div>
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

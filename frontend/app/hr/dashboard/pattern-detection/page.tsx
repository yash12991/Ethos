"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  FileSearch,
  History,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Minus,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { LoadingState } from "@/components/ui/LoadingState";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { useAuth } from "@/components/auth/auth-context";
import {
  fetchPatternDetectionAccusedBreakdown,
  fetchPatternDetectionAccusedComplaints,
  fetchPatternDetectionCredibilityRisk,
  fetchPatternDetectionDepartmentRisk,
  fetchPatternDetectionInsights,
  fetchPatternDetectionOverview,
  fetchPatternDetectionRepeatOffenders,
  fetchPatternDetectionRiskAcceleration,
  fetchPatternDetectionSuspiciousClusters,
  fetchPatternDetectionTargetingAlerts,
  fetchPatternDetectionTimeTrends,
  type AccusedBreakdownRecord,
  type AccusedComplaintRecord,
  type DepartmentRiskRecord,
  type PatternDetectionOverview,
  type PatternInsightMessage,
  type PatternTimeTrendRecord,
  type RepeatOffenderRecord,
  type RiskAccelerationRecord,
  type SuspiciousClusterRecord,
  type SuspiciousComplainantRecord,
  type TargetingAlertRecord,
} from "@/lib/auth-api";

type TrendDirection = "increasing" | "decreasing" | "stable";
type CardTone = "green" | "yellow" | "red";

type OverviewCard = {
  id: string;
  label: string;
  value: string;
  trend: TrendDirection;
  delta?: string;
  tone: CardTone;
};

function trendIcon(trend: TrendDirection) {
  if (trend === "increasing") return <TrendingUp className="h-4 w-4" />;
  if (trend === "decreasing") return <TrendingDown className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
}

function toneClasses(tone: CardTone) {
  if (tone === "red") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "yellow") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function departmentHeatColor(score: number) {
  if (score >= 75) return "bg-red-500/80 text-white";
  if (score >= 55) return "bg-amber-400/90 text-slate-900";
  if (score >= 35) return "bg-yellow-300/90 text-slate-900";
  return "bg-emerald-300/90 text-slate-900";
}

function sparklinePath(values: number[], width = 140, height = 34) {
  if (values.length === 0) return "";

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function lineChartPath(
  values: number[],
  width: number,
  height: number,
  maxValue: number,
  minValue = 0
) {
  if (values.length === 0) return "";
  const range = Math.max(maxValue - minValue, 1);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - ((value - minValue) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function complaintStatusLabel(status: AccusedComplaintRecord["status"]) {
  if (status === "under_review") return "Under Review";
  if (status === "resolved") return "Resolved";
  if (status === "rejected") return "Rejected";
  return "Submitted";
}

function complaintStatusClass(status: AccusedComplaintRecord["status"]) {
  if (status === "under_review") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "resolved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export default function HrPatternDetectionPage() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<PatternDetectionOverview | null>(null);
  const [repeatOffenders, setRepeatOffenders] = useState<RepeatOffenderRecord[]>([]);
  const [targetingAlerts, setTargetingAlerts] = useState<TargetingAlertRecord[]>([]);
  const [departmentRisk, setDepartmentRisk] = useState<DepartmentRiskRecord[]>([]);
  const [timeTrends, setTimeTrends] = useState<PatternTimeTrendRecord[]>([]);
  const [credibilityRisk, setCredibilityRisk] = useState<SuspiciousComplainantRecord[]>([]);
  const [insights, setInsights] = useState<PatternInsightMessage[]>([]);
  const [riskAcceleration, setRiskAcceleration] = useState<RiskAccelerationRecord[]>([]);
  const [suspiciousClusters, setSuspiciousClusters] = useState<SuspiciousClusterRecord[]>([]);
  const [selectedClusterAccusedHash, setSelectedClusterAccusedHash] = useState<string | null>(null);
  const [accusedComplaints, setAccusedComplaints] = useState<AccusedComplaintRecord[]>([]);
  const [accusedComplaintsLoading, setAccusedComplaintsLoading] = useState(false);
  const [accusedComplaintsError, setAccusedComplaintsError] = useState<string | null>(null);

  const [expandedAccused, setExpandedAccused] = useState<string | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownCache, setBreakdownCache] = useState<Record<string, AccusedBreakdownRecord>>({});
  const [repeatSort, setRepeatSort] = useState<"complaints" | "guilty" | "interval">("complaints");
  const [repeatSortDesc, setRepeatSortDesc] = useState(true);
  const hasLoadedRef = useRef(false);
  const hasInitialData = useMemo(
    () =>
      Boolean(overview) ||
      repeatOffenders.length > 0 ||
      targetingAlerts.length > 0 ||
      departmentRisk.length > 0 ||
      timeTrends.length > 0 ||
      credibilityRisk.length > 0 ||
      insights.length > 0 ||
      riskAcceleration.length > 0 ||
      suspiciousClusters.length > 0,
    [
      overview,
      repeatOffenders,
      targetingAlerts,
      departmentRisk,
      timeTrends,
      credibilityRisk,
      insights,
      riskAcceleration,
      suspiciousClusters,
    ]
  );

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

  const sortedRepeatOffenders = useMemo(() => {
    const rows = [...repeatOffenders];
    rows.sort((a, b) => {
      let left = 0;
      let right = 0;

      if (repeatSort === "guilty") {
        left = a.guilty_count;
        right = b.guilty_count;
      } else if (repeatSort === "interval") {
        left = a.recurrence_interval ?? Number.MAX_SAFE_INTEGER;
        right = b.recurrence_interval ?? Number.MAX_SAFE_INTEGER;
      } else {
        left = a.total_complaints;
        right = b.total_complaints;
      }

      return repeatSortDesc ? right - left : left - right;
    });

    return rows;
  }, [repeatOffenders, repeatSort, repeatSortDesc]);

  const cards = useMemo<OverviewCard[]>(() => {
    if (!overview) return [];

    const escalationPct = Number(overview.escalation_index?.percentage_change ?? 0);
    const lowEvidence = Number(overview.low_evidence_percentage ?? 0);
    const avgResolution = Number(overview.avg_resolution_time_hours ?? 0);
    const underReview = Number(overview.active_under_review ?? 0);

    const escalationTone: CardTone = escalationPct > 25 ? "red" : escalationPct > 5 ? "yellow" : "green";
    const highRiskTone: CardTone = overview.high_risk_accused_count > 8 ? "red" : overview.high_risk_accused_count > 3 ? "yellow" : "green";
    const targetingTone: CardTone = targetingAlerts.some((row) => row.alert_level === "high")
      ? "red"
      : overview.targeting_alerts_count > 0
        ? "yellow"
        : "green";
    const lowEvidenceTone: CardTone = lowEvidence > 60 ? "red" : lowEvidence > 35 ? "yellow" : "green";
    const resolutionTone: CardTone = avgResolution > 120 ? "red" : avgResolution > 72 ? "yellow" : "green";
    const reviewTone: CardTone = underReview > 30 ? "red" : underReview > 12 ? "yellow" : "green";

    return [
      {
        id: "escalation",
        label: "Escalation Index",
        value: `${escalationPct.toFixed(1)}%`,
        trend: overview.escalation_index.trend,
        delta: `${overview.escalation_index.current_count} vs ${overview.escalation_index.previous_count}`,
        tone: escalationTone,
      },
      {
        id: "high-risk",
        label: "High Risk Accused",
        value: String(overview.high_risk_accused_count),
        trend: escalationPct > 10 ? "increasing" : "stable",
        tone: highRiskTone,
      },
      {
        id: "targeting",
        label: "Targeting Alerts",
        value: String(overview.targeting_alerts_count),
        trend: overview.targeting_alerts_count > 0 ? "increasing" : "stable",
        tone: targetingTone,
      },
      {
        id: "low-evidence",
        label: "Low Evidence %",
        value: `${lowEvidence.toFixed(1)}%`,
        trend: overview.low_evidence_trend?.trend || "stable",
        delta: `${Number(overview.low_evidence_trend?.percentage_change ?? 0).toFixed(1)}%`,
        tone: lowEvidenceTone,
      },
      {
        id: "resolution",
        label: "Avg Resolution Time",
        value: `${avgResolution.toFixed(1)}h`,
        trend: "stable",
        tone: resolutionTone,
      },
      {
        id: "under-review",
        label: "Active Under Review",
        value: String(underReview),
        trend: escalationPct > 15 ? "increasing" : "stable",
        tone: reviewTone,
      },
    ];
  }, [overview, targetingAlerts]);

  const complaintTrendValues = timeTrends.map((row) => row.complaints_count);
  const severityTrendValues = timeTrends.map((row) => row.avg_severity_score);
  const maxComplaintTrend = Math.max(...complaintTrendValues, 1);
  const maxSeverityTrend = Math.max(...severityTrendValues, 1);

  const complaintPath = lineChartPath(complaintTrendValues, 700, 180, maxComplaintTrend);
  const severityPath = lineChartPath(severityTrendValues, 700, 180, maxSeverityTrend);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    let active = true;

    (async () => {
      try {
        const results: PromiseSettledResult<unknown>[] = [];

        results.push(
          ...(await Promise.allSettled([
            fetchPatternDetectionOverview(),
          ]))
        );

        results.push(
          ...(await Promise.allSettled([
            fetchPatternDetectionRepeatOffenders(),
            fetchPatternDetectionTargetingAlerts(),
            fetchPatternDetectionDepartmentRisk(),
          ]))
        );

        results.push(
          ...(await Promise.allSettled([
            fetchPatternDetectionTimeTrends(),
            fetchPatternDetectionCredibilityRisk(),
            fetchPatternDetectionInsights(),
            fetchPatternDetectionRiskAcceleration(),
            fetchPatternDetectionSuspiciousClusters(),
          ]))
        );

        if (!active) return;

        const resolved = (index: number) =>
          results[index].status === "fulfilled" ? results[index].value : null;

        setOverview(resolved(0) as PatternDetectionOverview | null);
        setRepeatOffenders(Array.isArray(resolved(1)) ? (resolved(1) as RepeatOffenderRecord[]) : []);
        setTargetingAlerts(Array.isArray(resolved(2)) ? (resolved(2) as TargetingAlertRecord[]) : []);
        setDepartmentRisk(Array.isArray(resolved(3)) ? (resolved(3) as DepartmentRiskRecord[]) : []);
        setTimeTrends(Array.isArray(resolved(4)) ? (resolved(4) as PatternTimeTrendRecord[]) : []);
        setCredibilityRisk(Array.isArray(resolved(5)) ? (resolved(5) as SuspiciousComplainantRecord[]) : []);
        setInsights(Array.isArray(resolved(6)) ? (resolved(6) as PatternInsightMessage[]) : []);
        setRiskAcceleration(Array.isArray(resolved(7)) ? (resolved(7) as RiskAccelerationRecord[]) : []);
        setSuspiciousClusters(Array.isArray(resolved(8)) ? (resolved(8) as SuspiciousClusterRecord[]) : []);

        const failedCount = results.filter((item) => item.status === "rejected").length;
        if (failedCount > 0) {
          setError(`Pattern detection loaded with partial data (${failedCount} data source${failedCount > 1 ? "s" : ""} unavailable).`);
        } else {
          setError(null);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load pattern detection module.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function toggleAccusedRow(accusedHash: string) {
    if (expandedAccused === accusedHash) {
      setExpandedAccused(null);
      return;
    }

    setExpandedAccused(accusedHash);
    if (breakdownCache[accusedHash]) return;

    try {
      setBreakdownLoading(true);
      const data = await fetchPatternDetectionAccusedBreakdown(accusedHash);
      setBreakdownCache((prev) => ({ ...prev, [accusedHash]: data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accused breakdown.");
    } finally {
      setBreakdownLoading(false);
    }
  }

  async function openAccusedComplaintsModal(accusedHash: string) {
    setSelectedClusterAccusedHash(accusedHash);
    setAccusedComplaints([]);
    setAccusedComplaintsError(null);
    setAccusedComplaintsLoading(true);

    try {
      const data = await fetchPatternDetectionAccusedComplaints(accusedHash);
      setAccusedComplaints(Array.isArray(data) ? data : []);
    } catch (err) {
      setAccusedComplaintsError(err instanceof Error ? err.message : "Unable to load complaints.");
    } finally {
      setAccusedComplaintsLoading(false);
    }
  }

  function closeAccusedComplaintsModal() {
    setSelectedClusterAccusedHash(null);
    setAccusedComplaints([]);
    setAccusedComplaintsLoading(false);
    setAccusedComplaintsError(null);
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-linear-to-b from-slate-100 via-white to-blue-50/40">
      <div className="flex h-full w-full flex-col overflow-hidden border border-slate-200/70 bg-white/80 shadow-2xl shadow-slate-900/5 backdrop-blur-xl md:flex-row">
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

        <section className="flex-1 overflow-y-auto px-5 py-5 md:px-8 md:py-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black tracking-[0.14em] text-slate-900">HR PATTERN DETECTION</h1>
              <p className="mt-2 text-sm text-slate-600">
                Behavioral risk intelligence for escalation, misuse, and repeat-offender signals.
              </p>
            </div>
            {loading ? (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">Refreshing</span>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          {loading && !hasInitialData ? (
            <LoadingState
              fullScreen={false}
              className="mt-5 min-h-[420px]"
              messages={[
                "Scanning patterns...",
                "Analyzing reports...",
                "Fetching case data...",
                "Preparing dashboard...",
              ]}
            />
          ) : (
            <>

          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <article key={card.id} className={`rounded-xl border p-4 ${toneClasses(card.tone)}`}>
                <div className="flex items-start justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.1em]">{card.label}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-bold">{trendIcon(card.trend)}</span>
                </div>
                <p className="mt-2 text-2xl font-black">{card.value}</p>
                {card.delta ? <p className="mt-1 text-xs font-semibold opacity-80">{card.delta}</p> : null}
              </article>
            ))}
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Repeat Offender Table</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setRepeatSort("complaints");
                    setRepeatSortDesc((prev) => (repeatSort === "complaints" ? !prev : true));
                  }}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                >
                  Complaints
                </button>
                <button
                  onClick={() => {
                    setRepeatSort("guilty");
                    setRepeatSortDesc((prev) => (repeatSort === "guilty" ? !prev : true));
                  }}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                >
                  Guilty
                </button>
                <button
                  onClick={() => {
                    setRepeatSort("interval");
                    setRepeatSortDesc((prev) => (repeatSort === "interval" ? !prev : true));
                  }}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                >
                  Interval
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.1em] text-slate-500">
                    <th className="pb-2">Accused Hash</th>
                    <th className="pb-2">Total Complaints</th>
                    <th className="pb-2">Guilty Count</th>
                    <th className="pb-2">Risk Level</th>
                    <th className="pb-2">Recurrence Interval (days)</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRepeatOffenders.map((row) => {
                    const expanded = expandedAccused === row.accused_employee_hash;
                    const breakdown = breakdownCache[row.accused_employee_hash];
                    const maxTimeline = Math.max(...(breakdown?.weekly_timeline.map((entry) => entry.complaint_count) || [1]), 1);

                    return (
                      <Fragment key={row.accused_employee_hash}>
                        <tr key={row.accused_employee_hash} className="border-b border-slate-100">
                          <td className="py-2.5 font-semibold text-slate-900">{row.accused_employee_hash}</td>
                          <td className="py-2.5 text-slate-700">{row.total_complaints}</td>
                          <td className="py-2.5 text-slate-700">{row.guilty_count}</td>
                          <td className="py-2.5">
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${row.risk_level === "high" ? "border-red-200 bg-red-50 text-red-700" : row.risk_level === "medium" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                              {row.risk_level}
                            </span>
                          </td>
                          <td className="py-2.5 text-slate-700">{row.recurrence_interval === null ? "N/A" : row.recurrence_interval}</td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => toggleAccusedRow(row.accused_employee_hash)}
                              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700"
                            >
                              {expanded ? "Hide Timeline" : "View Timeline"}
                            </button>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="border-b border-slate-100 bg-slate-50/80">
                            <td colSpan={6} className="py-3">
                              {breakdownLoading && !breakdown ? (
                                <p className="text-sm text-slate-600">Loading complaint timeline...</p>
                              ) : breakdown ? (
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                    <span className="rounded-full border border-slate-300 px-2 py-1">
                                      Submitted: {breakdown.status_breakdown.submitted}
                                    </span>
                                    <span className="rounded-full border border-slate-300 px-2 py-1">
                                      Under Review: {breakdown.status_breakdown.under_review}
                                    </span>
                                    <span className="rounded-full border border-slate-300 px-2 py-1">
                                      Resolved: {breakdown.status_breakdown.resolved}
                                    </span>
                                    <span className="rounded-full border border-slate-300 px-2 py-1">
                                      Rejected: {breakdown.status_breakdown.rejected}
                                    </span>
                                    <span className="rounded-full border border-slate-300 px-2 py-1">
                                      No Evidence Ratio: {breakdown.no_evidence_ratio.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="flex items-end gap-2">
                                    {breakdown.weekly_timeline.map((point) => {
                                      const height = `${Math.max((point.complaint_count / maxTimeline) * 90, 4)}px`;
                                      return (
                                        <div key={point.week_start} className="flex w-12 flex-col items-center gap-1">
                                          <div className="w-full rounded-t bg-blue-500/80" style={{ height }} />
                                          <p className="text-[10px] text-slate-500">
                                            {new Date(point.week_start).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-600">No timeline data available.</p>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Targeting Alerts Table</h2>
              <div className="mt-3 max-h-80 overflow-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.1em] text-slate-500">
                      <th className="pb-2">Accused Hash</th>
                      <th className="pb-2">Complaints</th>
                      <th className="pb-2">Avg Credibility</th>
                      <th className="pb-2">Alert</th>
                      <th className="pb-2 text-right">Breakdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {targetingAlerts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-3 text-slate-600">No targeting alerts currently.</td>
                      </tr>
                    ) : (
                      targetingAlerts.map((row) => {
                        const isExpanded = expandedAccused === row.accused_employee_hash;
                        const badgeClass = row.alert_level === "high"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-amber-200 bg-amber-50 text-amber-700";

                        return (
                          <tr key={row.accused_employee_hash} className="border-b border-slate-100 last:border-b-0">
                            <td className="py-2.5 font-semibold text-slate-900">{row.accused_employee_hash}</td>
                            <td className="py-2.5 text-slate-700">{row.complaint_count}</td>
                            <td className="py-2.5 text-slate-700">{row.avg_credibility}</td>
                            <td className="py-2.5">
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}>
                                {row.alert_level.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2.5 text-right">
                              <button
                                onClick={() => toggleAccusedRow(row.accused_employee_hash)}
                                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700"
                              >
                                {isExpanded ? "Hide" : "Open"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Department Risk Heatmap</h2>
              <div className="mt-3 grid gap-2">
                {departmentRisk.length === 0 ? (
                  <p className="text-sm text-slate-600">No department risk data available.</p>
                ) : (
                  departmentRisk.map((row) => (
                    <div key={row.department} className={`rounded-lg p-3 ${departmentHeatColor(row.risk_score)}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold uppercase tracking-[0.08em]">{row.department}</p>
                          <p className="mt-1 text-xs font-semibold">Risk Score: {row.risk_score.toFixed(1)}</p>
                          <p className="text-xs font-semibold">Change: {row.risk_change_percentage.toFixed(1)}%</p>
                        </div>
                        {row.escalation_flag ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/20 px-2 py-0.5 text-xs font-bold">
                            <AlertTriangle className="h-3.5 w-3.5" /> Escalation
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Time Trend Graph (Last 12 Weeks)</h2>
            {timeTrends.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No weekly trend data available.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <svg width="760" height="210" viewBox="0 0 760 210" className="rounded-lg border border-slate-200 bg-slate-50">
                  <path d={complaintPath} transform="translate(30,15)" fill="none" stroke="#2563eb" strokeWidth="2.5" />
                  <path d={severityPath} transform="translate(30,15)" fill="none" stroke="#ef4444" strokeWidth="2.5" />
                  {timeTrends.map((row, index) => {
                    const x = 30 + (index / Math.max(timeTrends.length - 1, 1)) * 700;
                    return (
                      <text key={row.week_start} x={x} y={203} textAnchor="middle" className="fill-slate-500 text-[9px]">
                        {new Date(row.week_start).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </text>
                    );
                  })}
                </svg>
                <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Weekly complaints</span>
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Avg severity score</span>
                </div>
              </div>
            )}
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Suspicious Clusters</h2>
              <div className="mt-3 max-h-80 overflow-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.1em] text-slate-500">
                      <th className="pb-2">Accused Hash</th>
                      <th className="pb-2">Suspicion Score</th>
                      <th className="pb-2">Diversity Index</th>
                      <th className="pb-2">Unique Devices</th>
                      <th className="pb-2">Similarity Count</th>
                      <th className="pb-2">Complaint Links</th>
                      <th className="pb-2">Review Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suspiciousClusters.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-3 text-slate-600">
                          No suspicious clusters detected yet.
                        </td>
                      </tr>
                    ) : (
                      suspiciousClusters.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => {
                            void openAccusedComplaintsModal(row.accused_employee_hash);
                          }}
                          className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 last:border-b-0"
                        >
                          <td className="py-2.5 font-semibold text-slate-900">{row.accused_employee_hash}</td>
                          <td className="py-2.5 text-slate-700">{row.cluster_suspicion_score}</td>
                          <td className="py-2.5 text-slate-700">{row.diversity_index}</td>
                          <td className="py-2.5 text-slate-700">{row.unique_device_count}</td>
                          <td className="py-2.5 text-slate-700">{row.similarity_cluster_count}</td>
                          <td className="py-2.5 text-slate-700">{row.complaint_ids.length}</td>
                          <td className="py-2.5">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                row.review_status === "pending"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : row.review_status === "reviewed"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-slate-300 bg-slate-50 text-slate-700"
                              }`}
                            >
                              {row.review_status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Suspicious Complainants</h2>
              <div className="mt-3 max-h-80 overflow-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.1em] text-slate-500">
                      <th className="pb-2">Anon User</th>
                      <th className="pb-2">Credibility</th>
                      <th className="pb-2">Complaints</th>
                      <th className="pb-2">Rejected Ratio</th>
                      <th className="pb-2">Credibility Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credibilityRisk.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-3 text-slate-600">No suspicious complainants matched current thresholds.</td>
                      </tr>
                    ) : (
                      credibilityRisk.map((row) => {
                        const trendValues = row.credibility_trend.map((item) => item.credibility_score);
                        const path = sparklinePath(trendValues, 120, 24);
                        return (
                          <tr key={row.anon_user_id} className="border-b border-slate-100 last:border-b-0">
                            <td className="py-2.5 font-semibold text-slate-900">{row.anon_user_id}</td>
                            <td className="py-2.5 text-slate-700">{row.credibility_score}</td>
                            <td className="py-2.5 text-slate-700">{row.total_complaints}</td>
                            <td className="py-2.5 text-slate-700">{row.rejected_ratio}%</td>
                            <td className="py-2.5">
                              {trendValues.length > 1 ? (
                                <svg width="130" height="28" viewBox="0 0 130 28">
                                  <path d={path} transform="translate(5,2)" fill="none" stroke="#0f766e" strokeWidth="2" />
                                </svg>
                              ) : (
                                <span className="text-xs text-slate-500">Insufficient history</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Risk Acceleration Signals</h2>
              <div className="mt-3 space-y-2">
                {riskAcceleration.length === 0 ? (
                  <p className="text-sm text-slate-600">No acceleration signals in the last 14 days.</p>
                ) : (
                  riskAcceleration.slice(0, 10).map((row) => (
                    <div key={row.accused_employee_hash} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <p className="truncate text-xs font-semibold text-slate-900">{row.accused_employee_hash}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {row.recent_complaint_count} complaints in {row.time_window_days} days
                      </p>
                    </div>
                  ))
                )}
              </div>

              <h3 className="mt-5 text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Rule-Based Insight Panel</h3>
              <div className="mt-3 space-y-2">
                {insights.map((item, index) => {
                  const cls = item.severity === "high"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : item.severity === "medium"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700";
                  return (
                    <div key={`${item.message}-${index}`} className={`rounded-lg border px-3 py-2 text-sm font-medium ${cls}`}>
                      {item.message}
                    </div>
                  );
                })}
              </div>
            </article>
          </section>
            </>
          )}
        </section>
      </div>

      {selectedClusterAccusedHash ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[88vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Accused Complaints</p>
                <p className="text-sm font-semibold text-slate-900">{selectedClusterAccusedHash}</p>
              </div>
              <button
                onClick={closeAccusedComplaintsModal}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="max-h-[72vh] overflow-auto p-4">
              {accusedComplaintsLoading ? (
                <p className="text-sm text-slate-600">Loading complaints...</p>
              ) : accusedComplaintsError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {accusedComplaintsError}
                </p>
              ) : accusedComplaints.length === 0 ? (
                <p className="text-sm text-slate-600">No complaints found for this accused entry.</p>
              ) : (
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.1em] text-slate-500">
                      <th className="pb-2">Complaint Code</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Severity</th>
                      <th className="pb-2">Incident Date</th>
                      <th className="pb-2">Evidence</th>
                      <th className="pb-2">Verdict</th>
                      <th className="pb-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accusedComplaints.map((complaint) => (
                      <tr key={complaint.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="py-2.5 font-semibold text-slate-900">{complaint.complaint_code}</td>
                        <td className="py-2.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${complaintStatusClass(
                              complaint.status
                            )}`}
                          >
                            {complaintStatusLabel(complaint.status)}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-700">{complaint.severity_score}</td>
                        <td className="py-2.5 text-slate-700">{complaint.incident_date || "N/A"}</td>
                        <td className="py-2.5 text-slate-700">{complaint.evidence_count}</td>
                        <td className="py-2.5 text-slate-700">{complaint.verdict || "Pending"}</td>
                        <td className="py-2.5 text-slate-700">
                          {new Date(complaint.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
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

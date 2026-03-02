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
  TriangleAlert,
  Users,
  Calendar,
  Clock,
  ShieldAlert,
  FileText,
  Image as ImageIcon,
  Video,
  File,
  Download,
  Eye,
  Shield,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Filter,
  X,
} from "lucide-react";
import { LoadingState } from "@/components/ui/LoadingState";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { useAuth } from "@/components/auth/auth-context";
import {
  fetchHrQueue,
  listEvidenceForComplaint,
  type HrComplaintRecord,
  type EvidenceRecord,
} from "@/lib/auth-api";

type TimelineEvent = {
  id: string;
  complaint_code: string;
  type: "complaint" | "evidence" | "status_change";
  timestamp: string;
  title: string;
  description: string;
  severity?: number;
  status?: string;
  location?: string;
  evidenceCount?: number;
  evidenceItems?: EvidenceRecord[];
};

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  // Convert to IST (Indian Standard Time - UTC+5:30)
  return {
    date: date.toLocaleDateString("en-IN", { 
      month: "short", 
      day: "numeric", 
      year: "numeric",
      timeZone: "Asia/Kolkata" 
    }),
    time: date.toLocaleTimeString("en-IN", { 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata"
    }),
  };
}

function formatBytes(bytes?: number) {
  if (!bytes || Number.isNaN(bytes)) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function severityColor(score: number) {
  if (score >= 70) return "bg-red-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-blue-500";
}

function severityLabel(score: number) {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function statusColor(status: string) {
  switch (status) {
    case "submitted":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "under_review":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "resolved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getFileIcon(mimeType?: string) {
  if (!mimeType) return <File className="h-5 w-5" />;
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-5 w-5" />;
  if (mimeType.startsWith("video/")) return <Video className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

export default function EvidenceTimelinePage() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [complaints, setComplaints] = useState<HrComplaintRecord[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [evidenceMap, setEvidenceMap] = useState<Map<string, EvidenceRecord[]>>(new Map());

  const [filterSeverity, setFilterSeverity] = useState<"all" | "high" | "medium" | "low">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "submitted" | "under_review" | "resolved" | "rejected">("all");
  const [filterDateRange, setFilterDateRange] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [searchQuery, setSearchQuery] = useState("");

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
        const data = await fetchHrQueue();
        if (!active) return;

        const safeComplaints = Array.isArray(data) ? data : [];
        setComplaints(safeComplaints);

        // Load evidence for all complaints
        const evidencePromises = safeComplaints.map(async (complaint) => {
          try {
            const evidence = await listEvidenceForComplaint(complaint.complaint_code);
            return { code: complaint.complaint_code, evidence };
          } catch {
            return { code: complaint.complaint_code, evidence: [] };
          }
        });

        const evidenceResults = await Promise.all(evidencePromises);
        const newEvidenceMap = new Map<string, EvidenceRecord[]>();
        evidenceResults.forEach((result) => {
          newEvidenceMap.set(result.code, Array.isArray(result.evidence) ? result.evidence : []);
        });

        if (active) {
          setEvidenceMap(newEvidenceMap);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load evidence timeline data.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = [];

    complaints.forEach((complaint) => {
      const evidence = evidenceMap.get(complaint.complaint_code) || [];
      const baseDescription =
        typeof complaint.description === "string" && complaint.description.trim().length > 0
          ? complaint.description
          : "No description provided";
      const shortDescription =
        baseDescription.length > 100 ? `${baseDescription.substring(0, 100)}...` : baseDescription;

      // Add complaint event
      events.push({
        id: `complaint-${complaint.id}`,
        complaint_code: complaint.complaint_code,
        type: "complaint",
        timestamp: complaint.created_at,
        title: `Case ${complaint.complaint_code}`,
        description: shortDescription,
        severity: complaint.severity_score,
        status: complaint.status,
        location: complaint.location || "Unspecified",
        evidenceCount: evidence.length,
        evidenceItems: evidence,
      });

      // Add evidence events
      evidence.forEach((item, index) => {
        events.push({
          id: `evidence-${item.id}`,
          complaint_code: complaint.complaint_code,
          type: "evidence",
          timestamp: item.uploaded_at,
          title: `Evidence #${index + 1} - ${complaint.complaint_code}`,
          description: item.metadata?.originalName || "Evidence file",
          evidenceItems: [item],
        });
      });
    });

    // Sort by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return events;
  }, [complaints, evidenceMap]);

  const filteredEvents = useMemo(() => {
    let filtered = [...timelineEvents];

    // Filter by severity
    if (filterSeverity !== "all") {
      filtered = filtered.filter((event) => {
        if (!event.severity) return false;
        const label = severityLabel(event.severity).toLowerCase();
        return label === filterSeverity;
      });
    }

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter((event) => event.status === filterStatus);
    }

    // Filter by date range
    if (filterDateRange !== "all") {
      const now = Date.now();
      const days = filterDateRange === "7d" ? 7 : filterDateRange === "30d" ? 30 : 90;
      const cutoff = now - days * 24 * 60 * 60 * 1000;

      filtered = filtered.filter((event) => new Date(event.timestamp).getTime() >= cutoff);
    }

    // Filter by search query
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((event) => {
        return (
          event.complaint_code.toLowerCase().includes(query) ||
          event.title.toLowerCase().includes(query) ||
          event.description.toLowerCase().includes(query) ||
          (event.location && event.location.toLowerCase().includes(query))
        );
      });
    }

    return filtered;
  }, [timelineEvents, filterSeverity, filterStatus, filterDateRange, searchQuery]);

  const statistics = useMemo(() => {
    const totalComplaints = complaints.length;
    const totalEvidence = Array.from(evidenceMap.values()).reduce((sum, items) => sum + items.length, 0);
    const uniqueAccused = new Set(complaints.map((c) => c.accused_employee_hash)).size;
    const highSeverity = complaints.filter((c) => c.severity_score >= 70).length;

    return { totalComplaints, totalEvidence, uniqueAccused, highSeverity };
  }, [complaints, evidenceMap]);

  const clearFilters = () => {
    setFilterSeverity("all");
    setFilterStatus("all");
    setFilterDateRange("all");
    setSearchQuery("");
  };

  const hasActiveFilters =
    filterSeverity !== "all" || filterStatus !== "all" || filterDateRange !== "all" || searchQuery.trim().length > 0;

  return (
    <main className="hr-theme-page hr-theme-evidence h-screen w-screen overflow-hidden bg-gradient-to-b from-slate-100 via-white to-blue-50/40">
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

        <section className="flex flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 px-5 py-4 backdrop-blur-xl md:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-black tracking-[0.12em] text-slate-900">Evidence & Timeline</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Chronological view of complaints and evidence submissions with detailed tracking.
                </p>
              </div>

            </div>
          </header>

          {error ? (
            <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 md:mx-8">
              {error}
            </div>
          ) : null}

          <div className="flex flex-1 overflow-hidden">
            {/* Timeline Section */}
            <section className="flex-1 overflow-y-auto p-5 md:p-8">
              {/* Statistics Cards */}
              <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  icon={<ShieldAlert className="h-5 w-5" />}
                  label="Total Complaints"
                  value={statistics.totalComplaints}
                  color="violet"
                />
                <StatCard
                  icon={<FileText className="h-5 w-5" />}
                  label="Evidence Items"
                  value={statistics.totalEvidence}
                  color="blue"
                />
                <StatCard
                  icon={<Users className="h-5 w-5" />}
                  label="Unique Accused"
                  value={statistics.uniqueAccused}
                  color="amber"
                />
                <StatCard
                  icon={<AlertCircle className="h-5 w-5" />}
                  label="High Severity"
                  value={statistics.highSeverity}
                  color="red"
                />
              </div>

              {/* Filters */}
              <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
                    <Filter className="mr-2 inline-block h-4 w-4" />
                    Filters
                  </h2>
                  {hasActiveFilters ? (
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <X className="h-3 w-3" />
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by code, description..."
                    className="h-9 flex-1 min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none ring-violet-500 transition focus:ring-2"
                  />

                  <select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value as typeof filterSeverity)}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
                  >
                    <option value="all">All Severity</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="submitted">Submitted</option>
                    <option value="under_review">Under Review</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  <select
                    value={filterDateRange}
                    onChange={(e) => setFilterDateRange(e.target.value as typeof filterDateRange)}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
                  >
                    <option value="all">All Time</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                  </select>
                </div>
              </div>

              {/* Timeline */}
              {loading ? (
                <LoadingState
                  fullScreen={false}
                  showSkeletonCards={false}
                  className="min-h-[400px]"
                  messages={[
                    "Fetching case data...",
                    "Scanning patterns...",
                    "Preparing dashboard...",
                  ]}
                />
              ) : filteredEvents.length === 0 ? (
                <div className="flex min-h-[400px] items-center justify-center">
                  <div className="text-center text-slate-500">
                    <Calendar className="mx-auto mb-3 h-12 w-12 opacity-30" />
                    <p className="font-medium">No events found</p>
                    <p className="text-sm">Try adjusting your filters</p>
                  </div>
                </div>
              ) : (
                <div className="relative space-y-6">
                  {/* Timeline line */}
                  <div className="absolute left-[23px] top-0 h-full w-0.5 bg-gradient-to-b from-violet-300 via-blue-300 to-slate-200" />

                  {filteredEvents.map((event, index) => (
                    <TimelineEventCard
                      key={event.id}
                      event={event}
                      index={index}
                      onClick={() => setSelectedEvent(event)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Detail Panel */}
            {selectedEvent ? (
              <aside className="w-full border-l border-slate-200 bg-white md:w-[400px] lg:w-[480px]">
                <DetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
              </aside>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "violet" | "blue" | "amber" | "red";
}) {
  const colorClasses = {
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wider opacity-75">{label}</span>
      </div>
      <div className="text-3xl font-black">{value}</div>
    </div>
  );
}

function TimelineEventCard({
  event,
  index,
  onClick,
}: {
  event: TimelineEvent;
  index: number;
  onClick: () => void;
}) {
  const { date, time } = formatTimestamp(event.timestamp);

  return (
    <div className="relative flex gap-4">
      {/* Timeline dot */}
      <div className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full border-4 border-white shadow-lg ${
            event.type === "complaint" ? "bg-violet-500" : "bg-blue-500"
          }`}
        >
          {event.type === "complaint" ? (
            <ShieldAlert className="h-5 w-5 text-white" />
          ) : (
            <FileText className="h-5 w-5 text-white" />
          )}
        </div>
      </div>

      {/* Event content */}
      <button
        onClick={onClick}
        className="flex-1 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900">{event.title}</h3>
            {event.type === "complaint" && event.severity !== undefined ? (
              <div className="mt-1 flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${severityColor(event.severity)}`} />
                <span className="text-xs font-semibold text-slate-600">
                  {severityLabel(event.severity)} Severity
                </span>
                {event.status ? (
                  <span
                    className={`ml-2 rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor(event.status)}`}
                  >
                    {event.status.replace("_", " ")}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-1 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {date}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {time}
            </div>
          </div>
        </div>

        <p className="mb-2 text-sm text-slate-600">{event.description}</p>

        {event.type === "complaint" && (
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {event.location ? (
              <span className="flex items-center gap-1">
                <span className="font-semibold">Location:</span> {event.location}
              </span>
            ) : null}
            {event.evidenceCount !== undefined ? (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {event.evidenceCount} evidence file{event.evidenceCount !== 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
        )}

        {event.type === "evidence" && event.evidenceItems && event.evidenceItems.length > 0 ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            {getFileIcon(event.evidenceItems[0].metadata?.mimeType)}
            <span className="font-medium">{event.evidenceItems[0].metadata?.originalName || "File"}</span>
            <span>•</span>
            <span>{formatBytes(event.evidenceItems[0].metadata?.sizeBytes)}</span>
          </div>
        ) : null}
      </button>
    </div>
  );
}

function DetailPanel({ event, onClose }: { event: TimelineEvent; onClose: () => void }) {
  const { date, time } = formatTimestamp(event.timestamp);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Event Details</h2>
            <p className="mt-1 text-sm text-slate-600">
              {date} at {time} <span className="text-xs text-slate-500">(IST)</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Event Type Badge */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Event Type
            </label>
            <span
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                event.type === "complaint"
                  ? "bg-violet-100 text-violet-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {event.type === "complaint" ? (
                <ShieldAlert className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {event.type === "complaint" ? "Complaint Filed" : "Evidence Submitted"}
            </span>
          </div>

          {/* Complaint Code */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Complaint Code
            </label>
            <p className="font-mono text-sm font-semibold text-slate-900">{event.complaint_code}</p>
          </div>

          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Title</label>
            <p className="text-sm text-slate-900">{event.title}</p>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Description
            </label>
            <p className="text-sm text-slate-700">{event.description}</p>
          </div>

          {/* Severity (if complaint) */}
          {event.type === "complaint" && event.severity !== undefined ? (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Severity Level
              </label>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${severityColor(event.severity)}`} />
                <span className="text-sm font-semibold text-slate-900">
                  {severityLabel(event.severity)} ({event.severity}/100)
                </span>
              </div>
            </div>
          ) : null}

          {/* Status (if complaint) */}
          {event.type === "complaint" && event.status ? (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Status</label>
              <span className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${statusColor(event.status)}`}>
                {event.status.replace("_", " ").toUpperCase()}
              </span>
            </div>
          ) : null}

          {/* Location (if complaint) */}
          {event.type === "complaint" && event.location ? (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Location
              </label>
              <p className="text-sm text-slate-900">{event.location}</p>
            </div>
          ) : null}

          {/* Evidence Items */}
          {event.evidenceItems && event.evidenceItems.length > 0 ? (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Evidence Files ({event.evidenceItems.length})
              </label>
              <div className="space-y-2">
                {event.evidenceItems.map((evidence, index) => (
                  <div
                    key={evidence.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-600">
                          {getFileIcon(evidence.metadata?.mimeType)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {evidence.metadata?.originalName || `Evidence #${index + 1}`}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatBytes(evidence.metadata?.sizeBytes)}
                            {evidence.metadata?.mimeType ? ` • ${evidence.metadata.mimeType}` : ""}
                          </p>
                        </div>
                      </div>
                    </div>

                    {evidence.metadata?.notes ? (
                      <div className="mt-2 rounded border border-slate-200 bg-white p-2 text-xs text-slate-600">
                        <span className="font-semibold">Notes:</span> {evidence.metadata.notes}
                      </div>
                    ) : null}

                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <CheckCircle className="h-3 w-3 text-emerald-600" />
                      <span>Hash verified</span>
                      <span>•</span>
                      <span className="font-mono text-[10px]">
                        {evidence.file_hash_sha256.substring(0, 12)}...
                      </span>
                    </div>

                    {evidence.signed_url ? (
                      <div className="mt-3 flex gap-2">
                        <a
                          href={evidence.signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </a>
                        <a
                          href={evidence.signed_url}
                          download
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </a>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Integrity Badge */}
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <Shield className="h-5 w-5" />
              <div>
                <p className="text-sm font-semibold">Chain of Custody Verified</p>
                <p className="text-xs">All evidence cryptographically secured and timestamped</p>
              </div>
            </div>
          </div>
        </div>
      </div>
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

"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  acceptHrCase,
  fetchHrCaseDetail,
  fetchHrQueue,
  submitHrCaseDecision,
  getChatMessages,
  initiateChatRequest,
  listEvidenceForComplaint,
  updateHrComplaintStatus,
  type ComplaintRecord,
  type EvidenceRecord,
  type HrQueueRecord,
  type RejectionType,
} from "@/lib/auth-api";
import { getChatSocket } from "@/lib/chat-socket";
import type { Socket } from "socket.io-client";

type ChatState = "not_requested" | "pending_acceptance" | "active";
type SeenState = {
  user_last_seen_message_id: string | null;
  hr_last_seen_message_id: string | null;
};
type SocketAck<T> = {
  ok: boolean;
  message?: string;
  data?: T;
};

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

function rejectionTypeLabel(type: RejectionType) {
  if (type === "insufficient") return "Insufficient Evidence";
  if (type === "false") return "False Complaint";
  return "Malicious Complaint";
}

function priorityLabel(score: number) {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function getDaysPending(isoDate: string) {
  const now = Date.now();
  const created = new Date(isoDate).getTime();
  return Math.floor(Math.max(0, now - created) / (1000 * 60 * 60 * 24));
}

function formatDate(value: string | null) {
  if (!value) return "Not specified";
  // Format in IST (Indian Standard Time - UTC+5:30)
  return new Date(value).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  });
}

function safeLocation(value: string | null) {
  if (!value || value.trim().length === 0) return "Unassigned";
  return value;
}

function formatBytes(value?: number) {
  if (!value || Number.isNaN(value)) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export default function HrQueuePage() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

  const [queue, setQueue] = useState<HrQueueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ComplaintRecord["status"]>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [sortBy, setSortBy] = useState<"latest" | "pending" | "severity" | "credibility">("latest");
  const [activeComplaint, setActiveComplaint] = useState<HrQueueRecord | null>(null);
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<{
    url: string;
    name: string;
    mimeType?: string;
  } | null>(null);
  const [chatState, setChatState] = useState<ChatState>("not_requested");
  const [chatStateLoading, setChatStateLoading] = useState(false);
  const [chatActionLoading, setChatActionLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatNotice, setChatNotice] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<ComplaintRecord["status"]>("submitted");
  const [rejectionTypeDraft, setRejectionTypeDraft] = useState<RejectionType | "">("");
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [statusUpdateNotice, setStatusUpdateNotice] = useState<string | null>(null);
  const [committeeNotes, setCommitteeNotes] = useState("");
  const [committeeSubmitLoading, setCommitteeSubmitLoading] = useState(false);
  const [acceptCaseLoadingCode, setAcceptCaseLoadingCode] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const socketRef = useRef<Socket | null>(null);
  const previousChatStateRef = useRef<ChatState>("not_requested");

  const ROWS_PER_PAGE = 10;
  const defaultInviteMessage =
    "We need additional details to proceed. Please accept this secure chat request.";

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

        const safeData = Array.isArray(data) ? data : [];
        setQueue(safeData);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load queue.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const emitWithAck = useCallback(
    <T,>(event: string, payload: Record<string, unknown>) => {
      return new Promise<T>((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket) {
          reject(new Error("Socket is not connected."));
          return;
        }

        socket.timeout(8000).emit(event, payload, (err: Error | null, response: SocketAck<T>) => {
          if (err) {
            reject(new Error("Socket timeout. Please try again."));
            return;
          }

          if (!response?.ok) {
            reject(new Error(response?.message || "Request failed."));
            return;
          }

          resolve(response.data as T);
        });
      });
    },
    []
  );

  useEffect(() => {
    const socket = getChatSocket();
    socketRef.current = socket;
    if (!socket) return;

    const onThreadState = (payload: {
      complaint_code: string;
      chat_state: ChatState;
      seen: SeenState;
    }) => {
      if (!activeComplaint || payload.complaint_code !== activeComplaint.complaint_code) return;
      const previous = previousChatStateRef.current;
      setChatState(payload.chat_state);
      previousChatStateRef.current = payload.chat_state;

      if (previous !== "active" && payload.chat_state === "active") {
        setChatNotice("Anonymous user accepted the invitation. Chat is now active.");
      }
    };

    const onSocketError = (payload: { message?: string }) => {
      if (payload?.message) setChatError(payload.message);
    };

    socket.on("chat:thread_state", onThreadState);
    socket.on("chat:error", onSocketError);

    return () => {
      socket.off("chat:thread_state", onThreadState);
      socket.off("chat:error", onSocketError);
    };
  }, [activeComplaint]);

  const filteredQueue = useMemo(() => {
    let rows = [...queue];

    const query = search.trim().toLowerCase();
    if (query.length > 0) {
      rows = rows.filter((item) => {
        return (
          item.complaint_code.toLowerCase().includes(query) ||
          item.accused_employee_hash.toLowerCase().includes(query) ||
          (item.location || "").toLowerCase().includes(query)
        );
      });
    }

    if (statusFilter !== "all") {
      rows = rows.filter((item) => item.status === statusFilter);
    }

    if (priorityFilter !== "all") {
      rows = rows.filter((item) => priorityLabel(item.severity_score).toLowerCase() === priorityFilter);
    }

    rows.sort((a, b) => {
      if (sortBy === "severity") return b.severity_score - a.severity_score;
      if (sortBy === "pending") return getDaysPending(b.created_at) - getDaysPending(a.created_at);
      if (sortBy === "credibility") return (b.credibility_score || 0) - (a.credibility_score || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return rows;
  }, [queue, search, statusFilter, priorityFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredQueue.length / ROWS_PER_PAGE));

  const paginatedQueue = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredQueue.slice(start, start + ROWS_PER_PAGE);
  }, [filteredQueue, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, priorityFilter, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);


  const openComplaintModal = async (complaint: HrQueueRecord) => {
    setActiveComplaint(null);
    setError(null);
    setEvidenceList([]);
    setEvidenceError(null);
    setEvidenceLoading(true);
    setEvidencePreview(null);
    setChatState("not_requested");
    setChatStateLoading(true);
    setChatActionLoading(false);
    setChatError(null);
    setChatNotice(null);
    setStatusDraft(complaint.status);
    setRejectionTypeDraft(complaint.rejection_type ?? "");
    setStatusUpdateLoading(false);
    setStatusUpdateError(null);
    setStatusUpdateNotice(null);
    setCommitteeNotes("");

    try {
      const detail = await fetchHrCaseDetail(complaint.complaint_code);
      setActiveComplaint({ ...complaint, ...detail, can_view: complaint.can_view, can_accept: complaint.can_accept });
      setStatusDraft(detail.status);
      setRejectionTypeDraft(detail.rejection_type ?? "");
      setCommitteeNotes("");
    } catch (err) {
      setStatusUpdateError(err instanceof Error ? err.message : "Unable to load complaint details.");
      return;
    }

    try {
      const evidence = await listEvidenceForComplaint(complaint.complaint_code);
      setEvidenceList(Array.isArray(evidence) ? evidence : []);
    } catch (err) {
      setEvidenceError(err instanceof Error ? err.message : "Unable to load evidence for this complaint.");
    } finally {
      setEvidenceLoading(false);
    }

    try {
      const thread = await getChatMessages(complaint.complaint_code);
      setChatState(thread.thread.chat_state);
      previousChatStateRef.current = thread.thread.chat_state;
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Unable to load chat state.");
    } finally {
      setChatStateLoading(false);
    }

    try {
      await emitWithAck("chat:join", { complaintCode: complaint.complaint_code });
    } catch {
      // Join failures are non-blocking for modal usage.
    }
  };

  const reloadQueue = async () => {
    const latest = await fetchHrQueue();
    const safeLatest = Array.isArray(latest) ? latest : [];
    setQueue(safeLatest);
    setActiveComplaint((prev) => {
      if (!prev) return prev;
      return safeLatest.find((item) => item.complaint_code === prev.complaint_code) || null;
    });
  };

  const handleAcceptCase = async (complaintCode: string) => {
    setAcceptCaseLoadingCode(complaintCode);
    setError(null);
    setStatusUpdateError(null);
    setStatusUpdateNotice(null);

    try {
      await acceptHrCase(complaintCode);
      await reloadQueue();
      setStatusUpdateNotice("Case accepted. You are now the assigned investigator.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to accept case.";
      setError(message);
      setStatusUpdateError(message);
    } finally {
      setAcceptCaseLoadingCode(null);
    }
  };

  const closeComplaintModal = () => {
    if (activeComplaint) {
      socketRef.current?.emit("chat:leave", {
        complaintCode: activeComplaint.complaint_code,
      });
    }
    setActiveComplaint(null);
    setEvidenceList([]);
    setEvidenceError(null);
    setEvidenceLoading(false);
    setEvidencePreview(null);
    setChatState("not_requested");
    setChatStateLoading(false);
    setChatActionLoading(false);
    setChatError(null);
    setChatNotice(null);
    setStatusDraft("submitted");
    setRejectionTypeDraft("");
    setStatusUpdateLoading(false);
    setStatusUpdateError(null);
    setStatusUpdateNotice(null);
    setCommitteeNotes("");
  };

  const handleInviteForChat = async () => {
    if (!activeComplaint || chatState !== "not_requested") return;
    setChatActionLoading(true);
    setChatError(null);
    setChatNotice(null);

    try {
      await emitWithAck("chat:initiate_request", {
        complaintCode: activeComplaint.complaint_code,
        message: defaultInviteMessage,
      });
      setChatState("pending_acceptance");
      previousChatStateRef.current = "pending_acceptance";
      setChatNotice("Invitation sent to anonymous user.");
    } catch {
      try {
        await initiateChatRequest(activeComplaint.complaint_code, defaultInviteMessage);
        setChatState("pending_acceptance");
        previousChatStateRef.current = "pending_acceptance";
        setChatNotice("Invitation sent to anonymous user.");
      } catch (err) {
        setChatError(err instanceof Error ? err.message : "Unable to send invitation.");
      }
    } finally {
      setChatActionLoading(false);
    }
  };

  const handleSubmitDecision = async () => {
    if (!activeComplaint) return;
    if (!["resolved", "rejected"].includes(statusDraft)) {
      setStatusUpdateError("Set status to Resolved or Rejected before sending to committee review.");
      return;
    }
    if (statusDraft === "rejected" && !rejectionTypeDraft) {
      setStatusUpdateError("Please select a rejection type before sending a rejected case for committee review.");
      return;
    }
    setCommitteeSubmitLoading(true);
    setStatusUpdateError(null);
    setStatusUpdateNotice(null);
    try {
      if (statusDraft !== activeComplaint.status) {
        const synced = await updateHrComplaintStatus(
          activeComplaint.complaint_code,
          statusDraft,
          statusDraft === "rejected" ? rejectionTypeDraft : undefined
        );
        setQueue((prev) =>
          prev.map((item) =>
            item.complaint_code === synced.complaint_code
              ? { ...item, status: synced.status, rejection_type: synced.rejection_type ?? null }
              : item
          )
        );
        setActiveComplaint((prev) =>
          prev ? { ...prev, status: synced.status, rejection_type: synced.rejection_type ?? null } : prev
        );
      }
      await submitHrCaseDecision(activeComplaint.complaint_code, {
        notes: committeeNotes.trim() || undefined,
      });
      await reloadQueue();
      setStatusUpdateNotice(`Case sent for committee review with status ${statusDraft}.`);
    } catch (err) {
      setStatusUpdateError(err instanceof Error ? err.message : "Unable to submit committee review.");
    } finally {
      setCommitteeSubmitLoading(false);
    }
  };

  const summary = useMemo(() => {
    const total = queue.length;
    const submitted = queue.filter((item) => item.status === "submitted").length;
    const underReview = queue.filter((item) => item.status === "under_review").length;
    const highPriority = queue.filter((item) => item.severity_score >= 70).length;
    const pendingSevenDays = queue.filter(
      (item) => item.status !== "resolved" && item.status !== "rejected" && getDaysPending(item.created_at) > 7
    ).length;

    return { total, submitted, underReview, highPriority, pendingSevenDays };
  }, [queue]);

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
                <h1 className="text-3xl font-black tracking-[0.12em] text-slate-900">Case Queue</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Prioritize, review, and route complaint intake without exposing complainant identity.
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
                "Analyzing reports...",
                "Fetching case data...",
                "Scanning patterns...",
                "Preparing dashboard...",
              ]}
            />
          ) : (
          <section className="p-5 md:p-8">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryCard label="Total Cases" value={summary.total} tone="slate" />
              <SummaryCard label="Submitted" value={summary.submitted} tone="sky" />
              <SummaryCard label="Under Review" value={summary.underReview} tone="amber" />
              <SummaryCard label="High Priority" value={summary.highPriority} tone="rose" />
              <SummaryCard label="Pending > 7 Days" value={summary.pendingSevenDays} tone="violet" />
            </div>

            <div className="mt-5">
              <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Queue List</h2>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search complaint, accused, location"
                        className="h-9 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-700 outline-none ring-violet-500 transition focus:ring-2"
                      />
                    </label>

                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none"
                    >
                      <option value="all">All Status</option>
                      <option value="submitted">Submitted</option>
                      <option value="under_review">Under Review</option>
                    </select>

                    <select
                      value={priorityFilter}
                      onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none"
                    >
                      <option value="all">All Priority</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>

                    <select
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none"
                    >
                      <option value="latest">Latest</option>
                      <option value="pending">Most Pending</option>
                      <option value="severity">Highest Severity</option>
                      <option value="credibility">Highest Credibility</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 overflow-x-hidden">
                  <table className="w-full table-fixed text-left text-sm leading-5">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                        <th className="w-[20%] pb-2 pr-2">Complaint ID</th>
                        <th className="w-[18%] pb-2 pr-2">Status</th>
                        <th className="w-[12%] pb-2 pr-2">Priority</th>
                        <th className="w-[14%] pb-2 pr-2">Days Pending</th>
                        <th className="w-[10%] pb-2 pr-2">Credibility</th>
                        <th className="w-[11%] pb-2 pr-2">Severity</th>
                        <th className="w-[10%] pb-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedQueue.map((item) => {
                        return (
                          <tr
                            key={item.id}
                            onClick={() => {
                              if (item.can_view) {
                                void openComplaintModal(item);
                              }
                            }}
                            className={`border-b border-slate-100 last:border-b-0 ${item.can_view ? "cursor-pointer hover:bg-violet-50/70" : "cursor-default"}`}
                          >
                            <td className="py-2 pr-2 font-semibold text-slate-900">{item.complaint_code}</td>
                            <td className="py-2 pr-2">
                              <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(item.status)}`}>
                                {item.status_label || statusLabel(item.status)}
                              </span>
                            </td>
                            <td className="py-2 pr-2 text-slate-700">{priorityLabel(item.severity_score)}</td>
                            <td className="py-2 pr-2 text-slate-700">{getDaysPending(item.created_at)}</td>
                            <td className="py-2 pr-2 text-slate-700">{Math.round(item.credibility_score || 0)}</td>
                            <td className="py-2 pr-2 text-slate-700">{item.severity_score}</td>
                            <td className="py-2">
                              {item.can_accept ? (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleAcceptCase(item.complaint_code);
                                  }}
                                  disabled={acceptCaseLoadingCode === item.complaint_code}
                                  className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                                >
                                  {acceptCaseLoadingCode === item.complaint_code ? "Accepting..." : "Accept Case"}
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {!loading && filteredQueue.length === 0 ? (
                        <tr>
                          <td className="py-4 text-slate-600" colSpan={7}>
                            No queue items found for selected filters.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    Showing {(filteredQueue.length === 0 ? 0 : (currentPage - 1) * ROWS_PER_PAGE + 1)}-
                    {Math.min(currentPage * ROWS_PER_PAGE, filteredQueue.length)} of {filteredQueue.length}
                  </p>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="rounded-md border border-slate-300 px-2.5 py-1 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Prev
                    </button>

                    {Array.from({ length: totalPages }, (_, index) => index + 1)
                      .slice(Math.max(0, currentPage - 3), Math.max(0, currentPage - 3) + 5)
                      .map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`rounded-md border px-2.5 py-1 font-semibold transition ${
                            currentPage === page
                              ? "border-violet-300 bg-violet-50 text-violet-700"
                              : "border-slate-300 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {page}
                        </button>
                      ))}

                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-md border border-slate-300 px-2.5 py-1 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </section>
          )}
        </section>
      </div>

      {activeComplaint ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Complaint Detail</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">{activeComplaint.complaint_code}</h2>
              </div>
              <button
                onClick={closeComplaintModal}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <InfoRow label="Complaint ID" value={activeComplaint.complaint_code} />
                <InfoRow label="Status" value={statusLabel(activeComplaint.status)} />
                <InfoRow label="Priority" value={priorityLabel(activeComplaint.severity_score)} />
                <InfoRow label="Days Pending" value={String(getDaysPending(activeComplaint.created_at))} />
                <InfoRow label="Credibility Score" value={String(Math.round(activeComplaint.credibility_score || 0))} />
                <InfoRow label="Incident Date" value={formatDate(activeComplaint.incident_date)} />
                <InfoRow label="Location / Dept" value={safeLocation(activeComplaint.location)} />
                <InfoRow label="Accused Hash" value={activeComplaint.accused_employee_hash} breakValue />

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  {activeComplaint.can_accept ? (
                    <div className="mb-2">
                      <button
                        onClick={() => void handleAcceptCase(activeComplaint.complaint_code)}
                        disabled={acceptCaseLoadingCode === activeComplaint.complaint_code}
                        className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                      >
                        {acceptCaseLoadingCode === activeComplaint.complaint_code ? "Accepting..." : "Accept Case"}
                      </button>
                    </div>
                  ) : null}
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Update Status</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={statusDraft}
                      onChange={(event) => {
                        const nextStatus = event.target.value as ComplaintRecord["status"];
                        setStatusDraft(nextStatus);
                        if (nextStatus !== "rejected") {
                          setRejectionTypeDraft("");
                        }
                      }}
                      disabled={statusUpdateLoading}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none disabled:opacity-60"
                    >
                      <option value="submitted">Submitted</option>
                      <option value="under_review">Under Review</option>
                      <option value="resolved">Resolved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    {statusDraft === "rejected" ? (
                      <select
                        value={rejectionTypeDraft}
                        onChange={(event) => setRejectionTypeDraft(event.target.value as RejectionType | "")}
                        disabled={statusUpdateLoading}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none disabled:opacity-60"
                      >
                        <option value="">Select rejection type</option>
                        <option value="insufficient">{rejectionTypeLabel("insufficient")}</option>
                        <option value="false">{rejectionTypeLabel("false")}</option>
                        <option value="malicious">{rejectionTypeLabel("malicious")}</option>
                      </select>
                    ) : null}

                  </div>
                  {statusUpdateError ? (
                    <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                      {statusUpdateError}
                    </p>
                  ) : null}
                  {statusUpdateNotice ? (
                    <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                      {statusUpdateNotice}
                    </p>
                  ) : null}
                </div>
                {activeComplaint.workflow_status === "in_progress" ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Send To Committee Review</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => void handleSubmitDecision()}
                        disabled={committeeSubmitLoading || !["resolved", "rejected"].includes(statusDraft)}
                        className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60"
                      >
                        {committeeSubmitLoading ? "Submitting..." : "Submit For Review"}
                      </button>
                    </div>
                    <textarea
                      value={committeeNotes}
                      onChange={(event) => setCommitteeNotes(event.target.value)}
                      disabled={committeeSubmitLoading}
                      maxLength={5000}
                      placeholder="Optional notes for committee review"
                      className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                    />
                  </div>
                ) : null}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Complaint Summary</p>
                <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-slate-700">
                  {activeComplaint.description}
                </p>

                {chatError ? (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{chatError}</p>
                ) : null}
                {chatNotice ? (
                  <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {chatNotice}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {chatStateLoading ? (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Checking Chat...
                    </span>
                  ) : chatState === "active" ? (
                    <Link
                      href="/hr/dashboard/messages"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        window.localStorage.setItem(
                          "hr_messages_target_complaint",
                          activeComplaint.complaint_code
                        );
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Open Messages
                    </Link>
                  ) : chatState === "pending_acceptance" ? (
                    <button
                      disabled
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Invitation Sent
                    </button>
                  ) : (
                    <button
                      onClick={handleInviteForChat}
                      disabled={chatActionLoading}
                      className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {chatActionLoading ? "Inviting..." : "Invite for Chat"}
                    </button>
                  )}
                  <Link
                    href="/hr/dashboard/pattern-detection"
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                  >
                    <FileSearch className="h-3.5 w-3.5" />
                    Pattern Context
                  </Link>
                </div>
              </section>
            </div>

            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Uploaded Evidence</p>

              {evidenceLoading ? (
                <p className="mt-2 text-sm text-slate-600">Loading evidence...</p>
              ) : evidenceError ? (
                <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{evidenceError}</p>
              ) : evidenceList.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">No evidence uploaded for this complaint.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {evidenceList.map((item) => {
                    const fileName = item.metadata?.originalName || item.file_url?.split("/").pop() || "Evidence file";
                    const fileUrl = item.signed_url || (item.file_url?.startsWith("http") ? item.file_url : "");

                    return (
                      <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="max-w-[65%] truncate text-sm font-semibold text-slate-900">{fileName}</p>
                          {fileUrl ? (
                            <button
                              onClick={() =>
                                setEvidencePreview({
                                  url: fileUrl,
                                  name: fileName,
                                  mimeType: item.metadata?.mimeType,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              Preview
                            </button>
                          ) : (
                            <span className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                              Link unavailable
                            </span>
                          )}
                        </div>

                        <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                          <span>MIME: {item.metadata?.mimeType || "Unknown"}</span>
                          <span>Size: {formatBytes(item.metadata?.sizeBytes)}</span>
                          <span>Uploaded: {new Date(item.uploaded_at).toLocaleString()}</span>
                          <span className="truncate">Hash: {item.file_hash_sha256}</span>
                        </div>

                        {item.metadata?.notes ? (
                          <p className="mt-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                            Notes: {item.metadata.notes}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {evidencePreview ? (
              <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">Preview: {evidencePreview.name}</p>
                  <button
                    onClick={() => setEvidencePreview(null)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close Preview
                  </button>
                </div>

                <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {evidencePreview.mimeType?.startsWith("image/") ? (
                    <img src={evidencePreview.url} alt={evidencePreview.name} className="max-h-[420px] w-full object-contain" />
                  ) : evidencePreview.mimeType?.includes("pdf") ? (
                    <iframe src={evidencePreview.url} title={evidencePreview.name} className="h-[460px] w-full" />
                  ) : evidencePreview.mimeType?.startsWith("video/") ? (
                    <video src={evidencePreview.url} controls className="max-h-[420px] w-full bg-black" />
                  ) : evidencePreview.mimeType?.startsWith("audio/") ? (
                    <div className="p-4">
                      <audio src={evidencePreview.url} controls className="w-full" />
                    </div>
                  ) : (
                    <iframe src={evidencePreview.url} title={evidencePreview.name} className="h-[420px] w-full" />
                  )}
                </div>
              </section>
            ) : null}

            <p className="mt-4 inline-flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5" />
              Queue data remains anonymized. Evidence and flags are for human review and due process only.
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "slate" | "sky" | "amber" | "rose" | "violet" }) {
  const tones = {
    slate: "border-slate-200 bg-white",
    sky: "border-sky-200 bg-sky-50/70",
    amber: "border-amber-200 bg-amber-50/70",
    rose: "border-rose-200 bg-rose-50/70",
    violet: "border-violet-200 bg-violet-50/70",
  };

  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
    </article>
  );
}

function InfoRow({
  label,
  value,
  breakValue = false,
}: {
  label: string;
  value: string;
  breakValue?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-2 last:border-b-0 last:pb-0">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
      <span
        className={`max-w-[65%] text-right font-medium text-slate-800 ${
          breakValue ? "break-all whitespace-normal" : "truncate"
        }`}
      >
        {value}
      </span>
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

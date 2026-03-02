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
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { LoadingState } from "@/components/ui/LoadingState";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { useAuth } from "@/components/auth/auth-context";
import {
  castNotificationVote,
  fetchHrNotificationDetail,
  fetchHrNotifications,
  listEvidenceForNotificationReview,
  type EvidenceRecord,
  type HrNotificationDetail,
  type HrNotificationRecord,
} from "@/lib/auth-api";

function formatDate(value: string | null) {
  if (!value) return "Not specified";
  return new Date(value).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
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

export default function HrNotificationsPage() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<HrNotificationRecord[]>([]);
  const [active, setActive] = useState<HrNotificationDetail | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [voteDraft, setVoteDraft] = useState<"support" | "oppose">("support");
  const [voteLoading, setVoteLoading] = useState(false);
  const [voteNotice, setVoteNotice] = useState<string | null>(null);

  const links = [
    { label: "HR Dashboard", href: "/hr/dashboard", icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Queue", href: "/hr/dashboard/queue", icon: <ClipboardList className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "History", href: "/hr/dashboard/history", icon: <History className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Evidence & Timeline", href: "/hr/dashboard/evidence-timeline", icon: <FileSearch className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Pattern Detection", href: "/hr/dashboard/pattern-detection", icon: <Users className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Messages", href: "/hr/dashboard/messages", icon: <MessageSquare className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Notifications", href: "/hr/dashboard/notifications", icon: <TriangleAlert className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Logs", href: "/hr/dashboard/logs", icon: <ShieldCheck className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Logout", href: "#", onClick: logout, icon: <LogOut className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
  ];

  const reloadNotifications = async () => {
    const data = await fetchHrNotifications();
    setNotifications(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    let activeState = true;
    (async () => {
      try {
        await reloadNotifications();
      } catch (err) {
        if (!activeState) return;
        setError(err instanceof Error ? err.message : "Unable to load notifications.");
      } finally {
        if (activeState) setLoading(false);
      }
    })();
    return () => {
      activeState = false;
    };
  }, []);

  const notificationCount = useMemo(() => notifications.length, [notifications]);

  const openNotification = async (complaintCode: string) => {
    setDetailLoading(true);
    setVoteNotice(null);
    setError(null);
    try {
      const [detail, evidenceList] = await Promise.all([
        fetchHrNotificationDetail(complaintCode),
        listEvidenceForNotificationReview(complaintCode),
      ]);
      setActive(detail);
      setEvidence(Array.isArray(evidenceList) ? evidenceList : []);
      if (detail.my_vote === "support" || detail.my_vote === "oppose") {
        setVoteDraft(detail.my_vote);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notification detail.");
    } finally {
      setDetailLoading(false);
    }
  };

  const submitVote = async () => {
    if (!active) return;
    setVoteLoading(true);
    setVoteNotice(null);
    setError(null);
    try {
      const outcome = await castNotificationVote(active.complaint_code, voteDraft);
      await reloadNotifications();
      setVoteNotice(
        outcome.finalized
          ? `Vote recorded. Case finalized as ${outcome.finalized.status.toUpperCase()}.`
          : "Vote recorded. Waiting for threshold."
      );
      const fresh = await fetchHrNotificationDetail(active.complaint_code);
      setActive(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit vote.");
    } finally {
      setVoteLoading(false);
    }
  };

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

        <section className="flex-1 overflow-x-hidden overflow-y-auto p-6 md:p-8">
          <h1 className="text-3xl font-black tracking-[0.12em] text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">
            Committee review alerts for investigator submissions. Open a notification to review and vote.
          </p>

          {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          {loading ? (
            <LoadingState
              fullScreen={false}
              className="min-h-[calc(100vh-16rem)]"
              messages={["Loading notifications...", "Fetching case review alerts..."]}
            />
          ) : (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Pending Notifications ({notificationCount})
              </p>

              <div className="mt-3 max-h-[70vh] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                      <th className="pb-2">Complaint ID</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Investigator</th>
                      <th className="pb-2">Submitted At</th>
                      <th className="pb-2">My Vote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map((item) => (
                      <tr
                        key={item.complaint_code}
                        onClick={() => void openNotification(item.complaint_code)}
                        className="cursor-pointer border-b border-slate-100 hover:bg-violet-50/70 last:border-b-0"
                      >
                        <td className="py-2.5 font-semibold text-slate-900">{item.complaint_code}</td>
                        <td className="py-2.5 text-slate-700">{(item.status || "submitted").toUpperCase()}</td>
                        <td className="py-2.5 text-slate-700">{item.assigned_hr.name}</td>
                        <td className="py-2.5 text-slate-700">{formatDate(item.investigator_decision_at)}</td>
                        <td className="py-2.5 text-slate-700">{item.my_vote ? item.my_vote.toUpperCase() : "Not voted"}</td>
                      </tr>
                    ))}
                    {notifications.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-3 text-slate-600">No committee notifications available.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      {active ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Notification Detail</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">{active.complaint_code}</h2>
              </div>
              <button
                onClick={() => {
                  setActive(null);
                  setEvidence([]);
                  setVoteNotice(null);
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {detailLoading ? (
              <p className="mt-4 text-sm text-slate-600">Loading complaint details...</p>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <InfoRow label="Workflow" value={active.workflow_status} />
                  <InfoRow label="Status" value={active.status.toUpperCase()} />
                  <InfoRow label="Investigator" value={active.assigned_hr.name} />
                  <InfoRow label="Submitted At" value={formatDate(active.investigator_decision_at)} />
                  <InfoRow label="Incident Date" value={formatDate(active.incident_date)} />
                  <InfoRow label="Location" value={active.location || "Unassigned"} />
                  <InfoRow label="Accused Hash" value={active.accused_employee_hash} breakValue />

                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Cast Vote</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="vote"
                          checked={voteDraft === "support"}
                          onChange={() => setVoteDraft("support")}
                        />
                        SUPPORT
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="vote"
                          checked={voteDraft === "oppose"}
                          onChange={() => setVoteDraft("oppose")}
                        />
                        OPPOSE
                      </label>
                    </div>
                    <button
                      onClick={() => void submitVote()}
                      disabled={voteLoading}
                      className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      {voteLoading ? "Submitting..." : "Submit Vote"}
                    </button>
                    {voteNotice ? (
                      <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                        {voteNotice}
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Complaint Summary</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                    {active.description}
                  </p>

                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Investigator Notes</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                    {active.investigator_decision_notes || "No notes provided."}
                  </p>
                </section>
              </div>
            )}

            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Evidence (Read-only)</p>
              {evidence.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">No evidence uploaded for this complaint.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {evidence.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="max-w-[65%] truncate text-sm font-semibold text-slate-900">
                          {item.metadata?.originalName || "Evidence file"}
                        </p>
                        {item.signed_url ? (
                          <a
                            href={item.signed_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            Open
                          </a>
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
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </main>
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
      <span className={`max-w-[65%] text-right font-medium text-slate-800 ${breakValue ? "break-all whitespace-normal" : "truncate"}`}>
        {value}
      </span>
    </div>
  );
}

const HrBrandLogo = () => (
  <Link href="/" className="flex items-center py-1 text-sm">
    <span className="font-semibold tracking-[0.14em] text-white">ETHOS</span>
  </Link>
);

const HrBrandIcon = () => (
  <Link href="/" className="flex items-center py-1 text-sm">
    <ShieldCheck className="h-5 w-5 text-white" />
  </Link>
);

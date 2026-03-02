"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Bot,
  ClipboardList,
  CheckCircle2,
  Eye,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { useAuth } from "@/components/auth/auth-context";
import {
  listEvidenceForComplaint,
  listMyComplaints,
  type ComplaintRecord,
  type EvidenceRecord,
} from "@/lib/auth-api";

const PAGE_SIZE = 10;
type ReporterDisplayStatus = "pending" | "resolved" | "rejected";

function complaintDisplayStatus(complaint: ComplaintRecord): ReporterDisplayStatus {
  if (complaint.display_status) return complaint.display_status;
  if (complaint.status === "resolved") return "resolved";
  if (complaint.status === "rejected") return "rejected";
  return "pending";
}

export default function MyComplaintsPage() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReporterDisplayStatus>("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [previewEvidence, setPreviewEvidence] = useState<EvidenceRecord | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listMyComplaints();
        if (!active) return;
        setComplaints(data);
        setSelectedId(data[0]?.id || "");
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load complaints.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const links = [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "File Complaint", href: "/dashboard/file-complaint", icon: <FilePlus2 className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "My Complaints", href: "/dashboard/my-complaints", icon: <ClipboardList className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Messages", href: "/dashboard/messages", icon: <MessageSquare className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Ethos AI", href: "/dashboard/support", icon: <Bot className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Profile", href: "/dashboard/profile", icon: <UserRound className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Logout", href: "#", onClick: logout, icon: <LogOut className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
  ];

  const filtered = useMemo(() => {
    return complaints.filter((complaint) => {
      const statusMatch = statusFilter === "all" ? true : complaintDisplayStatus(complaint) === statusFilter;
      const searchMatch = complaint.complaint_code.toLowerCase().includes(search.trim().toLowerCase());
      return statusMatch && searchMatch;
    });
  }, [complaints, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pagedComplaints = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const selectedComplaint =
    complaints.find((item) => item.id === selectedId) ?? pagedComplaints[0] ?? complaints[0] ?? null;

  useEffect(() => {
    if (!selectedComplaint?.complaint_code) {
      setEvidence([]);
      setEvidenceError(null);
      setEvidenceLoading(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        setEvidenceLoading(true);
        setEvidenceError(null);
        const data = await listEvidenceForComplaint(selectedComplaint.complaint_code);
        if (!active) return;
        setEvidence(data);
      } catch (error) {
        if (!active) return;
        setEvidence([]);
        setEvidenceError(error instanceof Error ? error.message : "Unable to load evidence.");
      } finally {
        if (active) setEvidenceLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedComplaint?.complaint_code]);

  const toStatusLabel = (status: ReporterDisplayStatus) => {
    if (status === "resolved") return "Resolved";
    if (status === "rejected") return "Rejected";
    return "Pending";
  };

  const statusStyles: Record<ReporterDisplayStatus, string> = {
    pending: "border-blue-200 bg-blue-50 text-blue-700",
    resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rejected: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <main className="employee-theme-page h-screen w-screen overflow-hidden bg-linear-to-b from-slate-100 via-indigo-50/20 to-rose-50/20">
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
          <section className="mx-auto w-full max-w-[96rem] space-y-5 p-4 md:p-6">
            <header className="sticky top-0 z-10 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-xl md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-2xl font-black tracking-wide text-slate-900">My Complaints</h1>
                  <p className="mt-1 text-sm text-slate-600">Track case progress without exposing your identity.</p>
                </div>

                <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
                  <label className="relative min-w-[260px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search by Complaint ID"
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-slate-500"
                    />
                  </label>

                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as "all" | ReporterDisplayStatus);
                      setPage(1);
                    }}
                    className="h-10 min-w-[190px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-slate-500"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </header>

            {loadError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</div>
            ) : null}

            <section className="grid items-start gap-5 xl:grid-cols-[1.8fr_1fr]">
              <article className="self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Complaints Table</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.1em] text-slate-500">
                        <th className="pb-3">Complaint ID</th>
                        <th className="pb-3">Incident Date</th>
                        <th className="pb-3">Date Submitted</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Severity</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td className="py-3 text-slate-600" colSpan={6}>Loading complaints...</td>
                        </tr>
                      ) : pagedComplaints.length === 0 ? (
                        <tr>
                          <td className="py-3 text-slate-600" colSpan={6}>No complaints found.</td>
                        </tr>
                      ) : (
                        pagedComplaints.map((complaint) => (
                          <tr key={complaint.id} className="border-b border-slate-100 text-slate-700 last:border-b-0">
                            <td className="py-3 font-semibold text-slate-900">{complaint.complaint_code}</td>
                            <td className="py-3">{complaint.incident_date || "N/A"}</td>
                            <td className="py-3">{new Date(complaint.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                            <td className="py-3">
                              <span
                                className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusStyles[complaintDisplayStatus(complaint)]}`}
                              >
                                {toStatusLabel(complaintDisplayStatus(complaint))}
                              </span>
                            </td>
                            <td className="py-3">{Math.round(complaint.severity_score)}</td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => setSelectedId(complaint.id)}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                                  selectedComplaint?.id === complaint.id
                                    ? "border-sky-300 bg-sky-50 text-sky-700"
                                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {filtered.length > PAGE_SIZE ? (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-semibold text-slate-600">Page {currentPage} / {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                ) : null}

                <article className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Privacy Protection</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
                    <p className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Complaint IDs only</p>
                    <p className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"><ShieldCheck className="h-4 w-4 text-emerald-600" /> No identity linkage exposed</p>
                  </div>
                </article>
              </article>

              <aside className="space-y-4 self-start">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                  <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Complaint Details</h3>

                  {selectedComplaint ? (
                    <div className="mt-4 space-y-4 text-sm text-slate-700">
                      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <DetailItem label="Complaint ID" value={selectedComplaint.complaint_code} />
                          <DetailItem label="Status" value={toStatusLabel(complaintDisplayStatus(selectedComplaint))} />
                          <DetailItem label="Incident Date" value={selectedComplaint.incident_date || "N/A"} />
                          <DetailItem label="Severity" value={String(Math.round(selectedComplaint.severity_score))} />
                        </div>
                      </section>

                      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Incident Summary</p>
                        <p className="mt-2 text-sm whitespace-pre-wrap break-all text-slate-800">
                          {selectedComplaint.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-slate-700">Location: {selectedComplaint.location || "N/A"}</span>
                          <span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-slate-700">Created: {new Date(selectedComplaint.created_at).toLocaleString()}</span>
                        </div>
                      </section>

                      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Evidence</p>
                        {evidenceLoading ? (
                          <p className="mt-2 text-sm text-slate-600">Loading evidence...</p>
                        ) : evidenceError ? (
                          <p className="mt-2 text-sm text-red-600">{evidenceError}</p>
                        ) : evidence.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-600">No evidence uploaded.</p>
                        ) : (
                          <div className="mt-2 space-y-2">
                            {evidence.map((item) => {
                              const meta = item.metadata || {};
                              const originalName = meta.originalName || "Uploaded file";
                              const mimeType = meta.mimeType || "unknown";
                              const sizeLabel =
                                typeof meta.sizeBytes === "number"
                                  ? `${(meta.sizeBytes / (1024 * 1024)).toFixed(2)} MB`
                                  : "N/A";
                              const uploadedAt = item.uploaded_at
                                ? new Date(item.uploaded_at).toLocaleString()
                                : "N/A";

                              return (
                                <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-900">{originalName}</p>
                                      <p className="text-xs text-slate-600">
                                        {mimeType} | {sizeLabel} | Uploaded: {uploadedAt}
                                      </p>
                                    </div>
                                    {item.signed_url ? (
                                      <button
                                        type="button"
                                        onClick={() => setPreviewEvidence(item)}
                                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                      >
                                        View
                                      </button>
                                    ) : (
                                      <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-500">
                                        View unavailable
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>

                      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                        <p className="inline-flex items-center gap-2 font-semibold">
                          <CheckCircle2 className="h-4 w-4" />
                          Your identity remains protected throughout review.
                        </p>
                      </section>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-600">Select a complaint to view details.</p>
                  )}
                </article>
              </aside>
            </section>
          </section>
        </section>
      </div>

      {previewEvidence ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {previewEvidence.metadata?.originalName || "Evidence Preview"}
                </p>
                <p className="text-xs text-slate-500">{previewEvidence.metadata?.mimeType || "unknown type"}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewEvidence(null)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[78vh] overflow-auto p-4">
              {previewEvidence.signed_url &&
              (previewEvidence.metadata?.mimeType || "").startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewEvidence.signed_url}
                  alt={previewEvidence.metadata?.originalName || "Evidence image"}
                  className="mx-auto h-auto max-h-[72vh] w-auto rounded-lg border border-slate-200"
                />
              ) : previewEvidence.signed_url &&
                previewEvidence.metadata?.mimeType === "application/pdf" ? (
                <iframe
                  src={previewEvidence.signed_url}
                  title={previewEvidence.metadata?.originalName || "Evidence PDF"}
                  className="h-[72vh] w-full rounded-lg border border-slate-200"
                />
              ) : previewEvidence.signed_url &&
                (previewEvidence.metadata?.mimeType || "").startsWith("audio/") ? (
                <audio controls className="w-full" src={previewEvidence.signed_url}>
                  Your browser does not support audio playback.
                </audio>
              ) : previewEvidence.signed_url &&
                (previewEvidence.metadata?.mimeType || "").startsWith("video/") ? (
                <video controls className="h-auto max-h-[72vh] w-full rounded-lg border border-slate-200" src={previewEvidence.signed_url}>
                  Your browser does not support video playback.
                </video>
              ) : (
                <p className="text-sm text-slate-700">
                  Preview is not supported for this file type.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <p className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700">
      <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</span>
      <span className="mt-0.5 block text-xs font-semibold text-slate-900">{value}</span>
    </p>
  );
}

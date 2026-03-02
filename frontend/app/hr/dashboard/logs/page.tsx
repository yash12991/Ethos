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
import { fetchHrComplaintAuditLogs, type ComplaintAuditLogRecord } from "@/lib/auth-api";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function actionLabel(actionType: ComplaintAuditLogRecord["action_type"]) {
  if (actionType === "CASE_ACCEPTED") return "Case Accepted";
  if (actionType === "DETAILS_VIEWED") return "Details Viewed";
  if (actionType === "STATUS_UPDATED") return "Status Updated";
  if (actionType === "DECISION_SUBMITTED") return "Decision Submitted";
  if (actionType === "VOTE_VIEWED") return "Vote Viewed";
  if (actionType === "VOTE_CAST") return "Vote Cast";
  return actionType;
}

export default function HrLogsPage() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

  const [logs, setLogs] = useState<ComplaintAuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedActionType, setSelectedActionType] = useState("");
  const [selectedHrId, setSelectedHrId] = useState("");
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [hrUsers, setHrUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  const ROWS_PER_PAGE = 10;

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
    setLoading(true);

    (async () => {
      try {
        const result = await fetchHrComplaintAuditLogs({
          page: currentPage,
          limit: ROWS_PER_PAGE,
          search,
          actionType: selectedActionType,
          hrId: selectedHrId,
        });
        if (!active) return;

        setLogs(Array.isArray(result.data) ? result.data : []);
        setTotalPages(Math.max(1, Number(result.pagination?.total_pages || 1)));
        setTotalRows(Number(result.pagination?.total || 0));
        setActionTypes(Array.isArray(result.filters?.action_types) ? result.filters.action_types : []);
        setHrUsers(Array.isArray(result.filters?.hr_users) ? result.filters.hr_users : []);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load complaint audit logs.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [currentPage, search, selectedActionType, selectedHrId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedActionType, selectedHrId]);

  const selectedHrName = useMemo(() => {
    if (!selectedHrId) return "All HR";
    return hrUsers.find((item) => item.id === selectedHrId)?.name || "All HR";
  }, [hrUsers, selectedHrId]);

  const cycleActionFilter = () => {
    const options = ["", ...actionTypes];
    const currentIndex = options.indexOf(selectedActionType);
    const nextIndex = currentIndex < 0 || currentIndex === options.length - 1 ? 0 : currentIndex + 1;
    setSelectedActionType(options[nextIndex]);
  };

  const cycleHrFilter = () => {
    const options = ["", ...hrUsers.map((item) => item.id)];
    const currentIndex = options.indexOf(selectedHrId);
    const nextIndex = currentIndex < 0 || currentIndex === options.length - 1 ? 0 : currentIndex + 1;
    setSelectedHrId(options[nextIndex]);
  };

  const fromRow = useMemo(() => {
    if (totalRows === 0) return 0;
    return (currentPage - 1) * ROWS_PER_PAGE + 1;
  }, [currentPage, totalRows]);

  const toRow = useMemo(() => {
    if (totalRows === 0) return 0;
    return Math.min(currentPage * ROWS_PER_PAGE, totalRows);
  }, [currentPage, totalRows]);

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

        <section className="flex-1 overflow-y-auto px-5 py-5 md:px-8 md:py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black tracking-[0.12em] text-slate-900">Complaint Logs</h1>
              <p className="mt-2 text-sm text-slate-600">
                Immutable complaint audit trail. Records are read-only and non-editable.
              </p>
            </div>
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              Total Logs: {totalRows}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="relative min-w-[260px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by complaint code, action, or HR name"
                className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-slate-400"
              />
            </div>
            <button
              onClick={() => setSearch(searchInput.trim())}
              className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              Search
            </button>
            <button
              onClick={cycleActionFilter}
              className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              title="Cycle action type filter"
            >
              Action: {selectedActionType ? actionLabel(selectedActionType) : "All"}
            </button>
            <button
              onClick={cycleHrFilter}
              className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              title="Cycle HR filter"
            >
              HR: {selectedHrName}
            </button>
            <button
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setSelectedActionType("");
                setSelectedHrId("");
              }}
              className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Clear
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          {loading ? (
            <LoadingState
              fullScreen={false}
              className="mt-6 min-h-[340px]"
              messages={[
                "Loading logs...",
                "Fetching immutable records...",
                "Preparing pagination...",
                "Almost ready...",
              ]}
            />
          ) : (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.1em] text-slate-500">
                      <th className="pb-2">Time</th>
                      <th className="pb-2">Complaint</th>
                      <th className="pb-2">HR</th>
                      <th className="pb-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-sm text-slate-500">
                          No logs found for current filters.
                        </td>
                      </tr>
                    ) : (
                      logs.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 align-top">
                          <td className="py-2.5 text-slate-700">{formatDate(item.created_at)}</td>
                          <td className="py-2.5 font-semibold text-slate-900">{item.complaint_code}</td>
                          <td className="py-2.5 text-slate-700">{item.hr_name}</td>
                          <td className="py-2.5">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              {actionLabel(item.action_type)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <p className="text-slate-600">
                  Showing {fromRow}-{toRow} of {totalRows}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage >= totalPages}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}

function HrBrandLogo() {
  return (
    <Link href="/hr/dashboard" className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black">
      <div className="h-6 w-7 flex-shrink-0 rounded-md bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500" />
      <span className="font-bold whitespace-pre text-black">ETHOS HR</span>
    </Link>
  );
}

function HrBrandIcon() {
  return (
    <Link href="/hr/dashboard" className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black">
      <div className="h-6 w-7 flex-shrink-0 rounded-md bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500" />
    </Link>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCheck,
  Circle,
  ClipboardList,
  FileSearch,
  History,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Send,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { LoadingState } from "@/components/ui/LoadingState";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { useAuth } from "@/components/auth/auth-context";
import { listChatThreads, type ChatMessageRecord, type ChatThreadDetails, type ChatThreadSummary } from "@/lib/auth-api";
import { getChatSocket } from "@/lib/chat-socket";
import type { Socket } from "socket.io-client";

type Sender = "anon" | "you";

type UiMessage = {
  id: string;
  sender: Sender;
  content: string;
  timestamp: string;
};

type SeenState = {
  user_last_seen_message_id: string | null;
  hr_last_seen_message_id: string | null;
};

type SocketAck<T> = {
  ok: boolean;
  message?: string;
  data?: T;
};

type ConnectionStatus = "connecting" | "online" | "reconnecting" | "offline";
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function mapStatusLabel(status: ChatThreadSummary["complaint_status"]) {
  if (status === "under_review") return "Under Review";
  if (status === "resolved") return "Resolved";
  if (status === "rejected") return "Rejected";
  return "Submitted";
}

function mapChatStateLabel(state: ChatThreadSummary["chat_state"]) {
  if (state === "active") return "Chat Active";
  if (state === "pending_acceptance") return "Pending Anonymous Acceptance";
  return "Not Requested";
}

function isClosedStatus(status: ChatThreadSummary["complaint_status"]) {
  return status === "resolved" || status === "rejected";
}

function mapMessages(items: ChatMessageRecord[]): UiMessage[] {
  return items.map((item) => ({
    id: item.id,
    sender: item.sender_type === "hr" ? "you" : "anon",
    content: item.message,
    timestamp: item.created_at,
  }));
}

function upsertThreadPreview(
  threads: ChatThreadSummary[],
  complaintCode: string,
  preview: string,
  timestamp: string
) {
  return threads
    .map((thread) =>
      thread.complaint_code === complaintCode
        ? {
            ...thread,
            last_message_preview: preview,
            last_message_at: timestamp,
          }
        : thread
    )
    .sort(
      (a, b) =>
        new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
    );
}

function deriveSeenCutoff(messages: UiMessage[], seenMessageId: string | null) {
  if (!seenMessageId) return null;
  const marker = messages.find((item) => item.id === seenMessageId);
  if (!marker) return null;
  return new Date(marker.timestamp).getTime();
}

function toAdjustedDate(isoDate: string) {
  return new Date(new Date(isoDate).getTime() + IST_OFFSET_MS);
}

export default function HrMessagesPage() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const [requestedComplaintCode, setRequestedComplaintCode] = useState("");

  const [filter, setFilter] = useState<"Active" | "Closed">("Active");
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadsError, setThreadsError] = useState<string | null>(null);

  const [selectedComplaintCode, setSelectedComplaintCode] = useState<string>("");
  const [threadDetails, setThreadDetails] = useState<ChatThreadDetails | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [input, setInput] = useState("");
  const [requestMessage, setRequestMessage] = useState(
    "We need additional details to proceed. Please accept this secure chat request."
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [anonTyping, setAnonTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [seenState, setSeenState] = useState<SeenState>({
    user_last_seen_message_id: null,
    hr_last_seen_message_id: null,
  });
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const complaintFromStorage = window.localStorage.getItem("hr_messages_target_complaint")?.trim() || "";
    if (!complaintFromStorage) return;
    setRequestedComplaintCode(complaintFromStorage);
    window.localStorage.removeItem("hr_messages_target_complaint");
  }, []);

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

  const loadThreads = useCallback(async () => {
    try {
      const data = await listChatThreads();
      setThreads(data);
      setThreadsError(null);

      if (!selectedComplaintCode && data.length > 0) {
        setSelectedComplaintCode(data[0].complaint_code);
      }

      if (
        selectedComplaintCode &&
        !data.some((thread) => thread.complaint_code === selectedComplaintCode)
      ) {
        setSelectedComplaintCode(data[0]?.complaint_code || "");
      }
    } catch (error) {
      setThreadsError(error instanceof Error ? error.message : "Unable to load chat threads.");
    } finally {
      setThreadsLoading(false);
    }
  }, [selectedComplaintCode]);

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

  const joinThread = useCallback(
    async (complaintCode: string) => {
      if (!complaintCode) return;
      setMessagesLoading(true);

      try {
        const data = await emitWithAck<{
          complaint_code: string;
          complaint_status: ChatThreadSummary["complaint_status"];
          thread: ChatThreadDetails;
          messages: ChatMessageRecord[];
        }>("chat:join", { complaintCode });

        setThreadDetails(data.thread);
        setSeenState({
          user_last_seen_message_id: data.thread.seen?.user_last_seen_message_id || null,
          hr_last_seen_message_id: data.thread.seen?.hr_last_seen_message_id || null,
        });
        setMessages(mapMessages(data.messages));
        setAnonTyping(false);
        setActionError(null);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Unable to load chat messages.");
      } finally {
        setMessagesLoading(false);
      }
    },
    [emitWithAck]
  );

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!requestedComplaintCode) return;
    if (!threads.some((thread) => thread.complaint_code === requestedComplaintCode)) return;
    setSelectedComplaintCode(requestedComplaintCode);
  }, [requestedComplaintCode, threads]);

  useEffect(() => {
    const socket = getChatSocket();
    socketRef.current = socket;

    if (!socket) {
      setActionError("Authentication required for chat socket.");
      setConnectionStatus("offline");
      return;
    }
    setConnectionStatus(socket.connected ? "online" : "connecting");

    const onSocketError = (payload: { message?: string }) => {
      if (payload?.message) setActionError(payload.message);
    };
    const onConnect = () => setConnectionStatus("online");
    const onDisconnect = () => setConnectionStatus("offline");
    const onReconnectAttempt = () => setConnectionStatus("reconnecting");
    const onConnectError = () => setConnectionStatus("reconnecting");

    const onIncomingMessage = (payload: {
      complaint_code: string;
      message: ChatMessageRecord;
    }) => {
      setThreads((prev) =>
        upsertThreadPreview(prev, payload.complaint_code, payload.message.message, payload.message.created_at)
      );

      if (payload.complaint_code !== selectedComplaintCode) return;

      const mapped = mapMessages([payload.message])[0];
      setMessages((prev) => {
        if (prev.some((item) => item.id === mapped.id)) return prev;
        return [...prev, mapped];
      });
    };

    const onTyping = (payload: {
      complaint_code: string;
      by: "user" | "hr";
      is_typing: boolean;
    }) => {
      if (payload.complaint_code !== selectedComplaintCode) return;
      if (payload.by === "user") {
        setAnonTyping(payload.is_typing);
      }
    };

    const onSeen = (payload: { complaint_code: string; seen: SeenState }) => {
      if (payload.complaint_code !== selectedComplaintCode) return;
      setSeenState(payload.seen);
    };

    const onThreadState = (payload: {
      complaint_code: string;
      complaint_status: ChatThreadSummary["complaint_status"];
      chat_state: ChatThreadSummary["chat_state"];
      request_message: string | null;
      requested_at: string | null;
      accepted_at: string | null;
      seen: SeenState;
    }) => {
      setThreads((prev) =>
        prev.map((thread) =>
          thread.complaint_code === payload.complaint_code
            ? {
                ...thread,
                complaint_status: payload.complaint_status,
                chat_state: payload.chat_state,
                request_message: payload.request_message,
                requested_at: payload.requested_at,
                accepted_at: payload.accepted_at,
                seen: payload.seen,
              }
            : thread
        )
      );

      if (payload.complaint_code !== selectedComplaintCode) return;

      setThreadDetails((prev) =>
        prev
          ? {
              ...prev,
              complaint_status: payload.complaint_status,
              chat_state: payload.chat_state,
              request_message: payload.request_message,
              requested_at: payload.requested_at,
              accepted_at: payload.accepted_at,
              seen: payload.seen,
            }
          : prev
      );
      setSeenState(payload.seen);
    };

    socket.on("chat:error", onSocketError);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.on("connect_error", onConnectError);
    socket.on("chat:message", onIncomingMessage);
    socket.on("chat:typing", onTyping);
    socket.on("chat:seen", onSeen);
    socket.on("chat:thread_state", onThreadState);

    return () => {
      socket.off("chat:error", onSocketError);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.off("connect_error", onConnectError);
      socket.off("chat:message", onIncomingMessage);
      socket.off("chat:typing", onTyping);
      socket.off("chat:seen", onSeen);
      socket.off("chat:thread_state", onThreadState);
    };
  }, [selectedComplaintCode]);

  useEffect(() => {
    if (!selectedComplaintCode) return;
    void joinThread(selectedComplaintCode);
  }, [selectedComplaintCode, joinThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, anonTyping]);

  useEffect(() => {
    if (!selectedComplaintCode || !threadDetails || threadDetails.chat_state !== "active") return;

    const lastAnonMessage = [...messages].reverse().find((item) => item.sender === "anon");
    if (!lastAnonMessage) return;

    if (seenState.hr_last_seen_message_id === lastAnonMessage.id) return;

    const socket = socketRef.current;
    if (!socket) return;

    socket.emit("chat:seen", {
      complaintCode: selectedComplaintCode,
      messageId: lastAnonMessage.id,
    });
  }, [messages, selectedComplaintCode, seenState.hr_last_seen_message_id, threadDetails]);

  useEffect(() => {
    if (!selectedComplaintCode || !threadDetails || threadDetails.chat_state !== "active") return;

    const socket = socketRef.current;
    if (!socket) return;

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (input.trim().length === 0) {
      socket.emit("chat:typing", { complaintCode: selectedComplaintCode, isTyping: false });
      return;
    }

    socket.emit("chat:typing", { complaintCode: selectedComplaintCode, isTyping: true });
    typingTimeoutRef.current = window.setTimeout(() => {
      socket.emit("chat:typing", { complaintCode: selectedComplaintCode, isTyping: false });
      typingTimeoutRef.current = null;
    }, 1200);

    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [input, selectedComplaintCode, threadDetails]);

  const visibleThreads = useMemo(() => {
    return threads.filter((thread) => {
      const closed = isClosedStatus(thread.complaint_status);
      if (filter === "Closed") return closed;
      return !closed;
    });
  }, [threads, filter]);

  const selectedThread = useMemo(() => {
    return threads.find((thread) => thread.complaint_code === selectedComplaintCode) || null;
  }, [threads, selectedComplaintCode]);

  const groupedMessages = useMemo(() => {
    const groups = new Map<string, UiMessage[]>();

    for (const message of messages) {
      const date = toAdjustedDate(message.timestamp).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const current = groups.get(date) ?? [];
      current.push(message);
      groups.set(date, current);
    }

    return Array.from(groups.entries()).map(([date, dayMessages]) => ({ date, messages: dayMessages }));
  }, [messages]);

  const canSend =
    Boolean(selectedThread) &&
    !isClosedStatus(selectedThread.complaint_status) &&
    selectedThread.chat_state === "active";

  const anonSeenCutoff = useMemo(() => {
    return deriveSeenCutoff(messages, seenState.user_last_seen_message_id);
  }, [messages, seenState.user_last_seen_message_id]);

  const handleInitiateRequest = async () => {
    if (!selectedThread) return;
    const trimmed = requestMessage.trim();
    if (!trimmed) return;

    setActionLoading(true);
    setActionError(null);

    try {
      await emitWithAck("chat:initiate_request", {
        complaintCode: selectedThread.complaint_code,
        message: trimmed,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to send chat request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedThread || !canSend) return;

    const trimmed = input.trim();
    if (!trimmed) return;

    setActionLoading(true);
    setActionError(null);

    try {
      await emitWithAck("chat:send", {
        complaintCode: selectedThread.complaint_code,
        message: trimmed,
      });
      setInput("");
      socketRef.current?.emit("chat:typing", {
        complaintCode: selectedThread.complaint_code,
        isTyping: false,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main className="hr-theme-page hr-theme-messages h-screen w-screen overflow-hidden bg-linear-to-b from-slate-100 via-white to-slate-50">
      <div className="hr-theme-shell flex h-full w-full flex-col overflow-hidden border border-slate-200 bg-white/90 shadow-2xl shadow-slate-900/5 backdrop-blur-xl md:flex-row">
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

        <section className="flex h-full flex-1 overflow-hidden p-4 md:p-6">
          <div className="flex w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <aside className="w-full max-w-sm border-r border-slate-200 bg-slate-50/60">
              <div className="border-b border-slate-200 p-4">
                <h1 className="text-lg font-black text-slate-900">Messages</h1>
                <p className="mt-1 text-xs text-slate-600">Anonymous chat by complaint code identity</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setFilter("Active")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      filter === "Active" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setFilter("Closed")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      filter === "Closed" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    Closed
                  </button>
                </div>
              </div>

              <div className="h-[calc(100%-114px)] overflow-y-auto p-2">
                {threadsLoading ? (
                  <LoadingState
                    fullScreen={false}
                    showSkeletonCards={false}
                    className="min-h-[260px]"
                    messages={[
                      "Loading messages...",
                      "Fetching case data...",
                      "Analyzing reports...",
                    ]}
                  />
                ) : null}
                {threadsError ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{threadsError}</p>
                ) : null}

                {!threadsLoading && visibleThreads.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-slate-600">No threads available in this filter.</p>
                ) : null}

                {visibleThreads.map((thread) => (
                  <button
                    key={thread.thread_id}
                    onClick={() => setSelectedComplaintCode(thread.complaint_code)}
                    className={`mb-2 w-full rounded-xl border p-3 text-left transition ${
                      selectedThread?.complaint_code === thread.complaint_code
                        ? "border-slate-900 bg-white"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">{thread.complaint_code}</p>
                      <StatusBadge status={thread.complaint_status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-600">
                      {thread.last_message_preview || mapChatStateLabel(thread.chat_state)}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{thread.last_message_at ? formatTimeAgo(thread.last_message_at) : "New"}</span>
                      {thread.chat_state === "pending_acceptance" ? (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <Circle className="h-2.5 w-2.5 fill-amber-700 text-amber-700" />
                          Waiting
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <section className="flex min-w-0 flex-1 flex-col">
              {selectedThread ? (
                <>
                  <header className="border-b border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Complaint: {selectedThread.complaint_code}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <StatusBadge status={selectedThread.complaint_status} />
                          <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1">
                            {mapChatStateLabel(selectedThread.chat_state)}
                          </span>
                          <ConnectionBadge status={connectionStatus} />
                        </div>
                      </div>
                    </div>

                    {selectedThread.chat_state === "not_requested" ? (
                      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                        <p className="font-semibold">Send a chat request to activate secure messaging.</p>
                        <textarea
                          value={requestMessage}
                          onChange={(e) => setRequestMessage(e.target.value.slice(0, 2000))}
                          className="mt-2 min-h-[80px] w-full rounded-lg border border-blue-200 bg-white p-2 text-xs text-slate-800 outline-none"
                        />
                        <button
                          onClick={handleInitiateRequest}
                          disabled={actionLoading || requestMessage.trim().length === 0}
                          className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {actionLoading ? "Sending..." : "Initiate Request"}
                        </button>
                      </div>
                    ) : null}

                    {selectedThread.chat_state === "pending_acceptance" ? (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <p className="font-semibold">Waiting for anonymous user acceptance.</p>
                        {threadDetails?.request_message ? <p className="mt-1">Request: {threadDetails.request_message}</p> : null}
                      </div>
                    ) : null}
                  </header>

                  <div className="flex-1 overflow-y-auto bg-slate-50/40 px-4 py-4">
                    {messagesLoading ? (
                      <LoadingState
                        fullScreen={false}
                        showSkeletonCards={false}
                        className="min-h-[220px]"
                        messages={[
                          "Loading messages...",
                          "Fetching case data...",
                          "Preparing dashboard...",
                        ]}
                      />
                    ) : null}

                    {!messagesLoading && groupedMessages.length === 0 ? (
                      <p className="text-sm text-slate-600">No messages yet.</p>
                    ) : null}

                    {groupedMessages.map((group) => (
                      <div key={group.date} className="mb-4">
                        <div className="mb-3 flex justify-center">
                          <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500">
                            {group.date}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {group.messages.map((message) => (
                            <MessageBubble
                              key={message.id}
                              message={message}
                              isSeen={
                                message.sender === "you" &&
                                anonSeenCutoff !== null &&
                                new Date(message.timestamp).getTime() <= anonSeenCutoff
                              }
                            />
                          ))}
                        </div>
                      </div>
                    ))}

                    {anonTyping ? <p className="text-xs text-slate-600">Anonymous user is typing...</p> : null}

                    <div ref={messagesEndRef} />
                  </div>

                  <footer className="border-t border-slate-200 bg-white p-3">
                    {actionError ? (
                      <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {actionError}
                      </p>
                    ) : null}

                    {!canSend ? (
                      <p className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600">
                        {isClosedStatus(selectedThread.complaint_status)
                          ? "This complaint is closed. Messaging is disabled."
                          : "Messaging will be enabled after anonymous acceptance."}
                      </p>
                    ) : (
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value.slice(0, 2000))}
                            placeholder="Write a confidential message..."
                            className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-800 outline-none transition focus:border-slate-500"
                          />
                          <p className="mt-1 text-right text-[11px] text-slate-500">{input.length} / 2000</p>
                        </div>

                        <button
                          onClick={handleSendMessage}
                          disabled={actionLoading || input.trim().length === 0}
                          className="inline-flex h-10 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Send className="h-3.5 w-3.5" /> Send
                        </button>
                      </div>
                    )}
                  </footer>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No complaint threads available for this filter.
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function MessageBubble({ message, isSeen }: { message: UiMessage; isSeen: boolean }) {
  const isYou = message.sender === "you";

  return (
    <div className={`flex ${isYou ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-xl px-3 py-2 text-sm ${
          isYou
            ? "bg-slate-900 text-white"
            : "border border-slate-300 bg-white text-slate-800"
        }`}
      >
        <p className={`mb-1 text-[11px] font-semibold ${isYou ? "text-slate-200" : "text-slate-500"}`}>
          {isYou ? "You (HR)" : "Anonymous User"}
        </p>
        <p>{message.content}</p>
        <p className={`mt-1 text-right text-[10px] ${isYou ? "text-slate-300" : "text-slate-500"}`}>
          {toAdjustedDate(message.timestamp).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })}
          {isYou ? (
            <CheckCheck className={`ml-1 inline h-3 w-3 ${isSeen ? "text-sky-300" : "text-slate-300"}`} />
          ) : null}
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ChatThreadSummary["complaint_status"] }) {
  const styles: Record<ChatThreadSummary["complaint_status"], string> = {
    submitted: "border-blue-200 bg-blue-50 text-blue-700",
    under_review: "border-yellow-200 bg-yellow-50 text-yellow-800",
    resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rejected: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${styles[status]}`}>
      {mapStatusLabel(status)}
    </span>
  );
}

function formatTimeAgo(isoDate: string) {
  const diff = Date.now() - toAdjustedDate(isoDate).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return `${Math.max(minutes, 1)}m ago`;
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

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const styles: Record<ConnectionStatus, string> = {
    online: "border-emerald-200 bg-emerald-50 text-emerald-700",
    connecting: "border-slate-300 bg-slate-100 text-slate-700",
    reconnecting: "border-amber-200 bg-amber-50 text-amber-700",
    offline: "border-red-200 bg-red-50 text-red-700",
  };

  const labels: Record<ConnectionStatus, string> = {
    online: "Online",
    connecting: "Connecting",
    reconnecting: "Reconnecting",
    offline: "Offline",
  };

  return <span className={`rounded-full border px-2 py-1 ${styles[status]}`}>{labels[status]}</span>;
}

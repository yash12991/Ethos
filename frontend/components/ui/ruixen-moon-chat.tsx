"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowUpIcon,
  RotateCcw,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Paperclip,
} from "lucide-react";
import { ApiRequestError, sendSupportChatMessage } from "@/lib/auth-api";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  source?: string;
  citations?: string[];
  createdAt: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface AutoResizeProps {
  minHeight: number;
  maxHeight?: number;
}

const CONTEXT_WINDOW = 12;
const MAX_SESSION_MESSAGES = 100;
const MAX_HISTORY_CHARS = 1800;
const CHAT_STORAGE_KEY = "ethos-support-chat-sessions-v1";
const MAX_SAVED_CHATS = 8;
const ROUTE_PATTERN = /(\/dashboard\/[a-z-]+)/g;
const TYPE_INTERVAL_MS = 16;
const ROUTE_EXTRACT_PATTERN = /\/dashboard\/[a-z-]+/g;

function createSession(title = "New Chat"): ChatSession {
  const now = Date.now();
  return {
    id: `chat-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function renderInlineMarkdown(text: string) {
  const chunks = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return chunks.map((chunk, index) => {
    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      return (
        <strong key={`${chunk}-${index}`} className="font-semibold text-white">
          {chunk.slice(2, -2)}
        </strong>
      );
    }

    const routeChunks = chunk.split(ROUTE_PATTERN).filter(Boolean);

    return (
      <span key={`${chunk}-${index}`}>
        {routeChunks.map((part, partIndex) => {
          if (part.startsWith("/dashboard/")) {
            return (
              <Link
                key={`${part}-${partIndex}`}
                href={part}
                className="font-medium text-blue-200 underline decoration-blue-300/70 underline-offset-2 hover:text-blue-100"
              >
                {part}
              </Link>
            );
          }
          return <span key={`${part}-${partIndex}`}>{part}</span>;
        })}
      </span>
    );
  });
}

function extractRoutesFromContent(text: string) {
  const matches = text.match(ROUTE_EXTRACT_PATTERN) || [];
  return [...new Set(matches)].slice(0, 4);
}

function renderMessageContent(content: string) {
  return content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, lineIndex) => {
      const numberedLine = line.match(/^(\d+)\.\s+(.*)$/);

      if (numberedLine) {
        return (
          <div key={`line-${lineIndex}`} className="flex gap-2 leading-7">
            <span className="min-w-5 font-medium text-neutral-300">{numberedLine[1]}.</span>
            <p className="text-neutral-100">{renderInlineMarkdown(numberedLine[2])}</p>
          </div>
        );
      }

      return (
        <p key={`line-${lineIndex}`} className="leading-7 text-neutral-100">
          {renderInlineMarkdown(line)}
        </p>
      );
    });
}

function useAutoResizeTextarea({ minHeight, maxHeight }: AutoResizeProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight ?? Infinity));
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.style.height = `${minHeight}px`;
  }, [minHeight]);

  return { textareaRef, adjustHeight };
}

export default function RuixenMoonChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const didHydrateRef = useRef(false);
  const typingTimerRef = useRef<number | null>(null);

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 48,
    maxHeight: 132,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) {
        const starter = createSession();
        setSessions([starter]);
        setActiveSessionId(starter.id);
        setMessages([]);
        didHydrateRef.current = true;
        return;
      }

      const parsed = JSON.parse(raw) as { sessions?: ChatSession[]; activeSessionId?: string };
      const safeSessions = Array.isArray(parsed?.sessions)
        ? parsed.sessions
            .filter((s) => s && typeof s.id === "string" && Array.isArray(s.messages))
            .slice(0, MAX_SAVED_CHATS)
        : [];

      if (safeSessions.length === 0) {
        const starter = createSession();
        setSessions([starter]);
        setActiveSessionId(starter.id);
        setMessages([]);
      } else {
        const requestedActiveId = parsed?.activeSessionId;
        const resolvedActiveId = safeSessions.some((s) => s.id === requestedActiveId)
          ? (requestedActiveId as string)
          : safeSessions[0].id;
        const active = safeSessions.find((s) => s.id === resolvedActiveId) || safeSessions[0];

        setSessions(safeSessions);
        setActiveSessionId(active.id);
        setMessages(active.messages.slice(-MAX_SESSION_MESSAGES));
      }
    } catch {
      const starter = createSession();
      setSessions([starter]);
      setActiveSessionId(starter.id);
      setMessages([]);
    } finally {
      didHydrateRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!didHydrateRef.current || !activeSessionId) return;

    setSessions((prev) => {
      const titleFromFirstUser = messages.find((m) => m.role === "user")?.content.slice(0, 42) || "New Chat";
      const updated = prev.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              title:
                session.title && session.title !== "New Chat"
                  ? session.title
                  : titleFromFirstUser,
              messages: messages.slice(-MAX_SESSION_MESSAGES),
              updatedAt: Date.now(),
            }
          : session
      );

      try {
        localStorage.setItem(
          CHAT_STORAGE_KEY,
          JSON.stringify({
            sessions: updated.slice(0, MAX_SAVED_CHATS),
            activeSessionId,
          })
        );
      } catch {}

      return updated;
    });
  }, [messages, activeSessionId]);

  const startNewChat = () => {
    const next = createSession();
    setSessions((prev) => {
      const updated = [next, ...prev].slice(0, MAX_SAVED_CHATS);
      try {
        localStorage.setItem(
          CHAT_STORAGE_KEY,
          JSON.stringify({ sessions: updated, activeSessionId: next.id })
        );
      } catch {}
      return updated;
    });
    setActiveSessionId(next.id);
    setMessages([]);
    setInput("");
    setShowNewMessageIndicator(false);
    setEditingSessionId(null);
    setEditingSessionTitle("");
  };

  const switchSession = (sessionId: string) => {
    if (sessionId === activeSessionId) return;
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return;

    setActiveSessionId(sessionId);
    setMessages(target.messages.slice(-MAX_SESSION_MESSAGES));
    setInput("");
    setShowNewMessageIndicator(false);
    setEditingSessionId(null);
    setEditingSessionTitle("");

    try {
      localStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify({ sessions, activeSessionId: sessionId })
      );
    } catch {}
  };

  const startRenameSession = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditingSessionTitle(currentTitle || "New Chat");
  };

  const saveRenameSession = (sessionId: string) => {
    const nextTitle = editingSessionTitle.trim() || "New Chat";
    setSessions((prev) => {
      const updated = prev.map((session) =>
        session.id === sessionId ? { ...session, title: nextTitle, updatedAt: Date.now() } : session
      );
      try {
        localStorage.setItem(
          CHAT_STORAGE_KEY,
          JSON.stringify({ sessions: updated, activeSessionId })
        );
      } catch {}
      return updated;
    });
    setEditingSessionId(null);
    setEditingSessionTitle("");
  };

  const deleteSession = (sessionId: string) => {
    setSessions((prev) => {
      const remaining = prev.filter((session) => session.id !== sessionId);
      let nextSessions = remaining;
      let nextActiveId = activeSessionId;

      if (remaining.length === 0) {
        const starter = createSession();
        nextSessions = [starter];
        nextActiveId = starter.id;
      } else if (activeSessionId === sessionId) {
        nextActiveId = remaining[0].id;
      }

      const nextActive = nextSessions.find((session) => session.id === nextActiveId) || nextSessions[0];
      setActiveSessionId(nextActive.id);
      setMessages(nextActive.messages.slice(-MAX_SESSION_MESSAGES));
      setInput("");
      setShowNewMessageIndicator(false);
      setEditingSessionId(null);
      setEditingSessionTitle("");

      try {
        localStorage.setItem(
          CHAT_STORAGE_KEY,
          JSON.stringify({ sessions: nextSessions, activeSessionId: nextActive.id })
        );
      } catch {}

      return nextSessions;
    });
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceFromBottom <= 80;

    if (nearBottom) {
      container.scrollTop = container.scrollHeight;
      setShowNewMessageIndicator(false);
    } else if (messages.length > prevMessageCountRef.current) {
      setShowNewMessageIndicator(true);
    }

    prevMessageCountRef.current = messages.length;
  }, [messages]);

  const handleChatScroll = () => {
    const container = scrollRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceFromBottom <= 80;
    setIsNearBottom(nearBottom);

    if (nearBottom) setShowNewMessageIndicator(false);
  };

  const scrollToLatest = () => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    setShowNewMessageIndicator(false);
    setIsNearBottom(true);
  };

  const clearCurrentChat = () => {
    if (typingTimerRef.current !== null) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setMessages([]);
  };

  const typeBotMessage = async (
    text: string,
    meta?: { source?: string; citations?: string[] }
  ) => {
    const fullText = text || "";
    const messageId = `${Date.now()}-bot`;
    const createdAt = Date.now();

    setMessages((prev) =>
      [
        ...prev,
        {
          id: messageId,
          role: "bot" as const,
          content: "",
          source: meta?.source,
          citations: meta?.citations,
          createdAt,
        },
      ].slice(-MAX_SESSION_MESSAGES)
    );

    if (!fullText) return;

    await new Promise<void>((resolve) => {
      let cursor = 0;
      const step = Math.max(1, Math.ceil(fullText.length / 220));

      typingTimerRef.current = window.setInterval(() => {
        cursor = Math.min(fullText.length, cursor + step);
        const nextText = fullText.slice(0, cursor);

        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, content: nextText } : m))
        );

        if (cursor >= fullText.length) {
          if (typingTimerRef.current !== null) {
            window.clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
          }
          resolve();
        }
      }, TYPE_INTERVAL_MS);
    });
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const now = Date.now();
    const userMsg: Message = {
      id: now.toString(),
      role: "user",
      content: trimmedInput,
      createdAt: now,
    };

    const historyPayload = [...messages, userMsg]
      .slice(-CONTEXT_WINDOW)
      .map((msg) => ({
        role: msg.role,
        content: msg.content.slice(0, MAX_HISTORY_CHARS),
      }));

    setMessages((prev) => [...prev, userMsg].slice(-MAX_SESSION_MESSAGES));
    setInput("");
    setIsLoading(true);
    adjustHeight(true);

    try {
      const response = await sendSupportChatMessage(trimmedInput, historyPayload);
      setIsLoading(false);
      await typeBotMessage(response.data.reply, {
        source: response.data.source,
        citations: response.data.citations,
      });
    } catch (err) {
      setIsLoading(false);
      const fallbackMessage =
        "Sorry, I encountered an error. Please contact ETHOS Support directly if this persists.";

      if (err instanceof ApiRequestError) {
        const details = err.details as { retryAfterSeconds?: number; code?: string } | undefined;
        const retryAfterSeconds = Number(details?.retryAfterSeconds);
        const hasRetryWindow = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0;

        if (err.statusCode === 429 || details?.code === "GEMINI_QUOTA_EXCEEDED") {
          await typeBotMessage(
            hasRetryWindow
              ? `I'm temporarily rate limited right now. Please try again in about ${Math.ceil(
                  retryAfterSeconds
                )} seconds.`
              : "I'm temporarily rate limited right now. Please try again shortly."
          );
          return;
        }

        await typeBotMessage(err.message || fallbackMessage);
        return;
      }

      await typeBotMessage(fallbackMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimerRef.current !== null) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, []);

  const hasMessages = messages.length > 0;

  const composer = (
    <div className="relative w-full rounded-3xl border border-white/20 bg-slate-950/80 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <Textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          adjustHeight();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Type your request..."
        className={cn(
          "w-full resize-none border-none px-5 pt-3.5 pb-12",
          "bg-transparent text-sm text-white",
          "focus-visible:ring-0 focus-visible:ring-offset-0",
          "min-h-[112px] placeholder:text-neutral-300/75"
        )}
        style={{ overflow: "hidden" }}
      />

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3.5 pb-3.5">
        <Button
          type="button"
          variant="ghost"
          className="h-9 w-9 rounded-full border border-white/15 bg-white/5 p-0 text-neutral-200 hover:bg-white/10 hover:text-white"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className={cn(
            "h-9 w-9 rounded-lg p-0 transition-all",
            isLoading || !input.trim()
              ? "cursor-not-allowed bg-white/10 text-neutral-400 opacity-60"
              : "bg-white/12 text-white hover:bg-white/20 active:scale-95"
          )}
        >
          <ArrowUpIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div
      className="relative h-full min-h-0 w-full overflow-hidden bg-black"
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-cover bg-center transition-opacity duration-[1400ms] ease-out",
          hasMessages ? "opacity-0" : "opacity-100"
        )}
        style={{
          backgroundImage:
            "url('https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/ruixen_moon_2.png')",
          backgroundAttachment: "fixed",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-b from-slate-950/55 via-blue-950/30 to-slate-950/85 transition-opacity duration-[1400ms] ease-out",
          hasMessages ? "opacity-0" : "opacity-100"
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.24),transparent_44%)] transition-opacity duration-[1400ms] ease-out",
          hasMessages ? "opacity-0" : "opacity-100"
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-black transition-opacity duration-[1400ms] ease-out",
          hasMessages ? "opacity-100" : "opacity-0"
        )}
      />

      <div className="relative z-10 grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] px-4 pb-3 pt-4 md:px-6">
        <div className="mx-auto w-full max-w-4xl space-y-2">
          <div className="flex items-center justify-between px-1 py-1.5">
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/8 px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.14em] text-neutral-100 backdrop-blur-sm font-logo">
              Ethos AI
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCurrentChat}
                disabled={messages.length === 0}
                aria-label="Clear chat"
                title="Clear chat"
                className="h-10 w-10 rounded-full p-0 text-neutral-200 hover:bg-white/12 hover:text-white disabled:opacity-40"
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={startNewChat}
                aria-label="Start new chat"
                title="Start new chat"
                className="h-10 w-10 rounded-full p-0 text-neutral-200 hover:bg-white/12 hover:text-white"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {sessions.length > 1 && (
            <div className="chat-scrollbar flex gap-2.5 overflow-x-auto pb-1.5">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs transition-all backdrop-blur-sm",
                    session.id === activeSessionId
                      ? "border-indigo-200/45 bg-linear-to-r from-indigo-500/30 to-fuchsia-500/25 text-white shadow-lg shadow-indigo-950/35"
                      : "border-white/12 bg-white/6 text-neutral-300 hover:border-white/30 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {editingSessionId === session.id ? (
                    <>
                      <input
                        value={editingSessionTitle}
                        onChange={(e) => setEditingSessionTitle(e.target.value)}
                        className="h-7 w-32 rounded-md border border-white/20 bg-black/25 px-2.5 text-[11px] text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => saveRenameSession(session.id)}
                        className="rounded-md p-1 transition hover:bg-white/15"
                        aria-label="Save session name"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSessionId(null);
                          setEditingSessionTitle("");
                        }}
                        className="rounded-md p-1 transition hover:bg-white/15"
                        aria-label="Cancel rename"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => switchSession(session.id)}
                        className="max-w-36 truncate px-1 text-left font-medium"
                        title={session.title || "New Chat"}
                      >
                        {session.title || "New Chat"}
                      </button>
                      <button
                        type="button"
                        onClick={() => startRenameSession(session.id, session.title)}
                        className="rounded-md p-1 text-neutral-300/90 transition hover:bg-white/15 hover:text-white"
                        aria-label="Rename session"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSession(session.id)}
                        className="rounded-md p-1 text-neutral-300/90 transition hover:bg-rose-500/20 hover:text-rose-100"
                        aria-label="Delete session"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative mx-auto mt-3 h-full min-h-0 w-full max-w-4xl">
          <div
            ref={scrollRef}
            onScroll={handleChatScroll}
            className={cn(
              "chat-scrollbar h-full w-full overflow-y-auto px-2 pb-6 pt-2 md:px-6",
              "[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.65)_rgba(15,23,42,0.25)]"
            )}
          >
            {messages.length === 0 ? (
              <div className="mx-auto flex h-full w-full max-w-4xl flex-col items-center justify-center gap-8 px-2 pb-8">
                <div className="max-w-2xl text-center">
                  <h1 className="font-logo text-4xl font-semibold uppercase tracking-[0.12em] text-white md:text-5xl">
                    Ethos AI
                  </h1>
                  <p className="mt-3 font-mono text-base tracking-wide text-neutral-300/95">
                    Your confidential assistant for filing complaints, managing evidence, and understanding policy guidance.
                  </p>
                </div>
                <div className="w-full max-w-4xl">{composer}</div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-5 pb-2">
                {messages.map((msg) => (
                  msg.role === "user" ? (
                    <div
                      key={msg.id}
                      className="ml-auto max-w-[80%] rounded-2xl bg-white px-4 py-3 text-sm leading-relaxed text-black"
                    >
                      {msg.content}
                    </div>
                  ) : (
                    <div key={msg.id} className="mr-auto w-full px-1 text-sm leading-relaxed text-neutral-100">
                      <div className="space-y-2">
                        {renderMessageContent(msg.content)}
                        {extractRoutesFromContent(msg.content).length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {extractRoutesFromContent(msg.content).map((route) => (
                              <Link
                                key={route}
                                href={route}
                                className="rounded-full border border-blue-300/40 bg-blue-500/10 px-2.5 py-1 text-[11px] text-blue-100 transition hover:bg-blue-500/20"
                              >
                                Open {route}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
            {isLoading && (
              <div className="mx-auto mt-2 w-full max-w-3xl px-1 text-sm text-neutral-200">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-blue-300" />
                  Preparing response...
                </span>
              </div>
            )}
          </div>

          {showNewMessageIndicator && !isNearBottom && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 w-full -translate-x-1/2 px-4">
              <div className="flex justify-center">
                <Button
                  type="button"
                  onClick={scrollToLatest}
                  className="pointer-events-auto h-9 rounded-full border border-white/35 bg-slate-900/90 px-4 text-xs text-white shadow-lg shadow-black/40 backdrop-blur-md hover:bg-slate-800"
                >
                  <ChevronDown className="mr-1 h-3.5 w-3.5" />
                  New messages
                </Button>
              </div>
            </div>
          )}
        </div>

        {hasMessages && <div className="mx-auto mt-2 w-full max-w-4xl">{composer}</div>}
      </div>
    </div>
  );
}

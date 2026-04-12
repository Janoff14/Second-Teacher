"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listConversations,
  listMessages,
  sendMessage,
  unwrapMessageList,
  unwrapThreadList,
  type ConversationThread,
  type DirectMessage,
} from "@/lib/api/messages";
import { getResolvedUserId } from "@/stores/auth-store";

function formatRelative(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(d);
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(d);
}

export default function MessagesPage() {
  const currentUserId = getResolvedUserId() || "";

  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeThread, setActiveThread] = useState<ConversationThread | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadThreads = useCallback(async () => {
    setThreadsLoading(true);
    setError(null);
    const res = await listConversations();
    setThreadsLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setThreads([]);
      return;
    }
    setThreads(unwrapThreadList(res.data));
  }, []);

  const loadMessages = useCallback(async (recipientId: string) => {
    setMsgsLoading(true);
    const res = await listMessages(recipientId);
    setMsgsLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setMessages(unwrapMessageList(res.data));
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!activeThread) return;
    void loadMessages(activeThread.recipientId);
  }, [activeThread, loadMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (activeThread) inputRef.current?.focus();
  }, [activeThread]);

  function selectThread(t: ConversationThread) {
    setActiveThread(t);
    setMessages([]);
    setInput("");
  }

  async function handleSend() {
    if (!activeThread || !input.trim() || sending) return;
    setSending(true);
    setError(null);
    const res = await sendMessage(activeThread.recipientId, input.trim());
    setSending(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setInput("");
    await loadMessages(activeThread.recipientId);
    await loadThreads();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Messages
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Direct conversations between you and your teachers or students.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
        >
          {error}
        </div>
      )}

      <div className="grid min-h-[60vh] gap-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950 md:grid-cols-[320px_1fr]">
        {/* Thread list */}
        <div className="border-r border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Conversations
            </p>
            <button
              type="button"
              onClick={() => void loadThreads()}
              disabled={threadsLoading}
              className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              title="Refresh"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="max-h-[55vh] overflow-y-auto">
            {threadsLoading && threads.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-neutral-400">Loading…</p>
            ) : threads.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-8 w-8 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  No conversations yet.
                </p>
                <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                  Start one from a student&apos;s profile.
                </p>
              </div>
            ) : (
              <ul>
                {threads.map((t) => {
                  const selected = activeThread?.recipientId === t.recipientId;
                  return (
                    <li key={t.recipientId}>
                      <button
                        type="button"
                        onClick={() => selectThread(t)}
                        className={`w-full px-4 py-3 text-left transition-colors ${
                          selected
                            ? "bg-brand-50 dark:bg-brand-950/30"
                            : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate text-sm font-medium ${selected ? "text-brand-700 dark:text-brand-300" : "text-neutral-900 dark:text-neutral-100"}`}>
                            {t.recipientName || t.recipientId}
                          </p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {t.lastMessageAt && (
                              <span className="text-[10px] text-neutral-400">
                                {formatRelative(t.lastMessageAt)}
                              </span>
                            )}
                            {(t.unreadCount ?? 0) > 0 && (
                              <span className="flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                                {t.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                        {t.lastMessage && (
                          <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                            {t.lastMessage}
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Chat pane */}
        <div className="flex flex-col">
          {!activeThread ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-neutral-200 dark:text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                  Select a conversation to start messaging
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3 dark:border-neutral-800">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-900 dark:text-neutral-50">
                    {activeThread.recipientName || activeThread.recipientId}
                  </p>
                  {activeThread.recipientRole && (
                    <p className="text-xs capitalize text-neutral-500 dark:text-neutral-400">
                      {activeThread.recipientRole}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveThread(null)}
                  className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 md:hidden"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 300, maxHeight: "50vh" }}>
                {msgsLoading ? (
                  <p className="text-center text-sm text-neutral-400">Loading messages…</p>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-neutral-400 dark:text-neutral-500">
                    No messages yet — start the conversation!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isMe = msg.senderId === currentUserId;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                              isMe
                                ? "bg-brand-600 text-white dark:bg-brand-500"
                                : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.body}</p>
                            <p
                              className={`mt-1 text-right text-[10px] ${
                                isMe ? "text-white/60" : "text-neutral-400 dark:text-neutral-500"
                              }`}
                            >
                              {formatTime(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-neutral-100 p-3 dark:border-neutral-800">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message…"
                    rows={1}
                    className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 dark:border-neutral-600 dark:bg-neutral-800 dark:placeholder:text-neutral-500"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!input.trim() || sending}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-opacity disabled:opacity-40 dark:bg-brand-500"
                  >
                    {sending ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

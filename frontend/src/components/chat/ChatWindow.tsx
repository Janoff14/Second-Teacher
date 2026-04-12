"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listMessages,
  sendMessage,
  unwrapMessageList,
  type DirectMessage,
} from "@/lib/api/messages";
import type { GroupStudent } from "@/lib/api/academic";

type RiskLevel = GroupStudent["riskLevel"];

function getSuggestions(riskLevel: RiskLevel, studentName: string): string[] {
  const name = studentName || "student";
  switch (riskLevel) {
    case "at_risk":
      return [
        `Hi ${name}, I noticed you might be struggling — let's set up a time to talk.`,
        `${name}, I want to help you get back on track. What topics are giving you the most trouble?`,
        `Hey ${name}, your recent scores show some areas we can improve together. Would you like some extra practice material?`,
      ];
    case "watchlist":
      return [
        `Hi ${name}, just checking in — how are you feeling about the current material?`,
        `${name}, I see some room for improvement. Let me know if you'd like additional resources.`,
        `Hey ${name}, keep up the effort! Let me know if anything is unclear.`,
      ];
    case "low_load":
      return [
        `Great work, ${name}! Would you like some bonus challenges?`,
        `${name}, you're doing excellent — have you considered helping classmates who are struggling?`,
        `Hi ${name}, impressed by your progress! Here are some advanced materials you might enjoy.`,
      ];
    case "stable":
      return [
        `Hi ${name}, you're doing well — keep up the good work!`,
        `${name}, nice consistency. Let me know if you want to push further.`,
      ];
    default:
      return [
        `Hi ${name}, how are you doing in this class? Let me know if you need any help.`,
        `${name}, feel free to reach out anytime you have questions.`,
      ];
  }
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

export function ChatWindow({
  recipientId,
  recipientName,
  riskLevel,
  currentUserId,
  onClose,
}: {
  recipientId: string;
  recipientName: string;
  riskLevel?: RiskLevel;
  currentUserId: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestions = getSuggestions(riskLevel, recipientName);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listMessages(recipientId);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setMessages(unwrapMessageList(res.data));
  }, [recipientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const res = await sendMessage(recipientId, text);
    setSending(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setInput("");
    await load();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function useSuggestion(text: string) {
    setInput(text);
    inputRef.current?.focus();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5 dark:border-neutral-700">
          <div className="min-w-0">
            <p className="truncate font-semibold text-neutral-900 dark:text-neutral-50">
              {recipientName || recipientId}
            </p>
            {riskLevel && riskLevel !== "stable" && (
              <p className="mt-0.5 text-xs capitalize text-neutral-500 dark:text-neutral-400">
                {riskLevel.replace(/_/g, " ")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Suggestions strip */}
        {messages.length === 0 && !loading && (
          <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
            <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Suggested messages
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => useSuggestion(s)}
                  className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-left text-xs text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/60"
                >
                  {s.length > 70 ? s.slice(0, 67) + "…" : s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4" style={{ minHeight: 200 }}>
          {loading ? (
            <p className="text-center text-sm text-neutral-400">Loading messages…</p>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
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
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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
        <div className="border-t border-neutral-200 p-3 dark:border-neutral-700">
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
      </div>
    </div>
  );
}

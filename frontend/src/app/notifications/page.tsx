"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  listMyNotifications,
  markNotificationRead,
  unwrapNotificationList,
  type AppNotification,
} from "@/lib/api/notifications";
import {
  listConversations,
  unwrapThreadList,
  type ConversationThread,
} from "@/lib/api/messages";
import { useAuthStore } from "@/stores/auth-store";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { getResolvedUserId } from "@/stores/auth-store";

type TabId = "alerts" | "messages";

function riskDotClass(level?: string | null) {
  switch (level) {
    case "at_risk":
      return "bg-red-500";
    case "watchlist":
      return "bg-amber-500";
    case "low_load":
      return "bg-sky-500";
    case "stable":
      return "bg-emerald-500";
    default:
      return "bg-neutral-400";
  }
}

function riskBorderClass(level?: string | null) {
  switch (level) {
    case "at_risk":
      return "border-l-red-500";
    case "watchlist":
      return "border-l-amber-500";
    case "low_load":
      return "border-l-sky-500";
    default:
      return "border-l-transparent";
  }
}

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

function studentProfileHref(
  role: string | null,
  notification: AppNotification,
): string | null {
  if (!notification.studentId) return null;
  if (role === "teacher" && notification.groupId) {
    return `/teacher/groups/${encodeURIComponent(notification.groupId)}/students/${encodeURIComponent(notification.studentId)}`;
  }
  if (role === "student" && notification.groupId) {
    return `/student/subjects/${encodeURIComponent(notification.groupId)}`;
  }
  return null;
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<TabId>("alerts");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const role = useAuthStore((s) => s.role);

  const [chatOpen, setChatOpen] = useState<ConversationThread | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listMyNotifications(100);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setItems([]);
      return;
    }
    setItems(unwrapNotificationList(res.data));
  }, []);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listConversations();
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setThreads([]);
      return;
    }
    setThreads(unwrapThreadList(res.data));
  }, []);

  useEffect(() => {
    if (tab === "alerts") void loadAlerts();
    else void loadThreads();
  }, [tab, loadAlerts, loadThreads]);

  async function handleMarkRead(n: AppNotification) {
    if (n.read !== false) return;
    await markNotificationRead(n.id);
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
  }

  const unreadAlerts = items.filter((n) => n.read === false).length;
  const atRiskAlerts = items.filter((n) => n.riskLevel === "at_risk");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Stay updated on student alerts and direct messages.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("alerts")}
          className={
            tab === "alerts"
              ? "rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
              : "rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          }
        >
          Alerts
          {unreadAlerts > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
              {unreadAlerts > 99 ? "99+" : unreadAlerts}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("messages")}
          className={
            tab === "messages"
              ? "rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
              : "rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          }
        >
          Messages
          {threads.length > 0 && tab !== "messages" && (
            <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
              {threads.reduce((s, t) => s + (t.unreadCount ?? 0), 0) || ""}
            </span>
          )}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
        >
          {error}
        </div>
      )}

      {/* At-risk summary strip for teachers */}
      {tab === "alerts" && role === "teacher" && atRiskAlerts.length > 0 && (
        <div className="rounded-2xl border border-red-200/70 bg-gradient-to-r from-red-50 to-orange-50 p-4 shadow-sm dark:border-red-900/40 dark:from-red-950/30 dark:to-orange-950/20">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                {atRiskAlerts.length} at-risk {atRiskAlerts.length === 1 ? "student" : "students"} need attention
              </p>
              <p className="text-xs text-red-700/80 dark:text-red-300/60">
                Review alerts below and follow up with students who are falling behind.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Alerts tab */}
      {tab === "alerts" && (
        <>
          {loading && items.length === 0 && !error ? (
            <p className="text-sm text-neutral-500">Loading notifications…</p>
          ) : null}

          {!loading && !error && items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-12 text-center dark:border-neutral-700 dark:bg-neutral-900/40">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                No notifications yet. You&apos;ll be alerted when students need attention.
              </p>
            </div>
          ) : null}

          {items.length > 0 && (
            <ul className="space-y-3">
              {items.map((n) => {
                const profileHref = studentProfileHref(role, n);
                return (
                  <li
                    key={n.id}
                    onClick={() => void handleMarkRead(n)}
                    className={`cursor-pointer rounded-2xl border border-l-4 bg-white p-4 shadow-sm transition-colors dark:bg-neutral-950 ${
                      n.read === false
                        ? "border-neutral-200 bg-blue-50/30 dark:border-neutral-800 dark:bg-blue-950/10"
                        : "border-neutral-200 dark:border-neutral-800"
                    } ${riskBorderClass(n.riskLevel)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {n.riskLevel && (
                          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${riskDotClass(n.riskLevel)}`} />
                        )}
                        <div className="min-w-0">
                          {n.type && (
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                              {n.type.replace(/_/g, " ")}
                            </p>
                          )}
                          {n.title && (
                            <p className="mt-0.5 font-medium text-neutral-900 dark:text-neutral-100">
                              {n.title}
                            </p>
                          )}
                          {(n.message || n.body || n.summary) && (
                            <p className="mt-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                              {n.message ?? n.body ?? n.summary}
                            </p>
                          )}
                          {n.subjectName && (
                            <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                              Subject: {n.subjectName}
                            </p>
                          )}

                          {/* Student profile link */}
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            {profileHref && (
                              <Link
                                href={profileHref}
                                className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/60"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                                {n.studentName
                                  ? `View ${n.studentName}'s profile`
                                  : "View student profile"}
                              </Link>
                            )}
                            {n.groupId && role === "student" && (
                              <Link
                                href={`/student/subjects/${encodeURIComponent(n.groupId)}`}
                                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                              >
                                Open subject workspace
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {n.createdAt && (
                          <span className="text-xs text-neutral-400">
                            {formatRelative(n.createdAt)}
                          </span>
                        )}
                        {n.read === false && (
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && items.length > 0 && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => void loadAlerts()}
                className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Refresh
              </button>
            </div>
          )}
        </>
      )}

      {/* Messages tab */}
      {tab === "messages" && (
        <>
          {loading && threads.length === 0 && !error ? (
            <p className="text-sm text-neutral-500">Loading conversations…</p>
          ) : null}

          {!loading && !error && threads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-12 text-center dark:border-neutral-700 dark:bg-neutral-900/40">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                No conversations yet. Send a message from a student&apos;s profile card.
              </p>
            </div>
          ) : null}

          {threads.length > 0 && (
            <ul className="space-y-2">
              {threads.map((t) => (
                <li key={t.recipientId}>
                  <button
                    type="button"
                    onClick={() => setChatOpen(t)}
                    className="w-full rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                          {t.recipientName || t.recipientId}
                        </p>
                        {t.lastMessage && (
                          <p className="mt-1 truncate text-sm text-neutral-500 dark:text-neutral-400">
                            {t.lastMessage}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {t.lastMessageAt && (
                          <span className="text-xs text-neutral-400">
                            {formatRelative(t.lastMessageAt)}
                          </span>
                        )}
                        {(t.unreadCount ?? 0) > 0 && (
                          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
                            {t.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!loading && threads.length > 0 && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => void loadThreads()}
                className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Refresh
              </button>
            </div>
          )}
        </>
      )}

      {chatOpen && (
        <ChatWindow
          recipientId={chatOpen.recipientId}
          recipientName={chatOpen.recipientName || chatOpen.recipientId}
          currentUserId={getResolvedUserId() || ""}
          onClose={() => {
            setChatOpen(null);
            void loadThreads();
          }}
        />
      )}
    </div>
  );
}

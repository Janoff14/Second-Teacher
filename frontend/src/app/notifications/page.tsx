"use client";

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  listMyNotifications,
  unwrapNotificationList,
  type AppNotification,
} from "@/lib/api/notifications";

const LIMIT_OPTIONS = [10, 25, 50, 100] as const;

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
    >
      {message}
    </div>
  );
}

export default function NotificationsPage() {
  const [limit, setLimit] = useState<number>(50);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listMyNotifications(limit);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setItems([]);
      return;
    }
    setItems(unwrapNotificationList(res.data));
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          AI alerts
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
            GET /notifications/me
          </code>{" "}
          — optional{" "}
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
            limit
          </code>{" "}
          (1–100).
        </p>
      </div>

      <ErrorBox message={error} />

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <span>Limit</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-950"
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {loading && items.length === 0 && !error ? (
        <p className="text-sm text-neutral-500">Loading notifications…</p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
          No notifications yet.
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className="rounded-[1.75rem] border border-neutral-200 bg-white px-4 py-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-mono text-xs text-neutral-500">{n.id}</p>
                {n.createdAt && (
                  <time
                    className="text-xs text-neutral-500"
                    dateTime={n.createdAt}
                  >
                    {n.createdAt}
                  </time>
                )}
              </div>
              {n.type && (
                <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                  {n.type}
                </p>
              )}
              {n.subjectName && (
                <p className="mt-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {n.subjectName}
                </p>
              )}
              {(n.title || n.message || n.body || n.summary) && (
                <p className="mt-2 text-sm text-neutral-800 dark:text-neutral-200">
                  {n.title && <strong>{n.title}</strong>}
                  {(n.message || n.body || n.summary) && (
                    <span className="mt-1 block whitespace-pre-wrap">
                      {n.message ?? n.body ?? n.summary}
                    </span>
                  )}
                </p>
              )}
              {n.groupId ? (
                <div className="mt-3">
                  <Link
                    href={`/student/subjects/${n.groupId}`}
                    className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Open subject workspace
                  </Link>
                </div>
              ) : null}
              {n.read === false && (
                <span className="mt-2 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
                  Unread
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

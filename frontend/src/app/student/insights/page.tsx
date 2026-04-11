"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listStudentInsightsMe,
  unwrapInsightList,
  type Insight,
} from "@/lib/api/insights";
import { useAuthStore } from "@/stores/auth-store";

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

export default function StudentInsightsPage() {
  const activeGroupId = useAuthStore((s) => s.activeGroupId);
  const [groupId, setGroupId] = useState("");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeGroupId) setGroupId(activeGroupId);
  }, [activeGroupId]);

  const load = useCallback(async () => {
    const gid = groupId.trim() || activeGroupId?.trim() || "";
    if (!gid) {
      setError("Enter groupId or join a class.");
      setInsights([]);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await listStudentInsightsMe(gid);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setInsights([]);
      return;
    }
    setInsights(unwrapInsightList(res.data));
  }, [groupId, activeGroupId]);

  useEffect(() => {
    if (activeGroupId) void load();
  }, [activeGroupId, load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          My insights
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
            GET /insights/me?groupId=
          </code>
        </p>
      </div>

      <ErrorBox message={error} />

      <div className="flex flex-wrap gap-2">
        <input
          placeholder="groupId"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="min-w-[240px] flex-1 rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-950"
        />
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <ul className="space-y-3">
        {insights.map((ins) => (
          <li
            key={ins.id}
            className="rounded-md border border-neutral-200 px-3 py-3 dark:border-neutral-800"
          >
            <p className="font-mono text-xs text-neutral-500">{ins.id}</p>
            {(ins.title || ins.message || ins.body || ins.summary) && (
              <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">
                {ins.title && <strong>{ins.title}</strong>}
                {(ins.message || ins.body || ins.summary) && (
                  <span className="mt-1 block whitespace-pre-wrap">
                    {ins.message ?? ins.body ?? ins.summary}
                  </span>
                )}
              </p>
            )}
            {ins.createdAt && (
              <p className="mt-2 text-xs text-neutral-500">{ins.createdAt}</p>
            )}
          </li>
        ))}
      </ul>
      {insights.length === 0 && !loading && (
        <p className="text-sm text-neutral-500">No insights yet.</p>
      )}
    </div>
  );
}

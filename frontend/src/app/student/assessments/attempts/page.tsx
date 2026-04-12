"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  listMyAttempts,
  unwrapAttemptList,
  type AttemptRecord,
} from "@/lib/api/assessments";
import { useAuthStore } from "@/stores/auth-store";

export default function StudentAttemptsPage() {
  const activeGroupId = useAuthStore((s) => s.activeGroupId);
  const [groupId, setGroupId] = useState("");
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backHref = activeGroupId ? `/student/subjects/${activeGroupId}` : "/student";

  useEffect(() => {
    if (activeGroupId) setGroupId(activeGroupId);
  }, [activeGroupId]);

  const load = useCallback(async () => {
    const gid = groupId.trim() || activeGroupId?.trim() || "";
    if (!gid) {
      setError("Join a class first to see your attempts.");
      setAttempts([]);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await listMyAttempts(gid);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setAttempts([]);
      return;
    }
    setAttempts(unwrapAttemptList(res.data));
  }, [groupId, activeGroupId]);

  useEffect(() => {
    if (activeGroupId) void load();
  }, [activeGroupId, load]);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-neutral-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.10),_transparent_40%),linear-gradient(135deg,#ffffff,_#f8fafc)] p-5 shadow-sm dark:border-neutral-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_40%),linear-gradient(135deg,#0a0a0a,_#111827)]">
        <Link
          href={backHref}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Back to subject
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
          My attempts
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Review your assessment history and scores. Open any assessment to retake it.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {!activeGroupId ? (
        <div className="flex flex-wrap gap-3">
          <input
            placeholder="Group ID"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="min-w-[240px] flex-1 rounded-2xl border border-neutral-300 px-4 py-3 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            {loading ? "Loading..." : "Load attempts"}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-3 py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
          <p className="text-sm text-neutral-500">Loading your attempts...</p>
        </div>
      ) : null}

      {!loading && attempts.length === 0 && !error ? (
        <div className="rounded-[2rem] border border-dashed border-neutral-300 bg-neutral-50 px-5 py-10 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
          No attempts recorded yet. Open an assessment from your subject workspace to get started.
        </div>
      ) : null}

      {attempts.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-neutral-500">
            <span>{attempts.length} attempt{attempts.length === 1 ? "" : "s"} total</span>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
            >
              Refresh
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {attempts.map((a) => {
              const score = typeof a.score === "number" ? a.score : null;
              const maxScore = typeof (a as Record<string, unknown>).maxScore === "number"
                ? ((a as Record<string, unknown>).maxScore as number)
                : null;
              const pct = score !== null && maxScore !== null && maxScore > 0
                ? Math.round((score / maxScore) * 100)
                : null;
              const pctColor = pct !== null
                ? pct >= 75 ? "text-emerald-700 dark:text-emerald-300" : pct >= 50 ? "text-amber-700 dark:text-amber-300" : "text-red-700 dark:text-red-300"
                : "text-neutral-500";

              return (
                <div
                  key={a.id}
                  className="rounded-[1.75rem] border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {a.publishedAssessmentId ? (
                        <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {a.publishedAssessmentId}
                        </p>
                      ) : null}
                      {a.submittedAt ? (
                        <p className="mt-1 text-xs text-neutral-500">
                          {new Date(a.submittedAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                    {pct !== null ? (
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${pctColor}`}>{pct}%</p>
                        <p className="text-[10px] text-neutral-500">{score}/{maxScore}</p>
                      </div>
                    ) : score !== null ? (
                      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-sm font-semibold text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                        {score} pts
                      </span>
                    ) : null}
                  </div>
                  {pct !== null ? (
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  ) : null}
                  {a.publishedAssessmentId ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/student/assessments/take/${a.publishedAssessmentId}`}
                        className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                      >
                        Retake
                      </Link>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

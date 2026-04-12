"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  listPublishedAssessments,
  unwrapPublishedList,
  type PublishedAssessment,
} from "@/lib/api/assessments";
import { useAuthStore } from "@/stores/auth-store";

export default function StudentAssessmentsPage() {
  const activeGroupId = useAuthStore((s) => s.activeGroupId);
  const [groupId, setGroupId] = useState("");
  const [list, setList] = useState<PublishedAssessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backHref = activeGroupId ? `/student/subjects/${activeGroupId}` : "/student";

  useEffect(() => {
    if (activeGroupId) setGroupId(activeGroupId);
  }, [activeGroupId]);

  const load = useCallback(async () => {
    const gid = groupId.trim() || activeGroupId?.trim() || "";
    if (!gid) {
      setError("Set a group id or join a class first.");
      setList([]);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await listPublishedAssessments(gid);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setList([]);
      return;
    }
    setList(unwrapPublishedList(res.data));
  }, [groupId, activeGroupId]);

  useEffect(() => {
    if (activeGroupId) void load();
  }, [activeGroupId, load]);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-neutral-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_40%),linear-gradient(135deg,#ffffff,_#f8fafc)] p-5 shadow-sm dark:border-neutral-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_40%),linear-gradient(135deg,#0a0a0a,_#111827)]">
        <Link
          href={backHref}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Back to subject
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
          Available assessments
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Open an assessment to submit an attempt. Your results will feed into the AI analytics and study recommendations.
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
            {loading ? "Loading..." : "Load assessments"}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-3 py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
          <p className="text-sm text-neutral-500">Loading assessments...</p>
        </div>
      ) : null}

      {!loading && list.length === 0 && !error ? (
        <div className="rounded-[2rem] border border-dashed border-neutral-300 bg-neutral-50 px-5 py-10 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
          No published assessments available for this class yet.
        </div>
      ) : null}

      {list.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((p) => (
            <div
              key={p.id}
              className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-blue-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {p.title || "Untitled assessment"}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-neutral-400">{p.id}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                  Available
                </span>
              </div>
              <div className="mt-4">
                <Link
                  href={`/student/assessments/take/${p.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  Take assessment
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/student/assessments/attempts"
          className="rounded-full border border-neutral-300 px-4 py-2 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          View my attempts
        </Link>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  listMyAttempts,
  unwrapAttemptList,
  type AttemptRecord,
} from "@/lib/api/assessments";
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

export default function StudentAttemptsPage() {
  const activeGroupId = useAuthStore((s) => s.activeGroupId);
  const [groupId, setGroupId] = useState("");
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeGroupId) setGroupId(activeGroupId);
  }, [activeGroupId]);

  const load = useCallback(async () => {
    const gid = groupId.trim() || activeGroupId?.trim() || "";
    if (!gid) {
      setError("Enter groupId or join a class.");
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
      <Link
        href="/student/assessments"
        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
        ← Assessments
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
        My attempts
      </h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
          GET /assessments/attempts/me?groupId=
        </code>
      </p>

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

      <ul className="space-y-2 text-sm">
        {attempts.map((a) => (
          <li
            key={a.id}
            className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800"
          >
            <span className="font-mono">{a.id}</span>
            {a.publishedAssessmentId && (
              <span className="ml-2 text-neutral-600 dark:text-neutral-400">
                assessment {a.publishedAssessmentId}
              </span>
            )}
            {a.submittedAt && (
              <span className="ml-2 text-neutral-500">
                {new Date(a.submittedAt).toLocaleString()}
              </span>
            )}
            {a.score != null && (
              <span className="ml-2 font-medium">Score: {a.score}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

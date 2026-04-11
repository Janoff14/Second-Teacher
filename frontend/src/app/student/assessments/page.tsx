"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  listPublishedAssessments,
  unwrapPublishedList,
  type PublishedAssessment,
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

export default function StudentAssessmentsPage() {
  const activeGroupId = useAuthStore((s) => s.activeGroupId);
  const [groupId, setGroupId] = useState("");
  const [list, setList] = useState<PublishedAssessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Published assessments
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Open an assessment to submit an attempt.
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

      <ul className="space-y-2">
        {list.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800"
          >
            <div>
              <span className="font-mono text-sm">{p.id}</span>
              {p.title && (
                <span className="ml-2 text-neutral-600 dark:text-neutral-400">
                  {p.title}
                </span>
              )}
            </div>
            <Link
              href={`/student/assessments/take/${p.id}`}
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Take
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-sm">
        <Link
          href="/student/assessments/attempts"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          My attempts →
        </Link>
      </p>
    </div>
  );
}

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

export default function TeacherPublishedPage() {
  const [groupId, setGroupId] = useState("");
  const [list, setList] = useState<PublishedAssessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeGroupId = useAuthStore((s) => s.activeGroupId);

  useEffect(() => {
    if (activeGroupId && !groupId) setGroupId(activeGroupId);
  }, [activeGroupId, groupId]);

  const load = useCallback(async () => {
    const gid = groupId.trim();
    if (!gid) {
      setError("Enter a groupId to list published assessments.");
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
  }, [groupId]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/teacher/assessments"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Drafts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Published assessments
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
            GET /assessments/published?groupId=
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
          {loading ? "Loading…" : "Load"}
        </button>
      </div>

      <ul className="space-y-2">
        {list.map((p) => (
          <li
            key={p.id}
            className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800"
          >
            <span className="font-mono text-sm">{p.id}</span>
            {p.title && (
              <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">
                {p.title}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

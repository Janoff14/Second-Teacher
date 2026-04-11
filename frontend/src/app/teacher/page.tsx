"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  filterGroupsForTeacher,
  isExplicitEmptyTeacherScope,
  listGroups,
  listSubjects,
  listTeacherAcademicScope,
  unwrapTeacherAcademicScope,
} from "@/lib/api/academic";
import type { Group, Subject } from "@/lib/api/academic";
import { getResolvedUserId } from "@/stores/auth-store";

type SubjectWithGroups = Subject & { groups: Group[] };

export default function TeacherDashboardPage() {
  const [tree, setTree] = useState<SubjectWithGroups[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const teacherId = getResolvedUserId();

    const scopeRes = await listTeacherAcademicScope();
    if (scopeRes.ok) {
      const raw = scopeRes.data;
      const blocks = unwrapTeacherAcademicScope(raw);
      const useScope = blocks.length > 0 || isExplicitEmptyTeacherScope(raw);
      if (useScope) {
        const rows: SubjectWithGroups[] = blocks
          .map((block) => ({ ...block.subject, groups: block.groups }))
          .filter((row) => row.groups.length > 0);
        setTree(rows);
        setLoading(false);
        return;
      }
    }

    const subjectRes = await listSubjects();
    if (!subjectRes.ok) {
      setError(subjectRes.error.message);
      setTree([]);
      setLoading(false);
      return;
    }

    const subjects = Array.isArray(subjectRes.data) ? subjectRes.data : [];
    const rows: SubjectWithGroups[] = [];
    for (const subject of subjects) {
      const groupsRes = await listGroups(subject.id);
      const rawGroups = groupsRes.ok && Array.isArray(groupsRes.data) ? groupsRes.data : [];
      const groups = filterGroupsForTeacher(rawGroups, subject.id, teacherId);
      if (groups.length === 0) continue;
      rows.push({ ...subject, groups });
    }

    setTree(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            Teacher dashboard
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Select a subject to manage its classes and textbooks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
        >
          {error}
        </div>
      ) : null}

      {loading && tree.length === 0 ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : null}

      {!loading && tree.every((subject) => subject.groups.length === 0) ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
          No classes are available yet. An administrator can assign you to a class, or you can use{" "}
          <Link
            href="/teacher/structure"
            className="font-medium text-blue-600 underline dark:text-blue-400"
          >
            structure
          </Link>{" "}
          to create a subject and class.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tree.map((subject) => (
          <Link
            key={subject.id}
            href={`/teacher/subjects/${encodeURIComponent(subject.id)}`}
            className="flex min-h-[188px] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white px-6 py-8 text-center shadow-sm transition hover:border-blue-400/60 hover:ring-2 hover:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-blue-500/40"
          >
            <h2 className="text-balance text-xl font-semibold leading-snug text-neutral-900 dark:text-neutral-50">
              {subject.name}
            </h2>
            {subject.code ? (
              <p className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                {subject.code}
              </p>
            ) : null}
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {subject.groups.length} {subject.groups.length === 1 ? "class" : "classes"}
            </p>
          </Link>
        ))}
      </div>

      <p className="text-sm text-neutral-500">
        <Link href="/teacher/structure" className="text-blue-600 hover:underline dark:text-blue-400">
          Structure (subjects and classes)
        </Link>
      </p>
    </div>
  );
}

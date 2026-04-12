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
    <div className="space-y-8 animate-fade-in">
      <section className="rounded-4xl border border-brand-100/50 bg-gradient-to-br from-brand-50/40 via-white to-violet-50/30 p-7 shadow-card dark:border-slate-700 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-900/80">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
              Teacher
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              Dashboard
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              Select a subject to manage its classes and textbooks.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-full border border-brand-200 px-5 py-2 text-sm font-semibold text-brand-600 transition-all hover:bg-brand-50 hover:shadow-sm dark:border-brand-800 dark:text-brand-400 dark:hover:bg-brand-950"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
        >
          {error}
        </div>
      ) : null}

      {loading && tree.length === 0 ? (
        <div className="flex items-center gap-3 text-sm text-foreground/60">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
          Loading...
        </div>
      ) : null}

      {!loading && tree.every((subject) => subject.groups.length === 0) ? (
        <div className="rounded-3xl border-2 border-dashed border-foreground/15 bg-foreground/[0.04] px-6 py-12 text-center text-sm text-foreground/60">
          No classes are available yet. An administrator can assign you to a class, or you can use{" "}
          <Link
            href="/teacher/structure"
            className="font-semibold text-brand-500 underline-offset-2 hover:underline dark:text-brand-400"
          >
            structure
          </Link>{" "}
          to create a subject and class.
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {tree.map((subject) => (
          <Link
            key={subject.id}
            href={`/teacher/subjects/${encodeURIComponent(subject.id)}`}
            className="group flex min-h-[200px] flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-foreground/10 bg-white px-6 py-10 text-center shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-card-hover dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-700"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-violet-100 text-brand-600 dark:from-brand-900 dark:to-violet-900 dark:text-brand-300">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h2 className="text-balance text-xl font-bold leading-snug text-foreground transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-400">
              {subject.name}
            </h2>
            {subject.code ? (
              <p className="font-mono text-xs text-foreground/55">
                {subject.code}
              </p>
            ) : null}
            <p className="text-sm font-medium text-foreground/60">
              {subject.groups.length} {subject.groups.length === 1 ? "class" : "classes"}
            </p>
          </Link>
        ))}
      </div>

      <p className="text-sm">
        <Link href="/teacher/structure" className="font-semibold text-brand-500 hover:underline dark:text-brand-400">
          Structure (subjects and classes) &rarr;
        </Link>
      </p>
    </div>
  );
}

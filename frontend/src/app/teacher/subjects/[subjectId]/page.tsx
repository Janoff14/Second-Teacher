"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TeacherMaterialsPanel } from "@/components/teacher/TeacherMaterialsPanel";
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

type TabId = "groups" | "textbooks";

export default function SubjectPage() {
  const params = useParams();
  const subjectId = decodeURIComponent(params.subjectId as string);

  const [subject, setSubject] = useState<Subject | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("groups");

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
        const match = blocks.find((b) => b.subject.id === subjectId);
        if (match) {
          setSubject(match.subject);
          setGroups(match.groups);
          setLoading(false);
          return;
        }
      }
    }

    const subjectRes = await listSubjects();
    if (!subjectRes.ok) {
      setError(subjectRes.error.message);
      setLoading(false);
      return;
    }

    const subjects = Array.isArray(subjectRes.data) ? subjectRes.data : [];
    const found = subjects.find((s) => s.id === subjectId);
    if (!found) {
      setError("Subject not found or you do not have access.");
      setLoading(false);
      return;
    }

    setSubject(found);

    const groupsRes = await listGroups(found.id);
    const rawGroups = groupsRes.ok && Array.isArray(groupsRes.data) ? groupsRes.data : [];
    setGroups(filterGroupsForTeacher(rawGroups, found.id, teacherId));
    setLoading(false);
  }, [subjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs: Array<{ id: TabId; label: string; hint: string }> = [
    { id: "groups", label: "Classes", hint: `${groups.length} groups for this subject` },
    { id: "textbooks", label: "Textbooks", hint: "Shared materials for all classes" },
  ];

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading subject...</p>;
  }

  if (!subject) {
    return (
      <div className="space-y-4">
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
          >
            {error}
          </div>
        ) : null}
        <Link href="/teacher" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href="/teacher" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          Back to dashboard
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
              {subject.name}
            </h1>
            {subject.code ? (
              <p className="font-mono text-sm text-neutral-500 dark:text-neutral-400">
                {subject.code}
              </p>
            ) : null}
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {groups.length} {groups.length === 1 ? "class" : "classes"} · Manage groups and shared textbooks
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={
              tab === entry.id
                ? "rounded-2xl border border-neutral-900 bg-neutral-900 px-4 py-3 text-left text-sm text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                : "rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-left text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950/70 dark:text-neutral-200 dark:hover:bg-neutral-900"
            }
          >
            <span className="block font-medium">{entry.label}</span>
            <span className="mt-1 block text-xs opacity-80">{entry.hint}</span>
          </button>
        ))}
      </div>

      {tab === "groups" ? (
        <section className="space-y-4">
          {groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
              No classes for this subject yet. Use{" "}
              <Link href="/teacher/structure" className="font-medium text-blue-600 underline dark:text-blue-400">
                structure
              </Link>{" "}
              to create one.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/teacher/groups/${encodeURIComponent(group.id)}`}
                  className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-blue-400/60 hover:ring-2 hover:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-blue-500/40"
                >
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                      {group.name}
                    </h3>
                    <p className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                      {group.id}
                    </p>
                  </div>
                  <p className="mt-4 text-sm font-medium text-blue-600 dark:text-blue-400">
                    Open class workspace &rarr;
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === "textbooks" ? (
        <TeacherMaterialsPanel
          subjectId={subject.id}
          subjectName={subject.name}
        />
      ) : null}
    </div>
  );
}

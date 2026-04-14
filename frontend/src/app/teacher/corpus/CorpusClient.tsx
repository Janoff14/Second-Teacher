"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TeacherMaterialsPanel } from "@/components/teacher/TeacherMaterialsPanel";
import {
  listTeacherAcademicScope,
  unwrapTeacherAcademicScope,
  type Group,
  type Subject,
  type TeacherSubjectBlock,
} from "@/lib/api/academic";

export function CorpusClient() {
  const searchParams = useSearchParams();
  const routeSubjectId = searchParams.get("subjectId") ?? "";
  const routeSubjectName = searchParams.get("subjectName") ?? "";
  const routeGroupId = searchParams.get("groupId") ?? "";

  const [scope, setScope] = useState<TeacherSubjectBlock[]>([]);
  const [loadingScope, setLoadingScope] = useState(true);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState(routeSubjectId);
  const [selectedGroupId, setSelectedGroupId] = useState(routeGroupId);

  useEffect(() => {
    setSelectedSubjectId(routeSubjectId);
  }, [routeSubjectId]);

  useEffect(() => {
    setSelectedGroupId(routeGroupId);
  }, [routeGroupId]);

  useEffect(() => {
    let alive = true;
    async function loadScope() {
      setLoadingScope(true);
      setScopeError(null);
      const res = await listTeacherAcademicScope();
      if (!alive) return;
      setLoadingScope(false);
      if (!res.ok) {
        setScopeError(res.error.message);
        setScope([]);
        return;
      }
      setScope(unwrapTeacherAcademicScope(res.data));
    }
    void loadScope();
    return () => {
      alive = false;
    };
  }, []);

  const subjects = useMemo<Subject[]>(
    () => scope.map((block) => block.subject),
    [scope],
  );
  const activeSubjectId = selectedSubjectId || routeSubjectId || "";
  const activeSubjectBlock = useMemo(
    () => scope.find((block) => block.subject.id === activeSubjectId) ?? null,
    [scope, activeSubjectId],
  );
  const groupsForSubject = (activeSubjectBlock?.groups ?? []) as Group[];

  useEffect(() => {
    if (!groupsForSubject.length) {
      setSelectedGroupId("");
      return;
    }
    if (selectedGroupId && groupsForSubject.some((g) => g.id === selectedGroupId)) {
      return;
    }
    setSelectedGroupId(groupsForSubject[0]?.id ?? "");
  }, [groupsForSubject, selectedGroupId]);

  const subjectName =
    routeSubjectName ||
    activeSubjectBlock?.subject.name ||
    subjects.find((subject) => subject.id === activeSubjectId)?.name ||
    "this subject";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Teaching materials
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Upload books in everyday file formats, then let the platform prepare the reader and AI
          search automatically.
        </p>
      </div>

      {!routeSubjectId ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Select subject and class
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Pick a subject to upload textbooks. Choose a class to open textbooks in the reader.
          </p>
          {scopeError ? (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
              {scopeError}
            </p>
          ) : null}
          {loadingScope ? (
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              Loading your teaching scope...
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  Subject
                </span>
                <select
                  value={selectedSubjectId}
                  onChange={(event) => setSelectedSubjectId(event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                >
                  <option value="">Select subject...</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  Class (for reader links)
                </span>
                <select
                  value={selectedGroupId}
                  onChange={(event) => setSelectedGroupId(event.target.value)}
                  disabled={!activeSubjectId || groupsForSubject.length === 0}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-60 dark:border-neutral-600 dark:bg-neutral-950"
                >
                  {groupsForSubject.length === 0 ? (
                    <option value="">No classes available</option>
                  ) : (
                    groupsForSubject.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>
          )}
        </div>
      ) : null}

      {activeSubjectId ? (
        <TeacherMaterialsPanel
          subjectId={activeSubjectId}
          subjectName={subjectName}
          groupId={selectedGroupId || undefined}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
          Select a subject first to upload textbooks.
        </div>
      )}
    </div>
  );
}

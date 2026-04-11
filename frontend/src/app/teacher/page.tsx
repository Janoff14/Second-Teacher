"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createJoinCode,
  filterGroupsForTeacher,
  isExplicitEmptyTeacherScope,
  listGroups,
  listSubjects,
  listTeacherAcademicScope,
  unwrapTeacherAcademicScope,
} from "@/lib/api/academic";
import type { Group, JoinCodeRecord, Subject } from "@/lib/api/academic";
import { getResolvedUserId } from "@/stores/auth-store";

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

type SubjectWithGroups = Subject & { groups: Group[] };

export default function TeacherDashboardPage() {
  const [tree, setTree] = useState<SubjectWithGroups[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyGroupId, setBusyGroupId] = useState<string | null>(null);
  const [lastCodes, setLastCodes] = useState<Record<string, string>>({});
  /** Tanlangan fan — guruhlar alohida panelda ochiladi. */
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null);
  const groupsPanelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const teacherId = getResolvedUserId();

    const scopeRes = await listTeacherAcademicScope();
    if (scopeRes.ok) {
      const raw = scopeRes.data;
      const blocks = unwrapTeacherAcademicScope(raw);
      const useScope =
        blocks.length > 0 || isExplicitEmptyTeacherScope(raw);
      if (useScope) {
        const rows: SubjectWithGroups[] = blocks
          .map((b) => ({
            ...b.subject,
            groups: b.groups,
          }))
          .filter((row) => row.groups.length > 0);
        setTree(rows);
        setLoading(false);
        return;
      }
    }

    const sRes = await listSubjects();
    if (!sRes.ok) {
      setError(sRes.error.message);
      setTree([]);
      setLoading(false);
      return;
    }
    const subjects = Array.isArray(sRes.data) ? sRes.data : [];
    const rows: SubjectWithGroups[] = [];
    for (const s of subjects) {
      const gRes = await listGroups(s.id);
      const raw = gRes.ok && Array.isArray(gRes.data) ? gRes.data : [];
      const groups = filterGroupsForTeacher(raw, s.id, teacherId);
      if (groups.length === 0) continue;
      rows.push({ ...s, groups });
    }
    setTree(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (
      openSubjectId &&
      !tree.some((s) => s.id === openSubjectId)
    ) {
      setOpenSubjectId(null);
    }
  }, [tree, openSubjectId]);

  useEffect(() => {
    if (!openSubjectId || !groupsPanelRef.current) return;
    groupsPanelRef.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [openSubjectId]);

  const selectedSubject = openSubjectId
    ? tree.find((s) => s.id === openSubjectId)
    : undefined;

  async function handleJoinCode(groupId: string) {
    setBusyGroupId(groupId);
    setError(null);
    const res = await createJoinCode(groupId, {});
    setBusyGroupId(null);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    const code =
      res.data && typeof res.data === "object" && "code" in res.data
        ? String((res.data as JoinCodeRecord).code ?? "")
        : "";
    if (code) {
      setLastCodes((m) => ({ ...m, [groupId]: code }));
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            O{"'"}qituvchi paneli
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Fan kartochkasini bosing — pastda shu fanga tegishli guruhlar ochiladi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {loading ? "Yuklanmoqda\u2026" : "Yangilash"}
        </button>
      </div>

      <ErrorBox message={error} />

      {loading && tree.length === 0 ? (
        <p className="text-sm text-neutral-500">Yuklanmoqda\u2026</p>
      ) : null}

      {!loading && tree.every((s) => s.groups.length === 0) ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
          Hozircha guruh yo{"'"}q. Administrator sizni guruhga biriktirishi kerak
          yoki{" "}
          <Link
            href="/teacher/structure"
            className="font-medium text-blue-600 underline dark:text-blue-400"
          >
            tuzilma
          </Link>{" "}
          sahifasida fan/guruh yarating.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tree.map((subject) => {
          const isOpen = openSubjectId === subject.id;
          const n = subject.groups.length;
          return (
            <section
              key={subject.id}
              className={`flex flex-col overflow-hidden rounded-xl border bg-white dark:bg-neutral-900 ${
                isOpen
                  ? "border-blue-400/60 ring-2 ring-blue-500/20 dark:border-blue-500/40"
                  : "border-neutral-200 dark:border-neutral-700"
              }`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-label={`${subject.name} — guruhlarni ochish yoki yopish`}
                onClick={() =>
                  setOpenSubjectId((prev) =>
                    prev === subject.id ? null : subject.id,
                  )
                }
                className="flex min-h-[188px] w-full flex-col items-center justify-center gap-3 px-6 py-8 text-center transition hover:bg-neutral-50/90 dark:hover:bg-neutral-800/40"
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
                  {n} ta guruh
                </p>
                <span className="text-xs text-neutral-400" aria-hidden>
                  {isOpen ? "\u25B2 yopish uchun bosing" : "\u25BC bosib oching"}
                </span>
              </button>

              <div className="border-t border-neutral-100 px-4 py-2.5 text-center dark:border-neutral-800">
                <Link
                  href={`/teacher/corpus?subjectId=${encodeURIComponent(subject.id)}`}
                  className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Darslik / korpus
                </Link>
              </div>
            </section>
          );
        })}
      </div>

      {selectedSubject ? (
        <div
          ref={groupsPanelRef}
          className="rounded-xl border border-blue-400/40 bg-neutral-50/80 p-5 dark:border-blue-500/30 dark:bg-neutral-950/60"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 pb-4 dark:border-neutral-700">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                {selectedSubject.name}
                <span className="font-normal text-neutral-600 dark:text-neutral-400">
                  {" "}
                  — guruhlar
                </span>
              </h2>
              {selectedSubject.code ? (
                <p className="mt-1 font-mono text-xs text-neutral-500">
                  {selectedSubject.code}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/teacher/corpus?subjectId=${encodeURIComponent(selectedSubject.id)}`}
                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Darslik / korpus
              </Link>
              <button
                type="button"
                onClick={() => setOpenSubjectId(null)}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Panelni yopish
              </button>
            </div>
          </div>

          <div className="pt-4">
            {selectedSubject.groups.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Bu fan uchun guruh yo{"'"}q.
              </p>
            ) : (
              <ul className="space-y-3">
                {selectedSubject.groups.map((g) => (
                  <li
                    key={g.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/80"
                  >
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                        {g.name}
                      </p>
                      <p className="font-mono text-xs text-neutral-500">
                        {g.id}
                      </p>
                      {lastCodes[g.id] ? (
                        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
                          Yangi kod:{" "}
                          <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono dark:bg-emerald-950/60">
                            {lastCodes[g.id]}
                          </code>{" "}
                          (nusxa olindi)
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleJoinCode(g.id)}
                        disabled={busyGroupId === g.id}
                        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-emerald-600"
                      >
                        {busyGroupId === g.id
                          ? "Kutilmoqda\u2026"
                          : "Join kod yaratish"}
                      </button>
                      <Link
                        href={`/teacher/groups/${encodeURIComponent(g.id)}`}
                        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      >
                        Guruh ish maydoni
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <p className="text-sm text-neutral-500">
        <Link
          href="/teacher/structure"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          Tuzilma (fan va guruh boshqaruvi)
        </Link>
      </p>
    </div>
  );
}

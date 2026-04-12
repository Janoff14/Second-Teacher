"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listStudentAcademicScope, type StudentAcademicScopeItem } from "@/lib/api/student";
import { useAuthStore } from "@/stores/auth-store";

function RiskPill({
  level,
}: {
  level: StudentAcademicScopeItem["summary"]["riskLevel"];
}) {
  const tone =
    level === "at_risk"
      ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200"
      : level === "watchlist"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${tone}`}>
      {level.replace("_", " ")}
    </span>
  );
}

export default function StudentDashboardPage() {
  const setActiveGroupId = useAuthStore((state) => state.setActiveGroupId);
  const [items, setItems] = useState<StudentAcademicScopeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      const result = await listStudentAcademicScope();
      if (!alive) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error.message);
        setItems([]);
        return;
      }
      setItems(Array.isArray(result.data) ? result.data : []);
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <section className="rounded-[2.4rem] border border-neutral-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_40%),linear-gradient(135deg,#ffffff,_#f8fafc)] p-6 shadow-sm dark:border-neutral-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_40%),linear-gradient(135deg,#0a0a0a,_#111827)]">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">
              Student home
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              Your subjects, alerts, and study tools
            </h1>
            <p className="mt-3 text-base text-neutral-700 dark:text-neutral-300">
              Open any subject to see textbooks, practice windows, analytics, AI alerts, and a study coach that stays grounded in your course materials.
            </p>
          </div>
          <div className="rounded-[1.8rem] bg-white/80 px-5 py-4 text-sm text-neutral-700 shadow-sm backdrop-blur dark:bg-black/20 dark:text-neutral-300">
            <p className="font-medium">Fast demo path</p>
            <p className="mt-2">
              1. Join a class
              <br />
              2. Open a subject
              <br />
              3. Review alerts, readings, and practice
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            My subjects
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Canvas-style subject cards with readiness signals and quick entry into each workspace.
          </p>
        </div>
        <Link
          href="/join"
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
        >
          Join another class
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-10 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
          Loading your subjects...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-neutral-300 bg-neutral-50 px-5 py-10 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
          No subject is linked to this student yet. Use a join code to enroll, then come back here.
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.group.id}
              href={`/student/subjects/${item.group.id}`}
              onClick={() => setActiveGroupId(item.group.id)}
              className="group rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-blue-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                    {item.group.name}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-neutral-900 group-hover:text-blue-700 dark:text-neutral-50 dark:group-hover:text-blue-300">
                    {item.subject.name}
                  </h3>
                </div>
                <RiskPill level={item.summary.riskLevel} />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-neutral-50 px-4 py-3 dark:bg-neutral-900/50">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    Open now
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                    {item.summary.openNowCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-neutral-50 px-4 py-3 dark:bg-neutral-900/50">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    Latest score
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                    {item.summary.latestScorePct == null ? "--" : `${item.summary.latestScorePct}%`}
                  </p>
                </div>
              </div>

              {item.textbooks.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Course materials
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {item.textbooks.map((tb) => (
                      <span
                        key={tb.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
                      >
                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        {tb.title}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                <span>{item.summary.upcomingCount} upcoming</span>
                <span aria-hidden="true">•</span>
                <span>{item.summary.insightCount} active insight{item.summary.insightCount === 1 ? "" : "s"}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

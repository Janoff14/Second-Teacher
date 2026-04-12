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
      ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
      : level === "watchlist"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${tone}`}>
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
    <div className="space-y-8 animate-fade-in">
      <section className="rounded-4xl border border-accent-100/50 bg-gradient-to-br from-accent-50/40 via-white to-cyan-50/30 p-7 shadow-card dark:border-slate-700 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-900/80">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent-700 dark:text-accent-400">
              Student home
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Your subjects, alerts, and study tools
            </h1>
            <p className="mt-3 text-base leading-relaxed text-foreground/70">
              Open any subject to see textbooks, practice windows, analytics, AI alerts, and a study coach that stays grounded in your course materials.
            </p>
          </div>
          <div className="rounded-3xl border border-accent-200/50 bg-white/70 px-5 py-4 text-sm text-foreground/70 shadow-card backdrop-blur dark:border-accent-800/30 dark:bg-slate-900/80">
            <p className="font-bold text-foreground">Fast demo path</p>
            <p className="mt-2 leading-relaxed">
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
          <h2 className="text-2xl font-bold text-foreground">
            My subjects
          </h2>
          <p className="mt-1 text-sm text-foreground/65">
            Canvas-style subject cards with readiness signals and quick entry into each workspace.
          </p>
        </div>
        <Link
          href="/join"
          className="rounded-full border border-accent-200 bg-accent-50/50 px-5 py-2 text-sm font-semibold text-accent-600 transition-all hover:bg-accent-100 hover:shadow-sm dark:border-accent-800 dark:bg-accent-950/30 dark:text-accent-400 dark:hover:bg-accent-950"
        >
          Join another class
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 rounded-3xl border-2 border-dashed border-foreground/15 bg-foreground/[0.04] px-6 py-12 text-sm text-foreground/60">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-300 border-t-accent-600" />
          Loading your subjects...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-foreground/15 bg-foreground/[0.04] px-6 py-12 text-center text-sm text-foreground/60">
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
              className="group rounded-3xl border border-foreground/10 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-accent-300 hover:shadow-card-hover dark:border-slate-700 dark:bg-slate-900 dark:hover:border-accent-700"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/55">
                    {item.group.name}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-foreground transition-colors group-hover:text-accent-600 dark:group-hover:text-accent-400">
                    {item.subject.name}
                  </h3>
                </div>
                <RiskPill level={item.summary.riskLevel} />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-gradient-to-br from-accent-50/60 to-cyan-50/40 px-4 py-3 dark:from-accent-950/50 dark:to-cyan-950/30">
                  <p className="text-xs font-bold uppercase tracking-wide text-foreground/55">
                    Open now
                  </p>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {item.summary.openNowCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-brand-50/60 to-violet-50/40 px-4 py-3 dark:from-brand-950/50 dark:to-violet-950/30">
                  <p className="text-xs font-bold uppercase tracking-wide text-foreground/55">
                    Latest score
                  </p>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {item.summary.latestScorePct == null ? "--" : `${item.summary.latestScorePct}%`}
                  </p>
                </div>
              </div>

              {item.textbooks.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-foreground/55">
                    Course materials
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {item.textbooks.map((tb) => (
                      <span
                        key={tb.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-brand-200/60 bg-brand-50/50 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:border-brand-800/40 dark:bg-brand-950/30 dark:text-brand-300"
                      >
                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        {tb.title}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2 text-sm font-medium text-foreground/60">
                <span>{item.summary.upcomingCount} upcoming</span>
                <span aria-hidden="true">&middot;</span>
                <span>{item.summary.insightCount} active insight{item.summary.insightCount === 1 ? "" : "s"}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

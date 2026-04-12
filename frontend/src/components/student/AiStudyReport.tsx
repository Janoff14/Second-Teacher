"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStudentAiReport, type AiStudyReport as AiStudyReportType } from "@/lib/api/student";

const GRADE_CONFIG = {
  strong: { label: "Strong", color: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-800 dark:text-emerald-200", border: "border-emerald-200 dark:border-emerald-800" },
  adequate: { label: "Adequate", color: "bg-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-800 dark:text-blue-200", border: "border-blue-200 dark:border-blue-800" },
  needs_work: { label: "Needs Work", color: "bg-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-800 dark:text-amber-200", border: "border-amber-200 dark:border-amber-800" },
  critical: { label: "Critical", color: "bg-red-500", bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-800 dark:text-red-200", border: "border-red-200 dark:border-red-800" },
} as const;

const STATUS_COLORS = {
  mastered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  solid: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
  shaky: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  weak: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
} as const;

const ACTION_ICONS: Record<string, string> = {
  read: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  redo: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  practice: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  review: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
};

function GradeRing({ grade }: { grade: AiStudyReportType["overallGrade"] }) {
  const config = GRADE_CONFIG[grade];
  const pct = grade === "strong" ? 92 : grade === "adequate" ? 72 : grade === "needs_work" ? 48 : 25;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="108" height="108" viewBox="0 0 108 108" className="rotate-[-90deg]">
          <circle cx="54" cy="54" r="42" fill="none" stroke="currentColor" strokeWidth="8" strokeOpacity="0.08" />
          <circle
            cx="54" cy="54" r="42" fill="none"
            stroke="currentColor" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className={grade === "strong" ? "text-emerald-500" : grade === "adequate" ? "text-blue-500" : grade === "needs_work" ? "text-amber-500" : "text-red-500"}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{pct}%</span>
        </div>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    </div>
  );
}

function TopicBar({ topic, scorePct, status }: { topic: string; scorePct: number | null; status: string }) {
  const pct = scorePct ?? 0;
  const barColor = status === "mastered" ? "bg-emerald-500" : status === "solid" ? "bg-blue-500" : status === "shaky" ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">{topic}</span>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? ""}`}>
            {status}
          </span>
          <span className="min-w-[40px] text-right text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {pct > 0 ? `${pct}%` : "--"}
          </span>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export function AiStudyReportPanel({ groupId }: { groupId: string }) {
  const [report, setReport] = useState<AiStudyReportType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      const result = await getStudentAiReport(groupId);
      if (!alive) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error.message);
        setReport(null);
        return;
      }
      setReport(result.data);
    }
    void load();
    return () => { alive = false; };
  }, [groupId]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-[2rem] border border-neutral-200 bg-white px-5 py-12 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Generating your AI study report...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-[2rem] border border-red-200 bg-red-50 px-5 py-6 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
        {error ?? "Could not generate AI study report."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero: Grade + Narrative */}
      <div className={`rounded-[2rem] border p-6 shadow-sm ${GRADE_CONFIG[report.overallGrade].border} ${GRADE_CONFIG[report.overallGrade].bg}`}>
        <div className="flex flex-wrap items-start gap-6">
          <GradeRing grade={report.overallGrade} />
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">AI Study Assessment</p>
            <h3 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
              {report.subject.name}
            </h3>
            <p className="mt-3 text-sm leading-7 text-neutral-700 dark:text-neutral-300">
              {report.aiNarrative}
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              {report.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-[2rem] border border-emerald-200 bg-white p-5 shadow-sm dark:border-emerald-800/40 dark:bg-neutral-950">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-emerald-800 dark:text-emerald-200">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Strengths
          </h3>
          {report.strengths.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">Complete more assessments to identify your strengths.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {report.strengths.map((s) => (
                <li key={s} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-[2rem] border border-red-200 bg-white p-5 shadow-sm dark:border-red-800/40 dark:bg-neutral-950">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-red-800 dark:text-red-200">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Areas to improve
          </h3>
          {report.weaknesses.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">No weak areas detected yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {report.weaknesses.map((w) => (
                <li key={w} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Topic Breakdown Chart */}
      <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Topic breakdown</h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Performance across each assessment topic with textbook links.
        </p>
        <div className="mt-5 space-y-4">
          {report.topicBreakdown.map((topic) => (
            <div key={topic.topic} className="space-y-2">
              <TopicBar topic={topic.topic} scorePct={topic.scorePct} status={topic.status} />
              {topic.readings.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pl-1">
                  {topic.readings.map((reading) => (
                    <a
                      key={reading.id}
                      href={reading.readerPath}
                      className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-800 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-900/40"
                    >
                      <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                      {reading.chapterTitle ?? reading.title}{reading.pageNumber ? ` p.${reading.pageNumber}` : ""}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Study Plan */}
      <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Personalized study plan</h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Follow these steps in order to address your weak areas with targeted textbook readings and practice.
        </p>
        {report.studyPlan.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
            Complete some assessments to generate a personalized study plan.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {report.studyPlan.map((step, index) => (
              <div key={step.id} className="flex gap-4 rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white dark:bg-neutral-100 dark:text-neutral-900">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 shrink-0 text-neutral-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={ACTION_ICONS[step.action] ?? ACTION_ICONS.review!} />
                      </svg>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{step.title}</p>
                    </div>
                    <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-[10px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                      ~{step.estimatedMinutes} min
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">{step.reason}</p>
                  <div className="flex flex-wrap gap-2">
                    {step.readerLink ? (
                      <a
                        href={step.readerLink}
                        className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        Open in reader
                      </a>
                    ) : null}
                    {step.assessmentLink ? (
                      <Link
                        href={step.assessmentLink}
                        className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Retake assessment
                      </Link>
                    ) : null}
                    {step.readings.map((reading) => (
                      <a
                        key={reading.id}
                        href={reading.readerPath}
                        className="rounded-full border border-neutral-300 px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      >
                        {reading.chapterTitle ?? reading.title}{reading.pageNumber ? ` p.${reading.pageNumber}` : ""}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suggested Retakes */}
      {report.suggestedRetakes.length > 0 ? (
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50/50 p-5 shadow-sm dark:border-amber-800/40 dark:bg-amber-950/10">
          <h3 className="flex items-center gap-2 text-xl font-semibold text-amber-900 dark:text-amber-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Suggested retakes
          </h3>
          <p className="mt-1 text-sm text-amber-800/70 dark:text-amber-200/70">
            These assessments scored below 70%. Retaking after review can help solidify understanding.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {report.suggestedRetakes.map((retake) => (
              <div key={retake.assessmentVersionId} className="rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-800/30 dark:bg-neutral-950">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{retake.title}</p>
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-neutral-500">{retake.type}</p>
                  </div>
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-200">
                    {retake.latestScorePct != null ? `${retake.latestScorePct}%` : "--"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">{retake.reason}</p>
                <Link
                  href={retake.assessmentLink}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-700 px-4 py-2 text-xs font-medium text-white transition hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-700"
                >
                  Retake now
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-center text-xs text-neutral-500">
        Report generated {new Date(report.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}

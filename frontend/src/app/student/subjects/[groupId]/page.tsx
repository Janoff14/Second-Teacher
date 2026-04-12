"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AiStudyReportPanel } from "@/components/student/AiStudyReport";
import { CategoryRadarChart } from "@/components/student/CategoryRadarChart";
import { StudentProgressChart } from "@/components/student/StudentProgressChart";
import { StudyCoachPanel } from "@/components/student/StudyCoachPanel";
import { getStudentWorkspace, type StudentWorkspace } from "@/lib/api/student";
import { useAuthStore } from "@/stores/auth-store";

type TabId = "overview" | "practice" | "analytics" | "ai-report" | "library" | "coach";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "practice", label: "Practice" },
  { id: "analytics", label: "Analytics" },
  { id: "ai-report", label: "AI Report" },
  { id: "library", label: "Library" },
  { id: "coach", label: "Study coach" },
];

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-neutral-200 bg-white px-4 py-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
        {value}
      </p>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {hint}
      </p>
    </div>
  );
}

function RiskBadge({
  riskLevel,
}: {
  riskLevel: StudentWorkspace["analytics"]["summary"]["riskLevel"];
}) {
  const label = riskLevel.replace("_", " ");
  const tone =
    riskLevel === "at_risk"
      ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200"
      : riskLevel === "watchlist"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${tone}`}>
      {label}
    </span>
  );
}

function challengeLabel(
  status: StudentWorkspace["analytics"]["summary"]["challengeStatus"],
) {
  switch (status) {
    case "needs_support":
      return "Support first";
    case "needs_challenge":
      return "Needs challenge";
    default:
      return "On track";
  }
}

function assessmentStatusLabel(
  status: StudentWorkspace["assessments"]["items"][number]["status"],
) {
  switch (status) {
    case "available_now":
      return "Open now";
    case "scheduled":
      return "Scheduled";
    default:
      return "Closed";
  }
}

function formatMaybePct(value: number | null) {
  return value == null ? "--" : `${value}%`;
}

export default function StudentSubjectWorkspacePage() {
  const params = useParams();
  const groupId = decodeURIComponent(params.groupId as string);
  const setActiveGroupId = useAuthStore((state) => state.setActiveGroupId);

  const [workspace, setWorkspace] = useState<StudentWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  useEffect(() => {
    setActiveGroupId(groupId);
  }, [groupId, setActiveGroupId]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      const result = await getStudentWorkspace(groupId);
      if (!alive) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error.message);
        setWorkspace(null);
        return;
      }
      setWorkspace(result.data);
    }
    void load();
    return () => {
      alive = false;
    };
  }, [groupId]);

  const headline = useMemo(() => {
    if (!workspace) {
      return "";
    }
    const summary = workspace.analytics.summary;
    if (summary.riskLevel === "at_risk") {
      return "You need a focused recovery plan before the next assessment window.";
    }
    if (summary.challengeStatus === "needs_challenge") {
      return "You are ready for stretch work. Use the coach to raise the difficulty.";
    }
    return "This subject page keeps your reading, practice, analytics, and AI guidance in one place.";
  }, [workspace]);

  const suggestedRedos = useMemo(() => {
    if (!workspace) return [];
    return workspace.assessments.items.filter(
      (a) =>
        a.attempted &&
        a.latestScorePct !== null &&
        a.latestScorePct < 70 &&
        a.status === "available_now",
    );
  }, [workspace]);

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading subject workspace...</p>;
  }

  if (!workspace) {
    return (
      <div className="space-y-4">
        <Link
          href="/student"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Back to my subjects
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error ?? "Could not load this subject workspace."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[2.2rem] border border-neutral-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_42%),linear-gradient(135deg,#ffffff,_#f8fafc)] p-6 shadow-sm dark:border-neutral-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.2),_transparent_42%),linear-gradient(135deg,#0a0a0a,_#111827)]">
        <Link
          href="/student"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Back to my subjects
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
              {workspace.group.name}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              {workspace.subject.name}
            </h1>
            <p className="mt-3 text-base text-neutral-700 dark:text-neutral-300">
              {headline}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <RiskBadge riskLevel={workspace.analytics.summary.riskLevel} />
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                {challengeLabel(workspace.analytics.summary.challengeStatus)}
              </span>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                {workspace.assessments.openNowCount} open now
              </span>
            </div>
          </div>

          <div className="grid min-w-[280px] gap-3 sm:grid-cols-2">
            <MetricCard
              label="Recent average"
              value={formatMaybePct(workspace.analytics.summary.recentAveragePct)}
              hint="Latest attempts in this subject."
            />
            <MetricCard
              label="Completed attempts"
              value={String(workspace.analytics.summary.attemptCount)}
              hint="Recorded across quizzes, tests, and practice."
            />
            <MetricCard
              label="Open assessments"
              value={String(workspace.assessments.openNowCount)}
              hint="Ready to attempt right now."
            />
            <MetricCard
              label="Textbooks"
              value={String(workspace.textbooks.length)}
              hint="Reader-ready course material."
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={
              activeTab === tab.id
                ? "rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-5">
            <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                    AI alerts
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                    These are the signals the platform is actively watching for this subject.
                  </p>
                </div>
                <Link
                  href="/notifications"
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  Open all alerts
                </Link>
              </div>
              <div className="mt-4 space-y-3">
                {workspace.alerts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
                    No active alerts right now. Keep the momentum going with the study coach and practice queue.
                  </div>
                ) : (
                  workspace.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-900/40 dark:bg-amber-950/20"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                            {alert.title}
                          </p>
                          <p className="mt-2 text-sm text-amber-900/80 dark:text-amber-100/90">
                            {alert.body}
                          </p>
                        </div>
                        <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:bg-black/20 dark:text-amber-100">
                          {alert.riskLevel.replace("_", " ")}
                        </span>
                      </div>
                      {alert.recommendedReadings.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {alert.recommendedReadings.map((reading) => (
                            <a
                              key={reading.id}
                              href={reading.readerPath}
                              className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-transparent dark:text-amber-100 dark:hover:bg-amber-900/30"
                            >
                              Read: {reading.title}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                Recommended reading
              </h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Jump straight into the reader with highlighted chunks.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {workspace.analytics.recommendedReadings.map((reading) => (
                  <a
                    key={reading.id}
                    href={reading.readerPath}
                    className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:border-blue-800"
                  >
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {reading.title}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                      {reading.sourceTitle}
                    </p>
                    {reading.highlightText ? (
                      <p className="mt-2 line-clamp-3 text-sm text-neutral-600 dark:text-neutral-400">
                        {reading.highlightText}
                      </p>
                    ) : null}
                  </a>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                What the platform sees
              </h2>
              <p className="mt-3 text-sm leading-7 text-neutral-700 dark:text-neutral-300">
                {workspace.analytics.narrative}
              </p>
            </div>

            <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                Weak areas
              </h2>
              <div className="mt-4 space-y-3">
                {workspace.analytics.weakAreas.length === 0 ? (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Weak areas will appear as soon as the system can compare your incorrect answers across attempts.
                  </p>
                ) : (
                  workspace.analytics.weakAreas.map((area) => {
                    const versionId = area.id.replace("weak:", "");
                    const matchedAssessment = workspace.assessments.items.find((a) => a.id === versionId);
                    return (
                      <div
                        key={area.id}
                        className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900/50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                              {area.label}
                            </p>
                            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                              {area.evidence}
                            </p>
                          </div>
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-200">
                            {area.missCount} misses
                          </span>
                        </div>
                        {area.recommendedReadings.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                              Review these sections
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {area.recommendedReadings.map((reading) => (
                                <a
                                  key={reading.id}
                                  href={reading.readerPath}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-900/40"
                                >
                                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                  {reading.chapterTitle ? `${reading.chapterTitle}` : reading.title}
                                  {reading.pageNumber ? ` p.${reading.pageNumber}` : ""}
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {matchedAssessment?.status === "available_now" ? (
                          <div className="mt-3">
                            <Link
                              href={`/student/assessments/take/${versionId}`}
                              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              Redo this assessment
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "practice" ? (
        <div className="space-y-6">
          {suggestedRedos.length > 0 ? (
            <section className="rounded-[2rem] border border-amber-200 bg-amber-50/50 p-5 shadow-sm dark:border-amber-800/40 dark:bg-amber-950/10">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-amber-700 dark:text-amber-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                  Suggested to redo
                </h2>
              </div>
              <p className="mt-1 text-sm text-amber-800/70 dark:text-amber-200/70">
                These assessments had low scores. Review the linked material first, then retake.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {suggestedRedos.map((assessment) => {
                  const weakArea = workspace.analytics.weakAreas.find((a) => a.id === `weak:${assessment.id}`);
                  return (
                    <div
                      key={assessment.id}
                      className="rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-800/30 dark:bg-neutral-950"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{assessment.title}</p>
                          <p className="mt-0.5 text-xs uppercase tracking-wide text-neutral-500">{assessment.type}</p>
                        </div>
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-200">
                          {formatMaybePct(assessment.latestScorePct)}
                        </span>
                      </div>
                      {weakArea?.recommendedReadings && weakArea.recommendedReadings.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {weakArea.recommendedReadings.map((reading) => (
                            <a
                              key={reading.id}
                              href={reading.readerPath}
                              className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
                            >
                              {reading.chapterTitle ?? reading.title}{reading.pageNumber ? ` p.${reading.pageNumber}` : ""}
                            </a>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3">
                        <Link
                          href={`/student/assessments/take/${assessment.id}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-amber-700 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-700"
                        >
                          Retake now
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                  All assessments
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Everything scheduled for this subject, with availability based on the teacher&apos;s timing rules.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                  {workspace.assessments.openNowCount} open now
                </span>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                  {workspace.assessments.upcomingCount} upcoming
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {workspace.assessments.items.map((assessment) => (
                <div
                  key={assessment.id}
                  className="rounded-[1.75rem] border border-neutral-200 bg-neutral-50/80 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {assessment.title}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                        {assessment.type}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                      {assessmentStatusLabel(assessment.status)}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-neutral-500">
                        Window opens
                      </p>
                      <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                        {new Date(assessment.windowOpensAtUtc).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-neutral-500">
                        Latest score
                      </p>
                      <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                        {formatMaybePct(assessment.latestScorePct)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {assessment.status === "available_now" ? (
                      <Link
                        href={`/student/assessments/take/${assessment.id}`}
                        className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                      >
                        Open assessment
                      </Link>
                    ) : null}
                    {assessment.attempted ? (
                      <span className="text-xs text-neutral-500">
                        {assessment.attemptCount} attempt{assessment.attemptCount === 1 ? "" : "s"} recorded
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-500">
                        No attempt yet
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "analytics" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Overall average"
              value={formatMaybePct(workspace.analytics.summary.overallAveragePct)}
              hint="Across every recorded attempt."
            />
            <MetricCard
              label="Risk confidence"
              value={`${Math.round(workspace.analytics.summary.riskConfidence * 100)}%`}
              hint="How strongly the current evidence supports the risk state."
            />
            <MetricCard
              label="Challenge status"
              value={challengeLabel(workspace.analytics.summary.challengeStatus)}
              hint={workspace.analytics.summary.challengeReason}
            />
          </div>

          <StudentProgressChart
            points={workspace.analytics.timeSeries}
            graphNarrative={workspace.analytics.graphNarrative}
          />

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                Category performance
              </h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                How you perform across different assessment types.
              </p>
              <div className="mt-5">
                <CategoryRadarChart categoryAverages={workspace.analytics.categoryAverages} />
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                  AI interpretation
                </h2>
                <p className="mt-3 text-sm leading-7 text-neutral-700 dark:text-neutral-300">
                  {workspace.analytics.narrative}
                </p>
              </div>
              <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                  Weak areas &amp; review material
                </h2>
                <div className="mt-4 space-y-3">
                  {workspace.analytics.weakAreas.length === 0 ? (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      No weak areas detected yet.
                    </p>
                  ) : (
                    workspace.analytics.weakAreas.map((area) => (
                      <div key={area.id} className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/50">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{area.label}</p>
                        <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{area.evidence}</p>
                        {area.recommendedReadings.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {area.recommendedReadings.map((reading) => (
                              <a
                                key={reading.id}
                                href={reading.readerPath}
                                className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
                              >
                                {reading.chapterTitle ?? reading.title}{reading.pageNumber ? ` p.${reading.pageNumber}` : ""}
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "ai-report" ? (
        <AiStudyReportPanel groupId={groupId} />
      ) : null}

      {activeTab === "library" ? (
        <section className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                Textbook reader
              </h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Open the course material directly, then jump to highlighted chunks from alerts, weak areas, or the coach.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {workspace.textbooks.map((textbook) => (
              <a
                key={textbook.id}
                href={textbook.readerPath}
                className="rounded-[1.75rem] border border-neutral-200 bg-neutral-50/80 px-4 py-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:border-blue-800"
              >
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {textbook.title}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                  Version {textbook.versionLabel}
                </p>
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                  Added {new Date(textbook.createdAt).toLocaleDateString()}
                </p>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "coach" ? <StudyCoachPanel workspace={workspace} /> : null}
    </div>
  );
}

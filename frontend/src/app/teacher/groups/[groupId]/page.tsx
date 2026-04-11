"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TeacherMaterialsPanel } from "@/components/teacher/TeacherMaterialsPanel";
import {
  createJoinCode,
  listGroupStudents,
  listGroups,
  listJoinCodes,
  listSubjects,
  revokeJoinCode,
} from "@/lib/api/academic";
import type { Group, GroupStudent, JoinCodeRecord, Subject } from "@/lib/api/academic";
import {
  createDraft,
  getTeacherGroupResultsSummary,
  listDrafts,
  listPublishedAssessments,
  unwrapDraftList,
  unwrapPublishedList,
  type AssessmentDraft,
  type PublishedAssessment,
  type TeacherAssessmentResultSummary,
  type TeacherGroupResultsSummary,
} from "@/lib/api/assessments";
import {
  listTeacherInsights,
  recomputeGroupAnalytics,
  setInsightStatus,
  unwrapInsightList,
  type Insight,
} from "@/lib/api/insights";

type TabId = "students" | "results" | "textbooks" | "test-maker";

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

function formatDateTime(value?: string | null) {
  if (!value) return "No data yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatPct(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "No data";
  return `${Math.round(value)}%`;
}

function formatAssessmentType(type: TeacherAssessmentResultSummary["type"] | string | undefined) {
  switch (type) {
    case "practice":
      return "Practice";
    case "quiz":
      return "Quiz";
    case "test":
      return "Test";
    case "exam":
      return "Exam";
    default:
      return "Assessment";
  }
}

function riskBadgeClasses(level: GroupStudent["riskLevel"]) {
  switch (level) {
    case "at_risk":
      return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200";
    case "watchlist":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
    case "stable":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
    default:
      return "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200";
  }
}

function riskLabel(level: GroupStudent["riskLevel"]) {
  switch (level) {
    case "at_risk":
      return "At risk";
    case "watchlist":
      return "Watchlist";
    case "stable":
      return "Stable";
    default:
      return "No signal yet";
  }
}

function insightSeverityLabel(value?: string | null) {
  if (!value) return "AI note";
  return value.replace(/_/g, " ");
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">{value}</p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>
    </article>
  );
}

export default function TeacherGroupWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const groupId = decodeURIComponent(params.groupId as string);

  const [tab, setTab] = useState<TabId>("students");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [joinCodes, setJoinCodes] = useState<JoinCodeRecord[]>([]);
  const [joinLoading, setJoinLoading] = useState(false);
  const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null);

  const [students, setStudents] = useState<GroupStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [resultsSummary, setResultsSummary] = useState<TeacherGroupResultsSummary | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [analyticsBusy, setAnalyticsBusy] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const [drafts, setDrafts] = useState<AssessmentDraft[]>([]);
  const [published, setPublished] = useState<PublishedAssessment[]>([]);
  const [draftTitle, setDraftTitle] = useState("");
  const [testMakerLoading, setTestMakerLoading] = useState(false);

  const resolveMeta = useCallback(async () => {
    setMetaLoading(true);
    setError(null);

    const subjectRes = await listSubjects();
    if (!subjectRes.ok) {
      setError(subjectRes.error.message);
      setMetaLoading(false);
      return;
    }

    const subjects = Array.isArray(subjectRes.data) ? subjectRes.data : [];
    for (const nextSubject of subjects) {
      const groupsRes = await listGroups(nextSubject.id);
      const groups = groupsRes.ok && Array.isArray(groupsRes.data) ? groupsRes.data : [];
      const foundGroup = groups.find((entry) => entry.id === groupId);
      if (foundGroup) {
        setSubject(nextSubject);
        setGroup(foundGroup);
        setMetaLoading(false);
        return;
      }
    }

    setSubject(null);
    setGroup(null);
    setError("This class was not found or you do not have access to it.");
    setMetaLoading(false);
  }, [groupId]);

  const loadJoinCodes = useCallback(async () => {
    if (!groupId) return;
    setJoinLoading(true);
    const res = await listJoinCodes(groupId);
    setJoinLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setJoinCodes(Array.isArray(res.data) ? res.data : []);
  }, [groupId]);

  const loadStudents = useCallback(async () => {
    if (!groupId) return;
    setStudentsLoading(true);
    const res = await listGroupStudents(groupId);
    setStudentsLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setStudents([]);
      return;
    }
    setStudents(Array.isArray(res.data) ? res.data : []);
  }, [groupId]);

  const loadResults = useCallback(async () => {
    if (!groupId) return;
    setResultsLoading(true);
    const res = await getTeacherGroupResultsSummary(groupId);
    setResultsLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setResultsSummary(null);
      return;
    }
    setResultsSummary(res.data ?? null);
  }, [groupId]);

  const loadInsights = useCallback(async () => {
    if (!groupId) return;
    setInsightsLoading(true);
    const res = await listTeacherInsights(groupId);
    setInsightsLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setInsights([]);
      return;
    }
    setInsights(unwrapInsightList(res.data));
  }, [groupId]);

  const loadTestMaker = useCallback(async () => {
    if (!groupId) return;
    setTestMakerLoading(true);
    const [draftsRes, publishedRes] = await Promise.all([
      listDrafts(groupId),
      listPublishedAssessments(groupId),
    ]);
    setTestMakerLoading(false);

    if (!draftsRes.ok) {
      setError(draftsRes.error.message);
      setDrafts([]);
    } else {
      setDrafts(unwrapDraftList(draftsRes.data));
    }

    if (!publishedRes.ok) {
      setError(publishedRes.error.message);
      setPublished([]);
    } else {
      setPublished(unwrapPublishedList(publishedRes.data));
    }
  }, [groupId]);

  useEffect(() => {
    void resolveMeta();
  }, [resolveMeta]);

  useEffect(() => {
    if (!group) return;
    if (tab === "students") {
      void Promise.all([loadStudents(), loadJoinCodes()]);
      return;
    }
    if (tab === "results") {
      void Promise.all([loadResults(), loadInsights()]);
      return;
    }
    if (tab === "test-maker") {
      void loadTestMaker();
    }
  }, [group, loadInsights, loadJoinCodes, loadResults, loadStudents, loadTestMaker, tab]);

  const tabs: Array<{ id: TabId; label: string; hint: string }> = [
    { id: "students", label: "Students", hint: "Roster, risk, join codes" },
    {
      id: "results",
      label: "Results & analytics",
      hint: "Recent performance and AI interpretation",
    },
    { id: "textbooks", label: "Textbooks", hint: "Upload books and check search" },
    { id: "test-maker", label: "Test maker", hint: "Build, predict, and publish" },
  ];

  const recentResults = useMemo(() => {
    if (!resultsSummary) return [];
    return resultsSummary.assessments
      .flatMap((assessment) =>
        assessment.results.map((result) => ({
          ...result,
          assessmentId: assessment.id,
          assessmentTitle: assessment.title,
          assessmentType: assessment.type,
        })),
      )
      .sort((left, right) => {
        return new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime();
      });
  }, [resultsSummary]);

  const topRiskStudents = useMemo(() => {
    return [...students]
      .sort((left, right) => {
        const leftPriority = left.riskLevel === "at_risk" ? 0 : left.riskLevel === "watchlist" ? 1 : 2;
        const rightPriority =
          right.riskLevel === "at_risk" ? 0 : right.riskLevel === "watchlist" ? 1 : 2;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return (right.attemptCount ?? 0) - (left.attemptCount ?? 0);
      })
      .slice(0, 3);
  }, [students]);

  async function handleCreateJoinCode() {
    setJoinLoading(true);
    setError(null);
    const res = await createJoinCode(groupId, {});
    setJoinLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }

    const code = res.data?.code ? String(res.data.code) : "";
    setLastCreatedCode(code || null);
    await loadJoinCodes();
    if (code) {
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        // Ignore clipboard failures in demo mode.
      }
    }
  }

  async function handleRevokeJoinCode(joinCodeId: string) {
    setJoinLoading(true);
    setError(null);
    const res = await revokeJoinCode(groupId, joinCodeId);
    setJoinLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    await loadJoinCodes();
  }

  async function handleRecomputeAnalytics() {
    setAnalyticsBusy(true);
    setError(null);
    const res = await recomputeGroupAnalytics(groupId);
    setAnalyticsBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    await Promise.all([loadResults(), loadInsights(), loadStudents()]);
  }

  async function handleInsightStatus(insightId: string, status: string) {
    const res = await setInsightStatus(insightId, { status });
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    await loadInsights();
  }

  async function handleCreateDraft(event: React.FormEvent) {
    event.preventDefault();
    setTestMakerLoading(true);
    setError(null);
    const res = await createDraft({
      title: draftTitle.trim() || undefined,
      groupId,
    });
    setTestMakerLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }

    setDraftTitle("");
    if (res.data?.id) {
      router.push(`/teacher/assessments/drafts/${res.data.id}`);
      return;
    }
    await loadTestMaker();
  }

  if (metaLoading) {
    return <p className="text-sm text-neutral-500">Loading class workspace...</p>;
  }

  if (!group || !subject) {
    return (
      <div className="space-y-4">
        <ErrorBox message={error} />
        <Link href="/teacher" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          Back to teacher dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href="/teacher" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          Back to teacher dashboard
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
              {group.name}
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Subject: <span className="font-medium text-neutral-900 dark:text-neutral-100">{subject.name}</span>
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Open the tabs below to manage students, follow results, upload textbooks, and build the
              next assessment.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
            <p className="text-neutral-500 dark:text-neutral-400">Class ID</p>
            <p className="mt-1 font-mono text-xs text-neutral-700 dark:text-neutral-200">{groupId}</p>
          </div>
        </div>
      </div>

      <ErrorBox message={error} />

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

      {tab === "students" ? (
        <section className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                    Invite students
                  </h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Create a join code for this class and share it with students.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCreateJoinCode()}
                  disabled={joinLoading}
                  className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-emerald-600"
                >
                  {joinLoading ? "Creating..." : "Create join code"}
                </button>
              </div>

              {lastCreatedCode ? (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                  Latest code: <code className="font-mono">{lastCreatedCode}</code> copied to clipboard.
                </p>
              ) : null}

              <ul className="mt-4 space-y-3">
                {joinCodes.map((code) => (
                  <li
                    key={code.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/40"
                  >
                    <div className="space-y-1">
                      <p className="font-mono text-sm text-neutral-900 dark:text-neutral-100">{code.code}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {code.revokedAt ? "Revoked" : "Active"}
                      </p>
                    </div>
                    {!code.revokedAt ? (
                      <button
                        type="button"
                        onClick={() => void handleRevokeJoinCode(code.id)}
                        disabled={joinLoading}
                        className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
                      >
                        Revoke
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>

              {!joinLoading && joinCodes.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  No join codes yet. Create one when you are ready to invite students.
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                Class snapshot
              </h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                A quick look at who may need support first.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <SummaryCard
                  label="Students"
                  value={String(students.length)}
                  hint="Currently enrolled in this class"
                />
                <SummaryCard
                  label="At risk"
                  value={String(students.filter((student) => student.riskLevel === "at_risk").length)}
                  hint="Immediate follow-up recommended"
                />
                <SummaryCard
                  label="Watchlist"
                  value={String(students.filter((student) => student.riskLevel === "watchlist").length)}
                  hint="Keep an eye on the trend"
                />
              </div>

              {topRiskStudents.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {topRiskStudents.map((student) => (
                    <article
                      key={student.studentId}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-neutral-900 dark:text-neutral-100">
                            {student.displayName || student.studentId}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {student.email || student.studentId}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${riskBadgeClasses(student.riskLevel)}`}>
                          {riskLabel(student.riskLevel)}
                        </span>
                      </div>
                      {student.riskReason ? (
                        <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
                          {student.riskReason}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Risk flags will appear here once students start taking assessments.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                  Students in this class
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Each card shows recent activity, latest score, and risk status.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadStudents()}
                disabled={studentsLoading}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
              >
                {studentsLoading ? "Refreshing..." : "Refresh roster"}
              </button>
            </div>

            {studentsLoading ? (
              <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Loading students...</p>
            ) : students.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
                No students have joined this class yet.
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {students.map((student) => (
                  <article
                    key={student.studentId}
                    className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">
                          {student.displayName || student.studentId}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {student.email || student.studentId}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${riskBadgeClasses(student.riskLevel)}`}>
                        {riskLabel(student.riskLevel)}
                      </span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-neutral-500 dark:text-neutral-400">Attempts</dt>
                        <dd className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">
                          {student.attemptCount ?? 0}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500 dark:text-neutral-400">Latest score</dt>
                        <dd className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">
                          {formatPct(student.latestScorePct)}
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-neutral-500 dark:text-neutral-400">Last activity</dt>
                        <dd className="mt-1 text-neutral-900 dark:text-neutral-100">
                          {formatDateTime(student.lastAttemptAt || student.enrolledAt)}
                        </dd>
                      </div>
                    </dl>

                    {student.riskReason ? (
                      <p className="mt-4 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                        {student.riskReason}
                      </p>
                    ) : (
                      <p className="mt-4 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                        This student does not have a specific risk explanation yet.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {tab === "results" ? (
        <section className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void Promise.all([loadResults(), loadInsights()])}
              disabled={resultsLoading || insightsLoading}
              className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {resultsLoading || insightsLoading ? "Refreshing..." : "Refresh results"}
            </button>
            <button
              type="button"
              onClick={() => void handleRecomputeAnalytics()}
              disabled={analyticsBusy}
              className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              {analyticsBusy ? "Recomputing..." : "Recompute analytics"}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Students"
              value={String(resultsSummary?.enrolledCount ?? students.length)}
              hint="Students enrolled in this class"
            />
            <SummaryCard
              label="Assessments"
              value={String(resultsSummary?.assessmentCount ?? 0)}
              hint="Published items with result history"
            />
            <SummaryCard
              label="Attempts"
              value={String(resultsSummary?.totalAttemptCount ?? 0)}
              hint="Submitted student attempts"
            />
            <SummaryCard
              label="Class average"
              value={formatPct(resultsSummary?.overallAverageScorePct)}
              hint="Across all submitted work"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                Recent results
              </h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                Latest submissions across all practice tests, quizzes, and assessments.
              </p>

              {resultsLoading ? (
                <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Loading results...</p>
              ) : recentResults.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
                  Results will appear here after students start submitting work.
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {recentResults.slice(0, 10).map((result) => (
                    <li
                      key={result.attemptId}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium text-neutral-900 dark:text-neutral-100">
                            {result.studentName || result.studentId}
                          </p>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            {result.assessmentTitle}
                          </p>
                        </div>
                        <span className="rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                          {formatAssessmentType(result.assessmentType)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          {formatPct(result.scorePct)}
                        </span>
                        <span className="text-neutral-500 dark:text-neutral-400">
                          {formatDateTime(result.submittedAt)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                    AI interpretation
                  </h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Risk highlights and explanations generated from student activity.
                  </p>
                </div>
              </div>

              {insightsLoading ? (
                <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Loading AI notes...</p>
              ) : insights.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
                  No AI notes yet. They will appear once the class has enough activity to analyze.
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {insights.map((insight) => (
                    <li
                      key={insight.id}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">
                          {insight.title || "AI note"}
                        </p>
                        <span className="rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                          {insightSeverityLabel(insight.severity)}
                        </span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                        {insight.message || insight.body || insight.summary || "No summary provided."}
                      </p>
                      {insight.studentId ? (
                        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                          Student ID: {insight.studentId}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-3 text-sm">
                        <button
                          type="button"
                          onClick={() => void handleInsightStatus(insight.id, "acknowledged")}
                          className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          Mark reviewed
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleInsightStatus(insight.id, "dismissed")}
                          className="font-medium text-neutral-600 hover:underline dark:text-neutral-300"
                        >
                          Dismiss
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              Assessment breakdown
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Compare participation and average performance across the class schedule.
            </p>

            {resultsLoading ? (
              <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Loading assessment summaries...</p>
            ) : !resultsSummary || resultsSummary.assessments.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
                Publish an assessment to start building this timeline.
              </div>
            ) : (
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {resultsSummary.assessments.map((assessment) => (
                  <article
                    key={assessment.id}
                    className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">
                          {assessment.title}
                        </p>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          {formatAssessmentType(assessment.type)}
                        </p>
                      </div>
                      <span className="rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                        {assessment.attemptCount}/{assessment.enrolledCount} attempted
                      </span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-neutral-500 dark:text-neutral-400">Average</dt>
                        <dd className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">
                          {formatPct(assessment.averageScorePct)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500 dark:text-neutral-400">Highest</dt>
                        <dd className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">
                          {formatPct(assessment.highestScorePct)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500 dark:text-neutral-400">Published</dt>
                        <dd className="mt-1 text-neutral-900 dark:text-neutral-100">
                          {formatDateTime(assessment.publishedAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500 dark:text-neutral-400">Latest submission</dt>
                        <dd className="mt-1 text-neutral-900 dark:text-neutral-100">
                          {formatDateTime(assessment.latestSubmittedAt)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {tab === "textbooks" ? (
        <TeacherMaterialsPanel
          subjectId={subject.id}
          subjectName={subject.name}
          groupId={groupId}
        />
      ) : null}

      {tab === "test-maker" ? (
        <section className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                  Start a new assessment draft
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Build questions here, then use the score predictor and what-if simulator inside the
                  builder.
                </p>
              </div>

              <form onSubmit={(event) => void handleCreateDraft(event)} className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Draft title
                  </label>
                  <input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    placeholder="Optional"
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                    disabled={testMakerLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={testMakerLoading}
                  className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                >
                  {testMakerLoading ? "Opening..." : "Create draft and open builder"}
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                Builder tools inside each draft
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <SummaryCard
                  label="Question builder"
                  value="Live"
                  hint="Edit stems, answers, and keys"
                />
                <SummaryCard
                  label="Score predictor"
                  value="Ready"
                  hint="Estimate likely class performance"
                />
                <SummaryCard
                  label="What-if simulator"
                  value="Ready"
                  hint="Try harder or easier draft versions"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                    Drafts
                  </h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Open any draft to continue building, predict outcomes, or publish it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadTestMaker()}
                  disabled={testMakerLoading}
                  className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                >
                  {testMakerLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {testMakerLoading ? (
                <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Loading drafts...</p>
              ) : drafts.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
                  No drafts yet for this class.
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {drafts.map((draft) => (
                    <li
                      key={draft.id}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium text-neutral-900 dark:text-neutral-100">
                            {draft.title || "Untitled draft"}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">{draft.id}</p>
                        </div>
                        <Link
                          href={`/teacher/assessments/drafts/${draft.id}`}
                          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Open builder & predictor
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                    Published for this class
                  </h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Published assessments stay visible here for quick reference.
                  </p>
                </div>
                <Link
                  href="/teacher/assessments/published"
                  className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Open full published list
                </Link>
              </div>

              {testMakerLoading ? (
                <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Loading published items...</p>
              ) : published.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
                  Nothing has been published for this class yet.
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {published.map((assessment) => (
                    <li
                      key={assessment.id}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/40"
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">
                          {assessment.title || "Untitled assessment"}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{assessment.id}</p>
                      </div>
                      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                        Opens: {formatDateTime(assessment.windowOpensAtUtc)} | Closes:{" "}
                        {formatDateTime(assessment.windowClosesAtUtc)}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        {assessment.items?.length ?? 0} questions
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

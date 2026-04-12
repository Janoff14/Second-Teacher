"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getStudentProfile,
  getStudentPercentileProfile,
  type RiskFactorEvidence,
  type StudentProfile,
} from "@/lib/api/assessments";
import {
  PercentileRadarChart,
  type PercentileProfileData,
} from "@/components/student/PercentileRadarChart";
import { setInsightStatus } from "@/lib/api/insights";

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

function suggestedFromFactors(factors: RiskFactorEvidence[]): string[] {
  const codes = new Set(factors.map((f) => f.code));
  const actions: string[] = [];
  if (codes.has("LOW_RECENT_SCORE") || codes.has("REPEATED_LOW_SCORES")) {
    actions.push("Schedule a short check-in and a concrete study plan.");
  }
  if (codes.has("DECLINING_PERFORMANCE") || codes.has("DECLINING_TREND")) {
    actions.push("Review recent attempts together; add formative practice before the next graded item.");
  }
  if (codes.has("RECENT_INACTIVITY")) {
    actions.push("Reach out about participation barriers.");
  }
  if (codes.has("BELOW_CLASS_BASELINE")) {
    actions.push("Point to targeted readings or examples from class materials.");
  }
  if (codes.has("ABOVE_CLASS_BASELINE") || codes.has("CAPACITY_FOR_MORE")) {
    actions.push("Offer extension tasks or peer mentoring opportunities.");
  }
  if (actions.length === 0 && factors.length > 0) {
    actions.push("Acknowledge insight cards when you have followed up.");
  }
  return actions.slice(0, 6);
}

function riskBadgeClasses(level: string) {
  switch (level) {
    case "at_risk":
      return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200";
    case "watchlist":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
    case "low_load":
      return "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200";
    default:
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
  }
}

export default function TeacherStudentProfilePage() {
  const params = useParams();
  const groupId = decodeURIComponent(params.groupId as string);
  const studentId = decodeURIComponent(params.studentId as string);

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [percentileProfile, setPercentileProfile] = useState<PercentileProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyInsight, setBusyInsight] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [res, ppRes] = await Promise.all([
      getStudentProfile(groupId, studentId),
      getStudentPercentileProfile(groupId, studentId),
    ]);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setProfile(null);
      return;
    }
    setProfile(res.data ?? null);
    if (ppRes.ok && ppRes.data) {
      setPercentileProfile(ppRes.data as PercentileProfileData);
    }
  }, [groupId, studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartData = useMemo(() => {
    if (!profile?.attempts?.length) return [];
    return profile.attempts.map((a, i) => ({
      n: i + 1,
      label: a.assessmentTitle.slice(0, 12) + (a.assessmentTitle.length > 12 ? "…" : ""),
      pct: a.scorePct,
      at: a.submittedAt,
    }));
  }, [profile]);

  const openInsights = useMemo(
    () => profile?.insights?.filter((i) => i.status === "open") ?? [],
    [profile],
  );

  async function ackInsight(id: string, status: "acknowledged" | "dismissed") {
    setBusyInsight(id);
    const res = await setInsightStatus(id, { status });
    setBusyInsight(null);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    await load();
  }

  if (loading && !profile) {
    return <p className="text-sm text-neutral-500">Loading student profile…</p>;
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <ErrorBox message={error} />
        <Link href={`/teacher/groups/${encodeURIComponent(groupId)}`} className="text-sm text-blue-600 hover:underline">
          Back to class
        </Link>
      </div>
    );
  }

  const primaryFactors = profile.riskFactors.filter((f) => f.severity !== "info");
  const narrative =
    primaryFactors.length > 0
      ? primaryFactors.map((f) => f.message).join(" ")
      : profile.riskFactors[0]?.message ?? "No detailed risk factors recorded.";
  const suggestions = suggestedFromFactors(profile.riskFactors);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/teacher/groups/${encodeURIComponent(groupId)}`}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Back to class
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
            {profile.displayName || profile.studentId}
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{profile.email || profile.studentId}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${riskBadgeClasses(profile.riskLevel)}`}>
          {profile.riskLevel.replace(/_/g, " ")}
        </span>
      </div>

      <ErrorBox message={error} />

      <section className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 to-white p-5 shadow-sm dark:border-violet-900/40 dark:from-violet-950/20 dark:to-neutral-950/80">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">AI analysis</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">{narrative}</p>
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Evidence</p>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
            {profile.riskFactors.map((f) => (
              <li key={f.code}>
                <span className="font-mono text-xs text-neutral-500">{f.code}</span> — {f.message}
              </li>
            ))}
          </ul>
        </div>
        {suggestions.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Suggested actions
            </p>
            <ul className="mt-2 list-inside list-disc text-sm text-neutral-800 dark:text-neutral-200">
              {suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {percentileProfile ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Percentile profile
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            How this student compares to their {percentileProfile.groupSize} groupmates.
          </p>
          <div className="mt-4">
            <PercentileRadarChart
              profile={percentileProfile}
              studentName={profile.displayName || profile.studentId}
            />
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Score trend</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Chronological attempt scores in this class ({profile.totalAttempts} attempts).
        </p>
        {chartData.length > 0 ? (
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
                <XAxis dataKey="n" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} width={32} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  formatter={(value) => [
                    `${typeof value === "number" && !Number.isNaN(value) ? value : 0}%`,
                    "Score",
                  ]}
                  labelFormatter={(_, payload) => {
                    const row = payload[0]?.payload as { label?: string; at?: string } | undefined;
                    return row?.at ? new Date(row.at).toLocaleString() : "";
                  }}
                />
                <Line type="monotone" dataKey="pct" stroke="#4f46e5" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">No attempts yet.</p>
        )}
      </section>

      {openInsights.length > 0 ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Open insight cards</h2>
          <ul className="mt-4 space-y-3">
            {openInsights.map((ins) => (
              <li
                key={ins.id}
                className="rounded-xl border border-neutral-200 px-3 py-3 dark:border-neutral-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">{ins.title}</p>
                    <p className="text-xs text-neutral-500">{ins.riskLevel.replace(/_/g, " ")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyInsight === ins.id}
                      onClick={() => void ackInsight(ins.id, "acknowledged")}
                      className="rounded-lg bg-neutral-900 px-2 py-1 text-xs text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                    >
                      Acknowledge
                    </button>
                    <button
                      type="button"
                      disabled={busyInsight === ins.id}
                      onClick={() => void ackInsight(ins.id, "dismissed")}
                      className="rounded-lg border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-600"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{ins.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Per-assessment</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {profile.perAssessment.map((a) => (
            <li key={a.versionId} className="rounded-lg border border-neutral-100 px-3 py-2 dark:border-neutral-800">
              <span className="font-medium text-neutral-900 dark:text-neutral-100">{a.title}</span>
              <span className="text-neutral-500"> — latest {a.latestScorePct != null ? `${a.latestScorePct}%` : "—"}</span>
              {a.classAveragePct != null ? (
                <span className="text-neutral-500"> (class avg {a.classAveragePct}%)</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

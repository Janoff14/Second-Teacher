"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getTeacherAiBriefing,
  type TeacherBriefing,
  type TeacherBriefingStudent,
} from "@/lib/api/assessments";
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

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <span className="text-xs text-neutral-400">No scores yet</span>;
  }
  const w = 120;
  const h = 36;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-blue-600 dark:text-blue-400"
        points={pts}
      />
    </svg>
  );
}

function badgeClasses(level: string) {
  switch (level) {
    case "at_risk":
      return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200";
    case "watchlist":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
    case "low_load":
      return "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200";
    default:
      return "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200";
  }
}

function badgeLabel(level: string) {
  switch (level) {
    case "at_risk":
      return "At risk";
    case "watchlist":
      return "Watchlist";
    case "low_load":
      return "Low load";
    default:
      return level;
  }
}

export function AiBriefingStrip({
  groupId,
  onInsightAcknowledged,
}: {
  groupId: string;
  onInsightAcknowledged?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [briefing, setBriefing] = useState<TeacherBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getTeacherAiBriefing(groupId, false);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setBriefing(null);
      return;
    }
    setBriefing(res.data ?? null);
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function acknowledge(insightId: string) {
    setBusyId(insightId);
    const res = await setInsightStatus(insightId, { status: "acknowledged" });
    setBusyId(null);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    await load();
    onInsightAcknowledged?.();
  }

  const count = briefing?.attentionNeeded ?? 0;
  const patterns = briefing?.groupPatterns ?? [];

  if (loading && !briefing) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-3 text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/40">
        Loading class briefing…
      </div>
    );
  }

  if (!briefing || (count === 0 && patterns.length === 0)) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white shadow-sm dark:border-violet-900/40 dark:from-violet-950/30 dark:to-neutral-950/80">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 px-4 py-3 dark:border-violet-900/30">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-violet-950 dark:text-violet-100">
            Attention briefing
          </h2>
          {count > 0 ? (
            <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs font-medium text-white">
              {count} student{count === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-medium text-violet-900 dark:border-violet-800 dark:bg-neutral-900 dark:text-violet-100"
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div className="space-y-4 px-4 py-4">
          <ErrorBox message={error} />

          {patterns.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
                Class patterns
              </p>
              <ul className="flex flex-wrap gap-2">
                {patterns.map((p) => (
                  <li
                    key={`${p.patternType}-${p.description.slice(0, 24)}`}
                    className="max-w-md rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
                  >
                    <p className="font-medium">{p.description}</p>
                    <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-200/90">
                      {p.suggestedAction}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {count > 0 ? (
            <div className="-mx-1 flex gap-3 overflow-x-auto pb-1">
              {briefing.students.map((row: TeacherBriefingStudent) => {
                const initial =
                  (row.displayName?.trim().charAt(0) || row.studentId.charAt(0) || "?").toUpperCase();
                return (
                  <article
                    key={row.insightId}
                    className="min-w-[280px] max-w-[320px] shrink-0 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-950/90"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-neutral-900 dark:text-neutral-50">
                          {row.displayName || row.studentId}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeClasses(row.riskLevel)}`}
                        >
                          {badgeLabel(row.riskLevel)}
                        </span>
                      </div>
                      <MiniSparkline values={row.recentScores} />
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                      {row.reasoning}
                    </p>
                    {row.suggestedActions.length > 0 ? (
                      <ul className="mt-2 list-inside list-disc text-xs text-neutral-600 dark:text-neutral-400">
                        {row.suggestedActions.slice(0, 3).map((a) => (
                          <li key={a.slice(0, 40)}>{a}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/teacher/groups/${encodeURIComponent(groupId)}/students/${encodeURIComponent(row.studentId)}`}
                        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                      >
                        View profile
                      </Link>
                      <button
                        type="button"
                        disabled={busyId === row.insightId}
                        onClick={() => void acknowledge(row.insightId)}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-800 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-200"
                      >
                        {busyId === row.insightId ? "…" : "Acknowledge"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="px-4 py-2 text-xs text-violet-800 dark:text-violet-200">
          {count > 0
            ? `${count} student card(s) hidden — expand to review.`
            : "Patterns available — expand to review."}
        </div>
      )}
    </section>
  );
}

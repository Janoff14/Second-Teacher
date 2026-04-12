"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";
import type {
  TeacherGroupResultsSummary,
  TeacherAssessmentResultSummary,
} from "@/lib/api/assessments";

type InsightEntry = {
  id?: string;
  enrollmentId?: string;
  groupId?: string | null;
  studentId?: string | null;
  type?: string;
  severity?: string | null;
  riskLevel?: string | null;
  title?: string | null;
  message?: string | null;
  body?: string | null;
  summary?: string | null;
};

type Props = {
  summary: TeacherGroupResultsSummary;
  insights: InsightEntry[];
};

const PALETTE = {
  indigo: "#6366f1",
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#8b5cf6",
} as const;

const AXIS_TICK = { fill: "#d4d4d4", fontSize: 12 };
const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#1c1c1e",
    border: "1px solid #333",
    borderRadius: 8,
    fontSize: 13,
  },
  labelStyle: { color: "#e5e5e5" },
  itemStyle: { color: "#e5e5e5" },
};

function truncate(s: string, max = 25) {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

function scoreColor(pct: number) {
  if (pct < 40) return PALETTE.red;
  if (pct <= 60) return PALETTE.yellow;
  return PALETTE.green;
}

function chronological(
  a: TeacherAssessmentResultSummary,
  b: TeacherAssessmentResultSummary,
) {
  return (
    new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
        {title}
      </h3>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        {description}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-10 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
      {message}
    </div>
  );
}

export function ResultsCharts({ summary, insights }: Props) {
  const sorted = useMemo(
    () => [...summary.assessments].sort(chronological),
    [summary.assessments],
  );

  const allResults = useMemo(
    () => sorted.flatMap((a) => a.results),
    [sorted],
  );

  // --- Score Distribution Histogram ---
  const histogramData = useMemo(() => {
    if (allResults.length === 0) return [];
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}-${i * 10 + 10}%`,
      count: 0,
    }));
    for (const r of allResults) {
      const idx = Math.min(Math.floor(r.scorePct / 10), 9);
      buckets[idx].count++;
    }
    return buckets;
  }, [allResults]);

  // --- Assessment Performance Comparison ---
  const perfData = useMemo(
    () =>
      sorted.map((a) => ({
        name: truncate(a.title),
        avg: Math.round(a.averageScorePct ?? 0),
        fill: scoreColor(a.averageScorePct ?? 0),
      })),
    [sorted],
  );

  // --- Class Score Trend ---
  const trendData = useMemo(
    () =>
      sorted.map((a) => ({
        name: truncate(a.title, 18),
        avg: Math.round(a.averageScorePct ?? 0),
      })),
    [sorted],
  );

  // --- Risk Distribution ---
  const riskData = useMemo(() => {
    const counts: Record<string, number> = {
      at_risk: 0,
      watchlist: 0,
      low_load: 0,
      stable: 0,
    };
    for (const ins of insights) {
      const level = ins.riskLevel ?? ins.severity ?? "";
      if (level in counts) counts[level]++;
    }
    const total = counts.at_risk + counts.watchlist + counts.low_load + counts.stable;
    if (total === 0) return [];
    return [
      { name: "At Risk", value: counts.at_risk, color: PALETTE.red },
      { name: "Watchlist", value: counts.watchlist, color: PALETTE.yellow },
      { name: "Low load", value: counts.low_load, color: "#0ea5e9" },
      { name: "Stable", value: counts.stable, color: PALETTE.green },
    ].filter((d) => d.value > 0);
  }, [insights]);

  // --- Participation Rate ---
  const participationData = useMemo(
    () =>
      sorted.map((a) => {
        const uniqueStudents = new Set(a.results.map((r) => r.studentId)).size;
        return {
          name: truncate(a.title),
          rate: a.enrolledCount
            ? Math.round((uniqueStudents / a.enrolledCount) * 100)
            : 0,
        };
      }),
    [sorted],
  );

  const noAssessments = sorted.length === 0;
  const noResults = allResults.length === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 1. Score Distribution Histogram */}
      <ChartCard
        title="Score Distribution"
        description="Number of attempts falling in each 10% score bracket across all assessments."
      >
        {noResults ? (
          <EmptyState message="No results yet to build a score distribution." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={histogramData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="range" tick={AXIS_TICK} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={PALETTE.indigo} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 2. Assessment Performance Comparison */}
      <ChartCard
        title="Assessment Performance"
        description="Average score per assessment. Red < 40%, yellow 40-60%, green > 60%."
      >
        {noAssessments ? (
          <EmptyState message="No assessments to compare." />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(280, sorted.length * 38)}>
            <BarChart data={perfData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={AXIS_TICK} />
              <YAxis dataKey="name" type="category" width={140} tick={AXIS_TICK} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(v) => [
                  `${typeof v === "number" && !Number.isNaN(v) ? v : 0}%`,
                  "Avg Score",
                ]}
              />
              <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                {perfData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 3. Class Score Trend */}
      <ChartCard
        title="Class Score Trend"
        description="Class average score over successive assessments. Dashed line marks 60% passing threshold."
      >
        {noAssessments ? (
          <EmptyState message="No assessments yet to show a trend." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" tick={AXIS_TICK} />
              <YAxis domain={[0, 100]} tick={AXIS_TICK} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(v) => [
                  `${typeof v === "number" && !Number.isNaN(v) ? v : 0}%`,
                  "Class Avg",
                ]}
              />
              <ReferenceLine
                y={60}
                stroke={PALETTE.yellow}
                strokeDasharray="6 4"
                label={{
                  value: "60% pass",
                  fill: PALETTE.yellow,
                  fontSize: 11,
                  position: "insideTopRight",
                }}
              />
              <Line
                type="monotone"
                dataKey="avg"
                stroke={PALETTE.blue}
                strokeWidth={2.5}
                dot={{ fill: PALETTE.blue, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 4. Risk Distribution */}
      <ChartCard
        title="Risk Distribution"
        description="Breakdown of student risk levels from AI-generated insights."
      >
        {riskData.length === 0 ? (
          <EmptyState message="No risk insight data available." />
        ) : (
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value, percent }) =>
                    `${name}: ${value} (${((percent ?? 0) * 100).toFixed(0)}%)`
                  }
                >
                  {riskData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend
                  formatter={(value: string) => (
                    <span className="text-neutral-300">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* 5. Participation Rate */}
      <ChartCard
        title="Participation Rate"
        description="Percentage of enrolled students who submitted each assessment."
      >
        {noAssessments ? (
          <EmptyState message="No assessments to measure participation." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={participationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" tick={AXIS_TICK} />
              <YAxis domain={[0, 100]} tick={AXIS_TICK} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(v) => [
                  `${typeof v === "number" && !Number.isNaN(v) ? v : 0}%`,
                  "Participation",
                ]}
              />
              <Bar
                dataKey="rate"
                fill={PALETTE.purple}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

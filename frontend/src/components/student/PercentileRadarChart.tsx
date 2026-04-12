"use client";

import { useMemo } from "react";

export type PercentileAxis =
  | "quizAvg"
  | "testAvg"
  | "accuracy"
  | "consistency"
  | "completion"
  | "improvement"
  | "engagement"
  | "bestScore";

export type PercentileProfileData = {
  studentId: string;
  groupId: string;
  groupSize: number;
  axes: Record<PercentileAxis, { percentile: number; rawValue: number | null }>;
  minutesPlayed: number;
};

const AXIS_CONFIG: Array<{
  key: PercentileAxis;
  label: string;
  shortLabel: string;
}> = [
  { key: "quizAvg", label: "Quiz Avg", shortLabel: "Quiz Avg" },
  { key: "testAvg", label: "Test Avg", shortLabel: "Test Avg" },
  { key: "accuracy", label: "Accuracy", shortLabel: "Accuracy" },
  { key: "consistency", label: "Consistency", shortLabel: "Consistency" },
  { key: "completion", label: "Completion", shortLabel: "Completion" },
  { key: "improvement", label: "Improvement", shortLabel: "Improvement" },
  { key: "engagement", label: "Engagement", shortLabel: "Engagement" },
  { key: "bestScore", label: "Best Score", shortLabel: "Best Score" },
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function percentileColor(p: number): string {
  if (p >= 75) return "text-blue-600 dark:text-blue-400";
  if (p >= 50) return "text-blue-500 dark:text-blue-400";
  if (p >= 25) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

export function PercentileRadarChart({
  profile,
  studentName,
}: {
  profile: PercentileProfileData;
  studentName?: string;
}) {
  const entries = useMemo(() => {
    return AXIS_CONFIG.map((axis) => {
      const data = profile.axes[axis.key];
      return {
        ...axis,
        percentile: data?.percentile ?? 0,
        rawValue: data?.rawValue ?? null,
      };
    });
  }, [profile]);

  const hasData = entries.some((e) => e.percentile > 0 || e.rawValue !== null);

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
        Percentile profile will appear after completing assessments alongside groupmates.
      </div>
    );
  }

  const cx = 180;
  const cy = 180;
  const maxR = 130;
  const rings = [25, 50, 75, 100];
  const n = entries.length;
  const angleStep = 360 / n;

  const points = entries.map((entry, i) => {
    const angle = i * angleStep;
    const r = (entry.percentile / 100) * maxR;
    return { ...entry, ...polarToCartesian(cx, cy, r, angle), angle };
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-center text-xs">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-neutral-500 italic">
                Percentiles
              </th>
              {entries.map((e) => (
                <th
                  key={e.key}
                  className="px-2 py-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500"
                >
                  {e.shortLabel}
                </th>
              ))}
              <th className="px-2 py-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                Attempts
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-100 dark:border-neutral-800/50">
              <td className="px-2 py-2.5 text-left">
                <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {studentName || "You"}
                </div>
                <div className="text-[10px] text-neutral-500">
                  Group of {profile.groupSize}
                </div>
              </td>
              {entries.map((e) => (
                <td
                  key={e.key}
                  className={`px-2 py-2.5 text-lg font-bold tabular-nums ${percentileColor(e.percentile)}`}
                >
                  {e.percentile > 0 ? e.percentile : "--"}
                </td>
              ))}
              <td className="px-2 py-2.5 text-lg font-bold tabular-nums text-neutral-700 dark:text-neutral-300">
                {profile.minutesPlayed}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex justify-center">
        <svg
          viewBox="0 0 360 360"
          className="h-auto w-full max-w-[360px]"
          role="img"
          aria-label="Percentile radar chart"
        >
          {rings.map((ring, ringIdx) => {
            const r = (ring / 100) * maxR;
            const opacity = 0.04 + ringIdx * 0.03;
            return (
              <g key={ring}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="currentColor"
                  fillOpacity={opacity}
                  stroke="currentColor"
                  strokeOpacity={0.1}
                  strokeWidth="0.5"
                  className="text-blue-400 dark:text-blue-500"
                />
              </g>
            );
          })}

          {entries.map((_, i) => {
            const angle = i * angleStep;
            const end = polarToCartesian(cx, cy, maxR, angle);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={end.x}
                y2={end.y}
                stroke="currentColor"
                strokeOpacity={0.08}
                strokeWidth="0.5"
                className="text-neutral-500"
              />
            );
          })}

          <polygon
            points={polygon}
            fill="currentColor"
            fillOpacity={0.15}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            className="text-blue-500 dark:text-blue-400"
          />

          {points.map((p) => (
            <circle
              key={p.key}
              cx={p.x}
              cy={p.y}
              r="4"
              className="fill-blue-500 stroke-white dark:fill-blue-400 dark:stroke-neutral-950"
              strokeWidth="2"
            />
          ))}

          {points.map((p) => {
            const labelR = maxR + 22;
            const labelPos = polarToCartesian(cx, cy, labelR, p.angle);
            return (
              <text
                key={`label-${p.key}`}
                x={labelPos.x}
                y={labelPos.y + 4}
                fontSize="10"
                fontWeight="600"
                textAnchor="middle"
                fill="currentColor"
                className="text-neutral-600 dark:text-neutral-400"
              >
                {p.shortLabel}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {entries.map((e) => {
          const p = e.percentile;
          const barColor =
            p >= 75
              ? "bg-blue-500"
              : p >= 50
                ? "bg-blue-400"
                : p >= 25
                  ? "bg-amber-500"
                  : "bg-red-500";
          return (
            <div
              key={e.key}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                  {e.label}
                </span>
                <span className={`text-xs font-bold tabular-nums ${percentileColor(p)}`}>
                  {p > 0 ? p : "--"}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.min(p, 100)}%` }}
                />
              </div>
              {e.rawValue !== null ? (
                <p className="mt-1 text-[10px] text-neutral-500">
                  Raw: {e.rawValue}
                  {e.key !== "engagement" ? "%" : " recent"}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

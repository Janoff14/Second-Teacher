"use client";

import { useMemo } from "react";

type CategoryAverages = Record<string, number | null>;

const CATEGORY_LABELS: Record<string, string> = {
  all: "Overall",
  practice: "Practice",
  quiz: "Quizzes",
  test: "Tests",
  exam: "Exams",
  assessment: "Assessments",
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function CategoryRadarChart({
  categoryAverages,
}: {
  categoryAverages: CategoryAverages;
}) {
  const entries = useMemo(() => {
    return Object.entries(categoryAverages)
      .filter(([key]) => key !== "all")
      .map(([key, value]) => ({
        key,
        label: CATEGORY_LABELS[key] ?? key,
        value: value ?? 0,
      }));
  }, [categoryAverages]);

  const overallAvg = categoryAverages.all;

  if (entries.length === 0 || entries.every((e) => e.value === 0)) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
        Category breakdown will appear after completing different assessment types.
      </div>
    );
  }

  const cx = 160;
  const cy = 160;
  const maxR = 120;
  const rings = [25, 50, 75, 100];
  const n = entries.length;
  const angleStep = 360 / n;

  const points = entries.map((entry, i) => {
    const angle = i * angleStep;
    const r = (entry.value / 100) * maxR;
    return { ...entry, ...polarToCartesian(cx, cy, r, angle), angle };
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 320 320" className="h-auto w-full max-w-[320px]" role="img" aria-label="Category performance radar">
        {rings.map((ring) => {
          const r = (ring / 100) * maxR;
          return (
            <g key={ring}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
              <text x={cx + 4} y={cy - r + 12} fontSize="9" fill="currentColor" opacity="0.4">{ring}%</text>
            </g>
          );
        })}
        {entries.map((entry, i) => {
          const angle = i * angleStep;
          const end = polarToCartesian(cx, cy, maxR, angle);
          return (
            <line key={entry.key} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
          );
        })}
        <polygon points={polygon} fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2" className="text-blue-500 dark:text-blue-400" />
        {points.map((p) => {
          const labelPos = polarToCartesian(cx, cy, maxR + 18, p.angle);
          return (
            <g key={p.key}>
              <circle cx={p.x} cy={p.y} r="4.5" className="fill-blue-500 stroke-white dark:fill-blue-400 dark:stroke-neutral-950" strokeWidth="2" />
              <text x={labelPos.x} y={labelPos.y + 4} fontSize="10" fontWeight="600" textAnchor="middle" fill="currentColor" className="text-neutral-700 dark:text-neutral-300">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
        {entries.map((entry) => {
          const pct = entry.value;
          const barColor = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
          return (
            <div key={entry.key} className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{entry.label}</span>
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{pct > 0 ? `${pct}%` : "--"}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {overallAvg != null ? (
        <div className="rounded-full bg-neutral-100 px-4 py-1.5 text-sm font-medium text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          Overall average: {overallAvg}%
        </div>
      ) : null}
    </div>
  );
}

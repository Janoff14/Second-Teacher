"use client";

import { useMemo, useState } from "react";
import type { StudentWorkspace } from "@/lib/api/student";

type Point = StudentWorkspace["analytics"]["timeSeries"][number];
type FilterKey = "all" | "practice" | "quiz" | "test" | "exam" | "assessment";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "practice", label: "Practice" },
  { key: "quiz", label: "Quizzes" },
  { key: "test", label: "Tests" },
  { key: "exam", label: "Exams" },
];

function filterPoints(points: Point[], active: FilterKey): Point[] {
  if (active === "all") {
    return points;
  }
  return points.filter((point) => point.type === active);
}

export function StudentProgressChart({
  points,
  graphNarrative,
}: {
  points: Point[];
  graphNarrative: string;
}) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const filtered = useMemo(
    () => filterPoints(points, activeFilter),
    [points, activeFilter],
  );

  const chart = useMemo(() => {
    if (filtered.length === 0) {
      return null;
    }
    const width = 720;
    const height = 260;
    const padX = 36;
    const padY = 22;
    const plotWidth = width - padX * 2;
    const plotHeight = height - padY * 2;

    const dots = filtered.map((point, index) => {
      const x =
        filtered.length === 1
          ? width / 2
          : padX + (plotWidth * index) / Math.max(filtered.length - 1, 1);
      const y = padY + ((100 - point.scorePct) / 100) * plotHeight;
      return { ...point, x, y };
    });

    const polyline = dots.map((dot) => `${dot.x},${dot.y}`).join(" ");
    return { width, height, dots, polyline, padX, padY, plotWidth, plotHeight };
  }, [filtered]);

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Performance over time
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
            {graphNarrative}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              className={
                activeFilter === filter.key
                  ? "rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "rounded-full border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              }
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {chart ? (
        <div className="mt-5">
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            className="h-auto w-full"
            role="img"
            aria-label="Performance line chart"
          >
            {[0, 25, 50, 75, 100].map((tick) => {
              const y = chart.padY + ((100 - tick) / 100) * chart.plotHeight;
              return (
                <g key={tick}>
                  <line
                    x1={chart.padX}
                    y1={y}
                    x2={chart.padX + chart.plotWidth}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.12"
                  />
                  <text
                    x={8}
                    y={y + 4}
                    fontSize="11"
                    fill="currentColor"
                    opacity="0.6"
                  >
                    {tick}%
                  </text>
                </g>
              );
            })}
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              points={chart.polyline}
              className="text-blue-600 dark:text-blue-400"
            />
            {chart.dots.map((dot) => (
              <g key={`${dot.assessmentVersionId}-${dot.sequence}`}>
                <circle
                  cx={dot.x}
                  cy={dot.y}
                  r="5"
                  className="fill-emerald-500 stroke-white dark:stroke-neutral-950"
                  strokeWidth="2"
                />
                <text
                  x={dot.x}
                  y={chart.height - 6}
                  fontSize="10"
                  textAnchor="middle"
                  fill="currentColor"
                  opacity="0.55"
                >
                  {dot.sequence}
                </text>
              </g>
            ))}
          </svg>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {filtered.map((point) => (
              <div
                key={`${point.assessmentVersionId}-${point.sequence}`}
                className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-3 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">
                      {point.title}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                      {point.type}
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
                    {point.scorePct}%
                  </span>
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  {new Date(point.submittedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-10 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
          No chart points yet for this filter. Finish an assessment to start building the timeline.
        </div>
      )}
    </section>
  );
}

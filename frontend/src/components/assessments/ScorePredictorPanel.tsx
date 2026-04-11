"use client";

import type { MockScorePrediction } from "@/lib/assessment-predictor-mock";

export function ScorePredictorPanel({
  prediction,
}: {
  prediction: MockScorePrediction;
}) {
  const row = (
    label: string,
    value: string | number,
    range?: [number, number],
  ) => (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-100 py-2 last:border-0 dark:border-neutral-800">
      <span className="text-sm text-neutral-600 dark:text-neutral-400">
        {label}
      </span>
      <span className="text-sm font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
        {value}
        {range ? (
          <span className="ml-2 text-xs font-normal text-neutral-500">
            (est. range: {range[0]}–{range[1]})
          </span>
        ) : null}
      </span>
    </div>
  );

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5 dark:border-violet-900/50 dark:bg-violet-950/20">
      <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-200">
        Score prediction (demo)
      </h3>
      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
        Mock predictions based on question count and structure. Will be replaced
        with real analytics when backend ML is ready.
      </p>
      <div className="mt-3">
        {row("Average score", prediction.average, prediction.averageRange)}
        {row("Median", prediction.median, prediction.medianRange)}
        {row("Lowest", prediction.min)}
        {row("Highest", prediction.max)}
        {row("Pass rate (%)", prediction.passPct, prediction.passPctRange)}
      </div>
    </div>
  );
}

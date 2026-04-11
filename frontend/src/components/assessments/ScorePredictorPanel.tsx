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
            (taxminiy oralig‘i: {range[0]}–{range[1]})
          </span>
        ) : null}
      </span>
    </div>
  );

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
      <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-200">
        Keyingi test imtihon — guruh bo‘yicha bashorat (demo)
      </h3>
      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
        Haqiqiy bashorat backend tayyor bo‘lganda almashtiriladi. Hozirgi raqamlar
        savollar soniga bog‘liq mock.
      </p>
      <div className="mt-3">
        {row(
          "O‘rtacha ball",
          prediction.average,
          prediction.averageRange,
        )}
        {row("Median", prediction.median, prediction.medianRange)}
        {row("Eng past", prediction.min)}
        {row("Eng yuqori", prediction.max)}
        {row(
          "O‘tish foizi (%)",
          prediction.passPct,
          prediction.passPctRange,
        )}
      </div>
    </div>
  );
}

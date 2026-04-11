"use client";

import { useEffect, useState } from "react";
import { DraftItemsEditor, newBlankItem } from "@/components/assessments/DraftItemsEditor";
import { ScorePredictorPanel } from "@/components/assessments/ScorePredictorPanel";
import { computeMockPredictions } from "@/lib/assessment-predictor-mock";
import type { DraftItemInput } from "@/lib/api/assessments";

function cloneItems(items: DraftItemInput[]): DraftItemInput[] {
  return items.map((it) => ({
    stem: it.stem,
    correctKey: it.correctKey,
    options: it.options.map((o) => ({ ...o })),
  }));
}

type SimulationDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Joriy saqlangan qoralama nusxasi */
  baselineItems: DraftItemInput[];
  /** Simulyatsiyadan keyin serverga yozish */
  onSaveVersion: (items: DraftItemInput[]) => void | Promise<void>;
  saving?: boolean;
};

export function SimulationDialog({
  open,
  onClose,
  baselineItems,
  onSaveVersion,
  saving,
}: SimulationDialogProps) {
  const [simItems, setSimItems] = useState<DraftItemInput[]>([newBlankItem()]);

  useEffect(() => {
    if (open) {
      const base =
        baselineItems.length > 0 ? cloneItems(baselineItems) : [newBlankItem()];
      setSimItems(base);
    }
  }, [open, baselineItems]);

  if (!open) return null;

  const prediction = computeMockPredictions(simItems);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sim-dialog-title"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-700 dark:bg-neutral-950">
        <h2
          id="sim-dialog-title"
          className="text-lg font-semibold text-neutral-900 dark:text-neutral-50"
        >
          Simulyatsiya — savollarni tahrirlash
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Savollarni o‘zgartiring; bashorat har o‘zgarishda yangilanadi (demo).
          Bekor qilsangiz, joriy saqlangan qoralama o‘zgarmaydi.
        </p>

        <div className="mt-4">
          <ScorePredictorPanel prediction={prediction} />
        </div>

        <div className="mt-6">
          <DraftItemsEditor
            items={simItems}
            onChange={setSimItems}
            disabled={!!saving}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-700">
          <button
            type="button"
            onClick={onClose}
            disabled={!!saving}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-600"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            disabled={!!saving}
            onClick={() => void onSaveVersion(simItems)}
            className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-violet-600"
          >
            {saving ? "Saqlanmoqda\u2026" : "Shu versiyani saqlash (qoralama)"}
          </button>
        </div>
      </div>
    </div>
  );
}

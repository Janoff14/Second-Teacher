"use client";

import type { AssessmentItem, DraftItemInput } from "@/lib/api/assessments";

function newBlankItem(): DraftItemInput {
  return {
    stem: "",
    options: [
      { key: "A", label: "" },
      { key: "B", label: "" },
      { key: "C", label: "" },
      { key: "D", label: "" },
    ],
    correctKey: "A",
  };
}

function toInput(
  item: AssessmentItem | DraftItemInput,
): DraftItemInput {
  const rawOpts = item.options as
    | { key: string; label: string }[]
    | Record<string, string>;
  const options = Array.isArray(rawOpts)
    ? rawOpts.map((o) => ({ ...o }))
    : Object.entries(rawOpts).map(([key, label]) => ({ key, label }));
  return {
    stem: item.stem,
    options,
    correctKey: item.correctKey,
  };
}

type DraftItemsEditorProps = {
  items: DraftItemInput[];
  onChange: (items: DraftItemInput[]) => void;
  disabled?: boolean;
};

export function DraftItemsEditor({
  items,
  onChange,
  disabled,
}: DraftItemsEditorProps) {
  function update(
    index: number,
    patch: Partial<DraftItemInput> | DraftItemInput,
  ) {
    const next = [...items];
    next[index] = { ...next[index], ...patch } as DraftItemInput;
    onChange(next);
  }

  function updateOption(
    itemIndex: number,
    optIndex: number,
    label: string,
  ) {
    const item = items[itemIndex];
    if (!item) return;
    const options = item.options.map((o, i) =>
      i === optIndex ? { ...o, label } : o,
    );
    update(itemIndex, { options });
  }

  return (
    <div className="space-y-6">
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Question {i + 1}
            </span>
            <button
              type="button"
              disabled={disabled || items.length <= 1}
              onClick={() =>
                onChange(items.filter((_, j) => j !== i))
              }
              className="text-xs text-red-600 hover:underline disabled:opacity-40 dark:text-red-400"
            >
              Remove
            </button>
          </div>
          <label className="block text-xs text-neutral-500">Stem</label>
          <textarea
            value={item.stem}
            onChange={(e) => update(i, { stem: e.target.value })}
            rows={3}
            disabled={disabled}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {item.options.map((opt, oi) => (
              <div key={opt.key}>
                <label className="text-xs text-neutral-500">
                  Option {opt.key}
                </label>
                <input
                  value={opt.label}
                  onChange={(e) => updateOption(i, oi, e.target.value)}
                  disabled={disabled}
                  className="mt-0.5 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <label className="text-xs text-neutral-500">Correct option</label>
            <select
              value={item.correctKey}
              onChange={(e) => update(i, { correctKey: e.target.value })}
              disabled={disabled}
              className="mt-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-950"
            >
              {item.options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.key}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...items, newBlankItem()])}
        className="rounded-md border border-dashed border-neutral-400 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-900"
      >
        + Add question
      </button>
    </div>
  );
}

export function itemsFromDraft(
  draftItems: AssessmentItem[] | undefined,
): DraftItemInput[] {
  if (!draftItems?.length) return [newBlankItem()];
  return draftItems.map(toInput);
}

export { newBlankItem };

import type { DraftItemInput } from "@/lib/api/assessments";

/** Deterministic hash for stable mock numbers from current item set. */
function hashItems(items: DraftItemInput[]): number {
  const s = JSON.stringify(items);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export type MockScorePrediction = {
  average: number;
  median: number;
  min: number;
  max: number;
  passPct: number;
  /** "Possibilities" — predicted ranges (mock) */
  averageRange: [number, number];
  medianRange: [number, number];
  passPctRange: [number, number];
};

/**
 * Demo prediction: no real backend yet.
 * Deterministic mock statistics from item count/content (to be replaced by API).
 */
export function computeMockPredictions(
  items: DraftItemInput[],
): MockScorePrediction {
  const n = Math.max(1, items.length);
  const h = hashItems(items);
  const base = 58 + (h % 22);
  const spread = 10 + (h % 12) + Math.min(n, 8);

  const average = Math.min(95, Math.max(35, base + (h % 7) - 3));
  const median = Math.min(95, Math.max(35, average + (h % 5) - 2));
  const min = Math.max(0, Math.round(average - spread * 0.9));
  const max = Math.min(100, Math.round(average + spread * 0.85));
  const passPct = Math.min(
    98,
    Math.max(30, Math.round(48 + (h % 40) + n * 0.8)),
  );

  const w = 3 + (h % 5);
  return {
    average: Math.round(average * 10) / 10,
    median: Math.round(median * 10) / 10,
    min,
    max,
    passPct,
    averageRange: [
      Math.max(0, average - w),
      Math.min(100, average + w),
    ],
    medianRange: [
      Math.max(0, median - w - 1),
      Math.min(100, median + w + 1),
    ],
    passPctRange: [
      Math.max(0, passPct - 6),
      Math.min(100, passPct + 6),
    ],
  };
}

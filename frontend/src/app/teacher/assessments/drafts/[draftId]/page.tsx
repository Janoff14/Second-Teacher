"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DraftItemsEditor,
  itemsFromDraft,
  newBlankItem,
} from "@/components/assessments/DraftItemsEditor";
import { ScorePredictorPanel } from "@/components/assessments/ScorePredictorPanel";
import { SimulationDialog } from "@/components/assessments/SimulationDialog";
import { listGroups, listSubjects } from "@/lib/api/academic";
import type { Group, Subject } from "@/lib/api/academic";
import { computeMockPredictions } from "@/lib/assessment-predictor-mock";
import {
  getDraft,
  publishDraft,
  putDraftItems,
  type DraftItemInput,
} from "@/lib/api/assessments";

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

function sameLocalDayEnd(opensAtLocal: string): string {
  if (!opensAtLocal.includes("T")) return "";
  const [datePart] = opensAtLocal.split("T");
  return `${datePart}T23:59`;
}

export default function EditDraftPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = params.draftId as string;

  const [items, setItems] = useState<DraftItemInput[]>([newBlankItem()]);
  const [title, setTitle] = useState("");
  const [draftGroupId, setDraftGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showPredictor, setShowPredictor] = useState(false);
  const [simOpen, setSimOpen] = useState(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [publishGroupId, setPublishGroupId] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [sameDayWindow, setSameDayWindow] = useState(false);

  const prediction = useMemo(() => computeMockPredictions(items), [items]);

  const loadDraft = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getDraft(draftId);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    const d = res.data;
    if (d?.title) setTitle(d.title);
    if (d?.groupId) {
      setDraftGroupId(d.groupId);
      setPublishGroupId(d.groupId);
    }
    setItems(itemsFromDraft(d?.items));
  }, [draftId]);

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  useEffect(() => {
    void (async () => {
      const s = await listSubjects();
      if (s.ok && Array.isArray(s.data)) setSubjects(s.data);
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      if (!subjectId) {
        setGroups([]);
        return;
      }
      const g = await listGroups(subjectId);
      if (g.ok && Array.isArray(g.data)) setGroups(g.data);
    })();
  }, [subjectId]);

  useEffect(() => {
    if (sameDayWindow && opensAt) {
      setClosesAt(sameLocalDayEnd(opensAt));
    }
  }, [sameDayWindow, opensAt]);

  const backHref = draftGroupId
    ? `/teacher/groups/${encodeURIComponent(draftGroupId)}`
    : "/teacher";

  async function handleSaveItems(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    const res = await putDraftItems(draftId, items);
    setSaving(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setSuccess("Questions saved successfully.");
    setShowPredictor(true);
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!publishGroupId.trim()) {
      setError("Select a class to publish to.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const res = await publishDraft(draftId, {
      groupId: publishGroupId.trim(),
      opensAt: opensAt ? new Date(opensAt).toISOString() : null,
      closesAt: closesAt ? new Date(closesAt).toISOString() : null,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setSuccess("Assessment published! Students can now access it during the scheduled window.");
    setShowPredictor(true);
  }

  async function handleSimulationSave(simItems: DraftItemInput[]) {
    setSaving(true);
    setError(null);
    const res = await putDraftItems(draftId, simItems);
    setSaving(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setItems(simItems);
    setSimOpen(false);
    setSuccess("Simulation version saved as draft.");
    setShowPredictor(true);
  }

  if (loading && !title && items.length === 1 && !items[0]?.stem) {
    return <div className="text-sm text-neutral-500">Loading draft...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href={backHref} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          &larr; Back to class
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
              Edit assessment
            </h1>
            <p className="mt-1 font-mono text-xs text-neutral-500">{draftId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setSimOpen(true)}
              className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
            >
              Simulate scores
            </button>
          </div>
        </div>
      </div>

      <ErrorBox message={error} />
      {success && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-100">
          {success}
        </p>
      )}

      <form onSubmit={handleSaveItems} className="space-y-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Quiz: Newton's Laws"
                className="mt-1 w-full max-w-lg rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                disabled={saving}
              />
            </div>
            <DraftItemsEditor items={items} onChange={setItems} disabled={saving} />
          </div>
          <div className="mt-6 flex flex-wrap gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {saving ? "Saving..." : "Save questions"}
            </button>
          </div>
        </div>
      </form>

      {showPredictor && (
        <ScorePredictorPanel prediction={prediction} />
      )}

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          Publish to class
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Choose a class and set the availability window, then publish.
        </p>
        <form onSubmit={handlePublish} className="mt-4 space-y-4">
          <div>
            <label className="text-sm text-neutral-700 dark:text-neutral-300">
              Subject and class
            </label>
            <div className="mt-1 flex flex-wrap gap-2">
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setPublishGroupId("");
                }}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              >
                <option value="">Select subject...</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={publishGroupId}
                onChange={(e) => setPublishGroupId(e.target.value)}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                disabled={!subjectId}
              >
                <option value="">Select class...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-xs text-neutral-500">Or enter class ID directly:</p>
            <input
              placeholder="Class ID"
              value={publishGroupId}
              onChange={(e) => setPublishGroupId(e.target.value)}
              className="mt-1 w-full max-w-md rounded-xl border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-950"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={sameDayWindow}
              onChange={(e) => setSameDayWindow(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Close at end of selected day (23:59)
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-neutral-500">Opens (local time)</label>
              <input
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Closes (local time)</label>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                disabled={sameDayWindow}
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm disabled:opacity-60 dark:border-neutral-600 dark:bg-neutral-950"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-blue-600"
            >
              {saving ? "Publishing..." : "Publish to class"}
            </button>
          </div>
        </form>
      </section>

      <SimulationDialog
        open={simOpen}
        onClose={() => setSimOpen(false)}
        baselineItems={items}
        onSaveVersion={(sim) => void handleSimulationSave(sim)}
        saving={saving}
      />
    </div>
  );
}

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

/** datetime-local qiymatidan shu kunning oxirini (23:59) qo‘shadi */
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showPredictorAfterAction, setShowPredictorAfterAction] = useState(false);
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
    setSuccess("Savollar saqlandi.");
    setShowPredictorAfterAction(true);
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!publishGroupId.trim()) {
      setError("Nashr uchun guruhni tanlang yoki ID kiriting.");
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
    setSuccess("Nashr qilindi. Pastdagi bashorat (demo) ko‘rinadi — keyin ro‘yxatga o‘tasiz.");
    setShowPredictorAfterAction(true);
  }

  function goToPublished() {
    router.push("/teacher/assessments/published");
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
    setSuccess("Simulyatsiya versiyasi qoralama sifatida saqlandi.");
    setShowPredictorAfterAction(true);
  }

  if (loading && !title && items.length === 1 && !items[0]?.stem) {
    return (
      <div className="text-sm text-neutral-500">Yuklanmoqda\u2026</div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/teacher/assessments"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          &larr; Qoralamalar
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Qoralamani tahrirlash
        </h1>
        <p className="mt-1 font-mono text-xs text-neutral-500">{draftId}</p>
      </div>

      <ErrorBox message={error} />
      {success && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-100">
          {success}
        </p>
      )}

      <form onSubmit={handleSaveItems} className="space-y-6">
        <div>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Sarlavha
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full max-w-lg rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
            disabled={saving}
          />
        </div>
        <DraftItemsEditor
          items={items}
          onChange={setItems}
          disabled={saving}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            {saving ? "Saqlanmoqda\u2026" : "Savollarni saqlash"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setSimOpen(true)}
            className="rounded-md border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
          >
            Simulyatsiya
          </button>
        </div>
      </form>

      {showPredictorAfterAction && (
        <div className="space-y-3">
          <ScorePredictorPanel prediction={prediction} />
        </div>
      )}

      <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          Nashr qilish
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Guruhni tanlang va (ixtiyoriy) ochilish/yopilish vaqtini belgilang.
        </p>
        <form onSubmit={handlePublish} className="mt-4 space-y-4">
          <div>
            <label className="text-sm text-neutral-700 dark:text-neutral-300">
              Fan va guruh
            </label>
            <div className="mt-1 flex flex-wrap gap-2">
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setPublishGroupId("");
                }}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              >
                <option value="">Fan tanlang\u2026</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={publishGroupId}
                onChange={(e) => setPublishGroupId(e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                disabled={!subjectId}
              >
                <option value="">Guruh tanlang\u2026</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-xs text-neutral-500">Yoki guruh ID:</p>
            <input
              placeholder="groupId"
              value={publishGroupId}
              onChange={(e) => setPublishGroupId(e.target.value)}
              className="mt-1 w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-950"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={sameDayWindow}
              onChange={(e) => setSameDayWindow(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Faqat tanlangan kunning oxirigacha ochiq (yopilish 23:59)
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-neutral-500">
                Ochilish (mahalliy vaqt)
              </label>
              <input
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">
                Yopilish (mahalliy vaqt)
              </label>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                disabled={sameDayWindow}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-60 dark:border-neutral-600 dark:bg-neutral-950"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm text-white dark:bg-blue-600"
            >
              {saving ? "Nashr\u2026" : "Guruhga nashr qilish"}
            </button>
            <button
              type="button"
              onClick={goToPublished}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-600"
            >
              Nashr etilganlar ro&apos;yxati
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

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { listSubjects, listGroups, type Subject, type Group } from "@/lib/api/academic";
import { listTextbookSources, type TextbookSource } from "@/lib/api/rag";
import {
  aiGenerateTest,
  getTextbookTopics,
  type AiGenerateResult,
} from "@/lib/api/assessments";

export default function AiGenerateTestPage() {
  const router = useRouter();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [textbooks, setTextbooks] = useState<TextbookSource[]>([]);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);

  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [textbookSourceId, setTextbookSourceId] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [title, setTitle] = useState("");

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiGenerateResult | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await listSubjects();
      if (res.ok && Array.isArray(res.data)) setSubjects(res.data);
    })();
  }, []);

  useEffect(() => {
    if (!subjectId) {
      setGroups([]);
      setTextbooks([]);
      return;
    }
    void (async () => {
      const [g, t] = await Promise.all([
        listGroups(subjectId),
        listTextbookSources(subjectId),
      ]);
      if (g.ok && Array.isArray(g.data)) setGroups(g.data);
      if (t.ok && Array.isArray(t.data)) setTextbooks(t.data);
    })();
  }, [subjectId]);

  const loadTopics = useCallback(async () => {
    if (!textbookSourceId || !subjectId) {
      setAvailableTopics([]);
      return;
    }
    const res = await getTextbookTopics(textbookSourceId, subjectId);
    if (res.ok && res.data?.topics) {
      setAvailableTopics(res.data.topics);
    }
  }, [textbookSourceId, subjectId]);

  useEffect(() => {
    setSelectedTopics([]);
    void loadTopics();
  }, [loadTopics]);

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
  }

  function addCustomTopic() {
    const trimmed = customTopic.trim();
    if (!trimmed) return;
    if (!selectedTopics.includes(trimmed)) {
      setSelectedTopics((prev) => [...prev, trimmed]);
    }
    setCustomTopic("");
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!groupId || !textbookSourceId || selectedTopics.length === 0) {
      setError("Please select a subject, class, textbook, and at least one topic.");
      return;
    }

    setGenerating(true);
    setError(null);
    setResult(null);

    const res = await aiGenerateTest({
      groupId,
      textbookSourceId,
      topics: selectedTopics,
      questionCount,
      difficulty,
      title: title.trim() || undefined,
    });

    setGenerating(false);

    if (!res.ok) {
      setError(res.error.message);
      return;
    }

    setResult(res.data as AiGenerateResult);
  }

  function handleGoToDraft() {
    if (result?.draft?.id) {
      router.push(`/teacher/assessments/drafts/${result.draft.id}`);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href="/teacher/assessments"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          &larr; Baholashlarga qaytish
        </Link>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          AI bilan test yaratish
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Darslik tanlang, mavzularni belgilang — AI savollarni avtomatik yaratadi.
          Yaratilgan savollarni ko&apos;rib chiqib, tahrirlashingiz mumkin.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
        >
          {error}
        </div>
      )}

      {result ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm dark:border-emerald-800/40 dark:bg-emerald-950/20">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                  Test muvaffaqiyatli yaratildi!
                </h2>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  {result.generation.itemsGenerated} ta savol yaratildi &mdash; &quot;{result.generation.textbookTitle}&quot; darsligidan
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-emerald-100/60 px-3 py-2 text-center dark:bg-emerald-900/30">
                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                  {result.generation.itemsGenerated}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Savollar</p>
              </div>
              <div className="rounded-xl bg-emerald-100/60 px-3 py-2 text-center dark:bg-emerald-900/30">
                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                  {result.generation.topicsUsed.length}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Mavzular</p>
              </div>
              <div className="rounded-xl bg-emerald-100/60 px-3 py-2 text-center dark:bg-emerald-900/30">
                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                  {result.generation.chunksRetrieved}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Darslik bo&apos;laklari</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGoToDraft}
                className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                Ko&apos;rib chiqish va tahrirlash
              </button>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                Yana yaratish
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleGenerate} className="space-y-6">
          {/* Subject & Class selection */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
              1. Fan va sinf tanlang
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm text-neutral-700 dark:text-neutral-300">Fan</label>
                <select
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setGroupId("");
                    setTextbookSourceId("");
                  }}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                >
                  <option value="">Fan tanlang...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-neutral-700 dark:text-neutral-300">Sinf</label>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  disabled={!subjectId}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-950"
                >
                  <option value="">Sinf tanlang...</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Textbook selection */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
              2. Darslik tanlang
            </h2>
            {textbooks.length === 0 && subjectId ? (
              <p className="mt-3 text-sm text-neutral-500">
                Bu fanda darslik topilmadi. Avval darslik yuklang.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {textbooks.map((tb) => (
                  <label
                    key={tb.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                      textbookSourceId === tb.id
                        ? "border-blue-400 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-100"
                        : "border-neutral-200 bg-neutral-50/50 text-neutral-700 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="textbook"
                      checked={textbookSourceId === tb.id}
                      onChange={() => setTextbookSourceId(tb.id)}
                      className="sr-only"
                    />
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      textbookSourceId === tb.id
                        ? "border-blue-500 bg-blue-500"
                        : "border-neutral-300 dark:border-neutral-600"
                    }`}>
                      {textbookSourceId === tb.id && <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
                    <div>
                      <p className="font-medium">{tb.title}</p>
                      <p className="text-xs text-neutral-500">
                        Versiya: {tb.versionLabel}
                        {tb.sourceFormat ? ` (${tb.sourceFormat})` : ""}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Topic selection */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
              3. Mavzularni tanlang
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Darslikdagi boblardan tanlang yoki o&apos;z mavzuingizni qo&apos;shing.
            </p>

            {availableTopics.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {availableTopics.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      selectedTopics.includes(topic)
                        ? "border-blue-400 bg-blue-100 font-medium text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
                        : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                    }`}
                  >
                    {selectedTopics.includes(topic) ? "✓ " : ""}
                    {topic}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <input
                placeholder="Maxsus mavzu qo'shing..."
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTopic();
                  }
                }}
                className="flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              />
              <button
                type="button"
                onClick={addCustomTopic}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-600"
              >
                Qo&apos;shish
              </button>
            </div>

            {selectedTopics.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Tanlangan mavzular ({selectedTopics.length}):
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedTopics.map((topic) => (
                    <span
                      key={topic}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
                    >
                      {topic}
                      <button
                        type="button"
                        onClick={() => toggleTopic(topic)}
                        className="ml-1 text-blue-500 hover:text-blue-700"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Configuration */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
              4. Sozlamalar
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-sm text-neutral-700 dark:text-neutral-300">
                  Savollar soni
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                />
              </div>
              <div>
                <label className="text-sm text-neutral-700 dark:text-neutral-300">
                  Qiyinlik darajasi
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                >
                  <option value="easy">Oson</option>
                  <option value="medium">O&apos;rtacha</option>
                  <option value="hard">Qiyin</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-neutral-700 dark:text-neutral-300">
                  Test sarlavhasi (ixtiyoriy)
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="masalan: 3-bob bo'yicha test"
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                />
              </div>
            </div>
          </div>

          {/* Generate button */}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={generating || !groupId || !textbookSourceId || selectedTopics.length === 0}
              className="rounded-xl bg-violet-700 px-6 py-3 text-sm font-medium text-white transition hover:bg-violet-600 disabled:opacity-50 dark:bg-violet-600 dark:hover:bg-violet-500"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Yaratilmoqda...
                </span>
              ) : (
                "AI bilan test yaratish"
              )}
            </button>
            {generating && (
              <p className="text-sm text-neutral-500">
                AI darslikni tahlil qilib, savollar yaratmoqda. Bu bir necha soniya davom etishi mumkin...
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

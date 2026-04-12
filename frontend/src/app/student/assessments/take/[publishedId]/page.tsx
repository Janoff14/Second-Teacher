"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  getPublishedAssessment,
  submitAttempt,
  type AssessmentItem,
  type StudyRecommendation,
} from "@/lib/api/assessments";
import { useAuthStore } from "@/stores/auth-store";

export default function TakeAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const publishedId = params.publishedId as string;
  const activeGroupId = useAuthStore((s) => s.activeGroupId);

  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [title, setTitle] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; maxScore: number; pct: number } | null>(null);
  const [studyRecs, setStudyRecs] = useState<StudyRecommendation[]>([]);

  const backHref = activeGroupId ? `/student/subjects/${activeGroupId}` : "/student";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getPublishedAssessment(publishedId);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    const d = res.data;
    setTitle(d?.title ?? null);
    const raw = d?.items;
    if (Array.isArray(raw)) {
      const arr = raw as AssessmentItem[];
      setItems(arr);
      const init: Record<string, string> = {};
      arr.forEach((it, idx) => {
        const key = it.id ?? `q-${idx}`;
        init[key] = "";
      });
      setAnswers(init);
    }
  }, [publishedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const answeredCount = Object.values(answers).filter((v) => v !== "").length;
  const progress = items.length > 0 ? Math.round((answeredCount / items.length) * 100) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await submitAttempt(publishedId, { answers });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setSubmitted(true);
    const data = res.data as Record<string, unknown> | undefined;
    if (data && typeof data.totalScore === "number" && typeof data.maxScore === "number") {
      const score = data.totalScore as number;
      const maxScore = data.maxScore as number;
      setResult({
        score,
        maxScore,
        pct: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
      });
    }
    if (data && Array.isArray(data.studyRecommendations)) {
      setStudyRecs(data.studyRecommendations as StudyRecommendation[]);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
        <p className="text-sm text-neutral-500">Loading assessment...</p>
      </div>
    );
  }

  if (submitted) {
    const recsWithLinks = studyRecs.filter((r) => r.readerPath);
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm dark:border-emerald-800/40 dark:bg-emerald-950/20">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <svg className="h-8 w-8 text-emerald-600 dark:text-emerald-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">
            Javobingiz qabul qilindi!
          </h2>
          {result ? (
            <div className="mt-4">
              <p className="text-4xl font-bold text-emerald-800 dark:text-emerald-200">{result.pct}%</p>
              <p className="mt-1 text-sm text-emerald-700/70 dark:text-emerald-300/70">
                {result.score} / {result.maxScore} ball
              </p>
            </div>
          ) : null}
          <p className="mt-4 text-sm text-emerald-800/80 dark:text-emerald-200/80">
            Natijangiz saqlandi. Fan sahifangizda yangilangan tahlil va AI tavsiyalarni ko&apos;ring.
          </p>
        </div>

        {recsWithLinks.length > 0 && (
          <div className="rounded-[2rem] border border-amber-200 bg-amber-50/80 p-5 shadow-sm dark:border-amber-800/40 dark:bg-amber-950/20">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                <svg className="h-5 w-5 text-amber-600 dark:text-amber-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-amber-900 dark:text-amber-100">
                  Darslikdan o&apos;qish tavsiyalari
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Noto&apos;g&apos;ri javob bergan savollaringiz uchun darslikdagi tegishli bo&apos;limlar
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {recsWithLinks.map((rec, idx) => (
                <div
                  key={rec.itemId || idx}
                  className="rounded-xl border border-amber-200 bg-white px-4 py-3 dark:border-amber-800/30 dark:bg-neutral-950/50"
                >
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {rec.stem.length > 120 ? `${rec.stem.slice(0, 120)}...` : rec.stem}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {rec.chapterTitle && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        {rec.chapterTitle}
                        {rec.pageNumber ? ` — ${rec.pageNumber}-sahifa` : ""}
                      </span>
                    )}
                    {rec.textbookTitle && (
                      <span className="text-xs text-neutral-500">
                        {rec.textbookTitle}
                      </span>
                    )}
                  </div>
                  {rec.highlightText && (
                    <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                      &ldquo;{rec.highlightText.slice(0, 200)}{rec.highlightText.length > 200 ? "..." : ""}&rdquo;
                    </p>
                  )}
                  <Link
                    href={rec.readerPath!}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-500 dark:bg-amber-700 dark:hover:bg-amber-600"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                    Darslikda ochish
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href={backHref}
            className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            Fanga qaytish
          </Link>
          <Link
            href={`/student/assessments/take/${publishedId}`}
            onClick={(e) => {
              e.preventDefault();
              setSubmitted(false);
              setResult(null);
              setStudyRecs([]);
              void load();
            }}
            className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            Qayta topshirish
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-neutral-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_40%),linear-gradient(135deg,#ffffff,_#f8fafc)] p-5 shadow-sm dark:border-neutral-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_40%),linear-gradient(135deg,#0a0a0a,_#111827)]">
        <Link
          href={backHref}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Back to subject workspace
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
          {title || "Assessment"}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
            {items.length} question{items.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
            {answeredCount} / {items.length} answered
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300 dark:bg-blue-400"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        {items.map((item, idx) => {
          const itemKey = item.id ?? `q-${idx}`;
          const isAnswered = answers[itemKey] !== "";
          return (
            <div
              key={itemKey}
              className={`rounded-[2rem] border p-5 shadow-sm transition-colors ${
                isAnswered
                  ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-800/40 dark:bg-emerald-950/10"
                  : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  isAnswered
                    ? "bg-emerald-500 text-white"
                    : "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                }`}>
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-6 text-neutral-900 dark:text-neutral-100">
                    {item.stem}
                  </p>
                  <div className="mt-4 space-y-2">
                    {item.options?.map((opt) => (
                      <label
                        key={opt.key}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                          answers[itemKey] === opt.key
                            ? "border-blue-400 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-100"
                            : "border-neutral-200 bg-neutral-50/50 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-100/50 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-300 dark:hover:bg-neutral-900/60"
                        }`}
                      >
                        <input
                          type="radio"
                          name={itemKey}
                          checked={answers[itemKey] === opt.key}
                          onChange={() => setAnswers((a) => ({ ...a, [itemKey]: opt.key }))}
                          className="sr-only"
                        />
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          answers[itemKey] === opt.key
                            ? "border-blue-500 bg-blue-500"
                            : "border-neutral-300 dark:border-neutral-600"
                        }`}>
                          {answers[itemKey] === opt.key ? (
                            <span className="h-2 w-2 rounded-full bg-white" />
                          ) : null}
                        </span>
                        <span>
                          <span className="font-semibold">{opt.key}.</span> {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {answeredCount === items.length ? "All questions answered" : `${items.length - answeredCount} unanswered`}
            </p>
            <p className="text-xs text-neutral-500">
              {answeredCount === items.length
                ? "You can submit your attempt now."
                : "You can still submit with unanswered questions."}
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting || items.length === 0}
            className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {submitting ? "Submitting..." : "Submit attempt"}
          </button>
        </div>
      </form>
    </div>
  );
}

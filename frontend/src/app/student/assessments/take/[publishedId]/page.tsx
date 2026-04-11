"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  getPublishedAssessment,
  submitAttempt,
  type AssessmentItem,
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

export default function TakeAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const publishedId = params.publishedId as string;

  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [title, setTitle] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    router.push("/student/assessments/attempts");
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading assessment…</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/student/assessments"
        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Published list
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
        {title || "Assessment"}
      </h1>
      <p className="font-mono text-xs text-neutral-500">{publishedId}</p>

      <ErrorBox message={error} />

      <form onSubmit={handleSubmit} className="space-y-8">
        {items.map((item, idx) => {
          const itemKey = item.id ?? `q-${idx}`;
          return (
          <fieldset
            key={itemKey}
            className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <legend className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              Question {idx + 1}
            </legend>
            <p className="mt-2 whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
              {item.stem}
            </p>
            <div className="mt-3 space-y-2">
              {item.options?.map((opt) => (
                <label
                  key={opt.key}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name={itemKey}
                    checked={answers[itemKey] === opt.key}
                    onChange={() =>
                      setAnswers((a) => ({ ...a, [itemKey]: opt.key }))
                    }
                  />
                  <span>
                    <strong>{opt.key}.</strong> {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        );
        })}

        <button
          type="submit"
          disabled={submitting || items.length === 0}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {submitting ? "Submitting…" : "Submit attempt"}
        </button>
      </form>
    </div>
  );
}

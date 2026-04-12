"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  createDraft,
  listDrafts,
  unwrapDraftList,
  type AssessmentDraft,
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

export default function TeacherAssessmentsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<AssessmentDraft[]>([]);
  const [title, setTitle] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listDrafts(groupFilter.trim() || undefined);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setDrafts([]);
      return;
    }
    setDrafts(unwrapDraftList(res.data));
  }, [groupFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await createDraft({
      title: title.trim() || undefined,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setTitle("");
    await refresh();
    if (res.data?.id) {
      router.push(`/teacher/assessments/drafts/${res.data.id}`);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Baholashlar (qoralamalar)
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Qoralama yarating, savollarni tahrirlang, keyin guruhga nashr qiling.
        </p>
      </div>

      <ErrorBox message={error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Yangi qoralama
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Savollarni qo&apos;lda yozing
          </p>
          <form onSubmit={handleCreate} className="mt-3 flex flex-wrap gap-2">
            <input
              placeholder="Sarlavha (ixtiyoriy)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-w-[200px] flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              Qoralama yaratish
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
          <h2 className="text-sm font-semibold text-violet-900 dark:text-violet-200">
            AI bilan test yaratish
          </h2>
          <p className="mt-1 text-xs text-violet-700 dark:text-violet-400">
            Darslikdan mavzu tanlang — AI savollarni avtomatik yaratadi
          </p>
          <Link
            href="/teacher/assessments/ai-generate"
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-600 dark:bg-violet-600 dark:hover:bg-violet-500"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            AI bilan yaratish
          </Link>
        </section>
      </div>

      <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Qoralamalaringiz
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                placeholder="Guruh ID bo'yicha filtr (ixtiyoriy)"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-1.5 font-mono text-xs dark:border-neutral-600 dark:bg-neutral-950"
              />
              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600"
              >
                Yangilash
              </button>
            </div>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {drafts.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-100 px-3 py-2 dark:border-neutral-800"
            >
              <span className="font-mono text-sm">{d.id}</span>
              {d.title && (
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {d.title}
                </span>
              )}
              <Link
                href={`/teacher/assessments/drafts/${d.id}`}
                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Tahrirlash
              </Link>
            </li>
          ))}
        </ul>
        {drafts.length === 0 && !loading && (
          <p className="mt-4 text-sm text-neutral-500">
            Hozircha qoralama yo&apos;q — yuqoridan yarating.
          </p>
        )}
      </section>

      <p className="text-sm">
        <Link
          href="/teacher/assessments/published"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          Nashr etilgan testlar →
        </Link>
      </p>
    </div>
  );
}

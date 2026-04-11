"use client";

import { useCallback, useEffect, useState } from "react";
import { listSubjects } from "@/lib/api/academic";
import type { Subject } from "@/lib/api/academic";
import { ingestTextbook } from "@/lib/api/rag";

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

export function TextbookIngestForm({
  initialSubjectId,
}: {
  /** URL dan: `/teacher/corpus?subjectId=` */
  initialSubjectId?: string;
} = {}) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? "");
  const [title, setTitle] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSubjects = useCallback(async () => {
    const res = await listSubjects();
    if (!res.ok) return;
    const list = res.data ?? [];
    setSubjects(Array.isArray(list) ? list : []);
  }, []);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  useEffect(() => {
    if (initialSubjectId) setSubjectId(initialSubjectId);
  }, [initialSubjectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId.trim() || !title.trim() || !versionLabel.trim() || !text.trim()) {
      setError("Fill subject, title, version, and text.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    const res = await ingestTextbook({
      subjectId: subjectId.trim(),
      title: title.trim(),
      versionLabel: versionLabel.trim(),
      text,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setSuccess("Textbook submitted for ingestion.");
    setText("");
  }

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
        Textbook ingest
      </h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">
          POST /rag/sources/textbooks
        </code>
      </p>

      <ErrorBox message={error} />
      {success && (
        <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-100">
          {success}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Subject
          </label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="mt-1 w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
            disabled={loading}
            required
          >
            <option value="">Select subject…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {subjects.length === 0 && (
            <p className="mt-1 text-xs text-neutral-500">
              No subjects — create one under Structure first.
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
            disabled={loading}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Version label
          </label>
          <input
            value={versionLabel}
            onChange={(e) => setVersionLabel(e.target.value)}
            placeholder="e.g. 2025-01"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
            disabled={loading}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Full text
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-950"
            disabled={loading}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {loading ? "Submitting…" : "Ingest textbook"}
        </button>
      </form>
    </section>
  );
}

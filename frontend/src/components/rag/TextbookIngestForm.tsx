"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listSubjects } from "@/lib/api/academic";
import type { Subject } from "@/lib/api/academic";
import { uploadTextbookFile, type TextbookSource } from "@/lib/api/rag";

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

type TextbookUploadResult = {
  source: TextbookSource;
  chunksCreated: number;
  extractedCharacters: number;
};

type TextbookIngestFormProps = {
  initialSubjectId?: string;
  fixedSubjectId?: string;
  fixedSubjectName?: string;
  onUploaded?: (source: TextbookSource) => void | Promise<void>;
};

function inferDefaultVersionLabel() {
  return new Date().toISOString().slice(0, 10);
}

export function TextbookIngestForm({
  initialSubjectId,
  fixedSubjectId,
  fixedSubjectName,
  onUploaded,
}: TextbookIngestFormProps = {}) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState(fixedSubjectId ?? initialSubjectId ?? "");
  const [title, setTitle] = useState("");
  const [versionLabel, setVersionLabel] = useState(inferDefaultVersionLabel);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<TextbookUploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const subjectLocked = Boolean(fixedSubjectId?.trim());
  const resolvedSubjectName = useMemo(() => {
    if (fixedSubjectName?.trim()) return fixedSubjectName.trim();
    return subjects.find((subject) => subject.id === subjectId)?.name ?? "";
  }, [fixedSubjectName, subjectId, subjects]);

  const loadSubjects = useCallback(async () => {
    if (subjectLocked) return;
    const res = await listSubjects();
    if (!res.ok) return;
    setSubjects(Array.isArray(res.data) ? res.data : []);
  }, [subjectLocked]);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  useEffect(() => {
    if (fixedSubjectId?.trim()) {
      setSubjectId(fixedSubjectId.trim());
    }
  }, [fixedSubjectId]);

  useEffect(() => {
    if (!file || title.trim()) return;
    const inferredTitle = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    if (inferredTitle) {
      setTitle(inferredTitle);
    }
  }, [file, title]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!subjectId.trim()) {
      setError("Select the subject that this textbook belongs to.");
      return;
    }
    if (!file) {
      setError("Choose a PDF, DOCX, DOC, TXT, or Markdown file to upload.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setUploadResult(null);

    const res = await uploadTextbookFile({
      subjectId: subjectId.trim(),
      file,
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(versionLabel.trim() ? { versionLabel: versionLabel.trim() } : {}),
    });

    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }

    const data = res.data;
    const uploadedSource = data?.source;
    setSuccess(
      uploadedSource
        ? `${uploadedSource.title} was uploaded and prepared for AI search automatically.`
        : "Textbook uploaded and prepared for AI search automatically.",
    );
    if (
      data?.source &&
      typeof data.chunksCreated === "number" &&
      typeof data.extractedCharacters === "number"
    ) {
      setUploadResult({
        source: data.source,
        chunksCreated: data.chunksCreated,
        extractedCharacters: data.extractedCharacters,
      });
    }
    setFile(null);
    setTitle("");
    setVersionLabel(inferDefaultVersionLabel());
    if (fileInputRef.current) fileInputRef.current.value = "";
    await onUploaded?.(uploadedSource as TextbookSource);
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          Upload textbook
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Upload the book file once. We extract the text, build the reader view, and prepare it
          for AI search immediately after upload.
        </p>
      </div>

      <ErrorBox message={error} />
      {success ? (
        <div className="mt-3 space-y-3">
          <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-100">
            {success}
          </p>
          {uploadResult ? (
            <div
              className="rounded-xl border border-green-200/80 bg-gradient-to-b from-green-50/90 to-white p-4 shadow-sm dark:border-green-900/45 dark:from-green-950/35 dark:to-neutral-950/80 dark:shadow-none"
              role="status"
              aria-live="polite"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-green-300 bg-green-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-green-900 dark:border-green-700/60 dark:bg-green-900/50 dark:text-green-50">
                  Ready for AI search
                </span>
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-neutral-200/80 bg-white/60 px-3 py-2.5 dark:border-neutral-700/80 dark:bg-neutral-900/50">
                  <dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Chunks indexed
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                    {uploadResult.chunksCreated.toLocaleString()}
                  </dd>
                </div>
                <div className="rounded-lg border border-neutral-200/80 bg-white/60 px-3 py-2.5 dark:border-neutral-700/80 dark:bg-neutral-900/50">
                  <dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Characters extracted
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                    {uploadResult.extractedCharacters.toLocaleString()}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                Students can now search this material in AI-assisted study tools.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {subjectLocked ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/40">
            <p className="text-neutral-500 dark:text-neutral-400">Subject</p>
            <p className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">
              {resolvedSubjectName || "Selected subject"}
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Subject
            </label>
            <select
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              disabled={loading}
              required
            >
              <option value="">Choose a subject...</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Textbook file
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md,.markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="mt-1 block w-full rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-3 text-sm text-neutral-700 file:mr-4 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-200 dark:file:bg-neutral-100 dark:file:text-neutral-900"
            disabled={loading}
            required
          />
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Accepted formats: PDF, DOCX, DOC, TXT, and Markdown. Large scanned PDFs may need OCR
            before upload.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr]">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Display title
            </label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Optional. We can reuse the file name."
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Version label
            </label>
            <input
              value={versionLabel}
              onChange={(event) => setVersionLabel(event.target.value)}
              placeholder="Optional"
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              disabled={loading}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {loading ? "Uploading..." : "Upload and prepare for AI"}
        </button>
      </form>
    </section>
  );
}

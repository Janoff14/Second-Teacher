"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CorpusSearchPanel } from "@/components/rag/CorpusSearchPanel";
import { TextbookIngestForm } from "@/components/rag/TextbookIngestForm";
import { listTextbookSources, type TextbookSource } from "@/lib/api/rag";

function formatDate(value: string | null | undefined) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatSourceFormat(value: TextbookSource["sourceFormat"]) {
  switch (value) {
    case "pdf":
      return "PDF";
    case "docx":
      return "DOCX";
    case "doc":
      return "DOC";
    case "txt":
      return "TXT";
    default:
      return "File";
  }
}

export function TeacherMaterialsPanel({
  subjectId,
  subjectName,
  groupId,
}: {
  subjectId: string;
  subjectName: string;
  groupId?: string;
}) {
  const [sources, setSources] = useState<TextbookSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    if (!subjectId.trim()) {
      setSources([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const res = await listTextbookSources(subjectId.trim());
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setSources([]);
      return;
    }

    setSources(Array.isArray(res.data) ? res.data : []);
  }, [subjectId]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const emptyState = useMemo(
    () => (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
        Upload the first textbook for {subjectName}. Once it finishes, students and AI tools can
        use it right away.
      </div>
    ),
    [subjectName],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <TextbookIngestForm
          fixedSubjectId={subjectId}
          fixedSubjectName={subjectName}
          onUploaded={() => loadSources()}
        />

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                Uploaded textbooks
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                These books are shared across every class inside {subjectName}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadSources()}
              className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              Refresh list
            </button>
          </div>

          {error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Loading books...</p>
          ) : sources.length === 0 ? (
            <div className="mt-4">{emptyState}</div>
          ) : (
            <ul className="mt-4 space-y-3">
              {sources.map((source) => (
                <li
                  key={source.id}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                        {source.title}
                      </p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        Version {source.versionLabel}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {formatSourceFormat(source.sourceFormat)}
                        {source.originalFileName ? ` - ${source.originalFileName}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                      Ready for AI
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Uploaded {formatDate(source.createdAt)}
                    </p>
                    {groupId ? (
                      <Link
                        href={`/reader/textbooks/${encodeURIComponent(source.id)}?groupId=${encodeURIComponent(groupId)}`}
                        className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Open in reader
                      </Link>
                    ) : (
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        Open from a class to preview in the reader.
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {groupId ? (
        <CorpusSearchPanel
          fixedGroupId={groupId}
          title="Check what the AI can cite"
          description="Use the same class context your students will use. Search a concept, then open the exact passage in the reader."
        />
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Search uploaded materials
          </h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Open a specific class workspace when you want to test search results inside the same
            context students use.
          </p>
        </div>
      )}
    </div>
  );
}

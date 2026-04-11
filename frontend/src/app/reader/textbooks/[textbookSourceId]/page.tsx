"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getReaderDocument, type ReaderDocumentResponse } from "@/lib/api/rag";
import { useAuthStore } from "@/stores/auth-store";

function highlightParagraph(
  paragraph: ReaderDocumentResponse["paragraphs"][number],
  focus: ReaderDocumentResponse["focus"],
) {
  if (!focus || focus.paragraphId !== paragraph.id) {
    return paragraph.text;
  }
  const start = Math.max((focus.sentenceStart ?? 1) - 1, 0);
  const end = Math.max(focus.sentenceEnd ?? paragraph.sentences.length, start + 1);
  return paragraph.sentences.map((sentence, index) => ({
    sentence,
    highlighted: index >= start && index < end,
  }));
}

export default function ReaderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const activeGroupId = useAuthStore((state) => state.activeGroupId);
  const textbookSourceId = decodeURIComponent(params.textbookSourceId as string);
  const groupId = searchParams.get("groupId") ?? activeGroupId ?? "";
  const paragraphId = searchParams.get("paragraphId") ?? undefined;
  const sentenceStart = searchParams.get("sentenceStart");
  const sentenceEnd = searchParams.get("sentenceEnd");

  const [document, setDocument] = useState<ReaderDocumentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!groupId) {
        setLoading(false);
        setError("Open the reader from a subject workspace so the correct group context is known.");
        return;
      }
      setLoading(true);
      setError(null);
      const result = await getReaderDocument({
        textbookSourceId,
        groupId,
        ...(paragraphId ? { paragraphId } : {}),
        ...(sentenceStart ? { sentenceStart: Number(sentenceStart) } : {}),
        ...(sentenceEnd ? { sentenceEnd: Number(sentenceEnd) } : {}),
      });
      if (!alive) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error.message);
        setDocument(null);
        return;
      }
      setDocument(result.data);
    }
    void load();
    return () => {
      alive = false;
    };
  }, [groupId, textbookSourceId, paragraphId, sentenceStart, sentenceEnd]);

  const backHref = useMemo(
    () => (groupId ? `/student/subjects/${groupId}` : "/student"),
    [groupId],
  );

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading textbook reader...</p>;
  }

  if (!document) {
    return (
      <div className="space-y-4">
        <Link
          href={backHref}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Back
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error ?? "Reader data is unavailable."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <Link
          href={backHref}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Back to subject workspace
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
              Reader
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
              {document.source.title}
            </h1>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Version {document.source.versionLabel}
            </p>
          </div>
          {document.focus ? (
            <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
              Focused on {document.focus.chapterTitle}, page {document.focus.pageNumber}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <aside className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Chapters
          </h2>
          <ul className="mt-4 space-y-3">
            {document.chapters.map((chapter) => (
              <li
                key={chapter.chapterNumber}
                className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/50"
              >
                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                  {chapter.title}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Pages {chapter.startPage}-{chapter.endPage}
                </p>
              </li>
            ))}
          </ul>
        </aside>

        <section className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="space-y-4">
            {document.paragraphs.map((paragraph) => {
              const highlighted = highlightParagraph(paragraph, document.focus);
              const isFocused = document.focus?.paragraphId === paragraph.id;
              return (
                <article
                  key={paragraph.id}
                  className={
                    isFocused
                      ? "rounded-2xl border border-blue-300 bg-blue-50/80 px-4 py-4 shadow-sm dark:border-blue-800 dark:bg-blue-950/20"
                      : "rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900/50"
                  }
                >
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide text-neutral-500">
                    <span>{paragraph.chapterTitle}</span>
                    <span>Page {paragraph.pageNumber}</span>
                  </div>
                  {typeof highlighted === "string" ? (
                    <p className="text-sm leading-7 text-neutral-800 dark:text-neutral-200">
                      {highlighted}
                    </p>
                  ) : (
                    <p className="text-sm leading-7 text-neutral-800 dark:text-neutral-200">
                      {highlighted.map((segment, index) =>
                        segment.highlighted ? (
                          <mark
                            key={`${paragraph.id}-${index}`}
                            className="rounded bg-amber-200 px-1 py-0.5 text-neutral-900 dark:bg-amber-500/40 dark:text-neutral-50"
                          >
                            {segment.sentence}{" "}
                          </mark>
                        ) : (
                          <span key={`${paragraph.id}-${index}`}>{segment.sentence} </span>
                        ),
                      )}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

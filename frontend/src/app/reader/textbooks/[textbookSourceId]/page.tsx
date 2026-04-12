"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getReaderDocument,
  getReaderDocumentAsset,
  type ReaderDocumentResponse,
} from "@/lib/api/rag";
import { useAuthStore, type UserRole } from "@/stores/auth-store";

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

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

function resolveBackHref(role: UserRole | null, groupId: string) {
  if (role === "teacher") {
    return groupId ? `/teacher/groups/${encodeURIComponent(groupId)}` : "/teacher";
  }
  if (role === "admin") {
    return "/teacher";
  }
  return groupId ? `/student/subjects/${encodeURIComponent(groupId)}` : "/student";
}

function formatSourceFormat(value: ReaderDocumentResponse["source"]["sourceFormat"]) {
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
      return "Document";
  }
}

function getChapterForPage(
  chapters: ReaderDocumentResponse["chapters"],
  pageNumber: number,
) {
  for (const chapter of chapters) {
    if (pageNumber >= chapter.startPage && pageNumber <= chapter.endPage) {
      return chapter;
    }
  }
  return chapters[0] ?? null;
}

function TextFallbackSection({
  document,
  reason,
  selectedPage,
}: {
  document: ReaderDocumentResponse;
  reason: "missing-asset" | "asset-error";
  selectedPage: number;
}) {
  const activeChapter = getChapterForPage(document.chapters, selectedPage);
  const visibleParagraphs = activeChapter
    ? document.paragraphs.filter(
        (paragraph) => paragraph.chapterNumber === activeChapter.chapterNumber,
      )
    : document.paragraphs;

  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Text fallback
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {reason === "missing-asset"
              ? "This upload was indexed before the original file was stored for preview, so the reader is showing extracted text for the selected chapter only."
              : "The original file could not be loaded right now, so the reader is temporarily showing extracted text for the selected chapter only."}
          </p>
        </div>
        {activeChapter ? (
          <div className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
            {activeChapter.title}
          </div>
        ) : null}
      </div>

      <div className="mt-5 space-y-4">
        {visibleParagraphs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
            No extracted paragraphs are available for this chapter.
          </div>
        ) : (
          visibleParagraphs.map((paragraph) => {
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
          })
        )}
      </div>
    </section>
  );
}

export default function ReaderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const role = useAuthStore((state) => state.role);
  const activeGroupId = useAuthStore((state) => state.activeGroupId);
  const textbookSourceId = decodeURIComponent(params.textbookSourceId as string);
  const groupId = searchParams.get("groupId") ?? activeGroupId ?? "";
  const paragraphId = searchParams.get("paragraphId") ?? undefined;
  const sentenceStart = searchParams.get("sentenceStart");
  const sentenceEnd = searchParams.get("sentenceEnd");

  const [document, setDocument] = useState<ReaderDocumentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState(1);

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

  useEffect(() => {
    if (!document) return;
    const initialPage = document.focus?.pageNumber ?? document.chapters[0]?.startPage ?? 1;
    setSelectedPage(clampPage(initialPage, document.totalPages));
  }, [document]);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;

    async function loadAsset() {
      setAssetUrl(null);
      setAssetError(null);

      if (!document?.asset.available) {
        setAssetLoading(false);
        return;
      }

      setAssetLoading(true);
      const result = await getReaderDocumentAsset({
        textbookSourceId,
        groupId,
      });
      if (!alive) return;

      setAssetLoading(false);
      if (!result.ok) {
        setAssetError(result.error.message);
        return;
      }

      objectUrl = URL.createObjectURL(result.data);
      setAssetUrl(objectUrl);
    }

    if (groupId && document) {
      void loadAsset();
    }

    return () => {
      alive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [document, groupId, textbookSourceId]);

  const backHref = useMemo(() => resolveBackHref(role, groupId), [role, groupId]);
  const isPdf = Boolean(
    document?.asset.available &&
      (document.source.sourceFormat === "pdf" ||
        (document.asset.available && document.asset.mimeType === "application/pdf")),
  );
  const activeChapter = useMemo(
    () => (document ? getChapterForPage(document.chapters, selectedPage) : null),
    [document, selectedPage],
  );
  const viewerSrc = useMemo(() => {
    if (!assetUrl) return null;
    if (!isPdf) return assetUrl;
    return `${assetUrl}#page=${selectedPage}&view=FitH`;
  }, [assetUrl, isPdf, selectedPage]);
  const showTextFallback = Boolean(document && (!document.asset.available || assetError));

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
          Back to workspace
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
              {document.source.originalFileName
                ? ` | ${document.source.originalFileName}`
                : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
              {formatSourceFormat(document.source.sourceFormat)}
            </div>
            <div className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
              {document.totalPages} {document.totalPages === 1 ? "page" : "pages"}
            </div>
            {document.focus ? (
              <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                Focused on {document.focus.chapterTitle}, page {document.focus.pageNumber}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Chapters
          </h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Jump straight to the chapter start instead of reading extracted text cards.
          </p>

          <ul className="mt-4 space-y-3">
            {document.chapters.map((chapter) => {
              const isActive = activeChapter?.chapterNumber === chapter.chapterNumber;
              return (
                <li key={chapter.chapterNumber}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPage(clampPage(chapter.startPage, document.totalPages))
                    }
                    className={
                      isActive
                        ? "w-full rounded-2xl border border-blue-400 bg-blue-50 px-4 py-4 text-left shadow-sm dark:border-blue-700 dark:bg-blue-950/30"
                        : "w-full rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-4 text-left transition hover:border-blue-300 hover:bg-blue-50/60 dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
                    }
                  >
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">
                      {chapter.title}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Pages {chapter.startPage}-{chapter.endPage}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="space-y-6">
          <section className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                  Document view
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  The original upload is embedded directly. Chapter buttons jump to the selected
                  page in PDFs and still keep the same chapter guide for older fallback uploads.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isPdf ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPage((page) => clampPage(page - 1, document.totalPages))
                      }
                      disabled={selectedPage <= 1}
                      className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                    >
                      Previous page
                    </button>
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                      Page {selectedPage} of {document.totalPages}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPage((page) => clampPage(page + 1, document.totalPages))
                      }
                      disabled={selectedPage >= document.totalPages}
                      className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                    >
                      Next page
                    </button>
                  </>
                ) : null}

                {viewerSrc ? (
                  <a
                    href={viewerSrc}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                  >
                    Open in new tab
                  </a>
                ) : null}
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900">
              {assetLoading ? (
                <div className="flex min-h-[72vh] items-center justify-center px-6 text-sm text-neutral-500 dark:text-neutral-400">
                  Preparing the original document viewer...
                </div>
              ) : viewerSrc ? (
                <iframe
                  title={document.source.title}
                  src={viewerSrc}
                  className="min-h-[72vh] w-full bg-white"
                />
              ) : (
                <div className="flex min-h-[72vh] items-center justify-center px-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  {document.asset.available
                    ? assetError ?? "The original document could not be loaded."
                    : "This textbook was indexed before the original file was stored for reader preview."}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-3 text-sm text-neutral-600 dark:text-neutral-400">
              <p>
                {isPdf
                  ? "PDF chapter jumps use the page numbers discovered during ingestion."
                  : "PDF files support direct chapter jumps best. Other file types open natively when the browser can preview them."}
              </p>
              {activeChapter ? (
                <p className="font-medium text-neutral-700 dark:text-neutral-200">
                  Current chapter: {activeChapter.title}
                </p>
              ) : null}
            </div>
          </section>

          {showTextFallback ? (
            <TextFallbackSection
              document={document}
              reason={document.asset.available ? "asset-error" : "missing-asset"}
              selectedPage={selectedPage}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

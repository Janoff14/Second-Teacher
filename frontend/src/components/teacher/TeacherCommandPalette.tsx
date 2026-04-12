"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  teacherBriefingQuery,
  type BriefingQueryCard,
  type PageContext,
  type TeacherBriefingQueryResult,
} from "@/lib/api/agent";
import { getTeacherAiBriefing } from "@/lib/api/assessments";

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

function CardBlock({ card }: { card: BriefingQueryCard }) {
  switch (card.kind) {
    case "note":
      return (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900/50">
          {card.title ? (
            <p className="font-semibold text-neutral-900 dark:text-neutral-100">{card.title}</p>
          ) : null}
          <p className="mt-1 whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">{card.body}</p>
        </div>
      );
    case "insight_row":
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-950/30">
          <p className="font-medium text-amber-950 dark:text-amber-100">{card.title}</p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">Student {card.studentId}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-amber-800 dark:text-amber-200">
            {card.riskLevel.replace(/_/g, " ")}
          </p>
          <ul className="mt-2 list-inside list-disc text-xs text-neutral-700 dark:text-neutral-300">
            {card.factors.slice(0, 5).map((f) => (
              <li key={f.slice(0, 48)}>{f}</li>
            ))}
          </ul>
        </div>
      );
    case "corpus_row":
      return (
        <div className="rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 text-sm dark:border-blue-900/40 dark:bg-blue-950/30">
          <p className="font-mono text-xs text-blue-900 dark:text-blue-200">{card.anchor}</p>
          <p className="mt-1 text-neutral-800 dark:text-neutral-200">{card.excerpt}</p>
        </div>
      );
    case "pattern":
      return (
        <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-2 text-sm dark:border-violet-900/40 dark:bg-violet-950/30">
          <p className="font-medium text-violet-950 dark:text-violet-100">{card.description}</p>
          <p className="mt-1 text-xs text-violet-900/90 dark:text-violet-200/90">
            {card.suggestedAction} ({card.studentCount} students)
          </p>
        </div>
      );
    default:
      return null;
  }
}

export function TeacherCommandPalette({
  groupId,
  open,
  onClose,
  pageContext,
}: {
  groupId: string | null;
  open: boolean;
  onClose: () => void;
  pageContext?: PageContext;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TeacherBriefingQueryResult | null>(null);
  const [attentionHint, setAttentionHint] = useState<number | null>(null);

  const loadHint = useCallback(async () => {
    if (!groupId) {
      setAttentionHint(null);
      return;
    }
    const res = await getTeacherAiBriefing(groupId, false);
    if (res.ok && res.data) {
      setAttentionHint(res.data.attentionNeeded);
    }
  }, [groupId]);

  useEffect(() => {
    if (!open) return;
    void loadHint();
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, loadHint]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit() {
    const text = query.trim();
    if (!text || !groupId) {
      setError(groupId ? "Enter a question." : "Open a class page to use the assistant.");
      return;
    }
    setSending(true);
    setError(null);
    const res = await teacherBriefingQuery({ message: text, groupId, pageContext });
    setSending(false);
    if (!res.ok) {
      setError(res.error.message);
      setResult(null);
      return;
    }
    setResult(res.data ?? null);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-16 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[min(85vh,720px)] w-full max-w-xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
        <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h2 id={titleId} className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
            Class assistant
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Structured answers from insights and materials — not a generic chat stream.
            {attentionHint != null && attentionHint > 0
              ? ` ${attentionHint} student(s) in the briefing queue.`
              : null}
          </p>
        </div>

        <div className="max-h-[calc(min(85vh,720px)-7rem)] overflow-y-auto px-4 py-3">
          <ErrorBox message={error} />

          {result?.cards?.length ? (
            <div className="mb-4 space-y-2">
              {result.cards.map((card, i) => (
                <CardBlock key={`${card.kind}-${i}`} card={card} />
              ))}
            </div>
          ) : null}

          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Your question
            <textarea
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              disabled={sending || !groupId}
              placeholder={
                groupId
                  ? "e.g. Who should I check on first? What should we review from the book?"
                  : "Open a class, then try again."
              }
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={sending || !groupId}
              onClick={() => void submit()}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {sending ? "Working…" : "Ask"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

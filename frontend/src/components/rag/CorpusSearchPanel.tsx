"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listGroups, listSubjects } from "@/lib/api/academic";
import type { Group, Subject } from "@/lib/api/academic";
import { normalizeQueryHits, pickCitation, pickSnippet, queryCorpus } from "@/lib/api/rag";
import { useAuthStore } from "@/stores/auth-store";

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

type CorpusSearchPanelProps = {
  showGroupSelectors?: boolean;
  storeGroupId?: boolean;
  syncQuery?: { q: string; token: number };
  alignGroupId?: string;
  fixedGroupId?: string;
  title?: string;
  description?: string;
};

function readCitationObject(hit: Record<string, unknown>): Record<string, unknown> | null {
  const citation = hit.citation;
  if (!citation || typeof citation !== "object" || Array.isArray(citation)) {
    return null;
  }
  return citation as Record<string, unknown>;
}

function pickReaderHref(hit: Record<string, unknown>, groupId: string): string | null {
  const citation = readCitationObject(hit);
  const readerPath = typeof citation?.readerPath === "string" ? citation.readerPath : null;
  if (!readerPath || !groupId.trim()) return null;
  const separator = readerPath.includes("?") ? "&" : "?";
  return `${readerPath}${separator}groupId=${encodeURIComponent(groupId.trim())}`;
}

function pickLocationSummary(hit: Record<string, unknown>): string | null {
  const citation = readCitationObject(hit);
  const location =
    citation?.textbookLocation &&
    typeof citation.textbookLocation === "object" &&
    !Array.isArray(citation.textbookLocation)
      ? (citation.textbookLocation as Record<string, unknown>)
      : null;
  if (!location) return null;

  const chapterNumber =
    typeof location.chapterNumber === "number" ? `Chapter ${location.chapterNumber}` : null;
  const chapterTitle = typeof location.chapterTitle === "string" ? location.chapterTitle : null;
  const pageNumber = typeof location.pageNumber === "number" ? `Page ${location.pageNumber}` : null;
  return [chapterNumber, chapterTitle, pageNumber].filter(Boolean).join(" - ") || null;
}

function formatScore(hit: Record<string, unknown>) {
  const value = hit.score;
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return `${Math.round(value * 100)}% match`;
}

export function CorpusSearchPanel({
  showGroupSelectors = false,
  storeGroupId = false,
  syncQuery,
  alignGroupId,
  fixedGroupId,
  title = "Search uploaded materials",
  description = "Ask a question about the uploaded textbook and open the exact passage in the reader.",
}: CorpusSearchPanelProps) {
  const activeGroupId = useAuthStore((state) => state.activeGroupId);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState(fixedGroupId?.trim() ?? "");
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<Record<string, unknown>[]>([]);

  const selectorsVisible = showGroupSelectors && !fixedGroupId?.trim();
  const groupLocked = Boolean(fixedGroupId?.trim());

  const loadSubjects = useCallback(async () => {
    if (!selectorsVisible) return;
    const res = await listSubjects();
    if (!res.ok) return;
    setSubjects(Array.isArray(res.data) ? res.data : []);
  }, [selectorsVisible]);

  const loadGroups = useCallback(async (nextSubjectId: string) => {
    if (!selectorsVisible || !nextSubjectId.trim()) {
      setGroups([]);
      return;
    }
    const res = await listGroups(nextSubjectId.trim());
    if (!res.ok) return;
    setGroups(Array.isArray(res.data) ? res.data : []);
  }, [selectorsVisible]);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  useEffect(() => {
    if (!selectorsVisible) return;
    void loadGroups(subjectId);
    if (!subjectId.trim()) {
      setGroupId("");
    }
  }, [loadGroups, selectorsVisible, subjectId]);

  useEffect(() => {
    if (groupLocked && fixedGroupId?.trim()) {
      setGroupId(fixedGroupId.trim());
    }
  }, [fixedGroupId, groupLocked]);

  useEffect(() => {
    if (storeGroupId && activeGroupId && !selectorsVisible && !groupLocked) {
      setGroupId(activeGroupId);
    }
  }, [activeGroupId, groupLocked, selectorsVisible, storeGroupId]);

  useEffect(() => {
    if (syncQuery?.q !== undefined && syncQuery.token > 0) {
      setQuery(syncQuery.q);
    }
  }, [syncQuery?.q, syncQuery?.token]);

  useEffect(() => {
    if (!alignGroupId?.trim() || selectorsVisible || groupLocked) return;
    if (alignGroupId.trim() !== groupId) {
      setGroupId(alignGroupId.trim());
    }
  }, [alignGroupId, groupId, groupLocked, selectorsVisible]);

  const effectiveGroupId = useMemo(() => {
    if (groupLocked && fixedGroupId?.trim()) return fixedGroupId.trim();
    if (selectorsVisible) return groupId.trim();
    if (groupId.trim()) return groupId.trim();
    return storeGroupId ? (activeGroupId ?? "").trim() : "";
  }, [activeGroupId, fixedGroupId, groupId, groupLocked, selectorsVisible, storeGroupId]);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!effectiveGroupId || !query.trim()) {
      setError("Choose the class context and enter a question first.");
      return;
    }

    setLoading(true);
    setError(null);
    const res = await queryCorpus({
      query: query.trim(),
      groupId: effectiveGroupId,
      topK: Number.isFinite(topK) ? topK : 6,
    });
    setLoading(false);

    if (!res.ok) {
      setHits([]);
      setError(res.error.message);
      return;
    }

    setHits(normalizeQueryHits(res.data));
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{title}</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
      </div>

      <ErrorBox message={error} />

      <form onSubmit={handleSearch} className="mt-5 space-y-4">
        {selectorsVisible ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Subject
              </label>
              <select
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                disabled={loading}
              >
                <option value="">Choose a subject...</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Class
              </label>
              <select
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                disabled={loading || !subjectId.trim()}
              >
                <option value="">Choose a class...</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        {storeGroupId && !selectorsVisible && !groupLocked ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/40">
            <p className="text-neutral-500 dark:text-neutral-400">Current class</p>
            <p className="mt-1 font-mono text-xs text-neutral-700 dark:text-neutral-200">
              {effectiveGroupId || "Join a class to unlock materials search."}
            </p>
          </div>
        ) : null}

        {groupLocked ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/40">
            <p className="text-neutral-500 dark:text-neutral-400">Class context</p>
            <p className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">
              Results will use this class only.
            </p>
          </div>
        ) : null}

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Question
          </label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
            disabled={loading}
            placeholder="Example: Which pages explain Newton's second law?"
            required
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Results to show
            </label>
            <input
              type="number"
              min={1}
              max={12}
              value={topK}
              onChange={(event) => setTopK(Number(event.target.value))}
              className="mt-1 w-24 rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {loading ? "Searching..." : "Search materials"}
          </button>
        </div>
      </form>

      {hits.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {hits.map((hit, index) => {
            const snippet = pickSnippet(hit);
            const citation = pickCitation(hit);
            const locationSummary = pickLocationSummary(hit);
            const readerHref = pickReaderHref(hit, effectiveGroupId);
            const score = formatScore(hit);

            return (
              <li
                key={`${citation ?? "hit"}-${index}`}
                className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    {locationSummary ? (
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {locationSummary}
                      </p>
                    ) : null}
                    {citation ? (
                      <p className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                        {citation}
                      </p>
                    ) : null}
                  </div>
                  {score ? (
                    <span className="rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                      {score}
                    </span>
                  ) : null}
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-800 dark:text-neutral-200">
                  {snippet || "No preview text was returned for this result."}
                </p>

                {readerHref ? (
                  <div className="mt-3">
                    <Link
                      href={readerHref}
                      className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Open exact passage in reader
                    </Link>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

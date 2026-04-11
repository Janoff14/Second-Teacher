"use client";

import { useCallback, useEffect, useState } from "react";
import { listGroups, listSubjects } from "@/lib/api/academic";
import type { Group, Subject } from "@/lib/api/academic";
import {
  normalizeQueryHits,
  pickCitation,
  pickSnippet,
  queryCorpus,
} from "@/lib/api/rag";
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
  /** Load subject/group pickers (teacher flow). */
  showGroupSelectors?: boolean;
  /** Pre-fill group from enrollment (student). */
  storeGroupId?: boolean;
  /** When `token` changes, copy `q` into the query field (e.g. from agent chat). */
  syncQuery?: { q: string; token: number };
  /** Keep group selector aligned with agent chat (same corpus scope). */
  alignGroupId?: string;
};

export function CorpusSearchPanel({
  showGroupSelectors = false,
  storeGroupId = false,
  syncQuery,
  alignGroupId,
}: CorpusSearchPanelProps) {
  const activeGroupId = useAuthStore((s) => s.activeGroupId);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");

  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<Record<string, unknown>[]>([]);
  const [rawDebug, setRawDebug] = useState<string | null>(null);

  const loadSubjects = useCallback(async () => {
    const res = await listSubjects();
    if (!res.ok) return;
    const list = res.data ?? [];
    setSubjects(Array.isArray(list) ? list : []);
  }, []);

  const loadGroups = useCallback(async (sid: string) => {
    if (!sid) {
      setGroups([]);
      return;
    }
    const res = await listGroups(sid);
    if (!res.ok) return;
    const list = res.data ?? [];
    setGroups(Array.isArray(list) ? list : []);
  }, []);

  useEffect(() => {
    if (showGroupSelectors) void loadSubjects();
  }, [showGroupSelectors, loadSubjects]);

  useEffect(() => {
    if (showGroupSelectors) void loadGroups(subjectId);
    if (!subjectId) setGroupId("");
  }, [subjectId, showGroupSelectors, loadGroups]);

  useEffect(() => {
    if (storeGroupId && activeGroupId && !showGroupSelectors) {
      setGroupId(activeGroupId);
    }
  }, [storeGroupId, activeGroupId, showGroupSelectors]);

  useEffect(() => {
    if (syncQuery?.q !== undefined && syncQuery.token > 0) {
      setQuery(syncQuery.q);
    }
  }, [syncQuery?.token, syncQuery?.q]);

  useEffect(() => {
    if (
      alignGroupId !== undefined &&
      alignGroupId !== groupId &&
      alignGroupId !== ""
    ) {
      setGroupId(alignGroupId);
    }
  }, [alignGroupId, groupId]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    let effectiveGroupId = "";
    if (showGroupSelectors) {
      effectiveGroupId = groupId.trim();
    } else {
      effectiveGroupId =
        groupId.trim() || (storeGroupId ? (activeGroupId ?? "").trim() : "");
    }
    if (!effectiveGroupId || !query.trim()) {
      setError("Enter a query and group context.");
      return;
    }
    setLoading(true);
    setError(null);
    setRawDebug(null);
    const res = await queryCorpus({
      query: query.trim(),
      groupId: effectiveGroupId,
      topK: Number.isFinite(topK) ? topK : 8,
    });
    setLoading(false);
    if (!res.ok) {
      setHits([]);
      setError(res.error.message);
      return;
    }
    const normalized = normalizeQueryHits(res.data);
    setHits(normalized);
    if (normalized.length === 0 && res.data != null) {
      setRawDebug(JSON.stringify(res.data, null, 2));
    }
  }

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
        Corpus search
      </h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">
          POST /rag/query
        </code>
      </p>

      <ErrorBox message={error} />

      <form onSubmit={handleSearch} className="mt-4 space-y-4">
        {showGroupSelectors && (
          <>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Subject
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="mt-1 w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                disabled={loading}
              >
                <option value="">Select subject…</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Group (corpus scope)
              </label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="mt-1 w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                disabled={loading || !subjectId}
              >
                <option value="">Select group…</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {storeGroupId && !showGroupSelectors && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Group ID
            </label>
            <input
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              placeholder={activeGroupId ?? "Enroll to set group"}
              className="mt-1 w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-950"
              disabled={loading}
            />
            {!activeGroupId && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Join a class first so your group is known, or paste a group id
                manually.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Query
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
            disabled={loading}
            placeholder="Ask or search the textbook…"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            topK
          </label>
          <input
            type="number"
            min={1}
            max={50}
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="mt-1 w-28 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {hits.length > 0 && (
        <ul className="mt-6 space-y-3">
          {hits.map((hit, i) => {
            const snippet = pickSnippet(hit);
            const cite = pickCitation(hit);
            return (
              <li
                key={i}
                className="rounded-md border border-neutral-200 bg-neutral-50/80 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/40"
              >
                {cite && (
                  <p className="mb-1 font-mono text-xs text-neutral-500">
                    {cite}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
                  {snippet || (
                    <span className="text-neutral-500">
                      (No snippet field — see raw hit below)
                    </span>
                  )}
                </p>
                {!snippet && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-neutral-100 p-2 text-xs dark:bg-neutral-950">
                    {JSON.stringify(hit, null, 2)}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hits.length === 0 && rawDebug && (
        <pre className="mt-4 max-h-64 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-950">
          {rawDebug}
        </pre>
      )}
    </section>
  );
}

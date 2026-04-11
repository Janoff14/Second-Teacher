import { apiRequest } from "./client";

export type TextbookIngestBody = {
  subjectId: string;
  title: string;
  versionLabel: string;
  text: string;
};

export type RagQueryBody = {
  query: string;
  groupId: string;
  topK?: number;
};

export async function ingestTextbook(body: TextbookIngestBody) {
  return apiRequest<unknown>("/rag/sources/textbooks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function queryCorpus(body: RagQueryBody) {
  return apiRequest<unknown>("/rag/query", {
    method: "POST",
    body: JSON.stringify({
      query: body.query,
      groupId: body.groupId,
      ...(body.topK !== undefined ? { topK: body.topK } : {}),
    }),
  });
}

/** Normalize various API shapes to a list of hit objects for rendering. */
export function normalizeQueryHits(data: unknown): Record<string, unknown>[] {
  if (data == null) return [];
  if (Array.isArray(data)) {
    return data.filter(
      (x): x is Record<string, unknown> =>
        typeof x === "object" && x !== null && !Array.isArray(x),
    );
  }
  if (typeof data === "object") {
    const d = data as Record<string, unknown>;
    const arr =
      (Array.isArray(d.hits) && d.hits) ||
      (Array.isArray(d.results) && d.results) ||
      (Array.isArray(d.items) && d.items) ||
      (Array.isArray(d.matches) && d.matches);
    if (arr) {
      return arr.filter(
        (x): x is Record<string, unknown> =>
          typeof x === "object" && x !== null && !Array.isArray(x),
      );
    }
  }
  return [];
}

export function pickSnippet(hit: Record<string, unknown>): string {
  const keys = [
    "snippet",
    "text",
    "content",
    "chunk",
    "body",
    "excerpt",
  ] as const;
  for (const k of keys) {
    const v = hit[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

export function pickCitation(hit: Record<string, unknown>): string | null {
  const keys = [
    "citation",
    "citationLabel",
    "source",
    "sourceId",
    "ref",
    "id",
  ] as const;
  for (const k of keys) {
    const v = hit[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  const meta = hit.metadata ?? hit.meta;
  if (meta && typeof meta === "object" && meta !== null) {
    const m = meta as Record<string, unknown>;
    if (typeof m.page === "number") return `p.${m.page}`;
  }
  return null;
}

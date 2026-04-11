import { logger } from "../config/logger";
import { embedTexts, hasOpenAI, EMBEDDING_DIM } from "../lib/openai";
import type { AssessmentVersion } from "./assessmentStore";

export type ChunkSourceType = "textbook" | "assessment_version";

export type ChunkVisibility = "subject" | "group";

export interface TextbookSourceRecord {
  id: string;
  subjectId: string;
  title: string;
  versionLabel: string;
  createdBy: string;
  createdAt: string;
}

export interface CorpusChunk {
  id: string;
  sourceType: ChunkSourceType;
  textbookSourceId?: string;
  assessmentVersionId?: string;
  draftId?: string;
  subjectId: string;
  groupId?: string;
  visibility: ChunkVisibility;
  chunkIndex: number;
  text: string;
  embedding: number[];
  citationAnchor: string;
  active: boolean;
}

const textbookSources: TextbookSourceRecord[] = [];
const chunks: CorpusChunk[] = [];
let textbookSourceCounter = 1;
let chunkCounter = 1;

const PSEUDO_DIM = 48;

export function pseudoEmbed(text: string, dim = PSEUDO_DIM): number[] {
  const v = new Array(dim).fill(0);
  for (const word of text.toLowerCase().split(/\W+/)) {
    if (!word) {
      continue;
    }
    let h = 0;
    for (let i = 0; i < word.length; i++) {
      h = (h * 31 + word.charCodeAt(i)) | 0;
    }
    v[Math.abs(h) % dim] += 1;
  }
  const norm = Math.sqrt(v.reduce((s: number, x: number) => s + x * x, 0)) || 1;
  return v.map((x: number) => x / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let s = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    s += a[i]! * b[i]!;
  }
  return s;
}

function splitTextIntoChunks(text: string, maxLen = 480): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }
  const paragraphs = normalized.split(/\n\s*\n/);
  const parts: string[] = [];
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (trimmed.length <= maxLen) {
      parts.push(trimmed);
      continue;
    }
    for (let i = 0; i < trimmed.length; i += maxLen) {
      parts.push(trimmed.slice(i, i + maxLen));
    }
  }
  return parts.filter(Boolean);
}

/**
 * Embed an array of texts. Uses OpenAI when configured, otherwise falls back
 * to the deterministic pseudo-embedding (bag-of-words hash).
 */
async function embed(texts: string[]): Promise<number[][]> {
  if (hasOpenAI()) {
    try {
      return await embedTexts(texts);
    } catch (err) {
      logger.error({ err }, "openai_embed_failed_falling_back_to_pseudo");
    }
  }
  return texts.map((t) => pseudoEmbed(t));
}

async function runWithRetry<T>(label: string, attempts: number, fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      logger.warn({ err, attempt: i + 1, label }, "rag_ingest_retry");
    }
  }
  logger.error({ err: last, label }, "rag_ingest_failed");
  throw last;
}

export async function ingestTextbook(params: {
  subjectId: string;
  title: string;
  versionLabel: string;
  text: string;
  createdBy: string;
}): Promise<{ source: TextbookSourceRecord; chunksCreated: number }> {
  return runWithRetry("ingest_textbook", 3, () => ingestTextbookCore(params));
}

async function ingestTextbookCore(params: {
  subjectId: string;
  title: string;
  versionLabel: string;
  text: string;
  createdBy: string;
}): Promise<{ source: TextbookSourceRecord; chunksCreated: number }> {
  const now = new Date().toISOString();
  const source: TextbookSourceRecord = {
    id: `tbs_${textbookSourceCounter++}`,
    subjectId: params.subjectId,
    title: params.title,
    versionLabel: params.versionLabel,
    createdBy: params.createdBy,
    createdAt: now,
  };
  textbookSources.push(source);

  const pieces = splitTextIntoChunks(params.text);
  if (pieces.length === 0) {
    const err = new Error("No ingestible text after chunking") as Error & { statusCode?: number; code?: string };
    err.statusCode = 400;
    err.code = "EMPTY_SOURCE";
    throw err;
  }

  logger.info(
    { sourceId: source.id, pieces: pieces.length, useOpenAI: hasOpenAI() },
    "rag_embedding_chunks",
  );
  const embeddings = await embed(pieces);

  let created = 0;
  for (let i = 0; i < pieces.length; i++) {
    const text = pieces[i]!;
    const citationAnchor = `textbook:${source.id}:${params.versionLabel}#chunk:${i}`;
    chunks.push({
      id: `chk_${chunkCounter++}`,
      sourceType: "textbook",
      textbookSourceId: source.id,
      subjectId: params.subjectId,
      visibility: "subject",
      chunkIndex: i,
      text,
      embedding: embeddings[i]!,
      citationAnchor,
      active: true,
    });
    created += 1;
  }

  return { source, chunksCreated: created };
}

export function supersedeAssessmentChunksForDraft(draftId: string, keepVersionId: string): void {
  for (const c of chunks) {
    if (
      c.sourceType === "assessment_version" &&
      c.draftId === draftId &&
      c.assessmentVersionId !== keepVersionId
    ) {
      c.active = false;
    }
  }
}

export async function indexPublishedAssessmentVersion(
  version: AssessmentVersion,
  subjectId: string,
): Promise<number> {
  supersedeAssessmentChunksForDraft(version.draftId, version.id);

  const texts: string[] = [];
  version.items.forEach((item, idx) => {
    const optionLines = Object.entries(item.options)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    texts.push([`Item ${idx + 1}: ${item.stem}`, optionLines].join("\n"));
  });

  if (texts.length === 0) return 0;
  const embeddings = await embed(texts);

  let created = 0;
  version.items.forEach((item, idx) => {
    const citationAnchor = `assessment:${version.id}:item:${item.id}`;
    chunks.push({
      id: `chk_${chunkCounter++}`,
      sourceType: "assessment_version",
      assessmentVersionId: version.id,
      draftId: version.draftId,
      subjectId,
      groupId: version.groupId,
      visibility: "group",
      chunkIndex: idx,
      text: texts[idx]!,
      embedding: embeddings[idx]!,
      citationAnchor,
      active: true,
    });
    created += 1;
  });
  return created;
}

export interface RetrievalCitation {
  anchor: string;
  sourceType: ChunkSourceType;
  subjectId: string;
  chunkIndex: number;
  groupId?: string;
  assessmentVersionId?: string;
  textbookSourceId?: string;
}

export interface RetrievalHit {
  chunkId: string;
  text: string;
  score: number;
  citation: RetrievalCitation;
}

function canAccessChunk(chunk: CorpusChunk, groupId: string, subjectId: string): boolean {
  if (!chunk.active) {
    return false;
  }
  if (chunk.sourceType === "textbook") {
    return chunk.subjectId === subjectId && chunk.visibility === "subject";
  }
  if (chunk.sourceType === "assessment_version") {
    return chunk.groupId === groupId && chunk.visibility === "group";
  }
  return false;
}

export async function queryCorpus(params: {
  query: string;
  groupId: string;
  subjectId: string;
  topK: number;
}): Promise<RetrievalHit[]> {
  const { query, groupId, subjectId, topK } = params;
  const [qEmb] = await embed([query]);
  const scored: RetrievalHit[] = [];

  for (const chunk of chunks) {
    if (!canAccessChunk(chunk, groupId, subjectId)) {
      continue;
    }
    const score = cosineSimilarity(qEmb!, chunk.embedding);
    const citation: RetrievalCitation = {
      anchor: chunk.citationAnchor,
      sourceType: chunk.sourceType,
      subjectId: chunk.subjectId,
      chunkIndex: chunk.chunkIndex,
    };
    if (chunk.groupId !== undefined) {
      citation.groupId = chunk.groupId;
    }
    if (chunk.assessmentVersionId !== undefined) {
      citation.assessmentVersionId = chunk.assessmentVersionId;
    }
    if (chunk.textbookSourceId !== undefined) {
      citation.textbookSourceId = chunk.textbookSourceId;
    }
    scored.push({
      chunkId: chunk.id,
      text: chunk.text,
      score,
      citation,
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

export function resetRagStoreForTest(): void {
  textbookSources.length = 0;
  chunks.length = 0;
  textbookSourceCounter = 1;
  chunkCounter = 1;
}

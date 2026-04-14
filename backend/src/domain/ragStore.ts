import { randomUUID } from "node:crypto";
import { logger } from "../config/logger";
import { embedTexts, hasOpenAI, EMBEDDING_DIM } from "../lib/openai";
import { getSupabaseServiceRoleClient } from "../lib/supabase";
import { clearLocalTextbookAssetsForTest, saveTextbookAsset } from "../lib/textbookAssets";
import {
  buildTextbookReaderDocument,
  type TextbookChapterRecord,
  type TextbookParagraphRecord,
  type TextbookReaderDocument,
  type TextbookReaderSeed,
} from "../lib/textbookReader";
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
  originalFileName?: string;
  sourceFormat?: "pdf" | "docx" | "doc" | "txt";
}

export interface TextbookCitationLocation {
  chapterNumber: number;
  chapterTitle: string;
  pageNumber: number;
  paragraphId: string;
  sentenceStart: number;
  sentenceEnd: number;
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
  textbookLocation?: TextbookCitationLocation;
  readerPath?: string;
  highlightText?: string;
  active: boolean;
}

const textbookSources: TextbookSourceRecord[] = [];
const chunks: CorpusChunk[] = [];
const textbookReaderDocuments = new Map<string, TextbookReaderDocument>();
let textbookSourceCounter = 1;
let chunkCounter = 1;

function db() {
  return getSupabaseServiceRoleClient();
}

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

function createTextbookChunks(
  source: TextbookSourceRecord,
  doc: TextbookReaderDocument,
  maxLen = 480,
): Array<{ text: string; citationAnchor: string; location: TextbookCitationLocation; readerPath: string }> {
  const out: Array<{ text: string; citationAnchor: string; location: TextbookCitationLocation; readerPath: string }> = [];
  let globalChunkIndex = 0;

  for (const paragraph of doc.paragraphs) {
    const sentences = paragraph.sentences.length > 0 ? paragraph.sentences : [paragraph.text];
    let currentText = "";
    let startSentence = 1;
    let endSentence = 1;

    const flush = () => {
      if (!currentText.trim()) {
        return;
      }
      const location: TextbookCitationLocation = {
        chapterNumber: paragraph.chapterNumber,
        chapterTitle: paragraph.chapterTitle,
        pageNumber: paragraph.pageNumber,
        paragraphId: paragraph.id,
        sentenceStart: startSentence,
        sentenceEnd: endSentence,
      };
      const citationAnchor =
        `textbook:${source.id}:${source.versionLabel}` +
        `#chapter:${location.chapterNumber}:paragraph:${location.paragraphId}:sentence:${location.sentenceStart}-${location.sentenceEnd}:chunk:${globalChunkIndex}`;
      const readerPath =
        `/reader/textbooks/${source.id}` +
        `?paragraphId=${encodeURIComponent(location.paragraphId)}` +
        `&sentenceStart=${location.sentenceStart}` +
        `&sentenceEnd=${location.sentenceEnd}`;
      out.push({
        text: currentText.trim(),
        citationAnchor,
        location,
        readerPath,
      });
      globalChunkIndex += 1;
      currentText = "";
    };

    sentences.forEach((sentence, idx) => {
      const sentenceNo = idx + 1;
      const candidate = currentText ? `${currentText} ${sentence}` : sentence;
      if (candidate.length > maxLen && currentText) {
        flush();
        currentText = sentence;
        startSentence = sentenceNo;
        endSentence = sentenceNo;
      } else {
        currentText = candidate;
        endSentence = sentenceNo;
      }
    });
    flush();
  }

  return out;
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

/**
 * Load all textbook sources, reader docs, and chunks from Supabase into
 * in-memory arrays. Called once at startup. Returns the number of sources loaded.
 */
export async function loadTextbooksFromDb(): Promise<number> {
  const client = db();
  if (!client) return 0;

  const { data: sourceRows, error: srcErr } = await client
    .from("textbook_sources")
    .select("*");
  if (srcErr) {
    logger.error({ err: srcErr }, "supabase_load_textbook_sources_failed");
    return 0;
  }
  if (!sourceRows || sourceRows.length === 0) return 0;

  for (const row of sourceRows) {
    const record: TextbookSourceRecord = {
      id: row.id,
      subjectId: row.subject_id,
      title: row.title,
      versionLabel: row.version_label,
      createdBy: row.created_by,
      createdAt: row.created_at,
      ...(row.original_file_name ? { originalFileName: row.original_file_name } : {}),
      ...(row.source_format ? { sourceFormat: row.source_format } : {}),
    };
    textbookSources.push(record);

    const num = parseInt(record.id.replace("tbs_", ""), 10);
    if (!isNaN(num) && num >= textbookSourceCounter) {
      textbookSourceCounter = num + 1;
    }
  }

  const { data: readerRows, error: readerErr } = await client
    .from("textbook_reader_docs")
    .select("*");
  if (readerErr) {
    logger.error({ err: readerErr }, "supabase_load_textbook_reader_docs_failed");
  } else if (readerRows) {
    for (const row of readerRows) {
      const chapters = row.chapters as TextbookChapterRecord[];
      const paragraphs = row.paragraphs as TextbookParagraphRecord[];
      textbookReaderDocuments.set(row.source_id, {
        sourceId: row.source_id,
        chapters,
        paragraphs,
        totalPages:
          chapters.at(-1)?.endPage ??
          paragraphs.reduce((max, paragraph) => Math.max(max, paragraph.pageNumber), 1),
        chapterSource: "fallback",
      });
    }
  }

  const { data: chunkRows, error: chunkErr } = await client
    .from("textbook_chunks")
    .select("*");
  if (chunkErr) {
    logger.error({ err: chunkErr }, "supabase_load_textbook_chunks_failed");
  } else if (chunkRows) {
    for (const row of chunkRows) {
      const chunk: CorpusChunk = {
        id: row.id,
        sourceType: "textbook",
        textbookSourceId: row.textbook_source_id,
        subjectId: row.subject_id,
        visibility: "subject",
        chunkIndex: row.chunk_index,
        text: row.body,
        embedding: row.embedding as number[],
        citationAnchor: row.citation_anchor,
        active: row.active,
      };
      if (row.textbook_location != null) {
        chunk.textbookLocation = row.textbook_location as TextbookCitationLocation;
      }
      if (row.reader_path != null) {
        chunk.readerPath = row.reader_path;
      }
      if (row.highlight_text != null) {
        chunk.highlightText = row.highlight_text;
      }
      chunks.push(chunk);

      const num = parseInt(row.id.replace("chk_", ""), 10);
      if (!isNaN(num) && num >= chunkCounter) {
        chunkCounter = num + 1;
      }
    }
  }

  logger.info(
    { sources: sourceRows.length, readerDocs: readerRows?.length ?? 0, chunks: chunkRows?.length ?? 0 },
    "textbooks_loaded_from_supabase",
  );
  return sourceRows.length;
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
  originalFileName?: string;
  sourceFormat?: "pdf" | "docx" | "doc" | "txt";
  readerSeed?: TextbookReaderSeed;
  assetBuffer?: Buffer;
}): Promise<{ source: TextbookSourceRecord; chunksCreated: number }> {
  return runWithRetry("ingest_textbook", 3, () => ingestTextbookCore(params));
}

async function ingestTextbookCore(params: {
  subjectId: string;
  title: string;
  versionLabel: string;
  text: string;
  createdBy: string;
  originalFileName?: string;
  sourceFormat?: "pdf" | "docx" | "doc" | "txt";
  readerSeed?: TextbookReaderSeed;
  assetBuffer?: Buffer;
}): Promise<{ source: TextbookSourceRecord; chunksCreated: number }> {
  const client = db();
  const now = new Date().toISOString();
  const sourceId = client ? `tbs_${randomUUID()}` : `tbs_${textbookSourceCounter++}`;
  const source: TextbookSourceRecord = {
    id: sourceId,
    subjectId: params.subjectId,
    title: params.title,
    versionLabel: params.versionLabel,
    createdBy: params.createdBy,
    createdAt: now,
    ...(params.originalFileName ? { originalFileName: params.originalFileName } : {}),
    ...(params.sourceFormat ? { sourceFormat: params.sourceFormat } : {}),
  };
  if (params.assetBuffer) {
    await saveTextbookAsset({
      sourceId: source.id,
      buffer: params.assetBuffer,
      ...(params.originalFileName ? { originalFileName: params.originalFileName } : {}),
      ...(params.sourceFormat ? { sourceFormat: params.sourceFormat } : {}),
    });
  }
  textbookSources.push(source);

  const readerDoc = buildTextbookReaderDocument(source.id, params.text, params.readerSeed);
  textbookReaderDocuments.set(source.id, readerDoc);
  const pieces = createTextbookChunks(source, readerDoc);
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
  const embeddings = await embed(pieces.map((p) => p.text));

  const newChunks: CorpusChunk[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]!;
    const chunkId = client ? `chk_${randomUUID()}` : `chk_${chunkCounter++}`;
    const chunk: CorpusChunk = {
      id: chunkId,
      sourceType: "textbook",
      textbookSourceId: source.id,
      subjectId: params.subjectId,
      visibility: "subject",
      chunkIndex: i,
      text: piece.text,
      embedding: embeddings[i]!,
      citationAnchor: piece.citationAnchor,
      textbookLocation: piece.location,
      readerPath: piece.readerPath,
      highlightText: piece.text,
      active: true,
    };
    newChunks.push(chunk);
    chunks.push(chunk);
  }

  if (client) {
    const { error: srcErr } = await client.from("textbook_sources").insert({
      id: source.id,
      subject_id: source.subjectId,
      title: source.title,
      version_label: source.versionLabel,
      created_by: source.createdBy,
      created_at: source.createdAt,
      original_file_name: source.originalFileName ?? null,
      source_format: source.sourceFormat ?? null,
    });
    if (srcErr) {
      logger.error({ err: srcErr, sourceId: source.id }, "supabase_insert_textbook_source_failed");
    }

    const { error: readerErr } = await client.from("textbook_reader_docs").insert({
      source_id: source.id,
      chapters: readerDoc.chapters,
      paragraphs: readerDoc.paragraphs,
    });
    if (readerErr) {
      logger.error({ err: readerErr, sourceId: source.id }, "supabase_insert_textbook_reader_doc_failed");
    }

    const CHUNK_BATCH = 200;
    for (let i = 0; i < newChunks.length; i += CHUNK_BATCH) {
      const batch = newChunks.slice(i, i + CHUNK_BATCH).map((c) => ({
        id: c.id,
        textbook_source_id: c.textbookSourceId!,
        subject_id: c.subjectId,
        chunk_index: c.chunkIndex,
        body: c.text,
        embedding: c.embedding,
        citation_anchor: c.citationAnchor,
        textbook_location: c.textbookLocation ?? null,
        reader_path: c.readerPath ?? null,
        highlight_text: c.highlightText ?? null,
        active: c.active,
      }));
      const { error: chunkErr } = await client.from("textbook_chunks").insert(batch);
      if (chunkErr) {
        logger.error({ err: chunkErr, sourceId: source.id, batch: i }, "supabase_insert_textbook_chunks_failed");
      }
    }

    logger.info({ sourceId: source.id, chunks: newChunks.length }, "textbook_persisted_to_supabase");
  }

  return { source, chunksCreated: newChunks.length };
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
  textbookLocation?: TextbookCitationLocation;
  readerPath?: string;
  highlightText?: string;
}

export interface RetrievalHit {
  chunkId: string;
  text: string;
  score: number;
  citation: RetrievalCitation;
}

export function listTextbookRetrievalHits(params: {
  subjectId: string;
  textbookSourceId: string;
}): RetrievalHit[] {
  const out: RetrievalHit[] = [];
  for (const chunk of chunks) {
    if (!chunk.active) continue;
    if (chunk.sourceType !== "textbook") continue;
    if (chunk.subjectId !== params.subjectId) continue;
    if (chunk.textbookSourceId !== params.textbookSourceId) continue;
    const citation: RetrievalCitation = {
      anchor: chunk.citationAnchor,
      sourceType: chunk.sourceType,
      subjectId: chunk.subjectId,
      chunkIndex: chunk.chunkIndex,
      ...(chunk.textbookSourceId !== undefined ? { textbookSourceId: chunk.textbookSourceId } : {}),
      ...(chunk.textbookLocation !== undefined ? { textbookLocation: chunk.textbookLocation } : {}),
      ...(chunk.readerPath !== undefined ? { readerPath: chunk.readerPath } : {}),
      ...(chunk.highlightText !== undefined ? { highlightText: chunk.highlightText } : {}),
    };
    out.push({
      chunkId: chunk.id,
      text: chunk.text,
      score: 0,
      citation,
    });
  }
  return out.sort((a, b) => a.citation.chunkIndex - b.citation.chunkIndex);
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
  minScore?: number;
}): Promise<RetrievalHit[]> {
  const { query, groupId, subjectId, topK, minScore } = params;
  const [qEmb] = await embed([query]);
  const scored: RetrievalHit[] = [];

  for (const chunk of chunks) {
    if (!canAccessChunk(chunk, groupId, subjectId)) {
      continue;
    }
    const score = cosineSimilarity(qEmb!, chunk.embedding);
    if (minScore !== undefined && score < minScore) continue;
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
    if (chunk.textbookLocation !== undefined) {
      citation.textbookLocation = chunk.textbookLocation;
    }
    if (chunk.readerPath !== undefined) {
      citation.readerPath = chunk.readerPath;
    }
    if (chunk.highlightText !== undefined) {
      citation.highlightText = chunk.highlightText;
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
  textbookReaderDocuments.clear();
  textbookSourceCounter = 1;
  chunkCounter = 1;
  clearLocalTextbookAssetsForTest();
}

export function getTextbookSourceById(textbookSourceId: string): TextbookSourceRecord | undefined {
  return textbookSources.find((s) => s.id === textbookSourceId);
}

export function listTextbookSourcesForSubject(subjectId: string): TextbookSourceRecord[] {
  return textbookSources
    .filter((s) => s.subjectId === subjectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getTextbookReaderDocument(textbookSourceId: string): TextbookReaderDocument | undefined {
  return textbookReaderDocuments.get(textbookSourceId);
}

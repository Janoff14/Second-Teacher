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

interface TextbookParagraphRecord {
  id: string;
  chapterNumber: number;
  chapterTitle: string;
  paragraphIndexInChapter: number;
  pageNumber: number;
  text: string;
  sentences: string[];
}

interface TextbookChapterRecord {
  chapterNumber: number;
  title: string;
  startPage: number;
  endPage: number;
  paragraphIds: string[];
}

interface TextbookReaderDocument {
  sourceId: string;
  chapters: TextbookChapterRecord[];
  paragraphs: TextbookParagraphRecord[];
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

function isChapterHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  return /^#{1,6}\s+\S/.test(trimmed) || /^chapter\s+\d+([:\s-].*)?$/i.test(trimmed);
}

function cleanChapterHeading(line: string): string {
  const trimmed = line.trim();
  if (/^#{1,6}\s+\S/.test(trimmed)) {
    return trimmed.replace(/^#{1,6}\s+/, "");
  }
  return trimmed;
}

function splitChapterBlocks(text: string): Array<{ title: string; body: string }> {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }
  const lines = normalized.split("\n");
  const blocks: Array<{ title: string; body: string }> = [];
  let currentTitle = "Chapter 1";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (isChapterHeading(line)) {
      if (currentLines.join("\n").trim()) {
        blocks.push({ title: currentTitle, body: currentLines.join("\n").trim() });
      }
      currentTitle = cleanChapterHeading(line);
      currentLines = [];
      continue;
    }
    currentLines.push(line);
  }

  if (currentLines.join("\n").trim()) {
    blocks.push({ title: currentTitle, body: currentLines.join("\n").trim() });
  }

  if (blocks.length === 0) {
    return [{ title: "Chapter 1", body: normalized }];
  }

  return blocks.map((block, idx) => {
    if (block.title === "Chapter 1" && idx > 0) {
      return { ...block, title: `Chapter ${idx + 1}` };
    }
    return block;
  });
}

function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]?/g) ?? [];
  const sentences = matches.map((s) => s.trim()).filter(Boolean);
  if (sentences.length === 0 && text.trim()) {
    return [text.trim()];
  }
  return sentences;
}

function buildTextbookReaderDocument(sourceId: string, rawText: string): TextbookReaderDocument {
  const chapterBlocks = splitChapterBlocks(rawText);
  const paragraphs: TextbookParagraphRecord[] = [];
  const chapters: TextbookChapterRecord[] = [];
  const PAGE_CHAR_BUDGET = 1800;
  let consumedChars = 0;

  chapterBlocks.forEach((block, chapterIndex) => {
    const chapterNumber = chapterIndex + 1;
    const chapterParagraphIds: string[] = [];
    const chapterParagraphs = block.body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    const chapterStartPage = Math.floor(consumedChars / PAGE_CHAR_BUDGET) + 1;
    chapterParagraphs.forEach((paragraphText, paragraphIndex) => {
      const paragraphId = `tbp_${sourceId}_${chapterNumber}_${paragraphIndex + 1}`;
      const pageNumber = Math.floor(consumedChars / PAGE_CHAR_BUDGET) + 1;
      paragraphs.push({
        id: paragraphId,
        chapterNumber,
        chapterTitle: block.title,
        paragraphIndexInChapter: paragraphIndex + 1,
        pageNumber,
        text: paragraphText,
        sentences: splitSentences(paragraphText),
      });
      chapterParagraphIds.push(paragraphId);
      consumedChars += paragraphText.length + 2;
    });
    const chapterEndPage = Math.max(chapterStartPage, Math.floor(Math.max(consumedChars - 1, 0) / PAGE_CHAR_BUDGET) + 1);
    chapters.push({
      chapterNumber,
      title: block.title,
      startPage: chapterStartPage,
      endPage: chapterEndPage,
      paragraphIds: chapterParagraphIds,
    });
  });

  return { sourceId, chapters, paragraphs };
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
}): Promise<{ source: TextbookSourceRecord; chunksCreated: number }> {
  const now = new Date().toISOString();
  const source: TextbookSourceRecord = {
    id: `tbs_${textbookSourceCounter++}`,
    subjectId: params.subjectId,
    title: params.title,
    versionLabel: params.versionLabel,
    createdBy: params.createdBy,
    createdAt: now,
    ...(params.originalFileName ? { originalFileName: params.originalFileName } : {}),
    ...(params.sourceFormat ? { sourceFormat: params.sourceFormat } : {}),
  };
  textbookSources.push(source);

  const readerDoc = buildTextbookReaderDocument(source.id, params.text);
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

  let created = 0;
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]!;
    chunks.push({
      id: `chk_${chunkCounter++}`,
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

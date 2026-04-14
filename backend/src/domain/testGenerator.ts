import { logger } from "../config/logger";
import { briefCompletion, hasOpenAI } from "../lib/openai";
import {
  queryCorpus,
  listTextbookRetrievalHits,
  listTextbookSourcesForSubject,
  getTextbookReaderDocument,
  type RetrievalHit,
  type TextbookSourceRecord,
} from "./ragStore";

export interface GeneratedItem {
  stem: string;
  options: Record<string, string>;
  correctKey: string;
  sourceChunkText?: string;
  readerPath?: string;
}

export interface GenerateTestParams {
  subjectId: string;
  groupId: string;
  textbookSourceId: string;
  topics?: string[];
  chapterNumbers?: number[];
  questionCount: number;
  difficulty?: "easy" | "medium" | "hard" | undefined;
}

export interface GenerateTestResult {
  items: GeneratedItem[];
  topicsUsed: string[];
  chunksRetrieved: number;
}

export function listTextbookTopics(textbookSourceId: string): string[] {
  const doc = getTextbookReaderDocument(textbookSourceId);
  if (!doc) return [];
  return doc.chapters.map((ch) => ch.title);
}

export function listTextbookChapters(textbookSourceId: string): Array<{
  chapterNumber: number;
  title: string;
  startPage: number;
  endPage: number;
}> {
  const doc = getTextbookReaderDocument(textbookSourceId);
  if (!doc) return [];
  return doc.chapters.map((chapter) => ({
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    startPage: chapter.startPage,
    endPage: chapter.endPage,
  }));
}

export function getTextbookSource(
  textbookSourceId: string,
  subjectId: string,
): TextbookSourceRecord | undefined {
  const sources = listTextbookSourcesForSubject(subjectId);
  return sources.find((s) => s.id === textbookSourceId);
}

async function retrieveTopicChunks(params: {
  topics: string[];
  subjectId: string;
  groupId: string;
  textbookSourceId: string;
  chapterNumbers: number[];
  topKPerTopic: number;
}): Promise<RetrievalHit[]> {
  const chapterSet = new Set(params.chapterNumbers);
  const allHits: RetrievalHit[] = [];
  const seenChunkIds = new Set<string>();

  for (const topic of params.topics) {
    const hits = await queryCorpus({
      query: topic,
      groupId: params.groupId,
      subjectId: params.subjectId,
      topK: params.topKPerTopic,
    });
    for (const hit of hits) {
      if (seenChunkIds.has(hit.chunkId)) continue;
      if (hit.citation.sourceType !== "textbook") continue;
      if (hit.citation.textbookSourceId !== params.textbookSourceId) continue;
      const chapterNumber = hit.citation.textbookLocation?.chapterNumber;
      if (chapterSet.size > 0 && (!chapterNumber || !chapterSet.has(chapterNumber))) continue;
      if (!seenChunkIds.has(hit.chunkId)) {
        seenChunkIds.add(hit.chunkId);
        allHits.push(hit);
      }
    }
  }

  return allHits.sort((a, b) => b.score - a.score);
}

function rankChapterHitsByTopics(hits: RetrievalHit[], topics: string[]): RetrievalHit[] {
  const terms = topics
    .flatMap((topic) => topic.toLowerCase().split(/[^a-z0-9]+/))
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);
  if (terms.length === 0) {
    return hits;
  }
  const score = (text: string): number => {
    const lower = text.toLowerCase();
    let count = 0;
    for (const term of terms) {
      if (lower.includes(term)) count += 1;
    }
    return count;
  };
  return [...hits].sort((a, b) => score(b.text) - score(a.text));
}

function buildPrompt(params: {
  topics: string[];
  questionCount: number;
  difficulty: string;
  chunks: RetrievalHit[];
}): { system: string; user: string } {
  const chunkTexts = params.chunks
    .slice(0, 12)
    .map((h, i) => `[Chunk ${i + 1}]: ${h.text}`)
    .join("\n\n");

  const system = [
    "You are an expert educational assessment writer. Generate multiple-choice questions (MCQ) based ONLY on the provided textbook content.",
    "Each question must have exactly 4 options labeled A, B, C, D. Exactly one option must be correct.",
    "Questions should test understanding, not just recall. Vary Bloom's taxonomy levels.",
    `Difficulty level: ${params.difficulty}.`,
    "",
    "Respond with ONLY a JSON array. Each element must have this exact shape:",
    '{"stem":"question text","options":{"A":"option A","B":"option B","C":"option C","D":"option D"},"correctKey":"A","sourceChunkIndex":0}',
    "",
    "Rules:",
    "- sourceChunkIndex is the 0-based index of the chunk the question is derived from",
    "- Do not include any text outside the JSON array",
    "- Do not use markdown code fences",
    `- Generate exactly ${params.questionCount} questions`,
    "- Distribute questions across the provided chunks/topics as evenly as possible",
  ].join("\n");

  const user = [
    `Topics: ${params.topics.join(", ")}`,
    `Number of questions: ${params.questionCount}`,
    "",
    "Textbook content:",
    chunkTexts,
  ].join("\n");

  return { system, user };
}

function parseGeneratedItems(
  raw: string,
  chunks: RetrievalHit[],
): GeneratedItem[] {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    logger.warn({ raw: cleaned.slice(0, 500) }, "ai_test_gen_json_parse_failed");
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const items: GeneratedItem[] = [];
  for (const entry of parsed) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof entry.stem !== "string" ||
      typeof entry.options !== "object" ||
      typeof entry.correctKey !== "string"
    ) {
      continue;
    }

    const opts = entry.options as Record<string, string>;
    if (Object.keys(opts).length < 2) continue;
    if (!opts[entry.correctKey]) continue;

    const chunkIdx = typeof entry.sourceChunkIndex === "number" ? entry.sourceChunkIndex : -1;
    const sourceChunk = chunkIdx >= 0 && chunkIdx < chunks.length ? chunks[chunkIdx] : undefined;

    items.push({
      stem: entry.stem,
      options: opts,
      correctKey: entry.correctKey,
      ...(sourceChunk ? { sourceChunkText: sourceChunk.text.slice(0, 200) } : {}),
      ...(sourceChunk?.citation.readerPath ? { readerPath: sourceChunk.citation.readerPath } : {}),
    });
  }

  return items;
}

function generateFallbackItems(
  chunks: RetrievalHit[],
  questionCount: number,
): GeneratedItem[] {
  const items: GeneratedItem[] = [];
  const usableChunks = chunks.filter((h) => h.text.length > 40);

  for (let i = 0; i < Math.min(questionCount, usableChunks.length); i++) {
    const chunk = usableChunks[i]!;
    const sentences = chunk.text.match(/[^.!?]+[.!?]+/g) ?? [chunk.text];
    const keySentence = sentences[0]?.trim() ?? chunk.text.slice(0, 100);

    items.push({
      stem: `Based on the textbook material, which statement best describes: "${keySentence.slice(0, 120)}..."?`,
      options: {
        A: "The statement is accurate as written in the textbook",
        B: "The statement contradicts the textbook content",
        C: "The statement is only partially supported by the textbook",
        D: "The textbook does not address this topic",
      },
      correctKey: "A",
      sourceChunkText: chunk.text.slice(0, 200),
      ...(chunk.citation.readerPath ? { readerPath: chunk.citation.readerPath } : {}),
    });
  }

  return items;
}

export async function generateTestFromTextbook(
  params: GenerateTestParams,
): Promise<GenerateTestResult> {
  const { subjectId, groupId, textbookSourceId, questionCount, difficulty = "medium" } = params;
  const topics = (params.topics ?? []).map((topic) => topic.trim()).filter(Boolean);
  const chapterNumbers = [...new Set((params.chapterNumbers ?? []).filter((value) => Number.isInteger(value) && value > 0))];

  const readerDoc = getTextbookReaderDocument(textbookSourceId);
  const selectedChapters =
    chapterNumbers.length > 0
      ? chapterNumbers
      : (readerDoc?.chapters.slice(0, 3).map((chapter) => chapter.chapterNumber) ?? []);
  const chapterTitleQueries =
    readerDoc?.chapters
      .filter((chapter) => selectedChapters.includes(chapter.chapterNumber))
      .map((chapter) => chapter.title)
      .filter(Boolean) ?? [];
  const retrievalQueries = [...topics, ...chapterTitleQueries];

  if (retrievalQueries.length === 0) {
    return { items: [], topicsUsed: [], chunksRetrieved: 0 };
  }

  const chunks = await retrieveTopicChunks({
    topics: retrievalQueries,
    subjectId,
    groupId,
    textbookSourceId,
    chapterNumbers: selectedChapters,
    topKPerTopic: Math.max(6, Math.ceil(questionCount / Math.max(retrievalQueries.length, 1)) + 6),
  });
  let selectedChunks = chunks;
  if (selectedChunks.length === 0 && selectedChapters.length > 0) {
    const chapterSet = new Set(selectedChapters);
    const chapterHits = listTextbookRetrievalHits({ subjectId, textbookSourceId }).filter((hit) => {
      const chapter = hit.citation.textbookLocation?.chapterNumber;
      return chapter !== undefined && chapterSet.has(chapter);
    });
    selectedChunks = rankChapterHitsByTopics(chapterHits, topics);
  }

  if (selectedChunks.length === 0) {
    return { items: [], topicsUsed: topics, chunksRetrieved: 0 };
  }

  if (!hasOpenAI()) {
    logger.info("ai_test_gen_no_openai_using_fallback");
    const items = generateFallbackItems(selectedChunks, questionCount);
    return { items, topicsUsed: retrievalQueries, chunksRetrieved: selectedChunks.length };
  }

  const prompt = buildPrompt({ topics: retrievalQueries, questionCount, difficulty, chunks: selectedChunks });

  try {
    const raw = await briefCompletion(prompt.system, prompt.user, 2000);
    if (!raw) {
      logger.warn("ai_test_gen_empty_response");
      const items = generateFallbackItems(selectedChunks, questionCount);
      return { items, topicsUsed: retrievalQueries, chunksRetrieved: selectedChunks.length };
    }

    const items = parseGeneratedItems(raw, selectedChunks);
    if (items.length === 0) {
      logger.warn("ai_test_gen_no_valid_items_parsed");
      const fallback = generateFallbackItems(selectedChunks, questionCount);
      return { items: fallback, topicsUsed: retrievalQueries, chunksRetrieved: selectedChunks.length };
    }

    logger.info(
      { requested: questionCount, generated: items.length, chunks: selectedChunks.length },
      "ai_test_gen_success",
    );
    return { items, topicsUsed: retrievalQueries, chunksRetrieved: selectedChunks.length };
  } catch (err) {
    logger.error({ err }, "ai_test_gen_llm_failed");
    const items = generateFallbackItems(selectedChunks, questionCount);
    return { items, topicsUsed: retrievalQueries, chunksRetrieved: selectedChunks.length };
  }
}

export interface StudyRecommendation {
  itemId: string;
  stem: string;
  selectedKey: string;
  correctKey: string;
  textbookSourceId?: string | undefined;
  textbookTitle?: string | undefined;
  chapterTitle?: string | undefined;
  pageNumber?: number | undefined;
  readerPath?: string | undefined;
  highlightText?: string | undefined;
  explanation?: string | undefined;
}

export async function generateStudyRecommendations(params: {
  wrongItems: Array<{
    itemId: string;
    stem: string;
    selectedKey: string;
    correctKey: string;
    correctAnswer: string;
  }>;
  subjectId: string;
  groupId: string;
}): Promise<StudyRecommendation[]> {
  const recommendations: StudyRecommendation[] = [];

  for (const wrong of params.wrongItems) {
    const hits = await queryCorpus({
      query: wrong.stem,
      groupId: params.groupId,
      subjectId: params.subjectId,
      topK: 2,
    });

    const textbookHit = hits.find(
      (h) => h.citation.sourceType === "textbook" && h.citation.readerPath,
    );

    if (textbookHit) {
      const source = textbookHit.citation.textbookSourceId
        ? listTextbookSourcesForSubject(params.subjectId).find(
            (s) => s.id === textbookHit.citation.textbookSourceId,
          )
        : undefined;

      const readerPath = textbookHit.citation.readerPath!.includes("?")
        ? `${textbookHit.citation.readerPath!}&groupId=${encodeURIComponent(params.groupId)}`
        : `${textbookHit.citation.readerPath!}?groupId=${encodeURIComponent(params.groupId)}`;

      recommendations.push({
        itemId: wrong.itemId,
        stem: wrong.stem,
        selectedKey: wrong.selectedKey,
        correctKey: wrong.correctKey,
        textbookSourceId: textbookHit.citation.textbookSourceId,
        textbookTitle: source?.title,
        chapterTitle: textbookHit.citation.textbookLocation?.chapterTitle,
        pageNumber: textbookHit.citation.textbookLocation?.pageNumber,
        readerPath,
        highlightText: textbookHit.citation.highlightText ?? textbookHit.text.slice(0, 150),
      });
    } else {
      recommendations.push({
        itemId: wrong.itemId,
        stem: wrong.stem,
        selectedKey: wrong.selectedKey,
        correctKey: wrong.correctKey,
      });
    }
  }

  return recommendations;
}

import { logger } from "../config/logger";
import { briefCompletion, hasOpenAI } from "../lib/openai";
import {
  queryCorpus,
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
  topics: string[];
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
  topKPerTopic: number;
}): Promise<RetrievalHit[]> {
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
      if (!seenChunkIds.has(hit.chunkId) && hit.citation.sourceType === "textbook") {
        seenChunkIds.add(hit.chunkId);
        allHits.push(hit);
      }
    }
  }

  return allHits.sort((a, b) => b.score - a.score);
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
  const { subjectId, groupId, topics, questionCount, difficulty = "medium" } = params;

  const chunks = await retrieveTopicChunks({
    topics,
    subjectId,
    groupId,
    topKPerTopic: Math.max(4, Math.ceil(questionCount / topics.length) + 2),
  });

  if (chunks.length === 0) {
    return { items: [], topicsUsed: topics, chunksRetrieved: 0 };
  }

  if (!hasOpenAI()) {
    logger.info("ai_test_gen_no_openai_using_fallback");
    const items = generateFallbackItems(chunks, questionCount);
    return { items, topicsUsed: topics, chunksRetrieved: chunks.length };
  }

  const prompt = buildPrompt({ topics, questionCount, difficulty, chunks });

  try {
    const raw = await briefCompletion(prompt.system, prompt.user, 2000);
    if (!raw) {
      logger.warn("ai_test_gen_empty_response");
      const items = generateFallbackItems(chunks, questionCount);
      return { items, topicsUsed: topics, chunksRetrieved: chunks.length };
    }

    const items = parseGeneratedItems(raw, chunks);
    if (items.length === 0) {
      logger.warn("ai_test_gen_no_valid_items_parsed");
      const fallback = generateFallbackItems(chunks, questionCount);
      return { items: fallback, topicsUsed: topics, chunksRetrieved: chunks.length };
    }

    logger.info(
      { requested: questionCount, generated: items.length, chunks: chunks.length },
      "ai_test_gen_success",
    );
    return { items, topicsUsed: topics, chunksRetrieved: chunks.length };
  } catch (err) {
    logger.error({ err }, "ai_test_gen_llm_failed");
    const items = generateFallbackItems(chunks, questionCount);
    return { items, topicsUsed: topics, chunksRetrieved: chunks.length };
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

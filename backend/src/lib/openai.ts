import OpenAI from "openai";
import { env } from "../config/env";
import { logger } from "../config/logger";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  if (!env.OPENAI_API_KEY) return null;
  if (!_client) {
    _client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return _client;
}

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 256;
const MAX_BATCH = 2048;

/**
 * Embed one or more texts via OpenAI. Returns vectors of length EMBEDDING_DIM.
 * Throws on API errors so callers can decide fallback behavior.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OPENAI_API_KEY not configured");

  const results: number[][] = new Array(texts.length);

  for (let start = 0; start < texts.length; start += MAX_BATCH) {
    const batch = texts.slice(start, start + MAX_BATCH);
    const resp = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIM,
      input: batch,
    });
    for (const item of resp.data) {
      results[start + item.index] = item.embedding;
    }
  }

  return results;
}

export function hasOpenAI(): boolean {
  return !!env.OPENAI_API_KEY;
}

export { EMBEDDING_DIM };

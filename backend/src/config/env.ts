import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const emptyToUndefined = (v: unknown) => (v === "" || v === undefined ? undefined : v);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Railway sets PORT; avoid defining PORT in service variables unless it matches Networking → target port. */
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(4000)),
  JWT_SECRET: z.string().min(16).default("dev-only-jwt-secret-change-me"),
  /** Comma-separated. Include both hostname forms so dev works whether you open :3000 via localhost or 127.0.0.1. */
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:3000,http://127.0.0.1:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  AGENT_TOOL_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),
  /** Set in Railway when you add OpenAI (chat, embeddings, etc.). */
  OPENAI_API_KEY: z.string().optional(),
  /** Supabase project URL (https://….supabase.co). */
  SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  /**
   * Public anon or publishable key (sb_publishable_… / eyJ…). Safe with RLS; use in API only when acting as user.
   */
  SUPABASE_ANON_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  /**
   * Service role / secret key — bypasses RLS. Server-side only; never expose to browsers or mobile clients.
   * Leave unset until you need admin storage/DB operations from this API.
   */
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  /**
   * When true, loads modular fake data from `src/seed/demoDataset.ts` at server startup.
   * Never enable in production unless you intend a throwaway demo dataset.
   */
  SEED_DEMO_DATA: z.preprocess(
    (v) => v === true || v === "true" || v === "1" || v === "yes" || v === "YES",
    z.boolean().default(false),
  ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Invalid environment configuration: ${fields}`);
}

export const env = parsed.data;

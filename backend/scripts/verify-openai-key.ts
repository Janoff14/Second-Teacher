/**
 * Smoke-test OpenAI credentials and model name (local only).
 * Usage from backend/: set OPENAI_API_KEY in .env, then: npm run verify-openai
 * Optional: OPENAI_SMOKE_MODEL=gpt-4o-mini (default) or another chat model your key can access.
 */
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const key = process.env.OPENAI_API_KEY?.trim();
const model = (process.env.OPENAI_SMOKE_MODEL ?? "gpt-4o-mini").trim();

async function main(): Promise<void> {
  if (!key) {
    console.error("Missing OPENAI_API_KEY. Add it to backend/.env (never commit).");
    process.exit(1);
  }

  const listRes = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!listRes.ok) {
    const body = await listRes.text();
    console.error("GET /v1/models failed:", listRes.status, body.slice(0, 500));
    process.exit(1);
  }

  const listJson = (await listRes.json()) as { data?: Array<{ id: string }> };
  const ids = new Set((listJson.data ?? []).map((m) => m.id));
  if (!ids.has(model)) {
    console.warn(
      `Model "${model}" not found in your account's model list (showing first 15 ids). Try OPENAI_SMOKE_MODEL=...`,
    );
    console.warn([...ids].slice(0, 15).join(", "));
  }

  const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: 'Reply with one word only: "ok"' }],
      max_tokens: 16,
    }),
  });

  const chatText = await chatRes.text();
  if (!chatRes.ok) {
    console.error("POST /v1/chat/completions failed:", chatRes.status, chatText.slice(0, 800));
    process.exit(1);
  }

  const chatJson = JSON.parse(chatText) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const reply = chatJson.choices?.[0]?.message?.content?.trim() ?? "";
  console.log("Chat smoke test passed.");
  console.log("  Requested model:", model);
  console.log("  Response model:", chatJson.model ?? "(unknown)");
  console.log("  Assistant reply:", reply);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

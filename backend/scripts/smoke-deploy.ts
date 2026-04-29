/**
 * Hit a deployed API (e.g. Railway) — health + optional login.
 *
 * Usage:
 *   API_BASE_URL=https://your-service.up.railway.app npm run smoke-deploy
 *
 * Optional:
 *   SMOKE_EMAIL=admin@secondteacher.dev SMOKE_PASSWORD='...' npm run smoke-deploy
 */
import "dotenv/config";

const base = process.env.API_BASE_URL?.replace(/\/$/, "");
if (!base) {
  console.error("Set API_BASE_URL (e.g. https://your-app.up.railway.app)");
  process.exit(1);
}

const email = process.env.SMOKE_EMAIL ?? "admin@secondteacher.dev";
const password = process.env.SMOKE_PASSWORD;

async function main() {
  const healthUrl = `${base}/health`;
  const r = await fetch(healthUrl);
  const healthBody = await r.text();
  if (!r.ok) {
    console.error(`FAIL GET /health → ${r.status}`, healthBody.slice(0, 200));
    process.exit(1);
  }
  console.log("OK GET /health", healthBody.slice(0, 120));

  if (!password) {
    console.log("Skipping POST /auth/login because SMOKE_PASSWORD is not set.");
    return;
  }

  const loginRes = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginText = await loginRes.text();
  if (!loginRes.ok) {
    console.error(`FAIL POST /auth/login → ${loginRes.status}`, loginText.slice(0, 300));
    process.exit(1);
  }
  console.log("OK POST /auth/login (token issued)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Integration checks against a deployed API (default: Railway production URL).
 *
 *   API_BASE_URL=https://....up.railway.app npx tsx scripts/prod-route-check.ts
 */
import "dotenv/config";

const BASE = (process.env.API_BASE_URL ?? "").replace(/\/$/, "");
if (!BASE) {
  console.error("Set API_BASE_URL");
  process.exit(1);
}
const adminPassword = process.env.ADMIN_PASSWORD;
const teacherPassword = process.env.TEACHER_PASSWORD;
if (!adminPassword || !teacherPassword) {
  console.error("Set ADMIN_PASSWORD and TEACHER_PASSWORD for route checks.");
  process.exit(1);
}

type Row = { route: string; status: number; ok: boolean; note?: string };
const rows: Row[] = [];

function record(route: string, status: number, ok: boolean, note?: string) {
  rows.push({ route, status, ok, note });
}

async function req(
  method: string,
  path: string,
  init?: RequestInit & { expect?: number },
): Promise<Response> {
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const r = await fetch(url, { ...init, method });
  const expect = init?.expect;
  if (expect !== undefined && r.status !== expect) {
    const body = await r.text();
    throw new Error(`${method} ${path} wanted ${expect} got ${r.status}: ${body.slice(0, 200)}`);
  }
  return r;
}

async function main() {
  // GET / — no route (SPA would be separate)
  {
    const r = await fetch(BASE + "/");
    record("GET /", r.status, r.status === 404);
  }

  {
    const r = await req("GET", "/health", { expect: 200 });
    const j = (await r.json()) as { status?: string };
    record("GET /health", r.status, j.status === "ok");
  }

  const loginRes = await req("POST", "/auth/login", {
    expect: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@secondteacher.dev", password: adminPassword }),
  });
  const loginJson = (await loginRes.json()) as { data?: { token?: string } };
  const adminToken = loginJson.data?.token;
  record("POST /auth/login (admin)", loginRes.status, Boolean(adminToken));

  const H = (token: string) => ({
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  });

  {
    const r = await req("GET", "/subjects", { headers: H(adminToken!), expect: 200 });
    record("GET /subjects", r.status, r.ok);
  }

  let subjectId = "";
  {
    const r = await fetch(`${BASE}/subjects`, {
      method: "POST",
      headers: H(adminToken!),
      body: JSON.stringify({ name: `RouteCheck ${Date.now()}` }),
    });
    const j = (await r.json()) as { data?: { id?: string } };
    subjectId = j.data?.id ?? "";
    record("POST /subjects", r.status, r.status === 201 && Boolean(subjectId));
  }

  let groupId = "";
  {
    const r = await fetch(`${BASE}/groups`, {
      method: "POST",
      headers: H(adminToken!),
      body: JSON.stringify({ subjectId, name: `Grp ${Date.now()}` }),
    });
    const j = (await r.json()) as { data?: { id?: string } };
    groupId = j.data?.id ?? "";
    record("POST /groups", r.status, r.status === 201 && Boolean(groupId));
  }

  {
    const r = await req("GET", `/insights?groupId=${encodeURIComponent(groupId)}`, {
      headers: H(adminToken!),
      expect: 200,
    });
    record("GET /insights?groupId=", r.status, r.ok);
  }

  {
    const r = await req("GET", `/assessments/published?groupId=${encodeURIComponent(groupId)}`, {
      headers: H(adminToken!),
      expect: 200,
    });
    record("GET /assessments/published?groupId=", r.status, r.ok);
  }

  {
    const r = await req("GET", "/protected/teacher", { headers: H(adminToken!), expect: 200 });
    record("GET /protected/teacher", r.status, r.ok);
  }

  {
    const r = await req("GET", "/audit/logs", { headers: H(adminToken!), expect: 200 });
    record("GET /audit/logs", r.status, r.ok);
  }

  {
    const r = await fetch(`${BASE}/enrollment/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "invalid1" }),
    });
    record("POST /enrollment/preview (invalid code)", r.status, r.status === 404);
  }

  {
    const tLogin = await req("POST", "/auth/login", {
      expect: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "teacher@secondteacher.dev", password: teacherPassword }),
    });
    const tJson = (await tLogin.json()) as { data?: { token?: string } };
    record("POST /auth/login (teacher)", tLogin.status, Boolean(tJson.data?.token));
  }

  {
    // Admin can manage any group; seeded teacher may not own this new group.
    const r = await fetch(`${BASE}/agent/teacher/chat`, {
      method: "POST",
      headers: H(adminToken!),
      body: JSON.stringify({ message: "ping", groupId }),
    });
    const ok = r.status === 200;
    record("POST /agent/teacher/chat", r.status, ok, ok ? undefined : (await r.text()).slice(0, 120));
  }

  const failed = rows.filter((x) => !x.ok);
  console.table(rows.map((x) => ({ route: x.route, status: x.status, ok: x.ok, note: x.note ?? "" })));
  if (failed.length) {
    console.error(`\nFailed: ${failed.length}`);
    process.exit(1);
  }
  console.log("\nAll route checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

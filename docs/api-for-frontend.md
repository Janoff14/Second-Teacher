# Second Teacher API — guide for frontend

REST API consumed by web or mobile clients. All paths are **relative to the API base URL** (no global prefix).

**Example production base:** `https://second-teacher-production.up.railway.app`  
**Local:** `http://localhost:4000` (or whatever `PORT` is in `.env`)

---

## Before you integrate

### CORS

The server validates the **`Origin`** header against **`CORS_ORIGIN`** (comma-separated list). Set on the backend (e.g. Railway) to every frontend origin you use, for example:

- `http://localhost:5173`
- `https://your-app.vercel.app`

If the browser origin is not allowed, authenticated requests from the browser will fail.

### Data persistence (important)

Today, core data (users, groups, assessments, etc.) is held **in memory**. **Deploys and restarts clear it.** Seeded dev users are recreated on boot (see auth section). Plan UX accordingly until the backend is wired to Supabase/Postgres.

### Root URL

`GET /` is **not** defined and returns **404** (`NOT_FOUND`). Use **`GET /health`** for uptime checks.

---

## Conventions

| Item | Detail |
|------|--------|
| **Content-Type** | Use `application/json` on requests with a body. |
| **Success shape** | Most endpoints return JSON with a top-level **`data`** object (or array). |
| **Auth header** | `Authorization: Bearer <jwt>` |
| **JWT lifetime** | **12 hours** (`signToken` in `middleware/auth.ts`). |
| **Request ID** | Responses may be logged with `X-Request-Id`; errors include `requestId` in the JSON body when available. |

### Error responses

Typical shape:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing bearer token",
    "requestId": "…"
  }
}
```

Common **`code`** values: `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `INVALID_JOIN_CODE`, `USER_EXISTS`, plus domain-specific codes (e.g. `DRAFT_NOT_FOUND`, `VERSION_NOT_FOUND`, `GROUP_NOT_FOUND`).

For **400** validation, `message` often starts with `Invalid request body: …`.

**500** responses use a generic message (`Unexpected server error`) in JSON; details stay in server logs.

---

## Authentication

### Roles

`admin` | `teacher` | `student`

### Login / register (public)

| Method | Path | Body | Success |
|--------|------|------|--------|
| POST | `/auth/login` | `{ "email": string, "password": string }` (password min 8 chars) | **200** `{ data: { user, token } }` |
| POST | `/auth/register` | `{ "email", "password", "role"?: "admin"\|"teacher"\|"student" }` | **201** same shape |

### Signup with join code (public, rate-limited)

| Method | Path | Body | Success |
|--------|------|------|--------|
| POST | `/auth/signup-with-join-code` | `{ "code": string (min 6), "email", "password" }` | **201** `{ data: { user, enrollment, token } }` |
| | | | **404** if code invalid: `{ error: { code: "INVALID_JOIN_CODE", … } }` (no `requestId` in this handler) |

### Enrollment preview (public, rate-limited)

| Method | Path | Body | Success |
|--------|------|------|--------|
| POST | `/enrollment/preview` | `{ "code": string (min 6) }` | **200** `{ data: { subjectName, groupName } }` |
| | | | **404** invalid code |

### Seeded users (dev / fresh deploy)

After server start, these exist until data is cleared or persistence is added. Passwords come from environment variables; tests use isolated fixture values.

- `admin@secondteacher.dev` / `DEFAULT_ADMIN_PASSWORD`
- `teacher@secondteacher.dev` / `DEFAULT_TEACHER_PASSWORD`
- `student@secondteacher.dev` / `DEFAULT_STUDENT_PASSWORD`

Default user seeding is disabled in production unless `SEED_DEFAULT_USERS=true`.

### Protected routes

Send header:

```http
Authorization: Bearer <token>
```

If the token is missing or invalid → **401** `UNAUTHORIZED`. If the role is not allowed → **403** `FORBIDDEN`.

---

## Health

| Method | Path | Auth | Success |
|--------|------|------|--------|
| GET | `/health` | No | **200** `{ "status": "ok" }` |

---

## Role smoke routes

| Method | Path | Roles | Success |
|--------|------|-------|--------|
| GET | `/protected/teacher` | teacher, admin | **200** |
| GET | `/protected/student` | student, teacher, admin | **200** |

---

## Academic (subjects, groups, join codes)

All require auth; roles as noted.

| Method | Path | Roles | Body / query | Success |
|--------|------|-------|--------------|--------|
| POST | `/subjects` | admin, teacher | `{ "name": string (min 2) }` | **201** `{ data: subject }` |
| GET | `/subjects` | admin, teacher | — | **200** `{ data: subject[] }` |
| POST | `/groups` | admin, teacher | `{ "subjectId", "name" (min 2) }` | **201** `{ data: group }` |
| GET | `/groups` | admin, teacher | — | **200** `{ data: group[] }` |
| GET | `/teacher/academic-scope` | admin, teacher | — | **200** `{ data: { subjects: { subject, groups[] }[] } }` — each block lists groups the teacher may manage (creator or assigned); admins get every subject that has groups |
| POST | `/groups/:groupId/assign-teacher` | admin | `{ "teacherId" }` | **201** `{ data: assignment }` |
| POST | `/groups/:groupId/join-codes` | admin, teacher | `{ "ttlHours"?: number }` (optional positive int, max ~720) | **201** `{ data: { code, groupId, expiresAt } }` |
| POST | `/groups/:groupId/join-codes/revoke` | admin, teacher | `{ "code" (min 6) }` | **200** `{ data: { code, revokedAt } }` |

Teachers can only manage groups they created or are assigned to (enforced server-side).

---

## Assessments

| Method | Path | Roles | Body / query | Success |
|--------|------|-------|--------------|--------|
| POST | `/assessments/drafts` | admin, teacher | `{ "groupId", "title" }` | **201** `{ data: draft }` |
| GET | `/assessments/drafts/:draftId` | admin, teacher | — | **200** `{ data: draft }` |
| PUT | `/assessments/drafts/:draftId/items` | admin, teacher | `{ "items": [ { "stem", "options": { key: label, … } (≥2 keys), "correctKey" } ] }` | **200** `{ data: draft }` |
| POST | `/assessments/drafts/:draftId/publish` | admin, teacher | `{ "windowOpensAtUtc", "windowClosesAtUtc", "windowTimezone" }` | **201** `{ data: version }` |
| GET | `/assessments/published` | any authenticated | Query: **`groupId` required** for all roles | **200** `{ data: versions }` (student sees redacted “student view”) |
| GET | `/assessments/published/:versionId` | any authenticated | — | **200** `{ data: version \| studentView }` |
| POST | `/assessments/published/:versionId/attempts` | student | `{ "answers": { itemId: selectedKey, … } }` | **201** `{ data: attempt }` |
| GET | `/assessments/published/:versionId/attempts/me` | student | — | **200** `{ data: attempts[] }` |

---

## RAG (corpus)

| Method | Path | Roles | Body | Success |
|--------|------|-------|------|--------|
| POST | `/rag/sources/textbooks` | admin, teacher | `{ "subjectId", "title", "versionLabel", "text" }` | **201** `{ data: … }` |
| POST | `/rag/query` | admin, teacher, student | `{ "query" (min 2), "groupId", "topK"?: 1–20 }` | **200** `{ data: hits }` |
| GET | `/reader/textbooks/:textbookSourceId` | admin, teacher, student | Query: **`groupId` required**, optional `paragraphId`, `sentenceStart`, `sentenceEnd` | **200** `{ data: { source, chapters, paragraphs, focus } }` |

Students and teachers may only query groups they belong to or manage.

`/rag/query` textbook hits now include citation metadata for deep links:
- `citation.readerPath` (relative reader URL)
- `citation.textbookLocation` (`chapterNumber`, `chapterTitle`, `pageNumber`, `paragraphId`, `sentenceStart`, `sentenceEnd`)
- `citation.highlightText` (text chunk to highlight)

---

## Agent (LLM orchestration)

| Method | Path | Roles | Body | Success |
|--------|------|-------|------|--------|
| POST | `/agent/teacher/chat` | admin, teacher | `{ "message", "groupId" }` | **200** `{ data: result }` |
| POST | `/agent/student/chat` | student | `{ "message", "groupId" }` | **200** `{ data: result }` |

Teachers must be allowed to manage the `groupId`; students must be enrolled. Responses can use tools/OpenAI when configured (`OPENAI_API_KEY` on server).

---

## Analytics

| Method | Path | Roles | Query / body | Success |
|--------|------|-------|--------------|--------|
| GET | `/analytics/risk` | admin, teacher | **`studentId`**, **`groupId`** required | **200** `{ data: { snapshot, classification } }` |
| POST | `/groups/:groupId/analytics/recompute` | admin, teacher | — | **202** `{ data: { ok: true } }` |

---

## Insights & notifications

| Method | Path | Roles | Query / body | Success |
|--------|------|-------|--------------|--------|
| GET | `/insights` | admin, teacher | **`groupId`** required; optional `status`, `minRisk` | **200** `{ data: … }` |
| GET | `/insights/me` | student | **`groupId`** required | **200** `{ data: … }` |
| POST | `/insights/:insightId/status` | any authenticated | `{ "status": "acknowledged" \| "dismissed" }` | **200** `{ data: … }` |
| GET | `/notifications/me` | any authenticated | Optional `limit` (1–100, default 50) | **200** `{ data: … }` |

---

## Audit (admin only)

| Method | Path | Roles | Query | Success |
|--------|------|-------|-------|--------|
| GET | `/audit/logs` | admin | `limit` (1–500, default 100), `actorId`, `action`, `groupId`, `since` | **200** `{ data: logs[] }` |
| GET | `/audit/logs/export` | admin | same filters as logs | **200** download JSON (`Content-Disposition: attachment`) |

---

## Quick integration checklist

1. Set **`VITE_*` / `NEXT_PUBLIC_*`** (or equivalent) **`API_BASE_URL`** without trailing slash.
2. Ensure backend **`CORS_ORIGIN`** includes your frontend origin(s).
3. Store **`token`** after login; attach **`Authorization`** on API calls; handle **401** by re-login or refresh flow (no refresh endpoint today — re-login).
4. Expect **`data`** wrapper on successes; read **`error.code`** for UX messaging.

---

## Related

- **[Platform user workflow](platform-user-workflow.md)** — end-to-end journeys, endpoints, and intent (no UI prescription).
- **[Frontend implementation plan](frontend-implementation-plan.md)** — golden-path demo order, workflows (**WF-CORPUS-*** mandatory), and phased tasks (J0–J5).

---

## Keeping this doc fresh

Routes are defined under `backend/src/routes/`. After adding or changing endpoints, update this file or generate an OpenAPI spec from the same source of truth.

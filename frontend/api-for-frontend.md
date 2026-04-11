# Second Teacher — API contract (frontend)

**Audience:** Engineers building `frontend/` and anyone implementing or changing the Express API.  
**Aligned with:** [`frontend-implementation-plan.md`](./frontend-implementation-plan.md) (golden path, workflows, phases).

This document describes HTTP behavior the web client relies on. If the real server differs, update **either** the API **or** this file and `frontend/src/lib/api/*` together.

---

## 1. Base URL and transport

- **Base URL:** configured in the browser as `NEXT_PUBLIC_API_BASE_URL` (no trailing slash). All paths below are relative to that base.
- **Format:** JSON request/response bodies unless noted.
- **Health:** `GET /health` — use for readiness checks. **`GET /` returns 404** (per implementation plan).

---

## 2. Global response envelope

Every JSON response should follow one of these shapes:

### Success

```json
{
  "data": <payload>
}
```

The frontend unwraps `data` for typed results.

### Error

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

`details` is optional. The UI surfaces `error.code` and `error.message`.

---

## 3. Authentication

- **Mechanism:** Bearer JWT in the `Authorization` header: `Authorization: Bearer <token>`.
- **Lifetime:** ~12 hours (order of magnitude). **There is no refresh-token endpoint** — on **401**, the client clears local session and sends the user to login.
- **When to send the token:** All mutating and protected reads except explicitly unauthenticated routes (login, register, enrollment preview, signup-with-join-code, health).

### Session payload (success `data`)

The frontend’s `extractSession()` accepts several common shapes; prefer **one** of these for consistency:

**Option A — flat**

```json
{
  "data": {
    "accessToken": "<jwt>",
    "role": "teacher|student|admin",
    "groupId": "<optional uuid>",
    "userId": "<optional; same as user.id for teacher group scoping>"
  }
}
```

**Option B — nested user**

```json
{
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "<recommended for teachers — used with assignedTeacherIds / academic-scope>",
      "role": "teacher|student|admin",
      "groupId": "<optional>"
    }
  }
}
```

Aliases such as `access_token` for the token are tolerated by the client parser. **Role** must normalize to `teacher`, `student`, or `admin` (case-insensitive). The client also reads **`user.id`** / **`userId`** into session for teacher dashboard filtering; if omitted, the JWT payload **`sub`** (or `userId` / `id` claim) is used when present.

---

## 4. CORS and environment

- **`CORS_ORIGIN`** on the API must include every browser origin used by the frontend (e.g. `http://localhost:3001`).
- **Persistence:** Core data may be **in-memory** in dev/demo — the UI shows a dev banner; restarts clear server state.

---

## 5. Endpoints (catalog)

Methods and paths match the implementation plan unless marked *planned / verify with backend*.

### 5.1 Auth (Phase 1a — WF-AUTH)

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|--------|
| `POST` | `/auth/login` | No | `{ "email": string, "password": string }` | Returns session `data` (§3). |
| `POST` | `/auth/register` | No | `{ "email", "password", "displayName?": string, "role": "admin"\|"student" }` | Signup for admin/student only. Teachers created via `/users/teachers`. |
| `POST` | `/auth/signup-with-join-code` | No | `{ "joinCode": string, "email": string, "password": string, "displayName?": string }` | Student onboarding; returns session `data`; include `groupId` when applicable. |

### 5.1b Users / Teachers (Admin only)

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|--------|
| `POST` | `/users/teachers` | Admin | `{ "email", "password", "displayName": string }` | Creates teacher account. Returns `{ user: { id, email, displayName } }`. No token returned. |
| `GET` | `/users/teachers` | Admin | — | Returns `{ data: [{ id, email, displayName }, …] }`. Used for assign-teacher dropdowns. |

### 5.2 Enrollment preview (Phase 1a — WF-JOIN)

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|--------|
| `POST` | `/enrollment/preview` | No | `{ "code": string }` | Resolves join code. |

**Suggested success `data`:**

```json
{
  "groupId": "<id>",
  "groupName": "<optional display name>"
}
```

The client also accepts `group_id`, `name`, or `label` for compatibility.

### 5.3 Academic structure (Phase 1a — WF-ACADEMIC)

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| `GET` | `/subjects` | Yes | List subjects. `data`: array of subjects. |
| `POST` | `/subjects` | Yes | Body: `{ "name": string, "code?": string }` — create subject. |
| `GET` | `/groups?subjectId=<id>` | Yes | List groups for a subject. `data`: array. **Teachers:** SHOULD return only groups assigned to the authenticated teacher (or include `assignedTeacherIds` for client filtering). |
| `POST` | `/groups` | Yes | Body: `{ "subjectId": string, "name": string }` — create group. |
| `GET` | `/teacher/academic-scope` | Yes (teacher) | **Preferred for teacher dashboard:** `data`: array of `{ "subject": Subject, "groups": Group[] }` (only subjects/groups assigned to this teacher). Empty array if none. |
| `GET` | `/groups/:groupId/join-codes` | Yes | List join codes (if not implemented, UI may only show codes after create). |
| `POST` | `/groups/:groupId/join-codes` | Yes | Body: `{}` or `{ "label?": string }` — issue code. |
| `DELETE` | `/groups/:groupId/join-codes/:joinCodeId` | Yes | Revoke a code. |

**Entity hints (`data` items):**

- **Subject:** `{ "id", "name", "code?": string | null }`
- **Group:** `{ "id", "subjectId", "name", "assignedTeacherIds?": string[] }` — when present, the teacher UI shows the group only if the current user’s id is listed (and always enforces `subjectId` matching the subject card).
- **Join code:** `{ "id", "code", "expiresAt?": string | null, "revokedAt?": string | null }`

---

### 5.4 RAG / corpus (Phase 1b — WF-CORPUS-*)

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|--------|
| `POST` | `/rag/sources/textbooks` | Yes | `{ "subjectId", "title", "versionLabel", "text" }` | **MVP-required** ingest. |
| `POST` | `/rag/query` | Yes | `{ "query": string, "groupId": string, "topK?": number }` | **MVP-required** search; UI shows citations/snippets. |

---

### 5.5 Assessments (Phase 2 — WF-ASSESS-*)

Frontend implementation: `frontend/src/lib/api/assessments.ts`. Paths below are the **contract the UI calls**; align the Express router to match or update this doc + client together.

| Method | Path | Auth | Body / query | Notes |
|--------|------|------|----------------|--------|
| `POST` | `/assessments/drafts` | Yes | `{ "title?": string, "groupId?": string }` | Create draft; returns draft with `id`. |
| `GET` | `/assessments/drafts` | Yes | `?groupId=` optional | List drafts. `data`: array or `{ "drafts": [...] }`. |
| `GET` | `/assessments/drafts/:draftId` | Yes | — | Draft detail; include `items` when saved. |
| `PUT` | `/assessments/drafts/:draftId/items` | Yes | `{ "items": Item[] }` | Replace items. Each item: `stem`, `options: [{ key, label }]`, `correctKey`. |
| `POST` | `/assessments/drafts/:draftId/publish` | Yes | `{ "groupId", "opensAt?": ISO string \| null, "closesAt?": ISO string \| null }` | Publish to a group. |
| `GET` | `/assessments/published` | Yes | `?groupId=` | List published assessments for the group. |
| `GET` | `/assessments/published/:publishedId` | Yes | — | Student/teacher view; items for attempt (student response may omit `correctKey`). |
| `POST` | `/assessments/published/:publishedId/attempts` | Yes | `{ "answers": { [itemId]: selectedKey } }` | Submit attempt. |
| `GET` | `/assessments/attempts/me` | Yes | `?groupId=` | Student’s attempts for that group. |

---

### 5.6 Insights & analytics (Phase 3 — WF-INSIGHTS-*)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/insights?groupId=` | Teacher feed; filters as implemented. |
| `POST` | `/insights/:insightId/status` | Ack/dismiss. |
| `GET` | `/analytics/risk?studentId=&groupId=` | Risk drill-down. |
| `POST` | `/groups/:groupId/analytics/recompute` | Demo/trigger. |
| `GET` | `/insights/me?groupId=` | Student feed. |

---

### 5.7 Agent chat (Phase 4 — WF-AGENT-*)

| Method | Path | Body | Notes |
|--------|------|------|--------|
| `POST` | `/agent/teacher/chat` | `{ "message": string, "groupId": string }` | After corpus is usable. |
| `POST` | `/agent/student/chat` | `{ "message": string, "groupId": string }` | Same shape as teacher; server may derive scope from enrollment. |

**Response `data`:** assistant text may appear as `reply`, `message`, `answer`, `text`, or nested `data` — see `parseAgentReply` in `frontend/src/lib/api/agent.ts`.

---

### 5.8 Notifications & audit (Phase 5)

| Method | Path | Query | Notes |
|--------|------|-------|-------|
| `GET` | `/notifications/me` | `limit` optional, **1–100** (default often 50) | In-app inbox. |
| `GET` | `/audit/logs` | `limit`, `actorId`, `action`, `groupId`, `since` | Admin filtered log stream. |
| `GET` | `/audit/logs/export` | same filters | Admin JSON download attachment. |

---

## 6. Frontend implementation map

| Area | Source files |
|------|----------------|
| HTTP wrapper, 401 | `frontend/src/lib/api/client.ts` |
| Session parsing | `frontend/src/lib/api/session.ts` |
| Auth | `frontend/src/lib/api/auth.ts` |
| Enrollment | `frontend/src/lib/api/enrollment.ts` |
| Subjects / groups / codes | `frontend/src/lib/api/academic.ts` |
| RAG ingest & query | `frontend/src/lib/api/rag.ts` |
| Assessments | `frontend/src/lib/api/assessments.ts` |
| Insights & analytics | `frontend/src/lib/api/insights.ts` |
| Agent chat | `frontend/src/lib/api/agent.ts` |
| Notifications inbox | `frontend/src/lib/api/notifications.ts` — UI: `/notifications` |
| Audit logs & export | `frontend/src/lib/api/audit.ts` — UI: `/admin/audit` |
| Assign teacher | `frontend/src/lib/api/academic.ts` `assignTeacher()` — UI: `/admin` dashboard |
| Teachers CRUD | `frontend/src/lib/api/users.ts` `createTeacher()`, `listTeachers()` — UI: `/admin` dashboard |

Extend this table as new modules are added.

---

## 7. Changelog

| Date | Change |
|------|--------|
| 2026-04-10 | Initial version from `frontend-implementation-plan.md` + Phase 0–1a client. |
| 2026-04-10 | Phase 1b: `rag.ts` + UI map for `/teacher/corpus`, `/student/corpus`. |
| 2026-04-10 | Phase 2: `assessments.ts` + teacher/student assessment routes; §5.5 paths fixed. |
| 2026-04-10 | Phase 3: `insights.ts` + `/teacher/insights`, `/student/insights`. |
| 2026-04-10 | Phase 4: `agent.ts` + `/teacher/agent`, `/student/agent`; corpus `syncQuery` / `alignGroupId`. |
| 2026-04-10 | Phase 5: `notifications.ts` + `/notifications` (WF-NOTIFY); §5.8 `limit` query documented. |
| 2026-04-11 | Phase 5: `audit.ts` + `/admin/audit` (WF-AUDIT); `assignTeacher` + admin dashboard revamp. |
| 2026-04-11 | `users.ts`: `POST /users/teachers`, `GET /users/teachers` (admin only). Auth register now admin\|student only. |
| 2026-04-11 | Teacher dashboard: `GET /teacher/academic-scope`; session `userId` + optional `assignedTeacherIds` on groups; JWT `sub` fallback. |

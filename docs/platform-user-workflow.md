# Second Teacher — Platform user workflow

**Audience:** Product, frontend, and anyone integrating the API.  
**Companion docs:** [API guide for frontend](./api-for-frontend.md), [Frontend implementation plan](./frontend-implementation-plan.md).

This document describes **who does what, in what order**, which **HTTP endpoints** to call, and **why**. Concrete UI/UX is left to the frontend.

---

## Global rules (every client)

| Topic | What to do |
|--------|------------|
| API liveness | Use `GET /health`. Do not use `GET /` — it is undefined and returns 404 (`NOT_FOUND`). |
| Authentication | After login or signup, store the JWT. Send `Authorization: Bearer <token>` on protected requests. |
| Session lifetime | JWT lifetime is ~**12 hours**. There is **no refresh endpoint** — on **401**, send the user through login again. |
| Response shape | Success: top-level **`data`**. Errors: **`error.code`**, **`error.message`**. |
| CORS | Backend **`CORS_ORIGIN`** must include every browser origin the app runs on (comma-separated). |
| Persistence today | Core domain data is **in-memory**; deploys/restarts clear it. Plan banners, empty states, and demo copy accordingly until Supabase/Postgres backs the API. |

**Optional role checks after login:** `GET /protected/teacher` (teacher, admin) or `GET /protected/student` (student, teacher, admin).

---

## Stakeholder golden path (recommended demo order)

Structure → **textbook + RAG** → enrollment → assessments → insights/risk → corpus search + agent chat.  
Corpus ingest and search are **MVP-required** before treating AI features as complete.

---

## 1. Teacher or admin — structure (WF-ACADEMIC + WF-AUTH)

| Step | Intent | Endpoints |
|------|--------|-----------|
| Sign in | Establish session and role | `POST /auth/login` — body `{ "email", "password" }` → `{ data: { user, token } }` |
| (Alternative) Register | Dev or admin-created accounts | `POST /auth/register` — `{ "email", "password", "role"?: "admin" \| "teacher" \| "student" }` |
| Create subject | Curriculum container before groups and RAG sources | `POST /subjects` — `{ "name" }` → **201** |
| List subjects | Populate pickers | `GET /subjects` |
| Create group | Class under a subject | `POST /groups` — `{ "subjectId", "name" }` → **201** |
| List groups | Resolve `groupId` for the rest of the app | `GET /groups` |
| (Admin) Assign teacher | Non-owner teacher access | `POST /groups/:groupId/assign-teacher` — `{ "teacherId" }` |
| Issue join code | Student onboarding | `POST /groups/:groupId/join-codes` — `{ "ttlHours"?: number }` → `{ code, groupId, expiresAt }` |
| Revoke join code | Invalidate a code | `POST /groups/:groupId/join-codes/revoke` — `{ "code" }` |

**Why:** Subjects and groups scope **RAG**, **assessments**, **insights**, and **agent chat**. Teachers may only manage groups they own or are assigned to (enforced server-side).

---

## 2. Teacher — corpus ingest (WF-CORPUS-INGEST) — required for MVP

| Intent | Endpoint |
|--------|----------|
| Load ground-truth text for search and AI grounding | `POST /rag/sources/textbooks` — `{ "subjectId", "title", "versionLabel", "text" }` → **201** |

**Why:** Without ingest, corpus search and trustworthy agent behavior are not demonstrable.

---

## 3. Teacher or student — corpus search (WF-CORPUS-SEARCH) — required for MVP

| Intent | Endpoint |
|--------|----------|
| Query snippets/citations for a group | `POST /rag/query` — `{ "query", "groupId", "topK"?: 1–20 }` → `{ data: hits }` |

**Why:** Proves RAG wiring; both teacher and student shells should expose this (shared component is fine). Students and teachers are restricted to groups they belong to or manage.

---

## 4. Student — join (WF-JOIN + WF-AUTH)

| Step | Intent | Endpoints |
|------|--------|-----------|
| Preview code | Confirm subject/group before signup | `POST /enrollment/preview` — `{ "code" }` → `{ data: { subjectName, groupName } }` |
| Sign up and enroll | One step to user, enrollment, and token | `POST /auth/signup-with-join-code` — `{ "code", "email", "password" }` → **201** `{ data: { user, enrollment, token } }` |

**Why:** Student lands with an active **`groupId`** in client state for all downstream calls.

---

## 5. Teacher — author assessment (WF-ASSESS-AUTHOR)

| Step | Intent | Endpoints |
|------|--------|-----------|
| Start draft | Tie assessment to a class | `POST /assessments/drafts` — `{ "groupId", "title" }` → **201** |
| Load draft | Editor | `GET /assessments/drafts/:draftId` |
| Set items | MCQ structure | `PUT /assessments/drafts/:draftId/items` — `{ "items": [{ "stem", "options": { … }, "correctKey" }] }` |
| Publish | Scheduling | `POST /assessments/drafts/:draftId/publish` — `{ "windowOpensAtUtc", "windowClosesAtUtc", "windowTimezone" }` → **201** |
| List published | Teacher and student views | `GET /assessments/published?groupId=<required>` |

**Why:** Published versions drive the student take flow; server applies role-appropriate redaction for students.

---

## 6. Student — take assessment (WF-ASSESS-TAKE)

| Step | Intent | Endpoints |
|------|--------|-----------|
| Browse / open | See assessments for the group | `GET /assessments/published?groupId=` then `GET /assessments/published/:versionId` |
| Submit attempt | Record answers | `POST /assessments/published/:versionId/attempts` — `{ "answers": { "<itemId>": "<selectedKey>", … } }` → **201** |
| Own history | Past attempts | `GET /assessments/published/:versionId/attempts/me` |

**Why:** Closes the loop from publish → attempt → retrievable results.

---

## 7. Teacher — insights and risk (WF-INSIGHTS-T)

| Step | Intent | Endpoints |
|------|--------|-----------|
| Refresh analytics (e.g. demo) | Recompute group metrics | `POST /groups/:groupId/analytics/recompute` → **202** |
| Insight feed | Teacher list | `GET /insights?groupId=<required>` — optional `status`, `minRisk` |
| Student drill-down | Risk snapshot | `GET /analytics/risk?studentId=&groupId=` (both required) |
| Triage | Acknowledge or dismiss | `POST /insights/:insightId/status` — `{ "status": "acknowledged" \| "dismissed" }` |

**Why:** Operational view for who needs attention after assessment activity exists.

---

## 8. Student — own insights (WF-INSIGHTS-S)

| Intent | Endpoint |
|--------|----------|
| Personalized feed for the active group | `GET /insights/me?groupId=<required>` |

---

## 9. Student — agent chat (WF-AGENT-S) — after corpus MVP

| Intent | Endpoint |
|--------|----------|
| LLM-backed help in group context (uses tools/OpenAI when configured on server) | `POST /agent/student/chat` — `{ "message", "groupId" }` |

**Product note:** Prefer linking or pairing with **WF-CORPUS-SEARCH** when the API returns citation hooks (or use a side-by-side search panel).

---

## 10. Teacher — agent chat (WF-AGENT-T) — after corpus MVP

| Intent | Endpoint |
|--------|----------|
| Same for teachers authorized on `groupId` | `POST /agent/teacher/chat` — `{ "message", "groupId" }` |

---

## 11. Everyone — notifications (WF-NOTIFY)

| Intent | Endpoint |
|--------|----------|
| In-app notification list | `GET /notifications/me` — optional `limit` (1–100, default 50) |

---

## 12. Admin — audit (optional) (WF-AUDIT)

| Intent | Endpoints |
|--------|-----------|
| Filtered log stream | `GET /audit/logs` — `limit`, `actorId`, `action`, `groupId`, `since` |
| Download | `GET /audit/logs/export` — same filters, JSON attachment |

---

## Workflow ID reference

| ID | Scope |
|----|--------|
| **WF-AUTH** | Login, register, bearer token, 401 → re-login, role guards |
| **WF-JOIN** | Preview code → signup with join code → `groupId` in state |
| **WF-ACADEMIC** | Subjects, groups, join codes, teacher assignment |
| **WF-CORPUS-INGEST** | Textbook ingest (required) |
| **WF-CORPUS-SEARCH** | RAG query UI (required) |
| **WF-ASSESS-AUTHOR** | Draft → items → publish → list published |
| **WF-ASSESS-TAKE** | Published list → attempt → my attempts |
| **WF-INSIGHTS-T** | Teacher insights, risk, recompute, ack/dismiss |
| **WF-INSIGHTS-S** | Student `insights/me` |
| **WF-AGENT-T** / **WF-AGENT-S** | Teacher / student chat |
| **WF-NOTIFY** | Notifications inbox |
| **WF-AUDIT** | Admin logs and export |

---

## Integration checklist (short)

1. Set frontend **`API_BASE_URL`** (e.g. `VITE_*` or `NEXT_PUBLIC_*`) with **no trailing slash**.
2. Align backend **`CORS_ORIGIN`** with every frontend origin.
3. Persist token; attach **`Authorization`**; handle **`error.code`** for UX.
4. Run the golden path without skipping **corpus ingest** or **corpus search**.

---

## Related documents

| Document | Use |
|----------|-----|
| [api-for-frontend.md](./api-for-frontend.md) | Full endpoint tables, bodies, roles, error codes |
| [frontend-implementation-plan.md](./frontend-implementation-plan.md) | Phases J0–J5, definition of done |
| [prd.md](./prd.md) | Journeys and NFRs |
| [architecture.md](./architecture.md) | System context |

---

## Keeping this file fresh

When routes change under `backend/src/routes/`, update this document and/or [api-for-frontend.md](./api-for-frontend.md) together.

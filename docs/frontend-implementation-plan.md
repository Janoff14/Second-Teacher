# Second Teacher — Frontend implementation plan

**Audience:** Engineers implementing the web app under `frontend/`.  
**API contract:** [`api-for-frontend.md`](./api-for-frontend.md).  
**Product context:** [`prd.md`](./prd.md) (user journeys §5), [`epics.md`](./epics.md).

---

## 1. Principles

1. **Backend-first:** The Express API is the source of truth; the UI is a thin, role-aware client.
2. **RAG is MVP-required:** Textbook ingestion (`POST /rag/sources/textbooks`) and corpus search (`POST /rag/query`) are **not optional**. Agent chat is grounded in this corpus; ship ingest + search **before** treating AI features as complete.
3. **Demo golden path:** Structure → **textbook + RAG** → enrollment → assessments → insights/risk → corpus search + agent chat.

---

## 2. Integration constraints (read before building)

| Topic | Implication for UI |
|--------|-------------------|
| **CORS** | Backend `CORS_ORIGIN` must include every frontend origin you use. |
| **Persistence** | Core data is **in-memory** today; restarts clear state. Surface a clear banner in dev/demo. |
| **Auth** | JWT ~12 **hours**; **no refresh endpoint** — handle **401** with re-login. |
| **Responses** | Success: top-level `data`. Errors: `error.code`, `error.message`. |
| **Health** | Use `GET /health` only; `GET /` is 404. |

---

## 3. Golden path (stakeholder demo sequence)

Walk this order end-to-end:

| Step | Actor | What happens |
|------|--------|----------------|
| 1 | Teacher or admin | Log in → ensure **subject** + **group** exist → **generate join code** (`POST /groups/:groupId/join-codes`). |
| 2 | Teacher | **Add textbook** to the subject: `POST /rag/sources/textbooks` with `subjectId`, `title`, `versionLabel`, `text`. |
| 3 | Teacher | **Verify corpus:** `POST /rag/query` with `query`, `groupId`, optional `topK` — show citations/snippets in UI. |
| 4 | Student | Join flow: `POST /enrollment/preview` → `POST /auth/signup-with-join-code` → land in app with **group** context. |
| 5 | Teacher | Assessment: create draft → `PUT .../items` → `POST .../publish` with window fields → `GET /assessments/published?groupId=`. |
| 6 | Student | List published assessments → open version → `POST .../attempts` with answers. |
| 7 | Teacher | Optional: `POST /groups/:groupId/analytics/recompute` → `GET /insights?groupId=` → drill student → `GET /analytics/risk?studentId=&groupId=`. |
| 8 | Student | `GET /insights/me?groupId=` → **corpus search** → `POST /agent/student/chat`. |
| 9 | Teacher | **Corpus search** → `POST /agent/teacher/chat` → optional `POST /insights/:insightId/status`. |

---

## 4. Workflows (product capabilities)

Each row is an end-to-end slice: routes, state, and API module(s).

| ID | Actor | Scope | Outcome |
|----|--------|--------|---------|
| **WF-AUTH** | All | Global | Login/register, bearer token, `Authorization` on requests, 401 → re-login, role guards. |
| **WF-JOIN** | Student | Onboarding | Preview code → signup with join code → enrolled `groupId` in app state. |
| **WF-ACADEMIC** | Teacher, admin | Structure | Subjects/groups; join codes create/revoke; teacher assignment if admin demos. |
| **WF-CORPUS-INGEST** | Teacher | **Required** | Subject-scoped textbook ingest UI → `POST /rag/sources/textbooks`; errors and validation. |
| **WF-CORPUS-SEARCH** | Teacher, student | **Required** | Dedicated search UI → `POST /rag/query` with `groupId`; show hits + citation metadata. |
| **WF-ASSESS-AUTHOR** | Teacher | Assessments | Draft → items editor → publish with schedule → list published by `groupId`. |
| **WF-ASSESS-TAKE** | Student | Assessments | Published list → attempt → `POST .../attempts`; `GET .../attempts/me` as needed. |
| **WF-INSIGHTS-T** | Teacher | Risk/feed | `GET /insights`, filters, ack/dismiss; `GET /analytics/risk`; recompute trigger. |
| **WF-INSIGHTS-S** | Student | Feed | `GET /insights/me?groupId=`. |
| **WF-AGENT-T** | Teacher | AI | Chat with `groupId`; answers must align with corpus (RAG already ingested). |
| **WF-AGENT-S** | Student | AI | Same; student enrollment scoped. |
| **WF-NOTIFY** | All | Inbox | `GET /notifications/me`. |
| **WF-AUDIT** | Admin | Governance | `GET /audit/logs` (and export) if demo includes compliance story. |

---

## 5. Implementation phases and tasks

Tasks are ordered for dependency safety. **Phase 1b is blocking** for any “AI complete” milestone.

### Phase 0 — Scaffold

| ID | Task |
|----|------|
| **J0.1** | Choose stack (Vite + React or Next.js), `API_BASE_URL` env, typed JSON client (`data` / `error` handling). |
| **J0.2** | Token persistence strategy (e.g. `sessionStorage` + memory); attach `Authorization: Bearer`. |
| **J0.3** | App shell: layout, navigation by role, protected routes. |

### Phase 1a — Identity and structure

| ID | Task |
|----|------|
| **J1.1** | Auth UI: `POST /auth/login`; optional `POST /auth/register` for seeded roles. |
| **J1.2** | Student join: `POST /enrollment/preview`, `POST /auth/signup-with-join-code`; persist active `groupId`. |
| **J1.3** | Teacher/admin: subjects & groups (`GET`/`POST /subjects`, `/groups`), join codes (`POST .../join-codes`, revoke). |

### Phase 1b — Corpus (MVP-required)

| ID | Task |
|----|------|
| **J1.4** | **Textbook ingest:** form or flow for `subjectId`, `title`, `versionLabel`, `text` → `POST /rag/sources/textbooks`; loading/error/success states. |
| **J1.5** | **Corpus search:** shared page or panel — `query`, `groupId`, `topK` → `POST /rag/query`; render hits with citations/snippets. Use in teacher and student shells. |

### Phase 2 — Assessments

| ID | Task |
|----|------|
| **J2.1** | Draft lifecycle: create, `GET` draft, `PUT .../items` (stem, options, correctKey). |
| **J2.2** | Publish: window fields → `POST .../publish` → `GET /assessments/published?groupId=`. |
| **J2.3** | Student: published list/detail, submit attempt, view own attempts. |

### Phase 3 — Insights and risk

| ID | Task |
|----|------|
| **J3.1** | Teacher insights list + `POST /insights/:insightId/status`. |
| **J3.2** | Risk view: `GET /analytics/risk`; `POST /groups/:groupId/analytics/recompute` for demos. |
| **J3.3** | Student: `GET /insights/me?groupId=`. |

### Phase 4 — Agent chat (after Phase 1b)

| ID | Task |
|----|------|
| **J4.1** | Teacher chat: `POST /agent/teacher/chat` with `message`, `groupId`. |
| **J4.2** | Student chat: `POST /agent/student/chat`. |
| **J4.3** | Inline links from chat to **WF-CORPUS-SEARCH** hits where the API returns citation hooks (or side-by-side search panel). |

### Phase 5 — Polish

| ID | Task |
|----|------|
| **J5.1** | Notifications: `GET /notifications/me`. |
| **J5.2** | Accessibility pass on golden path (WCAG 2.1 AA target per PRD). |
| **J5.3** | Empty states and copy for in-memory backend / deploy reset. |
| **J5.4** | Admin audit UI if in scope. |

---

## 6. Definition of done (frontend MVP slice)

- [ ] Golden path §3 runnable without skipping **textbook ingest** or **corpus search**.
- [ ] Teacher and student can both run **RAG query** for an enrolled/managed `groupId`.
- [ ] Agent chat screens exist for both roles **after** corpus workflows are usable.
- [ ] `api-for-frontend.md` behaviors (CORS, JWT, error shape) handled consistently.

---

## 7. Related documents

| Document | Use |
|----------|-----|
| [`platform-user-workflow.md`](./platform-user-workflow.md) | End-to-end user/API workflow and workflow IDs |
| [`api-for-frontend.md`](./api-for-frontend.md) | Endpoint details, bodies, roles |
| [`prd.md`](./prd.md) | Journeys, NFRs, AI/RAG rules |
| [`architecture.md`](./architecture.md) | System context, flow diagrams |
| [`epics.md`](./epics.md) | Full story backlog |

# Teacher-side workflow & frontend implementation spec

**Audience:** Frontend team  
**Project:** Second Teacher  
**Date:** 2026-04-11  
**API reference:** `docs/api-for-frontend.md`

This document translates the desired teacher experience into **information architecture**, **screen-level flows**, and a **backend coverage matrix** so implementation can be phased without surprise gaps.

---

## 1. Target information architecture (teacher)

Suggested primary navigation after login (teacher role):

| Area | Purpose |
|------|---------|
| **Dashboard** | Subjects the teacher can access → groups per subject → quick actions (join codes, open group). |
| **Group workspace** | Single group hub: roster, assessments, analytics tabs, agent chat entry. |
| **Notifications** | In-app list from `GET /notifications/me` (bell icon). |

**Routing sketch (example):**

- `/teacher` — dashboard (subject → group tree or cards).
- `/teacher/subjects/:subjectId` — groups for that subject only (optional intermediate page).
- `/teacher/groups/:groupId` — group home: tabs *Overview* | *Assessments* | *Analytics (results)* | *Advanced analytics* | *Agent*.
- `/teacher/groups/:groupId/students/:studentId` — individual student profile (from “See details”).

Admin-created assignments (`POST /groups/:groupId/assign-teacher`) determine which groups appear for a teacher; the UI should call `GET /groups` and filter client-side by `subjectId` after joining with `GET /subjects`, or present a flat list grouped by subject.

---

## 2. Core user flows (what to build)

### 2.1 Dashboard: subjects → groups → join codes

**Goal:** Teacher sees **assigned subjects** (via groups whose subject they teach) and **groups**, and can **generate join codes** without admin.

**API today:**

- `GET /subjects` — all subjects (teacher may see subjects they created or that appear via their groups; align with product rules).
- `GET /groups` — all groups; **client should filter** to groups where `canTeacherManageGroup` semantics match: teacher is creator or assigned (backend enforces on mutations).
- `POST /groups/:groupId/join-codes` — body optional `{ ttlHours }`; returns `{ code, groupId, expiresAt }`.
- `POST /groups/:groupId/join-codes/revoke` — `{ code }`.

**UI:**

- Card or tree: **Subject** → **Groups** (name, id for deep links).
- Per group: **“Generate join code”** → show code + copy + expiry; **Revoke** flow optional.
- **Enrollment preview** (optional): public `POST /enrollment/preview` with code for sanity check (used more on student signup).

**Gap:** No single endpoint returns “subjects with nested groups for current teacher only”; frontend composes from `GET /subjects` + `GET /groups` or backend adds `GET /teacher/workspace` later.

---

### 2.2 Assessments: manual test maker + schedule + demo note

**Product intent:**

- **Manual:** Draft → edit items → publish with **datetime window** (timezone-aware).
- **Scheduling nuance requested:** “Some tests scheduled, not all”; “available only on that date or not” — today the API has **one window per published version** (`windowOpensAtUtc`, `windowClosesAtUtc`, `windowTimezone`). “Available only on that date” = set open/close to the same calendar day in the chosen TZ, or add a future **mode** flag (not in API yet).
- **Demo:** Prefer **AI-generated** quizzes/practice from textbook to save time; **manual maker** remains but **not demoed**.

**API today (assessments):**

- `POST /assessments/drafts` `{ groupId, title }`
- `PUT /assessments/drafts/:draftId/items` `{ items: [{ stem, options, correctKey }] }`
- `POST /assessments/drafts/:draftId/publish` `{ windowOpensAtUtc, windowClosesAtUtc, windowTimezone }`
- List / detail / attempts: see `api-for-frontend.md`.

**Gaps for your spec:**

- **No** `practice` vs `quiz` vs `exam` **taxonomy** on entities — only `title` and versions. Frontend can **prefix titles** or **conventions** until backend adds `assessmentType`.
- **No** backend endpoint for “AI generate draft from book” — needs **new** `POST` (e.g. under `/assessments` or `/rag`) that accepts `groupId` / `subjectId` / `textbookSourceId` + prompt params; server calls OpenAI and maps output to `items` shape. **Frontend:** placeholder button “Generate with AI” → disabled or mock until backend ships.
- **Predictor on save / simulation / override:** **Not implemented.** Requires new APIs (see §4).

**UI (manual path):**

- Date/time picker → ISO strings for publish body (document clearly for teachers / use `Intl` + UTC storage as API expects).

---

### 2.3 Post-save predictions & simulation (desired)

**Requested:** After teacher saves/publishes, show **average, median, min, max, pass %** with “possibilities”; **Simulation** opens dialog with editable copy of items; on each edit refresh predictions; **Cancel** discards; **Save this version** overwrites draft/published (policy TBD).

**API today:** **None** for prediction or simulation.

**Frontend until backend exists:**

- Hide behind feature flag or show “Coming soon”.
- **Backend follow-up:** e.g. `POST /assessments/drafts/:id/simulate` with hypothetical item set + historical attempt distribution, or Monte Carlo; define pass threshold (e.g. ≥60%).

---

### 2.4 Group analytics page (teacher enters group)

**Requested tabs:**

- **Practice / test results** — cards + **sortable student table** + **See details** → student page.
- **Advanced analytics** — beside first tab; **group-level** line chart by type (practice / quiz / test / all); AI interpretation.
- **At-risk list** — linked students, **flair**, **AI comment** (why at risk).
- **Low-load list** — same pattern (high performers / fast finishers / need more challenge).

**API today (partial fit):**

- `GET /assessments/published?groupId=` — versions for group (teacher sees full items).
- **No** bulk “all attempts for group” for teachers — students have `.../attempts/me` only. **Gap:** `GET /groups/:groupId/attempts` or `GET /analytics/group-summary` needed for rich tables.
- `GET /analytics/risk?studentId=&groupId=` — **per-student** `snapshot` + `classification` (trend labels, ratios, etc.) — powers **risk reasoning** if UI maps fields to copy.
- `GET /insights?groupId=` — insight **cards** with `studentId`, `riskLevel`, `factors[]`, `title`, `body`, `status` — good for **at-risk** list + acknowledge/dismiss via `POST /insights/:id/status`.
- `POST /groups/:groupId/analytics/recompute` — refresh insights after data changes (optional button).
- **Low-load:** **Not** a first-class concept in API; **insights** today focus on **at_risk / watchlist / stable**. New rules or insight `type` needed.

**Charts:**

- Backend does **not** return chart specs; frontend builds charts from **aggregated** data. Aggregates require **new read endpoints** or client loops (not possible without per-student attempt APIs for teachers).

**AI interpretation of graphs:**

- **No** dedicated “explain this chart” endpoint. Options: (1) add `POST /agent/teacher/analytics-summary` with structured payload, or (2) pass summary JSON into existing `POST /agent/teacher/chat` **message** (works today as a **hack** — message = “Interpret: …” + stringified stats). Long-term: small dedicated endpoint for consistent JSON.

---

### 2.5 Individual student page

**Requested:** All results over time, **line chart** by category (practice / quiz / test / all), **percentages**, **AI trend interpretation**, **at-risk / low-load** reasoning.

**API today:**

- `GET /analytics/risk?studentId=&groupId=` — numeric features + classification + `reasons[]`.
- `GET /insights?groupId=` — filter client-side by `studentId` for teacher-facing cards.
- **No** teacher endpoint for **that student’s attempts across versions** in one call — **gap.**

**MVP UI:**

- Use **risk** + **insights** for narrative blocks; chart **stub** or partial until list attempts API exists.

---

### 2.6 AI agent chat (placement)

**Backend today:** `POST /agent/teacher/chat` `{ message, groupId }` → `{ data: { reply, tools, citations, fallback } }`. Scoped tools: **insights** + **corpus search** (textbook + published assessment **item text** in group). **Not** a free-form streaming chat model in v1 — reply is **structured** from tool outputs.

**Where to put it in UI:**

- **Persistent entry:** FAB or header button on **`/teacher/groups/:groupId`** opening a **drawer or slide-over panel** (recommended).
- **Secondary:** Tab **“Assistant”** next to Analytics.
- Show **citations** from `data.citations` (links to reader paths per `api-for-frontend.md`).
- Optional header `x-test-agent-timeout-ms` only for automated tests.

---

## 3. Backend coverage matrix (summary)

| Capability | Status | Notes |
|------------|--------|--------|
| Subjects / groups list | ✅ | Compose dashboard client-side |
| Join codes create/revoke | ✅ | |
| Assign teacher to group | ✅ | Admin only |
| Draft / items / publish + schedule window | ✅ | Single window; no assessment “type” enum |
| AI generate assessment from book | ❌ | New endpoint + OpenAI pipeline |
| Post-save score prediction & simulation | ❌ | New endpoints + rules |
| Teacher: all attempts in group (table) | ❌ | New read API |
| Teacher: student attempt history | ❌ | New read API |
| Risk per student | ✅ | `/analytics/risk` |
| Insight cards + notifications | ✅ | `/insights`, `/notifications/me` |
| At-risk list (from insights) | ✅ | Map `riskLevel` + factors |
| Low-load list | ❌ | New insight rules or endpoint |
| Group / student time-series chart data | ⚠️ | Blocked without attempt exports |
| AI chart narrative | ⚠️ | Use agent chat hack or new endpoint |
| Teacher agent chat | ✅ | `/agent/teacher/chat` |

---

## 4. Recommended implementation phases (frontend)

**Phase A — Demo path (align with stakeholder demo):**

1. Login teacher → **Dashboard** (`GET /subjects`, `GET /groups`) → **Group** page.
2. **Join code** generation UI.
3. **Agent** drawer on group page (`/agent/teacher/chat`).
4. **Insights** strip or panel: `GET /insights?groupId=` + link to student detail using **risk** call for one student as proof.
5. **Assessments:** minimal publish flow with **date pickers**; **omit** simulation/predictor or show placeholders.

**Phase B — Analytics depth**

- After backend ships **group attempt listing**, build **sortable table** + **student detail** charts.

**Phase C — AI assessment generation & prediction**

- Wire when backend endpoints exist.

---

## 5. BMad / planning follow-ups (optional)

If you want this spec turned into formal UX artifacts:

- **`bmad-create-ux-design`** — wireframes, component map, accessibility notes.
- **`bmad-create-story`** — per-phase stories with AC tied to this matrix.

Run those in a **fresh context** when ready.

---

## 6. Quick API checklist for frontend devs

- Base URL + `Authorization: Bearer <token>`.
- **All datetimes** for publish: ISO 8601 UTC strings (`windowOpensAtUtc` / `windowClosesAtUtc`) + `windowTimezone` label.
- **Group-scoped** routes always pass `groupId` from URL, not hardcoded.
- Handle `403` when teacher does not manage group.

---

*End of spec.*

# Teacher demo — frontend focus & delivery order

**Audience:** Frontend (teacher experience)  
**Project:** Second Teacher  
**Date:** 2026-04-12  
**Purpose:** Lock scope for the stakeholder demo. Ship only what proves the story end-to-end; defer everything else without losing traceability.

**Related:** [`frontend-implementation-plan.md`](./frontend-implementation-plan.md) (golden path, phases), [`teacher-frontend-workflow-spec.md`](./teacher-frontend-workflow-spec.md) (IA, API matrix), [`api-for-frontend.md`](./api-for-frontend.md).

---

## 1. What this demo must prove

| Theme | Demo outcome |
|--------|----------------|
| **Grounding** | Teaching is anchored on **subject textbooks** the teacher adds; search and AI cite the corpus. |
| **Structure** | Teacher works inside **subjects → groups**; **join codes** enroll students. |
| **Measurement** | **Assessments** (manual authoring for this demo) are scheduled; results feed **group and individual** views. |
| **Intervention** | Teacher sees **who is at risk**, **what is weak** (topics / patterns), via **insights** and **notifications**. |
| **Foresight** | **What-if predictor** (when backend exists): before or right after defining a test, the system estimates how **groups and individuals** would perform from **history + similarity** (topics, difficulty, item style). |
| **Guidance** | A **test maker manual** (in-product or linked doc) keeps authoring consistent so predictions and analytics stay interpretable. |

If a feature does not support one of these rows, it is **out of scope** for this demo track unless explicitly pulled in below.

---

## 2. In scope vs deferred (explicit)

### 2.1 In scope — teacher demo track

1. **Textbooks:** Add/manage subject textbook source (`POST /rag/sources/textbooks`); optional list or “last ingested” affordance if API supports it; link to reader/search verification.
2. **Groups & roster context:** Dashboard → group workspace; join codes; clear `groupId` in routes and API calls.
3. **Manual test maker:** Full draft → items → publish with **window** (timezone-aware). Include **authoring conventions** (topics, difficulty) documented and reflected in UI even if stored only in **item text** or **local draft metadata** until the API gains fields.
4. **Results over time (group + individual):** Tables and **planned chart layouts** for performance trends by assessment category (practice / quiz / test / all). **Implement UI structure first**; bind to real series when teacher attempt-export APIs exist (see §6).
5. **Insights & risk:** Surfaces driven by `GET /insights?groupId=`, `GET /analytics/risk?studentId=&groupId=`, optional `POST /groups/:groupId/analytics/recompute` for demo refresh.
6. **Notifications:** `GET /notifications/me` surfaced for at-risk / weak-topic signals that the backend pushes or mirrors from insights (product-dependent).
7. **What-if predictor:** Dedicated panel or step in publish flow — inputs (selected group(s), topic tags, difficulty, item count or draft reference); outputs (predicted distribution, pass rate, flagged students). **Feature-flag** or placeholder until API ships; **no silent fake numbers** in production demo without label.
8. **Test maker manual:** Single canonical place (in-app help drawer + markdown in repo under `docs/`) describing fields, tagging, scheduling, and how predictions use those tags.

### 2.2 Deferred (do not block demo on these)

- **AI-generated full assessments from textbook** (nice follow-on; backend endpoint still TBD per workflow spec).
- **Simulation loop** that mutates items and re-runs model on every edit (stretch; depends on predictor API design).
- **Low-load / “needs challenge”** list as a first-class API (not in API today; insights skew toward at-risk).
- **Admin-only** flows unless the demo script needs a one-time setup.
- **Student app polish** beyond what’s needed to generate attempts for charts/insights.

---

## 3. Demo storyboard (order to rehearse)

Use this sequence to validate wiring and narrative:

1. Teacher logs in → **dashboard** (subjects/groups) → open **group workspace**.
2. **Add textbook** for the subject → **corpus search** or reader proof that content is there.
3. **Generate join code** (if students are not pre-seeded).
4. Open **test maker** → create draft → add items following the **manual** (topics, difficulty, stems/options) → set **schedule** → publish.
5. *(Students take assessment — scripted or pre-seeded.)*
6. Teacher runs **recompute** if needed → opens **insights** / **notifications** → drills to **student** → reads **risk** narrative.
7. Teacher opens **analytics** tab: table + chart **shells** with real data when APIs allow; otherwise labeled **preview / awaiting data**.
8. Teacher opens **what-if predictor** with same topic/difficulty framing as the manual → shows forecast or **“backend pending”** state.

---

## 4. Feature pillars (acceptance-level)

### 4.1 Textbooks & corpus

- Teacher can submit textbook ingest with `subjectId`, `title`, `versionLabel`, `text`.
- Success and failure states are visible; group context is not confused with subject context.
- Teacher can run `POST /rag/query` with `groupId` and see citations usable for agent/reader follow-up.

**Gap to watch:** If the UI needs “which textbooks exist for this subject,” confirm whether `GET` exists or compose from agent/search only.

---

### 4.2 Groups, join codes, navigation

- IA matches [`teacher-frontend-workflow-spec.md`](./teacher-frontend-workflow-spec.md): dashboard → `/teacher/groups/:groupId` with tabs for overview, assessments, analytics, agent.
- Join code create/revoke uses documented endpoints; errors (403) are handled when teacher cannot manage the group.

---

### 4.3 Manual test maker + schedule

**Minimum viable:**

- Create draft (`POST /assessments/drafts`), edit items (`PUT .../items`), publish (`POST .../publish` with UTC windows + `windowTimezone`).
- List published by `groupId`.

**Demo-critical extras (until API supports metadata):**

- **Per-item optional fields in UI:** `topic` (string or controlled tags), `difficulty` (e.g. low/medium/high). Persist via:
  - **Preferred:** API fields when added to `items[]`, or
  - **Interim:** conventions in `stem` prefix `[topic: …] [diff: …]` *only if product accepts it*, or client-side-only draft state **lost on refresh** (acceptable only for earliest UI mock — document limitation).

**Manual must define:** naming assessments (e.g. prefix `Practice:` / `Quiz:` / `Test:`) so charts can filter “by type” until `assessmentType` exists on the backend.

---

### 4.4 Performances over time — group & individual

**Planned visualizations (implement layout + empty states):**

| View | Visualization | Data source (target) |
|------|----------------|----------------------|
| Group | Sortable table: student, latest scores, trend arrow | Teacher-visible attempts aggregate (API TBD) |
| Group | Line or bar series: class average over time by assessment type | Aggregated attempts by publish version / type |
| Individual | Line chart: score % over time | Student attempt history for teacher (API TBD) |
| Individual | Breakdown by topic (bar or radar) | Requires tagged items + attempt detail per topic (API TBD) |

**Until export APIs exist:** Show **wireframe charts** with copy: “Connects when group attempt listing is available,” and use **insights + risk** JSON to populate **summary cards** so the demo still has substance.

---

### 4.5 Notifications, at-risk students, weak topics

**At-risk (available now):**

- Map `GET /insights?groupId=` to a feed/cards: student link, `riskLevel`, `factors[]`, `title`, `body`, `status`.
- `GET /notifications/me` for bell/drawer; align copy with insight types so teachers understand **why** they were notified.
- Student drill-down: `GET /analytics/risk?studentId=&groupId=` for numeric snapshot + `reasons[]` / classification.

**Weak topics / weak skills:**

- If insights already encode weak areas in `factors` or `body`, **surface them explicitly** (badges, section headers).
- If not consistent, treat **“weak topics”** as a **product + backend** refinement: request structured `weakTopics: string[]` on insights or a small `GET /analytics/group-topics?groupId=` later. Frontend can reserve UI slots (group summary + student summary).

**Actions:** `POST /insights/:insightId/status` for acknowledge/dismiss where appropriate.

---

### 4.6 What-if predictor (pre-exam forecast)

**Intent:** When the teacher defines an assessment **by topics, difficulty mix, length, and format** (aligned with manual), the system estimates:

- Class **distribution** (e.g. mean, spread, estimated pass rate — exact stats product-defined).
- **Individuals** or **subgroups** flagged as likely struggling or excelling.
- Short **natural language rationale** tied to historical performance on **similar** tags (once backend defines similarity).

**Frontend contract (to build now):**

- **Input panel:** group selector, topic multi-select, difficulty mix, optional paste of draft id or item count.
- **Output panel:** distribution summary, list of students with risk band, disclaimer that model uses historical patterns.
- **States:** loading, error, empty (“not enough history”), **disabled** with link to docs if API missing.

**Backend:** No predictor endpoint today — coordinate on something like `POST /assessments/drafts/:id/predict` or `POST /analytics/predict-assessment` with `{ groupId, topicWeights, difficultyMix, itemCount }`. Frontend should not hardcode response shape until shared; use TypeScript types from OpenAPI or shared package when available.

---

## 5. Test maker manual (content outline)

Publish this as `docs/teacher-test-maker-manual.md` (or embed in app help). Sections:

1. **Purpose:** Consistent items → reliable analytics and predictions.
2. **Assessment naming:** How to encode practice vs quiz vs test until `assessmentType` exists.
3. **Items:** Stem quality, number of options, `correctKey` discipline.
4. **Topics:** Controlled vocabulary suggestion (per subject); how tags map to charts and predictor.
5. **Difficulty:** Scale definition (e.g. 1–3 or low/med/high) and when to use each.
6. **Scheduling:** UTC vs local display; same-day windows; what students see.
7. **After publish:** Recompute insights; where to look for at-risk and weak-topic signals.
8. **Predictor:** What inputs must match historical tags; minimum attempts before forecasts are meaningful.

The frontend should link to this from the **draft editor** and **predictor** screens.

---

## 6. Gap register (shared with backend)

| Need | Blocks | Owner |
|------|--------|--------|
| Teacher: list attempts for all students in a group | Group analytics table, group time series | Backend |
| Teacher: one student’s attempts across versions | Individual trend chart | Backend |
| Item-level `topic` / `difficulty` (or equivalent) | Weak-topic charts, predictor features | Backend + FE |
| `assessmentType` or agreed title convention | Filtering series by type | Product + BE + FE |
| Predictor + optional simulation endpoint | What-if UI for real numbers | Backend + ML/product |
| Structured weak-topic on insights or analytics endpoint | Dedicated weak-topic module without parsing copy | Backend |
| Optional: AI draft from textbook | Faster demo prep | Backend |

---

## 7. Implementation order (one-by-one, reliable)

Each step is **done** when the prior step’s demo path still runs. Parallel work is allowed only where noted.

| Step | Deliverable | Depends on |
|------|-------------|------------|
| **T1** | Auth, role guard, teacher shell, dashboard (`GET /subjects`, `GET /groups`), group route | Phase 0–1a |
| **T2** | Join codes UI on group | T1 |
| **T3** | Textbook ingest + corpus search (group-scoped) | T1, Phase 1b |
| **T4** | Manual test maker: draft/items/publish + schedule + link to **test maker manual** | T1 |
| **T5** | Published list for group; student take flow **or** scripted data creation (coordination) | T4 |
| **T6** | Insights panel + risk drill + recompute + notification bell | T1, attempts preferable |
| **T7** | Analytics tab: **table shell** + **chart placeholders** with real binding behind feature flag or API version check | T5 + gap APIs |
| **T8** | What-if predictor **UI** + empty/disabled states; wire to API when ready | T4, metadata conventions |
| **T9** | Agent drawer on group page (citations) for “explain this class” follow-ups | T3 |

**Suggested focus for “very important” demo minimum:** **T1 → T4 → T6** plus **T3**; **T7** with honest placeholders if APIs slip; **T8** UI shell early so narrative is complete.

---

## 8. Checklist before calling the demo “ready”

- [ ] Golden path §3 in [`frontend-implementation-plan.md`](./frontend-implementation-plan.md) runnable with **textbook** + **manual publish** + **insights/risk**.
- [ ] Test maker manual exists and is linked from the editor.
- [ ] At-risk and weak-signal copy is understandable (no raw JSON for teachers).
- [ ] Charts either show **real** teacher-visible aggregates or **explicit** “waiting for API” — no misleading random data.
- [ ] Predictor labeled correctly when backend is absent.
- [ ] JWT expiry and in-memory backend called out in UI where relevant.

---

*End of document.*

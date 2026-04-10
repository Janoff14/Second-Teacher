---
stepsCompleted:
  - step-01-init.md
  - step-02-discovery.md
  - step-02b-vision.md
  - step-02c-executive-summary.md
  - step-03-success.md
  - step-04-journeys.md
  - step-05-domain.md
  - step-06-innovation.md
  - step-07-project-type.md
  - step-08-scoping.md
  - step-09-functional.md
  - step-10-nonfunctional.md
  - step-11-polish.md
  - step-12-complete.md
inputDocuments:
  - docs/second-teacher-product-brief.md
  - _bmad-output/planning-artifacts/second-teacher-product-brief.md
workflowType: prd
classification:
  projectType: web_app
  domain: edtech
  complexity: medium
  projectContext: greenfield
documentCounts:
  briefCount: 2
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 1
expeditedNote: PRD produced in one pass per user request; validate with bmad-validate-prd if needed.
docsMirrorNote: Identical to _bmad-output/planning-artifacts/prd.md; edit both or regenerate copy when changing PRD.
---

# Product Requirements Document — Second Teacher

**Author:** Sanja  
**Date:** 2026-04-10  
**Version:** 0.1  
**Status:** Draft for review  

## Document control

| Input | Location |
|--------|----------|
| Product brief | `docs/second-teacher-product-brief.md` |

---

## 1. Executive summary

**Second Teacher** is a web platform for teachers and students that **detects academic risk early**, **surfaces explainable signals** (trends, practice gaps, anomalies), and **proactively nudges** both roles via in-product AI agents. Remediation suggestions are **grounded in retrieval** over **textbooks** and **published** assessments (RAG), with optional **curated external** sources—never unconstrained open web in MVP.

**Primary differentiation:** timely, evidence-backed interventions tied to course materials—not only dashboards after failure.

---

## 2. Product vision

- **For teachers:** See who needs help before the next high-stakes assessment, with ranked priorities and concrete talking points backed by stats.
- **For students:** Get supportive, actionable guidance while there is still time to improve, with reading and practice pointers tied to the real curriculum.
- **For institutions (later):** Operational visibility into intervention effectiveness (metrics in §6).

---

## 3. Goals and success metrics

### 3.1 Business / product goals

1. Reduce **time-to-detection** of struggling learners vs. baseline (teacher survey or proxy: days before test).
2. Increase **intervention adoption** (clicks, completed recommended practice, teacher acknowledgments).
3. Improve **readiness** for the next assessment in flagged cohorts (score delta, pass-rate proxy).

### 3.2 Key metrics (MVP instrumentation)

| Metric | Definition |
|--------|------------|
| Risk signal latency | Time from eligible data (e.g., new attempt) to insight available |
| Proactive reach | % of at-risk users who receive at least one agent nudge in window |
| Recommendation follow-through | % who open linked practice / textbook sections |
| Outcome proxy | Score or percentile change on next summative vs. prior baseline |

### 3.3 Non-goals (MVP)

- Replacing teacher judgment; AI is **decision support** only.
- Guaranteed pass/fail **prediction** as a product claim.
- Unmoderated open-internet retrieval for student-facing answers.

---

## 4. Users and personas

| Persona | Needs |
|---------|--------|
| **Teacher** | Class and individual analytics, at-risk lists, anomalies, proactive alerts, links to student context, RAG-backed suggestions for interventions. |
| **Student** | Calendar of scheduled work, practice list, personal analytics, proactive nudges, weak-area focus, citations to textbook/published items. |
| **Admin** | Create/manage teacher access (prefer invite-based onboarding), associate subjects and groups, institutional configuration (future: tenancy). |

---

## 5. User journeys (summary)

### 5.1 Teacher — “Spot risk early”

1. Logs in → sees dashboard for subjects/groups.  
2. Opens group → sees summary cards and **insight feed** (proactive agent highlights).  
3. Drills into **at-risk** student → sees **factors** (trends, missing practice, time-on-task vs. baseline).  
4. Uses **agent chat** to ask “What should I assign?” → receives **RAG-grounded** textbook sections + suggested published practice.  
5. (Optional) Acknowledges or dismisses insight (feeds product learning / noise reduction later).

### 5.2 Student — “Get help before the test”

1. Joins via **secure join code**, completes signup.  
2. Sees **calendar** + **practice** tab.  
3. Receives **proactive message** when risk model flags watchlist/at-risk → explanation + next steps.  
4. Chats with agent → answers **cite** textbook/published content; optional curated external when enabled by policy.  

### 5.3 Admin — “Onboard teaching staff”

1. Creates teacher via **invite** (email link to set password).  
2. Assigns subjects and groups; manages join codes policy (expiry, rotation).

---

## 6. Domain, compliance, and ethics

- **Domain:** EdTech; **complexity:** medium per BMAD `domain-complexity` (edtech row).  
- **Privacy:** Plan for **student data minimization**, **role-based access**, **audit logs** for sensitive views; align with **FERPA**-style practices and regional equivalents as the product’s market is chosen. **COPPA** / age gating if K–12 minors.  
- **Accessibility:** Target **WCAG 2.1 AA** for student/teacher web UI (explicit backlog).  
- **AI safety:** Structured **feature inputs** to LLM; **citations** for RAG; **disclaimers** on insights; teacher override always available.

---

## 7. Project type and technical scope

- **Type:** Multi-role **web application** (SPA or SSR acceptable per stack choice); **backend-first** implementation priority per brief.  
- **Real-time:** Nice-to-have for notifications; MVP may use **polling** or **SSE** for insight delivery.  
- **Integrations (post-MVP candidates):** SIS, LMS SSO, email provider.

---

## 8. MVP scope

### 8.1 Must-have capabilities

| ID | Capability |
|----|------------|
| F-001 | **Authentication & RBAC:** admin, teacher, student; session or token-based API security. |
| F-002 | **Org structure:** subjects, groups, teacher assignments, student enrollment via **high-entropy join codes** (rate limits, optional expiry/revocation). |
| F-003 | **Assessments:** items, attempts, scoring; **draft vs publish**; immutable **published version ID** on all student attempts; no retroactive mutation of historical attempts. |
| F-004 | **Scheduling:** assessments available windows; **timezone-aware** storage (UTC + tz id or instant range). |
| F-005 | **Analytics core:** deterministic aggregates (trends, completion, recency, baseline deviation) feeding **risk tiers** (e.g., Stable / Watchlist / At-Risk). |
| F-006 | **Insights & notifications:** persisted insight records; proactive surfaces in UI for teacher and student; configurable thresholds (defaults documented). |
| F-007 | **Agent chat:** separate experiences for teacher and student; **tool-based** access to allowed APIs; no cross-student data leakage. |
| F-008 | **RAG:** ingest **textbooks** (subject-scoped) and **published** assessment content; chunk, embed, retrieve with **ACL metadata**; responses include **citations**; re-ingest on publish/version change. |
| F-009 | **Textbook assets:** upload, virus/size limits, store references for ingestion pipeline. |
| F-010 | **Audit:** log admin/teacher access to sensitive student analytics (minimum viable audit trail). |

### 8.2 Should-have (MVP+ if time permits)

| ID | Capability |
|----|------------|
| F-011 | **Simulation / what-if** for unpublished assessment edits (branch drafts; no effect on locked attempts). |
| F-012 | **Curated external** retrieval allowlist per tenant/subject. |
| F-013 | **Digest** mode (daily summary) in addition to real-time flags. |

### 8.3 Out of scope (MVP)

- Full **LMS** replacement, SIS sync, mobile native apps.  
- **Proctored** high-stakes exam certification.  
- Unrestricted **open web** search for students.  
- Automated **final grade** decisions without teacher approval.

---

## 9. Functional requirements (detail)

### 9.1 Identity and access

- Teachers created by admin via **invite**, not long-lived shared passwords.  
- Students self-register with **valid join code**; server returns **non-enumerable** preview (subject title, teacher display name) only after code validation.  
- Every API enforces **tenant/subject/group** scope (even if single-tenant MVP, model for future **multi-tenant**).

### 9.2 Assessment lifecycle

- **Draft:** editable; not visible to students (default).  
- **Publish:** creates new immutable version; triggers **RAG sync** for that version’s retrievable content policy (questions/stems as allowed by policy—**solutions** visibility rules TBD, see §12).  
- **Attempts:** reference `published_assessment_version_id`; scores and timing stored for analytics.

### 9.3 Risk and insights

- Risk computed from **transparent features** documented in API/schema (e.g., `feature_vector` JSON).  
- **Insight** entities: `kind`, `severity`, `subject_id`, `group_id`, `student_id` (nullable for class-level), `evidence`, `confidence`, `valid_from` / `valid_until`, `status` (active/acknowledged/dismissed).  
- **Proactive triggers:** threshold crossing, new published test within N days, sudden cohort anomaly (optional rule set v1).

### 9.4 AI agent

- Agents use **tools** only (no direct DB); tools: `get_insights`, `get_student_summary` (teacher), `get_own_progress` (student), `search_course_corpus` (RAG), `get_schedule`, optional `search_curated_web` (off by default for students).  
- All **student-facing** remediation must prefer **RAG hits**; if no hit, say so and suggest teacher/office hours—not fabricate citations.

### 9.5 RAG

- **Ingestion:** on file upload (textbook) and on **assessment publish**; job queue acceptable.  
- **Chunks** carry: `source_type`, `source_id`, `version`, `subject_id`, `visibility`, citation anchor.  
- **Retrieval:** filter by caller’s ACL; top-k + **rerank** optional; log query metadata without unnecessary PII in plain text logs.

---

## 10. Non-functional requirements

| Area | Requirement |
|------|-------------|
| **Security** | OWASP ASVS-aligned API practices; secrets in vault/env; rate limits on auth and join validation. |
| **Privacy** | Data retention policy documented; export/delete requests path (even if manual in MVP). |
| **Performance** | P95 API < 300ms for core reads (excluding heavy analytics batch); RAG path P95 target < 3s with timeout fallback. |
| **Reliability** | Ingestion retries; idempotent publish webhooks/jobs. |
| **Observability** | Structured logs, correlation ids, basic metrics on insight and RAG jobs. |
| **Accessibility** | WCAG 2.1 AA for primary flows (tracked in QA). |

---

## 11. Dependencies and assumptions

- **Assumption:** Single institution or single-tenant MVP; data model still **includes** `organization_id` for forward compatibility.  
- **Assumption:** LLM and embedding providers available; keys via secure config.  
- **Dependency:** Object storage for textbook binaries; vector DB or pgvector-style store for embeddings.

---

## 12. Open questions

1. **Solutions in RAG:** Are answer keys / explanations in the student corpus before due date, or only after?  
2. **Risk thresholds:** Default numeric cutoffs per institution vs. global defaults?  
3. **Insight refresh:** Event-driven only vs. nightly recompute?  
4. **External sources:** Which providers/domains are on the allowlist per deployment?  
5. **Market:** US FERPA-focused first vs. EU GDPR addendum from day one?

---

## 13. Rollout and validation

- **Internal alpha:** synthetic class data; validate RBAC and RAG citations.  
- **Pilot:** one subject, one institution; measure §3 metrics.  
- **BMAD next steps:** `[CA] Create Architecture` (`bmad-create-architecture`), then `[CE] Create Epics and Stories` (`bmad-create-epics-and-stories`); optionally `[VP] Validate PRD` (`bmad-validate-prd`).

---

## 14. Glossary

| Term | Meaning |
|------|--------|
| **Publish** | Make an assessment version immutable and available per schedule rules. |
| **Insight** | A persisted, explainable signal for UI/agent consumption. |
| **RAG** | Retrieval-augmented generation over approved corpus. |

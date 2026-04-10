---
stepsCompleted:
  - step-01-init.md
  - step-02-discovery.md
  - step-03-starter.md
  - step-04-decisions.md
  - step-05-patterns.md
  - step-06-structure.md
  - step-07-validation.md
  - step-08-complete.md
inputDocuments:
  - docs/prd.md
  - docs/second-teacher-product-brief.md
workflowType: architecture
project_name: Second-Teacher
user_name: Sanja
date: 2026-04-10
classification:
  projectType: web_app
  domain: edtech
  complexity: medium
expeditedNote: Architecture produced in one pass per user request.
---

# Second Teacher Architecture Decision Document

## 1) Architecture Summary

Second Teacher uses a backend-first, service-oriented web architecture:
- API and auth boundary for admin/teacher/student role-based access.
- Transactional data store for core learning operations (subjects, groups, assessments, attempts, insights).
- Async pipeline for analytics and RAG ingestion.
- AI orchestration layer that calls internal tools/services instead of direct database access.
- Vector retrieval constrained by strict ACL filters and citation metadata.

This structure prioritizes correctness (assessment version integrity), explainability (risk evidence), and controlled AI behavior (tool-mediated + grounded).

## 2) High-Level Components

1. **Web App (Teacher/Student/Admin UI)**
   - Role-aware UI routes.
   - Dashboard, analytics, practice, calendar, and chat surfaces.

2. **API Gateway / Application API**
   - AuthN/AuthZ, RBAC, request validation, rate limiting.
   - CRUD and query endpoints for all domain entities.

3. **Core Domain Service**
   - Subject/group/enrollment.
   - Assessment draft/publish lifecycle.
   - Attempt capture and scoring.

4. **Insights Service**
   - Computes deterministic risk features and insight states.
   - Stores explainable factors and confidence.

5. **RAG Ingestion Service**
   - Extracts/chunks/embeds textbooks and published assessment artifacts.
   - Emits versioned vector records with ACL metadata.

6. **Retrieval Service**
   - Query-time ACL filtering + ranking + citation assembly.

7. **AI Agent Orchestrator**
   - Teacher agent and student agent.
   - Tool-calling only (`get_insights`, `search_course_corpus`, `get_schedule`, etc.).

8. **Jobs / Queue**
   - Publish-triggered reindex.
   - Periodic insight recomputation.
   - Notification dispatch.

9. **Storage Layer**
   - Relational DB for transactional entities.
   - Object storage for textbook files.
   - Vector index for semantic retrieval.

## 3) Core Architectural Decisions

### AD-001: Draft and publish are separate lifecycle states
- **Decision:** Students can only access immutable published versions; attempts always bind to `published_assessment_version_id`.
- **Why:** Prevents retroactive data corruption and ensures analytics traceability.

### AD-002: Risk flags are deterministic first; LLM explains, not decides
- **Decision:** Compute risk from transparent feature rules. AI narrative is generated from structured evidence.
- **Why:** Improves trust, debuggability, and compliance posture.

### AD-003: Tool-only AI orchestration
- **Decision:** Agents never query DB directly; they call scoped APIs/tools.
- **Why:** Enforces least privilege and consistent policy checks.

### AD-004: RAG only over approved scoped corpora
- **Decision:** Default corpus includes textbooks and published assessments; optional curated external sources behind policy toggle.
- **Why:** Keeps guidance grounded and auditable.

### AD-005: ACL metadata attached to every retrievable chunk
- **Decision:** Vector entries include role and scope metadata (`org_id`, `subject_id`, `group_id`, `visibility`, `version`).
- **Why:** Prevents cross-user leakage in retrieval.

### AD-006: Event-driven + scheduled insight generation
- **Decision:** Recompute on key events (attempt submitted, publish) and nightly sweep.
- **Why:** Balances freshness with cost and operational stability.

## 4) Domain Model (backend)

- **Identity:** `User`, `Role`, `Membership`
- **Teaching structure:** `Subject`, `Group`, `TeacherAssignment`, `Enrollment`, `JoinCode`
- **Assessment:** `AssessmentDraft`, `AssessmentVersion`, `AssessmentItem`, `ScheduleWindow`, `Attempt`, `AttemptItemResult`
- **Analytics:** `RiskFeatureSnapshot`, `Insight`, `InsightAcknowledgement`
- **RAG:** `ContentSource`, `ContentVersion`, `Chunk`, `EmbeddingRecord`, `Citation`
- **AI ops:** `AgentConversation`, `AgentMessage`, `ToolInvocationLog`

Key constraints:
- `Attempt` references immutable `AssessmentVersion`.
- `JoinCode` is random high-entropy, revocable, optionally expiring.
- `Insight` stores both machine factors and rendered reason text.

## 5) Request and Processing Flows

### Flow A: Assessment Publish
1. Teacher publishes draft.
2. API creates `AssessmentVersion` snapshot.
3. Publish event enqueued.
4. RAG ingestion indexes versioned content.
5. Insights service refreshes related risk computations.

### Flow B: Attempt Submission
1. Student submits attempt against specific `AssessmentVersion`.
2. Domain service scores and stores results.
3. Event emitted to insights queue.
4. Insights recomputed; proactive alerts generated if thresholds crossed.

### Flow C: Agent Response (Teacher)
1. Teacher asks question in chat.
2. Agent orchestrator calls `get_insights` + `search_course_corpus`.
3. Retrieval service applies ACL filters and returns citations.
4. Agent returns answer with evidence and linked actions.

## 6) API Boundaries (initial)

- `POST /auth/invite-teacher`
- `POST /auth/signup-student-with-join-code`
- `POST /subjects`, `POST /groups`, `POST /enrollments`
- `POST /assessments/drafts`, `POST /assessments/{id}/publish`
- `POST /attempts`, `GET /students/{id}/analytics`
- `GET /insights`, `POST /insights/{id}/ack`
- `POST /rag/sources/textbooks`, `POST /rag/query`
- `POST /agent/teacher/chat`, `POST /agent/student/chat`

## 7) Security, Privacy, and Governance

- RBAC + scope checks on every endpoint and retrieval call.
- Rate limit auth and join-code endpoints.
- Minimize PII in prompts and logs.
- Keep full audit trail for sensitive analytics views and AI actions.
- Policy guardrails:
  - no deterministic fail/pass claims,
  - confidence surfaced for risk summaries,
  - teacher override remains primary decision path.

## 8) Reliability and Performance Targets

- P95 API reads under 300 ms for core non-AI endpoints.
- P95 RAG answer assembly under 3 s with timeout fallback.
- At-least-once queue processing with idempotent consumers.
- Retry strategy for embedding/ingestion jobs.

## 9) Deployment and Environments

- **Env tiers:** local, staging, production.
- **Config:** environment variables + secret manager.
- **Migrations:** schema-first with versioned migrations.
- **Observability:** structured logs, traces, metrics on:
  - publish pipeline latency,
  - insight recompute latency,
  - retrieval hit rate and citation coverage.

## 10) Risks and Mitigations

1. **Risk model noise**
   - Mitigation: threshold tuning, insight dismiss/feedback loop, cohort calibration.
2. **RAG leakage**
   - Mitigation: mandatory ACL filtering + retrieval integration tests.
3. **Cost spikes from agent usage**
   - Mitigation: caching, response budgets, async summaries.
4. **Content drift from textbook revisions**
   - Mitigation: content versioning and stale index invalidation on replace.

## 11) Implementation Sequence

1. Identity/RBAC + org/subject/group/enrollment.
2. Assessment draft/publish and immutable attempts.
3. Deterministic analytics and insights store.
4. Notification/proactive feed.
5. RAG ingest + retrieval with citations.
6. Teacher/student agent chat over tool APIs.

## 12) Next BMAD Steps

- `[CE] Create Epics and Stories` using this architecture and PRD.
- Optional: `[IR] Check Implementation Readiness` after epics/stories are drafted.

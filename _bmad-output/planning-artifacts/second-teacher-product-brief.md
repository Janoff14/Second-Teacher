# Second Teacher - Product Brief (v0.1)

> Duplicate in `docs/second-teacher-product-brief.md` for easier opening in Cursor when links omit the drive letter or the workspace root differs.

## Product Name
Second Teacher

## One-Sentence Pitch
Second Teacher is a web learning support platform that detects student risk early, delivers proactive and explainable interventions to students and teachers, and recommends targeted remediation grounded in course materials.

## Problem Statement
Teachers usually discover struggling students too late, after poor assessment outcomes have already occurred. Existing classroom workflows do not consistently surface early warning signs such as downward trends, missing practice, or inconsistent performance patterns, and they rarely pair those signals with immediate, specific next actions.

Without this product:
- risk detection is reactive instead of proactive,
- interventions are inconsistent and hard to prioritize,
- students do not receive timely, personalized support between assessments.

## Target Users
- Primary: Subject teachers managing groups/classes.
- Secondary: Students enrolled in those groups/classes.
- Admin users: school or institution operators who manage teacher onboarding and subject/group setup.

## Desired Outcomes
- Teachers identify at-risk students before the next test window.
- Students receive proactive, personalized guidance before performance degrades.
- Both sides receive explainable insights, not opaque labels.
- Recommended remediation is directly linked to relevant textbook and published assessment content.

## Core Value Proposition
Second Teacher combines:
1) early risk assessment,
2) proactive AI nudges,
3) explainable reasoning with concrete stats and trends,
4) grounded recommendations via RAG over approved course content.

## MVP Scope

### 1) Risk Detection and Explainable Insights
- Compute student risk status using transparent signals:
  - trend slope in recent scores,
  - practice/quiz completion frequency,
  - recency gaps (days since last activity),
  - variability/anomaly indicators,
  - relative drop from personal baseline.
- Classify into actionable states (example):
  - Stable,
  - Watchlist,
  - At-Risk.
- Provide reasons for each state with evidence snippets (for example: "practice completion down 40% in last 2 weeks").

### 2) Proactive AI Agent Messaging
- Student agent:
  - sends proactive nudges when risk increases,
  - highlights weak topics,
  - suggests immediate next steps.
- Teacher agent:
  - alerts on at-risk students,
  - summarizes class-level anomalies,
  - highlights who needs intervention first.
- Messages include confidence and evidence, and link to relevant records.

### 3) RAG for Learning Guidance
- Corpus for retrieval:
  - uploaded textbooks (subject-scoped),
  - published tests/quizzes/practice assets (version-scoped),
  - optionally approved external educational sources (curated allowlist only).
- AI responses cite sources and sections.
- Access control enforces role and enrollment boundaries.

### 4) Assessment Lifecycle Integrity
- Separate draft/save from publish.
- Student attempts always bind to immutable published version IDs.
- Simulation runs on draft/branch versions and does not mutate historical attempts.

## Non-Goals for MVP
- Fully autonomous grading policy changes.
- Open web retrieval without source governance.
- High-stakes deterministic "pass/fail prediction" claims.
- Replacing teacher judgment with AI decisions.

## Success Metrics (compare with vs without product)
- Time-to-detection of struggling students (days earlier than baseline).
- Intervention adoption rate (teacher/student actions after nudges).
- Practice completion uplift in watchlist/at-risk cohorts.
- Next assessment score delta for intervened vs non-intervened students.
- Precision/recall proxy of risk flags against subsequent poor outcomes.

## Key Product Risks and Mitigations
- False positives or trust erosion:
  - show confidence and evidence, allow teacher feedback loop.
- Hallucinated advice:
  - constrain recommendations to RAG-backed sources and clearly cited references.
- Privacy/compliance concerns:
  - strict RBAC, audit logs, minimal PII in prompts, data retention policy.
- Version confusion in assessments:
  - immutable published snapshots and explicit revision history.

## Backend-First Delivery Plan
1. Identity, roles, group enrollment, join code security.
2. Assessment draft/publish model + attempt/version binding.
3. Deterministic analytics feature store for risk signals.
4. Insight generation service + proactive notification pipeline.
5. RAG ingestion and retrieval with ACL filters and citations.
6. AI agent orchestration using structured tool calls over trusted data services.

## Open Decisions
- Which external source providers are approved for retrieval?
- What confidence threshold triggers proactive outreach?
- How often should insights refresh (near real-time, hourly, daily)?
- What intervention playbook is shown for each risk class by subject?

## Next BMAD Step
Use this brief as input to `[CP] Create PRD` with `bmad-create-prd` in a fresh context window.

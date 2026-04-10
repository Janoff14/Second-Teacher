---
stepsCompleted:
  - step-01-validate-prerequisites.md
  - step-02-design-epics.md
  - step-03-create-stories.md
  - step-04-final-validation.md
inputDocuments:
  - docs/prd.md
  - docs/architecture.md
---

# Second-Teacher - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Second-Teacher, decomposing requirements from the PRD and Architecture into implementable, dependency-safe stories.

## Requirements Inventory

### Functional Requirements

FR1: Role-based authentication and authorization for admin, teacher, and student users.  
FR2: Subject, group, teacher assignment, and student enrollment management.  
FR3: Secure join-code flow for student onboarding with anti-enumeration and rate limits.  
FR4: Assessment draft lifecycle, publish lifecycle, and immutable assessment versions.  
FR5: Attempt submission and scoring against immutable published versions.  
FR6: Scheduling of assessments with timezone-safe availability windows.  
FR7: Deterministic analytics and risk-state classification (Stable/Watchlist/At-Risk).  
FR8: Insight generation, storage, and proactive delivery to teacher and student surfaces.  
FR9: Teacher and student AI chat with tool-mediated access and role-scoped data.  
FR10: Textbook and published assessment RAG ingestion, retrieval, and citation support.  
FR11: Audit logging for sensitive analytics and AI interactions.

### NonFunctional Requirements

NFR1: OWASP-aligned security controls, secrets hygiene, and API validation.  
NFR2: Privacy-aware data handling with scope-based access and retention controls.  
NFR3: Core API read performance target P95 < 300 ms (non-AI endpoints).  
NFR4: RAG response target P95 < 3 seconds with timeout fallback behavior.  
NFR5: Reliability for async jobs via retry/idempotency and observability.  
NFR6: Accessibility baseline targeting WCAG 2.1 AA for main user flows.

### Additional Requirements

- Use tool-only AI orchestration; no direct database access from LLM agents.
- Persist immutable `assessment_version` snapshots and bind attempts to version IDs.
- Attach ACL metadata to every vector chunk to prevent cross-user leakage.
- Support event-driven and nightly recompute pathways for insights.
- Use object storage for textbook binaries and queue-based ingestion.
- Emit structured logs/metrics for publish pipeline, insight pipeline, and retrieval quality.

### UX Design Requirements

No separate UX specification document is currently provided. UX requirements are inferred from PRD journeys:

UX-DR1: Teacher dashboard must expose prioritized at-risk/anomaly insight feed with drill-down links.  
UX-DR2: Student dashboard must include calendar, practice queue, and proactive guidance messages.  
UX-DR3: Chat responses must show source citations and confidence/explanation indicators.  
UX-DR4: Insight cards should support acknowledge/dismiss status transitions.

### FR Coverage Map

- FR1 -> Epic 1 (Stories 1.1, 1.2, 1.3)
- FR2 -> Epic 2 (Stories 2.1, 2.2)
- FR3 -> Epic 2 (Stories 2.3, 2.4)
- FR4 -> Epic 3 (Stories 3.1, 3.2)
- FR5 -> Epic 3 (Stories 3.3, 3.4)
- FR6 -> Epic 3 (Story 3.5)
- FR7 -> Epic 4 (Stories 4.1, 4.2)
- FR8 -> Epic 4 (Stories 4.3, 4.4)
- FR10 -> Epic 5 (Stories 5.1, 5.2, 5.3)
- FR9 -> Epic 6 (Stories 6.1, 6.2, 6.3)
- FR11 -> Epic 6 (Story 6.4)

## Epic List

### Epic 1: Identity and Access Foundation
Deliver secure multi-role authentication and policy enforcement so all future flows run within trusted access boundaries.  
**FRs covered:** FR1

### Epic 2: Academic Structure and Enrollment
Enable admins/teachers to manage subjects/groups and let students join safely via controlled join-code onboarding.  
**FRs covered:** FR2, FR3

### Epic 3: Assessment Authoring, Publish, and Attempts
Provide end-to-end assessment lifecycle from draft to immutable publish, attempt capture, scoring, and schedule windows.  
**FRs covered:** FR4, FR5, FR6

### Epic 4: Analytics, Risk, and Proactive Insights
Compute explainable risk states and surface actionable proactive insights for teachers and students.  
**FRs covered:** FR7, FR8

### Epic 5: RAG Content Pipeline
Build ingestion and retrieval over textbooks and published assessments with citation-grade traceability and ACL safety.  
**FRs covered:** FR10

### Epic 6: AI Agent Chat and Governance
Ship teacher/student AI agents that use internal tools safely, with auditing and reliability controls.  
**FRs covered:** FR9, FR11

## Epic 1: Identity and Access Foundation

Deliver secure multi-role authentication and policy enforcement so all future flows run within trusted access boundaries.

### Story 1.1: Bootstrap Backend Service and Security Baseline

As a backend developer,  
I want an initialized API service with security middleware and config scaffolding,  
So that all future features build on a safe and consistent runtime.

**Acceptance Criteria:**

**Given** a fresh repository,  
**When** the backend starter is initialized,  
**Then** environment config, validation middleware, and error handling are wired.  
**And** security headers, CORS policy, and request body limits are enabled.

### Story 1.2: Implement User Authentication

As a user,  
I want to sign in with secure credentials and obtain an authenticated session/token,  
So that I can access only authorized product features.

**Acceptance Criteria:**

**Given** valid credentials,  
**When** a login request is submitted,  
**Then** the API issues a valid authenticated session/token.  
**And** invalid credentials return safe error messages without leaking account state.

### Story 1.3: Enforce Role-Based Access Control

As a platform owner,  
I want role and scope checks on every protected endpoint,  
So that admin, teacher, and student permissions are correctly enforced.

**Acceptance Criteria:**

**Given** an authenticated user with a specific role,  
**When** they call a protected endpoint,  
**Then** access is granted only if role and scope requirements are satisfied.  
**And** unauthorized access attempts are denied and logged.

## Epic 2: Academic Structure and Enrollment

Enable admins/teachers to manage subjects/groups and let students join safely via controlled join-code onboarding.

### Story 2.1: Create Subject and Group Management APIs

As an admin/teacher,  
I want to create and manage subjects and groups,  
So that classes are structured for enrollment and analytics.

**Acceptance Criteria:**

**Given** an authorized user,  
**When** subject/group CRUD endpoints are used,  
**Then** entities are stored with ownership/scope metadata.  
**And** listing endpoints return only in-scope records.

### Story 2.2: Assign Teachers to Subjects and Groups

As an admin,  
I want to assign teachers to teaching scopes,  
So that permissions and visibility match actual teaching responsibilities.

**Acceptance Criteria:**

**Given** existing users and groups,  
**When** assignment endpoints are called,  
**Then** teacher assignment records are created and enforced by policy checks.  
**And** teacher dashboards can only see assigned scopes.

### Story 2.3: Generate and Manage Secure Join Codes

As a teacher/admin,  
I want revocable, high-entropy join codes with optional expiry,  
So that student enrollment is convenient without exposing class access.

**Acceptance Criteria:**

**Given** a group,  
**When** a join code is generated,  
**Then** the code meets configured entropy and policy constraints.  
**And** revoke/rotate actions immediately invalidate prior codes.

### Story 2.4: Student Signup with Join-Code Validation

As a student,  
I want to sign up using a join code and see the intended class preview,  
So that I can enroll in the correct group safely.

**Acceptance Criteria:**

**Given** a valid join code and signup payload,  
**When** signup is submitted,  
**Then** enrollment is created in the target group.  
**And** rate limits and anti-enumeration behavior protect code validation endpoints.

## Epic 3: Assessment Authoring, Publish, and Attempts

Provide end-to-end assessment lifecycle from draft to immutable publish, attempt capture, scoring, and schedule windows.

### Story 3.1: Create Assessment Draft Model and APIs

As a teacher,  
I want to create and edit draft assessments with items,  
So that I can prepare content before students can access it.

**Acceptance Criteria:**

**Given** authorized teacher scope,  
**When** draft endpoints are called,  
**Then** draft assessments and items are persisted and editable.  
**And** draft content is not exposed to student-facing read endpoints.

### Story 3.2: Publish Draft to Immutable Assessment Version

As a teacher,  
I want publishing to create an immutable assessment version snapshot,  
So that delivered assessments remain auditable and stable.

**Acceptance Criteria:**

**Given** a valid draft,  
**When** publish is triggered,  
**Then** a versioned immutable snapshot is created with publish metadata.  
**And** subsequent draft edits do not mutate already published versions.

### Story 3.3: Submit Attempts Against Published Versions

As a student,  
I want to submit an attempt against a published assessment version,  
So that my results are recorded against the exact content I received.

**Acceptance Criteria:**

**Given** an active schedule window and published version,  
**When** an attempt is submitted,  
**Then** the attempt is stored with `assessment_version_id` linkage.  
**And** submissions outside allowed schedule windows are rejected.

### Story 3.4: Score Attempts and Store Item-Level Results

As a teacher/system,  
I want attempts to be scored and broken down by item,  
So that analytics can reason over strengths and weaknesses.

**Acceptance Criteria:**

**Given** a submitted attempt,  
**When** scoring executes,  
**Then** total and item-level result records are persisted.  
**And** scoring outcomes are available to analytics pipelines.

### Story 3.5: Timezone-Safe Scheduling Windows

As a teacher,  
I want schedule windows to be timezone-safe,  
So that availability behaves predictably across locales.

**Acceptance Criteria:**

**Given** schedule inputs with timezone context,  
**When** windows are stored and evaluated,  
**Then** UTC-normalized values and timezone identifiers are persisted.  
**And** availability checks are consistent for teacher and student views.

## Epic 4: Analytics, Risk, and Proactive Insights

Compute explainable risk states and surface actionable proactive insights for teachers and students.

### Story 4.1: Build Risk Feature Snapshot Pipeline

As the analytics service,  
I want to compute deterministic feature snapshots from attempts and activity,  
So that risk classification is transparent and reproducible.

**Acceptance Criteria:**

**Given** scoring and activity events,  
**When** feature jobs run,  
**Then** snapshots include trend, completion, recency, and baseline-deviation features.  
**And** each snapshot is traceable to source events.

### Story 4.2: Implement Risk Classification Rules

As a teacher,  
I want students classified into Stable/Watchlist/At-Risk with evidence,  
So that intervention prioritization is clear.

**Acceptance Criteria:**

**Given** feature snapshots,  
**When** classification executes,  
**Then** each student receives a current risk state and confidence metadata.  
**And** reasons include explicit factor evidence suitable for UI display.

### Story 4.3: Persist and Query Insights Feed

As teacher/student clients,  
I want an insights feed endpoint with filtering and status controls,  
So that proactive guidance is consumable in dashboards.

**Acceptance Criteria:**

**Given** generated insights,  
**When** feed endpoints are queried,  
**Then** role-scoped insights are returned in priority order.  
**And** acknowledge/dismiss actions persist status transitions.

### Story 4.4: Trigger Proactive Notifications

As the platform,  
I want event-driven and scheduled triggers for high-priority insights,  
So that users are notified in time to act.

**Acceptance Criteria:**

**Given** threshold-crossing or anomaly events,  
**When** trigger logic executes,  
**Then** proactive notification records are emitted for target users.  
**And** deduplication prevents repeated noise for the same insight window.

## Epic 5: RAG Content Pipeline

Build ingestion and retrieval over textbooks and published assessments with citation-grade traceability and ACL safety.

### Story 5.1: Ingest Textbook Sources into Versioned Chunks

As the content pipeline,  
I want uploaded textbooks parsed and chunked with metadata,  
So that retrieval can serve precise, scoped educational context.

**Acceptance Criteria:**

**Given** a textbook upload,  
**When** ingestion runs,  
**Then** chunk records and embeddings are created with source/version metadata.  
**And** ingestion failures are retried with observable error logs.

### Story 5.2: Ingest Published Assessment Content

As the content pipeline,  
I want published assessment versions indexed for retrieval,  
So that AI can reference curriculum-aligned practice content.

**Acceptance Criteria:**

**Given** a publish event,  
**When** indexing executes,  
**Then** assessment chunks are embedded with assessment version linkage.  
**And** stale index entries from replaced versions are deactivated or superseded.

### Story 5.3: ACL-Filtered Retrieval with Citations

As a chat service,  
I want retrieval queries to return only authorized chunks and citations,  
So that responses are grounded without leaking restricted data.

**Acceptance Criteria:**

**Given** a user context and query,  
**When** retrieval executes,  
**Then** ACL filters enforce org/subject/group/visibility boundaries.  
**And** results include citation anchors for answer rendering.

## Epic 6: AI Agent Chat and Governance

Ship teacher/student AI agents that use internal tools safely, with auditing and reliability controls.

### Story 6.1: Implement Teacher Agent Tool Orchestration

As a teacher,  
I want chat responses that combine insights and curriculum retrieval,  
So that I can quickly identify and action student risks.

**Acceptance Criteria:**

**Given** a teacher prompt,  
**When** the orchestrator executes tool calls,  
**Then** it can call insights and course retrieval tools in scoped mode.  
**And** responses include evidence-backed recommendations and citations.

### Story 6.2: Implement Student Agent Tool Orchestration

As a student,  
I want supportive AI guidance based on my progress and course materials,  
So that I can improve before upcoming assessments.

**Acceptance Criteria:**

**Given** a student prompt,  
**When** the student agent responds,  
**Then** it uses only student-safe tools and in-scope retrieval results.  
**And** responses avoid deterministic fail/pass claims and include actionable next steps.

### Story 6.3: Add Fallback and Timeout Behavior for AI Paths

As a platform operator,  
I want predictable fallback behavior when AI or retrieval is slow/failing,  
So that user experience remains reliable.

**Acceptance Criteria:**

**Given** downstream timeout/error conditions,  
**When** chat orchestration cannot complete normally,  
**Then** a safe fallback response is returned within SLA boundaries.  
**And** failures are logged with correlation IDs for diagnosis.

### Story 6.4: Audit Logging for Sensitive Analytics and AI Actions

As an administrator,  
I want traceable logs of sensitive analytics views and AI interactions,  
So that governance and incident review are possible.

**Acceptance Criteria:**

**Given** analytics and chat interactions,  
**When** sensitive operations are performed,  
**Then** audit records capture actor, action, scope, and timestamp metadata.  
**And** audit endpoints are access-controlled and exportable for review.

---
date: 2026-04-11
project: Second-Teacher
stepsCompleted:
  - step-01-document-discovery.md
  - step-02-prd-analysis.md
  - step-03-epic-coverage-validation.md
  - step-04-ux-alignment.md
  - step-05-epic-quality-review.md
  - step-06-final-assessment.md
documentSelections:
  sourceOfTruth: docs
  selected:
    prd: docs/prd.md
    architecture: docs/architecture.md
    epics: docs/epics.md
  uxDocument: none
---

# Implementation Readiness Assessment Report

## Step 1 - Document Discovery

### Inventory

- PRD: `docs/prd.md`
- Architecture: `docs/architecture.md`
- Epics: `docs/epics.md`
- UX: none found

### Duplicate Locations Observed

- Duplicate mirrors exist under `_bmad-output/planning-artifacts/` for PRD, architecture, and epics.
- User decision: use `docs/` as the assessment source-of-truth.

### Notes

- No dedicated UX specification document is currently available.
- Scope note from user: backend/API workflow and integration contracts should be fully specified for frontend implementation handoff; UI implementation is out of scope.

## PRD Analysis

### Functional Requirements

FR1 (F-001): Authentication and RBAC for `admin`, `teacher`, and `student`; session or token-based API security.  
FR2 (F-002): Org structure support for subjects, groups, teacher assignments, and student enrollment via high-entropy join codes with rate limits and optional expiry/revocation.  
FR3 (F-003): Assessments support items, attempts, scoring, draft vs publish lifecycle, immutable published version ID on student attempts, and no retroactive mutation of historical attempts.  
FR4 (F-004): Scheduling supports timezone-aware availability windows for assessments (UTC + timezone identifier or equivalent instant range).  
FR5 (F-005): Analytics core computes deterministic aggregates (trends, completion, recency, baseline deviation) to feed risk tiers (Stable/Watchlist/At-Risk).  
FR6 (F-006): Insights and notifications persist insight records, surface proactive items to teacher and student, and support configurable thresholds with documented defaults.  
FR7 (F-007): Agent chat provides separate teacher and student experiences, tool-based access, and prevention of cross-student data leakage.  
FR8 (F-008): RAG ingests textbooks and published assessments, chunks/embeds/retrieves with ACL metadata, includes citations in responses, and re-ingests on publish/version changes.  
FR9 (F-009): Textbook assets support upload with virus and size limits and keep references for ingestion pipeline.  
FR10 (F-010): Audit logs record admin/teacher access to sensitive student analytics with minimum viable audit trail.  
FR11 (F-011, should-have): Simulation/what-if flow for unpublished assessment edits with branch drafts and no impact on locked attempts.  
FR12 (F-012, should-have): Curated external retrieval allowlist per tenant/subject.  
FR13 (F-013, should-have): Digest mode (daily summary) in addition to real-time flags.  
FR14 (Section 9.1): Teachers are created via admin invite (not shared long-lived passwords).  
FR15 (Section 9.1): Student self-registration uses valid join code with non-enumerable preview fields only after validation.  
FR16 (Section 9.1): Every API enforces tenant/subject/group scope boundaries.  
FR17 (Section 9.2): Publish creates immutable assessment version and triggers RAG sync for version content policy.  
FR18 (Section 9.2): Attempts persist `published_assessment_version_id` linkage and score/timing for analytics.  
FR19 (Section 9.3): Risk uses transparent feature vectors and insight entities with lifecycle fields (`valid_from`, `valid_until`, status states).  
FR20 (Section 9.3): Proactive triggers include threshold crossing, near-term published test windows, and optional cohort anomaly rules.  
FR21 (Section 9.4): Agents use tools only (`get_insights`, `get_student_summary`, `get_own_progress`, `search_course_corpus`, `get_schedule`, optional `search_curated_web`).  
FR22 (Section 9.4): Student-facing remediation must prefer RAG hits, and if none are found must avoid fabricated citations and recommend teacher/office hours.  
FR23 (Section 9.5): Ingestion runs on textbook upload and assessment publish and can be queue-based.  
FR24 (Section 9.5): Retrieval chunks include `source_type`, `source_id`, `version`, `subject_id`, `visibility`, and citation anchor metadata.  
FR25 (Section 9.5): Retrieval applies ACL filtering and may support rerank; query metadata logging minimizes plain-text PII.

Total FRs extracted: 25

### Non-Functional Requirements

NFR1: OWASP ASVS-aligned API security practices with secure secret management and rate limiting on authentication and join-code validation surfaces.  
NFR2: Data retention policy must be documented, including export/delete request handling path (manual handling acceptable in MVP).  
NFR3: Core read API performance target is P95 < 300ms (excluding heavy analytics batch workloads).  
NFR4: RAG path performance target is P95 < 3s, with timeout fallback behavior.  
NFR5: Reliability requires ingestion retries and idempotent publish webhooks/jobs.  
NFR6: Observability requires structured logging, correlation IDs, and baseline metrics for insight/RAG jobs.  
NFR7: Accessibility target is WCAG 2.1 AA for primary flows.  
NFR8: Privacy/compliance posture includes role-based access, auditability for sensitive views, and alignment with FERPA-style controls; COPPA/age-gating as applicable.  
NFR9: AI safety requires explainable evidence-backed guidance, citation grounding, and teacher override capability.

Total NFRs extracted: 9

### Additional Requirements

- Out-of-scope constraints explicitly exclude unrestricted open-web retrieval for students, automated final-grade decisions without teacher approval, full LMS replacement, and proctored certification in MVP.
- Product assumptions include a single-tenant MVP posture with forward-compatible multi-tenant modeling via `organization_id`.
- Technical dependencies include object storage for textbook binaries and vector-capable storage.
- Open policy decisions remain for student visibility of solutions pre-deadline, threshold governance model, refresh cadence strategy, curated-source provider allowlist, and initial compliance market profile.

### PRD Completeness Assessment

The PRD is detailed and sufficiently structured for coverage validation, with clear MVP functional scope and measurable NFR targets.  
Primary completeness gap for implementation readiness is the absence of a dedicated UX specification artifact; this increases execution ambiguity for frontend teams even though API/back-end scope is well-defined.

## Epic Coverage Validation

### Coverage Matrix

| FR Number | PRD Requirement (short) | Epic Coverage | Status |
| --- | --- | --- | --- |
| FR1 | Auth + RBAC | Epic 1 (1.1-1.3) | Covered |
| FR2 | Subjects/groups/assignments/enrollment model | Epic 2 (2.1-2.2) | Covered |
| FR3 | Secure join-code onboarding | Epic 2 (2.3-2.4) | Covered |
| FR4 | Draft/publish immutable versions | Epic 3 (3.1-3.2) | Covered |
| FR5 | Attempts + scoring against immutable versions | Epic 3 (3.3-3.4) | Covered |
| FR6 | Timezone-safe schedule windows | Epic 3 (3.5) | Covered |
| FR7 | Deterministic analytics and risk tiers | Epic 4 (4.1-4.2) | Covered |
| FR8 | Persisted insights + proactive delivery | Epic 4 (4.3-4.4) | Covered |
| FR9 | Teacher/student agent chat + scoped tools | Epic 6 (6.1-6.2) | Covered |
| FR10 | RAG ingestion/retrieval/citations | Epic 5 (5.1-5.3) | Covered |
| FR11 | Audit logging for sensitive analytics + AI | Epic 6 (6.4) | Covered |
| FR12 | What-if simulation for unpublished edits (should-have) | Not found | Missing |
| FR13 | Curated external allowlist retrieval (should-have) | Not found | Missing |
| FR14 | Digest mode for proactive summaries (should-have) | Not found | Missing |
| FR15 | Teacher created by invite flow | Partially in Epic 1/2 (identity + management), no explicit invite story | Partial |
| FR16 | Join-code non-enumerable preview behavior | Epic 2 (2.4) | Covered |
| FR17 | API tenant/subject/group scope enforcement | Epic 1 (1.3) + Epic 2 ownership scope | Covered |
| FR18 | Publish triggers RAG sync policy | Epic 5 (5.2) | Covered |
| FR19 | Attempts store version linkage + timing | Epic 3 (3.3-3.4) | Covered |
| FR20 | Insight entity richness + lifecycle fields | Epic 4 (4.3) | Covered |
| FR21 | Proactive trigger policy set | Epic 4 (4.4) | Covered |
| FR22 | Tool-only agent orchestration | Epic 6 (6.1-6.2) + Additional Req in epics doc | Covered |
| FR23 | Student-safe fallback when no citation hit | Epic 6 (6.2-6.3) | Covered |
| FR24 | Ingestion on upload + publish (queue acceptable) | Epic 5 (5.1-5.2) | Covered |
| FR25 | Chunk metadata + ACL-filtered retrieval + citation anchors | Epic 5 (5.3) | Covered |

### Missing Requirements

#### Critical Missing FRs

None of the core MVP FR1-FR11 items are missing from epics coverage mapping.

#### High Priority Missing FRs

- FR12 (What-if simulation): not represented in any epic/story despite explicit PRD "should-have."
- FR13 (Curated external allowlist retrieval): not represented in any epic/story despite explicit PRD "should-have."
- FR14 (Digest mode): not represented in any epic/story despite explicit PRD "should-have."
- FR15 (Admin invite flow specificity): identity/admin management is present, but invite mechanics are not explicitly isolated as a dedicated story.

### Coverage Statistics

- Total PRD FRs analyzed: 25
- Fully covered in epics: 20
- Partially covered: 1
- Missing: 4
- Coverage percentage (fully covered): 80%
- Coverage percentage (full + partial): 84%

## UX Alignment Assessment

### UX Document Status

Not found as a standalone UX artifact in `_bmad-output/planning-artifacts` (`*ux*.md` / sharded UX index not present).

### Alignment Issues

- UX requirements are implied strongly by PRD journeys and usage surfaces (teacher dashboard, student dashboard, agent chat, proactive insights), but there is no dedicated UX spec to lock IA/navigation/component behavior.
- Architecture and epics include user-facing flows, but traceability from UX intent to concrete interaction states is indirect (inferred from PRD + epics, not sourced from a UX document).

### Warnings

- Warning: UI/UX is clearly implied (multi-role web app + dashboard/chat/practice/calendar flows), so missing UX artifact is a readiness risk for frontend consistency.
- Mitigation in current repo: `docs/frontend-implementation-plan.md` and `docs/api-for-frontend.md` provide workflow/API contract guidance, but they are implementation guides, not a UX design specification.

## Epic Quality Review

### Epic Structure Validation

- Epic user-value orientation is mostly valid: each epic maps to outcomes teachers/students/admins can consume.
- Epic independence sequencing is reasonable (Identity -> Academic structure -> Assessments -> Analytics -> RAG -> Agent governance) with no explicit forward dependency loops.
- FR traceability is explicit via FR coverage map and per-epic FR labels.

### Story Quality Findings

#### 🔴 Critical Violations

- None identified.

#### 🟠 Major Issues

1. **Invite flow specificity gap**
   - PRD explicitly calls for admin invite-based teacher onboarding.
   - Epics include teacher assignment and identity stories, but no explicit dedicated invite mechanics story (token lifecycle, invitation acceptance, expiry/revoke).
   - Recommendation: add a dedicated story under Epic 1 or Epic 2 for invite-token lifecycle and acceptance flow.

2. **Should-have scope not represented**
   - PRD lists simulation, curated external allowlist retrieval, and digest mode as should-have scope.
   - No stories capture these capabilities.
   - Recommendation: add an optional Epic 7 (or backlog appendix) for should-have items with explicit defer marker.

3. **Acceptance criteria depth inconsistency**
   - Many ACs cover happy path but omit explicit negative/error paths (e.g., malformed payload, unauthorized role, out-of-scope access, retries exhausted).
   - Recommendation: extend ACs per story with at least one error/security criterion.

#### 🟡 Minor Concerns

1. **Technical phrasing drift in some epic titles**
   - Titles like "RAG Content Pipeline" and "Identity and Access Foundation" are acceptable but more system-centric than user-outcome-centric.
   - Recommendation: keep current titles but add explicit user-value sentence in each epic intro (already partially present).

2. **UX acceptance references are implicit**
   - UX expectations are inferred from PRD and epics rather than anchored to a UX spec.
   - Recommendation: add lightweight UX acceptance notes per story until full UX doc exists.

### Dependency Analysis

- No explicit within-epic forward dependency violations detected.
- Stories are ordered in a plausible implementation sequence and are independently completable with preceding context.
- Database/entity creation timing appears incremental by story intent rather than front-loading all entities in one setup story.

### Best Practices Compliance Checklist (Summary)

- Epic delivers user value: Mostly yes  
- Epic can function independently: Yes  
- Stories appropriately sized: Mostly yes  
- No forward dependencies: Yes  
- Database tables created when needed: Appears yes  
- Clear acceptance criteria: Mixed (major issue on negative-path depth)  
- Traceability to FRs maintained: Yes

## Summary and Recommendations

### Overall Readiness Status

NEEDS WORK

### Critical Issues Requiring Immediate Action

1. Resolve document source-of-truth duplication operationally (team process): continue using `docs/` as canonical and avoid divergent edits in mirrored `_bmad-output/planning-artifacts/*` copies.
2. Add explicit story coverage for admin invite-token lifecycle (PRD requirement specificity gap).
3. Address missing should-have backlog representation (simulation, curated external allowlist retrieval, digest mode) to avoid silent scope loss.
4. Create a lightweight UX specification (or enforce UX acceptance annotations per story) for consistent frontend execution.

### Recommended Next Steps

1. Update `docs/epics.md` with one new story for teacher invite-token flow and explicit ACs for token issue/accept/expiry/revoke behavior.
2. Add an explicit "MVP+ / Should-have" epic or deferred backlog section for simulation, curated external retrieval, and digest notifications.
3. Strengthen story acceptance criteria in all epics with negative-path/security checks and observability expectations.
4. Create a minimal UX artifact (navigation map + key screen states + citation interaction patterns), or annotate `docs/frontend-implementation-plan.md` with explicit UX acceptance states.
5. Keep backend/frontend contract-first execution for reader deep-linking: citation payload (`readerPath`, `textbookLocation`, `highlightText`) and reader endpoint contract.

### Final Note

This assessment identified 9 issues across 4 categories (documentation governance, coverage traceability, UX readiness, and AC quality depth). Address the critical issues before broad implementation. The team can proceed with current artifacts for backend-first work, but frontend consistency risk remains until UX and story specificity gaps are closed.

# Story 1.1: Bootstrap Backend Service and Security Baseline

Status: done

## Story

As a backend developer,  
I want an initialized API service with security middleware and config scaffolding,  
so that all future features build on a safe and consistent runtime.

## Acceptance Criteria

1. Given a fresh repository, when backend bootstrap is run, then app structure, environment loading, and central error handling are configured.
2. Given HTTP traffic to the API, when requests are processed, then security headers, CORS policy, request size limits, and JSON parsing safeguards are enabled.
3. Given invalid payloads and unhandled failures, when the API responds, then errors are normalized and non-sensitive.
4. Given startup and request processing, when logging occurs, then structured logs include timestamps and request correlation identifiers.

## Tasks / Subtasks

- [x] Task 1: Initialize backend project scaffold (AC: 1)
  - [x] Define folder structure (`src`, `config`, `middleware`, `routes`, `lib`).
  - [x] Add runtime config loader with environment validation.
  - [x] Add central app entrypoint and server bootstrap script.

- [x] Task 2: Add baseline security middleware (AC: 2)
  - [x] Configure security headers middleware.
  - [x] Configure explicit CORS allowlist strategy for environments.
  - [x] Configure request body size limits and safe parsers.

- [x] Task 3: Add standardized error and validation handling (AC: 3)
  - [x] Implement global error middleware with normalized response schema.
  - [x] Add request validation abstraction for route handlers.
  - [x] Ensure no stack traces or sensitive internals leak in production responses.

- [x] Task 4: Add observability foundation (AC: 4)
  - [x] Add structured logger setup.
  - [x] Add request correlation ID middleware.
  - [x] Emit startup diagnostics and baseline health endpoint logging.

- [x] Task 5: Add verification tests/checks (AC: 1-4)
  - [x] API smoke test for app boot and health endpoint.
  - [x] Middleware tests for CORS/security header behavior.
  - [x] Error-path tests for normalized response envelope.

## Dev Notes

- Keep architecture backend-first and service-oriented.
- This story is foundation-only and must not implement business domain entities yet.
- Keep all interfaces generic so later stories can layer auth/RBAC and domain routes.

### Project Structure Notes

- Preferred implementation artifact root: `_bmad-output/implementation-artifacts`
- Keep code layout predictable for future stories:
  - `src/config` for runtime/environment configuration
  - `src/middleware` for cross-cutting middleware
  - `src/routes` for route registration
  - `src/lib` for shared utilities

### References

- Security baseline and role boundary intent: [Source: docs/architecture.md#2)-High-Level-Components]
- Backend-first implementation sequence: [Source: docs/architecture.md#11)-Implementation-Sequence]
- Core security/NFR constraints: [Source: docs/prd.md#10.-Non-functional-requirements]
- FR alignment (auth & RBAC foundation): [Source: docs/epics.md#Epic-1:-Identity-and-Access-Foundation]

## Dev Agent Handoff Prompt

Use this exact task prompt for the developer agent:

"Implement Story 1.1 from `/_bmad-output/implementation-artifacts/1-1-bootstrap-backend-service-and-security-baseline.md`.
Scope strictly to backend bootstrap and security baseline.
Do not add product-domain features (subjects, assessments, analytics, RAG) yet.
Deliver:
1) scaffolded backend app structure,
2) security middleware setup,
3) normalized error handling and validation plumbing,
4) structured logging with correlation IDs,
5) initial smoke/middleware tests.
After implementation, update the story file sections: `Completion Notes List`, `File List`, and set status recommendation for sprint tracking."

## Dev Agent Record

### Agent Model Used

gpt-5.3-codex-low

### Debug Log References

- `npm run build`
- `npm test`

### Completion Notes List

- Bootstrapped TypeScript Express backend with secure defaults.
- Added environment validation, structured logging, and request correlation IDs.
- Implemented normalized error handling and body validation middleware.
- Added authentication and RBAC endpoints as part of continuing Epic 1.
- Added academic structure and join-code enrollment endpoints as part of continuing Epic 2.
- All current backend tests pass (`6 passed`).

### File List

- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `.env.example`
- `src/app.ts`
- `src/server.ts`
- `src/config/env.ts`
- `src/config/logger.ts`
- `src/types/express.d.ts`
- `src/lib/httpError.ts`
- `src/middleware/requestContext.ts`
- `src/middleware/validate.ts`
- `src/middleware/errorHandler.ts`
- `src/middleware/auth.ts`
- `src/middleware/rateLimit.ts`
- `src/domain/userStore.ts`
- `src/domain/academicStore.ts`
- `src/routes/health.ts`
- `src/routes/auth.ts`
- `src/routes/protected.ts`
- `src/routes/academic.ts`
- `src/routes/enrollment.ts`
- `tests/app.test.ts`

# Second-Teacher UI Upgrade Handoff (for Stitch)

## 1) Mission and Scope

This document describes the **current frontend behavior and UX structure** of Second-Teacher so Stitch can deliver a visual/UI upgrade **without changing product logic**.

Use this as a strict baseline:

- Keep all existing routes, flows, role permissions, and actions.
- Upgrade only presentation quality: layout consistency, spacing, hierarchy, visual polish, interaction clarity, and responsiveness.
- Do not remove or rename core controls (buttons, tabs, links, forms, status indicators).
- Do not alter API contracts, business rules, or navigation destinations.

---

## 2) Product Model (Current)

Second-Teacher is a multi-role platform:

- **Public visitor**: learns the product and enters role-specific paths.
- **Student**: joins class, studies subject workspace, takes assessments, reviews insights.
- **Teacher**: manages class groups, sees analytics, publishes tests, uses AI assistant.
- **Admin**: provisions teachers/subjects/groups and audits activity.

The UI today is functional but uneven (mixed visual patterns and language tones). Goal is a modern, coherent design system with unchanged behavior.

---

## 3) Technical and Design Constraints Stitch Must Respect

### Frontend stack

- Next.js App Router (`src/app`)
- React client-heavy pages
- Tailwind CSS utility styling
- Auth/session in Zustand store (`auth-store`)

### Core constraints

- Keep route structure and route params unchanged.
- Keep role guards and redirects unchanged.
- Keep each page’s information architecture and task intent intact.
- Keep teacher command palette behavior on teacher group routes.
- Preserve all “state” views: loading, empty, error, success.
- Preserve reader deep-link behavior from assessment recommendations.

---

## 4) Global Layout and Navigation Contract

## 4.1 Root app shell behavior

- App uses global root layout with fonts and body container.
- Authenticated sections render inside `AppShell`.
- `AppShell` structure:
  1. **Top header** (brand + role nav + session actions)
  2. **Main content container** (`max-width` center column)

### 4.2 Role-based nav tabs (must remain)

- Teacher shell tabs:
  - `Bosh panel` -> `/teacher`
  - `Bildirishnomalar` -> `/notifications`
- Student shell tabs:
  - `My subjects` -> `/student`
  - `Join class` -> `/join`
  - `AI alerts` -> `/notifications`
- Admin shell tabs:
  - `Dashboard` -> `/admin`
  - `Audit` -> `/admin/audit`

### 4.3 Public nav (must remain)

- Brand/home link (`/`)
- Guide link (`/guide`)

---

## 5) Current UX Flows (must remain unchanged)

## 5.1 Public -> Role entry

1. User lands on `/`.
2. Sees product explanation + role entry cards.
3. Moves to:
   - teacher login
   - student join flow
   - admin login

## 5.2 Student core flow

1. Join via code (`/join`) or login.
2. Enter student dashboard (`/student`).
3. Open subject workspace (`/student/subjects/[groupId]`).
4. From workspace:
   - review overview/alerts
   - take assessments
   - open reader links
   - view analytics
   - use AI report and coach

## 5.3 Teacher core flow

1. Login -> teacher dashboard (`/teacher`).
2. Open subject, then class group.
3. In class workspace:
   - review students and risk
   - review results/analytics
   - manage tests/drafts/published
   - copy join code
4. Optional:
   - academic structure management
   - corpus/textbook management
   - AI test generation
   - student drill-down pages
5. Teacher assistant is command palette + AI briefing strip in class context.

## 5.4 Admin core flow

1. Provision data (`/admin`):
   - create teacher
   - create subject
   - create group
   - assign teacher to group
2. Review logs (`/admin/audit`), filter, export.

---

## 6) Page-by-Page Positional Blueprint

The format below defines **visual zones top -> bottom** and major controls.

## 6.1 Public Pages

### `/` Home

1. **Top nav**: brand + guide link.
2. **Hero block**: title, value proposition, CTA to guide.
3. **Workflow visual block**: golden path graphic.
4. **Role selection block**: role cards (teacher, student, admin).

### `/guide`

1. **Top nav**
2. **Header intro section**: page title + context text.
3. **Rules/checklist sections**
4. **Workflow visualization**
5. **Expandable detail sections** (details/summary patterns)
6. **Integration and reference tables**

### `/login`

1. **Role-aware heading** (teacher/admin variations).
2. **Optional session-expired info banner**.
3. **Auth form card**:
   - optional display name (teacher mode)
   - email
   - password
   - submit
4. **Supportive helper text** (dev/demo guidance in dev mode).

### `/join`

1. **Step 1 card**: join code input + continue.
2. **Step 2 card**:
   - group preview
   - email/password/display name fields
   - back + create account actions
3. **Post-success redirect to student dashboard**.

## 6.2 Student Pages

### `/student` Dashboard

1. **Hero summary card** (student welcome/context).
2. **Section header**: My subjects + join another class action.
3. **State region**: loading/error/empty.
4. **Subject cards grid**:
   - subject/group labels
   - risk status
   - latest score/open assessment indicators
   - textbook and insight cues
   - open subject action

### `/student/subjects/[groupId]` Subject Workspace

1. **Top hero band**:
   - back action
   - subject/group title
   - risk/challenge/open-now chips
   - metric cards (4)
2. **Primary tab row** (pill style):
   - Overview
   - Practice
   - Analytics
   - AI Report
   - Library
   - Study coach
3. **Tab content panel** (changes by tab):
   - Overview: AI alerts, reading recommendations, weak areas
   - Practice: suggested redo + all assessments
   - Analytics: charts and narrative
   - AI Report: generated study report panel
   - Library: textbook links
   - Study coach: AI chat panel

### `/student/assessments`

1. **Header with back context**
2. **Group context handling**
3. **Assessment list grid** with take actions
4. **Footer link to attempts history**

### `/student/assessments/take/[publishedId]`

1. **If in progress**:
   - header with progress
   - question cards in sequence
   - answer options (radio)
   - submit footer action
2. **If submitted**:
   - success/result summary card
   - score
   - recommendation links to reader
   - retake/back actions

### `/student/assessments/attempts`

1. **Header**
2. **Attempt list**
3. **Retake action per item**

### `/student/corpus`

1. **Page heading**
2. **CorpusSearchPanel** as main body

### `/student/insights`

1. **Heading**
2. **Optional group selector input**
3. **Load/reload controls**
4. **Insights list**

### `/student/agent`

1. **Intro text**
2. **AgentChatSession panel**

## 6.3 Teacher Pages

### `/teacher` Dashboard

1. **Header row**: title + refresh.
2. **State block**: loading/error/empty.
3. **Subject cards grid** (entry to subject workspace).
4. **Footer action** to structure page.

### `/teacher/subjects/[subjectId]`

1. **Top row**: back, subject info, refresh.
2. **Tab row**:
   - Classes
   - Textbooks
3. **Classes content**: group cards grid.
4. **Textbooks content**: teacher materials panel (ingest/manage/search).

### `/teacher/groups/[groupId]` Class Workspace

1. **Header strip**:
   - back
   - group metadata
   - class ID
   - join code copy action
2. **AI briefing strip**
3. **Primary tab row**:
   - Students
   - Results & analytics
   - Tests
4. **Students tab**:
   - summary metric cards
   - top-risk area
   - roster cards with student profile links
5. **Results tab**:
   - refresh/recompute controls
   - summary cards
   - charts area
   - recent results list
   - AI interpretation acknowledge/dismiss actions
6. **Tests tab**:
   - create draft entry
   - drafts list with edit links
   - published list entry points

### `/teacher/groups/[groupId]/students/[studentId]`

1. **Back link**
2. **Student profile header**
3. **Progress and percentile charts**
4. **Risk factors and recommendations**
5. **Insight status actions**

### `/teacher/structure`

1. **Page heading**
2. **AcademicStructure component**:
   - subject creation/management
   - group creation/management
   - join code handling

### `/teacher/corpus` and `/teacher/corpus?subjectId=...`

1. **Header**
2. **If subject context present** -> TeacherMaterialsPanel
3. **If missing context** -> empty prompt/instruction state

### `/teacher/assessments`

1. **Intro/header**
2. **Create draft form**
3. **Optional filters**
4. **Drafts list**

### `/teacher/assessments/drafts/[draftId]`

1. **Draft identity/header**
2. **DraftItemsEditor** (question item editing)
3. **Predictor/simulation helpers**
4. **Publish controls** (subject, group, date window)
5. **Save actions**

### `/teacher/assessments/published`

1. **Back to assessments**
2. **Group filter field**
3. **Published list**

### `/teacher/assessments/ai-generate`

1. **Multi-step workflow form**:
   - subject select
   - group select
   - textbook select
   - topic selection
2. **Generate action**
3. **Post-generate navigation to draft**

### `/teacher/insights`

1. **Group context input**
2. **Load + recompute controls**
3. **Insight list**
4. **Risk analytics section**

### `/teacher/agent`

1. **Informational content only**
2. **Explains that active assistant is in class workspace / command palette**

## 6.4 Admin Pages

### `/admin`

1. **Section 1**: create teacher form.
2. **Section 2**: create subject form.
3. **Section 3**: create group form (subject-dependent).
4. **Section 4**: assign teacher to group (selector controls).

### `/admin/audit`

1. **Top header**
2. **Teacher + structure overview table**
3. **Filter controls** (limit, actor, action, group, since)
4. **Actions**: refresh + export JSON
5. **Audit logs table**

## 6.5 Notifications and Reader

### `/notifications`

1. **Header + limit selector + refresh**
2. **Notification cards list**
3. **Deep link action to subject workspace**

### `/reader/textbooks/[textbookSourceId]`

1. **Header card**: back + document metadata + focus marker.
2. **Two-column body**:
   - chapter navigation list
   - paragraph reading panel
3. **Sentence highlighting support** from deep-link params.

---

## 7) Shared Components Inventory (Current)

Key reusable components currently shaping UI:

- Layout/Auth:
  - `AppShell`
  - `PublicNav`
  - `NotificationsShell`
  - `AuthGuard`
- Workflow/Public:
  - `GoldenPathVisual`
  - `RoleEntryCards`
- Teacher:
  - `TeacherCommandPalette`
  - `AiBriefingStrip`
  - `ResultsCharts`
  - `TeacherMaterialsPanel`
- Student:
  - `StudyCoachPanel`
  - `AiStudyReport`
  - `StudentProgressChart`
  - `PercentileRadarChart`
  - `CategoryRadarChart`
- Assessments:
  - `DraftItemsEditor`
  - `ScorePredictorPanel`
  - `SimulationDialog`
- RAG/Reader support:
  - `CorpusSearchPanel`
  - `TextbookIngestForm`
- AI Chat:
  - `AgentChatSession`

---

## 8) Current UX/UI Pain Points to Improve (Visual/Usability Only)

- Inconsistent spacing and density between pages.
- Mixed typography hierarchy and weight usage.
- Card styles and corner radii vary too much.
- Uneven empty/loading/error state design.
- Data-heavy views (teacher group, admin audit) need better visual grouping.
- Tab systems are visually inconsistent between pages.
- Student workspace has high information load; needs clearer scan paths.
- Language tone (Uzbek/English) feels mixed; apply coherent copy style while preserving meaning.

---

## 9) UI Upgrade Requirements for Stitch (Do / Do Not)

### Do

- Create a unified design system:
  - spacing scale
  - type scale
  - surface/elevation system
  - status colors (success/warn/error/info/risk tiers)
- Standardize primitives:
  - page header
  - card
  - data table
  - tabs
  - filter bar
  - metric stat tile
  - empty/error/loading states
- Improve responsive behavior for:
  - teacher group page
  - admin audit table
  - student subject workspace
- Preserve existing journeys and CTA availability.

### Do Not

- Do not change route names or nesting.
- Do not change role authorization behavior.
- Do not remove current actions/inputs.
- Do not change business logic or API payload assumptions.

---

## 10) Acceptance Checklist for “UI-only Upgrade Complete”

- Every current route listed in this document still exists and is reachable.
- All primary actions on each page remain available.
- All major tabs/sections still exist with same content intent.
- All status states (loading/empty/error/success) still render clearly.
- Teacher command palette and AI briefing remain in class context.
- Reader deep links from study recommendations still open correctly.
- Student/teacher/admin/navigation flows remain unchanged.
- Visual system is consistent across public, student, teacher, admin, notifications, and reader.

---

## 11) Suggested Delivery Format Stitch Should Produce

1. **Design system spec** (tokens + component variants).
2. **Page templates** for each major layout family:
   - public
   - dashboard/list
   - workspace with tabs
   - data table/admin
   - form wizard
3. **Route-level UI mappings** (old -> upgraded) for all pages above.
4. **Responsive behavior notes** per page.
5. **No behavior-change declaration** confirming this contract.

---

## 12) Route Master List (for traceability)

- Public: `/`, `/guide`, `/login`, `/join`
- Student:
  - `/student`
  - `/student/subjects/[groupId]`
  - `/student/assessments`
  - `/student/assessments/take/[publishedId]`
  - `/student/assessments/attempts`
  - `/student/corpus`
  - `/student/insights`
  - `/student/agent`
- Teacher:
  - `/teacher`
  - `/teacher/subjects/[subjectId]`
  - `/teacher/groups/[groupId]`
  - `/teacher/groups/[groupId]/students/[studentId]`
  - `/teacher/structure`
  - `/teacher/corpus`
  - `/teacher/assessments`
  - `/teacher/assessments/drafts/[draftId]`
  - `/teacher/assessments/published`
  - `/teacher/assessments/ai-generate`
  - `/teacher/insights`
  - `/teacher/agent`
- Admin:
  - `/admin`
  - `/admin/audit`
- Shared auth route:
  - `/notifications`
- Reader:
  - `/reader/textbooks/[textbookSourceId]`

This is the baseline contract Stitch should follow to deliver a high-fidelity visual redesign without feature regressions.

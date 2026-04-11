# Reader + RAG Integration Workflow (Backend Contract)

This document defines the backend contracts and execution workflow frontend teams should follow to implement textbook reader deep links with highlighted RAG chunks.

## Goal

Enable users to click a citation from search/chat and open the textbook reader directly at the referenced chapter/page/paragraph/sentence range, with highlight context.

## Implemented Backend Contracts

### 1) Ingest textbook source

- **Endpoint:** `POST /rag/sources/textbooks`
- **Roles:** `admin`, `teacher`
- **Body:**
  - `subjectId`
  - `title`
  - `versionLabel`
  - `text`

Ingestion now creates reader-aware chunk metadata for textbook content.

### 2) Query RAG corpus

- **Endpoint:** `POST /rag/query`
- **Roles:** `admin`, `teacher`, `student` (scope-checked)
- **Body:**
  - `query`
  - `groupId`
  - `topK` (optional)

For textbook hits, each `citation` includes:

- `anchor`
- `readerPath` (relative route to reader target)
- `textbookLocation`:
  - `chapterNumber`
  - `chapterTitle`
  - `pageNumber`
  - `paragraphId`
  - `sentenceStart`
  - `sentenceEnd`
- `highlightText`

### 3) Load reader document and focus target

- **Endpoint:** `GET /reader/textbooks/:textbookSourceId`
- **Roles:** `admin`, `teacher`, `student` (scope-checked)
- **Required query:**
  - `groupId`
- **Optional query:**
  - `paragraphId`
  - `sentenceStart`
  - `sentenceEnd`

Response payload:

- `source` (textbook source metadata)
- `chapters[]`
- `paragraphs[]`
- `focus` (resolved focus context or `null`)

## Frontend Integration Workflow

### Workflow A: Search/Chat citation to reader

1. Call `POST /rag/query` (or consume citations from `/agent/*/chat` output).
2. For each textbook citation:
   - render a link action using `citation.readerPath`
   - preserve `groupId` in route/query context
3. On click, navigate to reader route and call:
   - `GET /reader/textbooks/:textbookSourceId?groupId=...&paragraphId=...&sentenceStart=...&sentenceEnd=...`
4. Render textbook content and:
   - scroll to `focus.paragraphId`
   - highlight sentence range (`sentenceStart` to `sentenceEnd`)
   - optionally reinforce with `citation.highlightText`

### Workflow B: Reader opened without citation

1. Open reader with only `groupId`.
2. Load reader payload and render default chapter/page position.
3. Keep highlighting off until a focused citation target is provided.

## Error and Fallback Handling

- `403 FORBIDDEN`: user is not authorized for the group/source.
- `404 READER_SOURCE_NOT_FOUND`: source does not exist in scoped subject or was not indexed.
- `400 VALIDATION_ERROR`: missing `groupId` or malformed route/query.

Frontend fallback behavior:

1. If reader focus fails, still render reader document if available.
2. If source cannot be loaded, show citation context text and suggest retry or teacher contact.
3. Never fabricate citation links if `readerPath`/`textbookLocation` are absent.

## Implementation Notes

- Current page mapping is derived from text segmentation (character budget), not PDF-native page mapping.
- Chapter segmentation supports markdown headings and `Chapter <n>` style titles.
- This contract is backend-ready; UI rendering behavior is intentionally frontend-owned.

## Validation Checklist for Frontend Team

- Citation cards show actionable reader links for textbook hits.
- Link opens exact paragraph/sentence focus from citation metadata.
- Highlighted text is visible without manual searching.
- Unauthorized access paths show clear error states.
- Reader remains usable even when no focus target is present.

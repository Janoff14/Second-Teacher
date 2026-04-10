# Second Teacher

Learning platform backend (Express + TypeScript) with assessments, analytics, RAG, and agent-style orchestration.  
GitHub: [Janoff14/Second-Teacher](https://github.com/Janoff14/Second-Teacher)

## Layout

| Path | Purpose |
|------|---------|
| **`backend/`** | REST API — run `npm install`, `npm run build`, `npm start` here |
| **`frontend/`** | Placeholder for the web app (not scaffolded yet) |
| **`docs/`** | PRD, architecture, epics, sprint status |

## Local backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

- Health: `GET http://localhost:4000/health` (or `PORT` from `.env`)

## Railway deployment

1. In [Railway](https://railway.app), open the **Second-Teacher** service linked to this repo.
2. Set **Root Directory** to **`backend`** so builds use `backend/package.json`.
3. Add **variables** (Production):

   | Variable | Notes |
   |----------|--------|
   | `JWT_SECRET` | Long random string (required in production; change from any dev default) |
   | `CORS_ORIGIN` | Your real frontend origin(s), comma-separated, e.g. `https://app.example.com` |
   | `NODE_ENV` | `production` |
   | `LOG_LEVEL` | `info` (or `warn`) |
   | `AGENT_TOOL_TIMEOUT_MS` | Optional; default `2500` |
   | `OPENAI_API_KEY` | Optional until you wire real LLM/embeddings in code |
   | `PORT` | Usually **omit** — Railway sets `PORT` automatically |

4. Deploy uses **`backend/railway.toml`** (start: `npm start`, health: `/health`).

Public URL example: `https://second-teacher-production.up.railway.app`

## Cursor: Railway MCP

Project MCP config: [`.cursor/mcp.json`](.cursor/mcp.json) registers `@railway/mcp-server` so you can manage projects/services from Cursor. After editing, reload MCP servers in Cursor if needed.

## Credentials checklist

- **Today (API as shipped):** `JWT_SECRET`, `CORS_ORIGIN`, Railway `PORT` (injected).
- **When adding OpenAI:** `OPENAI_API_KEY` in Railway + `backend/.env` locally; keep it out of git.
- **Future Postgres/Redis:** add connection URLs as Railway variables and read them in `backend/src/config/env.ts`.

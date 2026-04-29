# Second Teacher

**An AI-powered teaching and learning platform that helps teachers detect at-risk students early — with explainable insights and textbook-grounded recommendations.**

**Live demo:** [https://second-teacher-frontend.vercel.app](https://second-teacher-frontend.vercel.app)  
**GitHub:** [Janoff14/Second-Teacher](https://github.com/Janoff14/Second-Teacher)

---

## What is Second Teacher?

Second Teacher is an EdTech platform built for **teachers**, **students**, and **admins**. It surfaces early academic risk signals, visualizes learning trends, and provides AI coaching grounded in actual course materials — not generic internet content.

### Key Features

- **Early risk detection** — Automated insights flag struggling students before it's too late
- **RAG-powered AI agent** — Chat assistant retrieves answers from ingested textbooks and assessments, with citations
- **Assessment lifecycle** — Create, publish, and track student attempts with draft/publish workflows
- **Interactive dashboards** — Visualize progress, trends, and percentile breakdowns with Recharts
- **Document ingestion** — Upload PDF/DOCX textbooks; the platform chunks, embeds, and indexes them for search
- **Role-based access** — Separate experiences for teachers, students, and administrators

### Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, Zustand, Recharts |
| Backend | Express 5, TypeScript, Zod, Pino, JWT auth |
| AI / Search | OpenAI (gpt-4o-mini, text-embedding-3-small), RAG with cosine similarity |
| Database | Supabase (Postgres) |
| Deployment | Vercel (frontend), Railway (API) |

---

## Try the Demo

The live app is pre-loaded with a Physics 101 class. Sign in with demo accounts using the password configured in the deployment environment:

| Role | Email |
|------|-------|
| **Teacher** | `kamila.saidova_demo@secondteacher.dev` |
| **Student** | `lila.kim_demo@secondteacher.dev` |

See [all demo accounts](docs/demo-seed-accounts.md) for the full roster.

---

## Project Structure

| Path | Purpose |
|------|---------|
| `backend/` | REST API (Express + TypeScript) |
| `frontend/` | Web app (Next.js 15) |
| `docs/` | PRD, architecture, epics, sprint status, [API guide](docs/api-for-frontend.md) |

---

## Local Development

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Health check: `GET http://localhost:4000/health`

### Frontend

Make sure the backend is running first, then in a separate terminal:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — details in [`frontend/README.md`](frontend/README.md).

> **Note:** `CORS_ORIGIN` in `backend/.env` must include your frontend origin. The defaults allow both `http://localhost:3000` and `http://127.0.0.1:3000`.

---

## Deployment

| Service | Platform | Config |
|---------|----------|--------|
| Frontend | [Vercel](https://vercel.com) | Auto-deployed from `frontend/` |
| Backend API | [Railway](https://railway.app) | Uses `backend/railway.toml` — root directory set to `backend/` |

<details>
<summary><strong>Railway environment variables</strong></summary>

| Variable | Notes |
|----------|--------|
| `JWT_SECRET` | Long random string (required in production) |
| `CORS_ORIGIN` | Frontend origin(s), comma-separated |
| `NODE_ENV` | `production` |
| `LOG_LEVEL` | `info` or `warn` |
| `OPENAI_API_KEY` | Required for AI features |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `PORT` | Usually omit — Railway sets this automatically |

</details>

<details>
<summary><strong>Smoke-test production</strong></summary>

```bash
cd backend
API_BASE_URL=https://…up.railway.app npm run smoke-deploy
```

Checks `GET /health` and `POST /auth/login`. Override credentials with `SMOKE_EMAIL` / `SMOKE_PASSWORD`.

</details>

---

## Documentation

| Document | Description |
|----------|-------------|
| [Product Brief](docs/second-teacher-product-brief.md) | Vision, goals, and target users |
| [PRD](docs/prd.md) | Detailed product requirements |
| [Architecture](docs/architecture.md) | System design and technical decisions |
| [API Guide](docs/api-for-frontend.md) | REST API reference for frontend integration |
| [Epics & Stories](docs/epics.md) | Feature breakdown and sprint planning |
| [Platform Workflow](docs/platform-user-workflow.md) | End-to-end user workflow guide |

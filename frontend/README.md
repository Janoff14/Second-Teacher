# Second Teacher — Frontend

Next.js 15 (App Router) + TypeScript + Tailwind. Roles: **admin**, **teacher**, **student**.

## Run locally

1. **API first** (from repo root):

   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Ensure CORS_ORIGIN includes http://localhost:3000 (default in .env.example)
   npm run dev
   ```

2. **Frontend** (new terminal):

   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000). Log in with seeded users (see `../docs/api-for-frontend.md`).

`NEXT_PUBLIC_API_BASE_URL` must match the API (default `http://localhost:4000`, no trailing slash).

## Docs

- [API for frontend](../docs/api-for-frontend.md)
- [Implementation plan](../docs/frontend-implementation-plan.md)
- [Teacher workflow spec](../docs/teacher-frontend-workflow-spec.md)

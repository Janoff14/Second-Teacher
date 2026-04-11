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

### “It worked on another computer” / login fails

- **Wrong password:** `demo.seed.teacher@secondteacher.dev` uses **`DemoSeed2026!`**, not `ChangeMe123!` (see `docs/demo-seed-accounts.md`).
- **Wrong API:** `.env.local` must point at the backend running **on this machine** (or the same deploy you expect). A URL left over from another PC may hit Railway/Supabase users that don’t match your local seeds.
- **Supabase:** If the API has `SUPABASE_URL` + service role set, users are read/written in the cloud. A row for `demo.seed.teacher@…` created elsewhere can have a **different** password than `DemoSeed2026!`.

## Docs

- [API for frontend](../docs/api-for-frontend.md)
- [Implementation plan](../docs/frontend-implementation-plan.md)
- [Teacher workflow spec](../docs/teacher-frontend-workflow-spec.md)

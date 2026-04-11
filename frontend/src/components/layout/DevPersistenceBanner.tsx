/**
 * Surfaces the in-memory backend caveat from `frontend-implementation-plan.md` §2.
 */
export function DevPersistenceBanner() {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
    >
      Dev: backend data may be in-memory — restarts clear state. Demo roster requires{" "}
      <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">
        SEED_DEMO_DATA=true
      </code>{" "}
      in <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">backend/.env</code>{" "}
      then restart the API (see <code className="rounded px-1">docs/demo-seed-accounts.md</code>). Configure{" "}
      <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">CORS_ORIGIN</code> for this origin.
    </div>
  );
}

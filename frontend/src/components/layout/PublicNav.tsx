import Link from "next/link";

export function PublicNav() {
  return (
    <header className="border-b border-neutral-200/80 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50"
        >
          Second Teacher
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link
            href="/guide"
            className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Platform guide
          </Link>
          <Link
            href="/#role-selection"
            className="rounded-full bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            Choose role
          </Link>
        </nav>
      </div>
    </header>
  );
}

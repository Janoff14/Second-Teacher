import Link from "next/link";

export function PublicNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-foreground/8 bg-glass">
      <div className="h-1 bg-gradient-to-r from-brand-500 via-violet-500 to-accent-500" />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-foreground"
        >
          Second<span className="text-gradient-brand">Teacher</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-5 text-sm">
          <Link
            href="/guide"
            className="font-medium text-foreground/70 transition-colors hover:text-brand-600 dark:hover:text-brand-400"
          >
            Platform yo{"'"}riqnomasi
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:shadow-glow-lg hover:brightness-110"
          >
            Kirish
          </Link>
        </nav>
      </div>
    </header>
  );
}

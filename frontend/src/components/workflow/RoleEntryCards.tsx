import Link from "next/link";

const cards = [
  {
    title: "Teacher",
    desc: "Sign in with a teacher demo account.",
    href: "/login?role=teacher",
    accent:
      "border-emerald-200/90 bg-emerald-50/80 hover:border-emerald-300 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:hover:border-emerald-800",
    cta: "Sign in",
  },
  {
    title: "Student",
    desc: "Sign in with a student demo account and explore assessments.",
    href: "/login?role=student",
    accent:
      "border-violet-200/90 bg-violet-50/80 hover:border-violet-300 dark:border-violet-900/60 dark:bg-violet-950/30 dark:hover:border-violet-800",
    cta: "Sign in",
  },
  {
    title: "Administrator",
    desc: "Manage structure and optional audit tools.",
    href: "/login?role=admin",
    accent:
      "border-amber-200/90 bg-amber-50/80 hover:border-amber-300 dark:border-amber-900/60 dark:bg-amber-950/30 dark:hover:border-amber-800",
    cta: "Sign in",
  },
] as const;

export function RoleEntryCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <Link
          key={c.title}
          href={c.href}
          className={`flex flex-col rounded-2xl border-2 p-5 transition ${c.accent}`}
        >
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            {c.title}
          </h2>
          <p className="mt-2 flex-1 text-sm text-neutral-600 dark:text-neutral-400">
            {c.desc}
          </p>
          <span className="mt-4 text-sm font-medium text-blue-600 dark:text-blue-400">
            {c.cta} &rarr;
          </span>
        </Link>
      ))}
    </div>
  );
}

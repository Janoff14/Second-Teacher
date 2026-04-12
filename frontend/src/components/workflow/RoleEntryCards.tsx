import Link from "next/link";

const cards = [
  {
    title: "O\u2018qituvchi",
    desc: "Admin tomonidan berilgan email va parol bilan kiring.",
    href: "/login?role=teacher",
    gradient: "from-brand-500 to-violet-500",
    bg: "bg-brand-50/60 dark:bg-slate-900",
    border: "border-brand-200/60 hover:border-brand-400 dark:border-slate-700 dark:hover:border-brand-600",
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
      </svg>
    ),
    cta: "Kirish",
  },
  {
    title: "Talaba",
    desc: "Sinf kodi bilan qo\u2018shiling, test va o\u2018rganish.",
    href: "/join",
    gradient: "from-accent-500 to-cyan-500",
    bg: "bg-accent-50/60 dark:bg-slate-900",
    border: "border-accent-200/60 hover:border-accent-400 dark:border-slate-700 dark:hover:border-accent-600",
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    cta: "Kod bilan qo\u2018shilish",
  },
  {
    title: "Administrator",
    desc: "Tuzilma va (ixtiyoriy) audit.",
    href: "/login?role=admin",
    gradient: "from-amber-500 to-orange-500",
    bg: "bg-amber-50/60 dark:bg-slate-900",
    border: "border-amber-200/60 hover:border-amber-400 dark:border-slate-700 dark:hover:border-amber-600",
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
    cta: "Kirish",
  },
] as const;

export function RoleEntryCards() {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {cards.map((c) => (
        <Link
          key={c.title}
          href={c.href}
          className={`group relative flex flex-col overflow-hidden rounded-3xl border ${c.border} ${c.bg} p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover`}
        >
          <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${c.gradient} text-white shadow-lg`}>
            {c.icon}
          </div>
          <h2 className="text-xl font-bold text-foreground">
            {c.title}
          </h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground/70">
            {c.desc}
          </p>
          <span className={`mt-5 inline-flex items-center gap-2 text-sm font-semibold bg-gradient-to-r ${c.gradient} bg-clip-text text-transparent transition-all group-hover:gap-3`}>
            {c.cta}
            <svg className="h-4 w-4 text-brand-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </Link>
      ))}
    </div>
  );
}

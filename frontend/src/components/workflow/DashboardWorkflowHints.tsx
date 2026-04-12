import Link from "next/link";

type Variant = "teacher" | "student";

const TEACHER_STEPS: { label: string; href: string }[] = [
  { label: "Tuzilma", href: "/teacher/structure" },
  { label: "Corpus", href: "/teacher/corpus" },
  { label: "Baholash", href: "/teacher/assessments" },
  { label: "Insights", href: "/teacher/insights" },
  { label: "Agent", href: "/teacher/agent" },
];

const STUDENT_STEPS: { label: string; href: string }[] = [
  { label: "Sinfdan qo'shilish", href: "/join" },
  { label: "Corpus", href: "/student/corpus" },
  { label: "Baholash", href: "/student/assessments" },
  { label: "Insights", href: "/student/insights" },
  { label: "Agent", href: "/student/agent" },
];

export function DashboardWorkflowHints({ variant }: { variant: Variant }) {
  const steps = variant === "teacher" ? TEACHER_STEPS : STUDENT_STEPS;
  const title =
    variant === "teacher"
      ? "Tavsiya etilgan tartib (demo)"
      : "Talaba oqimi";

  return (
    <div className="rounded-3xl border border-brand-100/60 bg-gradient-to-br from-brand-50/40 to-white p-5 shadow-card dark:border-slate-700 dark:from-slate-900 dark:to-slate-900/80">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">
        Platform workflow
      </p>
      <p className="mt-1.5 text-sm font-semibold text-foreground/80">
        {title}
      </p>
      <ol className="mt-4 flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <li key={s.href} className="contents">
            <Link
              href={s.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-200/60 bg-white px-3.5 py-1.5 text-xs font-semibold text-foreground/70 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:text-brand-600 hover:shadow-card dark:border-slate-600 dark:bg-slate-800 dark:hover:border-brand-600 dark:hover:text-brand-400"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-600 dark:bg-brand-900 dark:text-brand-300">
                {i + 1}
              </span>
              {s.label}
            </Link>
          </li>
        ))}
      </ol>
      <Link
        href="/guide"
        className="mt-4 inline-block text-xs font-semibold text-brand-500 hover:underline dark:text-brand-400"
      >
        To'liq yo'riqnoma →
      </Link>
    </div>
  );
}

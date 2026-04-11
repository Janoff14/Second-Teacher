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
  { label: "Sinfdan qo‘shilish", href: "/join" },
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
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Platform workflow
      </p>
      <p className="mt-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">
        {title}
      </p>
      <ol className="mt-3 flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <li key={s.href} className="contents">
            <Link
              href={s.href}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-800 hover:border-blue-300 hover:text-blue-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-blue-700 dark:hover:text-blue-300"
            >
              <span className="text-neutral-400">{i + 1}.</span>
              {s.label}
            </Link>
          </li>
        ))}
      </ol>
      <Link
        href="/guide"
        className="mt-3 inline-block text-xs text-blue-600 hover:underline dark:text-blue-400"
      >
        To‘liq yo‘riqnoma →
      </Link>
    </div>
  );
}

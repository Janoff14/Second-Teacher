import Link from "next/link";

const STEPS = [
  { label: "Tuzilma", hint: "fan, guruh, kod", wf: "WF-ACADEMIC" },
  { label: "Darslik + RAG", hint: "yuklash va qidiruv", wf: "WF-CORPUS-*" },
  { label: "Qo\u2018shilish", hint: "talaba", wf: "WF-JOIN" },
  { label: "Baholash", hint: "testlar", wf: "WF-ASSESS-*" },
  { label: "Insights", hint: "xavf / feed", wf: "WF-INSIGHTS-*" },
  { label: "Agent", hint: "chat", wf: "WF-AGENT-*" },
] as const;

export function GoldenPathVisual() {
  return (
    <div className="w-full overflow-x-auto pb-2">
      <ol className="flex min-w-[min(100%,720px)] items-stretch gap-3 md:gap-4">
        {STEPS.map((s, i) => (
          <li
            key={s.label}
            className="group relative flex flex-1 flex-col rounded-2xl border border-brand-200/50 bg-white px-3 py-4 text-center shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-hover dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-700"
          >
            <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 text-[11px] font-bold text-white shadow-sm">
              {i + 1}
            </span>
            <span className="mt-2 text-xs font-bold text-foreground md:text-sm">
              {s.label}
            </span>
            <span className="mt-1 hidden text-[10px] text-foreground/55 sm:block">
              {s.hint}
            </span>
            <span className="mt-1.5 font-mono text-[9px] text-foreground/50">{s.wf}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-center text-xs text-foreground/55">
        Batafsil:{" "}
        <Link href="/guide" className="font-semibold text-brand-500 underline-offset-2 hover:underline dark:text-brand-400">
          Platform yo{"'"}riqnomasi
        </Link>{" "}
        (repo: <span className="font-mono text-[10px]">platform-user-workflow.md</span>).
      </p>
    </div>
  );
}

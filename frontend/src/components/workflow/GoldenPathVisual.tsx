import Link from "next/link";

const STEPS = [
  { label: "Structure", hint: "subject, group, code", wf: "WF-ACADEMIC" },
  { label: "Textbook + RAG", hint: "ingest and search", wf: "WF-CORPUS-*" },
  { label: "Join", hint: "student", wf: "WF-JOIN" },
  { label: "Assessments", hint: "tests", wf: "WF-ASSESS-*" },
  { label: "Insights", hint: "risk / feed", wf: "WF-INSIGHTS-*" },
  { label: "Agent", hint: "chat", wf: "WF-AGENT-*" },
] as const;

export function GoldenPathVisual() {
  return (
    <div className="w-full overflow-x-auto pb-2">
      <ol className="flex min-w-[min(100%,720px)] items-stretch gap-2 md:gap-3">
        {STEPS.map((s, i) => (
          <li
            key={s.label}
            className="flex flex-1 flex-col rounded-lg border border-blue-200/80 bg-gradient-to-b from-blue-50/90 to-white px-2 py-3 text-center dark:border-blue-900/50 dark:from-blue-950/40 dark:to-neutral-950"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
              {i + 1}
            </span>
            <span className="mt-1 text-xs font-semibold text-neutral-900 dark:text-neutral-100 md:text-sm">
              {s.label}
            </span>
            <span className="mt-0.5 hidden text-[10px] text-neutral-500 sm:block">
              {s.hint}
            </span>
            <span className="mt-1 font-mono text-[9px] text-neutral-400">{s.wf}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-center text-xs text-neutral-500 dark:text-neutral-400">
        Details:{" "}
        <Link href="/guide" className="text-blue-600 underline dark:text-blue-400">
          Platform guide
        </Link>{" "}
        (repo: <span className="font-mono text-[10px]">platform-user-workflow.md</span>).
      </p>
    </div>
  );
}

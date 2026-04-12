import Link from "next/link";

export default function TeacherAgentPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Class assistant</h1>
      <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        The assistant is built into the teacher shell: open any class, then use the{" "}
        <strong className="font-medium text-neutral-800 dark:text-neutral-200">Assistant</strong> button in the
        header or press{" "}
        <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-xs dark:border-neutral-600 dark:bg-neutral-800">
          Ctrl+K
        </kbd>{" "}
        ({" "}
        <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-xs dark:border-neutral-600 dark:bg-neutral-800">
          Cmd+K
        </kbd>{" "}
        on Mac). You will get structured cards from class insights and materials, not a corner chat widget.
      </p>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Each group page also shows an <strong className="font-medium text-neutral-800 dark:text-neutral-200">Attention briefing</strong> strip for students who need follow-up.
      </p>
      <Link
        href="/teacher"
        className="inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

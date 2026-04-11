"use client";

import { useMemo, useState } from "react";
import { parseAgentReply, studentAgentChat } from "@/lib/api/agent";
import type { StudentWorkspace } from "@/lib/api/student";

type CoachMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function StudyCoachPanel({
  workspace,
}: {
  workspace: StudentWorkspace;
}) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const promptChips = useMemo(
    () => workspace.studyCoach.suggestedPrompts,
    [workspace.studyCoach.suggestedPrompts],
  );

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    setLoading(true);
    setError(null);
    setMessages((current) => [
      ...current,
      { id: `u-${Date.now()}`, role: "user", content: trimmed },
    ]);
    const result = await studentAgentChat({
      message: trimmed,
      groupId: workspace.group.id,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    const reply = parseAgentReply(result.data) || "No reply returned.";
    setMessages((current) => [
      ...current,
      { id: `a-${Date.now()}`, role: "assistant", content: reply },
    ]);
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
              {workspace.studyCoach.heading}
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
              Turn your analytics into a study plan
            </h3>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
              {workspace.studyCoach.intro}
            </p>
          </div>
          <div className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
            <p className="font-medium">Coach brief</p>
            <p className="mt-1">{workspace.analytics.narrative}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {promptChips.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void sendMessage(prompt)}
              disabled={loading}
              className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="mt-5 min-h-[320px] space-y-3 rounded-[1.5rem] bg-neutral-50 p-4 dark:bg-neutral-900/50">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-6 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-400">
              Ask for a short revision plan, an explanation of your trend, or a focused reading path before the next quiz.
            </div>
          ) : null}
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-8 rounded-2xl bg-blue-600 px-4 py-3 text-sm text-white"
                  : "mr-8 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
              }
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          ))}
          {loading ? (
            <div className="mr-8 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950">
              Building your coach reply...
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(input);
            setInput("");
          }}
          className="mt-4 flex gap-3"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={3}
            placeholder="Ask the coach what to review next, why your trend changed, or what textbook section to read first."
            className="min-h-[76px] flex-1 rounded-2xl border border-neutral-300 px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <button
            type="submit"
            disabled={loading}
            className="self-end rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Send
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <h4 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Reading shortcuts
          </h4>
          <div className="mt-4 space-y-3">
            {workspace.analytics.recommendedReadings.map((reading) => (
              <a
                key={reading.id}
                href={reading.readerPath}
                className="block rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-blue-800"
              >
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {reading.title}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                  {reading.sourceTitle}
                </p>
                {reading.highlightText ? (
                  <p className="mt-2 line-clamp-3 text-sm text-neutral-600 dark:text-neutral-400">
                    {reading.highlightText}
                  </p>
                ) : null}
              </a>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <h4 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            AI alerts
          </h4>
          <div className="mt-4 space-y-3">
            {workspace.alerts.length === 0 ? (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                No active alerts right now. The coach will still use your latest analytics and readings.
              </p>
            ) : (
              workspace.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-900/40 dark:bg-amber-950/20"
                >
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    {alert.title}
                  </p>
                  <p className="mt-2 text-sm text-amber-900/80 dark:text-amber-100/90">
                    {alert.body}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

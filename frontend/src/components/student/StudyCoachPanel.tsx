"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { parseAgentReply, studentAgentChat, type PageContext, type StudentAgentReading } from "@/lib/api/agent";
import type { StudentWorkspace } from "@/lib/api/student";

type CoachMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  readings?: StudentAgentReading[];
  suggestedAssessments?: Array<{ id: string; title: string; link: string }>;
};

export function StudyCoachPanel({
  workspace,
  pageContext,
}: {
  workspace: StudentWorkspace;
  pageContext?: PageContext;
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
      pageContext: pageContext ?? { page: "student-workspace" },
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    const data = result.data;
    const reply = typeof data === "object" && data !== null && "reply" in data
      ? (data as { reply: string }).reply
      : parseAgentReply(data) || "No reply returned.";
    const readings = typeof data === "object" && data !== null && "readings" in data
      ? (data as { readings: StudentAgentReading[] }).readings ?? []
      : [];
    const suggestedAssessments = typeof data === "object" && data !== null && "suggestedAssessments" in data
      ? (data as { suggestedAssessments: Array<{ id: string; title: string; link: string }> }).suggestedAssessments ?? []
      : [];
    setMessages((current) => [
      ...current,
      {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: reply,
        readings,
        suggestedAssessments,
      },
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
            <div key={message.id}>
              <div
                className={
                  message.role === "user"
                    ? "ml-8 rounded-2xl bg-blue-600 px-4 py-3 text-sm text-white"
                    : "mr-8 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                }
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.role === "assistant" && message.readings && message.readings.length > 0 ? (
                <div className="mr-8 mt-2 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Recommended readings
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {message.readings.map((reading, idx) => (
                      <a
                        key={`${message.id}-r-${idx}`}
                        href={reading.readerPath}
                        className="inline-flex items-center gap-1.5 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 transition hover:-translate-y-0.5 hover:shadow-sm dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
                      >
                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        <span className="font-medium">{reading.chapterTitle ?? reading.title}</span>
                        {reading.pageNumber ? <span className="text-blue-600/70 dark:text-blue-300/70">p.{reading.pageNumber}</span> : null}
                      </a>
                    ))}
                  </div>
                  {message.readings.some((r) => r.highlightText) ? (
                    <div className="space-y-1.5">
                      {message.readings.filter((r) => r.highlightText).slice(0, 2).map((r, idx) => (
                        <a
                          key={`${message.id}-hl-${idx}`}
                          href={r.readerPath}
                          className="block rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs transition hover:border-blue-300 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-blue-800"
                        >
                          <p className="font-medium text-neutral-800 dark:text-neutral-200">{r.sourceTitle}</p>
                          <p className="mt-1 line-clamp-2 text-neutral-600 dark:text-neutral-400">{r.highlightText}</p>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {message.role === "assistant" && message.suggestedAssessments && message.suggestedAssessments.length > 0 ? (
                <div className="mr-8 mt-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Practice these
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {message.suggestedAssessments.map((a) => (
                      <Link
                        key={a.id}
                        href={a.link}
                        className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        {a.title}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
          {loading ? (
            <div className="mr-8 flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
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
                  {alert.recommendedReadings.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {alert.recommendedReadings.map((reading) => (
                        <a
                          key={reading.id}
                          href={reading.readerPath}
                          className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-transparent dark:text-amber-100"
                        >
                          {reading.chapterTitle ?? reading.title}{reading.pageNumber ? ` p.${reading.pageNumber}` : ""}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

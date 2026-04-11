"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CorpusSearchPanel } from "@/components/rag/CorpusSearchPanel";
import { listGroups, listSubjects } from "@/lib/api/academic";
import type { Group, Subject } from "@/lib/api/academic";
import { parseAgentReply, studentAgentChat, teacherAgentChat } from "@/lib/api/agent";
import { useAuthStore } from "@/stores/auth-store";

type Role = "teacher" | "student";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
    >
      {message}
    </div>
  );
}

export function AgentChatSession({
  variant,
  fixedGroupId,
  fixedSubjectId,
}: {
  variant: Role;
  fixedGroupId?: string;
  fixedSubjectId?: string;
}) {
  const activeGroupId = useAuthStore((state) => state.activeGroupId);
  const showGroupSelectors = variant === "teacher" && !fixedGroupId?.trim();
  const storeGroupId = variant === "student";

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [chatGroupId, setChatGroupId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materialsSync, setMaterialsSync] = useState({ q: "", token: 0 });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lockedGroupId = fixedGroupId?.trim();
    if (lockedGroupId) {
      setChatGroupId(lockedGroupId);
      if (fixedSubjectId?.trim()) setSubjectId(fixedSubjectId.trim());
      return;
    }

    if (!showGroupSelectors) {
      if (activeGroupId) setChatGroupId(activeGroupId);
      return;
    }

    void (async () => {
      const res = await listSubjects();
      if (res.ok && Array.isArray(res.data)) {
        setSubjects(res.data);
      }
    })();
  }, [activeGroupId, fixedGroupId, fixedSubjectId, showGroupSelectors]);

  useEffect(() => {
    if (!showGroupSelectors || !subjectId.trim()) {
      setGroups([]);
      return;
    }

    void (async () => {
      const res = await listGroups(subjectId);
      if (res.ok && Array.isArray(res.data)) {
        setGroups(res.data);
      }
    })();
  }, [showGroupSelectors, subjectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const effectiveGroupId = useCallback(() => {
    if (fixedGroupId?.trim()) return fixedGroupId.trim();
    if (showGroupSelectors) return chatGroupId.trim();
    return chatGroupId.trim() || (activeGroupId ?? "").trim();
  }, [activeGroupId, chatGroupId, fixedGroupId, showGroupSelectors]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    const currentGroupId = effectiveGroupId();
    if (!text || !currentGroupId) {
      setError(
        variant === "teacher"
          ? "Select a class and enter a message."
          : "Join a class or set the class context, then enter a message.",
      );
      return;
    }

    setSending(true);
    setError(null);
    setMessages((current) => [
      ...current,
      { id: `u-${Date.now()}`, role: "user", content: text },
    ]);
    setInput("");

    const res =
      variant === "teacher"
        ? await teacherAgentChat({ message: text, groupId: currentGroupId })
        : await studentAgentChat({ message: text, groupId: currentGroupId });

    setSending(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }

    const reply = parseAgentReply(res.data);
    setMessages((current) => [
      ...current,
      {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: reply || "(Empty reply - check agent response parsing.)",
      },
    ]);
  }

  function sendSnippetToMaterials(snippet: string) {
    const q = snippet.slice(0, 500).trim();
    if (!q) return;
    setMaterialsSync((state) => ({ q, token: state.token + 1 }));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_minmax(280px,360px)]">
      <div className="flex min-h-[420px] flex-col">
        <div className="mb-4 space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            {fixedGroupId?.trim() ? "Class context" : "Choose class"}
          </h2>

          {fixedGroupId?.trim() ? (
            <p className="font-mono text-xs text-neutral-600 dark:text-neutral-400">
              groupId: {fixedGroupId.trim()}
            </p>
          ) : null}

          {showGroupSelectors ? (
            <div className="flex flex-wrap gap-2">
              <select
                value={subjectId}
                onChange={(event) => {
                  setSubjectId(event.target.value);
                  setChatGroupId("");
                }}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              >
                <option value="">Subject...</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              <select
                value={chatGroupId}
                onChange={(event) => setChatGroupId(event.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                disabled={!subjectId.trim()}
              >
                <option value="">Class...</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          ) : !fixedGroupId?.trim() ? (
            <input
              placeholder="groupId"
              value={chatGroupId}
              onChange={(event) => setChatGroupId(event.target.value)}
              className="w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-950"
            />
          ) : null}
        </div>

        <ErrorBox message={error} />

        <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/30">
          {messages.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Ask about the class materials or recent performance. Use the search panel on the right
              to double-check the exact source passage.
            </p>
          ) : null}

          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-8 rounded-lg bg-blue-50 px-3 py-2 text-sm dark:bg-blue-950/40"
                  : "mr-8 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              }
            >
              <p className="whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
                {message.content}
              </p>
              {message.role === "assistant" ? (
                <button
                  type="button"
                  onClick={() => sendSnippetToMaterials(message.content)}
                  className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  Search this in the materials panel
                </button>
              ) : null}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="mt-4 flex gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={2}
            placeholder="Message..."
            className="min-h-[44px] flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending}
            className="self-end rounded-md bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            {sending ? "..." : "Send"}
          </button>
        </form>
      </div>

      <div className="lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
        <CorpusSearchPanel
          showGroupSelectors={showGroupSelectors}
          storeGroupId={storeGroupId}
          syncQuery={materialsSync.token > 0 ? materialsSync : undefined}
          alignGroupId={fixedGroupId?.trim() || chatGroupId}
          fixedGroupId={fixedGroupId}
          title="Check the source while you chat"
          description="Search the same class materials in parallel so you can confirm what the AI should cite."
        />
      </div>
    </div>
  );
}

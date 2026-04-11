import { AgentChatSession } from "@/components/agent/AgentChatSession";

export default function TeacherAgentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          AI yordamchi
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Guruhni tanlang va savol bering. Iqtiboslar uchun{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">
            Corpus
          </code>{" "}
          panelidan foydalaning.
        </p>
      </div>
      <AgentChatSession variant="teacher" />
    </div>
  );
}

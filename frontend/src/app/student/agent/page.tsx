import { AgentChatSession } from "@/components/agent/AgentChatSession";

export default function StudentAgentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Study assistant
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Ask questions in your class context and double-check the source passage in the materials
          search panel.
        </p>
      </div>
      <AgentChatSession variant="student" />
    </div>
  );
}

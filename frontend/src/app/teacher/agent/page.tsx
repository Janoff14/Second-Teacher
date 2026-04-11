import { AgentChatSession } from "@/components/agent/AgentChatSession";

export default function TeacherAgentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          AI assistant
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Choose a class and ask a question. Use the materials panel to verify the exact textbook
          passage the AI should cite.
        </p>
      </div>
      <AgentChatSession variant="teacher" />
    </div>
  );
}

import { AgentChatSession } from "@/components/agent/AgentChatSession";

export default function StudentAgentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Agent chat
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
            POST /agent/student/chat
          </code>
          . Enrollment scopes your group; use corpus search to double-check sources.
        </p>
      </div>
      <AgentChatSession variant="student" />
    </div>
  );
}

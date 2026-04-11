"use client";

import Link from "next/link";
import { DashboardWorkflowHints } from "@/components/workflow/DashboardWorkflowHints";
import { useAuthStore } from "@/stores/auth-store";

export default function StudentDashboardPage() {
  const activeGroupId = useAuthStore((s) => s.activeGroupId);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
        Student dashboard
      </h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Phase 1a+: join flow, assessments, insights, corpus search, agent.
      </p>
      <div className="mt-6">
        <DashboardWorkflowHints variant="student" />
      </div>
      <div className="mt-6 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <p className="font-medium text-neutral-800 dark:text-neutral-200">
          Active group
        </p>
        {activeGroupId ? (
          <p className="mt-1 font-mono text-xs text-neutral-600 dark:text-neutral-400">
            {activeGroupId}
          </p>
        ) : (
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">
            No group yet —{" "}
            <Link
              href="/join"
              className="text-blue-600 underline dark:text-blue-400"
            >
              join with a code
            </Link>
            .
          </p>
        )}
        <p className="mt-3 flex flex-wrap gap-4 text-sm">
          <Link
            href="/student/corpus"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Corpus search
          </Link>
          <Link
            href="/student/assessments"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Assessments
          </Link>
          <Link
            href="/student/insights"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Insights
          </Link>
          <Link
            href="/student/agent"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Agent
          </Link>
        </p>
      </div>
    </div>
  );
}

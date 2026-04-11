"use client";

import { useSearchParams } from "next/navigation";
import { TeacherMaterialsPanel } from "@/components/teacher/TeacherMaterialsPanel";

export function CorpusClient() {
  const searchParams = useSearchParams();
  const subjectId = searchParams.get("subjectId") ?? "";
  const subjectName = searchParams.get("subjectName") ?? "this subject";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Teaching materials
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Upload books in everyday file formats, then let the platform prepare the reader and AI
          search automatically.
        </p>
      </div>

      {subjectId ? (
        <TeacherMaterialsPanel
          subjectId={subjectId}
          subjectName={subjectName}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
          Open this page from a subject or class so we know which subject should receive the
          textbook.
        </div>
      )}
    </div>
  );
}

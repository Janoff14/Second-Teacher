"use client";

import { useSearchParams } from "next/navigation";
import { CorpusSearchPanel } from "@/components/rag/CorpusSearchPanel";
import { TextbookIngestForm } from "@/components/rag/TextbookIngestForm";

export function CorpusClient() {
  const sp = useSearchParams();
  const subjectIdFromQuery = sp.get("subjectId");

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Corpus va RAG
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Fan uchun darslik yuklang, keyin guruh bo&apos;yicha korpusdan qidiring
          (AI funksiyalari uchun MVP).
        </p>
      </div>
      <TextbookIngestForm initialSubjectId={subjectIdFromQuery ?? undefined} />
      <CorpusSearchPanel showGroupSelectors />
    </div>
  );
}

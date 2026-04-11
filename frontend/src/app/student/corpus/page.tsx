import { CorpusSearchPanel } from "@/components/rag/CorpusSearchPanel";

export default function StudentCorpusPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Search your study materials
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Search the textbook and class materials linked to the class you joined.
        </p>
      </div>
      <CorpusSearchPanel storeGroupId />
    </div>
  );
}

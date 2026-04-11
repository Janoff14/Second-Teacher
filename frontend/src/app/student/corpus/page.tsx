import { CorpusSearchPanel } from "@/components/rag/CorpusSearchPanel";

export default function StudentCorpusPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Corpus search
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Query the class corpus for your enrolled group (
          <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">
            groupId
          </code>{" "}
          from join, or paste manually).
        </p>
      </div>
      <CorpusSearchPanel storeGroupId />
    </div>
  );
}

import { Suspense } from "react";
import { CorpusClient } from "./CorpusClient";

export default function TeacherCorpusPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-neutral-500">Loading...</p>
      }
    >
      <CorpusClient />
    </Suspense>
  );
}

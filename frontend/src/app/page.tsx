import Link from "next/link";
import { PublicNav } from "@/components/layout/PublicNav";
import { GoldenPathVisual } from "@/components/workflow/GoldenPathVisual";
import { RoleEntryCards } from "@/components/workflow/RoleEntryCards";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-950 dark:to-neutral-900">
      <PublicNav />
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-10 md:pt-14">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50 md:text-4xl">
            Second Teacher
          </h1>
          <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-400">
            A teaching and learning platform with subject structure, textbook-grounded
            search (RAG), assessments, insights, and AI coaching.
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
            Demo workflow and API sequence are aligned with the{" "}
            <Link
              href="/guide"
              className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
            >
              platform workflow
            </Link>{" "}
            guide.
          </p>
        </div>

        <div className="mt-10">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Recommended flow (golden path)
          </p>
          <GoldenPathVisual />
        </div>

        <div id="role-selection" className="mt-12 scroll-mt-24">
          <h2 className="mb-4 text-center text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Which role do you want to use?
          </h2>
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-left text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
            <p className="font-semibold">Demo accounts</p>
            <p className="mt-1">
              You can test how the platform looks and works using our demo accounts,
              already filled with data.
            </p>
            <ul className="mt-3 space-y-1 font-mono text-xs sm:text-sm">
              <li>Student: lila.kim_demo@secondteacher.dev</li>
              <li>Teacher: kamila.saidova_demo@secondteacher.dev</li>
            </ul>
          </div>
          <RoleEntryCards />
        </div>
      </div>
    </div>
  );
}

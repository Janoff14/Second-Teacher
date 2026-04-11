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
            O{"'"}qituvchi va talabalarga mo{"'"}ljallangan platforma: fan tuzilmasi, darslik
            asosidagi qidiruv (RAG), baholash, insights va AI yordamchisi.
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
            Demo tartibi va API ketma-ketligi{" "}
            <Link
              href="/guide"
              className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
            >
              platform workflow
            </Link>{" "}
            hujjati bilan moslashtirilgan.
          </p>
        </div>

        <div className="mt-10">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Tavsiya etilgan oqim (golden path)
          </p>
          <GoldenPathVisual />
        </div>

        <div className="mt-12">
          <h2 className="mb-4 text-center text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Kim sifatida kirmoqchisiz?
          </h2>
          <RoleEntryCards />
        </div>
      </div>
    </div>
  );
}

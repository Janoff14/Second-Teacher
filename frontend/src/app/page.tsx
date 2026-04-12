import Link from "next/link";
import { PublicNav } from "@/components/layout/PublicNav";
import { GoldenPathVisual } from "@/components/workflow/GoldenPathVisual";
import { RoleEntryCards } from "@/components/workflow/RoleEntryCards";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-dot-pattern opacity-40" />
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-brand-400/20 blur-[100px]" />
        <div className="absolute -right-40 top-20 h-96 w-96 rounded-full bg-violet-400/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-accent-400/15 blur-[80px]" />

        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 md:pt-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/80 px-4 py-1.5 text-xs font-semibold text-brand-600 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-300">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
              AI-powered education platform
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
              Second<span className="text-gradient-brand">Teacher</span>
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-foreground/70 md:text-xl">
              O{"'"}qituvchi va talabalarga mo{"'"}ljallangan platforma: fan tuzilmasi, darslik
              asosidagi qidiruv (RAG), baholash, insights va AI yordamchisi.
            </p>
            <p className="mt-3 text-sm text-foreground/60">
              Demo tartibi va API ketma-ketligi{" "}
              <Link
                href="/guide"
                className="font-semibold text-brand-500 underline-offset-2 hover:underline dark:text-brand-400"
              >
                platform workflow
              </Link>{" "}
              hujjati bilan moslashtirilgan.
            </p>
          </div>

          <div className="mt-14">
            <p className="mb-4 text-center text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">
              Tavsiya etilgan oqim (golden path)
            </p>
            <GoldenPathVisual />
          </div>

          <div className="mt-16">
            <h2 className="mb-6 text-center text-sm font-bold uppercase tracking-[0.15em] text-foreground/60">
              Kim sifatida kirmoqchisiz?
            </h2>
            <RoleEntryCards />
          </div>
        </div>
      </section>
    </div>
  );
}

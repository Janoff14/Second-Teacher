import type { Metadata } from "next";
import Link from "next/link";
import { PublicNav } from "@/components/layout/PublicNav";
import { GoldenPathVisual } from "@/components/workflow/GoldenPathVisual";

export const metadata: Metadata = {
  title: "Platform yo'riqnomasi | Second Teacher",
  description:
    "Kim nima qiladi, qaysi tartibda va qaysi endpointlar — Second Teacher user workflow.",
};

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-neutral-100 px-1 py-0.5 text-[0.85em] dark:bg-neutral-800">
      {children}
    </code>
  );
}

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <PublicNav />
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-8">
        <p className="text-sm text-neutral-500">
          <Link href="/" className="hover:underline">
            &larr; Bosh sahifa
          </Link>
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Platform user workflow
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Mahsulot va frontend integratsiyasi uchun: kim nima qiladi, qanday tartibda,
          qaysi HTTP chaqiriqlar va nima uchun. UI/UX erkin; bu sahifa oqim va API
          xaritasini bir joyda beradi.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Hamroh hujjatlar: repo ildizida{" "}
          <span className="text-neutral-700 dark:text-neutral-300">
            api-for-frontend.md
          </span>
          ,{" "}
          <span className="text-neutral-700 dark:text-neutral-300">
            frontend-implementation-plan.md
          </span>
          .
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Global qoidalar (har bir klient)
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
            <li>
              <strong className="font-medium">API jonligi:</strong>{" "}
              <Code>GET /health</Code>. <Code>GET /</Code> ishlatilmaydi (404).
            </li>
            <li>
              <strong className="font-medium">Autentifikatsiya:</strong> login keyin JWT
              saqlang; himoyalangan so{"'"}rovlarda{" "}
              <Code>Authorization: Bearer &lt;token&gt;</Code>.
            </li>
            <li>
              <strong className="font-medium">Sessiya:</strong> JWT ~12 soat; refresh
              yo{"'"}q &mdash; <Code>401</Code> bo{"'"}lsa qayta login.
            </li>
            <li>
              <strong className="font-medium">Javob shakli:</strong> muvaffaqiyat{" "}
              <Code>data</Code>, xato <Code>error.code</Code> /{" "}
              <Code>error.message</Code>.
            </li>
            <li>
              <strong className="font-medium">CORS:</strong> backend{" "}
              <Code>CORS_ORIGIN</Code> brauzer manzillarini qamrab olishi kerak.
            </li>
            <li>
              <strong className="font-medium">Demo:</strong> asosiy ma{"'"}lumotlar
              hozircha xotirada; deploy qayta ishga tushganda tozalanishi mumkin &mdash;
              banner va bo{"'"}sh holatlar shunga mos.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Stakeholder golden path
          </h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Tuzilma &rarr; darslik + RAG &rarr; qo{"'"}shilish &rarr; baholash &rarr; insights/xavf &rarr; corpus
            qidiruv + agent chat. MVP uchun corpus ingest va search majburiy hisoblanadi.
          </p>
          <div className="mt-4">
            <GoldenPathVisual />
          </div>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Workflow bo{"'"}limlari
          </h2>

          <details className="group rounded-lg border border-neutral-200 bg-white open:shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <summary className="cursor-pointer list-none px-4 py-3 font-medium text-neutral-900 marker:content-none dark:text-neutral-100 [&::-webkit-details-marker]:hidden">
              1. O{"'"}qituvchi / admin &mdash; tuzilma (WF-ACADEMIC + WF-AUTH)
            </summary>
            <div className="border-t border-neutral-100 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              <p>
                Kirish: <Code>POST /auth/login</Code>; ro{"'"}yxat:{" "}
                <Code>POST /auth/register</Code>. Fan: <Code>POST /GET /subjects</Code>.
                Guruh: <Code>POST /GET /groups</Code>. O{"'"}qituvchi tayinlash:{" "}
                <Code>POST /groups/:groupId/assign-teacher</Code>. Qo{"'"}shilish kodi:{" "}
                <Code>POST .../join-codes</Code>, bekor:{" "}
                <Code>POST .../join-codes/revoke</Code>.
              </p>
              <p className="mt-2 text-neutral-500">
                Fan va guruh RAG, baholash, insights va agentni chegaralaydi.
              </p>
              <p className="mt-2">
                Ilova:{" "}
                <Link
                  href="/teacher/structure"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  /teacher/structure
                </Link>
                ,{" "}
                <Link href="/login" className="text-blue-600 hover:underline dark:text-blue-400">
                  login
                </Link>
                .
              </p>
            </div>
          </details>

          <details className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <summary className="cursor-pointer px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
              2. O{"'"}qituvchi &mdash; corpus ingest (WF-CORPUS-INGEST) &mdash; MVP
            </summary>
            <div className="border-t border-neutral-100 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              <Code>POST /rag/sources/textbooks</Code> &mdash;{" "}
              <Code>subjectId</Code>, <Code>title</Code>, <Code>versionLabel</Code>,{" "}
              <Code>text</Code>.
              <p className="mt-2">
                <Link href="/teacher/corpus" className="text-blue-600 hover:underline dark:text-blue-400">
                  /teacher/corpus
                </Link>
              </p>
            </div>
          </details>

          <details className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <summary className="cursor-pointer px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
              3. Corpus qidiruv (WF-CORPUS-SEARCH) &mdash; MVP
            </summary>
            <div className="border-t border-neutral-100 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              <Code>POST /rag/query</Code> &mdash; <Code>query</Code>, <Code>groupId</Code>,{" "}
              <Code>topK</Code>.
              <p className="mt-2 flex flex-wrap gap-2">
                <Link href="/teacher/corpus" className="text-blue-600 hover:underline dark:text-blue-400">
                  O{"'"}qituvchi corpus
                </Link>
                <Link href="/student/corpus" className="text-blue-600 hover:underline dark:text-blue-400">
                  Talaba corpus
                </Link>
              </p>
            </div>
          </details>

          <details className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <summary className="cursor-pointer px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
              4. Talaba &mdash; qo{"'"}shilish (WF-JOIN + WF-AUTH)
            </summary>
            <div className="border-t border-neutral-100 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              <Code>POST /enrollment/preview</Code> &mdash; kodni tekshirish;{" "}
              <Code>POST /auth/signup-with-join-code</Code> &mdash; ro{"'"}yxat + enrollment +
              token.
              <p className="mt-2">
                <Link href="/join" className="text-blue-600 hover:underline dark:text-blue-400">
                  /join
                </Link>
              </p>
            </div>
          </details>

          <details className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <summary className="cursor-pointer px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
              5. O{"'"}qituvchi &mdash; baholash tuzish (WF-ASSESS-AUTHOR)
            </summary>
            <div className="border-t border-neutral-100 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              Draft: <Code>POST /assessments/drafts</Code>,{" "}
              <Code>GET /assessments/drafts/:draftId</Code>,{" "}
              <Code>PUT .../items</Code>. Nashr: <Code>POST .../publish</Code>. Ro{"'"}yxat:{" "}
              <Code>GET /assessments/published?groupId=</Code>.
              <p className="mt-2 flex flex-wrap gap-2">
                <Link href="/teacher/assessments" className="text-blue-600 hover:underline dark:text-blue-400">
                  Assessments
                </Link>
                <Link href="/teacher/assessments/published" className="text-blue-600 hover:underline dark:text-blue-400">
                  Published
                </Link>
              </p>
            </div>
          </details>

          <details className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <summary className="cursor-pointer px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
              6. Talaba &mdash; test topshirish (WF-ASSESS-TAKE)
            </summary>
            <div className="border-t border-neutral-100 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              <Code>GET /assessments/published</Code>,{" "}
              <Code>GET /assessments/published/:versionId</Code>,{" "}
              <Code>POST .../attempts</Code>, <Code>GET .../attempts/me</Code>.
              <p className="mt-2 flex flex-wrap gap-2">
                <Link href="/student/assessments" className="text-blue-600 hover:underline dark:text-blue-400">
                  /student/assessments
                </Link>
                <Link
                  href="/student/assessments/attempts"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  attempts
                </Link>
              </p>
            </div>
          </details>

          <details className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <summary className="cursor-pointer px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
              7. O{"'"}qituvchi &mdash; insights va xavf (WF-INSIGHTS-T)
            </summary>
            <div className="border-t border-neutral-100 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              <Code>POST /groups/:groupId/analytics/recompute</Code>,{" "}
              <Code>GET /insights?groupId=</Code>,{" "}
              <Code>GET /analytics/risk?studentId=&amp;groupId=</Code>,{" "}
              <Code>POST /insights/:insightId/status</Code>.
              <p className="mt-2">
                <Link href="/teacher/insights" className="text-blue-600 hover:underline dark:text-blue-400">
                  /teacher/insights
                </Link>
              </p>
            </div>
          </details>

          <details className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <summary className="cursor-pointer px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
              8. Talaba &mdash; o{"'"}z insights (WF-INSIGHTS-S)
            </summary>
            <div className="border-t border-neutral-100 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              <Code>GET /insights/me?groupId=</Code>
              <p className="mt-2">
                <Link href="/student/insights" className="text-blue-600 hover:underline dark:text-blue-400">
                  /student/insights
                </Link>
              </p>
            </div>
          </details>

          <details className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <summary className="cursor-pointer px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
              9&ndash;10. Agent chat (WF-AGENT-S / WF-AGENT-T)
            </summary>
            <div className="border-t border-neutral-100 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              Talaba: <Code>POST /agent/student/chat</Code>. O{"'"}qituvchi:{" "}
              <Code>POST /agent/teacher/chat</Code> &mdash; <Code>message</Code>,{" "}
              <Code>groupId</Code>. Corpus qidiruv bilan juftlash tavsiya etiladi.
              <p className="mt-2 flex flex-wrap gap-2">
                <Link href="/student/agent" className="text-blue-600 hover:underline dark:text-blue-400">
                  Talaba agent
                </Link>
                <Link href="/teacher/agent" className="text-blue-600 hover:underline dark:text-blue-400">
                  O{"'"}qituvchi agent
                </Link>
              </p>
            </div>
          </details>

          <details className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <summary className="cursor-pointer px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
              11. Bildirishnomalar (WF-NOTIFY)
            </summary>
            <div className="border-t border-neutral-100 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              <Code>GET /notifications/me</Code> &mdash; ixtiyoriy <Code>limit</Code> (1&ndash;100).
              <p className="mt-2">
                <Link href="/notifications" className="text-blue-600 hover:underline dark:text-blue-400">
                  /notifications
                </Link>{" "}
                &mdash; inbox (kirgan foydalanuvchi).
              </p>
            </div>
          </details>

          <details className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <summary className="cursor-pointer px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
              12. Admin &mdash; audit (WF-AUDIT)
            </summary>
            <div className="border-t border-neutral-100 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              <Code>GET /audit/logs</Code> &mdash; filtrlar: <Code>limit</Code>,{" "}
              <Code>actorId</Code>, <Code>action</Code>, <Code>groupId</Code>,{" "}
              <Code>since</Code>. Eksport: <Code>GET /audit/logs/export</Code>.
              <p className="mt-2">
                <Link href="/admin/audit" className="text-blue-600 hover:underline dark:text-blue-400">
                  /admin/audit
                </Link>
              </p>
            </div>
          </details>
        </section>

        <section className="mt-10 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Integratsiya checklist (qisqa)
          </h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
            <li>
              Frontend <Code>NEXT_PUBLIC_API_BASE_URL</Code> &mdash; oxirida slash yo{"'"}q.
            </li>
            <li>Backend <Code>CORS_ORIGIN</Code> frontend manzillariga mos.</li>
            <li>Token saqlash; <Code>Authorization</Code>; <Code>error.code</Code> UX.</li>
            <li>Golden path: corpus ingest va search o{"'"}tkazib yuborilmasin.</li>
          </ol>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Workflow ID lar
          </h2>
          <div className="mt-2 overflow-x-auto text-xs">
            <table className="w-full border-collapse text-left text-neutral-700 dark:text-neutral-300">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="py-2 pr-2 font-medium">ID</th>
                  <th className="py-2 font-medium">Qamrov</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[11px] sm:text-xs">
                {[
                  ["WF-AUTH", "Login, register, bearer, 401, rollar"],
                  ["WF-JOIN", "Kod preview \u2192 signup \u2192 groupId"],
                  ["WF-ACADEMIC", "Fan, guruh, kodlar, tayinlash"],
                  ["WF-CORPUS-INGEST", "Darslik yuklash"],
                  ["WF-CORPUS-SEARCH", "RAG query"],
                  ["WF-ASSESS-AUTHOR", "Draft \u2192 items \u2192 publish"],
                  ["WF-ASSESS-TAKE", "Ro\u2018yxat \u2192 attempt \u2192 attempts/me"],
                  ["WF-INSIGHTS-T", "O\u2018qituvchi insights, risk"],
                  ["WF-INSIGHTS-S", "Talaba insights/me"],
                  ["WF-AGENT-T / WF-AGENT-S", "Chat"],
                  ["WF-NOTIFY", "Bildirishnomalar"],
                  ["WF-AUDIT", "Admin loglar va eksport"],
                ].map(([id, scope]) => (
                  <tr key={id} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-1.5 pr-2 align-top text-blue-700 dark:text-blue-400">
                      {id}
                    </td>
                    <td className="py-1.5 text-neutral-600 dark:text-neutral-400">{scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

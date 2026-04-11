"use client";

import { useCallback, useState } from "react";
import {
  getRiskAnalytics,
  listTeacherInsights,
  recomputeGroupAnalytics,
  setInsightStatus,
  unwrapInsightList,
  type Insight,
} from "@/lib/api/insights";

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
    >
      {message}
    </div>
  );
}

export default function TeacherInsightsPage() {
  const [groupId, setGroupId] = useState("");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [studentId, setStudentId] = useState("");
  const [riskGroupId, setRiskGroupId] = useState("");
  const [riskJson, setRiskJson] = useState<string | null>(null);
  const [recomputeBusy, setRecomputeBusy] = useState(false);

  const loadInsights = useCallback(async () => {
    const gid = groupId.trim();
    if (!gid) {
      setError("Guruh ID kiriting.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await listTeacherInsights(gid);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setInsights([]);
      return;
    }
    setInsights(unwrapInsightList(res.data));
  }, [groupId]);

  async function handleStatus(insight: Insight, status: string) {
    setError(null);
    const res = await setInsightStatus(insight.id, { status });
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    await loadInsights();
  }

  async function handleRecompute() {
    const gid = groupId.trim();
    if (!gid) {
      setError("Avval yuqorida guruh ID kiriting.");
      return;
    }
    setRecomputeBusy(true);
    setError(null);
    const res = await recomputeGroupAnalytics(gid);
    setRecomputeBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    await loadInsights();
  }

  async function handleRisk() {
    const sid = studentId.trim();
    const gid = riskGroupId.trim() || groupId.trim();
    if (!sid || !gid) {
      setError("Talaba ID va guruh ID kiriting.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await getRiskAnalytics({ studentId: sid, groupId: gid });
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setRiskJson(null);
      return;
    }
    setRiskJson(JSON.stringify(res.data, null, 2));
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Insights va xavf
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Guruh ID kiriting, insightlarni yuklang yoki talaba bo&apos;yicha xavf
          tahlilini oching.
        </p>
      </div>

      <ErrorBox message={error} />

      <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          Guruh
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            placeholder="guruh ID"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="min-w-[240px] flex-1 rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-950"
          />
          <button
            type="button"
            onClick={() => void loadInsights()}
            disabled={loading}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            {loading ? "Yuklanmoqda…" : "Insights yuklash"}
          </button>
          <button
            type="button"
            onClick={() => void handleRecompute()}
            disabled={recomputeBusy}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-600"
          >
            {recomputeBusy ? "Hisoblanmoqda…" : "Tahlilni qayta hisoblash"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          Insights ro&apos;yxati
        </h2>
        <ul className="mt-4 space-y-3">
          {insights.map((ins) => (
            <li
              key={ins.id}
              className="rounded-md border border-neutral-100 bg-neutral-50/80 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900/40"
            >
              <p className="font-mono text-xs text-neutral-500">{ins.id}</p>
              {(ins.title || ins.message || ins.body || ins.summary) && (
                <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">
                  {ins.title && <strong>{ins.title}</strong>}
                  {(ins.message || ins.body || ins.summary) && (
                    <span className="mt-1 block whitespace-pre-wrap">
                      {ins.message ?? ins.body ?? ins.summary}
                    </span>
                  )}
                </p>
              )}
              {ins.studentId && (
                <p className="mt-1 text-xs text-neutral-500">
                  student: {ins.studentId}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleStatus(ins, "acknowledged")}
                  className="rounded bg-green-700 px-2 py-1 text-xs text-white dark:bg-green-600"
                >
                  Qabul
                </button>
                <button
                  type="button"
                  onClick={() => void handleStatus(ins, "dismissed")}
                  className="rounded bg-neutral-600 px-2 py-1 text-xs text-white dark:bg-neutral-500"
                >
                  Yopish
                </button>
              </div>
            </li>
          ))}
        </ul>
        {insights.length === 0 && !loading && (
          <p className="mt-4 text-sm text-neutral-500">
            No insights loaded — enter groupId and load, or align API with{" "}
            <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
              insights.ts
            </code>
            .
          </p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          Xavf (talaba)
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            placeholder="talaba ID"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="min-w-[200px] rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-950"
          />
          <input
            placeholder="guruh ID (bo'sh bo'lsa yuqoridagi)"
            value={riskGroupId}
            onChange={(e) => setRiskGroupId(e.target.value)}
            className="min-w-[200px] rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-950"
          />
          <button
            type="button"
            onClick={() => void handleRisk()}
            disabled={loading}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            Xavfni olish
          </button>
        </div>
        {riskJson && (
          <pre className="mt-4 max-h-80 overflow-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-950">
            {riskJson}
          </pre>
        )}
      </section>
    </div>
  );
}

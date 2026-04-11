"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AgentChatSession } from "@/components/agent/AgentChatSession";
import {
  createJoinCode,
  listGroups,
  listJoinCodes,
  listSubjects,
  revokeJoinCode,
} from "@/lib/api/academic";
import type { Group, JoinCodeRecord, Subject } from "@/lib/api/academic";
import {
  createDraft,
  listDrafts,
  listPublishedAssessments,
  unwrapDraftList,
  unwrapPublishedList,
  type AssessmentDraft,
  type PublishedAssessment,
} from "@/lib/api/assessments";
import {
  getRiskAnalytics,
  listTeacherInsights,
  recomputeGroupAnalytics,
  setInsightStatus,
  unwrapInsightList,
  type Insight,
} from "@/lib/api/insights";

type TabId = "overview" | "assessments" | "analytics" | "agent";

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

export default function TeacherGroupWorkspacePage() {
  const params = useParams();
  const groupId = decodeURIComponent(params.groupId as string);

  const [tab, setTab] = useState<TabId>("overview");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [joinCodes, setJoinCodes] = useState<JoinCodeRecord[]>([]);
  const [joinBusy, setJoinBusy] = useState(false);
  const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<AssessmentDraft[]>([]);
  const [published, setPublished] = useState<PublishedAssessment[]>([]);
  const [draftTitle, setDraftTitle] = useState("");
  const [assessLoading, setAssessLoading] = useState(false);

  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightLoading, setInsightLoading] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [riskJson, setRiskJson] = useState<string | null>(null);
  const [recomputeBusy, setRecomputeBusy] = useState(false);

  const resolveMeta = useCallback(async () => {
    setMetaLoading(true);
    setError(null);
    const sRes = await listSubjects();
    if (!sRes.ok) {
      setError(sRes.error.message);
      setMetaLoading(false);
      return;
    }
    const subjects = Array.isArray(sRes.data) ? sRes.data : [];
    for (const s of subjects) {
      const gRes = await listGroups(s.id);
      const groups = gRes.ok && Array.isArray(gRes.data) ? gRes.data : [];
      const found = groups.find((g) => g.id === groupId);
      if (found) {
        setSubject(s);
        setGroup(found);
        setMetaLoading(false);
        return;
      }
    }
    setError("Guruh topilmadi yoki sizda ruxsat yo\u2018q.");
    setSubject(null);
    setGroup(null);
    setMetaLoading(false);
  }, [groupId]);

  useEffect(() => {
    void resolveMeta();
  }, [resolveMeta]);

  const loadJoinCodes = useCallback(async () => {
    if (!groupId) return;
    const res = await listJoinCodes(groupId);
    if (res.ok && Array.isArray(res.data)) {
      setJoinCodes(res.data);
    }
  }, [groupId]);

  useEffect(() => {
    if (group && tab === "overview") void loadJoinCodes();
  }, [group, tab, loadJoinCodes]);

  const loadAssessments = useCallback(async () => {
    if (!groupId) return;
    setAssessLoading(true);
    const [dRes, pRes] = await Promise.all([
      listDrafts(groupId),
      listPublishedAssessments(groupId),
    ]);
    setAssessLoading(false);
    if (dRes.ok) setDrafts(unwrapDraftList(dRes.data));
    if (pRes.ok) setPublished(unwrapPublishedList(pRes.data));
  }, [groupId]);

  useEffect(() => {
    if (group && tab === "assessments") void loadAssessments();
  }, [group, tab, loadAssessments]);

  const loadInsights = useCallback(async () => {
    if (!groupId) return;
    setInsightLoading(true);
    setError(null);
    const res = await listTeacherInsights(groupId);
    setInsightLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setInsights([]);
      return;
    }
    setInsights(unwrapInsightList(res.data));
  }, [groupId]);

  useEffect(() => {
    if (group && tab === "analytics") void loadInsights();
  }, [group, tab, loadInsights]);

  async function handleCreateJoinCode() {
    setJoinBusy(true);
    setError(null);
    const res = await createJoinCode(groupId, {});
    setJoinBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    const code =
      res.data && typeof res.data === "object" && res.data !== null
        ? String((res.data as JoinCodeRecord).code ?? "")
        : "";
    setLastCreatedCode(code || null);
    await loadJoinCodes();
    if (code) {
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        /* ignore */
      }
    }
  }

  async function handleRevoke(joinCodeId: string) {
    setJoinBusy(true);
    setError(null);
    const res = await revokeJoinCode(groupId, joinCodeId);
    setJoinBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    await loadJoinCodes();
  }

  async function handleCreateDraft(e: React.FormEvent) {
    e.preventDefault();
    setAssessLoading(true);
    setError(null);
    const res = await createDraft({
      title: draftTitle.trim() || undefined,
      groupId,
    });
    setAssessLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setDraftTitle("");
    if (res.data?.id) {
      window.location.href = `/teacher/assessments/drafts/${res.data.id}`;
    } else {
      await loadAssessments();
    }
  }

  async function handleInsightStatus(ins: Insight, status: string) {
    const res = await setInsightStatus(ins.id, { status });
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    await loadInsights();
  }

  async function handleRecompute() {
    setRecomputeBusy(true);
    setError(null);
    const res = await recomputeGroupAnalytics(groupId);
    setRecomputeBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    await loadInsights();
  }

  async function handleRisk() {
    const sid = studentId.trim();
    if (!sid) {
      setError("Talaba ID kiriting.");
      return;
    }
    setInsightLoading(true);
    setError(null);
    const res = await getRiskAnalytics({ studentId: sid, groupId });
    setInsightLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setRiskJson(null);
      return;
    }
    setRiskJson(JSON.stringify(res.data, null, 2));
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Umumiy" },
    { id: "assessments", label: "Baholashlar" },
    { id: "analytics", label: "Tahlil" },
    { id: "agent", label: "Yordamchi" },
  ];

  if (metaLoading) {
    return (
      <p className="text-sm text-neutral-500">Yuklanmoqda\u2026</p>
    );
  }

  if (!group || !subject) {
    return (
      <div className="space-y-4">
        <ErrorBox message={error} />
        <Link
          href="/teacher"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          &larr; Bosh panelga
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/teacher"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          &larr; Bosh panel
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          {group.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Fan: <span className="font-medium">{subject.name}</span>
        </p>
        <p className="mt-2">
          <Link
            href={`/teacher/corpus?subjectId=${encodeURIComponent(subject.id)}`}
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Darsliklar va korpus (shu fan)
          </Link>
        </p>
        <p className="mt-1 font-mono text-xs text-neutral-500">{groupId}</p>
      </div>

      <ErrorBox message={error} />

      <div className="flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-700">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? "border-b-2 border-neutral-900 px-3 py-2 text-sm font-medium text-neutral-900 dark:border-neutral-100 dark:text-neutral-50"
                : "px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Join kodlar
          </h2>
          {lastCreatedCode ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Yangi kod:{" "}
              <code className="rounded bg-emerald-100 px-2 py-0.5 font-mono dark:bg-emerald-950/60">
                {lastCreatedCode}
              </code>{" "}
              (buferga nusxa olindi)
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleCreateJoinCode()}
            disabled={joinBusy}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-emerald-600"
          >
            {joinBusy ? "Kutilmoqda\u2026" : "Yangi join kod"}
          </button>
          <ul className="space-y-2">
            {joinCodes.map((jc) => (
              <li
                key={jc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700"
              >
                <span className="font-mono">{jc.code}</span>
                <span className="text-xs text-neutral-500">
                  {jc.revokedAt ? "Bekor qilingan" : "Faol"}
                </span>
                {!jc.revokedAt ? (
                  <button
                    type="button"
                    onClick={() => void handleRevoke(jc.id)}
                    disabled={joinBusy}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Bekor qilish
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {joinCodes.length === 0 && (
            <p className="text-sm text-neutral-500">Hozircha kod yo\u2018q.</p>
          )}
        </section>
      )}

      {tab === "assessments" && (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Yangi qoralama
            </h2>
            <form
              onSubmit={(e) => void handleCreateDraft(e)}
              className="mt-2 flex flex-wrap gap-2"
            >
              <input
                placeholder="Sarlavha (ixtiyoriy)"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="min-w-[200px] flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                disabled={assessLoading}
              />
              <button
                type="submit"
                disabled={assessLoading}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
              >
                Qoralama yaratish
              </button>
            </form>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Qoralamalar
            </h3>
            <ul className="mt-2 space-y-2">
              {drafts.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-100 px-3 py-2 dark:border-neutral-800"
                >
                  <span className="font-mono text-xs">{d.id}</span>
                  {d.title ? (
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">
                      {d.title}
                    </span>
                  ) : null}
                  <Link
                    href={`/teacher/assessments/drafts/${d.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Tahrirlash
                  </Link>
                </li>
              ))}
            </ul>
            {drafts.length === 0 && !assessLoading && (
              <p className="mt-2 text-sm text-neutral-500">Qoralama yo\u2018q.</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Nashr etilgan
            </h3>
            <ul className="mt-2 space-y-2">
              {published.map((p) => (
                <li
                  key={p.id}
                  className="rounded-md border border-neutral-100 px-3 py-2 text-sm dark:border-neutral-800"
                >
                  <span className="font-mono text-xs">{p.id}</span>
                  {p.title ? (
                    <span className="ml-2">{p.title}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            {published.length === 0 && !assessLoading && (
              <p className="mt-2 text-sm text-neutral-500">
                Nashr etilgan test yo\u2018q.
              </p>
            )}
          </div>
          <p className="text-sm">
            <Link
              href="/teacher/assessments/published"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Barcha nashrlar (filtr)
            </Link>
          </p>
        </section>
      )}

      {tab === "analytics" && (
        <section className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadInsights()}
              disabled={insightLoading}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              {insightLoading ? "Yuklanmoqda\u2026" : "Insights yangilash"}
            </button>
            <button
              type="button"
              onClick={() => void handleRecompute()}
              disabled={recomputeBusy}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-600"
            >
              {recomputeBusy ? "Hisoblanmoqda\u2026" : "Tahlilni qayta hisoblash"}
            </button>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Insights
            </h3>
            <ul className="mt-3 space-y-3">
              {insights.map((ins) => (
                <li
                  key={ins.id}
                  className="rounded-md border border-neutral-100 bg-neutral-50/80 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900/40"
                >
                  <p className="font-mono text-xs text-neutral-500">{ins.id}</p>
                  {(ins.title || ins.message || ins.body || ins.summary) && (
                    <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">
                      {ins.title ? <strong>{ins.title}</strong> : null}
                      {(ins.message || ins.body || ins.summary) && (
                        <span className="mt-1 block whitespace-pre-wrap">
                          {ins.message ?? ins.body ?? ins.summary}
                        </span>
                      )}
                    </p>
                  )}
                  {ins.studentId && (
                    <p className="mt-1 text-xs text-neutral-500">
                      talaba: {ins.studentId}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleInsightStatus(ins, "acknowledged")}
                      className="rounded bg-green-700 px-2 py-1 text-xs text-white dark:bg-green-600"
                    >
                      Qabul qilish
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleInsightStatus(ins, "dismissed")}
                      className="rounded bg-neutral-600 px-2 py-1 text-xs text-white dark:bg-neutral-500"
                    >
                      Yopish
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {insights.length === 0 && !insightLoading && (
              <p className="mt-2 text-sm text-neutral-500">Insight yo\u2018q.</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Xavf (talaba bo\u2018yicha)
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                placeholder="talaba ID"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="min-w-[200px] rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-950"
              />
              <button
                type="button"
                onClick={() => void handleRisk()}
                disabled={insightLoading}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
              >
                Xavf ma\u2018lumotini olish
              </button>
            </div>
            {riskJson && (
              <pre className="mt-4 max-h-80 overflow-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-950">
                {riskJson}
              </pre>
            )}
          </div>
        </section>
      )}

      {tab === "agent" && (
        <section>
          <AgentChatSession
            variant="teacher"
            fixedGroupId={groupId}
            fixedSubjectId={subject.id}
          />
        </section>
      )}
    </div>
  );
}

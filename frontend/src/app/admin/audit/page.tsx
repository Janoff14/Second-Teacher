"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listAuditLogs,
  getAuditExportUrl,
  unwrapAuditList,
  type AuditLogEntry,
} from "@/lib/api/audit";
import { listSubjects, listGroups } from "@/lib/api/academic";
import type { Subject, Group } from "@/lib/api/academic";
import { listTeachers, unwrapTeacherList } from "@/lib/api/users";
import type { TeacherUser } from "@/lib/api/users";

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

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [limit, setLimit] = useState(50);
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [groupId, setGroupId] = useState("");
  const [since, setSince] = useState("");

  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);

  const filters = { limit, actorId, action, groupId, since };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listAuditLogs(filters);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setLogs([]);
      return;
    }
    setLogs(unwrapAuditList(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, actorId, action, groupId, since]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadOverview = useCallback(async () => {
    const [tRes, sRes] = await Promise.all([listTeachers(), listSubjects()]);
    if (tRes.ok) setTeachers(unwrapTeacherList(tRes.data));
    if (sRes.ok) {
      const sList = Array.isArray(sRes.data) ? sRes.data : [];
      setSubjects(sList);
      const gResults: Group[] = [];
      for (const s of sList) {
        const gRes = await listGroups(s.id);
        if (gRes.ok && Array.isArray(gRes.data)) gResults.push(...gRes.data);
      }
      setAllGroups(gResults);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Audit logs
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
            GET /audit/logs
          </code>{" "}
          — filtered log stream for admin governance.
        </p>
      </div>

      {/* ── Teachers and structure ── */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Teacher list
          </h2>
          <button
            type="button"
            onClick={() => void loadOverview()}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Refresh
          </button>
        </div>

        {teachers.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No teachers yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs font-medium uppercase tracking-wider text-neutral-500 dark:border-neutral-700">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Full name</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">ID</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t, i) => (
                  <tr
                    key={t.id}
                    className="border-b border-neutral-100 dark:border-neutral-800"
                  >
                    <td className="py-2.5 pr-4 text-neutral-400">{i + 1}</td>
                    <td className="py-2.5 pr-4 font-medium text-neutral-900 dark:text-neutral-100">
                      {t.displayName ?? "\u2014"}
                    </td>
                    <td className="py-2.5 pr-4 text-neutral-600 dark:text-neutral-400">
                      {t.email}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-neutral-400">
                      {t.id.slice(0, 8)}&hellip;
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {subjects.length > 0 && (
          <div className="mt-5 border-t border-neutral-200 pt-4 dark:border-neutral-700">
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Subjects and groups
            </h3>
            <div className="mt-2 space-y-2">
              {subjects.map((s) => (
                <div key={s.id} className="text-sm">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    {s.name}
                  </span>
                  {allGroups.filter((g) => g.subjectId === s.id).length > 0 && (
                    <span className="ml-2 text-neutral-500">
                      &rarr;{" "}
                      {allGroups
                        .filter((g) => g.subjectId === s.id)
                        .map((g) => g.name)
                        .join(", ")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-neutral-400">
          Passwords are hidden for security.
        </p>
      </section>

      <ErrorBox message={error} />

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Limit
          </span>
          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 50)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Actor ID
          </span>
          <input
            type="text"
            placeholder="user id"
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-950"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Action
          </span>
          <input
            type="text"
            placeholder="e.g. create_subject"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Group ID
          </span>
          <input
            type="text"
            placeholder="group id"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-950"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Since (ISO)
          </span>
          <input
            type="text"
            placeholder="2026-01-01T00:00:00Z"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-950"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
        <a
          href={getAuditExportUrl(filters)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-900"
        >
          Export JSON ↓
        </a>
      </div>

      {loading && logs.length === 0 && !error ? (
        <p className="text-sm text-neutral-500">Loading audit logs…</p>
      ) : null}

      {!loading && !error && logs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
          No audit logs found for the given filters.
        </div>
      ) : null}

      {logs.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="whitespace-nowrap px-2 py-2 font-medium text-neutral-700 dark:text-neutral-300">
                  Timestamp
                </th>
                <th className="whitespace-nowrap px-2 py-2 font-medium text-neutral-700 dark:text-neutral-300">
                  Action
                </th>
                <th className="whitespace-nowrap px-2 py-2 font-medium text-neutral-700 dark:text-neutral-300">
                  Actor
                </th>
                <th className="whitespace-nowrap px-2 py-2 font-medium text-neutral-700 dark:text-neutral-300">
                  Group
                </th>
                <th className="whitespace-nowrap px-2 py-2 font-medium text-neutral-700 dark:text-neutral-300">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-neutral-100 dark:border-neutral-800"
                >
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-neutral-500">
                    {log.createdAt ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-neutral-800 dark:text-neutral-200">
                    {log.action ?? "—"}
                  </td>
                  <td className="max-w-[8rem] truncate px-2 py-2 font-mono text-xs text-neutral-600 dark:text-neutral-400">
                    {log.actorId ?? "—"}
                  </td>
                  <td className="max-w-[8rem] truncate px-2 py-2 font-mono text-xs text-neutral-600 dark:text-neutral-400">
                    {log.groupId ?? "—"}
                  </td>
                  <td className="max-w-[16rem] truncate px-2 py-2 text-neutral-600 dark:text-neutral-400">
                    {log.detail ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

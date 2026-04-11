"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createGroup,
  createJoinCode,
  createSubject,
  listGroups,
  listJoinCodes,
  listSubjects,
  revokeJoinCode,
} from "@/lib/api/academic";
import type { Group, JoinCodeRecord, Subject } from "@/lib/api/academic";

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

export function AcademicStructure() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [codes, setCodes] = useState<JoinCodeRecord[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [groupId, setGroupId] = useState<string>("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listSubjects();
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    const list = res.data ?? [];
    setSubjects(Array.isArray(list) ? list : []);
  }, []);

  const loadGroups = useCallback(async (sid: string) => {
    if (!sid) {
      setGroups([]);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await listGroups(sid);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    const list = res.data ?? [];
    setGroups(Array.isArray(list) ? list : []);
  }, []);

  const loadCodes = useCallback(async (gid: string) => {
    if (!gid) {
      setCodes([]);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await listJoinCodes(gid);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      setCodes([]);
      return;
    }
    const list = res.data ?? [];
    setCodes(Array.isArray(list) ? list : []);
  }, []);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  useEffect(() => {
    void loadGroups(subjectId);
    setGroupId("");
  }, [subjectId, loadGroups]);

  useEffect(() => {
    void loadCodes(groupId);
  }, [groupId, loadCodes]);

  async function handleCreateSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    setLoading(true);
    setError(null);
    const res = await createSubject({ name: newSubjectName.trim() });
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setNewSubjectName("");
    await loadSubjects();
    if (res.data?.id) setSubjectId(res.data.id);
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId || !newGroupName.trim()) return;
    setLoading(true);
    setError(null);
    const res = await createGroup({
      subjectId,
      name: newGroupName.trim(),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setNewGroupName("");
    await loadGroups(subjectId);
    if (res.data?.id) setGroupId(res.data.id);
  }

  async function handleCreateCode() {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    const res = await createJoinCode(groupId);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    await loadCodes(groupId);
  }

  async function handleRevoke(code: JoinCodeRecord) {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    const res = await revokeJoinCode(groupId, code.id);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    await loadCodes(groupId);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          Subjects &amp; groups
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Create a subject, a group, then generate join codes for students (
          <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">
            POST /groups/:groupId/join-codes
          </code>
          ).
        </p>
      </div>

      <ErrorBox message={error} />

      <section className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
          Subjects
        </h3>
        <form onSubmit={handleCreateSubject} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="New subject name"
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            className="min-w-[200px] flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Add subject
          </button>
        </form>
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
          disabled={loading}
        >
          <option value="">Select subject…</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
          Groups
        </h3>
        <form onSubmit={handleCreateGroup} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="New group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="min-w-[200px] flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
            disabled={loading || !subjectId}
          />
          <button
            type="submit"
            disabled={loading || !subjectId}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Add group
          </button>
        </form>
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
          disabled={loading || !subjectId}
        >
          <option value="">Select group…</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
          Join codes
        </h3>
        <button
          type="button"
          onClick={() => void handleCreateCode()}
          disabled={loading || !groupId}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          Generate join code
        </button>
        <ul className="space-y-2 text-sm">
          {codes.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-100 px-3 py-2 dark:border-neutral-800"
            >
              <code className="font-mono">{c.code}</code>
              {c.revokedAt && (
                <span className="text-xs text-neutral-500">Revoked</span>
              )}
              {!c.revokedAt && (
                <button
                  type="button"
                  onClick={() => void handleRevoke(c)}
                  disabled={loading}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
        {groupId && codes.length === 0 && !loading && (
          <p className="text-xs text-neutral-500">
            No codes yet — generate one, or your API may not expose{" "}
            <code>GET /groups/…/join-codes</code> (adjust{" "}
            <code>src/lib/api/academic.ts</code>).
          </p>
        )}
      </section>
    </div>
  );
}

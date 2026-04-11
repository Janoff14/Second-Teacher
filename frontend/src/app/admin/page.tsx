"use client";

import { useCallback, useEffect, useState } from "react";
import {
  assignTeacher,
  createGroup,
  createSubject,
  listGroups,
  listSubjects,
} from "@/lib/api/academic";
import type { Group, Subject } from "@/lib/api/academic";
import {
  createTeacher as apiCreateTeacher,
  listTeachers,
  unwrapTeacherList,
} from "@/lib/api/users";
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

function SuccessBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="whitespace-pre-line rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-100">
      {message}
    </div>
  );
}

export default function AdminDashboardPage() {
  // --- Teachers ---
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [tName, setTName] = useState("");
  const [tEmail, setTEmail] = useState("");
  const [tPassword, setTPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const loadTeachers = useCallback(async () => {
    const res = await listTeachers();
    if (res.ok) {
      setTeachers(unwrapTeacherList(res.data));
    }
  }, []);

  useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);

  const handleCreateTeacher = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const displayName = tName.trim();
      const email = tEmail.trim();
      const password = tPassword.trim();
      if (!displayName || !email || !password) return;
      setCreating(true);
      setCreateError(null);
      setCreateSuccess(null);
      const res = await apiCreateTeacher({ email, password, displayName });
      setCreating(false);
      if (!res.ok) {
        setCreateError(res.error.message);
        return;
      }
      setCreateSuccess(
        `O\u2018qituvchi "${displayName}" yaratildi!\n` +
        `Email: ${email}\n` +
        `Parol: ${password}\n` +
        `Shu ma\u2018lumotlarni nusxa oling \u2014 parol keyinchalik ko\u2018rsatilmaydi!`,
      );
      setTName("");
      setTEmail("");
      setTPassword("");
      await loadTeachers();
    },
    [tName, tEmail, tPassword, loadTeachers],
  );

  // --- Assign teacher to subject/group ---
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [loadingStructure, setLoadingStructure] = useState(false);

  const loadSubjects = useCallback(async () => {
    setLoadingStructure(true);
    const res = await listSubjects();
    setLoadingStructure(false);
    if (res.ok) {
      const list = res.data ?? [];
      setSubjects(Array.isArray(list) ? list : []);
    }
  }, []);

  const loadGroups = useCallback(async (sid: string) => {
    if (!sid) {
      setGroups([]);
      return;
    }
    setLoadingStructure(true);
    const res = await listGroups(sid);
    setLoadingStructure(false);
    if (res.ok) {
      const list = res.data ?? [];
      setGroups(Array.isArray(list) ? list : []);
    }
  }, []);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);


  useEffect(() => {
    setSelectedGroupId("");
    setGroups([]);
    if (selectedSubjectId) void loadGroups(selectedSubjectId);
  }, [selectedSubjectId, loadGroups]);

  const handleCreateSubject = useCallback(async () => {
    const name = newSubjectName.trim();
    if (!name) return;
    setLoadingStructure(true);
    setAssignError(null);
    const res = await createSubject({ name });
    setLoadingStructure(false);
    if (!res.ok) {
      setAssignError(res.error.message);
      return;
    }
    setNewSubjectName("");
    await loadSubjects();
    if (res.data?.id) setSelectedSubjectId(res.data.id);
  }, [newSubjectName, loadSubjects]);

  const handleCreateGroup = useCallback(async () => {
    const name = newGroupName.trim();
    if (!name || !selectedSubjectId) return;
    setLoadingStructure(true);
    setAssignError(null);
    const res = await createGroup({ subjectId: selectedSubjectId, name });
    setLoadingStructure(false);
    if (!res.ok) {
      setAssignError(res.error.message);
      return;
    }
    setNewGroupName("");
    await loadGroups(selectedSubjectId);
    if (res.data?.id) setSelectedGroupId(res.data.id);
  }, [newGroupName, selectedSubjectId, loadGroups]);

  const handleAssign = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const gid = selectedGroupId.trim();
      const tid = assignTeacherId.trim();
      if (!gid || !tid) return;
      setAssigning(true);
      setAssignError(null);
      setAssignSuccess(null);
      const res = await assignTeacher(gid, tid);
      setAssigning(false);
      if (!res.ok) {
        setAssignError(res.error.message);
        return;
      }
      const subName =
        subjects.find((s) => s.id === selectedSubjectId)?.name ?? selectedSubjectId;
      const grpName =
        groups.find((g) => g.id === gid)?.name ?? gid;
      setAssignSuccess(
        `Teacher ${tid.slice(0, 8)}\u2026 assigned to "${grpName}" (${subName})`,
      );
    },
    [selectedGroupId, assignTeacherId, subjects, selectedSubjectId, groups],
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
        Admin dashboard
      </h1>

      {/* ── 1. Create teacher ── */}
      <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-5 dark:border-violet-900/60 dark:bg-violet-950/20">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          1. O{"'"}qituvchi qo{"'"}shish
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Ism, email va parol kiriting.
        </p>

        <ErrorBox message={createError} />
        <SuccessBox message={createSuccess} />

        <form
          onSubmit={(e) => void handleCreateTeacher(e)}
          className="mt-4 grid gap-3 sm:grid-cols-3"
        >
          <label className="space-y-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Ism Familya
            </span>
            <input
              type="text"
              placeholder="Ali Valiyev"
              value={tName}
              onChange={(e) => setTName(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Email
            </span>
            <input
              type="email"
              placeholder="teacher@example.com"
              value={tEmail}
              onChange={(e) => setTEmail(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              required
            />
          </label>
          <div className="space-y-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Parol
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="********"
                value={tPassword}
                onChange={(e) => setTPassword(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 pr-16 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                {showPassword ? "Yashirish" : "Ko\u2018rsatish"}
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating || !tName.trim() || !tEmail.trim() || !tPassword.trim()}
              className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-violet-600"
            >
              {creating ? "Yaratilmoqda\u2026" : "O\u2018qituvchi yaratish"}
            </button>
          </div>
        </form>
      </section>

      {/* ── 2. Fan yaratish ── */}
      <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          2. Fan yaratish
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Yangi fan nomini kiriting va yarating.
        </p>

        <ErrorBox message={!selectedSubjectId ? assignError : null} />
        {selectedSubjectId && (
          <SuccessBox
            message={`Fan tanlandi: ${subjects.find((s) => s.id === selectedSubjectId)?.name ?? selectedSubjectId}`}
          />
        )}

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex-1 space-y-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Fan nomi
            </span>
            <input
              type="text"
              placeholder="masalan: Matematika"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleCreateSubject()}
            disabled={loadingStructure || !newSubjectName.trim()}
            className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-emerald-600"
          >
            + Fan yaratish
          </button>
        </div>
      </section>

      {/* ── 3. Guruh yaratish ── */}
      <section className={`rounded-xl border p-5 transition ${selectedSubjectId ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20" : "border-neutral-200 bg-neutral-50/30 opacity-60 dark:border-neutral-800 dark:bg-neutral-900/30"}`}>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          3. Guruh yaratish
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {selectedSubjectId
            ? `Tanlangan fan: ${subjects.find((s) => s.id === selectedSubjectId)?.name ?? selectedSubjectId}`
            : "Avval fan yarating (2-qadam)."}
        </p>

        {selectedSubjectId && (
          <>
            {selectedGroupId && (
              <SuccessBox
                message={`Guruh tanlandi: ${groups.find((g) => g.id === selectedGroupId)?.name ?? selectedGroupId}`}
              />
            )}
            <div className="mt-4 flex flex-wrap items-end gap-2">
              <label className="flex-1 space-y-1 text-sm">
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  Guruh nomi
                </span>
                <input
                  type="text"
                  placeholder="masalan: 101-guruh"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleCreateGroup()}
                disabled={loadingStructure || !newGroupName.trim()}
                className="rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-amber-600"
              >
                + Guruh yaratish
              </button>
            </div>
          </>
        )}
      </section>

      {/* ── 4. O'qituvchiga biriktirish ── */}
      <section className={`rounded-xl border p-5 transition ${selectedGroupId && assignTeacherId ? "border-blue-200 bg-blue-50/40 dark:border-blue-900/60 dark:bg-blue-950/20" : "border-neutral-200 bg-neutral-50/30 dark:border-neutral-800 dark:bg-neutral-900/30"}`}>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          4. O{"'"}qituvchiga biriktirish
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Fan, guruh va teacher ID ni tekshirib, Assign bosing.
        </p>

        <ErrorBox message={assignError} />
        <SuccessBox message={assignSuccess} />

        <form
          onSubmit={(e) => void handleAssign(e)}
          className="mt-4 space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                O{"'"}qituvchi
              </span>
              <select
                value={assignTeacherId}
                onChange={(e) => setAssignTeacherId(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              >
                <option value="">O{"'"}qituvchi tanlang&hellip;</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName ?? t.email}
                  </option>
                ))}
              </select>
              {teachers.length === 0 && (
                <p className="text-xs text-neutral-500">
                  Avval 1-qadamda o{"'"}qituvchi yarating.
                </p>
              )}
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                Fan
              </span>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                disabled={loadingStructure}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              >
                <option value="">Fan tanlang&hellip;</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                Guruh
              </span>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                disabled={loadingStructure || !selectedSubjectId}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              >
                <option value="">Guruh tanlang&hellip;</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={
              assigning ||
              !assignTeacherId.trim() ||
              !selectedGroupId.trim()
            }
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-blue-600"
          >
            {assigning ? "Biriktirilmoqda\u2026" : "O\u2018qituvchini guruhga biriktirish"}
          </button>
        </form>
      </section>
    </div>
  );
}

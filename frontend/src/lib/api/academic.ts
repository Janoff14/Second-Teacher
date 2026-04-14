import { apiRequest } from "./client";

export type Subject = {
  id: string;
  name: string;
  code?: string | null;
};

export type Group = {
  id: string;
  subjectId: string;
  name: string;
  /** If provided by API, only these teacher IDs can access the group. */
  assignedTeacherIds?: string[];
};

/** GET /teacher/academic-scope — assigned subjects and groups in one call. */
export type TeacherSubjectBlock = {
  subject: Subject;
  groups: Group[];
};

export async function listTeacherAcademicScope() {
  return apiRequest<unknown>("/teacher/academic-scope", { method: "GET" });
}

export function unwrapTeacherAcademicScope(raw: unknown): TeacherSubjectBlock[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw as TeacherSubjectBlock[];
  }
  if (typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.subjects)) return o.subjects as TeacherSubjectBlock[];
  if (Array.isArray(o.blocks)) return o.blocks as TeacherSubjectBlock[];
  if (Array.isArray(o.data)) return o.data as TeacherSubjectBlock[];
  if (o.data && typeof o.data === "object") {
    return unwrapTeacherAcademicScope(o.data);
  }
  return [];
}

/** Do not fallback when backend returns an explicit empty list. */
export function isExplicitEmptyTeacherScope(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.subjects) && o.subjects.length === 0) return true;
  if (Array.isArray(o.blocks) && o.blocks.length === 0) return true;
  if (Array.isArray(o.data) && o.data.length === 0) return true;
  if (o.data && typeof o.data === "object") {
    const inner = o.data as Record<string, unknown>;
    if (Array.isArray(inner.subjects) && inner.subjects.length === 0)
      return true;
    if (Array.isArray(inner.blocks) && inner.blocks.length === 0) return true;
  }
  return false;
}

/**
 * Keeps groups under the right subject; if `assignedTeacherIds` is present,
 * narrows visibility to the current teacher.
 * If the field is missing, backend is assumed to have already filtered.
 */
export function filterGroupsForTeacher(
  groups: Group[],
  subjectId: string,
  teacherUserId: string | null,
): Group[] {
  const scoped = groups.filter((g) => g.subjectId === subjectId);
  const anyHasAssignments = scoped.some(
    (g) =>
      Array.isArray(g.assignedTeacherIds) && g.assignedTeacherIds.length > 0,
  );
  if (!anyHasAssignments) {
    return scoped;
  }
  if (!teacherUserId) {
    return [];
  }
  return scoped.filter((g) => {
    const ids = g.assignedTeacherIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      return true;
    }
    return ids.includes(teacherUserId);
  });
}

export type JoinCodeRecord = {
  id: string;
  code: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
};

export type GroupStudent = {
  studentId: string;
  displayName?: string | null;
  email?: string | null;
  enrolledAt: string;
  attemptCount?: number;
  lastAttemptAt?: string | null;
  latestScorePct?: number | null;
  riskLevel?: "stable" | "watchlist" | "at_risk" | "low_load" | null;
  riskReason?: string | null;
};

export async function listSubjects() {
  return apiRequest<Subject[]>("/subjects", { method: "GET" });
}

export async function createSubject(input: { name: string; code?: string }) {
  return apiRequest<Subject>("/subjects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listGroups(subjectId: string) {
  const q = new URLSearchParams({ subjectId });
  return apiRequest<Group[]>(`/groups?${q.toString()}`, { method: "GET" });
}

export async function listGroupStudents(groupId: string) {
  return apiRequest<GroupStudent[]>(`/groups/${groupId}/students`, { method: "GET" });
}

export async function createGroup(input: { subjectId: string; name: string }) {
  return apiRequest<Group>("/groups", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listJoinCodes(groupId: string) {
  return apiRequest<JoinCodeRecord[]>(`/groups/${groupId}/join-codes`, {
    method: "GET",
  });
}

export async function createJoinCode(groupId: string, body?: { label?: string }) {
  return apiRequest<JoinCodeRecord>(`/groups/${groupId}/join-codes`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export async function revokeJoinCode(groupId: string, joinCodeId: string) {
  return apiRequest<unknown>(`/groups/${groupId}/join-codes/${joinCodeId}`, {
    method: "DELETE",
  });
}

/** WF-ACADEMIC — Admin assigns a teacher to a group. */
export async function assignTeacher(groupId: string, teacherId: string) {
  return apiRequest<unknown>(`/groups/${groupId}/assign-teacher`, {
    method: "POST",
    body: JSON.stringify({ teacherId }),
  });
}

import crypto from "node:crypto";

export interface SubjectRecord {
  id: string;
  name: string;
  createdBy: string;
}

export interface GroupRecord {
  id: string;
  subjectId: string;
  name: string;
  createdBy: string;
}

export interface TeacherAssignmentRecord {
  groupId: string;
  teacherId: string;
  assignedBy: string;
}

export interface JoinCodeRecord {
  id: string;
  groupId: string;
  code: string;
  createdBy: string;
  expiresAt?: string;
  revokedAt?: string;
}

export interface EnrollmentRecord {
  groupId: string;
  studentId: string;
  enrolledAt: string;
}

const subjects = new Map<string, SubjectRecord>();
const groups = new Map<string, GroupRecord>();
const teacherAssignments = new Map<string, TeacherAssignmentRecord[]>();
const joinCodes = new Map<string, JoinCodeRecord[]>();
const enrollments = new Map<string, EnrollmentRecord[]>();

let subjectCounter = 1;
let groupCounter = 1;
let joinCodeCounter = 1;

export function createSubject(name: string, createdBy: string): SubjectRecord {
  const record: SubjectRecord = {
    id: `sub_${subjectCounter++}`,
    name,
    createdBy,
  };
  subjects.set(record.id, record);
  return record;
}

export function listSubjects(): SubjectRecord[] {
  return [...subjects.values()];
}

export function getSubject(subjectId: string): SubjectRecord | undefined {
  return subjects.get(subjectId);
}

export function createGroup(subjectId: string, name: string, createdBy: string): GroupRecord {
  if (!subjects.has(subjectId)) {
    const err = new Error("Subject not found") as Error & { statusCode?: number; code?: string };
    err.statusCode = 404;
    err.code = "SUBJECT_NOT_FOUND";
    throw err;
  }

  const record: GroupRecord = {
    id: `grp_${groupCounter++}`,
    subjectId,
    name,
    createdBy,
  };
  groups.set(record.id, record);
  return record;
}

export function listGroups(): GroupRecord[] {
  return [...groups.values()];
}

export function assignTeacher(groupId: string, teacherId: string, assignedBy: string): TeacherAssignmentRecord {
  if (!groups.has(groupId)) {
    const err = new Error("Group not found") as Error & { statusCode?: number; code?: string };
    err.statusCode = 404;
    err.code = "GROUP_NOT_FOUND";
    throw err;
  }

  const existing = teacherAssignments.get(groupId) ?? [];
  const already = existing.find((item) => item.teacherId === teacherId);
  if (already) {
    return already;
  }

  const record: TeacherAssignmentRecord = { groupId, teacherId, assignedBy };
  existing.push(record);
  teacherAssignments.set(groupId, existing);
  return record;
}

function generateJoinCode(): string {
  return crypto.randomBytes(6).toString("base64url").toUpperCase();
}

export function createJoinCode(groupId: string, createdBy: string, ttlHours?: number): JoinCodeRecord {
  if (!groups.has(groupId)) {
    const err = new Error("Group not found") as Error & { statusCode?: number; code?: string };
    err.statusCode = 404;
    err.code = "GROUP_NOT_FOUND";
    throw err;
  }

  const record: JoinCodeRecord = {
    id: `jcd_${joinCodeCounter++}`,
    groupId,
    code: generateJoinCode(),
    createdBy,
  };
  if (ttlHours) {
    record.expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  }

  const existing = joinCodes.get(groupId) ?? [];
  existing.push(record);
  joinCodes.set(groupId, existing);
  return record;
}

export function revokeJoinCode(groupId: string, code: string): JoinCodeRecord {
  const existing = joinCodes.get(groupId) ?? [];
  const found = existing.find((item) => item.code === code);
  if (!found) {
    const err = new Error("Join code not found") as Error & { statusCode?: number; code?: string };
    err.statusCode = 404;
    err.code = "JOIN_CODE_NOT_FOUND";
    throw err;
  }
  found.revokedAt = new Date().toISOString();
  return found;
}

export function listJoinCodesForGroup(groupId: string): JoinCodeRecord[] {
  return [...(joinCodes.get(groupId) ?? [])];
}

export function revokeJoinCodeById(groupId: string, joinCodeId: string): JoinCodeRecord {
  const existing = joinCodes.get(groupId) ?? [];
  const found = existing.find((item) => item.id === joinCodeId);
  if (!found) {
    const err = new Error("Join code not found") as Error & { statusCode?: number; code?: string };
    err.statusCode = 404;
    err.code = "JOIN_CODE_NOT_FOUND";
    throw err;
  }
  found.revokedAt = new Date().toISOString();
  return found;
}

export function resolveJoinCode(
  code: string,
): { group: GroupRecord; subject: SubjectRecord; joinCode: JoinCodeRecord } | undefined {
  for (const [groupId, records] of joinCodes.entries()) {
    const active = records.find((item) => {
      if (item.code !== code) {
        return false;
      }
      if (item.revokedAt) {
        return false;
      }
      if (item.expiresAt && new Date(item.expiresAt).getTime() < Date.now()) {
        return false;
      }
      return true;
    });
    if (active) {
      const group = groups.get(groupId);
      if (!group) {
        return undefined;
      }
      const subject = subjects.get(group.subjectId);
      if (!subject) {
        return undefined;
      }
      return { group, subject, joinCode: active };
    }
  }
  return undefined;
}

export function createEnrollment(groupId: string, studentId: string): EnrollmentRecord {
  if (!groups.has(groupId)) {
    const err = new Error("Group not found") as Error & { statusCode?: number; code?: string };
    err.statusCode = 404;
    err.code = "GROUP_NOT_FOUND";
    throw err;
  }

  const existing = enrollments.get(groupId) ?? [];
  const already = existing.find((item) => item.studentId === studentId);
  if (already) {
    return already;
  }

  const record: EnrollmentRecord = {
    groupId,
    studentId,
    enrolledAt: new Date().toISOString(),
  };
  existing.push(record);
  enrollments.set(groupId, existing);
  return record;
}

export function getGroup(groupId: string): GroupRecord | undefined {
  return groups.get(groupId);
}

export function canTeacherManageGroup(userId: string, role: string, groupId: string): boolean {
  if (role === "admin") {
    return groups.has(groupId);
  }
  const g = groups.get(groupId);
  if (!g) {
    return false;
  }
  if (g.createdBy === userId) {
    return true;
  }
  const assigns = teacherAssignments.get(groupId) ?? [];
  return assigns.some((a) => a.teacherId === userId);
}

export function isStudentInGroup(studentId: string, groupId: string): boolean {
  const list = enrollments.get(groupId) ?? [];
  return list.some((e) => e.studentId === studentId);
}

export function listEnrollmentsForGroup(groupId: string): EnrollmentRecord[] {
  return [...(enrollments.get(groupId) ?? [])];
}

export function listTeacherUserIdsForGroup(groupId: string): string[] {
  const g = groups.get(groupId);
  const ids = new Set<string>();
  if (g?.createdBy) {
    ids.add(g.createdBy);
  }
  for (const a of teacherAssignments.get(groupId) ?? []) {
    ids.add(a.teacherId);
  }
  return [...ids];
}

export function listGroupIdsForStudent(studentId: string): string[] {
  const result: string[] = [];
  for (const [groupId, list] of enrollments.entries()) {
    if (list.some((e) => e.studentId === studentId)) {
      result.push(groupId);
    }
  }
  return result;
}

export function canTeacherAccessSubject(userId: string, role: string, subjectId: string): boolean {
  if (!subjects.has(subjectId)) {
    return false;
  }
  if (role === "admin") {
    return true;
  }
  if (role !== "teacher") {
    return false;
  }
  const subj = subjects.get(subjectId);
  if (subj?.createdBy === userId) {
    return true;
  }
  for (const g of groups.values()) {
    if (g.subjectId !== subjectId) {
      continue;
    }
    if (canTeacherManageGroup(userId, role, g.id)) {
      return true;
    }
  }
  return false;
}

export function resetAcademicStoreForTest(): void {
  subjects.clear();
  groups.clear();
  teacherAssignments.clear();
  joinCodes.clear();
  enrollments.clear();
  subjectCounter = 1;
  groupCounter = 1;
  joinCodeCounter = 1;
}

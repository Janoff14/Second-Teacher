import { apiRequest } from "./client";

export type TeacherUser = {
  id: string;
  email: string;
  displayName: string | null;
};

export type CreateTeacherBody = {
  email: string;
  password: string;
  displayName: string;
};

export async function createTeacher(body: CreateTeacherBody) {
  return apiRequest<{ user: TeacherUser }>("/users/teachers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listTeachers() {
  return apiRequest<TeacherUser[]>("/users/teachers", { method: "GET" });
}

export function unwrapTeacherList(data: unknown): TeacherUser[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as TeacherUser[];
  if (typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.data)) return d.data as TeacherUser[];
    if (Array.isArray(d.teachers)) return d.teachers as TeacherUser[];
  }
  return [];
}

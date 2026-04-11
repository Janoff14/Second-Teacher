import { apiRequest } from "./client";

export type TeacherAgentBody = {
  message: string;
  groupId: string;
};

/** Student chat — same shape as §5.7; backend may ignore `groupId` if enrollment is implicit. */
export type StudentAgentBody = {
  message: string;
  groupId: string;
};

export async function teacherAgentChat(body: TeacherAgentBody) {
  return apiRequest<unknown>("/agent/teacher/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function studentAgentChat(body: StudentAgentBody) {
  return apiRequest<unknown>("/agent/student/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Normalize assistant text from various `data` shapes. */
export function parseAgentReply(data: unknown): string {
  if (data == null) return "";
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    const d = data as Record<string, unknown>;
    const keys = [
      "reply",
      "message",
      "answer",
      "text",
      "content",
      "assistantMessage",
      "output",
    ] as const;
    for (const k of keys) {
      const v = d[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    if (d.data !== undefined) {
      return parseAgentReply(d.data);
    }
  }
  return "";
}

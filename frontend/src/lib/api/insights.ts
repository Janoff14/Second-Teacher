import { apiRequest } from "./client";

export type Insight = {
  id: string;
  title?: string | null;
  message?: string | null;
  body?: string | null;
  summary?: string | null;
  severity?: string | null;
  studentId?: string | null;
  groupId?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

export function unwrapInsightList(data: unknown): Insight[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as Insight[];
  if (typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.insights)) return d.insights as Insight[];
    if (Array.isArray(d.items)) return d.items as Insight[];
  }
  return [];
}

/** J3.1 — Teacher feed */
export async function listTeacherInsights(groupId: string) {
  const q = new URLSearchParams({ groupId });
  return apiRequest<unknown>(`/insights?${q.toString()}`, { method: "GET" });
}

/** J3.1 — Ack / dismiss (body shape may vary by backend). */
export async function setInsightStatus(
  insightId: string,
  body: { status: string } | Record<string, unknown>,
) {
  return apiRequest<unknown>(`/insights/${insightId}/status`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** J3.2 — Risk drill-down */
export async function getRiskAnalytics(params: {
  studentId: string;
  groupId: string;
}) {
  const q = new URLSearchParams({
    studentId: params.studentId,
    groupId: params.groupId,
  });
  return apiRequest<unknown>(`/analytics/risk?${q.toString()}`, {
    method: "GET",
  });
}

/** J3.2 — Demo trigger */
export async function recomputeGroupAnalytics(groupId: string) {
  return apiRequest<unknown>(`/groups/${groupId}/analytics/recompute`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/** J3.3 — Student feed */
export async function listStudentInsightsMe(groupId: string) {
  const q = new URLSearchParams({ groupId });
  return apiRequest<unknown>(`/insights/me?${q.toString()}`, {
    method: "GET",
  });
}

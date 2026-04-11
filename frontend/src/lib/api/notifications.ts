import { apiRequest } from "./client";

/** In-app notification (shape may vary by backend). */
export type AppNotification = {
  id: string;
  title?: string | null;
  message?: string | null;
  body?: string | null;
  summary?: string | null;
  read?: boolean | null;
  createdAt?: string | null;
  type?: string | null;
  riskLevel?: string | null;
  groupId?: string | null;
  subjectName?: string | null;
};

export function unwrapNotificationList(data: unknown): AppNotification[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as AppNotification[];
  if (typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.notifications)) {
      return d.notifications as AppNotification[];
    }
    if (Array.isArray(d.items)) return d.items as AppNotification[];
  }
  return [];
}

/**
 * WF-NOTIFY — `GET /notifications/me`
 * @param limit Optional 1–100 (server default often 50).
 */
export async function listMyNotifications(limit?: number) {
  const q = new URLSearchParams();
  if (limit !== undefined) {
    const n = Math.min(100, Math.max(1, Math.floor(limit)));
    q.set("limit", String(n));
  }
  const qs = q.toString();
  return apiRequest<unknown>(
    `/notifications/me${qs ? `?${qs}` : ""}`,
    { method: "GET" },
  );
}

import { apiRequest } from "./client";

export type AuditLogEntry = {
  id: string;
  actorId?: string | null;
  action?: string | null;
  groupId?: string | null;
  targetId?: string | null;
  detail?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt?: string | null;
};

export type AuditFilters = {
  limit?: number;
  actorId?: string;
  action?: string;
  groupId?: string;
  since?: string;
};

export function unwrapAuditList(data: unknown): AuditLogEntry[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as AuditLogEntry[];
  if (typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.logs)) return d.logs as AuditLogEntry[];
    if (Array.isArray(d.items)) return d.items as AuditLogEntry[];
    if (Array.isArray(d.entries)) return d.entries as AuditLogEntry[];
  }
  return [];
}

function buildAuditQuery(filters: AuditFilters): string {
  const q = new URLSearchParams();
  if (filters.limit !== undefined) {
    q.set("limit", String(Math.min(200, Math.max(1, Math.floor(filters.limit)))));
  }
  if (filters.actorId?.trim()) q.set("actorId", filters.actorId.trim());
  if (filters.action?.trim()) q.set("action", filters.action.trim());
  if (filters.groupId?.trim()) q.set("groupId", filters.groupId.trim());
  if (filters.since?.trim()) q.set("since", filters.since.trim());
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

/** WF-AUDIT — `GET /audit/logs` with optional filters. */
export async function listAuditLogs(filters: AuditFilters = {}) {
  return apiRequest<unknown>(`/audit/logs${buildAuditQuery(filters)}`, {
    method: "GET",
  });
}

/** WF-AUDIT — `GET /audit/logs/export` (JSON attachment). */
export function getAuditExportUrl(filters: AuditFilters = {}): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/audit/logs/export${buildAuditQuery(filters)}`;
}

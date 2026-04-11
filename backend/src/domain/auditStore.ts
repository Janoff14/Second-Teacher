import { randomUUID } from "node:crypto";

export interface AuditLogRecord {
  id: string;
  createdAt: string;
  actorId: string;
  action: string;
  groupId?: string;
  targetId?: string;
  detail: string;
  meta: Record<string, unknown>;
  requestId?: string;
  actorRole?: string;
}

const records: AuditLogRecord[] = [];
export function appendAuditLog(entry: {
  requestId?: string;
  actorId: string;
  actorRole?: string;
  action: string;
  scope?: {
    groupId?: string;
    subjectId?: string;
    studentId?: string;
  };
  groupId?: string;
  targetId?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}): AuditLogRecord {
  const row: AuditLogRecord = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    actorId: entry.actorId,
    action: entry.action,
    groupId: entry.groupId ?? entry.scope?.groupId,
    targetId: entry.targetId,
    detail: entry.detail ?? entry.action,
    meta: entry.meta ?? entry.metadata ?? {},
  };
  if (entry.actorRole !== undefined) {
    row.actorRole = entry.actorRole;
  }
  if (entry.requestId !== undefined) {
    row.requestId = entry.requestId;
  }
  records.push(row);
  return row;
}

export function listAuditLogs(filters: {
  actorId?: string;
  action?: string;
  groupId?: string;
  since?: string;
  limit?: number;
}): AuditLogRecord[] {
  let rows = [...records];
  if (filters.actorId) {
    rows = rows.filter((r) => r.actorId === filters.actorId);
  }
  if (filters.action) {
    rows = rows.filter((r) => r.action === filters.action);
  }
  if (filters.groupId) {
    rows = rows.filter((r) => r.groupId === filters.groupId);
  }
  if (filters.since) {
    const t = Date.parse(filters.since);
    if (!Number.isNaN(t)) {
      rows = rows.filter((r) => Date.parse(r.createdAt) >= t);
    }
  }
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const limit = filters.limit ?? 200;
  return rows.slice(0, Math.min(limit, 2000));
}

export function exportAuditLogsJson(filters: Parameters<typeof listAuditLogs>[0]): string {
  return JSON.stringify(listAuditLogs({ ...filters, limit: 2000 }), null, 2);
}

export function resetAuditStoreForTest(): void {
  records.length = 0;
}

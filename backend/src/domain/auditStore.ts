export interface AuditLogRecord {
  id: string;
  createdAt: string;
  requestId?: string;
  actorId: string;
  actorRole: string;
  action: string;
  scope: {
    groupId?: string;
    subjectId?: string;
    studentId?: string;
  };
  metadata: Record<string, unknown>;
}

const records: AuditLogRecord[] = [];
let counter = 1;

export function appendAuditLog(entry: {
  requestId?: string;
  actorId: string;
  actorRole: string;
  action: string;
  scope?: AuditLogRecord["scope"];
  metadata?: Record<string, unknown>;
}): AuditLogRecord {
  const row: AuditLogRecord = {
    id: `aud_${counter++}`,
    createdAt: new Date().toISOString(),
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    action: entry.action,
    scope: entry.scope ?? {},
    metadata: entry.metadata ?? {},
  };
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
    rows = rows.filter((r) => r.scope.groupId === filters.groupId);
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
  counter = 1;
}

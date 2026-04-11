import { Router } from "express";
import { exportAuditLogsJson, listAuditLogs } from "../domain/auditStore";
import { requireAuth, requireRole } from "../middleware/auth";

export const auditRouter = Router();

auditRouter.get("/audit/logs", requireAuth, requireRole(["admin"]), (req, res) => {
  const limitRaw = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 100;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;

  const filters: Parameters<typeof listAuditLogs>[0] = { limit };
  if (typeof req.query.actorId === "string") {
    filters.actorId = req.query.actorId;
  }
  if (typeof req.query.action === "string") {
    filters.action = req.query.action;
  }
  if (typeof req.query.groupId === "string") {
    filters.groupId = req.query.groupId;
  }
  if (typeof req.query.since === "string") {
    filters.since = req.query.since;
  }

  const rows = listAuditLogs(filters).map((row) => ({
    id: row.id,
    actorId: row.actorId,
    action: row.action,
    groupId: row.groupId,
    targetId: row.targetId,
    detail: row.detail,
    meta: row.meta,
    createdAt: row.createdAt,
  }));

  res.status(200).json({ data: rows });
});

auditRouter.get("/audit/logs/export", requireAuth, requireRole(["admin"]), (req, res) => {
  const limitRaw = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw!, 1), 2000) : undefined;

  const filters: Parameters<typeof exportAuditLogsJson>[0] = {};
  if (limit !== undefined) {
    filters.limit = limit;
  }
  if (typeof req.query.actorId === "string") {
    filters.actorId = req.query.actorId;
  }
  if (typeof req.query.action === "string") {
    filters.action = req.query.action;
  }
  if (typeof req.query.groupId === "string") {
    filters.groupId = req.query.groupId;
  }
  if (typeof req.query.since === "string") {
    filters.since = req.query.since;
  }

  const body = exportAuditLogsJson(filters);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="audit-logs.json"');
  res.status(200).send(body);
});

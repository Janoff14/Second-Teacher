import { Router } from "express";
import { z } from "zod";
import { canTeacherManageGroup, isStudentInGroup } from "../domain/academicStore";
import {
  listInsightsForStudent,
  listInsightsForTeacher,
  listNotificationsForUser,
  setInsightStatus,
  type InsightStatus,
  type RiskLevel,
} from "../domain/insightsStore";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const insightsRouter = Router();

insightsRouter.get("/insights", requireAuth, requireRole(["admin", "teacher"]), (req, res, next) => {
  try {
    const user = req.user!;
    const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
    if (!groupId) {
      const err = new Error("groupId is required") as Error & { statusCode?: number; code?: string };
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    if (!canTeacherManageGroup(user.userId, user.role, groupId)) {
      const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
    const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
    let status: InsightStatus | "all" | undefined;
    if (statusRaw === "all") {
      status = "all";
    } else if (statusRaw === "open" || statusRaw === "acknowledged" || statusRaw === "dismissed") {
      status = statusRaw;
    } else {
      status = undefined;
    }
    const minRiskRaw =
      typeof req.query.minRisk === "string" && (req.query.minRisk === "watchlist" || req.query.minRisk === "at_risk")
        ? req.query.minRisk
        : undefined;
    const minRisk: RiskLevel | undefined = minRiskRaw;

    const filters: { status?: InsightStatus | "all"; minRisk?: RiskLevel } = {};
    if (status !== undefined) {
      filters.status = status;
    }
    if (minRisk !== undefined) {
      filters.minRisk = minRisk;
    }
    const data = listInsightsForTeacher(groupId, filters);
    res.status(200).json({ data });
  } catch (e) {
    next(e);
  }
});

insightsRouter.get("/insights/me", requireAuth, requireRole(["student"]), (req, res, next) => {
  try {
    const user = req.user!;
    const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
    if (!groupId) {
      const err = new Error("groupId is required") as Error & { statusCode?: number; code?: string };
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    if (!isStudentInGroup(user.userId, groupId)) {
      const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
    const data = listInsightsForStudent(user.userId, groupId);
    res.status(200).json({ data });
  } catch (e) {
    next(e);
  }
});

const insightStatusSchema = z.object({
  status: z.enum(["acknowledged", "dismissed"]),
});

insightsRouter.post("/insights/:insightId/status", requireAuth, validateBody(insightStatusSchema), (req, res, next) => {
  try {
    const insightId = req.params.insightId;
    if (!insightId || Array.isArray(insightId)) {
      const err = new Error("Insight id required") as Error & { statusCode?: number; code?: string };
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const user = req.user!;
    const body = req.body as { status: InsightStatus };
    const updated = setInsightStatus(insightId, body.status, user.userId, user.role);
    res.status(200).json({ data: updated });
  } catch (e) {
    next(e);
  }
});

insightsRouter.get("/notifications/me", requireAuth, (req, res) => {
  const user = req.user!;
  const limitRaw = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 50;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
  const data = listNotificationsForUser(user.userId, limit);
  res.status(200).json({ data });
});

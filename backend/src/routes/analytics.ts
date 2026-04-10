import { Router } from "express";
import { canTeacherManageGroup, isStudentInGroup } from "../domain/academicStore";
import { appendAuditLog } from "../domain/auditStore";
import {
  classifyRiskFromSnapshot,
  computeRiskFeatureSnapshot,
  recomputeGroupInsightsForAllStudents,
} from "../domain/insightsStore";
import { requireAuth, requireRole } from "../middleware/auth";

export const analyticsRouter = Router();

analyticsRouter.get("/analytics/risk", requireAuth, requireRole(["admin", "teacher"]), (req, res, next) => {
  try {
    const user = req.user!;
    const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
    const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
    if (!studentId || !groupId) {
      const err = new Error("studentId and groupId are required") as Error & {
        statusCode?: number;
        code?: string;
      };
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
    if (!isStudentInGroup(studentId, groupId)) {
      const err = new Error("Student is not enrolled in this group") as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 404;
      err.code = "ENROLLMENT_NOT_FOUND";
      throw err;
    }
    const snapshot = computeRiskFeatureSnapshot(studentId, groupId);
    const classification = classifyRiskFromSnapshot(snapshot);
    appendAuditLog({
      ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
      actorId: user.userId,
      actorRole: user.role,
      action: "ANALYTICS_RISK_VIEW",
      scope: { groupId, studentId },
      metadata: { riskLevel: classification.level, confidence: classification.confidence },
    });
    res.status(200).json({ data: { snapshot, classification } });
  } catch (e) {
    next(e);
  }
});

analyticsRouter.post(
  "/groups/:groupId/analytics/recompute",
  requireAuth,
  requireRole(["admin", "teacher"]),
  (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      if (!groupId || Array.isArray(groupId)) {
        const err = new Error("Group id required") as Error & { statusCode?: number; code?: string };
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }
      const user = req.user!;
      if (!canTeacherManageGroup(user.userId, user.role, groupId)) {
        const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      recomputeGroupInsightsForAllStudents(groupId);
      res.status(202).json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  },
);

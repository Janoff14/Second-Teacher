import { Router } from "express";
import { isStudentInGroup } from "../domain/academicStore";
import { buildStudentAiReport, buildStudentWorkspace } from "../domain/studentExperience";
import { requireAuth, requireRole } from "../middleware/auth";

export const studentRouter = Router();

studentRouter.get(
  "/student/groups/:groupId/workspace",
  requireAuth,
  requireRole(["student"]),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const groupId = req.params.groupId;
      if (!groupId || Array.isArray(groupId)) {
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
      const data = await buildStudentWorkspace(user.userId, groupId);
      res.status(200).json({ data });
    } catch (e) {
      next(e);
    }
  },
);

studentRouter.get(
  "/student/groups/:groupId/ai-report",
  requireAuth,
  requireRole(["student"]),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const groupId = req.params.groupId;
      if (!groupId || Array.isArray(groupId)) {
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
      const data = await buildStudentAiReport(user.userId, groupId);
      res.status(200).json({ data });
    } catch (e) {
      next(e);
    }
  },
);

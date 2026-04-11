import { Router } from "express";
import { z } from "zod";
import {
  assignTeacher,
  canTeacherAccessSubject,
  canTeacherManageGroup,
  createGroup,
  createJoinCode,
  createSubject,
  listEnrollmentsForGroup,
  listJoinCodesForGroup,
  listGroups,
  listSubjects,
  revokeJoinCode,
  revokeJoinCodeById,
} from "../domain/academicStore";
import { appendAuditLog } from "../domain/auditStore";
import { listStudentAttemptsInGroup } from "../domain/assessmentStore";
import { classifyRiskFromSnapshot, computeRiskFeatureSnapshot } from "../domain/insightsStore";
import { buildStudentAcademicScope } from "../domain/studentExperience";
import { getUserById } from "../domain/userStore";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const academicRouter = Router();

const createSubjectSchema = z.object({
  name: z.string().min(2),
});

academicRouter.post(
  "/subjects",
  requireAuth,
  requireRole(["admin", "teacher"]),
  validateBody(createSubjectSchema),
  (req, res) => {
    const actor = req.user!;
    const subject = createSubject(req.body.name as string, actor.userId);
    appendAuditLog({
      ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
      actorId: actor.userId,
      actorRole: actor.role,
      action: "create_subject",
      targetId: subject.id,
      detail: `${subject.name} subject created`,
      meta: { subjectName: subject.name },
    });
    res.status(201).json({ data: subject });
  },
);

academicRouter.get("/subjects", requireAuth, requireRole(["admin", "teacher"]), (_req, res) => {
  res.status(200).json({ data: listSubjects() });
});

academicRouter.get("/student/academic-scope", requireAuth, requireRole(["student"]), async (req, res, next) => {
  try {
    const user = req.user!;
    const items = await buildStudentAcademicScope(user.userId);
    res.status(200).json({ data: items });
  } catch (e) {
    next(e);
  }
});

/**
 * Teacher dashboard: subjects the caller may access, each with groups they may manage.
 * Admins receive every subject that has at least one group.
 */
academicRouter.get("/teacher/academic-scope", requireAuth, requireRole(["admin", "teacher"]), (req, res) => {
  const user = req.user!;
  const allSubjects = listSubjects();
  const allGroups = listGroups();

  type Block = { subject: (typeof allSubjects)[0]; groups: typeof allGroups };
  const blocks: Block[] = [];

  if (user.role === "admin") {
    for (const subject of allSubjects) {
      const groups = allGroups.filter((g) => g.subjectId === subject.id);
      if (groups.length > 0) {
        blocks.push({ subject, groups });
      }
    }
    res.status(200).json({ data: { subjects: blocks } });
    return;
  }

  for (const subject of allSubjects) {
    if (!canTeacherAccessSubject(user.userId, user.role, subject.id)) {
      continue;
    }
    const groups = allGroups.filter(
      (g) => g.subjectId === subject.id && canTeacherManageGroup(user.userId, user.role, g.id),
    );
    if (groups.length > 0) {
      blocks.push({ subject, groups });
    }
  }
  res.status(200).json({ data: { subjects: blocks } });
});

const createGroupSchema = z.object({
  subjectId: z.string().min(1),
  name: z.string().min(2),
});

academicRouter.post(
  "/groups",
  requireAuth,
  requireRole(["admin", "teacher"]),
  validateBody(createGroupSchema),
  (req, res) => {
    const actor = req.user!;
    const group = createGroup(req.body.subjectId as string, req.body.name as string, actor.userId);
    appendAuditLog({
      ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
      actorId: actor.userId,
      actorRole: actor.role,
      action: "create_group",
      groupId: group.id,
      targetId: group.id,
      detail: `${group.name} group created`,
      meta: { subjectId: group.subjectId, groupName: group.name },
    });
    res.status(201).json({ data: group });
  },
);

academicRouter.get("/groups", requireAuth, requireRole(["admin", "teacher"]), (req, res) => {
  const subjectId = typeof req.query.subjectId === "string" ? req.query.subjectId : undefined;
  const groups = subjectId ? listGroups().filter((group) => group.subjectId === subjectId) : listGroups();
  res.status(200).json({ data: groups });
});

academicRouter.get(
  "/groups/:groupId/students",
  requireAuth,
  requireRole(["admin", "teacher"]),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      if (!groupId || Array.isArray(groupId)) {
        throw new Error("Group id is required");
      }
      const actor = req.user!;
      if (!canTeacherManageGroup(actor.userId, actor.role, groupId)) {
        const err = new Error("Forbidden") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const students = await Promise.all(
        listEnrollmentsForGroup(groupId).map(async (e) => {
          const user = await getUserById(e.studentId);
          const attempts = listStudentAttemptsInGroup(e.studentId, groupId);
          const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1]!.attempt : null;
          const risk = classifyRiskFromSnapshot(computeRiskFeatureSnapshot(e.studentId, groupId));
          return {
            studentId: e.studentId,
            displayName: user?.displayName ?? null,
            email: user?.email ?? null,
            enrolledAt: e.enrolledAt,
            attemptCount: attempts.length,
            lastAttemptAt: latestAttempt?.submittedAt ?? null,
            latestScorePct:
              latestAttempt && latestAttempt.maxScore > 0
                ? Math.round((latestAttempt.totalScore / latestAttempt.maxScore) * 1000) / 10
                : null,
            riskLevel: risk.level,
            riskReason: risk.reasons[0]?.message ?? null,
          };
        }),
      );
      res.status(200).json({ data: students });
    } catch (e) {
      next(e);
    }
  },
);

const assignTeacherSchema = z.object({
  teacherId: z.string().min(1),
});

academicRouter.post(
  "/groups/:groupId/assign-teacher",
  requireAuth,
  requireRole(["admin"]),
  validateBody(assignTeacherSchema),
  (req, res) => {
    const groupId = req.params.groupId;
    if (!groupId || Array.isArray(groupId)) {
      throw new Error("Group id is required");
    }
    const actor = req.user!;
    const assignment = assignTeacher(groupId, req.body.teacherId as string, actor.userId);
    appendAuditLog({
      ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
      actorId: actor.userId,
      actorRole: actor.role,
      action: "assign_teacher",
      groupId,
      targetId: assignment.teacherId,
      detail: `Teacher assigned to group`,
      meta: { assignedBy: assignment.assignedBy },
    });
    res.status(201).json({ data: assignment });
  },
);

const createJoinCodeSchema = z.object({
  ttlHours: z.number().int().positive().max(24 * 30).optional(),
});

academicRouter.post(
  "/groups/:groupId/join-codes",
  requireAuth,
  requireRole(["admin", "teacher"]),
  validateBody(createJoinCodeSchema),
  (req, res) => {
    const groupId = req.params.groupId;
    if (!groupId || Array.isArray(groupId)) {
      throw new Error("Group id is required");
    }
    const actor = req.user!;
    const code = createJoinCode(groupId, actor.userId, req.body.ttlHours as number | undefined);
    appendAuditLog({
      ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
      actorId: actor.userId,
      actorRole: actor.role,
      action: "create_join_code",
      groupId,
      targetId: code.code,
      detail: `Join code generated for group`,
      meta: { expiresAt: code.expiresAt ?? null },
    });
    res.status(201).json({
      data: {
        id: code.id,
        code: code.code,
        groupId: code.groupId,
        expiresAt: code.expiresAt ?? null,
        revokedAt: code.revokedAt ?? null,
      },
    });
  },
);

academicRouter.get(
  "/groups/:groupId/join-codes",
  requireAuth,
  requireRole(["admin", "teacher"]),
  (req, res) => {
    const groupId = req.params.groupId;
    if (!groupId || Array.isArray(groupId)) {
      throw new Error("Group id is required");
    }
    const actor = req.user!;
    if (!canTeacherManageGroup(actor.userId, actor.role, groupId)) {
      const err = new Error("Forbidden") as Error & { statusCode?: number; code?: string };
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
    res.status(200).json({ data: listJoinCodesForGroup(groupId) });
  },
);

const revokeJoinCodeSchema = z.object({
  code: z.string().min(6),
});

academicRouter.post(
  "/groups/:groupId/join-codes/revoke",
  requireAuth,
  requireRole(["admin", "teacher"]),
  validateBody(revokeJoinCodeSchema),
  (req, res) => {
    const groupId = req.params.groupId;
    if (!groupId || Array.isArray(groupId)) {
      throw new Error("Group id is required");
    }
    const revoked = revokeJoinCode(groupId, req.body.code as string);
    res.status(200).json({ data: { code: revoked.code, revokedAt: revoked.revokedAt } });
  },
);

academicRouter.delete(
  "/groups/:groupId/join-codes/:joinCodeId",
  requireAuth,
  requireRole(["admin", "teacher"]),
  (req, res) => {
    const groupId = req.params.groupId;
    const joinCodeId = req.params.joinCodeId;
    if (!groupId || Array.isArray(groupId) || !joinCodeId || Array.isArray(joinCodeId)) {
      throw new Error("Group id and join code id are required");
    }
    const actor = req.user!;
    if (!canTeacherManageGroup(actor.userId, actor.role, groupId)) {
      const err = new Error("Forbidden") as Error & { statusCode?: number; code?: string };
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
    const revoked = revokeJoinCodeById(groupId, joinCodeId);
    res.status(200).json({ data: revoked });
  },
);

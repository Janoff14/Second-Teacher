import { Router } from "express";
import { z } from "zod";
import {
  assignTeacher,
  createGroup,
  createJoinCode,
  createSubject,
  listGroups,
  listSubjects,
  revokeJoinCode,
} from "../domain/academicStore";
import { appendAuditLog } from "../domain/auditStore";
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

academicRouter.get("/groups", requireAuth, requireRole(["admin", "teacher"]), (_req, res) => {
  res.status(200).json({ data: listGroups() });
});

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
        code: code.code,
        groupId: code.groupId,
        expiresAt: code.expiresAt ?? null,
      },
    });
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

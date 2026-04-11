import { Router } from "express";
import { z } from "zod";
import { canTeacherManageGroup, getGroup, isStudentInGroup } from "../domain/academicStore";
import {
  createDraft,
  getDraft,
  getVersion,
  listAttemptsForStudent,
  listPublishedVersionsForGroup,
  publishDraft,
  setDraftItems,
  submitAttempt,
  toStudentVersionView,
} from "../domain/assessmentStore";
import { refreshInsightsAfterAttempt } from "../domain/insightsStore";
import { indexPublishedAssessmentVersion } from "../domain/ragStore";
import { appendAuditLog } from "../domain/auditStore";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const assessmentsRouter = Router();

const createDraftSchema = z.object({
  groupId: z.string().min(1),
  title: z.string().min(1),
});

assessmentsRouter.post(
  "/assessments/drafts",
  requireAuth,
  requireRole(["admin", "teacher"]),
  validateBody(createDraftSchema),
  (req, res, next) => {
    try {
      const user = req.user!;
      const { groupId, title } = req.body as { groupId: string; title: string };
      if (!canTeacherManageGroup(user.userId, user.role, groupId)) {
        const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const draft = createDraft(groupId, title, user.userId);
      res.status(201).json({ data: draft });
    } catch (e) {
      next(e);
    }
  },
);

assessmentsRouter.get("/assessments/drafts/:draftId", requireAuth, requireRole(["admin", "teacher"]), (req, res, next) => {
  try {
    const draftId = req.params.draftId;
    if (!draftId || Array.isArray(draftId)) {
      throw new Error("Draft id required");
    }
    const draft = getDraft(draftId);
    if (!draft) {
      const err = new Error("Draft not found") as Error & { statusCode?: number; code?: string };
      err.statusCode = 404;
      err.code = "DRAFT_NOT_FOUND";
      throw err;
    }
    const user = req.user!;
    if (!canTeacherManageGroup(user.userId, user.role, draft.groupId)) {
      const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
    res.status(200).json({ data: draft });
  } catch (e) {
    next(e);
  }
});

const draftItemsSchema = z.object({
  items: z
    .array(
      z.object({
        stem: z.string().min(1),
        options: z.record(z.string(), z.string()).refine((o) => Object.keys(o).length >= 2, "At least two options"),
        correctKey: z.string().min(1),
      }),
    )
    .min(1),
});

assessmentsRouter.put(
  "/assessments/drafts/:draftId/items",
  requireAuth,
  requireRole(["admin", "teacher"]),
  validateBody(draftItemsSchema),
  (req, res, next) => {
    try {
      const draftId = req.params.draftId;
      if (!draftId || Array.isArray(draftId)) {
        throw new Error("Draft id required");
      }
      const draft = getDraft(draftId);
      if (!draft) {
        const err = new Error("Draft not found") as Error & { statusCode?: number; code?: string };
        err.statusCode = 404;
        err.code = "DRAFT_NOT_FOUND";
        throw err;
      }
      const user = req.user!;
      if (!canTeacherManageGroup(user.userId, user.role, draft.groupId)) {
        const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const updated = setDraftItems(draftId, req.body.items);
      res.status(200).json({ data: updated });
    } catch (e) {
      next(e);
    }
  },
);

const publishSchema = z.object({
  windowOpensAtUtc: z.string().min(1),
  windowClosesAtUtc: z.string().min(1),
  windowTimezone: z.string().min(1),
});

assessmentsRouter.post(
  "/assessments/drafts/:draftId/publish",
  requireAuth,
  requireRole(["admin", "teacher"]),
  validateBody(publishSchema),
  async (req, res, next) => {
    try {
      const draftId = req.params.draftId;
      if (!draftId || Array.isArray(draftId)) {
        throw new Error("Draft id required");
      }
      const draft = getDraft(draftId);
      if (!draft) {
        const err = new Error("Draft not found") as Error & { statusCode?: number; code?: string };
        err.statusCode = 404;
        err.code = "DRAFT_NOT_FOUND";
        throw err;
      }
      const user = req.user!;
      if (!canTeacherManageGroup(user.userId, user.role, draft.groupId)) {
        const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const version = publishDraft(draftId, user.userId, {
        windowOpensAtUtc: req.body.windowOpensAtUtc as string,
        windowClosesAtUtc: req.body.windowClosesAtUtc as string,
        windowTimezone: req.body.windowTimezone as string,
      });
      const group = getGroup(version.groupId);
      if (group) {
        await indexPublishedAssessmentVersion(version, group.subjectId);
      }
      appendAuditLog({
        ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
        actorId: user.userId,
        actorRole: user.role,
        action: "create_assessment",
        groupId: version.groupId,
        targetId: version.id,
        detail: `${version.title} assessment published`,
        meta: { draftId, itemCount: version.items.length },
      });
      res.status(201).json({ data: version });
    } catch (e) {
      next(e);
    }
  },
);

assessmentsRouter.get("/assessments/published", requireAuth, (req, res, next) => {
  try {
    const user = req.user!;
    const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;

    if (user.role === "student") {
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
      const versions = listPublishedVersionsForGroup(groupId).map(toStudentVersionView);
      res.status(200).json({ data: versions });
      return;
    }

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
    const versions = listPublishedVersionsForGroup(groupId);
    res.status(200).json({ data: versions });
  } catch (e) {
    next(e);
  }
});

assessmentsRouter.get("/assessments/published/:versionId", requireAuth, (req, res, next) => {
  try {
    const versionId = req.params.versionId;
    if (!versionId || Array.isArray(versionId)) {
      throw new Error("Version id required");
    }
    const version = getVersion(versionId);
    if (!version) {
      const err = new Error("Version not found") as Error & { statusCode?: number; code?: string };
      err.statusCode = 404;
      err.code = "VERSION_NOT_FOUND";
      throw err;
    }
    const user = req.user!;
    if (user.role === "student") {
      if (!isStudentInGroup(user.userId, version.groupId)) {
        const err = new Error("Forbidden") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      res.status(200).json({ data: toStudentVersionView(version) });
      return;
    }
    if (!canTeacherManageGroup(user.userId, user.role, version.groupId)) {
      const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
    res.status(200).json({ data: version });
  } catch (e) {
    next(e);
  }
});

const attemptSchema = z.object({
  answers: z.record(z.string(), z.string()),
});

assessmentsRouter.post(
  "/assessments/published/:versionId/attempts",
  requireAuth,
  requireRole(["student"]),
  validateBody(attemptSchema),
  (req, res, next) => {
    try {
      const versionId = req.params.versionId;
      if (!versionId || Array.isArray(versionId)) {
        throw new Error("Version id required");
      }
      const version = getVersion(versionId);
      if (!version) {
        const err = new Error("Version not found") as Error & { statusCode?: number; code?: string };
        err.statusCode = 404;
        err.code = "VERSION_NOT_FOUND";
        throw err;
      }
      const user = req.user!;
      if (!isStudentInGroup(user.userId, version.groupId)) {
        const err = new Error("Forbidden") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const attempt = submitAttempt(versionId, user.userId, req.body.answers as Record<string, string>);
      refreshInsightsAfterAttempt(user.userId, version.groupId);
      appendAuditLog({
        ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
        actorId: user.userId,
        actorRole: user.role,
        action: "submit_assessment",
        groupId: version.groupId,
        targetId: attempt.id,
        detail: `Assessment attempt submitted`,
        meta: { versionId, totalScore: attempt.totalScore, maxScore: attempt.maxScore },
      });
      res.status(201).json({ data: attempt });
    } catch (e) {
      next(e);
    }
  },
);

assessmentsRouter.get(
  "/assessments/published/:versionId/attempts/me",
  requireAuth,
  requireRole(["student"]),
  (req, res, next) => {
    try {
      const versionId = req.params.versionId;
      if (!versionId || Array.isArray(versionId)) {
        throw new Error("Version id required");
      }
      const version = getVersion(versionId);
      if (!version) {
        const err = new Error("Version not found") as Error & { statusCode?: number; code?: string };
        err.statusCode = 404;
        err.code = "VERSION_NOT_FOUND";
        throw err;
      }
      const user = req.user!;
      if (!isStudentInGroup(user.userId, version.groupId)) {
        const err = new Error("Forbidden") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const attempts = listAttemptsForStudent(versionId, user.userId);
      res.status(200).json({ data: attempts });
    } catch (e) {
      next(e);
    }
  },
);

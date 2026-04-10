import { Router } from "express";
import { z } from "zod";
import {
  canTeacherAccessSubject,
  canTeacherManageGroup,
  getGroup,
  isStudentInGroup,
} from "../domain/academicStore";
import { ingestTextbook, queryCorpus } from "../domain/ragStore";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const ragRouter = Router();

const textbookSchema = z.object({
  subjectId: z.string().min(1),
  title: z.string().min(1),
  versionLabel: z.string().min(1),
  text: z.string().min(1),
});

ragRouter.post(
  "/rag/sources/textbooks",
  requireAuth,
  requireRole(["admin", "teacher"]),
  validateBody(textbookSchema),
  (req, res, next) => {
    try {
      const user = req.user!;
      const body = req.body as z.infer<typeof textbookSchema>;
      if (!canTeacherAccessSubject(user.userId, user.role, body.subjectId)) {
        const err = new Error("Forbidden for this subject") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const result = ingestTextbook({
        subjectId: body.subjectId,
        title: body.title,
        versionLabel: body.versionLabel,
        text: body.text,
        createdBy: user.userId,
      });
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

const querySchema = z.object({
  query: z.string().min(2),
  groupId: z.string().min(1),
  topK: z.number().int().min(1).max(20).optional(),
});

ragRouter.post("/rag/query", requireAuth, validateBody(querySchema), (req, res, next) => {
  try {
    const user = req.user!;
    const body = req.body as z.infer<typeof querySchema>;
    const group = getGroup(body.groupId);
    if (!group) {
      const err = new Error("Group not found") as Error & { statusCode?: number; code?: string };
      err.statusCode = 404;
      err.code = "GROUP_NOT_FOUND";
      throw err;
    }
    if (user.role === "student") {
      if (!isStudentInGroup(user.userId, body.groupId)) {
        const err = new Error("Forbidden") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
    } else if (user.role === "teacher") {
      if (!canTeacherManageGroup(user.userId, user.role, body.groupId)) {
        const err = new Error("Forbidden") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
    } else if (user.role !== "admin") {
      const err = new Error("Forbidden") as Error & { statusCode?: number; code?: string };
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    const hits = queryCorpus({
      query: body.query,
      groupId: body.groupId,
      subjectId: group.subjectId,
      topK: body.topK ?? 8,
    });
    res.status(200).json({ data: hits });
  } catch (e) {
    next(e);
  }
});

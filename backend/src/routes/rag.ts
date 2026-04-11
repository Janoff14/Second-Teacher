import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import {
  canTeacherAccessSubject,
  canTeacherManageGroup,
  getGroup,
  isStudentInGroup,
} from "../domain/academicStore";
import {
  getTextbookReaderDocument,
  getTextbookSourceById,
  ingestTextbook,
  listTextbookSourcesForSubject,
  queryCorpus,
} from "../domain/ragStore";
import { appendAuditLog } from "../domain/auditStore";
import { extractTextFromUploadedDocument } from "../lib/documentText";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const ragRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

const textbookSchema = z.object({
  subjectId: z.string().min(1),
  title: z.string().min(1),
  versionLabel: z.string().min(1),
  text: z.string().min(1),
});

function uploadTextbookFile(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    const wrapped = new Error(
      err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
        ? "Textbook file is too large. Upload a file up to 25 MB."
        : err.message,
    ) as Error & { statusCode?: number; code?: string };
    wrapped.statusCode = 400;
    wrapped.code =
      err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
        ? "FILE_TOO_LARGE"
        : "UPLOAD_FAILED";
    next(wrapped);
  });
}

ragRouter.get(
  "/rag/sources/textbooks",
  requireAuth,
  requireRole(["admin", "teacher"]),
  (req, res, next) => {
    try {
      const subjectId = typeof req.query.subjectId === "string" ? req.query.subjectId.trim() : "";
      if (!subjectId) {
        const err = new Error("subjectId is required") as Error & { statusCode?: number; code?: string };
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }
      const user = req.user!;
      if (!canTeacherAccessSubject(user.userId, user.role, subjectId)) {
        const err = new Error("Forbidden for this subject") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      res.status(200).json({ data: listTextbookSourcesForSubject(subjectId) });
    } catch (e) {
      next(e);
    }
  },
);

ragRouter.post(
  "/rag/sources/textbooks",
  requireAuth,
  requireRole(["admin", "teacher"]),
  validateBody(textbookSchema),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const body = req.body as z.infer<typeof textbookSchema>;
      if (!canTeacherAccessSubject(user.userId, user.role, body.subjectId)) {
        const err = new Error("Forbidden for this subject") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const result = await ingestTextbook({
        subjectId: body.subjectId,
        title: body.title,
        versionLabel: body.versionLabel,
        text: body.text,
        createdBy: user.userId,
      });
      appendAuditLog({
        ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
        actorId: user.userId,
        actorRole: user.role,
        action: "upload_document",
        targetId: result.source.id,
        detail: `${body.title} document uploaded`,
        meta: {
          subjectId: body.subjectId,
          versionLabel: body.versionLabel,
          chunksCreated: result.chunksCreated,
        },
      });
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

ragRouter.post(
  "/rag/sources/textbooks/upload",
  requireAuth,
  requireRole(["admin", "teacher"]),
  uploadTextbookFile,
  async (req, res, next) => {
    try {
      const user = req.user!;
      const subjectId = typeof req.body.subjectId === "string" ? req.body.subjectId.trim() : "";
      const versionLabelRaw = typeof req.body.versionLabel === "string" ? req.body.versionLabel.trim() : "";
      const titleRaw = typeof req.body.title === "string" ? req.body.title.trim() : "";
      if (!subjectId) {
        const err = new Error("subjectId is required") as Error & { statusCode?: number; code?: string };
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }
      if (!canTeacherAccessSubject(user.userId, user.role, subjectId)) {
        const err = new Error("Forbidden for this subject") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const file = req.file;
      if (!file) {
        const err = new Error("Choose a textbook file to upload") as Error & { statusCode?: number; code?: string };
        err.statusCode = 400;
        err.code = "FILE_REQUIRED";
        throw err;
      }

      const extracted = await extractTextFromUploadedDocument({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      });
      const versionLabel = versionLabelRaw || new Date().toISOString().slice(0, 10);
      const title = titleRaw || extracted.suggestedTitle;
      const result = await ingestTextbook({
        subjectId,
        title,
        versionLabel,
        text: extracted.text,
        createdBy: user.userId,
        originalFileName: extracted.originalFileName,
        sourceFormat: extracted.sourceFormat,
      });

      appendAuditLog({
        ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
        actorId: user.userId,
        actorRole: user.role,
        action: "upload_document",
        targetId: result.source.id,
        detail: `${title} textbook uploaded`,
        meta: {
          subjectId,
          versionLabel,
          chunksCreated: result.chunksCreated,
          originalFileName: extracted.originalFileName,
          sourceFormat: extracted.sourceFormat,
          extractedCharacters: extracted.text.length,
        },
      });
      res.status(201).json({
        data: {
          ...result,
          extractedCharacters: extracted.text.length,
        },
      });
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

ragRouter.post("/rag/query", requireAuth, validateBody(querySchema), async (req, res, next) => {
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

    const hits = await queryCorpus({
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

ragRouter.get("/reader/textbooks/:textbookSourceId", requireAuth, (req, res, next) => {
  try {
    const textbookSourceId = req.params.textbookSourceId;
    if (!textbookSourceId || Array.isArray(textbookSourceId)) {
      const err = new Error("textbookSourceId is required") as Error & { statusCode?: number; code?: string };
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
    if (!groupId) {
      const err = new Error("groupId is required") as Error & { statusCode?: number; code?: string };
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const user = req.user!;
    const group = getGroup(groupId);
    if (!group) {
      const err = new Error("Group not found") as Error & { statusCode?: number; code?: string };
      err.statusCode = 404;
      err.code = "GROUP_NOT_FOUND";
      throw err;
    }

    if (user.role === "student") {
      if (!isStudentInGroup(user.userId, groupId)) {
        const err = new Error("Forbidden") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
    } else if (user.role === "teacher") {
      if (!canTeacherManageGroup(user.userId, user.role, groupId)) {
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

    const source = getTextbookSourceById(textbookSourceId);
    if (!source || source.subjectId !== group.subjectId) {
      const err = new Error("Reader source not found for this group") as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 404;
      err.code = "READER_SOURCE_NOT_FOUND";
      throw err;
    }
    const readerDoc = getTextbookReaderDocument(textbookSourceId);
    if (!readerDoc) {
      const err = new Error("Reader document not indexed") as Error & { statusCode?: number; code?: string };
      err.statusCode = 404;
      err.code = "READER_SOURCE_NOT_FOUND";
      throw err;
    }

    const paragraphId = typeof req.query.paragraphId === "string" ? req.query.paragraphId : undefined;
    const sentenceStartRaw = typeof req.query.sentenceStart === "string" ? Number.parseInt(req.query.sentenceStart, 10) : undefined;
    const sentenceEndRaw = typeof req.query.sentenceEnd === "string" ? Number.parseInt(req.query.sentenceEnd, 10) : undefined;
    const focusParagraph = paragraphId
      ? readerDoc.paragraphs.find((p: { id: string }) => p.id === paragraphId)
      : undefined;
    const sentenceStart = Number.isFinite(sentenceStartRaw) ? Math.max(1, sentenceStartRaw!) : undefined;
    const sentenceEnd = Number.isFinite(sentenceEndRaw) ? Math.max(sentenceStart ?? 1, sentenceEndRaw!) : undefined;

    res.status(200).json({
      data: {
        source,
        chapters: readerDoc.chapters,
        paragraphs: readerDoc.paragraphs,
        focus:
          focusParagraph !== undefined
            ? {
                paragraphId: focusParagraph.id,
                chapterNumber: focusParagraph.chapterNumber,
                chapterTitle: focusParagraph.chapterTitle,
                pageNumber: focusParagraph.pageNumber,
                sentenceStart,
                sentenceEnd,
              }
            : null,
      },
    });
  } catch (e) {
    next(e);
  }
});

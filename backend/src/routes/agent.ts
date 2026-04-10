import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { canTeacherManageGroup, isStudentInGroup } from "../domain/academicStore";
import { runStudentAgentChat, runTeacherAgentChat } from "../domain/agentOrchestrator";
import { appendAuditLog } from "../domain/auditStore";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const agentRouter = Router();

const chatSchema = z.object({
  message: z.string().min(1).max(8000),
  groupId: z.string().min(1),
});

function resolveAgentTimeoutMs(req: { header(name: string): string | undefined }): number {
  let timeoutMs = env.AGENT_TOOL_TIMEOUT_MS;
  if (env.NODE_ENV === "test") {
    const raw = req.header("x-test-agent-timeout-ms");
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 10 && n <= 60_000) {
        timeoutMs = n;
      }
    }
  }
  return timeoutMs;
}

agentRouter.post(
  "/agent/teacher/chat",
  requireAuth,
  requireRole(["admin", "teacher"]),
  validateBody(chatSchema),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const body = req.body as z.infer<typeof chatSchema>;
      if (user.role === "teacher" && !canTeacherManageGroup(user.userId, user.role, body.groupId)) {
        const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const timeoutMs = resolveAgentTimeoutMs(req);
      const result = await runTeacherAgentChat({
        groupId: body.groupId,
        message: body.message,
        timeoutMs,
        ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
      });
      appendAuditLog({
        ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
        actorId: user.userId,
        actorRole: user.role,
        action: "AGENT_TEACHER_CHAT",
        scope: { groupId: body.groupId },
        metadata: {
          fallback: result.fallback,
          tools: result.tools.map((t) => t.name),
          citationCount: result.citations.length,
        },
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

agentRouter.post(
  "/agent/student/chat",
  requireAuth,
  requireRole(["student"]),
  validateBody(chatSchema),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const body = req.body as z.infer<typeof chatSchema>;
      if (!isStudentInGroup(user.userId, body.groupId)) {
        const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const timeoutMs = resolveAgentTimeoutMs(req);
      const result = await runStudentAgentChat({
        studentId: user.userId,
        groupId: body.groupId,
        message: body.message,
        timeoutMs,
        ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
      });
      appendAuditLog({
        ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
        actorId: user.userId,
        actorRole: user.role,
        action: "AGENT_STUDENT_CHAT",
        scope: { groupId: body.groupId, studentId: user.userId },
        metadata: {
          fallback: result.fallback,
          tools: result.tools.map((t) => t.name),
          citationCount: result.citations.length,
        },
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

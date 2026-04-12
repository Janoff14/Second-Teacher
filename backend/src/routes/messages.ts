import { Router } from "express";
import { z } from "zod";
import {
  getConversationPartnerIds,
  getUnreadCount,
  listMessagesBetween,
  listThreads,
  markConversationRead,
  markMessageRead,
  sendMessage,
} from "../domain/messageStore";
import { getUserById, type Role } from "../domain/userStore";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const messagesRouter = Router();

/**
 * GET /messages/threads — list conversation threads for the current user.
 * Pre-resolves user info so the sync listThreads callback can return it.
 */
messagesRouter.get(
  "/messages/threads",
  requireAuth,
  async (req, res, next) => {
    try {
      const user = req.user!;
      const userCache = new Map<string, { displayName: string | null; role: Role }>();
      const partnerIds = getConversationPartnerIds(user.userId);
      await Promise.all(
        partnerIds.map(async (id) => {
          const u = await getUserById(id);
          if (u) userCache.set(id, { displayName: u.displayName, role: u.role });
        }),
      );
      const threads = listThreads(user.userId, (id) => {
        const cached = userCache.get(id);
        return cached ?? undefined;
      });
      res.status(200).json({ data: threads });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * GET /messages/unread-count — number of unread messages.
 */
messagesRouter.get(
  "/messages/unread-count",
  requireAuth,
  (req, res) => {
    const count = getUnreadCount(req.user!.userId);
    res.status(200).json({ data: { count } });
  },
);

/**
 * GET /messages/:recipientId — message history with a specific user.
 * Also marks the conversation as read for the current user.
 */
messagesRouter.get(
  "/messages/:recipientId",
  requireAuth,
  (req, res, next) => {
    try {
      const user = req.user!;
      const recipientId = Array.isArray(req.params.recipientId)
        ? req.params.recipientId[0]
        : req.params.recipientId;
      if (!recipientId) {
        const err = new Error("recipientId is required") as Error & {
          statusCode?: number;
          code?: string;
        };
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }
      markConversationRead(user.userId, recipientId);
      const data = listMessagesBetween(user.userId, recipientId);
      res.status(200).json({ data });
    } catch (e) {
      next(e);
    }
  },
);

const sendMessageSchema = z.object({
  recipientId: z.string().min(1, "recipientId is required"),
  body: z.string().min(1, "Message body is required").max(2000),
});

/**
 * POST /messages — send a direct message.
 */
messagesRouter.post(
  "/messages",
  requireAuth,
  validateBody(sendMessageSchema),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const { recipientId, body } = req.body as {
        recipientId: string;
        body: string;
      };

      const recipient = await getUserById(recipientId);
      if (!recipient) {
        const err = new Error("Recipient not found") as Error & {
          statusCode?: number;
          code?: string;
        };
        err.statusCode = 404;
        err.code = "NOT_FOUND";
        throw err;
      }

      const msg = sendMessage(user.userId, user.role, recipientId, body);
      res.status(201).json({ data: msg });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * PATCH /messages/:messageId/read — mark a single message as read.
 */
messagesRouter.patch(
  "/messages/:messageId/read",
  requireAuth,
  (req, res, next) => {
    try {
      const user = req.user!;
      const messageId = Array.isArray(req.params.messageId)
        ? req.params.messageId[0]
        : req.params.messageId;
      if (!messageId) {
        const err = new Error("messageId is required") as Error & {
          statusCode?: number;
          code?: string;
        };
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }

      const updated = markMessageRead(messageId, user.userId);
      if (!updated) {
        const err = new Error("Message not found or not yours") as Error & {
          statusCode?: number;
          code?: string;
        };
        err.statusCode = 404;
        err.code = "NOT_FOUND";
        throw err;
      }

      res.status(200).json({ data: updated });
    } catch (e) {
      next(e);
    }
  },
);


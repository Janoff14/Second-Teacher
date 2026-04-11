import { Router } from "express";
import { z } from "zod";
import { appendAuditLog } from "../domain/auditStore";
import { createUser, listUsersByRole } from "../domain/userStore";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const usersRouter = Router();

const createTeacherSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z
    .string()
    .min(1)
    .max(200)
    .transform((s) => s.trim()),
});

usersRouter.post(
  "/users/teachers",
  requireAuth,
  requireRole(["admin"]),
  validateBody(createTeacherSchema),
  async (req, res, next) => {
    try {
      const { email, password, displayName } = req.body as {
        email: string;
        password: string;
        displayName: string;
      };
      const user = await createUser(email, password, "teacher", displayName);
      const actor = req.user!;
      appendAuditLog({
        ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
        actorId: actor.userId,
        actorRole: actor.role,
        action: "register_teacher",
        targetId: user.id,
        detail: `Teacher ${user.displayName ?? user.email} registered`,
        meta: { teacherEmail: user.email },
      });
      res.status(201).json({
        data: {
          user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName },
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

usersRouter.get("/users/teachers", requireAuth, requireRole(["admin"]), async (_req, res, next) => {
  try {
    const teachers = await listUsersByRole("teacher");
    const data = teachers.map(({ id, email, displayName }) => ({ id, email, displayName }));
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

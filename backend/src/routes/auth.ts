import { Router } from "express";
import { z } from "zod";
import { appendAuditLog } from "../domain/auditStore";
import { createUser, getUserByEmail, verifyPassword } from "../domain/userStore";
import { HttpError } from "../lib/httpError";
import { signToken } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "student"]).default("student"),
  displayName: z.string().max(200).optional(),
});

authRouter.post("/auth/register", validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, password, role, displayName } = req.body as {
      email: string;
      password: string;
      role: "admin" | "student";
      displayName?: string;
    };
    const user = await createUser(email, password, role, displayName ?? null);
    appendAuditLog({
      ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
      actorId: user.id,
      actorRole: user.role,
      action: "register_user",
      targetId: user.id,
      detail: `User registration completed`,
      meta: { role: user.role, email: user.email },
    });
    const token = signToken(user.id, user.role);
    res.status(201).json({
      data: {
        user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

authRouter.post("/auth/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const user = await getUserByEmail(email);
    if (!user) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const isValid = await verifyPassword(user, password);
    if (!isValid) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const token = signToken(user.id, user.role);
    res.status(200).json({
      data: {
        user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
});

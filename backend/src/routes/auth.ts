import { Router } from "express";
import { z } from "zod";
import { createUser, getUserByEmail, verifyPassword, type Role } from "../domain/userStore";
import { HttpError } from "../lib/httpError";
import { signToken } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "teacher", "student"]).default("student"),
});

authRouter.post("/auth/register", validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, password, role } = req.body as { email: string; password: string; role: Role };
    const user = await createUser(email, password, role);
    const token = signToken(user.id, user.role);
    res.status(201).json({
      data: {
        user: { id: user.id, email: user.email, role: user.role },
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
        user: { id: user.id, email: user.email, role: user.role },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
});

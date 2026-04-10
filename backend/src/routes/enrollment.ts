import { Router } from "express";
import { z } from "zod";
import { createEnrollment, resolveJoinCode } from "../domain/academicStore";
import { createUser } from "../domain/userStore";
import { signToken } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";

export const enrollmentRouter = Router();

const joinCodePreviewSchema = z.object({
  code: z.string().min(6),
});

enrollmentRouter.post("/enrollment/preview", rateLimit(10, 60_000), validateBody(joinCodePreviewSchema), (req, res) => {
  const resolved = resolveJoinCode(req.body.code as string);
  if (!resolved) {
    return res.status(404).json({
      error: {
        code: "INVALID_JOIN_CODE",
        message: "Join code is invalid or expired",
      },
    });
  }

  return res.status(200).json({
    data: {
      subjectName: resolved.subject.name,
      groupName: resolved.group.name,
    },
  });
});

const signupWithCodeSchema = z.object({
  code: z.string().min(6),
  email: z.string().email(),
  password: z.string().min(8),
});

enrollmentRouter.post(
  "/auth/signup-with-join-code",
  rateLimit(5, 60_000),
  validateBody(signupWithCodeSchema),
  async (req, res, next) => {
    try {
      const resolved = resolveJoinCode(req.body.code as string);
      if (!resolved) {
        return res.status(404).json({
          error: {
            code: "INVALID_JOIN_CODE",
            message: "Join code is invalid or expired",
          },
        });
      }

      const user = await createUser(req.body.email as string, req.body.password as string, "student");
      const enrollment = createEnrollment(resolved.group.id, user.id);
      const token = signToken(user.id, user.role);

      return res.status(201).json({
        data: {
          user: { id: user.id, email: user.email, role: user.role },
          enrollment,
          token,
        },
      });
    } catch (err) {
      return next(err);
    }
  },
);

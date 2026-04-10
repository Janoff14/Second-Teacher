import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";

export const protectedRouter = Router();

protectedRouter.get("/protected/teacher", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
  res.status(200).json({
    data: {
      message: "Teacher scope granted",
      user: req.user,
    },
  });
});

protectedRouter.get("/protected/student", requireAuth, requireRole(["student", "teacher", "admin"]), (req, res) => {
  res.status(200).json({
    data: {
      message: "Student scope granted",
      user: req.user,
    },
  });
});

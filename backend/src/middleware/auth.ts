import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "../lib/httpError";
import type { Role } from "../domain/userStore";

type AuthPayload = {
  sub: string;
  role: Role;
};

export function signToken(userId: string, role: Role): string {
  return jwt.sign({ role }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: "12h",
  });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const raw = req.header("authorization");
  if (!raw?.startsWith("Bearer ")) {
    return next(new HttpError(401, "UNAUTHORIZED", "Missing bearer token"));
  }

  const token = raw.slice("Bearer ".length);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.user = {
      userId: decoded.sub,
      role: decoded.role,
    };
    next();
  } catch {
    next(new HttpError(401, "UNAUTHORIZED", "Invalid token"));
  }
}

export function requireRole(roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new HttpError(401, "UNAUTHORIZED", "Authentication required"));
    }
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, "FORBIDDEN", "Insufficient permissions"));
    }
    next();
  };
}

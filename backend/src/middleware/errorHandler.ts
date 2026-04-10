import type { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  const err = new Error("Route not found") as Error & { statusCode?: number; code?: string };
  err.statusCode = 404;
  err.code = "NOT_FOUND";
  next(err);
}

export function errorHandler(
  err: Error & { statusCode?: number; code?: string },
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? "INTERNAL_ERROR";
  const message = statusCode >= 500 ? "Unexpected server error" : err.message;

  logger.error(
    {
      requestId: req.requestId,
      statusCode,
      code,
      path: req.path,
      method: req.method,
      err: {
        message: err.message,
      },
    },
    "request_failed",
  );

  res.status(statusCode).json({
    error: {
      code,
      message,
      requestId: req.requestId,
    },
  });
}

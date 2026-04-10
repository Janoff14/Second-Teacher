import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; windowStart: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(perWindow: number, windowMs: number) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const existing = buckets.get(key);
    if (!existing || now - existing.windowStart > windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return next();
    }
    existing.count += 1;
    if (existing.count > perWindow) {
      const err = new Error("Too many requests") as Error & { statusCode?: number; code?: string };
      err.statusCode = 429;
      err.code = "RATE_LIMITED";
      return next(err);
    }
    return next();
  };
}

export function resetRateLimitForTest(): void {
  buckets.clear();
}

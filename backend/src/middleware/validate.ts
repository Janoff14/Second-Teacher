import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      const err = new Error(`Invalid request body: ${messages.join("; ")}`) as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      return next(err);
    }

    req.body = result.data;
    next();
  };
}

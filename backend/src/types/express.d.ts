import type { Role } from "../domain/userStore";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: {
        userId: string;
        role: Role;
      };
    }
  }
}

export {};

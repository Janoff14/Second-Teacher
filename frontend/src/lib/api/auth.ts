import { apiRequest } from "./client";
import { extractSession } from "./session";
import type { UserRole } from "@/stores/auth-store";

export type LoginBody = {
  email: string;
  password: string;
  expectedRole?: UserRole;
};

/** Optional seeded registration (adjust fields to match your API). */
export type RegisterBody = {
  email: string;
  password: string;
  displayName?: string;
  role: UserRole;
};

export async function login(body: LoginBody) {
  return apiRequest<unknown>("/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export async function register(body: RegisterBody) {
  return apiRequest<unknown>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export function sessionFromAuthResponse(data: unknown) {
  return extractSession(data);
}

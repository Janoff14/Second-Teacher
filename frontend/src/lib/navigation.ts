import type { UserRole } from "@/stores/auth-store";

export function dashboardPath(role: UserRole): string {
  switch (role) {
    case "teacher":
      return "/teacher";
    case "student":
      return "/student";
    case "admin":
      return "/admin";
    default:
      return "/";
  }
}

/** Avoid open redirects: only same-origin relative paths. */
export function safeInternalPath(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith("/") && !decoded.startsWith("//")) return decoded;
  } catch {
    /* ignore */
  }
  return null;
}

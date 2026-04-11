import type { UserRole } from "@/stores/auth-store";

export type ExtractedSession = {
  accessToken: string;
  role: UserRole;
  activeGroupId: string | null;
  /** Present when API includes user id (teacher/student/admin). */
  userId: string | null;
};

function normalizeRole(raw: unknown): UserRole | null {
  if (typeof raw !== "string") return null;
  const r = raw.toLowerCase();
  if (r === "teacher" || r === "student" || r === "admin") return r;
  return null;
}

function pickToken(d: Record<string, unknown>): string | null {
  if (typeof d.accessToken === "string" && d.accessToken) return d.accessToken;
  if (typeof d.token === "string" && d.token) return d.token;
  if (typeof d.access_token === "string" && d.access_token)
    return d.access_token;
  return null;
}

function pickGroupId(
  d: Record<string, unknown>,
  user: Record<string, unknown> | null,
): string | null {
  const fromRoot =
    typeof d.groupId === "string"
      ? d.groupId
      : typeof d.activeGroupId === "string"
        ? d.activeGroupId
        : null;
  if (fromRoot) return fromRoot;
  if (!user) return null;
  if (typeof user.groupId === "string") return user.groupId;
  if (typeof user.activeGroupId === "string") return user.activeGroupId;
  if (Array.isArray(user.enrollments) && user.enrollments.length > 0) {
    const first = user.enrollments[0] as Record<string, unknown>;
    if (typeof first?.groupId === "string") return first.groupId;
  }
  return null;
}

function pickUserId(
  d: Record<string, unknown>,
  user: Record<string, unknown> | null,
): string | null {
  if (typeof d.userId === "string" && d.userId.trim()) return d.userId.trim();
  if (typeof d.id === "string" && d.id.trim()) return d.id.trim();
  if (!user) return null;
  if (typeof user.id === "string" && user.id.trim()) return user.id.trim();
  if (typeof user.userId === "string" && user.userId.trim())
    return user.userId.trim();
  return null;
}

/**
 * Maps common API `data` shapes to client session.
 * Adjust if your `api-for-frontend.md` uses different field names.
 */
export function extractSession(data: unknown): ExtractedSession | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const token = pickToken(d);
  if (!token) return null;

  let user: Record<string, unknown> | null = null;
  if (d.user && typeof d.user === "object" && d.user !== null) {
    user = d.user as Record<string, unknown>;
  }

  let role: UserRole | null = normalizeRole(d.role);
  if (!role && user) {
    role = normalizeRole(user.role);
  }

  if (!role) return null;

  const activeGroupId = pickGroupId(d, user);
  const userId = pickUserId(d, user);

  return {
    accessToken: token,
    role,
    activeGroupId,
    userId,
  };
}

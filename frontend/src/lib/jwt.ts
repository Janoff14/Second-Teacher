/**
 * Reads common user id claims from a JWT payload (no signature verification).
 * Used when login response omits `user.id` but token carries `sub`.
 */
export function decodeJwtSubject(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json) as Record<string, unknown>;
    if (typeof payload.sub === "string" && payload.sub) return payload.sub;
    if (typeof payload.userId === "string" && payload.userId)
      return payload.userId;
    if (typeof payload.id === "string" && payload.id) return payload.id;
    return null;
  } catch {
    return null;
  }
}

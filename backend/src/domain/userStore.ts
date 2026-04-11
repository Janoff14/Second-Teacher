import bcrypt from "bcryptjs";
import { logger } from "../config/logger";
import { getSupabaseServiceRoleClient } from "../lib/supabase";

export type Role = "admin" | "teacher" | "student";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
}

const usersByEmail = new Map<string, UserRecord>();

let idCounter = 1;

function nextId(): string {
  const id = `u_${idCounter}`;
  idCounter += 1;
  return id;
}

function db() {
  return getSupabaseServiceRoleClient();
}

/**
 * Load all users from Supabase into the in-memory cache.
 * Called once at startup. Adjusts idCounter to avoid collisions.
 */
export async function loadUsersFromDb(): Promise<number> {
  const client = db();
  if (!client) return 0;

  const { data, error } = await client
    .from("users")
    .select("id, email, password_hash, role");

  if (error) {
    logger.error({ err: error }, "supabase_load_users_failed");
    return 0;
  }
  if (!data || data.length === 0) return 0;

  for (const row of data) {
    const record: UserRecord = {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role as Role,
    };
    usersByEmail.set(record.email, record);

    const num = parseInt(record.id.replace("u_", ""), 10);
    if (!isNaN(num) && num >= idCounter) {
      idCounter = num + 1;
    }
  }

  logger.info({ count: data.length }, "users_loaded_from_supabase");
  return data.length;
}

export async function getUserByEmail(email: string): Promise<UserRecord | undefined> {
  const normalized = email.toLowerCase();
  const cached = usersByEmail.get(normalized);
  if (cached) return cached;

  const client = db();
  if (!client) return undefined;

  const { data, error } = await client
    .from("users")
    .select("id, email, password_hash, role")
    .eq("email", normalized)
    .maybeSingle();

  if (error || !data) return undefined;

  const record: UserRecord = {
    id: data.id,
    email: data.email,
    passwordHash: data.password_hash,
    role: data.role as Role,
  };
  usersByEmail.set(normalized, record);
  return record;
}

export async function createUser(email: string, password: string, role: Role): Promise<UserRecord> {
  const normalized = email.toLowerCase();

  if (usersByEmail.has(normalized)) {
    const err = new Error("Email already exists") as Error & { statusCode?: number; code?: string };
    err.statusCode = 409;
    err.code = "USER_EXISTS";
    throw err;
  }

  const client = db();
  if (client) {
    const { data: existing } = await client
      .from("users")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();
    if (existing) {
      const err = new Error("Email already exists") as Error & { statusCode?: number; code?: string };
      err.statusCode = 409;
      err.code = "USER_EXISTS";
      throw err;
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const record: UserRecord = {
    id: nextId(),
    email: normalized,
    passwordHash,
    role,
  };

  if (client) {
    const { error } = await client.from("users").insert({
      id: record.id,
      email: record.email,
      password_hash: record.passwordHash,
      role: record.role,
    });
    if (error) {
      if (error.code === "23505") {
        const err = new Error("Email already exists") as Error & { statusCode?: number; code?: string };
        err.statusCode = 409;
        err.code = "USER_EXISTS";
        throw err;
      }
      logger.error({ err: error, email: normalized }, "supabase_create_user_failed");
      throw new Error("Failed to persist user");
    }
  }

  usersByEmail.set(normalized, record);
  return record;
}

export async function verifyPassword(record: UserRecord, password: string): Promise<boolean> {
  return bcrypt.compare(password, record.passwordHash);
}

export async function seedDefaultUsers(): Promise<void> {
  const defaults: Array<{ email: string; password: string; role: Role }> = [
    { email: "admin@secondteacher.dev", password: "ChangeMe123!", role: "admin" },
    { email: "teacher@secondteacher.dev", password: "ChangeMe123!", role: "teacher" },
    { email: "student@secondteacher.dev", password: "ChangeMe123!", role: "student" },
  ];

  for (const u of defaults) {
    const existing = await getUserByEmail(u.email);
    if (!existing) {
      await createUser(u.email, u.password, u.role);
    }
  }
}

export function resetUsersForTest(): void {
  usersByEmail.clear();
  idCounter = 1;
}

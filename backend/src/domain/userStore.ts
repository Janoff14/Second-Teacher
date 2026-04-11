import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { logger } from "../config/logger";
import { HttpError } from "../lib/httpError";
import { getSupabaseServiceRoleClient } from "../lib/supabase";

export type Role = "admin" | "teacher" | "student";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  displayName: string | null;
}

export type UserPublic = Pick<UserRecord, "id" | "email" | "role" | "displayName">;

const usersByEmail = new Map<string, UserRecord>();
const usersById = new Map<string, UserRecord>();

let idCounter = 1;
const USER_SELECT = "id, email, password_hash, role, display_name";
const USER_SELECT_NO_NAME = "id, email, password_hash, role";
const USER_PUBLIC_SELECT = "id, email, role, display_name";
const USER_PUBLIC_SELECT_NO_NAME = "id, email, role";

function nextId(): string {
  const id = `u_${idCounter}`;
  idCounter += 1;
  return id;
}

function db() {
  return getSupabaseServiceRoleClient();
}

function isMissingDisplayNameColumn(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code?: unknown }).code ?? "") : "";
  const message = "message" in err ? String((err as { message?: unknown }).message ?? "") : "";
  return code === "42703" && message.includes("display_name");
}

function cacheUser(record: UserRecord): void {
  usersByEmail.set(record.email, record);
  usersById.set(record.id, record);
}

function resolveDisplayName(role: Role, displayName?: string | null): string | null {
  const trimmed = displayName?.trim() ?? "";
  if (role === "teacher") {
    if (!trimmed) {
      const err = new Error("Teacher display name is required") as Error & { statusCode?: number; code?: string };
      err.statusCode = 400;
      err.code = "TEACHER_NAME_REQUIRED";
      throw err;
    }
    return trimmed;
  }
  return trimmed.length ? trimmed : null;
}

/**
 * Load all users from Supabase into the in-memory cache.
 * Called once at startup. Adjusts idCounter to avoid collisions.
 */
export async function loadUsersFromDb(): Promise<number> {
  const client = db();
  if (!client) return 0;

  const primary = await client.from("users").select(USER_SELECT);
  let data = primary.data;
  let error = primary.error;

  if (error && isMissingDisplayNameColumn(error)) {
    logger.warn({ err: error }, "supabase_users_missing_display_name_column_fallback");
    const fallback = await client.from("users").select(USER_SELECT_NO_NAME);
    data = fallback.data ? fallback.data.map((row) => ({ ...row, display_name: null })) : null;
    error = fallback.error;
  }

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
      displayName: row.display_name != null ? String(row.display_name) : null,
    };
    cacheUser(record);

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

  const primary = await client.from("users").select(USER_SELECT).eq("email", normalized).maybeSingle();
  let data = primary.data;
  let error = primary.error;

  if (error && isMissingDisplayNameColumn(error)) {
    const fallback = await client.from("users").select(USER_SELECT_NO_NAME).eq("email", normalized).maybeSingle();
    data = fallback.data ? { ...fallback.data, display_name: null } : fallback.data;
    error = fallback.error;
  }

  if (error || !data) return undefined;

  const record: UserRecord = {
    id: data.id,
    email: data.email,
    passwordHash: data.password_hash,
    role: data.role as Role,
    displayName: data.display_name != null ? String(data.display_name) : null,
  };
  cacheUser(record);
  return record;
}

export async function getUserById(id: string): Promise<UserRecord | undefined> {
  const cached = usersById.get(id);
  if (cached) return cached;

  const client = db();
  if (!client) return undefined;

  const primary = await client.from("users").select(USER_SELECT).eq("id", id).maybeSingle();
  let data = primary.data;
  let error = primary.error;

  if (error && isMissingDisplayNameColumn(error)) {
    const fallback = await client.from("users").select(USER_SELECT_NO_NAME).eq("id", id).maybeSingle();
    data = fallback.data ? { ...fallback.data, display_name: null } : fallback.data;
    error = fallback.error;
  }

  if (error || !data) return undefined;

  const record: UserRecord = {
    id: data.id,
    email: data.email,
    passwordHash: data.password_hash,
    role: data.role as Role,
    displayName: data.display_name != null ? String(data.display_name) : null,
  };
  cacheUser(record);
  return record;
}

export async function listUsersByRole(role: Role): Promise<UserPublic[]> {
  const client = db();
  if (client) {
    const primary = await client.from("users").select(USER_PUBLIC_SELECT).eq("role", role);
    let data = primary.data;
    let error = primary.error;

    if (error && isMissingDisplayNameColumn(error)) {
      const fallback = await client.from("users").select(USER_PUBLIC_SELECT_NO_NAME).eq("role", role);
      data = fallback.data ? fallback.data.map((row) => ({ ...row, display_name: null })) : null;
      error = fallback.error;
    }

    if (!error && data) {
      return data.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role as Role,
        displayName: row.display_name != null ? String(row.display_name) : null,
      }));
    }
  }

  return [...usersByEmail.values()]
    .filter((u) => u.role === role)
    .map((u) => ({ id: u.id, email: u.email, role: u.role, displayName: u.displayName }));
}

export async function createUser(
  email: string,
  password: string,
  role: Role,
  displayName?: string | null,
): Promise<UserRecord> {
  const normalized = email.toLowerCase();
  const resolvedName = resolveDisplayName(role, displayName);

  if (usersByEmail.has(normalized)) {
    const err = new Error("Email already exists") as Error & { statusCode?: number; code?: string };
    err.statusCode = 409;
    err.code = "USER_EXISTS";
    throw err;
  }

  const client = db();
  if (client) {
    const { data: existing } = await client.from("users").select("id").eq("email", normalized).maybeSingle();
    if (existing) {
      const err = new Error("Email already exists") as Error & { statusCode?: number; code?: string };
      err.statusCode = 409;
      err.code = "USER_EXISTS";
      throw err;
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  /** Supabase `users.id` is almost always `uuid`; local-only mode uses `u_` counters. */
  const id = client ? randomUUID() : nextId();
  const record: UserRecord = {
    id,
    email: normalized,
    passwordHash,
    role,
    displayName: resolvedName,
  };

  if (client) {
    let { error } = await client.from("users").insert({
      id: record.id,
      email: record.email,
      password_hash: record.passwordHash,
      role: record.role,
      display_name: record.displayName,
    });
    if (error && isMissingDisplayNameColumn(error)) {
      logger.warn({ err: error, email: normalized }, "supabase_users_missing_display_name_on_insert_fallback");
      const fallback = await client.from("users").insert({
        id: record.id,
        email: record.email,
        password_hash: record.passwordHash,
        role: record.role,
      });
      error = fallback.error;
    }
    if (error) {
      if (error.code === "23505") {
        const err = new Error("Email already exists") as Error & { statusCode?: number; code?: string };
        err.statusCode = 409;
        err.code = "USER_EXISTS";
        throw err;
      }
      logger.error(
        {
          err: error,
          email: normalized,
          pgCode: (error as { code?: string }).code,
          pgMessage: (error as { message?: string }).message,
        },
        "supabase_create_user_failed",
      );
      throw new HttpError(
        502,
        "USER_PERSIST_FAILED",
        "Could not save user to database; check server logs and Supabase schema (id type, columns, migrations).",
      );
    }
  }

  cacheUser(record);
  return record;
}

export async function verifyPassword(record: UserRecord, password: string): Promise<boolean> {
  return bcrypt.compare(password, record.passwordHash);
}

export async function seedDefaultUsers(): Promise<void> {
  const defaults: Array<{ email: string; password: string; role: Role; displayName?: string | null }> = [
    { email: "admin@secondteacher.dev", password: "ChangeMe123!", role: "admin", displayName: "Demo Admin" },
    { email: "z9k.admin@secondteacher.dev", password: "qwerty123", role: "admin", displayName: "Extra Admin" },
    { email: "teacher@secondteacher.dev", password: "ChangeMe123!", role: "teacher", displayName: "Demo Teacher" },
    /** Roster demo owner; same password as seed students — sync with `DEMO_SEED_TEACHER_EMAIL` in `seed/demoDataset.ts`. */
    {
      email: "demo.seed.teacher@secondteacher.dev",
      password: "DemoSeed2026!",
      role: "teacher",
      displayName: "Seed Demo Teacher",
    },
    { email: "student@secondteacher.dev", password: "ChangeMe123!", role: "student", displayName: null },
  ];

  for (const u of defaults) {
    const existing = await getUserByEmail(u.email);
    if (!existing) {
      try {
        await createUser(u.email, u.password, u.role, u.displayName);
      } catch (err) {
        const code = (err as { code?: string } | undefined)?.code;
        if (code === "USER_EXISTS") {
          logger.info({ email: u.email }, "seed_user_already_exists");
          continue;
        }
        throw err;
      }
    }
  }
}

export function resetUsersForTest(): void {
  usersByEmail.clear();
  usersById.clear();
  idCounter = 1;
}

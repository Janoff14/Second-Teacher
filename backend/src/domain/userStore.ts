import bcrypt from "bcryptjs";

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

export function getUserByEmail(email: string): UserRecord | undefined {
  return usersByEmail.get(email.toLowerCase());
}

export async function createUser(email: string, password: string, role: Role): Promise<UserRecord> {
  const normalized = email.toLowerCase();
  if (usersByEmail.has(normalized)) {
    const err = new Error("Email already exists") as Error & { statusCode?: number; code?: string };
    err.statusCode = 409;
    err.code = "USER_EXISTS";
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const record: UserRecord = {
    id: nextId(),
    email: normalized,
    passwordHash,
    role,
  };
  usersByEmail.set(normalized, record);
  return record;
}

export async function verifyPassword(record: UserRecord, password: string): Promise<boolean> {
  return bcrypt.compare(password, record.passwordHash);
}

export async function seedDefaultUsers(): Promise<void> {
  if (usersByEmail.size > 0) {
    return;
  }

  await createUser("admin@secondteacher.dev", "ChangeMe123!", "admin");
  await createUser("teacher@secondteacher.dev", "ChangeMe123!", "teacher");
  await createUser("student@secondteacher.dev", "ChangeMe123!", "student");
}

export function resetUsersForTest(): void {
  usersByEmail.clear();
  idCounter = 1;
}

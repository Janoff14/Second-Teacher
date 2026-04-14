"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { login, sessionFromAuthResponse } from "@/lib/api/auth";
import { decodeJwtSubject } from "@/lib/jwt";
import { dashboardPath, safeInternalPath } from "@/lib/navigation";
import { useAuthStore } from "@/stores/auth-store";
import type { UserRole } from "@/stores/auth-store";

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
    >
      {message}
    </div>
  );
}

type RoleHint = "teacher" | "student" | "admin" | null;

function roleHeading(hint: RoleHint): string {
  if (hint === "teacher") return "Sign in as Teacher";
  if (hint === "student") return "Sign in as Student";
  if (hint === "admin") return "Sign in as Administrator";
  return "Sign in";
}

function roleDescription(hint: RoleHint): string {
  if (hint === "teacher") return "Use your teacher email and password.";
  if (hint === "student") return "Use your student demo account to explore the platform.";
  if (hint === "admin") return "Use your administrator email and password.";
  return "Use your email and password.";
}

function demoAccountsForRole(hint: RoleHint): Array<{ role: string; email: string; password: string }> {
  if (hint === "student") {
    return [
      {
        role: "Student",
        email: "lila.kim_demo@secondteacher.dev",
        password: "DemoSeed2026!",
      },
    ];
  }
  if (hint === "teacher") {
    return [
      {
        role: "Teacher",
        email: "kamila.saidova_demo@secondteacher.dev",
        password: "DemoSeed2026!",
      },
    ];
  }
  if (hint === "admin") {
    return [
      {
        role: "Admin",
        email: "admin@secondteacher.dev",
        password: "ChangeMe123!",
      },
    ];
  }
  return [];
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("session") === "expired";
  const roleHint = (searchParams.get("role") as RoleHint) ?? null;
  const demoAccounts = demoAccountsForRole(roleHint);
  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function redirectAfterAuth(role: UserRole) {
    const from = safeInternalPath(searchParams.get("from"));
    router.push(from ?? dashboardPath(role));
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await login({ email: email.trim(), password });
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    const session = sessionFromAuthResponse(res.data);
    if (!session) {
      setError(
        "Unexpected login response. Please align session parsing with the API shape.",
      );
      return;
    }
    const resolvedUserId =
      session.userId ??
      (session.role === "teacher" ? decodeJwtSubject(session.accessToken) : null);
    setSession({
      accessToken: session.accessToken,
      role: session.role,
      activeGroupId: session.activeGroupId ?? null,
      userId: resolvedUserId ?? null,
    });
    redirectAfterAuth(session.role);
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
        {roleHeading(roleHint)}
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {roleDescription(roleHint)}
      </p>

      {sessionExpired && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
          Session expired (401). Please sign in again.
        </p>
      )}

      {demoAccounts.length > 0 ? (
        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
          <span className="font-semibold">Demo account</span>: use this pre-filled account to test the
          platform with existing data.
          <ul className="mt-2 space-y-1 font-mono">
            {demoAccounts.map((account) => (
              <li key={account.email}>
                {account.role}: {account.email} / {account.password}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ErrorBox message={error} />

      <form onSubmit={handleLogin} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            Email
          </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              disabled={loading}
              required
            />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            Password
          </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="password"
              value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
            disabled={loading}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-neutral-900 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-8 text-sm">
        <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">
          &larr; Home
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-sm text-neutral-500">Loading&hellip;</div>}
    >
      <LoginContent />
    </Suspense>
  );
}

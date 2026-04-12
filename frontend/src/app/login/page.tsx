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
      className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
    >
      {message}
    </div>
  );
}

type RoleHint = "teacher" | "admin" | null;

function roleHeading(hint: RoleHint): string {
  if (hint === "teacher") return "O\u2018qituvchi sifatida kirish";
  if (hint === "admin") return "Administrator sifatida kirish";
  return "Kirish";
}

function roleDescription(hint: RoleHint): string {
  if (hint === "teacher")
    return "Admin tomonidan berilgan ism familya, email va parol bilan kiring.";
  if (hint === "admin") return "Administrator email va parol bilan kiring.";
  return "Email va parol bilan kiring.";
}

function roleGradient(hint: RoleHint): string {
  if (hint === "teacher") return "from-brand-500 to-violet-500";
  if (hint === "admin") return "from-amber-500 to-orange-500";
  return "from-brand-500 to-brand-600";
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("session") === "expired";
  const roleHint = (searchParams.get("role") as RoleHint) ?? null;
  const isTeacher = roleHint === "teacher";
  const setSession = useAuthStore((s) => s.setSession);

  const [displayName, setDisplayName] = useState("");
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
        "Kutilmagan javob \u2014 session.ts ni API ga moslashtiring.",
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

  const gradient = roleGradient(roleHint);

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-16">
      <div className="absolute inset-0 bg-dot-pattern opacity-30" />
      <div className="absolute -left-32 top-1/4 h-64 w-64 rounded-full bg-brand-400/20 blur-[100px]" />
      <div className="absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-violet-400/15 blur-[120px]" />

      <div className="relative w-full max-w-md animate-fade-in">
        <div className={`h-1.5 rounded-t-3xl bg-gradient-to-r ${gradient}`} />
        <div className="rounded-b-3xl border border-foreground/10 bg-white/80 px-8 py-10 shadow-card backdrop-blur dark:bg-foreground/[0.06]">
          <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
            Second<span className="text-gradient-brand">Teacher</span>
          </Link>

          <h1 className="mt-6 text-2xl font-bold text-foreground">
            {roleHeading(roleHint)}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            {roleDescription(roleHint)}
          </p>

          {sessionExpired && (
            <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Sessiya tugadi (401). Qayta kiring.
            </p>
          )}

          <ErrorBox message={error} />

          <form onSubmit={handleLogin} className="mt-7 space-y-5">
            {isTeacher && (
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-sm font-semibold text-foreground/80"
                >
                  Ism Familya
                </label>
                <input
                  id="displayName"
                  type="text"
                  autoComplete="name"
                  placeholder="Abdullayev Jasur"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-foreground/15 bg-background px-4 py-2.5 text-sm text-foreground transition-colors placeholder:text-foreground/40"
                  disabled={loading}
                  required
                />
              </div>
            )}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-foreground/80"
              >
                Elektron pochta
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="example@mail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-xl border border-foreground/15 bg-background px-4 py-2.5 text-sm text-foreground transition-colors placeholder:text-foreground/40"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-foreground/80"
              >
                Parol
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-xl border border-foreground/15 bg-background px-4 py-2.5 text-sm text-foreground transition-colors placeholder:text-foreground/40"
                disabled={loading}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-xl bg-gradient-to-r ${gradient} py-3 text-sm font-semibold text-white shadow-glow transition-all hover:shadow-glow-lg hover:brightness-110 disabled:opacity-50`}
            >
              {loading ? "Kirilmoqda\u2026" : "Kirish"}
            </button>
          </form>

          <p className="mt-8 text-sm">
            <Link href="/" className="font-semibold text-brand-500 hover:underline dark:text-brand-400">
              &larr; Bosh sahifa
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-foreground/55">Yuklanmoqda&hellip;</p>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

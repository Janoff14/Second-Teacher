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
          Sessiya tugadi (401). Qayta kiring.
        </p>
      )}

      {process.env.NODE_ENV === "development" && (
        <p className="mt-4 rounded-md border border-neutral-600 bg-neutral-900/50 px-3 py-2 text-xs leading-relaxed text-neutral-400">
          <span className="font-medium text-neutral-300">Dev</span>:{" "}
          <code className="text-neutral-300">demo.seed.teacher@secondteacher.dev</code> va barcha{" "}
          <code className="text-neutral-300">demo.seed.s*</code> studentlar paroli{" "}
          <code className="text-neutral-300">DemoSeed2026!</code>;{" "}
          <code className="text-neutral-300">teacher@secondteacher.dev</code> uchun{" "}
          <code className="text-neutral-300">ChangeMe123!</code>. &quot;Ism Familya&quot; faqat forma; login
          API ga email va parol yuboriladi. Boshqa kompyuterda ishlagan bo&apos;lsa,{" "}
          <code className="text-neutral-300">frontend/.env.local</code> ichidagi{" "}
          <code className="text-neutral-300">NEXT_PUBLIC_API_BASE_URL</code> shu yerdagi backend ga
          ishora qilishi kerak (odatda <code className="text-neutral-300">http://localhost:4000</code>).
          Backendda <code className="text-neutral-300">SUPABASE_*</code> yoqilgan bo&apos;lsa,
          foydalanuvchilar boshqa muhitdagi kabi bo&apos;lmasligi mumkin.
        </p>
      )}

      <ErrorBox message={error} />

      <form onSubmit={handleLogin} className="mt-6 space-y-4">
        {isTeacher && (
          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
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
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              disabled={loading}
              required
            />
          </div>
        )}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
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
            Parol
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
          {loading ? "Kirilmoqda\u2026" : "Kirish"}
        </button>
      </form>

      <p className="mt-8 text-sm">
        <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">
          &larr; Bosh sahifa
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-sm text-neutral-500">Yuklanmoqda&hellip;</div>}
    >
      <LoginContent />
    </Suspense>
  );
}

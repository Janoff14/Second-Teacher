"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  parsePreviewInfo,
  previewEnrollment,
  signupWithJoinCode,
} from "@/lib/api/enrollment";
import { extractSession } from "@/lib/api/session";
import { useAuthStore } from "@/stores/auth-store";

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

export default function JoinPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const [step, setStep] = useState<1 | 2>(1);
  const [joinCode, setJoinCode] = useState("");
  const [previewLabel, setPreviewLabel] = useState<string | null>(null);
  const [previewGroupId, setPreviewGroupId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setLoading(true);
    setError(null);
    const res = await previewEnrollment({ code: joinCode.trim() });
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    const info = parsePreviewInfo(res.data);
    if (!info) {
      setError("Unexpected preview response — check API shape in enrollment.ts.");
      return;
    }
    setPreviewGroupId(info.groupId);
    setPreviewLabel(info.label ?? null);
    setStep(2);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim() || !email.trim() || !password) return;
    setLoading(true);
    setError(null);
    const res = await signupWithJoinCode({
      joinCode: joinCode.trim(),
      email: email.trim(),
      password,
      displayName: displayName.trim() || undefined,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    const session = extractSession(res.data);
    if (!session) {
      setError(
        "Could not read token/role from signup response — adjust extractSession in session.ts.",
      );
      return;
    }
    if (session.role !== "student") {
      setError("This flow expects a student account. Check signup response role.");
      return;
    }
    setSession({
      accessToken: session.accessToken,
      role: session.role,
      activeGroupId: session.activeGroupId ?? previewGroupId ?? null,
      userId: session.userId ?? null,
    });
    router.push("/student");
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-foreground/15 bg-background px-4 py-2.5 text-sm text-foreground transition-colors placeholder:text-foreground/40";
  const labelClass = "block text-sm font-semibold text-foreground/80";

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-16">
      <div className="absolute inset-0 bg-dot-pattern opacity-30" />
      <div className="absolute -left-32 top-1/4 h-64 w-64 rounded-full bg-accent-400/20 blur-[100px]" />
      <div className="absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-cyan-400/15 blur-[120px]" />

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="h-1.5 rounded-t-3xl bg-gradient-to-r from-accent-500 to-cyan-500" />
        <div className="rounded-b-3xl border border-foreground/10 bg-white/80 px-8 py-10 shadow-card backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
            Second<span className="text-gradient-brand">Teacher</span>
          </Link>

          <h1 className="mt-6 text-2xl font-bold text-foreground">
            Join with a code
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            Step 1: preview the code. Step 2: create your student account.
          </p>

          <div className="mt-5 flex gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step >= 1 ? "bg-gradient-to-br from-accent-500 to-cyan-500 text-white" : "bg-foreground/10 text-foreground/50"}`}>
              1
            </div>
            <div className="mt-3.5 h-0.5 flex-1 rounded-full bg-foreground/10">
              <div className={`h-full rounded-full bg-gradient-to-r from-accent-500 to-cyan-500 transition-all duration-500 ${step >= 2 ? "w-full" : "w-0"}`} />
            </div>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step >= 2 ? "bg-gradient-to-br from-accent-500 to-cyan-500 text-white" : "bg-foreground/10 text-foreground/50"}`}>
              2
            </div>
          </div>

          <ErrorBox message={error} />

          {step === 1 && (
            <form onSubmit={handlePreview} className="mt-7 space-y-5">
              <div>
                <label htmlFor="joinCode" className={labelClass}>
                  Join code
                </label>
                <input
                  id="joinCode"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  autoComplete="off"
                  className={inputClass}
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-accent-500 to-cyan-500 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
              >
                {loading ? "Checking\u2026" : "Continue"}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleSignup} className="mt-7 space-y-5">
              {previewLabel && (
                <p className="rounded-2xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800 dark:border-accent-800 dark:bg-accent-950/30 dark:text-accent-200">
                  Group: <strong>{previewLabel}</strong>
                  {previewGroupId && (
                    <span className="ml-2 font-mono text-xs text-foreground/55">
                      ({previewGroupId})
                    </span>
                  )}
                </p>
              )}
              <div>
                <label htmlFor="email" className={labelClass}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className={inputClass}
                  disabled={loading}
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className={labelClass}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className={inputClass}
                  disabled={loading}
                  required
                />
              </div>
              <div>
                <label htmlFor="displayName" className={labelClass}>
                  Display name (optional)
                </label>
                <input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputClass}
                  disabled={loading}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError(null);
                  }}
                  disabled={loading}
                  className="flex-1 rounded-xl border border-foreground/15 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/[0.05]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-gradient-to-r from-accent-500 to-cyan-500 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {loading ? "Creating\u2026" : "Create account"}
                </button>
              </div>
            </form>
          )}

          <p className="mt-8 text-sm">
            <Link href="/" className="font-semibold text-brand-500 hover:underline dark:text-brand-400">
              &larr; Home
            </Link>
            {" \u00b7 "}
            <Link
              href="/login"
              className="font-semibold text-brand-500 hover:underline dark:text-brand-400"
            >
              Already have an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

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
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
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

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
        Join with a code
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Step 1: preview the code. Step 2: create your student account (
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
          POST /auth/signup-with-join-code
        </code>
        ).
      </p>

      <ErrorBox message={error} />

      {step === 1 && (
        <form onSubmit={handlePreview} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="joinCode"
              className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              Join code
            </label>
            <input
              id="joinCode"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-neutral-900 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {loading ? "Checking…" : "Continue"}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleSignup} className="mt-8 space-y-4">
          {previewLabel && (
            <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900/50">
              Group: <strong>{previewLabel}</strong>
              {previewGroupId && (
                <span className="ml-2 font-mono text-xs text-neutral-500">
                  ({previewGroupId})
                </span>
              )}
            </p>
          )}
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              disabled={loading}
              required
            />
          </div>
          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              Display name (optional)
            </label>
            <input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              disabled={loading}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError(null);
              }}
              disabled={loading}
              className="flex-1 rounded-md border border-neutral-300 py-2 text-sm dark:border-neutral-600"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-md bg-neutral-900 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {loading ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      )}

      <p className="mt-8 text-sm">
        <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">
          ← Home
        </Link>
        {" · "}
        <Link
          href="/login"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          Already have an account
        </Link>
      </p>
    </div>
  );
}

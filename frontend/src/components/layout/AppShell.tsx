"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TeacherCommandPalette } from "@/components/teacher/TeacherCommandPalette";
import { getTeacherAiBriefing } from "@/lib/api/assessments";
import { useAuthStore } from "@/stores/auth-store";
import type { UserRole } from "@/stores/auth-store";

export type Section = "teacher" | "student" | "admin";

type NavItem = { href: string; label: string };

const adminTabs: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/audit", label: "Audit" },
];

const teacherTabs: NavItem[] = [
  { href: "/teacher", label: "Bosh panel" },
  { href: "/notifications", label: "Bildirishnomalar" },
];

const studentTabs: NavItem[] = [
  { href: "/student", label: "My subjects" },
  { href: "/join", label: "Join class" },
  { href: "/notifications", label: "AI alerts" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin" || href === "/teacher" || href === "/student") {
    if (href === "/teacher") {
      return (
        pathname === "/teacher" ||
        pathname.startsWith("/teacher/groups") ||
        pathname.startsWith("/teacher/subjects")
      );
    }
    if (href === "/student") {
      return pathname === "/student" || pathname.startsWith("/student/subjects");
    }
    return pathname === href;
  }
  return pathname.startsWith(href);
}

const sectionGradient: Record<Section, string> = {
  teacher: "from-brand-600 via-brand-500 to-violet-500",
  student: "from-accent-600 via-accent-500 to-cyan-500",
  admin: "from-amber-600 via-orange-500 to-rose-500",
};

export function AppShell({
  section,
  children,
}: {
  section: Section;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const role = useAuthStore((s) => s.role) as UserRole | null;
  const activeGroupId = useAuthStore((s) => s.activeGroupId);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [attentionCount, setAttentionCount] = useState<number | null>(null);

  const teacherGroupFromPath =
    section === "teacher" && pathname.startsWith("/teacher/groups/")
      ? (pathname.match(/^\/teacher\/groups\/([^/]+)/)?.[1] ?? null)
      : null;
  const decodedTeacherGroupId = teacherGroupFromPath
    ? decodeURIComponent(teacherGroupFromPath)
    : null;

  const refreshAttention = useCallback(async () => {
    if (!decodedTeacherGroupId) {
      setAttentionCount(null);
      return;
    }
    const res = await getTeacherAiBriefing(decodedTeacherGroupId, false);
    if (res.ok && res.data) {
      setAttentionCount(res.data.attentionNeeded);
    }
  }, [decodedTeacherGroupId]);

  useEffect(() => {
    void refreshAttention();
  }, [refreshAttention]);

  useEffect(() => {
    if (section !== "teacher") return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [section]);

  const tabs =
    section === "admin"
      ? adminTabs
      : section === "student"
        ? studentTabs
        : teacherTabs;

  function handleLogout() {
    clearSession();
    router.push("/");
  }

  function closePalette() {
    setPaletteOpen(false);
    void refreshAttention();
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {section === "teacher" ? (
        <TeacherCommandPalette
          groupId={decodedTeacherGroupId}
          open={paletteOpen}
          onClose={closePalette}
        />
      ) : null}

      <header className="sticky top-0 z-40 border-b border-foreground/8 bg-glass">
        <div className={`h-1 bg-gradient-to-r ${sectionGradient[section]}`} />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex flex-wrap items-center gap-5">
            <Link
              href={section === "admin" ? "/admin" : section === "student" ? "/student" : "/teacher"}
              className="text-lg font-bold tracking-tight text-foreground"
            >
              Second<span className="text-gradient-brand">Teacher</span>
            </Link>
            <nav className="flex flex-wrap gap-1 text-sm">
              {tabs.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={
                    isActive(pathname, tab.href)
                      ? "rounded-full bg-brand-100 px-3.5 py-1.5 font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                      : "rounded-full px-3.5 py-1.5 text-foreground/70 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/50 dark:hover:text-brand-400"
                  }
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {section === "teacher" ? (
              <button
                type="button"
                title="Open class assistant (Ctrl+K or Cmd+K)"
                onClick={() => setPaletteOpen(true)}
                className="relative rounded-full bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-1.5 text-xs font-semibold text-white shadow-glow transition-shadow hover:shadow-glow-lg"
              >
                Assistant
                {attentionCount != null && attentionCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-brand-950">
                    {attentionCount > 9 ? "9+" : attentionCount}
                  </span>
                ) : null}
              </button>
            ) : null}
            {role && (
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold capitalize text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                {role}
              </span>
            )}
            {role === "student" && activeGroupId && (
              <span
                className="max-w-[10rem] truncate font-mono text-xs text-foreground/55"
                title={activeGroupId}
              >
                group {activeGroupId.slice(0, 8)}&hellip;
              </span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-foreground/15 px-4 py-1.5 text-sm font-medium text-foreground/70 transition-all hover:border-brand-300 hover:text-brand-600 dark:hover:border-brand-700 dark:hover:text-brand-400"
            >
              Chiqish
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
        {children}
      </main>
    </div>
  );
}

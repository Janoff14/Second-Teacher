"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TeacherCommandPalette } from "@/components/teacher/TeacherCommandPalette";
import { getTeacherAiBriefing } from "@/lib/api/assessments";
import {
  listMyNotifications,
  unwrapNotificationList,
} from "@/lib/api/notifications";
import { getUnreadCount } from "@/lib/api/messages";
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
  { href: "/messages", label: "Messages" },
  { href: "/notifications", label: "Bildirishnomalar" },
];

const studentTabs: NavItem[] = [
  { href: "/student", label: "My subjects" },
  { href: "/join", label: "Join class" },
  { href: "/messages", label: "Messages" },
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
  const [notifCount, setNotifCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);

  const teacherGroupFromPath =
    section === "teacher" && pathname.startsWith("/teacher/groups/")
      ? (pathname.match(/^\/teacher\/groups\/([^/]+)/)?.[1] ?? null)
      : null;
  const decodedTeacherGroupId = teacherGroupFromPath
    ? decodeURIComponent(teacherGroupFromPath)
    : null;

  const palettePageContext = (() => {
    if (!pathname.startsWith("/teacher/groups/")) return undefined;
    const studentMatch = pathname.match(/\/teacher\/groups\/[^/]+\/students\/([^/]+)/);
    if (studentMatch) {
      return {
        page: "teacher-student-profile" as const,
        studentId: decodeURIComponent(studentMatch[1]!),
      };
    }
    return { page: "teacher-group" as const };
  })();

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
    let cancelled = false;
    async function poll() {
      const [nRes, mRes] = await Promise.allSettled([
        listMyNotifications(50),
        getUnreadCount(),
      ]);
      if (cancelled) return;
      if (nRes.status === "fulfilled" && nRes.value.ok) {
        const items = unwrapNotificationList(nRes.value.data);
        setNotifCount(items.filter((n) => n.read === false).length);
      }
      if (mRes.status === "fulfilled" && mRes.value.ok && mRes.value.data) {
        const raw = mRes.value.data as Record<string, unknown>;
        setMsgCount(typeof raw.count === "number" ? raw.count : 0);
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const totalBadge = notifCount + msgCount;

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
          pageContext={palettePageContext}
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
              {tabs.map((tab) => {
                const badge =
                  tab.href === "/messages" && msgCount > 0
                    ? msgCount
                    : tab.href === "/notifications" && notifCount > 0
                      ? notifCount
                      : 0;
                return (
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
                    {badge > 0 && (
                      <span className="ml-1.5 inline-flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
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
            <Link
              href="/notifications"
              className="relative rounded-full p-2 text-foreground/60 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/50 dark:hover:text-brand-400"
              title="Notifications"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
              {totalBadge > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-neutral-900">
                  {totalBadge > 9 ? "9+" : totalBadge}
                </span>
              )}
            </Link>
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

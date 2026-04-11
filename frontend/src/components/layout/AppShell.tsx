"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

  const tabs =
    section === "admin"
      ? adminTabs
      : section === "student"
        ? studentTabs
        : teacherTabs;

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={section === "admin" ? "/admin" : section === "student" ? "/student" : "/teacher"}
              className="font-semibold text-neutral-900 dark:text-neutral-100"
            >
              Second Teacher
            </Link>
            <nav className="flex flex-wrap gap-1 text-sm">
              {tabs.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={
                    isActive(pathname, tab.href)
                      ? "rounded-md bg-neutral-100 px-2.5 py-1 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50"
                      : "rounded-md px-2.5 py-1 text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-900"
                  }
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
            {role && (
              <span className="rounded bg-neutral-100 px-2 py-0.5 capitalize dark:bg-neutral-800">
                {role}
              </span>
            )}
            {role === "student" && activeGroupId && (
              <span
                className="max-w-[10rem] truncate font-mono text-xs text-neutral-500"
                title={activeGroupId}
              >
                group {activeGroupId.slice(0, 8)}&hellip;
              </span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-neutral-800 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              Chiqish
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}

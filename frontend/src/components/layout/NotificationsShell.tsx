"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Picks AppShell nav section from current role so `/notifications` matches teacher/student/admin shells.
 */
export function NotificationsShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = useAuthStore((s) => s.role);
  const section =
    role === "admin" ? "admin" : role === "student" ? "student" : "teacher";

  return <AppShell section={section}>{children}</AppShell>;
}

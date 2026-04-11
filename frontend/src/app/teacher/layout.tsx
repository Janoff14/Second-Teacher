import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={["teacher"]}>
      <AppShell section="teacher">{children}</AppShell>
    </AuthGuard>
  );
}

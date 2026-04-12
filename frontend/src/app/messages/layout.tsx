import { AuthGuard } from "@/components/auth/AuthGuard";
import { NotificationsShell } from "@/components/layout/NotificationsShell";

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={["teacher", "student", "admin"]}>
      <NotificationsShell>{children}</NotificationsShell>
    </AuthGuard>
  );
}

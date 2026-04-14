/**
 * Group pages inherit AuthGuard and AppShell from `teacher/layout.tsx`.
 * This file exists only to mark the segment explicitly.
 */
export default function TeacherGroupSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

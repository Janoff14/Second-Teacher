"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthHydration } from "@/hooks/use-auth-hydration";
import type { UserRole } from "@/stores/auth-store";
import { useAuthStore } from "@/stores/auth-store";

type AuthGuardProps = {
  children: React.ReactNode;
  allowedRoles: UserRole[];
};

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router = useRouter();
  const hydrated = useAuthHydration();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) {
      const path =
        typeof window !== "undefined"
          ? encodeURIComponent(
              window.location.pathname + window.location.search,
            )
          : "";
      router.replace("/");
      return;
    }
    if (role && !allowedRoles.includes(role)) {
      router.replace("/");
    }
  }, [hydrated, accessToken, role, allowedRoles, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
      </div>
    );
  }

  if (!accessToken || (role && !allowedRoles.includes(role))) {
    return null;
  }

  return <>{children}</>;
}

"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";

/** Wait for persisted auth to rehydrate from sessionStorage (client-only). */
export function useAuthHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return unsub;
  }, []);

  return hydrated;
}

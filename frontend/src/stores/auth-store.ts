import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { decodeJwtSubject } from "@/lib/jwt";

export type UserRole = "teacher" | "student" | "admin";

type AuthState = {
  accessToken: string | null;
  role: UserRole | null;
  activeGroupId: string | null;
  /** From login `user.id` / `userId` or JWT; used for teacher group scoping. */
  userId: string | null;
  setSession: (payload: {
    accessToken: string;
    role: UserRole;
    /** Omit to keep previous group (e.g. re-login). Pass `null` to clear. */
    activeGroupId?: string | null;
    /** Omit to keep previous; pass `null` to clear. */
    userId?: string | null;
  }) => void;
  clearSession: () => void;
  setActiveGroupId: (groupId: string | null) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      role: null,
      activeGroupId: null,
      userId: null,
      setSession: ({ accessToken, role, activeGroupId, userId }) =>
        set((state) => ({
          accessToken,
          role,
          activeGroupId:
            activeGroupId !== undefined ? activeGroupId : state.activeGroupId,
          userId: userId !== undefined ? userId : state.userId,
        })),
      clearSession: () =>
        set({
          accessToken: null,
          role: null,
          activeGroupId: null,
          userId: null,
        }),
      setActiveGroupId: (activeGroupId) => set({ activeGroupId }),
    }),
    {
      name: "second-teacher-auth",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        role: state.role,
        activeGroupId: state.activeGroupId,
        userId: state.userId,
      }),
    },
  ),
);

/** For use outside React (e.g. `apiRequest`). */
export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

/** Login `user.id` yoki JWT `sub` — o‘qituvchi guruh filtri uchun. */
export function getResolvedUserId(): string | null {
  const { userId, accessToken, role } = useAuthStore.getState();
  if (userId) return userId;
  if (role === "teacher" && accessToken) return decodeJwtSubject(accessToken);
  return null;
}

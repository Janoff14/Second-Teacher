import { apiRequest } from "./client";
export type EnrollmentPreviewBody = {
  /** Join code entered by the student */
  code: string;
};

export type SignupWithJoinCodeBody = {
  joinCode: string;
  email: string;
  password: string;
  displayName?: string;
};

export async function previewEnrollment(body: EnrollmentPreviewBody) {
  return apiRequest<unknown>("/enrollment/preview", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export async function signupWithJoinCode(body: SignupWithJoinCodeBody) {
  return apiRequest<unknown>("/auth/signup-with-join-code", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export function parsePreviewInfo(data: unknown): {
  groupId: string;
  label?: string;
} | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const groupId =
    typeof d.groupId === "string"
      ? d.groupId
      : typeof d.group_id === "string"
        ? d.group_id
        : null;
  if (!groupId) return null;
  const label =
    typeof d.groupName === "string"
      ? d.groupName
      : typeof d.name === "string"
        ? d.name
        : typeof d.label === "string"
          ? d.label
          : undefined;
  return { groupId, label };
}

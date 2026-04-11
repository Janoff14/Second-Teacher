import { apiRequest } from "./client";

/** One multiple-choice item (aligned with plan: stem, options, correctKey). */
export type AssessmentItem = {
  /** Server-assigned when available; UI may fall back to index. */
  id?: string;
  stem: string;
  options: { key: string; label: string }[];
  correctKey: string;
};

export type DraftItemInput = {
  stem: string;
  options: { key: string; label: string }[];
  correctKey: string;
};

export type AssessmentDraft = {
  id: string;
  title?: string | null;
  groupId?: string | null;
  items?: AssessmentItem[];
};

export type PublishedAssessment = {
  id: string;
  title?: string | null;
  groupId: string;
  opensAt?: string | null;
  closesAt?: string | null;
  /** When present, same shape as draft items (server may omit correctKey for students). */
  items?: AssessmentItem[];
};

export type AttemptRecord = {
  id: string;
  publishedAssessmentId: string;
  submittedAt?: string;
  score?: number | null;
  answers?: Record<string, string>;
};

function asArray<T>(data: unknown): T[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.items)) return d.items as T[];
    if (Array.isArray(d.drafts)) return d.drafts as T[];
    if (Array.isArray(d.assessments)) return d.assessments as T[];
    if (Array.isArray(d.published)) return d.published as T[];
  }
  return [];
}

/** --- Draft lifecycle (J2.1) --- */

export async function createDraft(body: {
  title?: string;
  groupId?: string;
}) {
  return apiRequest<AssessmentDraft>("/assessments/drafts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listDrafts(groupId?: string) {
  const q = groupId
    ? `?${new URLSearchParams({ groupId }).toString()}`
    : "";
  return apiRequest<AssessmentDraft[]>(`/assessments/drafts${q}`, {
    method: "GET",
  });
}

export async function getDraft(draftId: string) {
  return apiRequest<AssessmentDraft>(`/assessments/drafts/${draftId}`, {
    method: "GET",
  });
}

export async function putDraftItems(
  draftId: string,
  items: DraftItemInput[] | AssessmentItem[],
) {
  return apiRequest<AssessmentDraft>(`/assessments/drafts/${draftId}/items`, {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}

/** --- Publish & list (J2.2) --- */

export async function publishDraft(
  draftId: string,
  body: {
    groupId: string;
    opensAt?: string | null;
    closesAt?: string | null;
  },
) {
  return apiRequest<PublishedAssessment>(
    `/assessments/drafts/${draftId}/publish`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function listPublishedAssessments(groupId: string) {
  const q = new URLSearchParams({ groupId });
  return apiRequest<PublishedAssessment[]>(
    `/assessments/published?${q.toString()}`,
    { method: "GET" },
  );
}

export async function getPublishedAssessment(publishedId: string) {
  return apiRequest<PublishedAssessment>(
    `/assessments/published/${publishedId}`,
    { method: "GET" },
  );
}

/** --- Student attempts (J2.3) --- */

export async function submitAttempt(
  publishedId: string,
  body: { answers: Record<string, string> },
) {
  return apiRequest<AttemptRecord>(
    `/assessments/published/${publishedId}/attempts`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function listMyAttempts(groupId: string) {
  const q = new URLSearchParams({ groupId });
  return apiRequest<AttemptRecord[]>(
    `/assessments/attempts/me?${q.toString()}`,
    { method: "GET" },
  );
}

/** Unwrap list from various envelope shapes. */
export function unwrapDraftList(data: unknown): AssessmentDraft[] {
  return asArray<AssessmentDraft>(data);
}

export function unwrapPublishedList(data: unknown): PublishedAssessment[] {
  return asArray<PublishedAssessment>(data);
}

export function unwrapAttemptList(data: unknown): AttemptRecord[] {
  return asArray<AttemptRecord>(data);
}

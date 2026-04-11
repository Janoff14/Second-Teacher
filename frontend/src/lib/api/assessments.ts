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
  windowOpensAtUtc?: string | null;
  windowClosesAtUtc?: string | null;
  windowTimezone?: string | null;
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

function normalizeOptions(
  raw: unknown,
): { key: string; label: string }[] {
  if (Array.isArray(raw)) {
    return raw.filter(
      (item): item is { key: string; label: string } =>
        typeof item === "object" &&
        item !== null &&
        "key" in item &&
        "label" in item,
    );
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, string>).map(([key, label]) => ({
      key,
      label,
    }));
  }
  return [];
}

function normalizeItem(raw: unknown): AssessmentItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const stem = typeof item.stem === "string" ? item.stem : "";
  const correctKey = typeof item.correctKey === "string" ? item.correctKey : "";
  if (!stem) return null;
  return {
    ...(typeof item.id === "string" ? { id: item.id } : {}),
    stem,
    options: normalizeOptions(item.options),
    correctKey,
  };
}

function normalizePublished(raw: unknown): PublishedAssessment | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.groupId !== "string") {
    return null;
  }
  return {
    id: item.id,
    groupId: item.groupId,
    ...(typeof item.title === "string" ? { title: item.title } : {}),
    ...(typeof item.windowOpensAtUtc === "string"
      ? { windowOpensAtUtc: item.windowOpensAtUtc }
      : {}),
    ...(typeof item.windowClosesAtUtc === "string"
      ? { windowClosesAtUtc: item.windowClosesAtUtc }
      : {}),
    ...(typeof item.windowTimezone === "string"
      ? { windowTimezone: item.windowTimezone }
      : {}),
    ...(Array.isArray(item.items)
      ? { items: item.items.map(normalizeItem).filter((entry): entry is AssessmentItem => Boolean(entry)) }
      : {}),
  };
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
    groupId?: string;
    opensAt?: string | null;
    closesAt?: string | null;
  },
) {
  return apiRequest<PublishedAssessment>(
    `/assessments/drafts/${draftId}/publish`,
    {
      method: "POST",
      body: JSON.stringify({
        ...(body.groupId ? { groupId: body.groupId } : {}),
        ...(body.opensAt ? { windowOpensAtUtc: body.opensAt } : {}),
        ...(body.closesAt ? { windowClosesAtUtc: body.closesAt } : {}),
        windowTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      }),
    },
  );
}

export async function listPublishedAssessments(groupId: string) {
  const q = new URLSearchParams({ groupId });
  const result = await apiRequest<unknown>(
    `/assessments/published?${q.toString()}`,
    { method: "GET" },
  );
  if (!result.ok) {
    return result;
  }
  return {
    ...result,
    data: unwrapPublishedList(result.data),
  };
}

export async function getPublishedAssessment(publishedId: string) {
  const result = await apiRequest<unknown>(
    `/assessments/published/${publishedId}`,
    { method: "GET" },
  );
  if (!result.ok) {
    return result;
  }
  return {
    ...result,
    data: normalizePublished(result.data) as PublishedAssessment,
  };
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
  return asArray<unknown>(data)
    .map(normalizePublished)
    .filter((entry): entry is PublishedAssessment => Boolean(entry));
}

export function unwrapAttemptList(data: unknown): AttemptRecord[] {
  return asArray<AttemptRecord>(data);
}

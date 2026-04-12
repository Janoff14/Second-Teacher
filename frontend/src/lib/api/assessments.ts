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

export type StudyRecommendation = {
  itemId: string;
  stem: string;
  selectedKey: string;
  correctKey: string;
  textbookSourceId?: string;
  textbookTitle?: string;
  chapterTitle?: string;
  pageNumber?: number;
  readerPath?: string;
  highlightText?: string;
  explanation?: string;
};

export type AttemptRecord = {
  id: string;
  publishedAssessmentId: string;
  submittedAt?: string;
  score?: number | null;
  answers?: Record<string, string>;
  studyRecommendations?: StudyRecommendation[];
};

export type TeacherAssessmentResultRow = {
  attemptId: string;
  studentId: string;
  studentName?: string | null;
  studentEmail?: string | null;
  submittedAt: string;
  totalScore: number;
  maxScore: number;
  scorePct: number;
};

export type TeacherAssessmentResultSummary = {
  id: string;
  title: string;
  type: "practice" | "quiz" | "test" | "exam" | "assessment";
  publishedAt: string;
  windowOpensAtUtc: string;
  windowClosesAtUtc: string;
  windowTimezone: string;
  itemCount: number;
  enrolledCount: number;
  attemptCount: number;
  averageScorePct?: number | null;
  highestScorePct?: number | null;
  latestSubmittedAt?: string | null;
  results: TeacherAssessmentResultRow[];
};

export type TeacherGroupResultsSummary = {
  groupId: string;
  enrolledCount: number;
  assessmentCount: number;
  totalAttemptCount: number;
  overallAverageScorePct?: number | null;
  assessments: TeacherAssessmentResultSummary[];
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
  const payload = items.map((item) => ({
    stem: item.stem,
    correctKey: item.correctKey,
    options: Array.isArray(item.options)
      ? Object.fromEntries(item.options.map((o) => [o.key, o.label]))
      : item.options,
  }));
  return apiRequest<AssessmentDraft>(`/assessments/drafts/${draftId}/items`, {
    method: "PUT",
    body: JSON.stringify({ items: payload }),
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

/** --- AI test generation (teacher) --- */

export type AiGenerateBody = {
  groupId: string;
  textbookSourceId: string;
  topics: string[];
  questionCount?: number;
  difficulty?: "easy" | "medium" | "hard";
  title?: string;
};

export type AiGenerateResult = {
  draft: AssessmentDraft;
  generation: {
    itemsGenerated: number;
    topicsUsed: string[];
    chunksRetrieved: number;
    textbookTitle: string;
  };
};

export type TextbookTopicsResult = {
  textbookSourceId: string;
  textbookTitle: string;
  topics: string[];
};

export async function aiGenerateTest(body: AiGenerateBody) {
  return apiRequest<AiGenerateResult>("/assessments/ai-generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getTextbookTopics(textbookSourceId: string, subjectId: string) {
  const q = new URLSearchParams({ textbookSourceId, subjectId });
  return apiRequest<TextbookTopicsResult>(
    `/assessments/textbook-topics?${q.toString()}`,
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

export async function getTeacherGroupResultsSummary(groupId: string) {
  return apiRequest<TeacherGroupResultsSummary>(`/groups/${groupId}/results-summary`, {
    method: "GET",
  });
}

export type RiskFactorEvidence = {
  code: string;
  message: string;
  severity: "info" | "warning" | "critical";
};

export type TeacherBriefingGroupPattern = {
  patternType: string;
  description: string;
  affectedStudentIds: string[];
  suggestedAction: string;
  versionId?: string;
};

export type TeacherBriefingStudent = {
  studentId: string;
  displayName: string | null;
  insightId: string;
  riskLevel: string;
  insightType: string;
  recentScores: number[];
  reasoning: string;
  suggestedActions: string[];
  factors: RiskFactorEvidence[];
  status: string;
};

export type TeacherBriefing = {
  attentionNeeded: number;
  students: TeacherBriefingStudent[];
  groupPatterns: TeacherBriefingGroupPattern[];
};

export async function getTeacherAiBriefing(groupId: string, enrich = false) {
  const q = enrich ? "?enrich=1" : "";
  return apiRequest<TeacherBriefing>(`/groups/${groupId}/ai-briefing${q}`, {
    method: "GET",
  });
}

export type StudentProfileAttempt = {
  attemptId: string;
  versionId: string;
  assessmentTitle: string;
  assessmentType: string;
  submittedAt: string;
  totalScore: number;
  maxScore: number;
  scorePct: number;
};

export type StudentProfileAssessment = {
  versionId: string;
  title: string;
  type: string;
  itemCount: number;
  classAveragePct: number | null;
  bestScorePct: number | null;
  latestScorePct: number | null;
  studentAttempts: Array<{
    attemptId: string;
    submittedAt: string;
    totalScore: number;
    maxScore: number;
    scorePct: number;
  }>;
};

export type StudentProfile = {
  studentId: string;
  displayName: string | null;
  email: string | null;
  riskLevel: string;
  riskConfidence: number;
  riskFactors: RiskFactorEvidence[];
  features: {
    attemptCount: number;
    attemptsLast14Days: number;
    daysSinceLastAttempt: number | null;
    recentAvgRatio: number | null;
    priorAvgRatio: number | null;
    trendDelta: number | null;
    trendLabel: string;
    lowScoreCountInLast5: number;
    classAvgRatioSample: number | null;
    baselineDeviation: number | null;
  };
  totalAttempts: number;
  overallAveragePct: number | null;
  attempts: StudentProfileAttempt[];
  perAssessment: StudentProfileAssessment[];
  insights: Array<{
    id: string;
    title: string;
    body: string;
    riskLevel: string;
    factors: RiskFactorEvidence[];
    status: string;
    updatedAt: string;
  }>;
};

export async function getStudentProfile(groupId: string, studentId: string) {
  return apiRequest<StudentProfile>(
    `/groups/${groupId}/students/${studentId}/profile`,
    { method: "GET" },
  );
}

export type TeacherPercentileAxis =
  | "quizAvg"
  | "testAvg"
  | "accuracy"
  | "consistency"
  | "completion"
  | "improvement"
  | "engagement"
  | "bestScore";

export type TeacherPercentileProfile = {
  studentId: string;
  groupId: string;
  groupSize: number;
  axes: Record<TeacherPercentileAxis, { percentile: number; rawValue: number | null }>;
  minutesPlayed: number;
};

export async function getStudentPercentileProfile(groupId: string, studentId: string) {
  return apiRequest<TeacherPercentileProfile>(
    `/groups/${groupId}/students/${studentId}/percentile-profile`,
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

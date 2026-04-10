export interface DraftItem {
  id: string;
  stem: string;
  options: Record<string, string>;
  correctKey: string;
}

export interface AssessmentDraft {
  id: string;
  groupId: string;
  title: string;
  items: DraftItem[];
  createdBy: string;
  updatedAt: string;
}

export interface PublishedItem {
  id: string;
  stem: string;
  options: Record<string, string>;
  correctKey: string;
}

export interface AssessmentVersion {
  id: string;
  draftId: string;
  groupId: string;
  versionNumber: number;
  title: string;
  items: PublishedItem[];
  publishedAt: string;
  publishedBy: string;
  windowOpensAtUtc: string;
  windowClosesAtUtc: string;
  windowTimezone: string;
}

export interface AttemptItemResult {
  itemId: string;
  selectedKey: string;
  correct: boolean;
  points: number;
}

export interface AttemptRecord {
  id: string;
  assessmentVersionId: string;
  studentId: string;
  submittedAt: string;
  itemResults: AttemptItemResult[];
  totalScore: number;
  maxScore: number;
}

const draftsById = new Map<string, AssessmentDraft>();
const versionsById = new Map<string, AssessmentVersion>();
const versionIdsByGroup = new Map<string, string[]>();
const attemptsByVersion = new Map<string, AttemptRecord[]>();

let draftCounter = 1;
let versionCounter = 1;
let publishedItemCounter = 1;
let attemptCounter = 1;

function throwHttp(status: number, code: string, message: string): never {
  const err = new Error(message) as Error & { statusCode?: number; code?: string };
  err.statusCode = status;
  err.code = code;
  throw err;
}

export function createDraft(groupId: string, title: string, createdBy: string): AssessmentDraft {
  const now = new Date().toISOString();
  const draft: AssessmentDraft = {
    id: `drf_${draftCounter++}`,
    groupId,
    title,
    items: [],
    createdBy,
    updatedAt: now,
  };
  draftsById.set(draft.id, draft);
  return draft;
}

export function getDraft(draftId: string): AssessmentDraft | undefined {
  return draftsById.get(draftId);
}

export function setDraftItems(
  draftId: string,
  items: Array<{ stem: string; options: Record<string, string>; correctKey: string }>,
): AssessmentDraft {
  const draft = draftsById.get(draftId);
  if (!draft) {
    throwHttp(404, "DRAFT_NOT_FOUND", "Draft not found");
  }
  let itemCounter = 1;
  draft.items = items.map((raw) => {
    if (!raw.options[raw.correctKey]) {
      throwHttp(400, "INVALID_ITEM", "correctKey must exist in options");
    }
    return {
      id: `ditem_${draftId}_${itemCounter++}`,
      stem: raw.stem,
      options: raw.options,
      correctKey: raw.correctKey,
    };
  });
  draft.updatedAt = new Date().toISOString();
  return draft;
}

export function publishDraft(
  draftId: string,
  publishedBy: string,
  schedule: { windowOpensAtUtc: string; windowClosesAtUtc: string; windowTimezone: string },
): AssessmentVersion {
  const draft = draftsById.get(draftId);
  if (!draft) {
    throwHttp(404, "DRAFT_NOT_FOUND", "Draft not found");
  }
  if (draft.items.length === 0) {
    throwHttp(400, "EMPTY_DRAFT", "Cannot publish draft without items");
  }

  const opens = Date.parse(schedule.windowOpensAtUtc);
  const closes = Date.parse(schedule.windowClosesAtUtc);
  if (Number.isNaN(opens) || Number.isNaN(closes)) {
    throwHttp(400, "INVALID_SCHEDULE", "Invalid ISO datetime for schedule window");
  }
  if (closes <= opens) {
    throwHttp(400, "INVALID_SCHEDULE", "windowClosesAtUtc must be after windowOpensAtUtc");
  }

  const existing = versionIdsByGroup.get(draft.groupId) ?? [];
  const versionNumber = existing.length + 1;

  const publishedItems: PublishedItem[] = draft.items.map((d) => ({
    id: `pitm_${publishedItemCounter++}`,
    stem: d.stem,
    options: { ...d.options },
    correctKey: d.correctKey,
  }));

  const version: AssessmentVersion = {
    id: `asv_${versionCounter++}`,
    draftId: draft.id,
    groupId: draft.groupId,
    versionNumber,
    title: draft.title,
    items: publishedItems,
    publishedAt: new Date().toISOString(),
    publishedBy,
    windowOpensAtUtc: schedule.windowOpensAtUtc,
    windowClosesAtUtc: schedule.windowClosesAtUtc,
    windowTimezone: schedule.windowTimezone,
  };

  versionsById.set(version.id, version);
  existing.push(version.id);
  versionIdsByGroup.set(draft.groupId, existing);
  return version;
}

export function getVersion(versionId: string): AssessmentVersion | undefined {
  return versionsById.get(versionId);
}

export function listPublishedVersionsForGroup(groupId: string): AssessmentVersion[] {
  const ids = versionIdsByGroup.get(groupId) ?? [];
  return ids.map((id) => versionsById.get(id)).filter((v): v is AssessmentVersion => Boolean(v));
}

export function isScheduleOpen(version: AssessmentVersion, nowUtcMs: number = Date.now()): boolean {
  const opens = Date.parse(version.windowOpensAtUtc);
  const closes = Date.parse(version.windowClosesAtUtc);
  return nowUtcMs >= opens && nowUtcMs <= closes;
}

export type StudentAssessmentVersionView = {
  id: string;
  groupId: string;
  versionNumber: number;
  title: string;
  items: Array<{ id: string; stem: string; options: Record<string, string> }>;
  publishedAt: string;
  windowOpensAtUtc: string;
  windowClosesAtUtc: string;
  windowTimezone: string;
};

export function toStudentVersionView(version: AssessmentVersion): StudentAssessmentVersionView {
  return {
    id: version.id,
    groupId: version.groupId,
    versionNumber: version.versionNumber,
    title: version.title,
    items: version.items.map(({ id, stem, options }) => ({ id, stem, options })),
    publishedAt: version.publishedAt,
    windowOpensAtUtc: version.windowOpensAtUtc,
    windowClosesAtUtc: version.windowClosesAtUtc,
    windowTimezone: version.windowTimezone,
  };
}

export function submitAttempt(
  versionId: string,
  studentId: string,
  answers: Record<string, string>,
): AttemptRecord {
  const version = versionsById.get(versionId);
  if (!version) {
    throwHttp(404, "VERSION_NOT_FOUND", "Published assessment not found");
  }

  if (!isScheduleOpen(version)) {
    throwHttp(403, "SCHEDULE_CLOSED", "Assessment is not available for submission at this time");
  }

  const itemResults: AttemptItemResult[] = version.items.map((item) => {
    const selectedKey = answers[item.id];
    if (!selectedKey) {
      throwHttp(400, "MISSING_ANSWER", `Missing answer for item ${item.id}`);
    }
    if (!item.options[selectedKey]) {
      throwHttp(400, "INVALID_ANSWER", `Invalid option for item ${item.id}`);
    }
    const correct = selectedKey === item.correctKey;
    return {
      itemId: item.id,
      selectedKey,
      correct,
      points: correct ? 1 : 0,
    };
  });

  const totalScore = itemResults.reduce((s, r) => s + r.points, 0);
  const maxScore = version.items.length;

  const attempt: AttemptRecord = {
    id: `att_${attemptCounter++}`,
    assessmentVersionId: versionId,
    studentId,
    submittedAt: new Date().toISOString(),
    itemResults,
    totalScore,
    maxScore,
  };

  const list = attemptsByVersion.get(versionId) ?? [];
  list.push(attempt);
  attemptsByVersion.set(versionId, list);
  return attempt;
}

export function listAttemptsForStudent(versionId: string, studentId: string): AttemptRecord[] {
  const list = attemptsByVersion.get(versionId) ?? [];
  return list.filter((a) => a.studentId === studentId);
}

export function listAttemptsForVersion(versionId: string): AttemptRecord[] {
  return [...(attemptsByVersion.get(versionId) ?? [])];
}

export function listStudentAttemptsInGroup(
  studentId: string,
  groupId: string,
): Array<{ versionId: string; attempt: AttemptRecord }> {
  const versions = listPublishedVersionsForGroup(groupId);
  const result: Array<{ versionId: string; attempt: AttemptRecord }> = [];
  for (const v of versions) {
    for (const attempt of listAttemptsForStudent(v.id, studentId)) {
      result.push({ versionId: v.id, attempt });
    }
  }
  return result.sort(
    (a, b) => new Date(a.attempt.submittedAt).getTime() - new Date(b.attempt.submittedAt).getTime(),
  );
}

export function resetAssessmentStoreForTest(): void {
  draftsById.clear();
  versionsById.clear();
  versionIdsByGroup.clear();
  attemptsByVersion.clear();
  draftCounter = 1;
  versionCounter = 1;
  publishedItemCounter = 1;
  attemptCounter = 1;
}

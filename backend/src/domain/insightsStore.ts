import {
  canTeacherManageGroup,
  listEnrollmentsForGroup,
  listTeacherUserIdsForGroup,
} from "./academicStore";
import { listAttemptsForVersion, listStudentAttemptsInGroup } from "./assessmentStore";

export type RiskLevel = "stable" | "watchlist" | "at_risk";

export type InsightStatus = "open" | "acknowledged" | "dismissed";

export type InsightAudience = "teacher" | "student";

export interface RiskFeatureSnapshot {
  studentId: string;
  groupId: string;
  computedAt: string;
  sourceAttemptIds: string[];
  features: {
    attemptCount: number;
    attemptsLast14Days: number;
    daysSinceLastAttempt: number | null;
    recentAvgRatio: number | null;
    priorAvgRatio: number | null;
    trendDelta: number | null;
    trendLabel: "improving" | "flat" | "declining" | "insufficient_data";
    lowScoreCountInLast5: number;
    classAvgRatioSample: number | null;
    baselineDeviation: number | null;
  };
}

export interface RiskFactorEvidence {
  code: string;
  message: string;
  severity: "info" | "warning" | "critical";
}

export interface RiskClassification {
  level: RiskLevel;
  confidence: number;
  reasons: RiskFactorEvidence[];
}

export interface InsightRecord {
  id: string;
  studentId: string;
  groupId: string;
  audience: InsightAudience;
  type: string;
  priority: number;
  title: string;
  body: string;
  status: InsightStatus;
  riskLevel: RiskLevel;
  factors: RiskFactorEvidence[];
  dedupKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProactiveNotification {
  id: string;
  targetUserId: string;
  studentId: string;
  groupId: string;
  insightId: string;
  riskLevel: RiskLevel;
  dedupKey: string;
  createdAt: string;
}

const insights: InsightRecord[] = [];
const notifications: ProactiveNotification[] = [];
let insightCounter = 1;
let notificationCounter = 1;
const notificationDedupKeys = new Set<string>();

function ratio(attempt: { totalScore: number; maxScore: number }): number {
  if (attempt.maxScore <= 0) {
    return 0;
  }
  return attempt.totalScore / attempt.maxScore;
}

function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function classAvgForVersions(versionIds: string[]): number | null {
  const perVersion: number[] = [];
  for (const vid of versionIds) {
    const attempts = listAttemptsForVersion(vid);
    if (attempts.length === 0) {
      continue;
    }
    const ratios = attempts.map((a) => ratio(a));
    perVersion.push(mean(ratios)!);
  }
  return mean(perVersion);
}

export function computeRiskFeatureSnapshot(studentId: string, groupId: string): RiskFeatureSnapshot {
  const rows = listStudentAttemptsInGroup(studentId, groupId);
  const now = Date.now();
  const attemptCount = rows.length;
  const ratiosChrono = rows.map((r) => ratio(r.attempt));
  const last5 = ratiosChrono.slice(-5);
  const prior5 = ratiosChrono.length > 5 ? ratiosChrono.slice(-10, -5) : [];

  const recentAvgRatio = last5.length > 0 ? mean(last5) : null;
  const priorAvgRatio = prior5.length > 0 ? mean(prior5) : null;

  let trendDelta: number | null = null;
  let trendLabel: RiskFeatureSnapshot["features"]["trendLabel"] = "insufficient_data";
  if (recentAvgRatio !== null && priorAvgRatio !== null) {
    trendDelta = recentAvgRatio - priorAvgRatio;
    if (Math.abs(trendDelta) < 0.05) {
      trendLabel = "flat";
    } else {
      trendLabel = trendDelta > 0 ? "improving" : "declining";
    }
  } else if (recentAvgRatio !== null && attemptCount >= 2) {
    trendLabel = "flat";
  }

  const lastAttemptAt =
    rows.length > 0 ? new Date(rows[rows.length - 1]!.attempt.submittedAt).getTime() : null;
  const daysSinceLastAttempt =
    lastAttemptAt !== null ? Math.floor((now - lastAttemptAt) / (24 * 60 * 60 * 1000)) : null;

  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
  const attemptsLast14Days = rows.filter(
    (r) => new Date(r.attempt.submittedAt).getTime() >= fourteenDaysAgo,
  ).length;

  let lowScoreCountInLast5 = 0;
  for (const r of last5) {
    if (r < 0.6) {
      lowScoreCountInLast5 += 1;
    }
  }

  const versionIds = [...new Set(rows.map((r) => r.versionId))];
  const classAvgRatioSample = classAvgForVersions(versionIds);
  let baselineDeviation: number | null = null;
  if (recentAvgRatio !== null && classAvgRatioSample !== null) {
    baselineDeviation = recentAvgRatio - classAvgRatioSample;
  }

  const sourceAttemptIds = rows.slice(-10).map((r) => r.attempt.id);

  return {
    studentId,
    groupId,
    computedAt: new Date().toISOString(),
    sourceAttemptIds,
    features: {
      attemptCount,
      attemptsLast14Days,
      daysSinceLastAttempt,
      recentAvgRatio,
      priorAvgRatio,
      trendDelta,
      trendLabel,
      lowScoreCountInLast5,
      classAvgRatioSample,
      baselineDeviation,
    },
  };
}

export function classifyRiskFromSnapshot(snapshot: RiskFeatureSnapshot): RiskClassification {
  const { features: f } = snapshot;
  const reasons: RiskFactorEvidence[] = [];

  if (f.attemptCount < 2) {
    reasons.push({
      code: "INSUFFICIENT_DATA",
      message: "Need at least two scored attempts in this group to classify risk reliably.",
      severity: "info",
    });
    return { level: "stable", confidence: 0.35, reasons };
  }

  const recent = f.recentAvgRatio;
  const declining = f.trendLabel === "declining";
  const inactive =
    f.daysSinceLastAttempt !== null && f.daysSinceLastAttempt > 14 && f.attemptCount >= 2;

  if (f.baselineDeviation !== null && f.baselineDeviation <= -0.2) {
    reasons.push({
      code: "BELOW_CLASS_BASELINE",
      message: `Recent performance is roughly ${Math.round(Math.abs(f.baselineDeviation) * 100)} points below the class average on shared assessments.`,
      severity: "warning",
    });
  }

  if (recent !== null && recent < 0.5) {
    reasons.push({
      code: "LOW_RECENT_SCORE",
      message: `Average score on the last attempts is ${Math.round(recent * 100)}%.`,
      severity: "critical",
    });
  }

  if (f.lowScoreCountInLast5 >= 3) {
    reasons.push({
      code: "REPEATED_LOW_SCORES",
      message: "Multiple recent attempts scored below 60%.",
      severity: "critical",
    });
  }

  if (declining && recent !== null && recent < 0.65) {
    reasons.push({
      code: "DECLINING_PERFORMANCE",
      message: "Performance trend is declining while recent scores are under 65%.",
      severity: "critical",
    });
  } else if (declining) {
    reasons.push({
      code: "DECLINING_TREND",
      message: "Recent attempts are trending down versus earlier work in this group.",
      severity: "warning",
    });
  }

  if (inactive) {
    reasons.push({
      code: "RECENT_INACTIVITY",
      message: "No attempts in this group for over 14 days despite prior activity.",
      severity: "warning",
    });
  }

  if (recent !== null && recent < 0.65 && !reasons.some((r) => r.code === "LOW_RECENT_SCORE")) {
    reasons.push({
      code: "MODERATE_RECENT_SCORE",
      message: `Recent average is ${Math.round(recent * 100)}% (watch band).`,
      severity: "warning",
    });
  }

  let level: RiskLevel = "stable";
  if (
    (recent !== null && recent < 0.5) ||
    f.lowScoreCountInLast5 >= 3 ||
    (declining && recent !== null && recent < 0.65)
  ) {
    level = "at_risk";
  } else if ((recent !== null && recent < 0.65) || declining || inactive) {
    level = "watchlist";
  }

  const confidence = Math.min(0.95, 0.45 + 0.08 * Math.min(f.attemptCount, 8));

  if (level === "stable" && reasons.length === 0) {
    reasons.push({
      code: "STABLE",
      message: "No risk factors triggered for this group based on recent attempts.",
      severity: "info",
    });
  }

  return { level, confidence, reasons };
}

function insightDedupKey(studentId: string, groupId: string, audience: InsightAudience): string {
  return `risk_state:${studentId}:${groupId}:${audience}`;
}

function priorityForLevel(level: RiskLevel): number {
  if (level === "at_risk") {
    return 30;
  }
  if (level === "watchlist") {
    return 15;
  }
  return 3;
}

function upsertInsight(
  studentId: string,
  groupId: string,
  audience: InsightAudience,
  classification: RiskClassification,
  snapshot: RiskFeatureSnapshot,
): InsightRecord {
  const dedupKey = insightDedupKey(studentId, groupId, audience);
  const existing = insights.find((i) => i.dedupKey === dedupKey);
  const now = new Date().toISOString();
  const title =
    audience === "teacher"
      ? `Student risk: ${classification.level.replace("_", " ")}`
      : `Your learning status: ${classification.level.replace("_", " ")}`;
  const body =
    audience === "teacher"
      ? `Latest analytics for this enrollment. Attempts considered: ${snapshot.features.attemptCount}.`
      : `We reviewed your recent work in this class. Attempts considered: ${snapshot.features.attemptCount}.`;

  if (existing) {
    existing.riskLevel = classification.level;
    existing.priority = priorityForLevel(classification.level);
    existing.title = title;
    existing.body = body;
    existing.factors = classification.reasons;
    if (
      existing.status === "dismissed" &&
      (classification.level === "watchlist" || classification.level === "at_risk")
    ) {
      existing.status = "open";
    }
    existing.updatedAt = now;
    return existing;
  }

  const record: InsightRecord = {
    id: `ins_${insightCounter++}`,
    studentId,
    groupId,
    audience,
    type: "risk_state",
    priority: priorityForLevel(classification.level),
    title,
    body,
    status: "open",
    riskLevel: classification.level,
    factors: classification.reasons,
    dedupKey,
    createdAt: now,
    updatedAt: now,
  };
  insights.push(record);
  return record;
}

function utcDayBucket(): string {
  return new Date().toISOString().slice(0, 10);
}

function emitNotificationIfNew(
  targetUserId: string,
  studentId: string,
  groupId: string,
  insightId: string,
  level: RiskLevel,
): void {
  if (level !== "watchlist" && level !== "at_risk") {
    return;
  }
  const dedupKey = `${utcDayBucket()}:notify:${targetUserId}:${groupId}:${studentId}:${level}`;
  if (notificationDedupKeys.has(dedupKey)) {
    return;
  }
  notificationDedupKeys.add(dedupKey);
  notifications.push({
    id: `ntf_${notificationCounter++}`,
    targetUserId,
    studentId,
    groupId,
    insightId,
    riskLevel: level,
    dedupKey,
    createdAt: new Date().toISOString(),
  });
}

export function refreshInsightsAfterAttempt(studentId: string, groupId: string): {
  snapshot: RiskFeatureSnapshot;
  classification: RiskClassification;
} {
  const snapshot = computeRiskFeatureSnapshot(studentId, groupId);
  const classification = classifyRiskFromSnapshot(snapshot);

  const teacherInsight = upsertInsight(studentId, groupId, "teacher", classification, snapshot);
  const studentInsight = upsertInsight(studentId, groupId, "student", classification, snapshot);

  if (classification.level === "watchlist" || classification.level === "at_risk") {
    emitNotificationIfNew(studentId, studentId, groupId, studentInsight.id, classification.level);
    for (const teacherId of listTeacherUserIdsForGroup(groupId)) {
      emitNotificationIfNew(teacherId, studentId, groupId, teacherInsight.id, classification.level);
    }
  }

  return { snapshot, classification };
}

export function listInsightsForTeacher(
  groupId: string,
  filters: { status?: InsightStatus | "all"; minRisk?: RiskLevel },
): InsightRecord[] {
  let rows = insights.filter((i) => i.groupId === groupId && i.audience === "teacher");
  if (filters.status && filters.status !== "all") {
    rows = rows.filter((i) => i.status === filters.status);
  } else {
    rows = rows.filter((i) => i.status !== "dismissed");
  }
  if (filters.minRisk === "watchlist") {
    rows = rows.filter((i) => i.riskLevel === "watchlist" || i.riskLevel === "at_risk");
  } else if (filters.minRisk === "at_risk") {
    rows = rows.filter((i) => i.riskLevel === "at_risk");
  }
  return rows.sort((a, b) => b.priority - a.priority || b.updatedAt.localeCompare(a.updatedAt));
}

export function listInsightsForStudent(studentId: string, groupId: string): InsightRecord[] {
  return insights
    .filter((i) => i.groupId === groupId && i.studentId === studentId && i.audience === "student")
    .filter((i) => i.status !== "dismissed")
    .sort((a, b) => b.priority - a.priority || b.updatedAt.localeCompare(a.updatedAt));
}

export function setInsightStatus(
  insightId: string,
  status: InsightStatus,
  actorUserId: string,
  actorRole: string,
): InsightRecord {
  const insight = insights.find((i) => i.id === insightId);
  if (!insight) {
    const err = new Error("Insight not found") as Error & { statusCode?: number; code?: string };
    err.statusCode = 404;
    err.code = "INSIGHT_NOT_FOUND";
    throw err;
  }

  if (insight.audience === "student") {
    if (actorRole !== "student" || insight.studentId !== actorUserId) {
      const err = new Error("Forbidden") as Error & { statusCode?: number; code?: string };
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
  } else {
    if (
      actorRole !== "admin" &&
      !(actorRole === "teacher" && canTeacherManageGroup(actorUserId, actorRole, insight.groupId))
    ) {
      const err = new Error("Forbidden") as Error & { statusCode?: number; code?: string };
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
  }

  if (status !== "acknowledged" && status !== "dismissed" && status !== "open") {
    const err = new Error("Invalid status") as Error & { statusCode?: number; code?: string };
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  insight.status = status;
  insight.updatedAt = new Date().toISOString();
  return insight;
}

export function listNotificationsForUser(userId: string, limit = 50): ProactiveNotification[] {
  return notifications
    .filter((n) => n.targetUserId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function recomputeGroupInsightsForAllStudents(groupId: string): void {
  for (const e of listEnrollmentsForGroup(groupId)) {
    refreshInsightsAfterAttempt(e.studentId, groupId);
  }
}

export function resetInsightsStoreForTest(): void {
  insights.length = 0;
  notifications.length = 0;
  notificationDedupKeys.clear();
  insightCounter = 1;
  notificationCounter = 1;
}

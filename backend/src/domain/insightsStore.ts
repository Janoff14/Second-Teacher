import {
  canTeacherManageGroup,
  listEnrollmentsForGroup,
  listTeacherUserIdsForGroup,
} from "./academicStore";
import { listAttemptsForVersion, listPublishedVersionsForGroup, listStudentAttemptsInGroup } from "./assessmentStore";

export type RiskLevel = "stable" | "watchlist" | "at_risk";

/** Teacher-facing insight badge; low_load is only used for `type: "low_load"` insights. */
export type InsightRiskLevel = RiskLevel | "low_load";

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
  riskLevel: InsightRiskLevel;
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

/**
 * Risk classification rules (deterministic, no LLM):
 *
 * AT_RISK — immediate teacher attention needed. ANY of:
 *   1. Recent average score < 50%
 *   2. 3+ of last 5 attempts scored below 60%
 *   3. Scores declining AND recent average < 65%
 *   4. Inactive 14+ days AND last known average was under 60%
 *
 * WATCHLIST — monitor closely. ANY of:
 *   1. Recent average 50-65%
 *   2. Scores declining (even if currently passing)
 *   3. Inactive 14+ days with prior activity (regardless of score)
 *   4. Low engagement: very few attempts despite available assessments
 *
 * STABLE — on track. None of the above triggered, OR:
 *   - Student is improving (trend is up)
 *   - Student is a high performer (recent avg > 80%)
 */
export function classifyRiskFromSnapshot(snapshot: RiskFeatureSnapshot): RiskClassification {
  const { features: f } = snapshot;
  const reasons: RiskFactorEvidence[] = [];

  if (f.attemptCount < 2) {
    reasons.push({
      code: "INSUFFICIENT_DATA",
      message: "Fewer than 2 attempts — not enough data to assess risk yet.",
      severity: "info",
    });
    return { level: "stable", confidence: 0.35, reasons };
  }

  const recent = f.recentAvgRatio;
  const declining = f.trendLabel === "declining";
  const improving = f.trendLabel === "improving";
  const inactive =
    f.daysSinceLastAttempt !== null && f.daysSinceLastAttempt > 14 && f.attemptCount >= 2;

  // --- Collect evidence factors ---

  if (f.baselineDeviation !== null && f.baselineDeviation <= -0.2) {
    reasons.push({
      code: "BELOW_CLASS_BASELINE",
      message: `Scoring ~${Math.round(Math.abs(f.baselineDeviation) * 100)} points below the class average.`,
      severity: "warning",
    });
  }

  if (recent !== null && recent < 0.5) {
    reasons.push({
      code: "LOW_RECENT_SCORE",
      message: `Recent average is ${Math.round(recent * 100)}% — below the 50% threshold.`,
      severity: "critical",
    });
  } else if (recent !== null && recent < 0.65) {
    reasons.push({
      code: "MODERATE_RECENT_SCORE",
      message: `Recent average is ${Math.round(recent * 100)}% — in the 50-65% warning zone.`,
      severity: "warning",
    });
  }

  if (f.lowScoreCountInLast5 >= 3) {
    reasons.push({
      code: "REPEATED_LOW_SCORES",
      message: `${f.lowScoreCountInLast5} of the last 5 attempts scored below 60%.`,
      severity: "critical",
    });
  }

  if (declining && recent !== null && recent < 0.65) {
    reasons.push({
      code: "DECLINING_PERFORMANCE",
      message: "Scores are dropping and currently below 65%.",
      severity: "critical",
    });
  } else if (declining) {
    reasons.push({
      code: "DECLINING_TREND",
      message: "Scores are trending downward compared to earlier work.",
      severity: "warning",
    });
  }

  if (inactive) {
    reasons.push({
      code: "RECENT_INACTIVITY",
      message: `No activity for ${f.daysSinceLastAttempt} days despite prior engagement.`,
      severity: recent !== null && recent < 0.6 ? "critical" : "warning",
    });
  }

  if (improving && recent !== null && recent >= 0.5) {
    reasons.push({
      code: "IMPROVING_TREND",
      message: `Scores are improving — recent average is ${Math.round(recent * 100)}%.`,
      severity: "info",
    });
  }

  if (recent !== null && recent >= 0.8) {
    reasons.push({
      code: "HIGH_PERFORMER",
      message: `Consistently strong — recent average is ${Math.round(recent * 100)}%.`,
      severity: "info",
    });
  }

  // --- Classification decision ---
  let level: RiskLevel = "stable";

  const atRisk =
    (recent !== null && recent < 0.5) ||
    f.lowScoreCountInLast5 >= 3 ||
    (declining && recent !== null && recent < 0.65) ||
    (inactive && recent !== null && recent < 0.6);

  const watchlist =
    (recent !== null && recent >= 0.5 && recent < 0.65) ||
    declining ||
    inactive;

  if (atRisk) {
    level = "at_risk";
  } else if (watchlist) {
    level = "watchlist";
  }

  const confidence = Math.min(0.95, 0.45 + 0.08 * Math.min(f.attemptCount, 8));

  if (level === "stable" && !reasons.some((r) => r.severity !== "info")) {
    if (reasons.length === 0) {
      reasons.push({
        code: "ON_TRACK",
        message: "Performance is on track — no concerns detected.",
        severity: "info",
      });
    }
  }

  return { level, confidence, reasons };
}

export interface LowLoadClassification {
  active: boolean;
  factors: RiskFactorEvidence[];
}

/**
 * High performers / low instructional load — only meaningful when primary risk is stable.
 */
export function classifyLowLoadFromSnapshot(
  snapshot: RiskFeatureSnapshot,
  publishedAssessmentCount: number,
): LowLoadClassification {
  const { features: f } = snapshot;
  const factors: RiskFactorEvidence[] = [];
  if (f.attemptCount < 2 || f.recentAvgRatio === null) {
    return { active: false, factors: [] };
  }
  const recent = f.recentAvgRatio;
  if (recent <= 0.85) {
    return { active: false, factors: [] };
  }

  let strongBaseline = false;
  if (f.baselineDeviation !== null && f.baselineDeviation >= 0.2) {
    strongBaseline = true;
    factors.push({
      code: "ABOVE_CLASS_BASELINE",
      message: `Scoring ~${Math.round(f.baselineDeviation * 100)} points above the class average on recent work.`,
      severity: "info",
    });
  }

  let underParticipated = false;
  if (publishedAssessmentCount >= 2) {
    const expected = Math.max(1, Math.ceil(publishedAssessmentCount * 0.5));
    if (f.attemptCount < expected && recent > 0.8) {
      underParticipated = true;
      factors.push({
        code: "CAPACITY_FOR_MORE",
        message: `Fewer attempts (${f.attemptCount}) than many classmates given ${publishedAssessmentCount} published assessments — may have unused capacity.`,
        severity: "info",
      });
    }
  }

  const fastStrong =
    recent > 0.85 &&
    f.attemptsLast14Days >= 2 &&
    f.lowScoreCountInLast5 === 0 &&
    (f.trendLabel === "improving" || f.trendLabel === "flat");

  if (fastStrong && !strongBaseline && !underParticipated) {
    factors.push({
      code: "HIGH_RECENT_PERFORMANCE",
      message: `Recent average is ${Math.round(recent * 100)}% with no low scores in the last five attempts.`,
      severity: "info",
    });
  }

  const active =
    recent > 0.85 && (strongBaseline || underParticipated || (fastStrong && factors.length > 0));

  if (active && factors.length === 0) {
    factors.push({
      code: "HIGH_RECENT_PERFORMANCE",
      message: `Recent average is ${Math.round(recent * 100)}% — consider additional challenge.`,
      severity: "info",
    });
  }

  return { active, factors };
}

function lowLoadDedupKey(studentId: string, groupId: string, audience: InsightAudience): string {
  return `low_load:${studentId}:${groupId}:${audience}`;
}

function removeLowLoadInsightsForStudent(studentId: string, groupId: string): void {
  for (let i = insights.length - 1; i >= 0; i--) {
    const ins = insights[i]!;
    if (ins.type === "low_load" && ins.studentId === studentId && ins.groupId === groupId) {
      insights.splice(i, 1);
    }
  }
}

function upsertLowLoadInsight(
  studentId: string,
  groupId: string,
  audience: InsightAudience,
  factors: RiskFactorEvidence[],
): InsightRecord {
  const dedupKey = lowLoadDedupKey(studentId, groupId, audience);
  const existing = insights.find((i) => i.dedupKey === dedupKey);
  const now = new Date().toISOString();
  const title =
    audience === "teacher"
      ? "Student load: ready for more challenge"
      : "You may be ready for extra stretch";
  const body =
    audience === "teacher"
      ? "Performance suggests capacity for extension work or leadership roles."
      : "Your recent results are strong — consider optional challenges or helping peers.";

  if (existing) {
    existing.factors = factors;
    existing.title = title;
    existing.body = body;
    existing.priority = 10;
    existing.riskLevel = "low_load";
    if (existing.status === "dismissed") {
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
    type: "low_load",
    priority: 10,
    title,
    body,
    status: "open",
    riskLevel: "low_load",
    factors,
    dedupKey,
    createdAt: now,
    updatedAt: now,
  };
  insights.push(record);
  return record;
}

function syncLowLoadInsights(
  studentId: string,
  groupId: string,
  riskLevel: RiskLevel,
  snapshot: RiskFeatureSnapshot,
): void {
  const publishedAssessmentCount = listPublishedVersionsForGroup(groupId).length;
  if (riskLevel !== "stable") {
    removeLowLoadInsightsForStudent(studentId, groupId);
    return;
  }
  const low = classifyLowLoadFromSnapshot(snapshot, publishedAssessmentCount);
  if (low.active) {
    upsertLowLoadInsight(studentId, groupId, "teacher", low.factors);
    upsertLowLoadInsight(studentId, groupId, "student", low.factors);
  } else {
    removeLowLoadInsightsForStudent(studentId, groupId);
  }
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
  syncLowLoadInsights(studentId, groupId, classification.level, snapshot);

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

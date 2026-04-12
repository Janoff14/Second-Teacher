import { listEnrollmentsForGroup } from "./academicStore";
import {
  listAttemptsForVersion,
  listPublishedVersionsForGroup,
  listStudentAttemptsInGroup,
} from "./assessmentStore";
import {
  computeRiskFeatureSnapshot,
  classifyRiskFromSnapshot,
  listInsightsForTeacher,
  type InsightRecord,
  type RiskFactorEvidence,
} from "./insightsStore";
import { getUserById } from "./userStore";

export type GroupPatternType = "common_struggle" | "engagement_drop" | "topic_gap";

export interface TeacherBriefingGroupPattern {
  patternType: GroupPatternType;
  description: string;
  affectedStudentIds: string[];
  suggestedAction: string;
  /** Optional assessment version id when pattern is score-based */
  versionId?: string;
}

export interface TeacherBriefingStudentRow {
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
}

export interface TeacherBriefingPayload {
  attentionNeeded: number;
  students: TeacherBriefingStudentRow[];
  groupPatterns: TeacherBriefingGroupPattern[];
}

function ratio(attempt: { totalScore: number; maxScore: number }): number {
  if (attempt.maxScore <= 0) return 0;
  return attempt.totalScore / attempt.maxScore;
}

function recentScorePercents(studentId: string, groupId: string, take = 5): number[] {
  const rows = listStudentAttemptsInGroup(studentId, groupId);
  const last = rows.slice(-take);
  return last.map((r) =>
    r.attempt.maxScore > 0
      ? Math.round((r.attempt.totalScore / r.attempt.maxScore) * 1000) / 10
      : 0,
  );
}

function templateReasoning(insight: InsightRecord, recentScores: number[]): string {
  const topFactors = insight.factors.filter((f) => f.severity !== "info").slice(0, 2);
  const fromFactors =
    topFactors.length > 0
      ? topFactors.map((f) => f.message).join(" ")
      : insight.factors[0]?.message ?? insight.body;
  const scoresHint =
    recentScores.length > 0
      ? ` Last scores: ${recentScores.map((p) => `${p}%`).join(", ")}.`
      : "";
  return `${fromFactors}${scoresHint}`.trim();
}

function suggestedActionsForInsight(insight: InsightRecord): string[] {
  const actions: string[] = [];
  const codes = new Set(insight.factors.map((f) => f.code));

  if (insight.type === "low_load") {
    actions.push("Offer extension tasks, optional challenges, or peer mentoring roles.");
    actions.push("Check in about pacing — they may be ready for harder material.");
    return actions;
  }

  if (codes.has("LOW_RECENT_SCORE") || codes.has("REPEATED_LOW_SCORES")) {
    actions.push("Schedule a short 1:1 to clarify misconceptions and set a concrete study plan.");
  }
  if (codes.has("DECLINING_PERFORMANCE") || codes.has("DECLINING_TREND")) {
    actions.push("Review recent assessments together; consider formative practice before the next graded item.");
  }
  if (codes.has("RECENT_INACTIVITY")) {
    actions.push("Send a gentle nudge or check for barriers to participation.");
  }
  if (codes.has("BELOW_CLASS_BASELINE")) {
    actions.push("Point them to targeted readings or worked examples from class materials.");
  }
  if (codes.has("MODERATE_RECENT_SCORE")) {
    actions.push("Suggest spaced review on weak topics; monitor the next two attempts.");
  }

  if (actions.length === 0) {
    actions.push("Acknowledge or dismiss this card when you have followed up.");
  }
  return actions.slice(0, 5);
}

/**
 * Cross-student patterns for teacher briefing (deterministic).
 */
export function detectGroupPatterns(groupId: string): TeacherBriefingGroupPattern[] {
  const patterns: TeacherBriefingGroupPattern[] = [];
  const enrollments = listEnrollmentsForGroup(groupId);
  const studentIds = enrollments.map((e) => e.studentId);
  if (studentIds.length === 0) return patterns;

  const versions = listPublishedVersionsForGroup(groupId);

  for (const version of versions) {
    const attempts = listAttemptsForVersion(version.id);
    const byStudent = new Map<string, typeof attempts>();
    for (const a of attempts) {
      const list = byStudent.get(a.studentId) ?? [];
      list.push(a);
      byStudent.set(a.studentId, list);
    }
    const struggling: string[] = [];
    for (const sid of studentIds) {
      const list = byStudent.get(sid);
      if (!list || list.length === 0) continue;
      const last = list[list.length - 1]!;
      const pct = ratio(last);
      if (pct < 0.5) struggling.push(sid);
    }
    if (struggling.length >= 3) {
      patterns.push({
        patternType: "common_struggle",
        description: `${struggling.length} students scored below 50% on "${version.title}".`,
        affectedStudentIds: struggling,
        suggestedAction: "Plan a short review session or re-teach on this assessment’s topics; share targeted practice.",
        versionId: version.id,
      });
    }
  }

  const inactiveStudents: string[] = [];
  const now = Date.now();
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
  for (const sid of studentIds) {
    const rows = listStudentAttemptsInGroup(sid, groupId);
    if (rows.length < 2) continue;
    const lastAt = new Date(rows[rows.length - 1]!.attempt.submittedAt).getTime();
    if (lastAt < fourteenDaysAgo) inactiveStudents.push(sid);
  }
  if (inactiveStudents.length >= 3) {
    patterns.push({
      patternType: "engagement_drop",
      description: `${inactiveStudents.length} students have had no attempts in the last 14 days despite prior activity.`,
      affectedStudentIds: inactiveStudents,
      suggestedAction: "Send a class-wide reminder and reach out individually to rule out access or motivation issues.",
    });
  }

  const declining: string[] = [];
  for (const sid of studentIds) {
    const snap = computeRiskFeatureSnapshot(sid, groupId);
    const cls = classifyRiskFromSnapshot(snap);
    if (cls.level === "at_risk" || cls.level === "watchlist") declining.push(sid);
    else if (snap.features.trendLabel === "declining") declining.push(sid);
  }
  const uniqueDeclining = [...new Set(declining)];
  if (uniqueDeclining.length >= 3) {
    patterns.push({
      patternType: "topic_gap",
      description: `${uniqueDeclining.length} students show declining performance or are already on the watchlist.`,
      affectedStudentIds: uniqueDeclining,
      suggestedAction: "Consider a group mini-lesson on the hardest items from recent assessments.",
    });
  }

  return patterns;
}

function briefingInsights(groupId: string): InsightRecord[] {
  const rows = listInsightsForTeacher(groupId, { status: "all" }).filter((i) => i.status === "open");
  return rows.filter(
    (i) =>
      i.type === "low_load" ||
      i.riskLevel === "watchlist" ||
      i.riskLevel === "at_risk",
  );
}

export async function buildTeacherBriefingPayload(groupId: string): Promise<TeacherBriefingPayload> {
  const insights = briefingInsights(groupId);
  const groupPatterns = detectGroupPatterns(groupId);

  const students: TeacherBriefingStudentRow[] = await Promise.all(
    insights.map(async (insight) => {
      const user = await getUserById(insight.studentId);
      const recentScores = recentScorePercents(insight.studentId, groupId, 5);
      return {
        studentId: insight.studentId,
        displayName: user?.displayName ?? null,
        insightId: insight.id,
        riskLevel: insight.riskLevel,
        insightType: insight.type,
        recentScores,
        reasoning: templateReasoning(insight, recentScores),
        suggestedActions: suggestedActionsForInsight(insight),
        factors: insight.factors,
        status: insight.status,
      };
    }),
  );

  students.sort((a, b) => {
    const score = (r: string) =>
      r === "at_risk" ? 0 : r === "watchlist" ? 1 : r === "low_load" ? 2 : 3;
    return score(a.riskLevel) - score(b.riskLevel);
  });

  return {
    attentionNeeded: students.length,
    students,
    groupPatterns,
  };
}

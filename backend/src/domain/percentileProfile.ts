import { listEnrollmentsForGroup } from "./academicStore";
import {
  listPublishedVersionsForGroup,
  listStudentAttemptsInGroup,
  listAttemptsForVersion,
  type AttemptRecord,
} from "./assessmentStore";
import { computeRiskFeatureSnapshot } from "./insightsStore";

export type PercentileAxis =
  | "quizAvg"
  | "testAvg"
  | "accuracy"
  | "consistency"
  | "completion"
  | "improvement"
  | "engagement"
  | "bestScore";

export type PercentileProfilePayload = {
  studentId: string;
  groupId: string;
  groupSize: number;
  axes: Record<PercentileAxis, { percentile: number; rawValue: number | null }>;
  minutesPlayed: number;
};

type AssessmentCategory = "practice" | "quiz" | "test" | "exam" | "assessment";

function inferCategory(title: string): AssessmentCategory {
  const n = title.trim().toLowerCase();
  if (n.startsWith("practice:") || n.startsWith("practice ")) return "practice";
  if (n.startsWith("quiz:") || n.startsWith("quiz ")) return "quiz";
  if (n.startsWith("test:") || n.startsWith("test ") || n.includes("unit test")) return "test";
  if (n.startsWith("exam:") || n.startsWith("exam ") || n.includes("final exam")) return "exam";
  return "assessment";
}

function scorePct(a: AttemptRecord): number {
  return a.maxScore > 0 ? Math.round((a.totalScore / a.maxScore) * 1000) / 10 : 0;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[]): number | null {
  const m = mean(values);
  if (m === null || values.length < 2) return null;
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function percentileRank(value: number, allValues: number[]): number {
  if (allValues.length <= 1) return 50;
  const below = allValues.filter((v) => v < value).length;
  const equal = allValues.filter((v) => v === value).length;
  return Math.round(((below + 0.5 * equal) / allValues.length) * 1000) / 10;
}

type StudentMetrics = {
  studentId: string;
  quizAvg: number | null;
  testAvg: number | null;
  accuracy: number | null;
  consistency: number | null;
  completion: number;
  improvement: number | null;
  engagement: number;
  bestScore: number | null;
  totalAttempts: number;
};

function computeMetricsForStudent(
  studentId: string,
  groupId: string,
  publishedCount: number,
): StudentMetrics {
  const attempts = listStudentAttemptsInGroup(studentId, groupId);
  const versions = listPublishedVersionsForGroup(groupId);
  const versionMap = new Map(versions.map((v) => [v.id, v]));

  const scores = attempts.map((r) => scorePct(r.attempt));
  const quizScores: number[] = [];
  const testScores: number[] = [];
  let totalCorrect = 0;
  let totalItems = 0;

  for (const row of attempts) {
    const version = versionMap.get(row.versionId);
    const cat = version ? inferCategory(version.title) : "assessment";
    const pct = scorePct(row.attempt);

    if (cat === "quiz") quizScores.push(pct);
    if (cat === "test" || cat === "exam") testScores.push(pct);

    for (const result of row.attempt.itemResults) {
      totalItems += 1;
      if (result.correct) totalCorrect += 1;
    }
  }

  const sd = stddev(scores);
  const consistencyScore = sd !== null ? Math.max(0, 100 - sd) : null;

  const attemptedVersionIds = new Set(attempts.map((r) => r.versionId));
  const completion = publishedCount > 0 ? (attemptedVersionIds.size / publishedCount) * 100 : 0;

  const snapshot = computeRiskFeatureSnapshot(studentId, groupId);
  const trendDelta = snapshot.features.trendDelta;
  const improvementNormalized =
    trendDelta !== null ? Math.round((50 + trendDelta * 100) * 10) / 10 : null;

  return {
    studentId,
    quizAvg: mean(quizScores),
    testAvg: mean(testScores),
    accuracy: totalItems > 0 ? Math.round((totalCorrect / totalItems) * 1000) / 10 : null,
    consistency: consistencyScore !== null ? Math.round(consistencyScore * 10) / 10 : null,
    completion: Math.round(completion * 10) / 10,
    improvement: improvementNormalized,
    engagement: snapshot.features.attemptsLast14Days,
    bestScore: scores.length > 0 ? Math.max(...scores) : null,
    totalAttempts: attempts.length,
  };
}

function axisPercentile(
  studentValue: number | null,
  allValues: (number | null)[],
): { percentile: number; rawValue: number | null } {
  if (studentValue === null) {
    return { percentile: 0, rawValue: null };
  }
  const valid = allValues.filter((v): v is number => v !== null);
  if (valid.length === 0) return { percentile: 0, rawValue: studentValue };
  return {
    percentile: percentileRank(studentValue, valid),
    rawValue: Math.round(studentValue * 10) / 10,
  };
}

export function computePercentileProfile(
  studentId: string,
  groupId: string,
): PercentileProfilePayload {
  const enrollments = listEnrollmentsForGroup(groupId);
  const publishedCount = listPublishedVersionsForGroup(groupId).length;

  const allMetrics = enrollments.map((e) =>
    computeMetricsForStudent(e.studentId, groupId, publishedCount),
  );

  const target = allMetrics.find((m) => m.studentId === studentId);
  if (!target) {
    const defaultAxis = { percentile: 0, rawValue: null };
    return {
      studentId,
      groupId,
      groupSize: enrollments.length,
      axes: {
        quizAvg: defaultAxis,
        testAvg: defaultAxis,
        accuracy: defaultAxis,
        consistency: defaultAxis,
        completion: defaultAxis,
        improvement: defaultAxis,
        engagement: defaultAxis,
        bestScore: defaultAxis,
      },
      minutesPlayed: 0,
    };
  }

  return {
    studentId,
    groupId,
    groupSize: enrollments.length,
    axes: {
      quizAvg: axisPercentile(target.quizAvg, allMetrics.map((m) => m.quizAvg)),
      testAvg: axisPercentile(target.testAvg, allMetrics.map((m) => m.testAvg)),
      accuracy: axisPercentile(target.accuracy, allMetrics.map((m) => m.accuracy)),
      consistency: axisPercentile(target.consistency, allMetrics.map((m) => m.consistency)),
      completion: axisPercentile(target.completion, allMetrics.map((m) => m.completion)),
      improvement: axisPercentile(target.improvement, allMetrics.map((m) => m.improvement)),
      engagement: axisPercentile(target.engagement, allMetrics.map((m) => m.engagement)),
      bestScore: axisPercentile(target.bestScore, allMetrics.map((m) => m.bestScore)),
    },
    minutesPlayed: target.totalAttempts,
  };
}

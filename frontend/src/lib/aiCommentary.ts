/**
 * Rule-based "AI" commentary generator.
 * Produces concise, teacher-friendly text from numeric features
 * without requiring an LLM call.
 */

import type {
  StudentProfile,
  TeacherGroupResultsSummary,
  RiskFactorEvidence,
} from "./api/assessments";

// ── Student-level commentary ────────────────────────────────────────────────

export function generateStudentCommentary(p: StudentProfile): string[] {
  const lines: string[] = [];
  const f = p.features;
  const pct = (v: number | null) => (v !== null ? `${Math.round(v * 100)}%` : "N/A");

  if (p.totalAttempts === 0) {
    lines.push("This student has not submitted any work yet. Follow up to check for access issues or motivation barriers.");
    return lines;
  }

  if (p.totalAttempts < 3) {
    lines.push(`Only ${p.totalAttempts} attempt(s) so far — too early for a reliable trend. Encourage continued participation.`);
    return lines;
  }

  // Overall position
  if (p.overallAveragePct !== null) {
    if (p.overallAveragePct >= 80) {
      lines.push(`Strong performer with an overall average of ${Math.round(p.overallAveragePct)}%. Likely ready for more challenging material.`);
    } else if (p.overallAveragePct >= 60) {
      lines.push(`Overall average is ${Math.round(p.overallAveragePct)}% — meeting expectations but has room to grow.`);
    } else {
      lines.push(`Overall average is ${Math.round(p.overallAveragePct)}% — below the passing threshold. Targeted support is recommended.`);
    }
  }

  // Trend
  if (f.trendLabel === "improving") {
    lines.push(`Positive trend: scores are improving (recent avg ${pct(f.recentAvgRatio)} vs prior ${pct(f.priorAvgRatio)}). Keep reinforcing current study habits.`);
  } else if (f.trendLabel === "declining") {
    lines.push(`Concerning trend: scores are declining (recent avg ${pct(f.recentAvgRatio)} vs prior ${pct(f.priorAvgRatio)}). Consider a one-on-one check-in.`);
  } else if (f.trendLabel === "flat" && f.recentAvgRatio !== null && f.recentAvgRatio < 0.6) {
    lines.push(`Scores are flat around ${pct(f.recentAvgRatio)} — not declining but not recovering either. A change in study approach may help.`);
  }

  // Class comparison
  if (f.baselineDeviation !== null) {
    const dev = Math.round(Math.abs(f.baselineDeviation) * 100);
    if (f.baselineDeviation <= -0.2) {
      lines.push(`Performing ~${dev} points below the class average. May benefit from peer tutoring or additional resources.`);
    } else if (f.baselineDeviation >= 0.15) {
      lines.push(`Performing ~${dev} points above the class average — a strong relative position.`);
    }
  }

  // Engagement
  if (f.daysSinceLastAttempt !== null && f.daysSinceLastAttempt > 14) {
    lines.push(`Inactive for ${f.daysSinceLastAttempt} days. Reach out to understand the reason before performance drops further.`);
  }

  if (f.lowScoreCountInLast5 >= 4) {
    lines.push("Almost all recent attempts are below 60%. This pattern suggests a fundamental gap in understanding, not just test difficulty.");
  } else if (f.lowScoreCountInLast5 >= 3) {
    lines.push("Multiple recent attempts are below 60%. Check whether the student understands the core concepts or is rushing through assignments.");
  }

  // Per-assessment highlights
  const assessed = p.perAssessment.filter((a) => a.studentAttempts.length > 0);
  const weakest = assessed
    .filter((a) => a.latestScorePct !== null)
    .sort((a, b) => (a.latestScorePct ?? 0) - (b.latestScorePct ?? 0))
    .slice(0, 2);
  const strongest = assessed
    .filter((a) => a.bestScorePct !== null)
    .sort((a, b) => (b.bestScorePct ?? 0) - (a.bestScorePct ?? 0))
    .slice(0, 2);

  if (weakest.length > 0 && (weakest[0]?.latestScorePct ?? 100) < 50) {
    lines.push(`Weakest area: "${weakest[0]!.title}" (${weakest[0]!.latestScorePct}%). Review those topics specifically.`);
  }

  if (strongest.length > 0 && (strongest[0]?.bestScorePct ?? 0) >= 80) {
    lines.push(`Strongest area: "${strongest[0]!.title}" (${strongest[0]!.bestScorePct}%). Build on this confidence.`);
  }

  return lines;
}

// ── Group-level commentary ──────────────────────────────────────────────────

export type InsightEntry = {
  id?: string;
  riskLevel?: string | null;
  severity?: string | null;
};

export function generateGroupCommentary(
  summary: TeacherGroupResultsSummary,
  insights: InsightEntry[],
): string[] {
  const lines: string[] = [];
  const avg = summary.overallAverageScorePct;
  const n = summary.enrolledCount;
  const assessments = summary.assessments;

  if (assessments.length === 0) {
    lines.push("No assessments published yet. Create and publish your first assignment to start tracking class performance.");
    return lines;
  }

  // Class average
  if (avg != null && typeof avg === "number" && !Number.isNaN(avg)) {
    if (avg >= 75) {
      lines.push(`Class average is ${Math.round(avg)}% — the group is performing well overall.`);
    } else if (avg >= 55) {
      lines.push(`Class average is ${Math.round(avg)}% — adequate but there's room for improvement across the board.`);
    } else {
      lines.push(`Class average is ${Math.round(avg)}% — below expectations. Consider reviewing core concepts with the whole class.`);
    }
  }

  // Risk distribution
  const atRisk = insights.filter((i) => (i.riskLevel ?? i.severity) === "at_risk").length;
  const watchlist = insights.filter((i) => (i.riskLevel ?? i.severity) === "watchlist").length;
  const lowLoad = insights.filter((i) => (i.riskLevel ?? i.severity) === "low_load").length;
  if (atRisk > 0) {
    const pct = Math.round((atRisk / n) * 100);
    lines.push(`${atRisk} student${atRisk > 1 ? "s" : ""} (${pct}%) ${atRisk > 1 ? "are" : "is"} at risk and need${atRisk === 1 ? "s" : ""} immediate attention.`);
  }
  if (watchlist > 0) {
    lines.push(`${watchlist} on the watchlist — monitor their next submissions closely.`);
  }
  if (lowLoad > 0) {
    lines.push(`${lowLoad} student${lowLoad > 1 ? "s" : ""} ${lowLoad > 1 ? "show" : "shows"} high performance with room for stretch goals.`);
  }

  // Assessment-specific observations
  const sorted = [...assessments].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );

  const lowest = sorted
    .filter((a) => a.averageScorePct != null && a.attemptCount > 0)
    .sort((a, b) => (a.averageScorePct ?? 0) - (b.averageScorePct ?? 0));
  if (lowest.length > 0 && (lowest[0]?.averageScorePct ?? 100) < 50) {
    lines.push(`"${lowest[0]!.title}" had the lowest class average (${Math.round(lowest[0]!.averageScorePct!)}%). It may have been too difficult or the topic needs re-teaching.`);
  }

  // Participation gaps
  const lowPart = sorted.filter((a) => {
    if (!a.enrolledCount) return false;
    const unique = new Set(a.results.map((r) => r.studentId)).size;
    return unique / a.enrolledCount < 0.7;
  });
  if (lowPart.length > 0) {
    lines.push(`${lowPart.length} assessment${lowPart.length > 1 ? "s have" : " has"} less than 70% student participation. Consider reminders or extending deadlines.`);
  }

  // Trend across assessments
  if (sorted.length >= 3) {
    const first3Avg =
      sorted.slice(0, 3).reduce((s, a) => s + (a.averageScorePct ?? 0), 0) / 3;
    const last3Avg =
      sorted.slice(-3).reduce((s, a) => s + (a.averageScorePct ?? 0), 0) / 3;
    const diff = last3Avg - first3Avg;
    if (diff > 5) {
      lines.push(`The class trend is positive — recent assessments average ${Math.round(diff)} points higher than earlier ones.`);
    } else if (diff < -5) {
      lines.push(`The class trend is concerning — recent assessments average ${Math.round(Math.abs(diff))} points lower than earlier ones. The material may be getting harder or engagement is dropping.`);
    }
  }

  return lines;
}

import {
  getGroup,
  getSubject,
  listGroupIdsForStudent,
} from "./academicStore";
import {
  getVersion,
  isScheduleOpen,
  listPublishedVersionsForGroup,
  listStudentAttemptsInGroup,
  type AttemptRecord,
  type AssessmentVersion,
} from "./assessmentStore";
import {
  classifyRiskFromSnapshot,
  computeRiskFeatureSnapshot,
  listInsightsForStudent,
  listNotificationsForUser,
} from "./insightsStore";
import {
  getTextbookReaderDocument,
  getTextbookSourceById,
  listTextbookSourcesForSubject,
  queryCorpus,
  type RetrievalHit,
} from "./ragStore";
import { briefCompletion, hasOpenAI } from "../lib/openai";

export type AssessmentCategory = "practice" | "quiz" | "test" | "exam" | "assessment";
export type StudentChallengeStatus = "needs_support" | "on_track" | "needs_challenge";

export type StudentAcademicScopeItem = {
  subject: { id: string; name: string };
  group: { id: string; name: string };
  summary: {
    openNowCount: number;
    upcomingCount: number;
    latestScorePct: number | null;
    riskLevel: "stable" | "watchlist" | "at_risk";
    insightCount: number;
    textbookCount: number;
  };
};

export type StudentReaderRecommendation = {
  id: string;
  title: string;
  sourceTitle: string;
  readerPath: string;
  highlightText: string;
  pageNumber?: number;
  chapterTitle?: string;
};

export type StudentWorkspacePayload = {
  subject: { id: string; name: string };
  group: { id: string; name: string };
  textbooks: Array<{
    id: string;
    title: string;
    versionLabel: string;
    createdAt: string;
    readerPath: string;
  }>;
  assessments: {
    openNowCount: number;
    upcomingCount: number;
    completedCount: number;
    items: Array<{
      id: string;
      title: string;
      type: AssessmentCategory;
      status: "available_now" | "scheduled" | "closed";
      windowOpensAtUtc: string;
      windowClosesAtUtc: string;
      windowTimezone: string;
      attempted: boolean;
      attemptCount: number;
      latestScorePct: number | null;
    }>;
  };
  analytics: {
    summary: {
      attemptCount: number;
      overallAveragePct: number | null;
      recentAveragePct: number | null;
      trendLabel: "improving" | "flat" | "declining" | "insufficient_data";
      riskLevel: "stable" | "watchlist" | "at_risk";
      riskConfidence: number;
      challengeStatus: StudentChallengeStatus;
      challengeReason: string;
      lastAttemptAt: string | null;
    };
    narrative: string;
    graphNarrative: string;
    categoryAverages: Record<AssessmentCategory | "all", number | null>;
    timeSeries: Array<{
      assessmentVersionId: string;
      title: string;
      type: AssessmentCategory;
      submittedAt: string;
      scorePct: number;
      sequence: number;
    }>;
    weakAreas: Array<{
      id: string;
      label: string;
      evidence: string;
      missCount: number;
      recommendedReadings: StudentReaderRecommendation[];
    }>;
    recommendedReadings: StudentReaderRecommendation[];
  };
  alerts: Array<{
    id: string;
    title: string;
    body: string;
    riskLevel: "stable" | "watchlist" | "at_risk";
    createdAt: string;
    recommendedReadings: StudentReaderRecommendation[];
  }>;
  studyCoach: {
    heading: string;
    intro: string;
    suggestedPrompts: string[];
  };
};

function scorePct(attempt: AttemptRecord): number {
  if (attempt.maxScore <= 0) {
    return 0;
  }
  return Math.round((attempt.totalScore / attempt.maxScore) * 1000) / 10;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function inferAssessmentCategory(title: string): AssessmentCategory {
  const normalized = title.trim().toLowerCase();
  if (normalized.startsWith("practice:") || normalized.startsWith("practice ")) {
    return "practice";
  }
  if (normalized.startsWith("quiz:") || normalized.startsWith("quiz ")) {
    return "quiz";
  }
  if (normalized.startsWith("test:") || normalized.startsWith("test ") || normalized.includes("unit test")) {
    return "test";
  }
  if (normalized.startsWith("exam:") || normalized.startsWith("exam ") || normalized.includes("final exam")) {
    return "exam";
  }
  return "assessment";
}

function challengeStatusFromMetrics(params: {
  riskLevel: "stable" | "watchlist" | "at_risk";
  recentAveragePct: number | null;
  attemptCount: number;
  trendLabel: "improving" | "flat" | "declining" | "insufficient_data";
}): { status: StudentChallengeStatus; reason: string } {
  if (params.riskLevel === "watchlist" || params.riskLevel === "at_risk") {
    return {
      status: "needs_support",
      reason: "Recent performance signals show that focused support and revision should come before adding harder work.",
    };
  }
  if (
    params.attemptCount >= 3 &&
    params.recentAveragePct !== null &&
    params.recentAveragePct >= 88 &&
    params.trendLabel !== "declining"
  ) {
    return {
      status: "needs_challenge",
      reason: "You are consistently scoring high, so it may be time to add more demanding or extension work.",
    };
  }
  return {
    status: "on_track",
    reason: "Your recent work looks steady enough to continue with the current level while tightening weaker spots.",
  };
}

function fallbackReadingRecommendations(subjectId: string, groupId: string): StudentReaderRecommendation[] {
  const sources = listTextbookSourcesForSubject(subjectId);
  const recommendations: StudentReaderRecommendation[] = [];

  for (const source of sources) {
    const readerDoc = getTextbookReaderDocument(source.id);
    const paragraph = readerDoc?.paragraphs[0];
    if (!paragraph) {
      recommendations.push({
        id: `fallback:${source.id}`,
        title: `${source.title} overview`,
        sourceTitle: source.title,
        readerPath: `/reader/textbooks/${source.id}?groupId=${encodeURIComponent(groupId)}`,
        highlightText: "",
      });
      continue;
    }
    recommendations.push({
      id: `fallback:${source.id}:${paragraph.id}`,
      title: `${paragraph.chapterTitle} p.${paragraph.pageNumber}`,
      sourceTitle: source.title,
      readerPath:
        `/reader/textbooks/${source.id}` +
        `?groupId=${encodeURIComponent(groupId)}` +
        `&paragraphId=${encodeURIComponent(paragraph.id)}` +
        `&sentenceStart=1&sentenceEnd=${paragraph.sentences.length || 1}`,
      highlightText: paragraph.text,
      pageNumber: paragraph.pageNumber,
      chapterTitle: paragraph.chapterTitle,
    });
  }

  return recommendations.slice(0, 3);
}

function mapRetrievalHitsToReadings(hits: RetrievalHit[], groupId: string): StudentReaderRecommendation[] {
  return hits
    .filter((hit) => hit.citation.readerPath && hit.citation.textbookSourceId)
    .map((hit) => {
      const source = getTextbookSourceById(hit.citation.textbookSourceId!);
      const readerPath = hit.citation.readerPath!.includes("?")
        ? `${hit.citation.readerPath!}&groupId=${encodeURIComponent(groupId)}`
        : `${hit.citation.readerPath!}?groupId=${encodeURIComponent(groupId)}`;
      const recommendation: StudentReaderRecommendation = {
        id: hit.chunkId,
        title:
          hit.citation.textbookLocation?.chapterTitle ??
          source?.title ??
          "Recommended reading",
        sourceTitle: source?.title ?? "Course textbook",
        readerPath,
        highlightText: hit.citation.highlightText ?? hit.text,
      };
      if (hit.citation.textbookLocation?.pageNumber !== undefined) {
        recommendation.pageNumber = hit.citation.textbookLocation.pageNumber;
      }
      if (hit.citation.textbookLocation?.chapterTitle !== undefined) {
        recommendation.chapterTitle = hit.citation.textbookLocation.chapterTitle;
      }
      return recommendation;
    });
}

async function recommendReadings(params: {
  subjectId: string;
  groupId: string;
  query: string;
  topK?: number;
}): Promise<StudentReaderRecommendation[]> {
  const hits = await queryCorpus({
    query: params.query,
    groupId: params.groupId,
    subjectId: params.subjectId,
    topK: params.topK ?? 3,
  });
  const mapped = mapRetrievalHitsToReadings(hits, params.groupId);
  if (mapped.length > 0) {
    return mapped.slice(0, params.topK ?? 3);
  }
  return fallbackReadingRecommendations(params.subjectId, params.groupId).slice(0, params.topK ?? 3);
}

function buildAnalyticsNarrative(params: {
  attemptCount: number;
  recentAveragePct: number | null;
  overallAveragePct: number | null;
  trendLabel: "improving" | "flat" | "declining" | "insufficient_data";
  riskLevel: "stable" | "watchlist" | "at_risk";
  reasons: string[];
  challengeReason: string;
}): { narrative: string; graphNarrative: string } {
  const parts: string[] = [];
  if (params.attemptCount === 0) {
    parts.push("No completed work yet in this subject, so the analytics story will appear after your first attempts.");
  } else {
    parts.push(
      `You have ${params.attemptCount} completed attempt${params.attemptCount === 1 ? "" : "s"} in this subject.`,
    );
    if (params.recentAveragePct !== null) {
      parts.push(`Your recent average is ${params.recentAveragePct}%.`);
    }
    if (params.overallAveragePct !== null) {
      parts.push(`Across all recorded attempts, your average is ${params.overallAveragePct}%.`);
    }
    if (params.trendLabel === "declining") {
      parts.push("The trend is drifting downward, so the next study block should focus on revision before speed.");
    } else if (params.trendLabel === "improving") {
      parts.push("The trend is improving, which suggests the latest study approach is starting to work.");
    } else if (params.trendLabel === "flat") {
      parts.push("The trend is mostly flat, so incremental gains will come from targeting the same weak spots repeatedly.");
    }
  }

  if (params.riskLevel === "watchlist" || params.riskLevel === "at_risk") {
    parts.push(`Risk status is ${params.riskLevel.replace("_", " ")} because ${params.reasons.join(" ")}`);
  } else {
    parts.push("Risk status is stable based on the current evidence.");
  }

  parts.push(params.challengeReason);

  const graphNarrative =
    params.attemptCount === 0
      ? "The graph will start to tell a story after your first completed attempt."
      : params.trendLabel === "declining"
        ? "The line is dropping across recent attempts, which usually means revision needs to happen before the next assessment window."
        : params.trendLabel === "improving"
          ? "The line is climbing, so the recent work pattern looks healthier than earlier attempts."
          : "The line is relatively steady, so the key is improving precision on the same recurring mistakes.";

  return { narrative: parts.join(" "), graphNarrative };
}

export async function buildStudentAcademicScope(studentId: string): Promise<StudentAcademicScopeItem[]> {
  const groupIds = listGroupIdsForStudent(studentId);
  const items: StudentAcademicScopeItem[] = [];

  for (const groupId of groupIds) {
    const group = getGroup(groupId);
    if (!group) {
      continue;
    }
    const subject = getSubject(group.subjectId);
    if (!subject) {
      continue;
    }
    const versions = listPublishedVersionsForGroup(groupId);
    const attempts = listStudentAttemptsInGroup(studentId, groupId);
    const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1]!.attempt : null;
    const insights = listInsightsForStudent(studentId, groupId);
    const snapshot = computeRiskFeatureSnapshot(studentId, groupId);
    const classification = classifyRiskFromSnapshot(snapshot);

    items.push({
      subject: { id: subject.id, name: subject.name },
      group: { id: group.id, name: group.name },
      summary: {
        openNowCount: versions.filter((version) => isScheduleOpen(version)).length,
        upcomingCount: versions.filter((version) => Date.parse(version.windowOpensAtUtc) > Date.now()).length,
        latestScorePct: latestAttempt ? scorePct(latestAttempt) : null,
        riskLevel: classification.level,
        insightCount: insights.length,
        textbookCount: listTextbookSourcesForSubject(subject.id).length,
      },
    });
  }

  return items.sort((a, b) => a.subject.name.localeCompare(b.subject.name) || a.group.name.localeCompare(b.group.name));
}

export async function buildStudentWorkspace(studentId: string, groupId: string): Promise<StudentWorkspacePayload> {
  const group = getGroup(groupId);
  if (!group) {
    const err = new Error("Group not found") as Error & { statusCode?: number; code?: string };
    err.statusCode = 404;
    err.code = "GROUP_NOT_FOUND";
    throw err;
  }
  const subject = getSubject(group.subjectId);
  if (!subject) {
    const err = new Error("Subject not found") as Error & { statusCode?: number; code?: string };
    err.statusCode = 404;
    err.code = "SUBJECT_NOT_FOUND";
    throw err;
  }

  const textbookSources = listTextbookSourcesForSubject(subject.id);
  const versions = listPublishedVersionsForGroup(groupId);
  const attempts = listStudentAttemptsInGroup(studentId, groupId);
  const insights = listInsightsForStudent(studentId, groupId);
  const notifications = listNotificationsForUser(studentId, 20).filter((item) => item.groupId === groupId);
  const snapshot = computeRiskFeatureSnapshot(studentId, groupId);
  const classification = classifyRiskFromSnapshot(snapshot);

  const attemptsByVersionId = new Map<string, AttemptRecord[]>();
  for (const row of attempts) {
    const existing = attemptsByVersionId.get(row.versionId) ?? [];
    existing.push(row.attempt);
    attemptsByVersionId.set(row.versionId, existing);
  }

  const timeSeries = attempts.map((row, index) => {
    const version = getVersion(row.versionId);
    return {
      assessmentVersionId: row.versionId,
      title: version?.title ?? row.versionId,
      type: inferAssessmentCategory(version?.title ?? ""),
      submittedAt: row.attempt.submittedAt,
      scorePct: scorePct(row.attempt),
      sequence: index + 1,
    };
  });

  const overallAveragePct = average(timeSeries.map((point) => point.scorePct));
  const recentAveragePct = average(timeSeries.slice(-5).map((point) => point.scorePct));
  const challenge = challengeStatusFromMetrics({
    riskLevel: classification.level,
    recentAveragePct,
    attemptCount: timeSeries.length,
    trendLabel: snapshot.features.trendLabel,
  });

  const categoryAverages: Record<AssessmentCategory | "all", number | null> = {
    all: overallAveragePct,
    practice: average(timeSeries.filter((point) => point.type === "practice").map((point) => point.scorePct)),
    quiz: average(timeSeries.filter((point) => point.type === "quiz").map((point) => point.scorePct)),
    test: average(timeSeries.filter((point) => point.type === "test").map((point) => point.scorePct)),
    exam: average(timeSeries.filter((point) => point.type === "exam").map((point) => point.scorePct)),
    assessment: average(timeSeries.filter((point) => point.type === "assessment").map((point) => point.scorePct)),
  };

  const weakAreas: Array<{
    id: string;
    label: string;
    evidence: string;
    missCount: number;
    recommendedReadings: StudentReaderRecommendation[];
  }> = [];
  for (const [versionId, versionAttempts] of attemptsByVersionId.entries()) {
    const version = getVersion(versionId);
    if (!version) {
      continue;
    }
    let missCount = 0;
    const missedStems: string[] = [];
    for (const attempt of versionAttempts) {
      for (const result of attempt.itemResults) {
        if (result.correct) {
          continue;
        }
        missCount += 1;
        const item = version.items.find((entry) => entry.id === result.itemId);
        if (item?.stem) {
          missedStems.push(item.stem);
        }
      }
    }
    if (missCount === 0) {
      continue;
    }
    const recommendedReadings = await recommendReadings({
      subjectId: subject.id,
      groupId,
      query: `${subject.name} ${version.title} ${missedStems.slice(0, 2).join(" ")}`.trim(),
      topK: 2,
    });
    weakAreas.push({
      id: `weak:${versionId}`,
      label: version.title,
      evidence:
        missedStems.length > 0
          ? `You missed ${missCount} item(s) here, including "${missedStems[0]!.slice(0, 90)}${missedStems[0]!.length > 90 ? "..." : ""}".`
          : `You missed ${missCount} item(s) in this assessment.`,
      missCount,
      recommendedReadings,
    });
  }

  weakAreas.sort((a, b) => b.missCount - a.missCount);

  const recommendedReadings =
    weakAreas.flatMap((area) => area.recommendedReadings).slice(0, 4);
  const dedupedRecommendedReadings = recommendedReadings.filter(
    (reading, index, list) => list.findIndex((candidate) => candidate.id === reading.id) === index,
  );

  const assessments = versions
    .map((version) => {
      const studentAttempts = attemptsByVersionId.get(version.id) ?? [];
      const latestAttempt = studentAttempts.length > 0 ? studentAttempts[studentAttempts.length - 1]! : null;
      const now = Date.now();
      let status: "available_now" | "scheduled" | "closed" = "closed";
      if (isScheduleOpen(version, now)) {
        status = "available_now";
      } else if (Date.parse(version.windowOpensAtUtc) > now) {
        status = "scheduled";
      }
      return {
        id: version.id,
        title: version.title,
        type: inferAssessmentCategory(version.title),
        status,
        windowOpensAtUtc: version.windowOpensAtUtc,
        windowClosesAtUtc: version.windowClosesAtUtc,
        windowTimezone: version.windowTimezone,
        attempted: studentAttempts.length > 0,
        attemptCount: studentAttempts.length,
        latestScorePct: latestAttempt ? scorePct(latestAttempt) : null,
      };
    })
    .sort((a, b) => Date.parse(a.windowOpensAtUtc) - Date.parse(b.windowOpensAtUtc));

  const narrative = buildAnalyticsNarrative({
    attemptCount: timeSeries.length,
    recentAveragePct,
    overallAveragePct,
    trendLabel: snapshot.features.trendLabel,
    riskLevel: classification.level,
    reasons: classification.reasons.map((reason) => reason.message),
    challengeReason: challenge.reason,
  });

  const alerts = notifications.map((notification) => {
    const insight = insights.find((item) => item.id === notification.insightId);
    return {
      id: notification.id,
      title:
        insight?.title ??
        `AI alert: ${notification.riskLevel === "at_risk" ? "urgent support needed" : "study attention needed"}`,
      body:
        insight?.factors.map((factor) => factor.message).join(" ") ??
        "We detected a pattern that needs attention before the next assessment window.",
      riskLevel: notification.riskLevel,
      createdAt: notification.createdAt,
      recommendedReadings: weakAreas[0]?.recommendedReadings ?? dedupedRecommendedReadings.slice(0, 2),
    };
  });

  return {
    subject: { id: subject.id, name: subject.name },
    group: { id: group.id, name: group.name },
    textbooks: textbookSources.map((source) => ({
      id: source.id,
      title: source.title,
      versionLabel: source.versionLabel,
      createdAt: source.createdAt,
      readerPath: `/reader/textbooks/${source.id}?groupId=${encodeURIComponent(group.id)}`,
    })),
    assessments: {
      openNowCount: assessments.filter((item) => item.status === "available_now").length,
      upcomingCount: assessments.filter((item) => item.status === "scheduled").length,
      completedCount: assessments.filter((item) => item.attempted).length,
      items: assessments,
    },
    analytics: {
      summary: {
        attemptCount: timeSeries.length,
        overallAveragePct,
        recentAveragePct,
        trendLabel: snapshot.features.trendLabel,
        riskLevel: classification.level,
        riskConfidence: classification.confidence,
        challengeStatus: challenge.status,
        challengeReason: challenge.reason,
        lastAttemptAt: attempts.length > 0 ? attempts[attempts.length - 1]!.attempt.submittedAt : null,
      },
      narrative: narrative.narrative,
      graphNarrative: narrative.graphNarrative,
      categoryAverages,
      timeSeries,
      weakAreas: weakAreas.slice(0, 4),
      recommendedReadings: dedupedRecommendedReadings.length > 0
        ? dedupedRecommendedReadings
        : fallbackReadingRecommendations(subject.id, group.id),
    },
    alerts,
    studyCoach: {
      heading: "Study coach",
      intro:
        classification.level === "at_risk"
          ? "Start with the alert reasons, then open the linked readings before asking the coach for a short recovery plan."
          : "Use the coach to turn your analytics and readings into a focused study plan for the next assessment window.",
      suggestedPrompts: [
        "Explain my latest trend in plain language.",
        "Build me a 20-minute revision plan from my weak areas.",
        "Show me what to read before the next quiz.",
      ],
    },
  };
}

export type StudyPlanStep = {
  id: string;
  priority: number;
  action: "read" | "redo" | "practice" | "review";
  title: string;
  reason: string;
  readerLink?: string | undefined;
  assessmentLink?: string | undefined;
  estimatedMinutes: number;
  readings: StudentReaderRecommendation[];
};

export type AiStudyReportPayload = {
  subject: { id: string; name: string };
  group: { id: string; name: string };
  generatedAt: string;
  overallGrade: "strong" | "adequate" | "needs_work" | "critical";
  summary: string;
  strengths: string[];
  weaknesses: string[];
  studyPlan: StudyPlanStep[];
  topicBreakdown: Array<{
    topic: string;
    scorePct: number | null;
    missCount: number;
    status: "mastered" | "solid" | "shaky" | "weak";
    readings: StudentReaderRecommendation[];
  }>;
  suggestedRetakes: Array<{
    assessmentVersionId: string;
    title: string;
    type: AssessmentCategory;
    latestScorePct: number | null;
    reason: string;
    assessmentLink: string;
  }>;
  aiNarrative: string;
};

function gradeFromAverage(avg: number | null, riskLevel: string): AiStudyReportPayload["overallGrade"] {
  if (riskLevel === "at_risk") return "critical";
  if (avg === null) return "needs_work";
  if (avg >= 85) return "strong";
  if (avg >= 65) return "adequate";
  return "needs_work";
}

function topicStatus(scorePct: number | null, missCount: number): "mastered" | "solid" | "shaky" | "weak" {
  if (scorePct === null) return "shaky";
  if (missCount === 0 && scorePct >= 85) return "mastered";
  if (scorePct >= 75) return "solid";
  if (scorePct >= 50) return "shaky";
  return "weak";
}

export async function buildStudentAiReport(studentId: string, groupId: string): Promise<AiStudyReportPayload> {
  const group = getGroup(groupId);
  if (!group) {
    const err = new Error("Group not found") as Error & { statusCode?: number; code?: string };
    err.statusCode = 404;
    err.code = "GROUP_NOT_FOUND";
    throw err;
  }
  const subject = getSubject(group.subjectId);
  if (!subject) {
    const err = new Error("Subject not found") as Error & { statusCode?: number; code?: string };
    err.statusCode = 404;
    err.code = "SUBJECT_NOT_FOUND";
    throw err;
  }

  const versions = listPublishedVersionsForGroup(groupId);
  const attempts = listStudentAttemptsInGroup(studentId, groupId);
  const snapshot = computeRiskFeatureSnapshot(studentId, groupId);
  const classification = classifyRiskFromSnapshot(snapshot);

  const attemptsByVersionId = new Map<string, AttemptRecord[]>();
  for (const row of attempts) {
    const existing = attemptsByVersionId.get(row.versionId) ?? [];
    existing.push(row.attempt);
    attemptsByVersionId.set(row.versionId, existing);
  }

  const allScores = attempts.map((row) => scorePct(row.attempt));
  const overallAvg = average(allScores);
  const recentAvg = average(allScores.slice(-5));

  const topicBreakdown: AiStudyReportPayload["topicBreakdown"] = [];
  const studyPlan: StudyPlanStep[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let stepPriority = 1;

  for (const version of versions) {
    const versionAttempts = attemptsByVersionId.get(version.id) ?? [];
    if (versionAttempts.length === 0) continue;

    let missCount = 0;
    let totalItems = 0;
    const missedStems: string[] = [];

    for (const attempt of versionAttempts) {
      for (const result of attempt.itemResults) {
        totalItems += 1;
        if (!result.correct) {
          missCount += 1;
          const item = version.items.find((entry) => entry.id === result.itemId);
          if (item?.stem) missedStems.push(item.stem);
        }
      }
    }

    const versionScorePct = totalItems > 0 ? Math.round(((totalItems - missCount) / totalItems) * 1000) / 10 : null;
    const status = topicStatus(versionScorePct, missCount);

    const readings = await recommendReadings({
      subjectId: subject.id,
      groupId,
      query: `${subject.name} ${version.title} ${missedStems.slice(0, 3).join(" ")}`.trim(),
      topK: 3,
    });

    topicBreakdown.push({
      topic: version.title,
      scorePct: versionScorePct,
      missCount,
      status,
      readings,
    });

    if (status === "mastered" || status === "solid") {
      strengths.push(`${version.title} (${versionScorePct}%)`);
    }

    if (status === "shaky" || status === "weak") {
      weaknesses.push(`${version.title}: ${missCount} missed items`);

      if (readings.length > 0) {
        studyPlan.push({
          id: `read:${version.id}`,
          priority: stepPriority++,
          action: "read",
          title: `Review material for ${version.title}`,
          reason: `You missed ${missCount} item(s). The linked textbook sections cover the concepts tested.`,
          readerLink: readings[0]?.readerPath,
          estimatedMinutes: Math.max(10, missCount * 5),
          readings,
        });
      }

      const matchedAssessment = versions.find((v) => v.id === version.id);
      if (matchedAssessment && isScheduleOpen(matchedAssessment)) {
        studyPlan.push({
          id: `redo:${version.id}`,
          priority: stepPriority++,
          action: "redo",
          title: `Retake ${version.title}`,
          reason: "After reviewing the material, attempt this again to check if the weak spots are fixed.",
          assessmentLink: `/student/assessments/take/${version.id}`,
          estimatedMinutes: 15,
          readings: [],
        });
      }
    }
  }

  topicBreakdown.sort((a, b) => (a.scorePct ?? 0) - (b.scorePct ?? 0));

  const suggestedRetakes: AiStudyReportPayload["suggestedRetakes"] = [];
  for (const version of versions) {
    const versionAttempts = attemptsByVersionId.get(version.id) ?? [];
    if (versionAttempts.length === 0) continue;
    const latestAttempt = versionAttempts[versionAttempts.length - 1]!;
    const score = scorePct(latestAttempt);
    if (score < 70 && isScheduleOpen(version)) {
      suggestedRetakes.push({
        assessmentVersionId: version.id,
        title: version.title,
        type: inferAssessmentCategory(version.title),
        latestScorePct: score,
        reason: `Your latest score was ${score}%. Retaking after reviewing the material can solidify understanding.`,
        assessmentLink: `/student/assessments/take/${version.id}`,
      });
    }
  }

  const overallGrade = gradeFromAverage(overallAvg, classification.level);

  let aiNarrative = "";
  if (hasOpenAI() && attempts.length > 0) {
    const context = {
      subject: subject.name,
      overallAvg,
      recentAvg,
      riskLevel: classification.level,
      trend: snapshot.features.trendLabel,
      weakTopics: topicBreakdown.filter((t) => t.status === "weak" || t.status === "shaky").map((t) => t.topic),
      strongTopics: topicBreakdown.filter((t) => t.status === "mastered" || t.status === "solid").map((t) => t.topic),
      attemptCount: attempts.length,
    };
    const system =
      "You are a supportive study advisor for a student. Given their performance data, write 3-4 sentences of personalized, encouraging guidance. " +
      "Focus on what to study next and how to improve. Do not predict grades. Be specific about which topics need work. Keep it concise.";
    const raw = await briefCompletion(system, JSON.stringify(context));
    if (raw) aiNarrative = raw.trim();
  }

  if (!aiNarrative) {
    const parts: string[] = [];
    if (overallGrade === "critical") {
      parts.push(`Your performance in ${subject.name} needs urgent attention.`);
    } else if (overallGrade === "needs_work") {
      parts.push(`Your work in ${subject.name} shows room for improvement.`);
    } else if (overallGrade === "adequate") {
      parts.push(`You are making solid progress in ${subject.name}.`);
    } else {
      parts.push(`Excellent work in ${subject.name}!`);
    }
    if (weaknesses.length > 0) {
      parts.push(`Focus your next study session on: ${weaknesses.slice(0, 3).join(", ")}.`);
    }
    if (strengths.length > 0) {
      parts.push(`Your strongest areas are: ${strengths.slice(0, 3).join(", ")}.`);
    }
    parts.push("Use the study plan below to work through the recommended readings and retakes in order.");
    aiNarrative = parts.join(" ");
  }

  const summary = [
    overallAvg !== null ? `Overall average: ${overallAvg}%` : "No scores yet",
    `Trend: ${snapshot.features.trendLabel}`,
    `Risk: ${classification.level.replace("_", " ")}`,
    `${attempts.length} attempts recorded`,
  ].join(" | ");

  return {
    subject: { id: subject.id, name: subject.name },
    group: { id: group.id, name: group.name },
    generatedAt: new Date().toISOString(),
    overallGrade,
    summary,
    strengths,
    weaknesses,
    studyPlan: studyPlan.slice(0, 10),
    topicBreakdown,
    suggestedRetakes: suggestedRetakes.slice(0, 5),
    aiNarrative,
  };
}

import { apiRequest } from "./client";

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

export type ReaderRecommendation = {
  id: string;
  title: string;
  sourceTitle: string;
  readerPath: string;
  highlightText: string;
  pageNumber?: number;
  chapterTitle?: string;
};

export type StudentWorkspace = {
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
      type: "practice" | "quiz" | "test" | "exam" | "assessment";
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
      challengeStatus: "needs_support" | "on_track" | "needs_challenge";
      challengeReason: string;
      lastAttemptAt: string | null;
    };
    narrative: string;
    graphNarrative: string;
    categoryAverages: Record<string, number | null>;
    timeSeries: Array<{
      assessmentVersionId: string;
      title: string;
      type: "practice" | "quiz" | "test" | "exam" | "assessment";
      submittedAt: string;
      scorePct: number;
      sequence: number;
    }>;
    weakAreas: Array<{
      id: string;
      label: string;
      evidence: string;
      missCount: number;
      recommendedReadings: ReaderRecommendation[];
    }>;
    recommendedReadings: ReaderRecommendation[];
  };
  alerts: Array<{
    id: string;
    title: string;
    body: string;
    riskLevel: "stable" | "watchlist" | "at_risk";
    createdAt: string;
    recommendedReadings: ReaderRecommendation[];
  }>;
  studyCoach: {
    heading: string;
    intro: string;
    suggestedPrompts: string[];
  };
};

export async function listStudentAcademicScope() {
  return apiRequest<StudentAcademicScopeItem[]>("/student/academic-scope", {
    method: "GET",
  });
}

export async function getStudentWorkspace(groupId: string) {
  return apiRequest<StudentWorkspace>(`/student/groups/${groupId}/workspace`, {
    method: "GET",
  });
}

import { logger } from "../config/logger";
import { env } from "../config/env";
import { getGroup } from "./academicStore";
import {
  isScheduleOpen,
  listPublishedVersionsForGroup,
  toStudentVersionView,
} from "./assessmentStore";
import { listInsightsForStudent, listInsightsForTeacher, type InsightRecord } from "./insightsStore";
import { queryCorpus, type RetrievalCitation, type RetrievalHit } from "./ragStore";
import { detectGroupPatterns } from "./teacherBriefing";
import { briefCompletion, hasOpenAI } from "../lib/openai";
import type { TeacherBriefingPayload } from "./teacherBriefing";

export type PageContext = {
  page?: string | undefined;
  studentId?: string | undefined;
  studentName?: string | undefined;
  tab?: string | undefined;
  assessmentId?: string | undefined;
};

const MIN_RAG_SCORE = 0.25;

export type AgentToolRun = {
  name: string;
  ok: boolean;
  summary: string;
  data?: unknown;
};

export type AgentChatResult = {
  reply: string;
  tools: AgentToolRun[];
  citations: RetrievalCitation[];
  fallback: boolean;
};

export type BriefingQueryCard =
  | { kind: "note"; title?: string; body: string }
  | {
      kind: "insight_row";
      studentId: string;
      title: string;
      riskLevel: string;
      factors: string[];
    }
  | { kind: "corpus_row"; anchor: string; excerpt: string }
  | {
      kind: "pattern";
      patternType: string;
      description: string;
      suggestedAction: string;
      studentCount: number;
    };

export type BriefingQueryResult = {
  cards: BriefingQueryCard[];
  citations: RetrievalCitation[];
  fallback: boolean;
};

function isAgentTimeout(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "AGENT_TIMEOUT"
  );
}

async function raceTimeout<T>(work: () => Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error("Agent tools exceeded time budget"), { code: "AGENT_TIMEOUT" as const }));
    }, ms);
    Promise.resolve()
      .then(() => work())
      .then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
  });
}

function buildTeacherReply(message: string, insights: InsightRecord[], hits: RetrievalHit[], ctx?: PageContext): string {
  const lines: string[] = [];
  const focusStudent = ctx?.studentId;

  if (focusStudent) {
    const name = ctx?.studentName ?? focusStudent;
    lines.push(`**Context:** Viewing student profile for **${name}**.`);
  } else if (ctx?.page) {
    lines.push(`**Context:** ${ctx.page.replace(/-/g, " ")}${ctx.tab ? ` (${ctx.tab} tab)` : ""}.`);
  }
  lines.push("");

  if (insights.length > 0) {
    lines.push(focusStudent ? "**Insights for this student**" : "**Insights (teacher view)**");
    for (const ins of insights.slice(0, 6)) {
      const sev = ins.riskLevel.replace("_", " ");
      if (focusStudent) {
        lines.push(`- ${sev} — ${ins.title}. ${ins.factors.map((f) => f.message).join(" ")}`);
      } else {
        lines.push(`- Student ${ins.studentId}: ${sev} — ${ins.title}. ${ins.factors.map((f) => f.message).join(" ")}`);
      }
    }
    lines.push("");
    lines.push(
      focusStudent
        ? "**Recommendation:** Review the factors above and check the student's trend chart for recent changes."
        : "**Recommendation:** Prioritize follow-up for watchlist/at-risk rows; open the insights board to acknowledge or dismiss items as you act.",
    );
  } else {
    lines.push(
      focusStudent
        ? "No open insight cards for this student right now."
        : "No open insight cards for this group right now.",
    );
  }

  if (hits.length > 0) {
    lines.push("");
    lines.push("**Relevant course material**");
    for (const h of hits.slice(0, 3)) {
      lines.push(`- (${h.citation.sourceType}) ${h.citation.anchor}: ${h.text.slice(0, 160)}${h.text.length > 160 ? "…" : ""}`);
    }
  }

  return lines.join("\n");
}

export type StudentReplyReading = {
  title: string;
  sourceTitle: string;
  readerPath: string;
  highlightText: string;
  pageNumber?: number;
  chapterTitle?: string;
};

export type StudentAgentStructuredResult = AgentChatResult & {
  readings: StudentReplyReading[];
  suggestedAssessments: Array<{ id: string; title: string; link: string }>;
};

function buildStudentReply(
  message: string,
  insights: InsightRecord[],
  hits: RetrievalHit[],
  scheduleSummary: string,
  ctx?: PageContext,
): string {
  const lines: string[] = [];
  lines.push("Here is supportive guidance based on your enrollment and course materials.");
  lines.push("");

  if (insights.length > 0) {
    lines.push("**Your proactive nudges**");
    for (const ins of insights.slice(0, 4)) {
      lines.push(`- ${ins.title}: ${ins.factors.map((f) => f.message).join(" ")}`);
    }
    lines.push("");
  }

  lines.push("**Schedule context**");
  lines.push(scheduleSummary);

  if (hits.length > 0) {
    lines.push("");
    lines.push("**Material to review**");
    for (const h of hits.slice(0, 3)) {
      const loc = h.citation.textbookLocation;
      const locLabel = loc?.chapterTitle
        ? `${loc.chapterTitle}${loc.pageNumber ? ` p.${loc.pageNumber}` : ""}`
        : h.citation.anchor;
      lines.push(`- **${locLabel}**: ${h.text.slice(0, 200)}${h.text.length > 200 ? "…" : ""}`);
    }
  }

  lines.push("");
  lines.push("**Next steps:** Re-read the cited sections and attempt practice items. Ask your teacher if you are unsure about expectations.");
  return lines.join("\n");
}

function extractStudentReadings(hits: RetrievalHit[], groupId: string): StudentReplyReading[] {
  return hits
    .filter((h) => h.citation.readerPath && h.citation.textbookSourceId)
    .map((h) => {
      const readerPath = h.citation.readerPath!.includes("?")
        ? `${h.citation.readerPath!}&groupId=${encodeURIComponent(groupId)}`
        : `${h.citation.readerPath!}?groupId=${encodeURIComponent(groupId)}`;
      return {
        title: h.citation.textbookLocation?.chapterTitle ?? h.citation.anchor,
        sourceTitle: h.citation.sourceType === "textbook" ? "Course textbook" : "Course material",
        readerPath,
        highlightText: h.citation.highlightText ?? h.text.slice(0, 120),
        ...(h.citation.textbookLocation?.pageNumber !== undefined ? { pageNumber: h.citation.textbookLocation.pageNumber } : {}),
        ...(h.citation.textbookLocation?.chapterTitle !== undefined ? { chapterTitle: h.citation.textbookLocation.chapterTitle } : {}),
      };
    })
    .slice(0, 5);
}

export async function enrichTeacherBriefingWithOptionalLLM(
  payload: TeacherBriefingPayload,
): Promise<TeacherBriefingPayload> {
  const groupPatterns = await enrichGroupPatternsWithOptionalLLM(payload.groupPatterns);

  if (!hasOpenAI() || payload.students.length === 0) {
    return { ...payload, groupPatterns };
  }
  const input = payload.students.map((s) => ({
    studentId: s.studentId,
    riskLevel: s.riskLevel,
    insightType: s.insightType,
    factorCodes: s.factors.map((f) => f.code),
    recentScores: s.recentScores,
    templateReasoning: s.reasoning,
  }));
  const system =
    'You help teachers prioritize students. Given JSON rows, respond with ONLY a JSON object shaped as {"lines":[{"studentId":"...","reasoning":"one empathetic sentence, max 30 words"}]} — one reasoning per input row, same order, same studentIds. No markdown or extra keys.';
  const raw = await briefCompletion(system, JSON.stringify(input));
  if (!raw) {
    return { ...payload, groupPatterns };
  }
  try {
    const parsed = JSON.parse(raw) as { lines?: { studentId: string; reasoning: string }[] };
    if (!Array.isArray(parsed.lines) || parsed.lines.length === 0) {
      return { ...payload, groupPatterns };
    }
    const byId = new Map(parsed.lines.map((l) => [l.studentId, l.reasoning]));
    return {
      ...payload,
      groupPatterns,
      students: payload.students.map((s) => ({
        ...s,
        reasoning: byId.get(s.studentId)?.trim() || s.reasoning,
      })),
    };
  } catch {
    return { ...payload, groupPatterns };
  }
}

async function enrichGroupPatternsWithOptionalLLM(
  patterns: TeacherBriefingPayload["groupPatterns"],
): Promise<TeacherBriefingPayload["groupPatterns"]> {
  if (!hasOpenAI() || patterns.length === 0) return patterns;
  const raw = await briefCompletion(
    "Rewrite each pattern's description as one clearer sentence for a teacher (max 25 words). Respond ONLY JSON: {\"items\":[{\"description\":\"...\"}]} in the same order as input.",
    JSON.stringify(patterns.map((p) => ({ description: p.description, suggestedAction: p.suggestedAction }))),
  );
  if (!raw) return patterns;
  try {
    const parsed = JSON.parse(raw) as { items?: { description: string }[] };
    if (!Array.isArray(parsed.items) || parsed.items.length !== patterns.length) return patterns;
    return patterns.map((p, i) => ({
      ...p,
      description: parsed.items![i]!.description?.trim() || p.description,
    }));
  } catch {
    return patterns;
  }
}

export async function runTeacherBriefingQuery(params: {
  groupId: string;
  message: string;
  timeoutMs: number;
  requestId?: string;
  pageContext?: PageContext;
}): Promise<BriefingQueryResult> {
  const base = await runTeacherAgentChat({
    groupId: params.groupId,
    message: params.message,
    timeoutMs: params.timeoutMs,
    ...(params.pageContext !== undefined ? { pageContext: params.pageContext } : {}),
    ...(params.requestId !== undefined ? { requestId: params.requestId } : {}),
  });

  const cards: BriefingQueryCard[] = [{ kind: "note", title: "Assistant summary", body: base.reply }];

  const insightRun = base.tools.find((t) => t.name === "get_insights");
  if (insightRun?.ok && Array.isArray(insightRun.data)) {
    for (const ins of insightRun.data as InsightRecord[]) {
      if (ins.audience !== "teacher") continue;
      cards.push({
        kind: "insight_row",
        studentId: ins.studentId,
        title: ins.title,
        riskLevel: ins.riskLevel,
        factors: ins.factors.map((f) => f.message),
      });
    }
  }

  const searchRun = base.tools.find((t) => t.name === "search_corpus");
  if (searchRun?.ok && Array.isArray(searchRun.data)) {
    for (const h of searchRun.data as RetrievalHit[]) {
      const text = h.text;
      cards.push({
        kind: "corpus_row",
        anchor: h.citation.anchor,
        excerpt: text.length > 220 ? `${text.slice(0, 220)}…` : text,
      });
    }
  }

  for (const p of detectGroupPatterns(params.groupId)) {
    cards.push({
      kind: "pattern",
      patternType: p.patternType,
      description: p.description,
      suggestedAction: p.suggestedAction,
      studentCount: p.affectedStudentIds.length,
    });
  }

  return { cards, citations: base.citations, fallback: base.fallback };
}

export async function runTeacherAgentChat(params: {
  groupId: string;
  message: string;
  timeoutMs: number;
  requestId?: string;
  pageContext?: PageContext;
}): Promise<AgentChatResult> {
  const group = getGroup(params.groupId);
  if (!group) {
    const err = new Error("Group not found") as Error & { statusCode?: number; code?: string };
    err.statusCode = 404;
    err.code = "GROUP_NOT_FOUND";
    throw err;
  }

  const ctx = params.pageContext;
  const focusStudentId = ctx?.studentId;

  const doWork = async (): Promise<AgentChatResult> => {
    if (env.NODE_ENV === "test" && params.message.includes("__delay300__")) {
      await new Promise((r) => setTimeout(r, 300));
    }

    const tools: AgentToolRun[] = [];
    let allInsights = listInsightsForTeacher(params.groupId, {});
    if (focusStudentId) {
      const studentInsights = allInsights.filter((i) => i.studentId === focusStudentId);
      if (studentInsights.length > 0) allInsights = studentInsights;
    }
    tools.push({
      name: "get_insights",
      ok: true,
      summary: focusStudentId
        ? `${allInsights.length} insight(s) for student ${focusStudentId}`
        : `${allInsights.length} non-dismissed teacher insight(s)`,
      data: allInsights.slice(0, 15),
    });

    const hits = await queryCorpus({
      query: params.message,
      groupId: params.groupId,
      subjectId: group.subjectId,
      topK: 4,
      minScore: MIN_RAG_SCORE,
    });
    tools.push({
      name: "search_corpus",
      ok: true,
      summary: `${hits.length} retrieval hit(s)`,
      data: hits,
    });

    const reply = buildTeacherReply(params.message, allInsights, hits, ctx);
    return {
      reply,
      tools,
      citations: hits.map((h) => h.citation),
      fallback: false,
    };
  };

  try {
    return await raceTimeout(doWork, params.timeoutMs);
  } catch (err) {
    if (isAgentTimeout(err)) {
      logger.error(
        { requestId: params.requestId, groupId: params.groupId, role: "teacher" },
        "agent_orchestration_timeout",
      );
      return {
        reply:
          "I could not finish gathering class insights and sources in time. Please try again in a moment, or open the insights and course search pages directly.",
        tools: [{ name: "get_insights", ok: false, summary: "Timed out" }],
        citations: [],
        fallback: true,
      };
    }
    throw err;
  }
}

export async function runStudentAgentChat(params: {
  studentId: string;
  groupId: string;
  message: string;
  timeoutMs: number;
  requestId?: string;
  pageContext?: PageContext;
}): Promise<StudentAgentStructuredResult> {
  const group = getGroup(params.groupId);
  if (!group) {
    const err = new Error("Group not found") as Error & { statusCode?: number; code?: string };
    err.statusCode = 404;
    err.code = "GROUP_NOT_FOUND";
    throw err;
  }

  const doWork = async (): Promise<StudentAgentStructuredResult> => {
    if (env.NODE_ENV === "test" && params.message.includes("__delay300__")) {
      await new Promise((r) => setTimeout(r, 300));
    }

    const tools: AgentToolRun[] = [];

    const insights = listInsightsForStudent(params.studentId, params.groupId);
    tools.push({
      name: "get_my_insights",
      ok: true,
      summary: `${insights.length} student-facing insight(s)`,
      data: insights.slice(0, 10),
    });

    const versions = listPublishedVersionsForGroup(params.groupId);
    const openNow = versions.filter((v) => isScheduleOpen(v));
    const upcoming = versions.filter((v) => Date.parse(v.windowOpensAtUtc) > Date.now());
    const scheduleSummary = [
      `Open for submission now: ${openNow.map((v) => v.title).join(", ") || "none"}.`,
      `Upcoming windows: ${upcoming
        .slice(0, 5)
        .map((v) => `${v.title} (opens ${v.windowOpensAtUtc})`)
        .join("; ") || "none listed"}.`,
    ].join(" ");
    tools.push({
      name: "get_assessment_schedule",
      ok: true,
      summary: `${versions.length} published version(s) in this group`,
      data: {
        openNow: openNow.map((v) => toStudentVersionView(v)),
        upcoming: upcoming.slice(0, 5).map((v) => toStudentVersionView(v)),
      },
    });

    const hits = await queryCorpus({
      query: params.message,
      groupId: params.groupId,
      subjectId: group.subjectId,
      topK: 4,
      minScore: MIN_RAG_SCORE,
    });
    tools.push({
      name: "search_corpus",
      ok: true,
      summary: `${hits.length} retrieval hit(s)`,
      data: hits,
    });

    const readings = extractStudentReadings(hits, params.groupId);

    const suggestedAssessments = openNow.slice(0, 3).map((v) => ({
      id: v.id,
      title: v.title,
      link: `/student/assessments/take/${v.id}`,
    }));

    const reply = buildStudentReply(params.message, insights, hits, scheduleSummary, params.pageContext);
    return {
      reply,
      tools,
      citations: hits.map((h) => h.citation),
      fallback: false,
      readings,
      suggestedAssessments,
    };
  };

  try {
    return await raceTimeout(doWork, params.timeoutMs);
  } catch (err) {
    if (isAgentTimeout(err)) {
      logger.error(
        { requestId: params.requestId, groupId: params.groupId, role: "student" },
        "agent_orchestration_timeout",
      );
      return {
        reply:
          "I hit a time limit loading your schedule and materials. Please retry shortly, or check your class page for upcoming assessments and readings.",
        tools: [{ name: "get_assessment_schedule", ok: false, summary: "Timed out" }],
        citations: [],
        fallback: true,
        readings: [],
        suggestedAssessments: [],
      };
    }
    throw err;
  }
}

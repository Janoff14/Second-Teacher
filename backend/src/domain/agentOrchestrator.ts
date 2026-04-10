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

function buildTeacherReply(message: string, insights: InsightRecord[], hits: RetrievalHit[]): string {
  const lines: string[] = [];
  lines.push("Here is what I found using scoped class tools (not a free-form model reply).");
  lines.push("");
  if (insights.length > 0) {
    lines.push("**Insights (teacher view)**");
    for (const ins of insights.slice(0, 8)) {
      const sev = ins.riskLevel.replace("_", " ");
      lines.push(`- Student ${ins.studentId}: ${sev} — ${ins.title}. Factors: ${ins.factors.map((f) => f.message).join(" ")}`);
    }
    lines.push("");
    lines.push(
      "**Recommendation:** Prioritize follow-up for watchlist/at-risk rows; open the insights board to acknowledge or dismiss items as you act.",
    );
  } else {
    lines.push("No open insight cards for this group right now.");
  }
  lines.push("");
  if (hits.length > 0) {
    lines.push("**Course corpus (top matches)**");
    for (const h of hits.slice(0, 5)) {
      lines.push(`- (${h.citation.sourceType}) ${h.citation.anchor}: ${h.text.slice(0, 160)}${h.text.length > 160 ? "…" : ""}`);
    }
    lines.push("");
    lines.push("Use the citation anchors when citing material to students or in feedback.");
  } else {
    lines.push("No strong corpus matches for this prompt; consider broadening keywords or ingesting more sources.");
  }
  lines.push("");
  lines.push(`_Your question was:_ ${message.slice(0, 500)}${message.length > 500 ? "…" : ""}`);
  return lines.join("\n");
}

function buildStudentReply(
  message: string,
  insights: InsightRecord[],
  hits: RetrievalHit[],
  scheduleSummary: string,
): string {
  const lines: string[] = [];
  lines.push("Here is supportive guidance based only on your enrollment and course materials.");
  lines.push("");
  lines.push(
    "**Important:** I cannot predict whether you will pass or fail any assessment. Use this as a study guide, not a grade guarantee.",
  );
  lines.push("");
  if (insights.length > 0) {
    lines.push("**Your proactive nudges**");
    for (const ins of insights.slice(0, 5)) {
      lines.push(`- ${ins.title}: ${ins.factors.map((f) => f.message).join(" ")}`);
    }
    lines.push("");
  }
  lines.push("**Schedule context**");
  lines.push(scheduleSummary);
  lines.push("");
  if (hits.length > 0) {
    lines.push("**Material to review (with citations)**");
    for (const h of hits.slice(0, 5)) {
      lines.push(`- ${h.citation.anchor}: ${h.text.slice(0, 200)}${h.text.length > 200 ? "…" : ""}`);
    }
    lines.push("");
  }
  lines.push("**Next steps:** Re-read the cited sections, attempt practice items without fixating on scores, and ask your teacher if you are unsure about expectations.");
  lines.push("");
  lines.push(`_You asked:_ ${message.slice(0, 400)}${message.length > 400 ? "…" : ""}`);
  return lines.join("\n");
}

export async function runTeacherAgentChat(params: {
  groupId: string;
  message: string;
  timeoutMs: number;
  requestId?: string;
}): Promise<AgentChatResult> {
  const group = getGroup(params.groupId);
  if (!group) {
    const err = new Error("Group not found") as Error & { statusCode?: number; code?: string };
    err.statusCode = 404;
    err.code = "GROUP_NOT_FOUND";
    throw err;
  }

  const doWork = async (): Promise<AgentChatResult> => {
    if (env.NODE_ENV === "test" && params.message.includes("__delay300__")) {
      await new Promise((r) => setTimeout(r, 300));
    }

    const tools: AgentToolRun[] = [];
    const insights = listInsightsForTeacher(params.groupId, {});
    tools.push({
      name: "get_insights",
      ok: true,
      summary: `${insights.length} non-dismissed teacher insight(s)`,
      data: insights.slice(0, 15),
    });

    const hits = queryCorpus({
      query: params.message,
      groupId: params.groupId,
      subjectId: group.subjectId,
      topK: 6,
    });
    tools.push({
      name: "search_corpus",
      ok: true,
      summary: `${hits.length} retrieval hit(s)`,
      data: hits,
    });

    const reply = buildTeacherReply(params.message, insights, hits);
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
}): Promise<AgentChatResult> {
  const group = getGroup(params.groupId);
  if (!group) {
    const err = new Error("Group not found") as Error & { statusCode?: number; code?: string };
    err.statusCode = 404;
    err.code = "GROUP_NOT_FOUND";
    throw err;
  }

  const doWork = async (): Promise<AgentChatResult> => {
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

    const hits = queryCorpus({
      query: params.message,
      groupId: params.groupId,
      subjectId: group.subjectId,
      topK: 6,
    });
    tools.push({
      name: "search_corpus",
      ok: true,
      summary: `${hits.length} retrieval hit(s)`,
      data: hits,
    });

    const reply = buildStudentReply(params.message, insights, hits, scheduleSummary);
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
        { requestId: params.requestId, groupId: params.groupId, role: "student" },
        "agent_orchestration_timeout",
      );
      return {
        reply:
          "I hit a time limit loading your schedule and materials. Please retry shortly, or check your class page for upcoming assessments and readings.",
        tools: [{ name: "get_assessment_schedule", ok: false, summary: "Timed out" }],
        citations: [],
        fallback: true,
      };
    }
    throw err;
  }
}

import { Router } from "express";
import { z } from "zod";
import { canTeacherManageGroup, getGroup, isStudentInGroup, listEnrollmentsForGroup } from "../domain/academicStore";
import {
  createDraft,
  getDraft,
  getVersion,
  listAttemptsForVersion,
  listDrafts,
  listAttemptsForStudent,
  listPublishedVersionsForGroup,
  listStudentAttemptsInGroup,
  publishDraft,
  setDraftItems,
  submitAttempt,
  toStudentVersionView,
} from "../domain/assessmentStore";
import {
  refreshInsightsAfterAttempt,
  computeRiskFeatureSnapshot,
  classifyRiskFromSnapshot,
  listInsightsForTeacher,
} from "../domain/insightsStore";
import { enrichTeacherBriefingWithOptionalLLM } from "../domain/agentOrchestrator";
import { indexPublishedAssessmentVersion } from "../domain/ragStore";
import { buildTeacherBriefingPayload } from "../domain/teacherBriefing";
import { appendAuditLog } from "../domain/auditStore";
import { getUserById } from "../domain/userStore";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const assessmentsRouter = Router();

function inferAssessmentType(title: string): "practice" | "quiz" | "test" | "exam" | "assessment" {
  const normalized = title.trim().toLowerCase();
  if (normalized.startsWith("practice")) return "practice";
  if (normalized.startsWith("quiz")) return "quiz";
  if (normalized.startsWith("test")) return "test";
  if (normalized.startsWith("exam")) return "exam";
  return "assessment";
}

const createDraftSchema = z.object({
  groupId: z.string().min(1),
  title: z.string().min(1).optional(),
});

assessmentsRouter.post(
  "/assessments/drafts",
  requireAuth,
  requireRole(["admin", "teacher"]),
  validateBody(createDraftSchema),
  (req, res, next) => {
    try {
      const user = req.user!;
      const { groupId, title } = req.body as { groupId: string; title?: string };
      if (!canTeacherManageGroup(user.userId, user.role, groupId)) {
        const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const draft = createDraft(groupId, title?.trim() || "Untitled assessment", user.userId);
      res.status(201).json({ data: draft });
    } catch (e) {
      next(e);
    }
  },
);

assessmentsRouter.get("/assessments/drafts", requireAuth, requireRole(["admin", "teacher"]), (req, res, next) => {
  try {
    const user = req.user!;
    const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
    if (groupId && !canTeacherManageGroup(user.userId, user.role, groupId)) {
      const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
    let drafts = listDrafts(groupId);
    if (user.role === "teacher" && !groupId) {
      drafts = drafts.filter((draft) => canTeacherManageGroup(user.userId, user.role, draft.groupId));
    }
    res.status(200).json({ data: drafts });
  } catch (e) {
    next(e);
  }
});

assessmentsRouter.get("/assessments/drafts/:draftId", requireAuth, requireRole(["admin", "teacher"]), (req, res, next) => {
  try {
    const draftId = req.params.draftId;
    if (!draftId || Array.isArray(draftId)) {
      throw new Error("Draft id required");
    }
    const draft = getDraft(draftId);
    if (!draft) {
      const err = new Error("Draft not found") as Error & { statusCode?: number; code?: string };
      err.statusCode = 404;
      err.code = "DRAFT_NOT_FOUND";
      throw err;
    }
    const user = req.user!;
    if (!canTeacherManageGroup(user.userId, user.role, draft.groupId)) {
      const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
    res.status(200).json({ data: draft });
  } catch (e) {
    next(e);
  }
});

const draftItemsSchema = z.object({
  items: z
    .array(
      z.object({
        stem: z.string().min(1),
        options: z.record(z.string(), z.string()).refine((o) => Object.keys(o).length >= 2, "At least two options"),
        correctKey: z.string().min(1),
      }),
    )
    .min(1),
});

assessmentsRouter.put(
  "/assessments/drafts/:draftId/items",
  requireAuth,
  requireRole(["admin", "teacher"]),
  validateBody(draftItemsSchema),
  (req, res, next) => {
    try {
      const draftId = req.params.draftId;
      if (!draftId || Array.isArray(draftId)) {
        throw new Error("Draft id required");
      }
      const draft = getDraft(draftId);
      if (!draft) {
        const err = new Error("Draft not found") as Error & { statusCode?: number; code?: string };
        err.statusCode = 404;
        err.code = "DRAFT_NOT_FOUND";
        throw err;
      }
      const user = req.user!;
      if (!canTeacherManageGroup(user.userId, user.role, draft.groupId)) {
        const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const updated = setDraftItems(draftId, req.body.items);
      res.status(200).json({ data: updated });
    } catch (e) {
      next(e);
    }
  },
);

const publishSchema = z
  .object({
    windowOpensAtUtc: z.string().min(1).optional(),
    windowClosesAtUtc: z.string().min(1).optional(),
    windowTimezone: z.string().min(1).optional(),
    opensAt: z.string().min(1).optional(),
    closesAt: z.string().min(1).optional(),
    groupId: z.string().min(1).optional(),
  })
  .refine(
    (body) =>
      (body.windowOpensAtUtc && body.windowClosesAtUtc) ||
      (body.opensAt && body.closesAt),
    "Schedule window is required",
  );

assessmentsRouter.post(
  "/assessments/drafts/:draftId/publish",
  requireAuth,
  requireRole(["admin", "teacher"]),
  validateBody(publishSchema),
  async (req, res, next) => {
    try {
      const draftId = req.params.draftId;
      if (!draftId || Array.isArray(draftId)) {
        throw new Error("Draft id required");
      }
      const draft = getDraft(draftId);
      if (!draft) {
        const err = new Error("Draft not found") as Error & { statusCode?: number; code?: string };
        err.statusCode = 404;
        err.code = "DRAFT_NOT_FOUND";
        throw err;
      }
      const user = req.user!;
      if (!canTeacherManageGroup(user.userId, user.role, draft.groupId)) {
        const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const version = publishDraft(draftId, user.userId, {
        windowOpensAtUtc: (req.body.windowOpensAtUtc as string | undefined) ?? (req.body.opensAt as string),
        windowClosesAtUtc: (req.body.windowClosesAtUtc as string | undefined) ?? (req.body.closesAt as string),
        windowTimezone: (req.body.windowTimezone as string | undefined) ?? "UTC",
      });
      const group = getGroup(version.groupId);
      if (group) {
        await indexPublishedAssessmentVersion(version, group.subjectId);
      }
      appendAuditLog({
        ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
        actorId: user.userId,
        actorRole: user.role,
        action: "create_assessment",
        groupId: version.groupId,
        targetId: version.id,
        detail: `${version.title} assessment published`,
        meta: { draftId, itemCount: version.items.length },
      });
      res.status(201).json({ data: version });
    } catch (e) {
      next(e);
    }
  },
);

assessmentsRouter.get(
  "/groups/:groupId/results-summary",
  requireAuth,
  requireRole(["admin", "teacher"]),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      if (!groupId || Array.isArray(groupId)) {
        throw new Error("Group id required");
      }
      const user = req.user!;
      if (!canTeacherManageGroup(user.userId, user.role, groupId)) {
        const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }

      const enrolledCount = listEnrollmentsForGroup(groupId).length;
      const versions = listPublishedVersionsForGroup(groupId).sort(
        (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
      );

      const assessments = await Promise.all(
        versions.map(async (version) => {
          const attempts = listAttemptsForVersion(version.id).sort(
            (a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt),
          );
          const results = await Promise.all(
            attempts.map(async (attempt) => {
              const student = await getUserById(attempt.studentId);
              const scorePct =
                attempt.maxScore > 0
                  ? Math.round((attempt.totalScore / attempt.maxScore) * 1000) / 10
                  : 0;
              return {
                attemptId: attempt.id,
                studentId: attempt.studentId,
                studentName: student?.displayName ?? null,
                studentEmail: student?.email ?? null,
                submittedAt: attempt.submittedAt,
                totalScore: attempt.totalScore,
                maxScore: attempt.maxScore,
                scorePct,
              };
            }),
          );
          const averageScorePct =
            results.length > 0
              ? Math.round(
                  (results.reduce((sum, row) => sum + row.scorePct, 0) / results.length) * 10,
                ) / 10
              : null;
          const highestScorePct =
            results.length > 0 ? Math.max(...results.map((row) => row.scorePct)) : null;
          return {
            id: version.id,
            title: version.title,
            type: inferAssessmentType(version.title),
            publishedAt: version.publishedAt,
            windowOpensAtUtc: version.windowOpensAtUtc,
            windowClosesAtUtc: version.windowClosesAtUtc,
            windowTimezone: version.windowTimezone,
            itemCount: version.items.length,
            enrolledCount,
            attemptCount: results.length,
            averageScorePct,
            highestScorePct,
            latestSubmittedAt: results[0]?.submittedAt ?? null,
            results,
          };
        }),
      );

      const allResults = assessments.flatMap((assessment) => assessment.results);
      const overallAverageScorePct =
        allResults.length > 0
          ? Math.round(
              (allResults.reduce((sum, row) => sum + row.scorePct, 0) / allResults.length) * 10,
            ) / 10
          : null;

      res.status(200).json({
        data: {
          groupId,
          enrolledCount,
          assessmentCount: assessments.length,
          totalAttemptCount: allResults.length,
          overallAverageScorePct,
          assessments,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

assessmentsRouter.get(
  "/groups/:groupId/ai-briefing",
  requireAuth,
  requireRole(["admin", "teacher"]),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      if (!groupId || Array.isArray(groupId)) {
        throw new Error("Group id required");
      }
      const user = req.user!;
      if (!canTeacherManageGroup(user.userId, user.role, groupId)) {
        const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      let payload = await buildTeacherBriefingPayload(groupId);
      const enrichRaw = req.query.enrich;
      const enrich =
        enrichRaw === "1" ||
        enrichRaw === "true" ||
        (typeof enrichRaw === "string" && enrichRaw.toLowerCase() === "yes");
      if (enrich) {
        payload = await enrichTeacherBriefingWithOptionalLLM(payload);
      }
      res.status(200).json({ data: payload });
    } catch (e) {
      next(e);
    }
  },
);

assessmentsRouter.get(
  "/groups/:groupId/students/:studentId/profile",
  requireAuth,
  requireRole(["admin", "teacher"]),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId as string;
      const studentId = req.params.studentId as string;
      if (!groupId || !studentId) throw new Error("groupId and studentId required");
      const user = req.user!;
      if (!canTeacherManageGroup(user.userId, user.role, groupId)) {
        const err = new Error("Forbidden") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }

      const student = await getUserById(studentId);
      const snapshot = computeRiskFeatureSnapshot(studentId, groupId);
      const classification = classifyRiskFromSnapshot(snapshot);

      const rows = listStudentAttemptsInGroup(studentId, groupId);
      const versions = listPublishedVersionsForGroup(groupId);
      const versionMap = new Map(versions.map((v) => [v.id, v]));

      const attempts = rows.map((r) => {
        const v = versionMap.get(r.versionId);
        const scorePct =
          r.attempt.maxScore > 0
            ? Math.round((r.attempt.totalScore / r.attempt.maxScore) * 1000) / 10
            : 0;
        return {
          attemptId: r.attempt.id,
          versionId: r.versionId,
          assessmentTitle: v?.title ?? "Unknown",
          assessmentType: v ? inferAssessmentType(v.title) : "assessment",
          submittedAt: r.attempt.submittedAt,
          totalScore: r.attempt.totalScore,
          maxScore: r.attempt.maxScore,
          scorePct,
        };
      });

      const perAssessment = versions.map((v) => {
        const studentAttempts = rows
          .filter((r) => r.versionId === v.id)
          .map((r) => ({
            attemptId: r.attempt.id,
            submittedAt: r.attempt.submittedAt,
            totalScore: r.attempt.totalScore,
            maxScore: r.attempt.maxScore,
            scorePct:
              r.attempt.maxScore > 0
                ? Math.round((r.attempt.totalScore / r.attempt.maxScore) * 1000) / 10
                : 0,
          }));
        const allVersionAttempts = listAttemptsForVersion(v.id);
        const classAvg =
          allVersionAttempts.length > 0
            ? Math.round(
                (allVersionAttempts.reduce(
                  (s, a) => s + (a.maxScore > 0 ? a.totalScore / a.maxScore : 0),
                  0,
                ) /
                  allVersionAttempts.length) *
                  1000,
              ) / 10
            : null;
        return {
          versionId: v.id,
          title: v.title,
          type: inferAssessmentType(v.title),
          itemCount: v.items.length,
          classAveragePct: classAvg,
          studentAttempts,
          bestScorePct:
            studentAttempts.length > 0
              ? Math.max(...studentAttempts.map((a) => a.scorePct))
              : null,
          latestScorePct:
            studentAttempts.length > 0
              ? studentAttempts[studentAttempts.length - 1]!.scorePct
              : null,
        };
      });

      const insights = listInsightsForTeacher(groupId, { status: "all" }).filter(
        (i) => i.studentId === studentId,
      );

      res.status(200).json({
        data: {
          studentId,
          displayName: student?.displayName ?? null,
          email: student?.email ?? null,
          riskLevel: classification.level,
          riskConfidence: classification.confidence,
          riskFactors: classification.reasons,
          features: snapshot.features,
          totalAttempts: rows.length,
          overallAveragePct:
            rows.length > 0
              ? Math.round(
                  (rows.reduce(
                    (s, r) =>
                      s + (r.attempt.maxScore > 0 ? r.attempt.totalScore / r.attempt.maxScore : 0),
                    0,
                  ) /
                    rows.length) *
                    1000,
                ) / 10
              : null,
          attempts,
          perAssessment,
          insights: insights.map((i) => ({
            id: i.id,
            title: i.title,
            body: i.body,
            riskLevel: i.riskLevel,
            factors: i.factors,
            status: i.status,
            updatedAt: i.updatedAt,
          })),
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

assessmentsRouter.get(
  "/assessments/attempts/me",
  requireAuth,
  requireRole(["student"]),
  (req, res, next) => {
    try {
      const user = req.user!;
      const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
      if (!groupId) {
        const err = new Error("groupId is required") as Error & { statusCode?: number; code?: string };
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }
      if (!isStudentInGroup(user.userId, groupId)) {
        const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const versions = listPublishedVersionsForGroup(groupId);
      const data = versions.flatMap((version) =>
        listAttemptsForStudent(version.id, user.userId).map((attempt) => ({
          id: attempt.id,
          publishedAssessmentId: version.id,
          title: version.title,
          submittedAt: attempt.submittedAt,
          score: attempt.totalScore,
          maxScore: attempt.maxScore,
          scorePct: attempt.maxScore > 0 ? Math.round((attempt.totalScore / attempt.maxScore) * 1000) / 10 : 0,
          assessmentType: version.title,
        })),
      );
      data.sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
      res.status(200).json({ data });
    } catch (e) {
      next(e);
    }
  },
);

assessmentsRouter.get("/assessments/published", requireAuth, (req, res, next) => {
  try {
    const user = req.user!;
    const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;

    if (user.role === "student") {
      if (!groupId) {
        const err = new Error("groupId is required") as Error & { statusCode?: number; code?: string };
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }
      if (!isStudentInGroup(user.userId, groupId)) {
        const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const versions = listPublishedVersionsForGroup(groupId).map(toStudentVersionView);
      res.status(200).json({ data: versions });
      return;
    }

    if (!groupId) {
      const err = new Error("groupId is required") as Error & { statusCode?: number; code?: string };
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    if (!canTeacherManageGroup(user.userId, user.role, groupId)) {
      const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
    const versions = listPublishedVersionsForGroup(groupId);
    res.status(200).json({ data: versions });
  } catch (e) {
    next(e);
  }
});

assessmentsRouter.get("/assessments/published/:versionId", requireAuth, (req, res, next) => {
  try {
    const versionId = req.params.versionId;
    if (!versionId || Array.isArray(versionId)) {
      throw new Error("Version id required");
    }
    const version = getVersion(versionId);
    if (!version) {
      const err = new Error("Version not found") as Error & { statusCode?: number; code?: string };
      err.statusCode = 404;
      err.code = "VERSION_NOT_FOUND";
      throw err;
    }
    const user = req.user!;
    if (user.role === "student") {
      if (!isStudentInGroup(user.userId, version.groupId)) {
        const err = new Error("Forbidden") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      res.status(200).json({ data: toStudentVersionView(version) });
      return;
    }
    if (!canTeacherManageGroup(user.userId, user.role, version.groupId)) {
      const err = new Error("Forbidden for this group") as Error & { statusCode?: number; code?: string };
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
    res.status(200).json({ data: version });
  } catch (e) {
    next(e);
  }
});

const attemptSchema = z.object({
  answers: z.record(z.string(), z.string()),
});

assessmentsRouter.post(
  "/assessments/published/:versionId/attempts",
  requireAuth,
  requireRole(["student"]),
  validateBody(attemptSchema),
  (req, res, next) => {
    try {
      const versionId = req.params.versionId;
      if (!versionId || Array.isArray(versionId)) {
        throw new Error("Version id required");
      }
      const version = getVersion(versionId);
      if (!version) {
        const err = new Error("Version not found") as Error & { statusCode?: number; code?: string };
        err.statusCode = 404;
        err.code = "VERSION_NOT_FOUND";
        throw err;
      }
      const user = req.user!;
      if (!isStudentInGroup(user.userId, version.groupId)) {
        const err = new Error("Forbidden") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const attempt = submitAttempt(versionId, user.userId, req.body.answers as Record<string, string>);
      refreshInsightsAfterAttempt(user.userId, version.groupId);
      appendAuditLog({
        ...(req.requestId !== undefined ? { requestId: req.requestId } : {}),
        actorId: user.userId,
        actorRole: user.role,
        action: "submit_assessment",
        groupId: version.groupId,
        targetId: attempt.id,
        detail: `Assessment attempt submitted`,
        meta: { versionId, totalScore: attempt.totalScore, maxScore: attempt.maxScore },
      });
      res.status(201).json({ data: attempt });
    } catch (e) {
      next(e);
    }
  },
);

assessmentsRouter.get(
  "/assessments/published/:versionId/attempts/me",
  requireAuth,
  requireRole(["student"]),
  (req, res, next) => {
    try {
      const versionId = req.params.versionId;
      if (!versionId || Array.isArray(versionId)) {
        throw new Error("Version id required");
      }
      const version = getVersion(versionId);
      if (!version) {
        const err = new Error("Version not found") as Error & { statusCode?: number; code?: string };
        err.statusCode = 404;
        err.code = "VERSION_NOT_FOUND";
        throw err;
      }
      const user = req.user!;
      if (!isStudentInGroup(user.userId, version.groupId)) {
        const err = new Error("Forbidden") as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
      const attempts = listAttemptsForStudent(versionId, user.userId);
      res.status(200).json({ data: attempts });
    } catch (e) {
      next(e);
    }
  },
);

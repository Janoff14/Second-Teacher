import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { resetAcademicStoreForTest } from "../src/domain/academicStore";
import { resetAssessmentStoreForTest } from "../src/domain/assessmentStore";
import { resetInsightsStoreForTest } from "../src/domain/insightsStore";
import { resetAuditStoreForTest } from "../src/domain/auditStore";
import { resetRagStoreForTest } from "../src/domain/ragStore";
import { TEST_DEFAULT_USER_PASSWORD, resetUsersForTest, seedDefaultUsers } from "../src/domain/userStore";
import { resetRateLimitForTest } from "../src/middleware/rateLimit";

describe("backend bootstrap and auth/rbac baseline", () => {
  beforeEach(async () => {
    resetUsersForTest();
    resetAcademicStoreForTest();
    resetAssessmentStoreForTest();
    resetInsightsStoreForTest();
    resetRagStoreForTest();
    resetAuditStoreForTest();
    resetRateLimitForTest();
    await seedDefaultUsers();
  });

  it("returns health status", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("returns request id header", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("normalizes unknown route errors", async () => {
    const app = createApp();
    const res = await request(app).get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.requestId).toBeTruthy();
  });

  it("supports login and role-protected route access", async () => {
    const app = createApp();
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "teacher@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.token).toBeTruthy();

    const token = loginRes.body.data.token as string;
    const protectedRes = await request(app)
      .get("/protected/teacher")
      .set("Authorization", `Bearer ${token}`);

    expect(protectedRes.status).toBe(200);
    expect(protectedRes.body.data.user.role).toBe("teacher");
  });

  it("lets admin create a teacher with display name and list teachers", async () => {
    const app = createApp();
    const adminLogin = await request(app)
      .post("/auth/login")
      .send({ email: "admin@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });
    const adminToken = adminLogin.body.data.token as string;

    const createRes = await request(app)
      .post("/users/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "new-teacher@secondteacher.dev",
        password: "Welcome123!",
        displayName: "Jane Coach",
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.user.displayName).toBe("Jane Coach");
    expect(createRes.body.data.user.role).toBe("teacher");

    const listRes = await request(app).get("/users/teachers").set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    const rows = listRes.body.data as Array<{ email: string; displayName: string | null }>;
    expect(rows.some((r) => r.email === "new-teacher@secondteacher.dev" && r.displayName === "Jane Coach")).toBe(
      true,
    );
  });

  it("returns teacher academic scope with owned subjects and groups", async () => {
    const app = createApp();
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "teacher@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });
    const token = loginRes.body.data.token as string;

    const emptyScope = await request(app)
      .get("/teacher/academic-scope")
      .set("Authorization", `Bearer ${token}`);
    expect(emptyScope.status).toBe(200);
    expect(emptyScope.body.data.subjects).toEqual([]);

    const subjectRes = await request(app)
      .post("/subjects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Scope Test Subject" });
    expect(subjectRes.status).toBe(201);
    const subjectId = subjectRes.body.data.id as string;

    const groupRes = await request(app)
      .post("/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ subjectId, name: "Scope Test Group" });
    expect(groupRes.status).toBe(201);

    const scope = await request(app)
      .get("/teacher/academic-scope")
      .set("Authorization", `Bearer ${token}`);
    expect(scope.status).toBe(200);
    const blocks = scope.body.data.subjects as Array<{ subject: { id: string }; groups: Array<{ id: string }> }>;
    expect(blocks.length).toBe(1);
    expect(blocks[0].subject.id).toBe(subjectId);
    expect(blocks[0].groups.length).toBe(1);
  });

  it("blocks user without required role", async () => {
    const app = createApp();
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "student@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });

    const token = loginRes.body.data.token as string;

    const protectedRes = await request(app)
      .get("/protected/teacher")
      .set("Authorization", `Bearer ${token}`);

    expect(protectedRes.status).toBe(403);
    expect(protectedRes.body.error.code).toBe("FORBIDDEN");
  });

  it("creates subject/group and enrolls student via join code", async () => {
    const app = createApp();
    const teacherLogin = await request(app)
      .post("/auth/login")
      .send({ email: "teacher@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });
    const teacherToken = teacherLogin.body.data.token as string;

    const subjectRes = await request(app)
      .post("/subjects")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ name: "Mathematics" });
    expect(subjectRes.status).toBe(201);

    const groupRes = await request(app)
      .post("/groups")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ subjectId: subjectRes.body.data.id, name: "Group A" });
    expect(groupRes.status).toBe(201);

    const joinCodeRes = await request(app)
      .post(`/groups/${groupRes.body.data.id}/join-codes`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    expect(joinCodeRes.status).toBe(201);
    const code = joinCodeRes.body.data.code as string;
    expect(code.length).toBeGreaterThanOrEqual(8);

    const previewRes = await request(app).post("/enrollment/preview").send({ code });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.data.subjectName).toBe("Mathematics");
    expect(previewRes.body.data.teacherDisplayName).toBe("Demo Teacher");

    const signupRes = await request(app)
      .post("/auth/signup-with-join-code")
      .send({ code, email: "new-student@secondteacher.dev", password: "Welcome123!" });
    expect(signupRes.status).toBe(201);
    expect(signupRes.body.data.user.role).toBe("student");
  });

  it("publishes assessment and lets student submit during open window", async () => {
    const app = createApp();
    const teacherLogin = await request(app)
      .post("/auth/login")
      .send({ email: "teacher@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });
    const teacherToken = teacherLogin.body.data.token as string;

    const subjectRes = await request(app)
      .post("/subjects")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ name: "Science" });
    expect(subjectRes.status).toBe(201);

    const groupRes = await request(app)
      .post("/groups")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ subjectId: subjectRes.body.data.id, name: "Lab 1" });
    expect(groupRes.status).toBe(201);
    const groupId = groupRes.body.data.id as string;

    const joinCodeRes = await request(app)
      .post(`/groups/${groupId}/join-codes`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    expect(joinCodeRes.status).toBe(201);
    const code = joinCodeRes.body.data.code as string;

    const signupRes = await request(app)
      .post("/auth/signup-with-join-code")
      .send({ code, email: "assess-student@secondteacher.dev", password: "Welcome123!" });
    expect(signupRes.status).toBe(201);
    const studentToken = signupRes.body.data.token as string;

    const draftRes = await request(app)
      .post("/assessments/drafts")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ groupId, title: "Quiz 1" });
    expect(draftRes.status).toBe(201);
    const draftId = draftRes.body.data.id as string;

    const itemsRes = await request(app)
      .put(`/assessments/drafts/${draftId}/items`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        items: [
          {
            stem: "2+2?",
            options: { A: "3", B: "4" },
            correctKey: "B",
          },
          {
            stem: "Capital of France?",
            options: { A: "London", B: "Paris" },
            correctKey: "B",
          },
        ],
      });
    expect(itemsRes.status).toBe(200);

    const opens = new Date(Date.now() - 3_600_000).toISOString();
    const closes = new Date(Date.now() + 3_600_000).toISOString();
    const publishRes = await request(app)
      .post(`/assessments/drafts/${draftId}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        windowOpensAtUtc: opens,
        windowClosesAtUtc: closes,
        windowTimezone: "UTC",
      });
    expect(publishRes.status).toBe(201);
    const versionId = publishRes.body.data.id as string;

    const teacherVersionRes = await request(app)
      .get(`/assessments/published/${versionId}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(teacherVersionRes.status).toBe(200);
    expect(teacherVersionRes.body.data.items[0]).toHaveProperty("correctKey");

    const listRes = await request(app)
      .get(`/assessments/published?groupId=${encodeURIComponent(groupId)}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    const studentVersionRes = await request(app)
      .get(`/assessments/published/${versionId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(studentVersionRes.status).toBe(200);
    const items = studentVersionRes.body.data.items as Array<{ id: string; stem: string; options: Record<string, string> }>;
    expect(items[0]).not.toHaveProperty("correctKey");
    const answers: Record<string, string> = {};
    for (const item of items) {
      answers[item.id] = "B";
    }

    const attemptRes = await request(app)
      .post(`/assessments/published/${versionId}/attempts`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ answers });
    expect(attemptRes.status).toBe(201);
    expect(attemptRes.body.data.totalScore).toBe(2);
    expect(attemptRes.body.data.maxScore).toBe(2);

    const myAttemptsRes = await request(app)
      .get(`/assessments/published/${versionId}/attempts/me`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(myAttemptsRes.status).toBe(200);
    expect(myAttemptsRes.body.data).toHaveLength(1);
  });

  it("blocks student from draft routes and submission when schedule is closed", async () => {
    const app = createApp();
    const teacherLogin = await request(app)
      .post("/auth/login")
      .send({ email: "teacher@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });
    const teacherToken = teacherLogin.body.data.token as string;

    const subjectRes = await request(app)
      .post("/subjects")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ name: "History" });
    const groupRes = await request(app)
      .post("/groups")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ subjectId: subjectRes.body.data.id, name: "Section A" });
    const groupId = groupRes.body.data.id as string;

    const joinCodeRes = await request(app)
      .post(`/groups/${groupId}/join-codes`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    const signupRes = await request(app)
      .post("/auth/signup-with-join-code")
      .send({ code: joinCodeRes.body.data.code, email: "closed-win@secondteacher.dev", password: "Welcome123!" });
    const studentToken = signupRes.body.data.token as string;

    const draftRes = await request(app)
      .post("/assessments/drafts")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ groupId, title: "Closed quiz" });
    const draftId = draftRes.body.data.id as string;

    await request(app)
      .put(`/assessments/drafts/${draftId}/items`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        items: [{ stem: "One?", options: { A: "no", B: "yes" }, correctKey: "B" }],
      });

    const opens = new Date(Date.now() - 7_200_000).toISOString();
    const closes = new Date(Date.now() - 3_600_000).toISOString();
    const publishRes = await request(app)
      .post(`/assessments/drafts/${draftId}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        windowOpensAtUtc: opens,
        windowClosesAtUtc: closes,
        windowTimezone: "UTC",
      });
    const versionId = publishRes.body.data.id as string;

    const studentVersionRes = await request(app)
      .get(`/assessments/published/${versionId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    const itemId = (studentVersionRes.body.data.items as Array<{ id: string }>)[0].id;

    const draftGet = await request(app)
      .get(`/assessments/drafts/${draftId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(draftGet.status).toBe(403);

    const attemptRes = await request(app)
      .post(`/assessments/published/${versionId}/attempts`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ answers: { [itemId]: "B" } });
    expect(attemptRes.status).toBe(403);
    expect(attemptRes.body.error.code).toBe("SCHEDULE_CLOSED");
  });

  it("computes risk snapshots, surfaces insights, emits deduped notifications, and supports status updates", async () => {
    const app = createApp();
    const teacherLogin = await request(app)
      .post("/auth/login")
      .send({ email: "teacher@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });
    const teacherToken = teacherLogin.body.data.token as string;

    const subjectRes = await request(app)
      .post("/subjects")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ name: "Analytics" });
    const groupRes = await request(app)
      .post("/groups")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ subjectId: subjectRes.body.data.id, name: "Risk cohort" });
    const groupId = groupRes.body.data.id as string;

    const joinRes = await request(app)
      .post(`/groups/${groupId}/join-codes`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    const signupRes = await request(app)
      .post("/auth/signup-with-join-code")
      .send({ code: joinRes.body.data.code, email: "risk-student@secondteacher.dev", password: "Welcome123!" });
    expect(signupRes.status).toBe(201);
    const studentToken = signupRes.body.data.token as string;
    const studentId = signupRes.body.data.user.id as string;

    const draftRes = await request(app)
      .post("/assessments/drafts")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ groupId, title: "Risk probe" });
    const draftId = draftRes.body.data.id as string;

    await request(app)
      .put(`/assessments/drafts/${draftId}/items`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        items: [{ stem: "Pick correct", options: { A: "wrong", B: "right" }, correctKey: "B" }],
      });

    const opens = new Date(Date.now() - 3_600_000).toISOString();
    const closes = new Date(Date.now() + 3_600_000).toISOString();
    const publishRes = await request(app)
      .post(`/assessments/drafts/${draftId}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        windowOpensAtUtc: opens,
        windowClosesAtUtc: closes,
        windowTimezone: "UTC",
      });
    const versionId = publishRes.body.data.id as string;

    const ver = await request(app)
      .get(`/assessments/published/${versionId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    const itemId = (ver.body.data.items as Array<{ id: string }>)[0].id;

    await request(app)
      .post(`/assessments/published/${versionId}/attempts`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ answers: { [itemId]: "A" } });

    const risk1 = await request(app)
      .get(`/analytics/risk?studentId=${encodeURIComponent(studentId)}&groupId=${encodeURIComponent(groupId)}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(risk1.status).toBe(200);
    expect(risk1.body.data.classification.level).toBe("stable");

    await request(app)
      .post(`/assessments/published/${versionId}/attempts`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ answers: { [itemId]: "A" } });

    const risk2 = await request(app)
      .get(`/analytics/risk?studentId=${encodeURIComponent(studentId)}&groupId=${encodeURIComponent(groupId)}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(risk2.status).toBe(200);
    expect(risk2.body.data.classification.level).toBe("at_risk");

    const insightsRes = await request(app)
      .get(`/insights?groupId=${encodeURIComponent(groupId)}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(insightsRes.status).toBe(200);
    const teacherRows = insightsRes.body.data as Array<{ id: string; riskLevel: string; studentId: string }>;
    expect(teacherRows.some((r) => r.studentId === studentId && r.riskLevel === "at_risk")).toBe(true);

    const studentInsights = await request(app)
      .get(`/insights/me?groupId=${encodeURIComponent(groupId)}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(studentInsights.status).toBe(200);
    expect((studentInsights.body.data as unknown[]).length).toBeGreaterThan(0);

    const teacherNotifs2 = await request(app)
      .get("/notifications/me")
      .set("Authorization", `Bearer ${teacherToken}`);
    const studentNotifs2 = await request(app)
      .get("/notifications/me")
      .set("Authorization", `Bearer ${studentToken}`);
    expect((teacherNotifs2.body.data as unknown[]).length).toBeGreaterThan(0);
    expect((studentNotifs2.body.data as unknown[]).length).toBeGreaterThan(0);
    const teacherCount2 = (teacherNotifs2.body.data as unknown[]).length;

    await request(app)
      .post(`/assessments/published/${versionId}/attempts`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ answers: { [itemId]: "A" } });

    const teacherNotifs3 = await request(app)
      .get("/notifications/me")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect((teacherNotifs3.body.data as unknown[]).length).toBe(teacherCount2);

    const teacherInsightId = teacherRows.find((r) => r.studentId === studentId)!.id;
    const ack = await request(app)
      .post(`/insights/${teacherInsightId}/status`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ status: "acknowledged" });
    expect(ack.status).toBe(200);
    expect(ack.body.data.status).toBe("acknowledged");

    const studentInsightId = (studentInsights.body.data as Array<{ id: string }>)[0].id;
    const dismiss = await request(app)
      .post(`/insights/${studentInsightId}/status`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ status: "dismissed" });
    expect(dismiss.status).toBe(200);

    const studentInsightsAfter = await request(app)
      .get(`/insights/me?groupId=${encodeURIComponent(groupId)}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect((studentInsightsAfter.body.data as unknown[]).length).toBe(0);
  });

  it("ingests textbook chunks, indexes published assessments, ACL-filters retrieval, and supersedes stale versions", async () => {
    const app = createApp();
    const teacherLogin = await request(app)
      .post("/auth/login")
      .send({ email: "teacher@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });
    const teacherToken = teacherLogin.body.data.token as string;

    const subjectRes = await request(app)
      .post("/subjects")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ name: "RAG Subject" });
    const subjectId = subjectRes.body.data.id as string;

    const ingestRes = await request(app)
      .post("/rag/sources/textbooks")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        subjectId,
        title: "Intro",
        versionLabel: "2026.1",
        text:
          "# Chapter 1: Light\n" +
          "Photosynthesis converts photonsgravitydummy into chemical energy. Chlorophyll absorbs light.\n\n" +
          "Plants also regulate gas exchange through stomata.",
      });
    expect(ingestRes.status).toBe(201);
    expect(ingestRes.body.data.chunksCreated).toBeGreaterThan(0);

    const groupRes = await request(app)
      .post("/groups")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ subjectId, name: "RAG Group" });
    const groupId = groupRes.body.data.id as string;

    const joinRes = await request(app)
      .post(`/groups/${groupId}/join-codes`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    const signupRes = await request(app)
      .post("/auth/signup-with-join-code")
      .send({ code: joinRes.body.data.code, email: "rag-student@secondteacher.dev", password: "Welcome123!" });
    const studentToken = signupRes.body.data.token as string;

    const draftRes = await request(app)
      .post("/assessments/drafts")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ groupId, title: "RAG Quiz" });
    const draftId = draftRes.body.data.id as string;

    await request(app)
      .put(`/assessments/drafts/${draftId}/items`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        items: [
          {
            stem: "UniqueAlphaStem xyzzyone",
            options: { A: "no", B: "yes" },
            correctKey: "B",
          },
        ],
      });

    const opens = new Date(Date.now() - 3_600_000).toISOString();
    const closes = new Date(Date.now() + 3_600_000).toISOString();
    await request(app)
      .post(`/assessments/drafts/${draftId}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        windowOpensAtUtc: opens,
        windowClosesAtUtc: closes,
        windowTimezone: "UTC",
      });

    const q1 = await request(app)
      .post("/rag/query")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ query: "Photosynthesis photonsgravitydummy", groupId });
    expect(q1.status).toBe(200);
    const hits1 = q1.body.data as Array<{
      citation: {
        sourceType: string;
        readerPath?: string;
        textbookLocation?: {
          paragraphId: string;
          sentenceStart: number;
          sentenceEnd: number;
          chapterNumber: number;
        };
      };
      text: string;
    }>;
    expect(hits1.some((h) => h.citation.sourceType === "textbook")).toBe(true);
    const textbookHit = hits1.find((h) => h.citation.sourceType === "textbook");
    expect(textbookHit?.citation.readerPath).toMatch(/^\/reader\/textbooks\/tbs_/);
    expect(textbookHit?.citation.textbookLocation?.chapterNumber).toBe(1);

    const readerRes = await request(app)
      .get("/reader/textbooks/tbs_1")
      .query({
        groupId,
        paragraphId: textbookHit?.citation.textbookLocation?.paragraphId,
        sentenceStart: textbookHit?.citation.textbookLocation?.sentenceStart,
        sentenceEnd: textbookHit?.citation.textbookLocation?.sentenceEnd,
      })
      .set("Authorization", `Bearer ${studentToken}`);
    expect(readerRes.status).toBe(200);
    expect(readerRes.body.data.source.id).toBe("tbs_1");
    expect((readerRes.body.data.chapters as unknown[]).length).toBeGreaterThan(0);
    expect((readerRes.body.data.paragraphs as unknown[]).length).toBeGreaterThan(0);
    expect(readerRes.body.data.focus).not.toBeNull();

    const q2 = await request(app)
      .post("/rag/query")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ query: "UniqueAlphaStem xyzzyone", groupId });
    expect(q2.status).toBe(200);
    const hits2 = q2.body.data as Array<{ citation: { sourceType: string; assessmentVersionId?: string } }>;
    expect(hits2.some((h) => h.citation.sourceType === "assessment_version")).toBe(true);

    await request(app)
      .put(`/assessments/drafts/${draftId}/items`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        items: [
          {
            stem: "UniqueBetaStem xyzzytwo",
            options: { A: "no", B: "yes" },
            correctKey: "B",
          },
        ],
      });

    await request(app)
      .post(`/assessments/drafts/${draftId}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        windowOpensAtUtc: opens,
        windowClosesAtUtc: closes,
        windowTimezone: "UTC",
      });

    const q3 = await request(app)
      .post("/rag/query")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ query: "UniqueAlphaStem xyzzyone", groupId });
    const hits3 = q3.body.data as Array<{ text: string; citation: { sourceType: string } }>;
    const assessmentTexts = hits3.filter((h) => h.citation.sourceType === "assessment_version").map((h) => h.text);
    expect(assessmentTexts.some((t) => t.includes("UniqueAlphaStem"))).toBe(false);

    const q4 = await request(app)
      .post("/rag/query")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ query: "UniqueBetaStem xyzzytwo", groupId });
    const hits4 = q4.body.data as Array<{ text: string; citation: { sourceType: string } }>;
    expect(
      hits4.filter((h) => h.citation.sourceType === "assessment_version").some((h) => h.text.includes("UniqueBetaStem")),
    ).toBe(true);

    const otherGroup = await request(app)
      .post("/groups")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ subjectId, name: "Other" });
    const otherJoin = await request(app)
      .post(`/groups/${otherGroup.body.data.id}/join-codes`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    const otherStudent = await request(app)
      .post("/auth/signup-with-join-code")
      .send({ code: otherJoin.body.data.code, email: "rag-other@secondteacher.dev", password: "Welcome123!" });

    const leak = await request(app)
      .post("/rag/query")
      .set("Authorization", `Bearer ${otherStudent.body.data.token}`)
      .send({ query: "UniqueBetaStem xyzzytwo", groupId });
    expect(leak.status).toBe(403);
  });

  it("stores uploaded textbook assets for the embedded reader and serves them back with auth", async () => {
    const app = createApp();
    const teacherLogin = await request(app)
      .post("/auth/login")
      .send({ email: "teacher@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });
    const teacherToken = teacherLogin.body.data.token as string;

    const subjectRes = await request(app)
      .post("/subjects")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ name: "Reader Uploads" });
    const subjectId = subjectRes.body.data.id as string;

    const groupRes = await request(app)
      .post("/groups")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ subjectId, name: "Reader Group" });
    const groupId = groupRes.body.data.id as string;

    const uploadRes = await request(app)
      .post("/rag/sources/textbooks/upload")
      .set("Authorization", `Bearer ${teacherToken}`)
      .field("subjectId", subjectId)
      .field("title", "Reader Upload")
      .field("versionLabel", "2026.2")
      .attach("file", Buffer.from("Chapter 1\nCells store information.\n\nChapter 2\nCells divide."), {
        filename: "reader-upload.txt",
        contentType: "text/plain",
      });

    expect(uploadRes.status).toBe(201);
    const sourceId = uploadRes.body.data.source.id as string;

    const readerRes = await request(app)
      .get(`/reader/textbooks/${sourceId}`)
      .query({ groupId })
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(readerRes.status).toBe(200);
    expect(readerRes.body.data.asset.available).toBe(true);
    expect(readerRes.body.data.asset.mimeType).toContain("text/plain");
    expect(readerRes.body.data.asset.fileName).toBe("reader-upload.txt");
    expect(readerRes.body.data.source.assetAvailable).toBe(true);

    const assetRes = await request(app)
      .get(`/reader/textbooks/${sourceId}/asset`)
      .query({ groupId })
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(assetRes.status).toBe(200);
    expect(assetRes.headers["content-type"]).toContain("text/plain");
    expect(assetRes.headers["content-disposition"]).toContain("inline");
    expect(assetRes.text).toContain("Chapter 1");
    expect(assetRes.text).toContain("Chapter 2");
  });

  it("runs teacher and student agent chats with scoped tools, timeout fallback, and audit entries", async () => {
    const app = createApp();
    const teacherLogin = await request(app)
      .post("/auth/login")
      .send({ email: "teacher@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });
    const teacherToken = teacherLogin.body.data.token as string;

    const subjectRes = await request(app)
      .post("/subjects")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ name: "Agent course" });
    const groupRes = await request(app)
      .post("/groups")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ subjectId: subjectRes.body.data.id, name: "Agent section" });
    const groupId = groupRes.body.data.id as string;

    const tChat = await request(app)
      .post("/agent/teacher/chat")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ message: "What should I prioritize this week?", groupId });
    expect(tChat.status).toBe(200);
    const teacherToolNames = (tChat.body.data.tools as Array<{ name: string }>).map((t) => t.name);
    expect(teacherToolNames).toEqual(expect.arrayContaining(["get_insights", "search_corpus"]));
    expect(tChat.body.data.fallback).toBe(false);

    const joinRes = await request(app)
      .post(`/groups/${groupId}/join-codes`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    const signupRes = await request(app)
      .post("/auth/signup-with-join-code")
      .send({ code: joinRes.body.data.code, email: "agent-pupil@secondteacher.dev", password: "Welcome123!" });
    const studentToken = signupRes.body.data.token as string;

    const sChat = await request(app)
      .post("/agent/student/chat")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ message: "How should I prepare?", groupId });
    expect(sChat.status).toBe(200);
    const studentToolNames = (sChat.body.data.tools as Array<{ name: string }>).map((t) => t.name);
    expect(studentToolNames).toEqual(
      expect.arrayContaining(["get_my_insights", "get_assessment_schedule", "search_corpus"]),
    );
    expect(sChat.body.data.reply as string).toMatch(/cannot predict whether you will pass/i);

    const slow = await request(app)
      .post("/agent/student/chat")
      .set("Authorization", `Bearer ${studentToken}`)
      .set("x-test-agent-timeout-ms", "20")
      .send({ message: "trigger __delay300__ please", groupId });
    expect(slow.status).toBe(200);
    expect(slow.body.data.fallback).toBe(true);

    const adminLogin = await request(app)
      .post("/auth/login")
      .send({ email: "admin@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });
    const adminToken = adminLogin.body.data.token as string;
    const audits = await request(app).get("/audit/logs").set("Authorization", `Bearer ${adminToken}`);
    expect(audits.status).toBe(200);
    const actions = (audits.body.data as Array<{ action: string }>).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["AGENT_TEACHER_CHAT", "AGENT_STUDENT_CHAT"]));
  });

  it("audits analytics risk views and restricts audit export to admins", async () => {
    const app = createApp();
    const teacherLogin = await request(app)
      .post("/auth/login")
      .send({ email: "teacher@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });
    const teacherToken = teacherLogin.body.data.token as string;

    const subjectRes = await request(app)
      .post("/subjects")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ name: "Audit course" });
    const groupRes = await request(app)
      .post("/groups")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ subjectId: subjectRes.body.data.id, name: "Audit section" });
    const groupId = groupRes.body.data.id as string;

    const joinRes = await request(app)
      .post(`/groups/${groupId}/join-codes`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    const signupRes = await request(app)
      .post("/auth/signup-with-join-code")
      .send({ code: joinRes.body.data.code, email: "audit-pupil@secondteacher.dev", password: "Welcome123!" });
    const studentId = signupRes.body.data.user.id as string;

    const risk = await request(app)
      .get(`/analytics/risk?studentId=${encodeURIComponent(studentId)}&groupId=${encodeURIComponent(groupId)}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(risk.status).toBe(200);

    const teacherAudit = await request(app).get("/audit/logs").set("Authorization", `Bearer ${teacherToken}`);
    expect(teacherAudit.status).toBe(403);

    const adminLogin = await request(app)
      .post("/auth/login")
      .send({ email: "admin@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });
    const adminToken = adminLogin.body.data.token as string;
    const logs = await request(app)
      .get("/audit/logs?action=ANALYTICS_RISK_VIEW")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(logs.status).toBe(200);
    expect((logs.body.data as unknown[]).length).toBeGreaterThan(0);

    const exportRes = await request(app).get("/audit/logs/export").set("Authorization", `Bearer ${adminToken}`);
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers["content-disposition"]).toMatch(/attachment/);
  });

  it("writes required academic audit actions and returns frontend-friendly log shape", async () => {
    const app = createApp();
    const adminLogin = await request(app)
      .post("/auth/login")
      .send({ email: "admin@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });
    const adminToken = adminLogin.body.data.token as string;

    const registerRes = await request(app).post("/auth/register").send({
      email: "audit-register@secondteacher.dev",
      password: "Welcome123!",
      role: "student",
      displayName: "Audit Student",
    });
    expect(registerRes.status).toBe(201);

    const teacherRes = await request(app)
      .post("/users/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "audit-teacher@secondteacher.dev",
        password: "Welcome123!",
        displayName: "Audit Teacher",
      });
    expect(teacherRes.status).toBe(201);
    const teacherId = teacherRes.body.data.user.id as string;

    const subjectRes = await request(app)
      .post("/subjects")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Audit Subject" });
    expect(subjectRes.status).toBe(201);

    const groupRes = await request(app)
      .post("/groups")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ subjectId: subjectRes.body.data.id, name: "Audit Group" });
    expect(groupRes.status).toBe(201);
    const groupId = groupRes.body.data.id as string;

    const assignRes = await request(app)
      .post(`/groups/${groupId}/assign-teacher`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ teacherId });
    expect(assignRes.status).toBe(201);

    const logsRes = await request(app).get("/audit/logs?limit=200").set("Authorization", `Bearer ${adminToken}`);
    expect(logsRes.status).toBe(200);
    const rows = logsRes.body.data as Array<{
      id: string;
      actorId: string;
      action: string;
      groupId?: string;
      targetId?: string;
      detail: string;
      meta: Record<string, unknown>;
      createdAt: string;
    }>;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toMatchObject({
      id: expect.any(String),
      actorId: expect.any(String),
      action: expect.any(String),
      detail: expect.any(String),
      meta: expect.any(Object),
      createdAt: expect.any(String),
    });

    const actions = rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["register_user", "register_teacher", "create_subject", "create_group", "assign_teacher"]));

    const exportRes = await request(app)
      .get("/audit/logs/export?action=create_group&limit=5")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(exportRes.status).toBe(200);
    const exported = JSON.parse(exportRes.text) as Array<{ action: string }>;
    expect(exported.length).toBeGreaterThan(0);
    expect(exported.every((row) => row.action === "create_group")).toBe(true);
  });

  it("covers remaining auth and protected endpoints", async () => {
    const app = createApp();

    const badLogin = await request(app)
      .post("/auth/login")
      .send({ email: "admin@secondteacher.dev", password: "WrongPassword!" });
    expect(badLogin.status).toBe(401);
    expect(badLogin.body.error.code).toBe("INVALID_CREDENTIALS");

    const dupRegister = await request(app).post("/auth/register").send({
      email: "student@secondteacher.dev",
      password: "Welcome123!",
      role: "student",
    });
    expect(dupRegister.status).toBe(409);
    expect(dupRegister.body.error.code).toBe("USER_EXISTS");

    const studentLogin = await request(app)
      .post("/auth/login")
      .send({ email: "student@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });
    const studentToken = studentLogin.body.data.token as string;

    const studentScope = await request(app)
      .get("/protected/student")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(studentScope.status).toBe(200);
    expect(studentScope.body.data.user.role).toBe("student");

    const adminLogin = await request(app)
      .post("/auth/login")
      .send({ email: "admin@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });
    const adminToken = adminLogin.body.data.token as string;
    const adminStudentScope = await request(app)
      .get("/protected/student")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminStudentScope.status).toBe(200);

    const auditNoAuth = await request(app).get("/audit/logs");
    expect(auditNoAuth.status).toBe(401);
  });

  it("covers list subjects/groups, join-code revoke, analytics recompute, and insights validation", async () => {
    const app = createApp();
    const teacherLogin = await request(app)
      .post("/auth/login")
      .send({ email: "teacher@secondteacher.dev", password: TEST_DEFAULT_USER_PASSWORD });
    const teacherToken = teacherLogin.body.data.token as string;

    const subjectsEmpty = await request(app).get("/subjects").set("Authorization", `Bearer ${teacherToken}`);
    expect(subjectsEmpty.status).toBe(200);
    expect(subjectsEmpty.body.data).toEqual([]);

    const groupsEmpty = await request(app).get("/groups").set("Authorization", `Bearer ${teacherToken}`);
    expect(groupsEmpty.status).toBe(200);
    expect(groupsEmpty.body.data).toEqual([]);

    const subjectRes = await request(app)
      .post("/subjects")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ name: "Revoke analytics" });
    const groupRes = await request(app)
      .post("/groups")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ subjectId: subjectRes.body.data.id, name: "Section" });
    const groupId = groupRes.body.data.id as string;

    const joinRes = await request(app)
      .post(`/groups/${groupId}/join-codes`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    const code = joinRes.body.data.code as string;

    const previewBad = await request(app).post("/enrollment/preview").send({ code: "ZZZZZZ" });
    expect(previewBad.status).toBe(404);
    expect(previewBad.body.error.code).toBe("INVALID_JOIN_CODE");

    const revokeRes = await request(app)
      .post(`/groups/${groupId}/join-codes/revoke`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ code });
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.code).toBe(code);

    const previewAfter = await request(app).post("/enrollment/preview").send({ code });
    expect(previewAfter.status).toBe(404);

    const recompute = await request(app)
      .post(`/groups/${groupId}/analytics/recompute`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(recompute.status).toBe(202);
    expect(recompute.body.data.ok).toBe(true);

    const insightsNoGroup = await request(app).get("/insights").set("Authorization", `Bearer ${teacherToken}`);
    expect(insightsNoGroup.status).toBe(400);
    expect(insightsNoGroup.body.error.code).toBe("VALIDATION_ERROR");
  });
});

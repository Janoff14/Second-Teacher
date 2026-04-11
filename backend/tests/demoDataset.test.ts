import { describe, it, expect, beforeEach } from "vitest";
import { resetAcademicStoreForTest } from "../src/domain/academicStore";
import { listAttemptsForVersion, resetAssessmentStoreForTest } from "../src/domain/assessmentStore";
import { resetInsightsStoreForTest } from "../src/domain/insightsStore";
import { resetRagStoreForTest } from "../src/domain/ragStore";
import { resetAuditStoreForTest } from "../src/domain/auditStore";
import { resetRateLimitForTest } from "../src/middleware/rateLimit";
import { resetUsersForTest, seedDefaultUsers } from "../src/domain/userStore";
import {
  DEMO_ASSESSMENT_SPECS,
  DEMO_STUDENT_COUNT,
  buildDemoAssessmentSpecs,
  demoAttemptDaysAgoForProfile,
  seedDemoDataset,
  totalDemoAttemptsInGroup,
} from "../src/seed/demoDataset";

describe("demo assessment specs", () => {
  it("includes enough practices, quizzes, and exams for roster-scale testing", () => {
    const specs = buildDemoAssessmentSpecs();
    expect(specs.filter((s) => s.kind === "practice")).toHaveLength(5);
    expect(specs.filter((s) => s.kind === "quiz")).toHaveLength(5);
    expect(specs.filter((s) => s.kind === "exam")).toHaveLength(3);
    expect(specs.length).toBe(13);
    expect(DEMO_ASSESSMENT_SPECS.length).toBe(13);
  });
});

describe("demoAttemptDaysAgoForProfile", () => {
  it("gives inactive students a single attempt on the first activity only", () => {
    expect(demoAttemptDaysAgoForProfile("inactive", 0, 0, "practice").length).toBe(1);
    expect(demoAttemptDaysAgoForProfile("inactive", 1, 0, "quiz").length).toBe(0);
  });

  it("loads full profiles with more practice attempts than exams per version", () => {
    const p = demoAttemptDaysAgoForProfile("stable_mid", 0, 0, "practice").length;
    const e = demoAttemptDaysAgoForProfile("stable_mid", 12, 0, "exam").length;
    expect(p).toBe(4);
    expect(e).toBe(2);
    expect(p).toBeGreaterThan(e);
  });

  it("keeps sparse_at_risk thin beyond early assessments", () => {
    expect(demoAttemptDaysAgoForProfile("sparse_at_risk", 0, 0, "practice").length).toBe(2);
    expect(demoAttemptDaysAgoForProfile("sparse_at_risk", 3, 0, "quiz").length).toBe(0);
  });
});

describe("seedDemoDataset", () => {
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

  it("seeds reduced cohort quickly", async () => {
    const s = await seedDemoDataset({ studentCount: 8 });
    expect(s.studentCount).toBe(8);
    expect(s.versionCount).toBe(13);
    expect(s.byKind).toEqual({ practice: 5, quiz: 5, exam: 3 });
    expect(s.attemptCount).toBeGreaterThan(80);
    expect(totalDemoAttemptsInGroup(s.groupId)).toBe(s.attemptCount);
  }, 60_000);

  it(`seeds ${DEMO_STUDENT_COUNT} students, 13 published versions, and mass attempts`, async () => {
    const s = await seedDemoDataset();
    expect(s.studentCount).toBe(DEMO_STUDENT_COUNT);
    expect(s.versionCount).toBe(13);
    expect(s.byKind.practice).toBe(5);
    expect(s.byKind.quiz).toBe(5);
    expect(s.byKind.exam).toBe(3);
    expect(s.attemptCount).toBeGreaterThan(3500);
    expect(totalDemoAttemptsInGroup(s.groupId)).toBe(s.attemptCount);
    const practiceVid = s.publishedVersionIds[0]!;
    expect(listAttemptsForVersion(practiceVid).length).toBeGreaterThanOrEqual(100);
  }, 180_000);
});

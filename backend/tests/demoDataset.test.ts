import { describe, it, expect, beforeEach } from "vitest";
import { listEnrollmentsForGroup, resetAcademicStoreForTest } from "../src/domain/academicStore";
import { listAttemptsForVersion, resetAssessmentStoreForTest } from "../src/domain/assessmentStore";
import { resetInsightsStoreForTest } from "../src/domain/insightsStore";
import { resetRagStoreForTest } from "../src/domain/ragStore";
import { resetAuditStoreForTest } from "../src/domain/auditStore";
import { resetRateLimitForTest } from "../src/middleware/rateLimit";
import { resetUsersForTest, seedDefaultUsers } from "../src/domain/userStore";
import {
  DEMO_ASSESSMENT_SPECS,
  DEMO_SEED_SECTION_COUNT,
  DEMO_STUDENT_COUNT,
  buildDemoAssessmentSpecs,
  demoAttemptDaysAgoForProfile,
  partitionStudentsAcrossSections,
  seedDemoDataset,
  totalDemoAttemptsInGroups,
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

describe("partitionStudentsAcrossSections", () => {
  it("splits 120 into four balanced sections", () => {
    expect(partitionStudentsAcrossSections(120, 4)).toEqual([30, 30, 30, 30]);
  });
  it("distributes remainder across early sections", () => {
    expect(partitionStudentsAcrossSections(8, 4)).toEqual([2, 2, 2, 2]);
    expect(partitionStudentsAcrossSections(10, 4)).toEqual([3, 3, 2, 2]);
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

  it("seeds reduced cohort quickly with four sections and a dedicated teacher", async () => {
    const s = await seedDemoDataset({ studentCount: 8 });
    expect(s.teacherEmail).toBe("demo.seed.teacher@secondteacher.dev");
    expect(s.groupIds.length).toBe(DEMO_SEED_SECTION_COUNT);
    expect(s.studentsPerSection.reduce((a, b) => a + b, 0)).toBe(8);
    expect(s.studentCount).toBe(8);
    expect(s.versionsPerSection).toBe(13);
    expect(s.totalPublishedVersions).toBe(13 * DEMO_SEED_SECTION_COUNT);
    expect(s.byKind).toEqual({
      practice: 5 * DEMO_SEED_SECTION_COUNT,
      quiz: 5 * DEMO_SEED_SECTION_COUNT,
      exam: 3 * DEMO_SEED_SECTION_COUNT,
    });
    expect(s.attemptCount).toBeGreaterThan(80);
    expect(totalDemoAttemptsInGroups(s.groupIds)).toBe(s.attemptCount);
    for (let i = 0; i < s.groupIds.length; i++) {
      expect(listEnrollmentsForGroup(s.groupIds[i]!).length).toBe(s.studentsPerSection[i]);
    }
    const practiceVid = s.publishedVersionIds[0]!;
    expect(listAttemptsForVersion(practiceVid).length).toBeGreaterThanOrEqual(4);
  }, 60_000);

  it(`seeds ${DEMO_STUDENT_COUNT} students across sections with mirrored assessments`, async () => {
    const s = await seedDemoDataset();
    expect(s.studentCount).toBe(DEMO_STUDENT_COUNT);
    expect(s.groupIds.length).toBe(DEMO_SEED_SECTION_COUNT);
    expect(s.versionsPerSection).toBe(13);
    expect(s.totalPublishedVersions).toBe(13 * DEMO_SEED_SECTION_COUNT);
    expect(s.byKind.practice).toBe(5 * DEMO_SEED_SECTION_COUNT);
    expect(s.byKind.quiz).toBe(5 * DEMO_SEED_SECTION_COUNT);
    expect(s.byKind.exam).toBe(3 * DEMO_SEED_SECTION_COUNT);
    expect(s.attemptCount).toBeGreaterThan(3500);
    expect(totalDemoAttemptsInGroups(s.groupIds)).toBe(s.attemptCount);
    const practiceVid = s.publishedVersionIds[0]!;
    expect(listAttemptsForVersion(practiceVid).length).toBeGreaterThanOrEqual(100);
  }, 180_000);
});

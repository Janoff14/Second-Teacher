/**
 * Modular demo dataset (fake students, enrollments, assessments, attempts, textbook stub).
 *
 * REMOVE THIS ENTIRE MODULE:
 * - Delete folder `src/seed/`
 * - Remove `importDemoAttemptForSeeding` from `domain/assessmentStore.ts`
 * - Remove `SEED_DEMO_DATA` from `config/env.ts`
 * - Remove `runDemoDatasetSeedIfEnabled` call from `server.ts`
 * - Remove `demo.seed.teacher@…` from `seedDefaultUsers` in `domain/userStore.ts`
 *
 * Enable: set env `SEED_DEMO_DATA=true` (or `1` / `yes`).
 * Account list (email / password / name / section): `docs/demo-seed-accounts.md` (regenerate via
 * `node backend/scripts/generate-demo-seed-accounts.mjs`).
 *
 * Each run **resets in-memory** academic, assessment, insights, RAG, and audit stores (not user accounts),
 * then rebuilds the demo graph so restarts are repeatable. **Do not use on a server where teachers already
 * created real in-memory state** unless you accept wiping that on every boot.
 *
 * Closed loop: dedicated teacher → one subject → N sections (groups) with enrollments, join codes,
 * mirrored published assessments per section, attempts only in each student’s section, insights per group,
 * one shared textbook on the subject. Also assigns `teacher@secondteacher.dev` to every demo group when that
 * user exists so the default seeded teacher sees the same roster in the UI.
 */

import { env } from "../config/env";
import { logger } from "../config/logger";
import { resetAuditStoreForTest } from "../domain/auditStore";
import {
  assignTeacher,
  createEnrollment,
  createGroup,
  createJoinCode,
  createSubject,
  resetAcademicStoreForTest,
} from "../domain/academicStore";
import {
  createDraft,
  importDemoAttemptForSeeding,
  listAttemptsForVersion,
  listPublishedVersionsForGroup,
  publishDraft,
  resetAssessmentStoreForTest,
  setDraftItems,
  type AssessmentVersion,
} from "../domain/assessmentStore";
import { recomputeGroupInsightsForAllStudents, resetInsightsStoreForTest } from "../domain/insightsStore";
import { indexPublishedAssessmentVersion, ingestTextbook, resetRagStoreForTest } from "../domain/ragStore";
import { createUser, getUserByEmail } from "../domain/userStore";
import { resetRateLimitForTest } from "../middleware/rateLimit";

export const DEMO_SEED_SUBJECT_NAME = "Physics Foundations_demo";
/** Login for the roster demo; also seeded in `seedDefaultUsers` when present. */
export const DEMO_SEED_TEACHER_EMAIL = "kamila.saidova_demo@secondteacher.dev";
export const DEMO_SEED_TEACHER_DISPLAY_NAME = "Kamila Saidova_demo";
export const DEMO_STUDENT_PASSWORD = "DemoSeed2026!";
/** Total synthetic students generated for the demo roster when using default seed options. */
export const DEMO_STUDENT_COUNT = 120;

/** Section (group) names; students are split evenly across these under {@link DEMO_SEED_TEACHER_EMAIL}. */
export const DEMO_SEED_SECTION_NAMES = [
  "Physics Cohort A_demo",
  "Physics Cohort B_demo",
  "Physics Cohort C_demo",
  "Physics Cohort D_demo",
] as const;

export const DEMO_SEED_SECTION_COUNT = DEMO_SEED_SECTION_NAMES.length;

export type DemoAssessmentKind = "practice" | "quiz" | "exam";

export interface DemoAssessmentSpec {
  kind: DemoAssessmentKind;
  title: string;
  itemCount: number;
  stemPrefix: string;
}

const DEMO_FIRST_NAMES = [
  "Amina",
  "Dilnoza",
  "Mohira",
  "Sevara",
  "Ziyoda",
  "Maftuna",
  "Nodira",
  "Shahnoza",
  "Madina",
  "Feruza",
  "Nigora",
  "Laylo",
  "Umida",
  "Sitora",
  "Aziza",
] as const;

const DEMO_LAST_NAMES = [
  "Karimova",
  "Rakhimova",
  "Ismailova",
  "Tursunova",
  "Akhmedova",
  "Usmanova",
  "Kadirova",
  "Yuldasheva",
] as const;

const DEMO_RESERVED_EMAILS = new Set([DEMO_SEED_TEACHER_EMAIL]);

export type DemoProfile =
  | "at_risk"
  | "declining"
  | "sparse_at_risk"
  | "inactive"
  | "stable_mid"
  | "volatile"
  | "improving"
  | "high_flyer"
  | "low_load";

/** Published assessment lineup: multiple practices, quizzes, and unit/final exams for roster-scale UI testing. */
export function buildDemoAssessmentSpecs(): DemoAssessmentSpec[] {
  return [
    {
      kind: "practice",
      title: "Practice: Motion and vectors_demo",
      itemCount: 5,
      stemPrefix: "Motion and vectors practice",
    },
    {
      kind: "practice",
      title: "Practice: Velocity graphs_demo",
      itemCount: 5,
      stemPrefix: "Velocity graph practice",
    },
    {
      kind: "practice",
      title: "Practice: Forces and free body diagrams_demo",
      itemCount: 5,
      stemPrefix: "Forces practice",
    },
    {
      kind: "practice",
      title: "Practice: Energy transfer basics_demo",
      itemCount: 5,
      stemPrefix: "Energy transfer practice",
    },
    {
      kind: "practice",
      title: "Practice: Momentum review_demo",
      itemCount: 5,
      stemPrefix: "Momentum review practice",
    },
    {
      kind: "quiz",
      title: "Quiz: Kinematics checkpoint_demo",
      itemCount: 6,
      stemPrefix: "Kinematics quiz",
    },
    {
      kind: "quiz",
      title: "Quiz: Newton's laws checkpoint_demo",
      itemCount: 6,
      stemPrefix: "Newton laws quiz",
    },
    {
      kind: "quiz",
      title: "Quiz: Work and energy checkpoint_demo",
      itemCount: 6,
      stemPrefix: "Work and energy quiz",
    },
    {
      kind: "quiz",
      title: "Quiz: Momentum and collisions_demo",
      itemCount: 6,
      stemPrefix: "Momentum and collisions quiz",
    },
    {
      kind: "quiz",
      title: "Quiz: Waves and sound checkpoint_demo",
      itemCount: 6,
      stemPrefix: "Waves and sound quiz",
    },
    {
      kind: "exam",
      title: "Test: Unit 1 mechanics_demo",
      itemCount: 8,
      stemPrefix: "Unit 1 mechanics test",
    },
    {
      kind: "exam",
      title: "Test: Unit 2 energy and momentum_demo",
      itemCount: 8,
      stemPrefix: "Unit 2 energy and momentum test",
    },
    {
      kind: "exam",
      title: "Exam: Semester physics final_demo",
      itemCount: 10,
      stemPrefix: "Semester final exam",
    },
  ];
}

export const DEMO_ASSESSMENT_SPECS: DemoAssessmentSpec[] = buildDemoAssessmentSpecs();

export interface DemoSeedSummary {
  subjectId: string;
  teacherId: string;
  teacherEmail: string;
  groupIds: string[];
  /** Roster count per section, same order as {@link DEMO_SEED_SECTION_NAMES}. */
  studentsPerSection: number[];
  /** First section’s group id (compat for single-group callers). */
  groupId: string;
  studentCount: number;
  /** Distinct published versions per section (mirrored across sections). */
  versionsPerSection: number;
  totalPublishedVersions: number;
  publishedVersionIds: string[];
  attemptCount: number;
  /** Counts of published assessments by kind, summed across all sections. */
  byKind: Record<DemoAssessmentKind, number>;
}

/** One cycle (24 students); repeated to fill DEMO_STUDENT_COUNT. */
const PROFILE_CYCLE: DemoProfile[] = [
  "at_risk",
  "at_risk",
  "at_risk",
  "declining",
  "declining",
  "declining",
  "sparse_at_risk",
  "sparse_at_risk",
  "inactive",
  "stable_mid",
  "stable_mid",
  "stable_mid",
  "stable_mid",
  "volatile",
  "volatile",
  "volatile",
  "improving",
  "improving",
  "improving",
  "high_flyer",
  "high_flyer",
  "high_flyer",
  "low_load",
  "low_load",
];

function slugifyIdentity(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
}

function studentIdentity(index1Based: number): { email: string; displayName: string } {
  let zeroBased = index1Based - 1;
  while (true) {
    const first = DEMO_FIRST_NAMES[zeroBased % DEMO_FIRST_NAMES.length]!;
    const last = DEMO_LAST_NAMES[Math.floor(zeroBased / DEMO_FIRST_NAMES.length) % DEMO_LAST_NAMES.length]!;
    const displayName = `${first} ${last}_demo`;
    const email = `${slugifyIdentity(`${first}.${last}`)}_demo@secondteacher.dev`;
    if (!DEMO_RESERVED_EMAILS.has(email)) {
      return { email, displayName };
    }
    zeroBased += 1;
  }
}

function studentEmail(index1Based: number): string {
  return studentIdentity(index1Based).email;
}

function profileForIndex(studentIndex: number): DemoProfile {
  return PROFILE_CYCLE[studentIndex % PROFILE_CYCLE.length]!;
}

/** Split `total` students across `sectionCount` sections as evenly as possible. */
export function partitionStudentsAcrossSections(total: number, sectionCount: number): number[] {
  if (sectionCount <= 0) {
    return [];
  }
  const base = Math.floor(total / sectionCount);
  const rem = total % sectionCount;
  return Array.from({ length: sectionCount }, (_, i) => base + (i < rem ? 1 : 0));
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function defaultAttemptCount(kind: DemoAssessmentKind): number {
  switch (kind) {
    case "practice":
      return 4;
    case "quiz":
      return 3;
    case "exam":
      return 2;
    default:
      return 3;
  }
}

/** Spread recent submission dates per kind (full-activity profiles). Exported for tests. */
export function demoAttemptDaysAgoForProfile(
  profile: DemoProfile,
  versionIndex: number,
  studentIndex: number,
  kind: DemoAssessmentKind,
): number[] {
  const s = studentIndex % 11;
  const phase = versionIndex * 2;

  switch (profile) {
    case "inactive":
      return versionIndex === 0 ? [44 + s] : [];
    case "sparse_at_risk":
      if (versionIndex === 0) return [40 + s, 28 + s];
      if (versionIndex === 1) return [18 + s];
      if (versionIndex === 2) return [11 + s];
      return [];
    case "low_load": {
      if (versionIndex >= 6) return [];
      return [24 + s + phase, 8 + s + phase];
    }
    default: {
      const n = defaultAttemptCount(kind);
      const base = 58 + versionIndex * 2 + s;
      return Array.from({ length: n }, (_, i) => Math.max(1, base - i * 8 - phase));
    }
  }
}

function buildAnswers(
  version: AssessmentVersion,
  rng: () => number,
  targetCorrectRate: number,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of version.items) {
    const keys = Object.keys(item.options);
    const correct = rng() < targetCorrectRate;
    if (correct) {
      out[item.id] = item.correctKey;
    } else {
      const wrong = keys.find((k) => k !== item.correctKey) ?? keys[0]!;
      out[item.id] = wrong;
    }
  }
  return out;
}

function correctRateFor(profile: DemoProfile, attemptIdx: number, versionIdx: number): number {
  const v = versionIdx * 0.02;
  switch (profile) {
    case "declining":
      return Math.max(0.12, 0.9 - attemptIdx * 0.17 - v);
    case "stable_mid":
      return 0.5 + (attemptIdx % 2) * 0.07 + (versionIdx % 5 === 2 ? -0.04 : 0);
    case "high_flyer":
      return Math.min(0.98, 0.86 + v * 0.35);
    case "at_risk":
      return Math.max(0.1, 0.4 - attemptIdx * 0.09 - v);
    case "sparse_at_risk":
      return Math.max(0.08, 0.32 - attemptIdx * 0.12);
    case "inactive":
      return 0.22;
    case "volatile":
      return 0.35 + 0.5 * (((attemptIdx + versionIdx) & 1) as number);
    case "improving":
      return Math.min(0.95, 0.28 + attemptIdx * 0.14 + v * 0.28);
    case "low_load":
      return Math.min(0.98, 0.94 - attemptIdx * 0.03);
    default:
      return 0.5;
  }
}

function standardItems(count: number, stemPrefix: string): Array<{
  stem: string;
  options: Record<string, string>;
  correctKey: string;
}> {
  return Array.from({ length: count }, (_, i) => ({
    stem: `${stemPrefix} — item ${i + 1}: choose the best answer.`,
    options: { A: "Incorrect", B: "Correct", C: "Plausible distractor", D: "Another distractor" },
    correctKey: "B",
  }));
}

async function ensureDemoTeacher(): Promise<{ id: string }> {
  const existing = await getUserByEmail(DEMO_SEED_TEACHER_EMAIL);
  if (existing) {
    return existing;
  }
  return createUser(DEMO_SEED_TEACHER_EMAIL, DEMO_STUDENT_PASSWORD, "teacher", DEMO_SEED_TEACHER_DISPLAY_NAME);
}

async function ensureStudent(email: string, displayName: string): Promise<string> {
  const existing = await getUserByEmail(email);
  if (existing) {
    return existing.id;
  }
  const u = await createUser(email, DEMO_STUDENT_PASSWORD, "student", displayName);
  return u.id;
}

async function ensureAllStudents(count: number): Promise<string[]> {
  const ids: string[] = new Array(count);
  const chunk = 12;
  for (let start = 0; start < count; start += chunk) {
    const end = Math.min(start + chunk, count);
    const slice = await Promise.all(
      Array.from({ length: end - start }, async (_, j) => {
        const i = start + j;
        const identity = studentIdentity(i + 1);
        return ensureStudent(identity.email, identity.displayName);
      }),
    );
    for (let k = 0; k < slice.length; k++) {
      ids[start + k] = slice[k]!;
    }
  }
  return ids;
}

export type SeedDemoDatasetOptions = {
  /** Defaults to {@link DEMO_STUDENT_COUNT}. */
  studentCount?: number;
};

/**
 * Resets in-memory academic, assessment, insights, RAG, audit, and rate-limit state (not users), then builds
 * the demo subject, sections (groups), enrollments, join codes, per-section assessments, attempts, and textbook.
 */
export async function seedDemoDataset(options?: SeedDemoDatasetOptions): Promise<DemoSeedSummary> {
  resetAcademicStoreForTest();
  resetAssessmentStoreForTest();
  resetInsightsStoreForTest();
  resetRagStoreForTest();
  resetAuditStoreForTest();
  resetRateLimitForTest();

  const teacher = await ensureDemoTeacher();

  const studentCount = options?.studentCount ?? DEMO_STUDENT_COUNT;
  const studentsPerSection = partitionStudentsAcrossSections(studentCount, DEMO_SEED_SECTION_COUNT);

  logger.info(
    {
      students: studentCount,
      sections: DEMO_SEED_SECTION_COUNT,
      studentsPerSection,
      versionsPerSection: DEMO_ASSESSMENT_SPECS.length,
      teacher: DEMO_SEED_TEACHER_EMAIL,
    },
    "demo_seed_start",
  );

  const subject = createSubject(DEMO_SEED_SUBJECT_NAME, teacher.id);
  const studentIds = await ensureAllStudents(studentCount);

  const groupIds: string[] = [];
  const versionsBySection: AssessmentVersion[][] = [];
  const opens = new Date(Date.now() - 120 * 86_400_000).toISOString();
  const closes = new Date(Date.now() + 120 * 86_400_000).toISOString();
  const byKind: Record<DemoAssessmentKind, number> = { practice: 0, quiz: 0, exam: 0 };

  let enrollOffset = 0;
  for (let si = 0; si < DEMO_SEED_SECTION_COUNT; si++) {
    const sectionName = DEMO_SEED_SECTION_NAMES[si]!;
    const group = createGroup(subject.id, sectionName, teacher.id);
    groupIds.push(group.id);
    createJoinCode(group.id, teacher.id);

    const sliceCount = studentsPerSection[si] ?? 0;
    for (let k = 0; k < sliceCount; k++) {
      createEnrollment(group.id, studentIds[enrollOffset + k]!);
    }
    enrollOffset += sliceCount;

    const sectionVersions: AssessmentVersion[] = [];
    for (const spec of DEMO_ASSESSMENT_SPECS) {
      const draft = createDraft(group.id, spec.title, teacher.id);
      setDraftItems(draft.id, standardItems(spec.itemCount, spec.stemPrefix));
      const version = publishDraft(draft.id, teacher.id, {
        windowOpensAtUtc: opens,
        windowClosesAtUtc: closes,
        windowTimezone: "UTC",
      });
      await indexPublishedAssessmentVersion(version, subject.id);
      sectionVersions.push(version);
      byKind[spec.kind] += 1;
    }
    versionsBySection.push(sectionVersions);
  }

  const legacyDemoTeacher = await getUserByEmail("teacher@secondteacher.dev");
  if (legacyDemoTeacher) {
    for (const gid of groupIds) {
      assignTeacher(gid, legacyDemoTeacher.id, teacher.id);
    }
  }

  const sectionIndexByStudent: number[] = [];
  {
    let c = 0;
    for (let si = 0; si < DEMO_SEED_SECTION_COUNT; si++) {
      const n = studentsPerSection[si] ?? 0;
      for (let k = 0; k < n; k++) {
        sectionIndexByStudent[c++] = si;
      }
    }
  }

  let attemptCount = 0;
  for (let stu = 0; stu < studentIds.length; stu++) {
    const studentId = studentIds[stu]!;
    const sec = sectionIndexByStudent[stu] ?? 0;
    const versions = versionsBySection[sec]!;
    const profile = profileForIndex(stu);
    const rng = mulberry32(10_000 + stu * 7919);

    for (let vi = 0; vi < versions.length; vi++) {
      const version = versions[vi]!;
      const kind = DEMO_ASSESSMENT_SPECS[vi]!.kind;
      const dayOffsets = demoAttemptDaysAgoForProfile(profile, vi, stu, kind);
      for (let ai = 0; ai < dayOffsets.length; ai++) {
        const day = dayOffsets[ai]!;
        const rate = correctRateFor(profile, ai, vi) * (0.9 + rng() * 0.18);
        const answers = buildAnswers(version, rng, Math.min(0.98, Math.max(0.05, rate)));
        importDemoAttemptForSeeding({
          versionId: version.id,
          studentId,
          answers,
          submittedAt: daysAgoIso(day),
        });
        attemptCount += 1;
      }
    }
  }

  for (const gid of groupIds) {
    recomputeGroupInsightsForAllStudents(gid);
  }

  try {
    await ingestTextbook({
      subjectId: subject.id,
      title: "Physics Foundations Reader_demo",
      versionLabel: "seed-1",
      text:
        "# Chapter 1: Motion and vectors\n" +
        "Motion describes how an object's position changes over time. Students compare distance, displacement, speed, and velocity before moving into graph interpretation.\n\n" +
        "A velocity-time graph can reveal steady motion, acceleration, or a change in direction. When the line slopes upward, the object is accelerating in the positive direction.\n\n" +
        "# Chapter 2: Forces and energy\n" +
        "Newton's laws connect force, mass, and acceleration. Free-body diagrams help students isolate the forces acting on an object before deciding how it will move.\n\n" +
        "Energy is transferred when work is done. Students should review kinetic energy, gravitational potential energy, and conservation of energy before the larger unit tests.",
      createdBy: teacher.id,
    });
  } catch (err) {
    logger.warn({ err }, "demo_seed_textbook_ingest_failed_non_fatal");
  }

  const versionsPerSection = DEMO_ASSESSMENT_SPECS.length;
  const publishedVersionIds = versionsBySection.flatMap((vs) => vs.map((v) => v.id));
  const firstGroupId = groupIds[0]!;

  logger.info(
    {
      subjectId: subject.id,
      groupIds,
      students: studentIds.length,
      studentsPerSection,
      attempts: attemptCount,
      versionsPerSection,
      totalPublishedVersions: publishedVersionIds.length,
      byKind,
      teacher: DEMO_SEED_TEACHER_EMAIL,
        password: DEMO_STUDENT_PASSWORD,
      emailPattern: `${studentIdentity(1).email} … ${studentIdentity(studentCount).email}`,
      profilesInCycle: PROFILE_CYCLE,
    },
    "demo_seed_complete",
  );

  return {
    subjectId: subject.id,
    teacherId: teacher.id,
    teacherEmail: DEMO_SEED_TEACHER_EMAIL,
    groupIds,
    studentsPerSection,
    groupId: firstGroupId,
    studentCount: studentIds.length,
    versionsPerSection,
    totalPublishedVersions: publishedVersionIds.length,
    publishedVersionIds,
    attemptCount,
    byKind,
  };
}

export async function runDemoDatasetSeedIfEnabled(): Promise<void> {
  if (!env.SEED_DEMO_DATA) {
    return;
  }
  try {
    await seedDemoDataset();
  } catch (err) {
    logger.warn({ err }, "demo_seed_failed_non_fatal");
  }
}

/** Test helper: total attempts for all published versions in one group. */
export function totalDemoAttemptsInGroup(groupId: string): number {
  const ids = listPublishedVersionsForGroup(groupId).map((v) => v.id);
  let n = 0;
  for (const id of ids) {
    n += listAttemptsForVersion(id).length;
  }
  return n;
}

/** Sum attempts across many groups (e.g. all demo sections). */
export function totalDemoAttemptsInGroups(groupIds: string[]): number {
  let n = 0;
  for (const gid of groupIds) {
    n += totalDemoAttemptsInGroup(gid);
  }
  return n;
}

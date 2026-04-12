/**
 * Modular demo dataset (students, enrollments, assessments, attempts, textbook).
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
 * Closed loop: dedicated teacher → one subject → one section (group) with enrollments, join code,
 * published assessments, attempts, insights, and one shared textbook. Also assigns
 * `teacher@secondteacher.dev` to every demo group when that user exists so the default seeded
 * teacher sees the same roster in the UI.
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
import {
  indexPublishedAssessmentVersion,
  ingestTextbook,
  listTextbookSourcesForSubject,
  loadTextbooksFromDb,
  resetRagStoreForTest,
} from "../domain/ragStore";
import { createUser, getUserByEmail } from "../domain/userStore";
import { resetRateLimitForTest } from "../middleware/rateLimit";

export const DEMO_SEED_SUBJECT_NAME = "Fundamentals of Physics";
/** Login for the roster demo; also seeded in `seedDefaultUsers` when present. */
export const DEMO_SEED_TEACHER_EMAIL = "kamila.saidova_demo@secondteacher.dev";
export const DEMO_SEED_TEACHER_DISPLAY_NAME = "Kamila Saidova_demo";
export const DEMO_STUDENT_PASSWORD = "DemoSeed2026!";
/** Total synthetic students generated for the demo roster when using default seed options. */
export const DEMO_STUDENT_COUNT = 30;

/** Section (group) names; students are enrolled in one section. */
export const DEMO_SEED_SECTION_NAMES = [
  "Physics 101 — Spring 2026",
] as const;

export const DEMO_SEED_SECTION_COUNT = DEMO_SEED_SECTION_NAMES.length;

export type DemoAssessmentKind = "practice" | "quiz" | "exam";

export interface DemoAssessmentSpec {
  kind: DemoAssessmentKind;
  title: string;
  items: Array<{
    stem: string;
    options: Record<string, string>;
    correctKey: string;
  }>;
}

const DEMO_FIRST_NAMES = [
  "Aisha",
  "Brian",
  "Carmen",
  "David",
  "Elena",
  "Fatima",
  "Gabriel",
  "Hannah",
  "Ivan",
  "Jasmine",
  "Kevin",
  "Lila",
  "Marcus",
  "Nadia",
  "Omar",
  "Priya",
  "Quinn",
  "Rosa",
  "Samuel",
  "Tanya",
  "Umar",
  "Valentina",
  "William",
  "Xiomara",
  "Yusuf",
  "Zara",
  "Andre",
  "Bianca",
  "Carlos",
  "Diana",
] as const;

const DEMO_LAST_NAMES = [
  "Martinez",
  "Chen",
  "Okafor",
  "Petrov",
  "Nguyen",
  "Johansson",
  "Al-Rashid",
  "Tanaka",
  "Williams",
  "Kumar",
  "Fernandez",
  "Kim",
  "Abadi",
  "O'Brien",
  "Volkov",
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

/** Published assessment lineup with real physics questions from Halliday/Resnick/Walker. */
export function buildDemoAssessmentSpecs(): DemoAssessmentSpec[] {
  return [
    // ─── Practices ───
    {
      kind: "practice",
      title: "Practice: Measurement & Units",
      items: [
        {
          stem: "Which of the following is a fundamental SI base unit?",
          options: { A: "Newton", B: "Joule", C: "Kilogram", D: "Watt" },
          correctKey: "C",
        },
        {
          stem: "The prefix 'mega' represents a factor of:",
          options: { A: "10³", B: "10⁶", C: "10⁹", D: "10¹²" },
          correctKey: "B",
        },
        {
          stem: "How many significant figures are in the measurement 0.00340 m?",
          options: { A: "2", B: "3", C: "4", D: "5" },
          correctKey: "B",
        },
        {
          stem: "Dimensional analysis can be used to:",
          options: {
            A: "Derive exact numerical constants",
            B: "Check whether an equation is dimensionally consistent",
            C: "Determine the direction of a vector",
            D: "Measure the mass of an object",
          },
          correctKey: "B",
        },
        {
          stem: "If the speed of light is exactly 299,792,458 m/s, what defines the meter?",
          options: {
            A: "The wavelength of krypton-86 light",
            B: "The distance light travels in 1/299,792,458 of a second",
            C: "One ten-millionth of the Earth's meridian",
            D: "The length of a platinum-iridium bar in Paris",
          },
          correctKey: "B",
        },
      ],
    },
    {
      kind: "practice",
      title: "Practice: Motion Along a Straight Line",
      items: [
        {
          stem: "A car accelerates uniformly from rest to 20 m/s in 5 s. What is its acceleration?",
          options: { A: "2 m/s²", B: "4 m/s²", C: "5 m/s²", D: "10 m/s²" },
          correctKey: "B",
        },
        {
          stem: "An object is thrown vertically upward. At the highest point, its acceleration is:",
          options: { A: "Zero", B: "9.8 m/s² downward", C: "9.8 m/s² upward", D: "Undefined" },
          correctKey: "B",
        },
        {
          stem: "Displacement differs from distance because displacement:",
          options: {
            A: "Is always larger than distance",
            B: "Includes direction and can be negative",
            C: "Is measured in different units",
            D: "Only applies to circular motion",
          },
          correctKey: "B",
        },
        {
          stem: "The slope of a position-time graph represents:",
          options: { A: "Acceleration", B: "Velocity", C: "Force", D: "Displacement" },
          correctKey: "B",
        },
        {
          stem: "A ball is dropped from rest. After 3 seconds of free fall (ignoring air resistance), its speed is approximately:",
          options: { A: "9.8 m/s", B: "19.6 m/s", C: "29.4 m/s", D: "39.2 m/s" },
          correctKey: "C",
        },
      ],
    },
    {
      kind: "practice",
      title: "Practice: Vectors",
      items: [
        {
          stem: "Two vectors of magnitudes 3 N and 4 N act at right angles. The magnitude of their resultant is:",
          options: { A: "1 N", B: "5 N", C: "7 N", D: "12 N" },
          correctKey: "B",
        },
        {
          stem: "The dot product of two perpendicular vectors is:",
          options: { A: "1", B: "The product of their magnitudes", C: "Zero", D: "Undefined" },
          correctKey: "C",
        },
        {
          stem: "A vector has components Ax = 3 and Ay = 4. Its magnitude is:",
          options: { A: "1", B: "5", C: "7", D: "25" },
          correctKey: "B",
        },
        {
          stem: "The cross product of two parallel vectors is:",
          options: { A: "Maximum", B: "Equal to their dot product", C: "Zero", D: "A scalar quantity" },
          correctKey: "C",
        },
        {
          stem: "Unit vectors î, ĵ, and k̂ have what magnitude?",
          options: { A: "0", B: "1", C: "Depends on the coordinate system", D: "π" },
          correctKey: "B",
        },
      ],
    },
    {
      kind: "practice",
      title: "Practice: Newton's Laws of Motion",
      items: [
        {
          stem: "Newton's first law is also known as the law of:",
          options: { A: "Acceleration", B: "Action-reaction", C: "Inertia", D: "Gravitation" },
          correctKey: "C",
        },
        {
          stem: "A 5 kg object experiences a net force of 20 N. Its acceleration is:",
          options: { A: "2 m/s²", B: "4 m/s²", C: "10 m/s²", D: "100 m/s²" },
          correctKey: "B",
        },
        {
          stem: "According to Newton's third law, when you push against a wall:",
          options: {
            A: "The wall does not push back",
            B: "The wall pushes back with equal force",
            C: "The wall pushes back with greater force",
            D: "No forces are involved",
          },
          correctKey: "B",
        },
        {
          stem: "The normal force on an object on a horizontal surface equals its weight when:",
          options: {
            A: "The object is accelerating upward",
            B: "An additional downward force is applied",
            C: "No other vertical forces act on it",
            D: "The object is on an inclined plane",
          },
          correctKey: "C",
        },
        {
          stem: "An elevator accelerates upward at 2 m/s². A 60 kg person inside feels an apparent weight of:",
          options: { A: "468 N", B: "588 N", C: "708 N", D: "828 N" },
          correctKey: "C",
        },
      ],
    },
    {
      kind: "practice",
      title: "Practice: Work and Kinetic Energy",
      items: [
        {
          stem: "Work is defined as:",
          options: {
            A: "Force times time",
            B: "Force times displacement in the direction of force",
            C: "Mass times velocity",
            D: "Power times distance",
          },
          correctKey: "B",
        },
        {
          stem: "The work-energy theorem states that the net work done on an object equals:",
          options: {
            A: "Its potential energy",
            B: "Its total energy",
            C: "The change in its kinetic energy",
            D: "Its momentum",
          },
          correctKey: "C",
        },
        {
          stem: "A 2 kg ball moves at 3 m/s. Its kinetic energy is:",
          options: { A: "3 J", B: "6 J", C: "9 J", D: "18 J" },
          correctKey: "C",
        },
        {
          stem: "If a force acts perpendicular to the direction of motion, the work done is:",
          options: { A: "Maximum", B: "Negative", C: "Zero", D: "Equal to the kinetic energy" },
          correctKey: "C",
        },
        {
          stem: "Power is defined as:",
          options: {
            A: "Work divided by distance",
            B: "Force divided by time",
            C: "Work divided by time",
            D: "Energy times velocity",
          },
          correctKey: "C",
        },
      ],
    },

    // ─── Quizzes ───
    {
      kind: "quiz",
      title: "Quiz 1: Kinematics",
      items: [
        {
          stem: "A projectile is launched at 45° above the horizontal. At the top of its trajectory, what is its vertical velocity component?",
          options: { A: "Maximum", B: "Equal to horizontal component", C: "Zero", D: "Negative" },
          correctKey: "C",
        },
        {
          stem: "An object moves in a circle at constant speed. Its acceleration:",
          options: {
            A: "Is zero because speed is constant",
            B: "Points tangent to the circle",
            C: "Points toward the center of the circle",
            D: "Points outward from the center",
          },
          correctKey: "C",
        },
        {
          stem: "A car travels 100 km north and then 100 km east. The magnitude of its displacement is closest to:",
          options: { A: "100 km", B: "141 km", C: "173 km", D: "200 km" },
          correctKey: "B",
        },
        {
          stem: "Which kinematic equation relates displacement, initial velocity, acceleration, and time (no final velocity)?",
          options: {
            A: "v = v₀ + at",
            B: "x = v₀t + ½at²",
            C: "v² = v₀² + 2ax",
            D: "x = ½(v₀ + v)t",
          },
          correctKey: "B",
        },
        {
          stem: "Relative to the ground, rain falling vertically at 5 m/s appears to fall at an angle to a person running at 3 m/s. The apparent speed of the rain is:",
          options: { A: "2 m/s", B: "4 m/s", C: "√34 ≈ 5.8 m/s", D: "8 m/s" },
          correctKey: "C",
        },
        {
          stem: "The area under a velocity-time graph gives the:",
          options: { A: "Acceleration", B: "Displacement", C: "Speed", D: "Force" },
          correctKey: "B",
        },
      ],
    },
    {
      kind: "quiz",
      title: "Quiz 2: Forces and Free-Body Diagrams",
      items: [
        {
          stem: "A block is on an incline at angle θ. The component of gravity along the incline is:",
          options: { A: "mg cos θ", B: "mg sin θ", C: "mg tan θ", D: "mg / sin θ" },
          correctKey: "B",
        },
        {
          stem: "Kinetic friction is generally _____ static friction for the same surfaces.",
          options: { A: "Greater than", B: "Equal to", C: "Less than", D: "Unrelated to" },
          correctKey: "C",
        },
        {
          stem: "A 10 kg box is pushed across a floor with a coefficient of kinetic friction μk = 0.3. The friction force is:",
          options: { A: "3 N", B: "29.4 N", C: "30 N", D: "98 N" },
          correctKey: "B",
        },
        {
          stem: "Two blocks (3 kg and 5 kg) are connected by a string on a frictionless surface. A 16 N force pulls the 5 kg block. The tension in the string is:",
          options: { A: "4 N", B: "6 N", C: "8 N", D: "10 N" },
          correctKey: "B",
        },
        {
          stem: "An object in free fall near Earth's surface has an acceleration of approximately:",
          options: { A: "8.9 m/s²", B: "9.8 m/s²", C: "10.8 m/s²", D: "11.2 m/s²" },
          correctKey: "B",
        },
        {
          stem: "The tension in a string supporting a 5 kg mass hanging in equilibrium is:",
          options: { A: "5 N", B: "25 N", C: "49 N", D: "98 N" },
          correctKey: "C",
        },
      ],
    },
    {
      kind: "quiz",
      title: "Quiz 3: Energy Conservation",
      items: [
        {
          stem: "A roller coaster car is at the top of a 20 m hill. Using energy conservation (starting from rest), its speed at the bottom is approximately:",
          options: { A: "10 m/s", B: "14 m/s", C: "20 m/s", D: "40 m/s" },
          correctKey: "C",
        },
        {
          stem: "Gravitational potential energy near Earth's surface is calculated as:",
          options: { A: "½mv²", B: "mgh", C: "½kx²", D: "Fd" },
          correctKey: "B",
        },
        {
          stem: "A spring with k = 200 N/m is compressed 0.1 m. The stored elastic potential energy is:",
          options: { A: "0.5 J", B: "1.0 J", C: "2.0 J", D: "20 J" },
          correctKey: "B",
        },
        {
          stem: "In an isolated system, total mechanical energy is conserved when:",
          options: {
            A: "Friction is present",
            B: "Only conservative forces do work",
            C: "External forces act on the system",
            D: "The system gains heat",
          },
          correctKey: "B",
        },
        {
          stem: "A pendulum swings from a height of 0.5 m. Its speed at the lowest point is approximately:",
          options: { A: "1.0 m/s", B: "2.2 m/s", C: "3.1 m/s", D: "4.9 m/s" },
          correctKey: "C",
        },
        {
          stem: "The work done by gravity on a ball thrown straight up as it rises 10 m is (mass = 2 kg):",
          options: { A: "+196 J", B: "−196 J", C: "+98 J", D: "−196 J" },
          correctKey: "B",
        },
      ],
    },
    {
      kind: "quiz",
      title: "Quiz 4: Linear Momentum and Collisions",
      items: [
        {
          stem: "Momentum is defined as:",
          options: { A: "Mass × acceleration", B: "Mass × velocity", C: "Force × time", D: "½mv²" },
          correctKey: "B",
        },
        {
          stem: "In a perfectly inelastic collision, the two objects:",
          options: {
            A: "Bounce off elastically",
            B: "Stick together and move as one",
            C: "Both come to rest",
            D: "Exchange velocities",
          },
          correctKey: "B",
        },
        {
          stem: "A 0.5 kg ball moving at 4 m/s strikes a wall and bounces back at 4 m/s. The change in momentum is:",
          options: { A: "0 kg·m/s", B: "2 kg·m/s", C: "4 kg·m/s", D: "4 kg·m/s" },
          correctKey: "C",
        },
        {
          stem: "The impulse-momentum theorem states that impulse equals:",
          options: {
            A: "The change in kinetic energy",
            B: "The change in momentum",
            C: "The total momentum",
            D: "Force × displacement",
          },
          correctKey: "B",
        },
        {
          stem: "In an elastic collision, which quantities are conserved?",
          options: {
            A: "Momentum only",
            B: "Kinetic energy only",
            C: "Both momentum and kinetic energy",
            D: "Neither momentum nor kinetic energy",
          },
          correctKey: "C",
        },
        {
          stem: "A 1000 kg car moving at 10 m/s rear-ends a stationary 2000 kg truck. They stick together. Their combined speed is approximately:",
          options: { A: "2.5 m/s", B: "3.3 m/s", C: "5.0 m/s", D: "6.7 m/s" },
          correctKey: "B",
        },
      ],
    },
    {
      kind: "quiz",
      title: "Quiz 5: Rotational Motion",
      items: [
        {
          stem: "The rotational analog of mass is:",
          options: { A: "Torque", B: "Angular velocity", C: "Moment of inertia", D: "Angular momentum" },
          correctKey: "C",
        },
        {
          stem: "Torque is calculated as:",
          options: { A: "Force × velocity", B: "Force × lever arm", C: "Mass × angular acceleration", D: "Inertia × velocity" },
          correctKey: "B",
        },
        {
          stem: "A wheel accelerates from rest to 10 rad/s in 5 seconds. Its angular acceleration is:",
          options: { A: "0.5 rad/s²", B: "2 rad/s²", C: "5 rad/s²", D: "50 rad/s²" },
          correctKey: "B",
        },
        {
          stem: "The moment of inertia of a solid sphere about its center is:",
          options: { A: "MR²", B: "½MR²", C: "⅔MR²", D: "⅖MR²" },
          correctKey: "D",
        },
        {
          stem: "Angular momentum is conserved when:",
          options: {
            A: "Net force is zero",
            B: "Net torque is zero",
            C: "Angular velocity is constant",
            D: "Linear momentum is conserved",
          },
          correctKey: "B",
        },
        {
          stem: "A figure skater spins faster when pulling in their arms because:",
          options: {
            A: "Their mass decreases",
            B: "Their moment of inertia decreases while angular momentum is conserved",
            C: "Torque increases",
            D: "Friction is eliminated",
          },
          correctKey: "B",
        },
      ],
    },

    // ─── Exams ───
    {
      kind: "exam",
      title: "Test: Unit 1 — Mechanics Fundamentals",
      items: [
        {
          stem: "A stone is thrown horizontally at 15 m/s from a cliff 80 m high. How long does it take to reach the ground? (g = 10 m/s²)",
          options: { A: "2 s", B: "4 s", C: "5.3 s", D: "8 s" },
          correctKey: "B",
        },
        {
          stem: "Newton's second law in component form for the x-direction is:",
          options: { A: "ΣF = ma", B: "ΣFx = max", C: "F = mg", D: "Fx = mv" },
          correctKey: "B",
        },
        {
          stem: "A 3 kg block slides down a frictionless incline of 30°. Its acceleration is:",
          options: { A: "3.3 m/s²", B: "4.9 m/s²", C: "5.0 m/s²", D: "8.5 m/s²" },
          correctKey: "B",
        },
        {
          stem: "A projectile is launched at 60° with an initial speed of 40 m/s. Its maximum height is closest to: (g = 10 m/s²)",
          options: { A: "30 m", B: "40 m", C: "60 m", D: "80 m" },
          correctKey: "C",
        },
        {
          stem: "Two forces, 8 N east and 6 N north, act on an object. The magnitude of the net force is:",
          options: { A: "2 N", B: "7 N", C: "10 N", D: "14 N" },
          correctKey: "C",
        },
        {
          stem: "The coefficient of static friction between a block and surface is 0.4. If the block weighs 50 N, the maximum static friction force before sliding is:",
          options: { A: "12.5 N", B: "20 N", C: "40 N", D: "125 N" },
          correctKey: "B",
        },
        {
          stem: "Centripetal acceleration for an object moving at speed v in a circle of radius r is:",
          options: { A: "v/r", B: "v²/r", C: "vr", D: "v²r" },
          correctKey: "B",
        },
        {
          stem: "A satellite orbits Earth at constant speed. The work done by gravity on the satellite per orbit is:",
          options: { A: "Positive", B: "Negative", C: "Zero", D: "Equal to its kinetic energy" },
          correctKey: "C",
        },
      ],
    },
    {
      kind: "exam",
      title: "Test: Unit 2 — Energy and Momentum",
      items: [
        {
          stem: "A 4 kg object falls from a height of 10 m. Its kinetic energy just before hitting the ground is: (g = 10 m/s²)",
          options: { A: "40 J", B: "200 J", C: "400 J", D: "800 J" },
          correctKey: "C",
        },
        {
          stem: "A force of 50 N pushes a box 8 m along a floor at 37° below horizontal. The work done by this force is:",
          options: { A: "200 J", B: "240 J", C: "319 J", D: "400 J" },
          correctKey: "C",
        },
        {
          stem: "The center of mass of two particles (2 kg at x = 0 and 4 kg at x = 6 m) is located at:",
          options: { A: "x = 2 m", B: "x = 3 m", C: "x = 4 m", D: "x = 5 m" },
          correctKey: "C",
        },
        {
          stem: "During a perfectly elastic head-on collision between equal masses, the first object:",
          options: {
            A: "Continues at the same speed",
            B: "Comes to rest while the second moves with the first object's original velocity",
            C: "Bounces back at double speed",
            D: "Both objects move at half the original speed",
          },
          correctKey: "B",
        },
        {
          stem: "A 1500 kg car moves at 20 m/s. The braking force needed to stop it in 50 m is:",
          options: { A: "3000 N", B: "6000 N", C: "9000 N", D: "12000 N" },
          correctKey: "B",
        },
        {
          stem: "A ball is dropped from 5 m and bounces to 3.2 m. The coefficient of restitution is closest to:",
          options: { A: "0.50", B: "0.64", C: "0.80", D: "0.90" },
          correctKey: "C",
        },
        {
          stem: "A spring gun fires a 0.02 kg ball from a spring compressed 0.05 m (k = 800 N/m). The ball's launch speed is:",
          options: { A: "5 m/s", B: "10 m/s", C: "20 m/s", D: "31.6 m/s" },
          correctKey: "B",
        },
        {
          stem: "The rotational kinetic energy of a spinning disk (I = 0.5 kg·m², ω = 4 rad/s) is:",
          options: { A: "1 J", B: "2 J", C: "4 J", D: "8 J" },
          correctKey: "C",
        },
      ],
    },
    {
      kind: "exam",
      title: "Exam: Midterm — Chapters 1–11",
      items: [
        {
          stem: "The SI unit of force is the Newton. One Newton equals:",
          options: { A: "1 kg·m/s", B: "1 kg·m/s²", C: "1 kg·m²/s²", D: "1 kg/m·s²" },
          correctKey: "B",
        },
        {
          stem: "A ball thrown at 20 m/s at 30° above horizontal hits the ground at the same height. Its range is approximately: (g = 10 m/s²)",
          options: { A: "20 m", B: "34.6 m", C: "40 m", D: "46.2 m" },
          correctKey: "B",
        },
        {
          stem: "An Atwood machine has masses 3 kg and 5 kg. The acceleration of the system is: (g = 10 m/s²)",
          options: { A: "1.25 m/s²", B: "2.5 m/s²", C: "3.75 m/s²", D: "5.0 m/s²" },
          correctKey: "B",
        },
        {
          stem: "The work done against friction as a 10 kg box slides 4 m across a surface (μk = 0.25) is:",
          options: { A: "10 J", B: "25 J", C: "49 J", D: "98 J" },
          correctKey: "D",
        },
        {
          stem: "A 0.15 kg baseball moving at 40 m/s is caught in 0.01 s. The average force on the catcher's glove is:",
          options: { A: "60 N", B: "150 N", C: "600 N", D: "6000 N" },
          correctKey: "C",
        },
        {
          stem: "A uniform rod of length L pivoted at one end has a moment of inertia of:",
          options: { A: "ML²/12", B: "ML²/3", C: "ML²/2", D: "ML²" },
          correctKey: "B",
        },
        {
          stem: "A 500 g ball on a 1.2 m string swings as a pendulum. Its period is approximately:",
          options: { A: "1.1 s", B: "2.2 s", C: "3.5 s", D: "4.4 s" },
          correctKey: "B",
        },
        {
          stem: "Conservation of angular momentum explains why:",
          options: {
            A: "Objects fall at the same rate regardless of mass",
            B: "Ice skaters spin faster when they pull in their arms",
            C: "Rockets work in the vacuum of space",
            D: "Springs store potential energy",
          },
          correctKey: "B",
        },
        {
          stem: "A block oscillates on a spring. The total mechanical energy is proportional to:",
          options: { A: "Amplitude", B: "Amplitude squared", C: "Frequency", D: "Period" },
          correctKey: "B",
        },
        {
          stem: "Kepler's third law states that the square of a planet's orbital period is proportional to:",
          options: {
            A: "The planet's mass",
            B: "The orbital radius",
            C: "The cube of the semi-major axis",
            D: "The square of the semi-major axis",
          },
          correctKey: "C",
        },
      ],
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
  /** First section's group id (compat for single-group callers). */
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

/**
 * 30-student profile cycle. Realistic distribution:
 *  - 3 at_risk (10%)
 *  - 2 declining (7%)
 *  - 2 sparse_at_risk (7%)
 *  - 1 inactive (3%)
 *  - 8 stable_mid (27%)
 *  - 3 volatile (10%)
 *  - 4 improving (13%)
 *  - 5 high_flyer (17%)
 *  - 2 low_load (7%)
 */
const PROFILE_CYCLE: DemoProfile[] = [
  "at_risk",
  "at_risk",
  "at_risk",
  "declining",
  "declining",
  "sparse_at_risk",
  "sparse_at_risk",
  "inactive",
  "stable_mid",
  "stable_mid",
  "stable_mid",
  "stable_mid",
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
  "improving",
  "high_flyer",
  "high_flyer",
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
    const last = DEMO_LAST_NAMES[zeroBased % DEMO_LAST_NAMES.length]!;
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
  await loadTextbooksFromDb();
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
      setDraftItems(draft.id, spec.items);
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

  const existingTextbooks = listTextbookSourcesForSubject(subject.id);
  if (existingTextbooks.length > 0) {
    logger.info(
      { subjectId: subject.id, count: existingTextbooks.length },
      "demo_seed_textbook_skipped_already_loaded_from_db",
    );
  } else {
    try {
      await ingestTextbook({
        subjectId: subject.id,
        title: "Fundamentals of Physics (Halliday, Resnick & Walker) — 9th Extended Edition",
        versionLabel: "9th-ext",
        text: DEMO_TEXTBOOK_CONTENT,
        createdBy: teacher.id,
      });
    } catch (err) {
      logger.warn({ err }, "demo_seed_textbook_ingest_failed_non_fatal");
    }
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

/* ─── Textbook content based on Halliday, Resnick & Walker — Fundamentals of Physics 9th Ed. ─── */

const DEMO_TEXTBOOK_CONTENT = `# Fundamentals of Physics — Condensed Study Guide

Based on Halliday, Resnick & Walker, 9th Extended Edition

## Part 1: Mechanics

### Chapter 1: Measurement
Physics is based on measurement. The SI system uses seven base units; the three most fundamental for mechanics are the meter (length), kilogram (mass), and second (time). Converting between units uses chain-link conversion: multiply by ratios equal to unity (e.g. 60 s / 1 min). Dimensional analysis checks equations for consistency and helps catch errors. Significant figures reflect the precision of measured quantities.

### Chapter 2: Motion Along a Straight Line
Position, displacement, velocity, and acceleration describe one-dimensional motion. Average velocity is displacement divided by time interval; instantaneous velocity is the derivative of position with respect to time. Constant-acceleration kinematics yield equations: v = v₀ + at, x = x₀ + v₀t + ½at², and v² = v₀² + 2a(x − x₀). Free fall near Earth has a = −g ≈ −9.8 m/s².

### Chapter 3: Vectors
Vectors have magnitude and direction. They can be added graphically (tip-to-tail) or by components. A vector A with components Ax and Ay has magnitude √(Ax² + Ay²) and direction θ = arctan(Ay/Ax). The scalar (dot) product a⃗ · b⃗ = ab cos θ yields a scalar. The vector (cross) product a⃗ × b⃗ has magnitude ab sin θ and direction given by the right-hand rule.

### Chapter 4: Motion in Two and Three Dimensions
Projectile motion decomposes into independent horizontal (constant velocity) and vertical (constant acceleration g) components. The range of a projectile launched at angle θ with speed v₀ is R = (v₀² sin 2θ)/g. Uniform circular motion produces centripetal acceleration a = v²/r directed toward the center. Relative motion adds velocity vectors: v⃗_AC = v⃗_AB + v⃗_BC.

### Chapter 5: Force and Motion — I
Newton's first law (inertia): a body at rest stays at rest unless acted upon by a net external force. Newton's second law: ΣF⃗ = ma⃗. Newton's third law: for every action force there is an equal and opposite reaction force. Weight is the gravitational force W = mg. The normal force is perpendicular to a contact surface.

### Chapter 6: Force and Motion — II
Friction opposes relative motion. Static friction fs ≤ μs·N; kinetic friction fk = μk·N, where μk < μs. Drag force in a fluid: D = ½CρAv². Terminal speed is reached when drag balances weight. Uniform circular motion requires a centripetal force: F = mv²/r.

### Chapter 7: Kinetic Energy and Work
Kinetic energy K = ½mv². Work done by a constant force: W = Fd cos θ. The work-energy theorem: net work = ΔK. Work by a variable force uses integration: W = ∫F dx. Power is the rate of doing work: P = dW/dt = Fv cos θ. One watt = 1 J/s.

### Chapter 8: Potential Energy and Conservation of Energy
Potential energy is energy of configuration. Gravitational PE: U = mgh (near Earth). Elastic PE: U = ½kx². Conservation of mechanical energy: if only conservative forces act, K + U = constant. When nonconservative forces (like friction) act, ΔE_mech = −ΔE_thermal. Total energy is always conserved in an isolated system.

### Chapter 9: Center of Mass and Linear Momentum
Center of mass: x_cm = Σ(m_i·x_i) / Σm_i. Linear momentum p⃗ = mv⃗. Newton's second law in momentum form: ΣF⃗ = dp⃗/dt. Impulse J⃗ = ∫F⃗ dt = Δp⃗. In a closed isolated system, total momentum is conserved. Elastic collisions conserve both momentum and kinetic energy. Inelastic collisions conserve only momentum.

### Chapter 10: Rotation
Angular position θ, angular velocity ω = dθ/dt, angular acceleration α = dω/dt. Rotational kinematics mirrors linear: ω = ω₀ + αt, θ = ω₀t + ½αt². Moment of inertia I = Σm_i·r_i². Parallel-axis theorem: I = I_cm + Mh². Rotational kinetic energy: K = ½Iω². Torque τ = rF sin θ. Newton's second law for rotation: Στ = Iα.

### Chapter 11: Rolling, Torque, and Angular Momentum
Rolling without slipping: v_cm = Rω. Angular momentum L⃗ = r⃗ × p⃗ = Iω⃗. Conservation of angular momentum: if net external torque is zero, L is conserved. A figure skater pulling in arms reduces I, so ω increases. Precession of a gyroscope: Ω = Mgr/(Iω).

## Part 2: Waves & Thermodynamics

### Chapter 12: Equilibrium and Elasticity
Static equilibrium requires both ΣF⃗ = 0 and Στ⃗ = 0. Stress = Force/Area; strain = ΔL/L. Young's modulus E = stress/strain (for tension/compression). Shear modulus and bulk modulus describe other deformations.

### Chapter 15: Oscillations
Simple harmonic motion: x = A cos(ωt + φ), where ω = √(k/m) for a mass-spring system. Period T = 2π/ω. For a simple pendulum, T = 2π√(L/g). Energy oscillates between kinetic and potential: E = ½kA².

### Chapter 16: Waves — I
Transverse waves (displacement ⊥ propagation) vs. longitudinal waves (displacement ∥ propagation). Wave equation: y = A sin(kx − ωt). Speed v = λf = ω/k. On a string, v = √(τ/μ). Superposition principle: overlapping waves add algebraically. Standing waves form at resonant frequencies.

### Chapter 17: Waves — II (Sound)
Sound is a longitudinal pressure wave. Speed of sound in air ≈ 343 m/s at 20 °C. Intensity I = P/(4πr²). Sound level β = 10 log₁₀(I/I₀) in decibels (I₀ = 10⁻¹² W/m²). Doppler effect shifts observed frequency when source or observer moves.

### Chapters 18–20: Thermodynamics
Temperature scales: Celsius, Fahrenheit, Kelvin. Heat is energy transfer due to temperature difference. First law: ΔE_int = Q − W. Specific heat: Q = mcΔT. Ideal gas law: pV = nRT. Second law: entropy of an isolated system never decreases. Carnot efficiency: η = 1 − T_C/T_H.
`;

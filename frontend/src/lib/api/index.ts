export { apiRequest, getHealth } from "./client";
export type {
  ApiErrorBody,
  ApiResult,
  ApiRequestOptions,
  ApiSuccessEnvelope,
  ApiErrorEnvelope,
} from "./types";
export { extractSession } from "./session";
export { login, register, sessionFromAuthResponse } from "./auth";
export type { LoginBody, RegisterBody } from "./auth";
export {
  previewEnrollment,
  signupWithJoinCode,
  parsePreviewInfo,
} from "./enrollment";
export type { EnrollmentPreviewBody, SignupWithJoinCodeBody } from "./enrollment";
export {
  listSubjects,
  createSubject,
  listGroups,
  createGroup,
  listJoinCodes,
  createJoinCode,
  revokeJoinCode,
  assignTeacher,
} from "./academic";
export type { Subject, Group, JoinCodeRecord } from "./academic";
export {
  ingestTextbook,
  queryCorpus,
  normalizeQueryHits,
  pickSnippet,
  pickCitation,
} from "./rag";
export type { TextbookIngestBody, RagQueryBody } from "./rag";
export {
  createDraft,
  listDrafts,
  getDraft,
  putDraftItems,
  publishDraft,
  listPublishedAssessments,
  getPublishedAssessment,
  submitAttempt,
  listMyAttempts,
  unwrapDraftList,
  unwrapPublishedList,
  unwrapAttemptList,
} from "./assessments";
export type {
  AssessmentItem,
  DraftItemInput,
  AssessmentDraft,
  PublishedAssessment,
  AttemptRecord,
} from "./assessments";
export {
  listTeacherInsights,
  setInsightStatus,
  getRiskAnalytics,
  recomputeGroupAnalytics,
  listStudentInsightsMe,
  unwrapInsightList,
} from "./insights";
export type { Insight } from "./insights";
export {
  teacherAgentChat,
  studentAgentChat,
  parseAgentReply,
} from "./agent";
export type { TeacherAgentBody, StudentAgentBody } from "./agent";
export {
  listMyNotifications,
  unwrapNotificationList,
} from "./notifications";
export type { AppNotification } from "./notifications";
export {
  listAuditLogs,
  getAuditExportUrl,
  unwrapAuditList,
} from "./audit";
export type { AuditLogEntry, AuditFilters } from "./audit";
export {
  createTeacher,
  listTeachers,
  unwrapTeacherList,
} from "./users";
export type { TeacherUser, CreateTeacherBody } from "./users";

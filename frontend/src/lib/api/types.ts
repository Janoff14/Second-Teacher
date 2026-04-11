/**
 * Matches backend contract: success payloads use top-level `data`;
 * errors use `error.code` and `error.message`.
 */
export type ApiErrorBody = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiSuccessEnvelope<T> = { data: T };

export type ApiErrorEnvelope = { error: ApiErrorBody };

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ApiErrorBody };

export type ApiRequestOptions = RequestInit & {
  /** Skip attaching Authorization (e.g. login, health). */
  skipAuth?: boolean;
};

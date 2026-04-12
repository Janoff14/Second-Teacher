import { getAccessToken, useAuthStore } from "@/stores/auth-store";
import type {
  ApiErrorBody,
  ApiErrorEnvelope,
  ApiRequestOptions,
  ApiResult,
  ApiSuccessEnvelope,
} from "./types";

function getBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  return base.replace(/\/$/, "");
}

function buildUrl(path: string): string {
  const base = getBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function redirectToLoginIfNeeded(): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path.startsWith("/login") || path.startsWith("/join")) return;
  const from = encodeURIComponent(path + window.location.search);
  window.location.assign("/");
}

/**
 * Typed fetch aligned with `api-for-frontend.md`:
 * - Success: `{ data }`
 * - Error: `{ error: { code, message } }`
 * - 401: clear session and send user to login (no refresh token in API).
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<T>> {
  const responseResult = await fetchWithApi(path, options);
  if (!responseResult.ok) {
    return responseResult;
  }

  const res = responseResult.data;
  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  let json: unknown = null;
  if (res.status !== 204 && res.status !== 205) {
    if (isJson) {
      try {
        json = await res.json();
      } catch {
        json = null;
      }
    }
  }

  if (json && typeof json === "object" && json !== null && "data" in json) {
    return {
      ok: true,
      status: res.status,
      data: (json as ApiSuccessEnvelope<T>).data,
    };
  }
  return {
    ok: true,
    status: res.status,
    data: undefined as T,
  };
}

export async function apiBlobRequest(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<Blob>> {
  const responseResult = await fetchWithApi(path, options);
  if (!responseResult.ok) {
    return responseResult;
  }

  return {
    ok: true,
    status: responseResult.status,
    data: await responseResult.data.blob(),
  };
}

async function fetchWithApi(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<Response>> {
  const { skipAuth, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders);

  const body = rest.body;
  if (
    body !== undefined &&
    typeof body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path), {
      ...rest,
      headers,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Network error";
    const isFailedToFetch =
      raw === "Failed to fetch" || raw.includes("NetworkError") || raw.includes("fetch");
    const message = isFailedToFetch
      ? "Cannot reach the API (Failed to fetch). Start the backend (e.g. cd backend && npm run dev on port 4000), set NEXT_PUBLIC_API_BASE_URL in .env.local, and ensure backend CORS_ORIGIN includes this site’s origin (localhost:3000 and 127.0.0.1:3000)."
      : raw;
    return {
      ok: false,
      status: 0,
      error: { code: "NETWORK_ERROR", message },
    };
  }

  if (res.status === 401) {
    useAuthStore.getState().clearSession();
    redirectToLoginIfNeeded();
  }

  if (res.ok) {
    return {
      ok: true,
      status: res.status,
      data: res,
    };
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  let json: unknown = null;
  if (res.status !== 204 && res.status !== 205 && isJson) {
    try {
      json = await res.json();
    } catch {
      json = null;
    }
  }

  if (json && typeof json === "object" && json !== null && "error" in json) {
    const err = json as ApiErrorEnvelope;
    if (err.error && typeof err.error === "object") {
      return {
        ok: false,
        status: res.status,
        error: normalizeErrorBody(err.error),
      };
    }
  }

  const fallback: ApiErrorBody = {
    code: "HTTP_ERROR",
    message: res.statusText || "Request failed",
  };
  return { ok: false, status: res.status, error: fallback };
}

function normalizeErrorBody(raw: Partial<ApiErrorBody>): ApiErrorBody {
  return {
    code: typeof raw.code === "string" ? raw.code : "UNKNOWN",
    message:
      typeof raw.message === "string" ? raw.message : "An error occurred",
    ...(raw.details !== undefined ? { details: raw.details } : {}),
  };
}

/** `GET /health` — no auth; use to verify API base URL. */
export async function getHealth(): Promise<ApiResult<{ status?: string }>> {
  return apiRequest<{ status?: string }>("/health", {
    method: "GET",
    skipAuth: true,
  });
}

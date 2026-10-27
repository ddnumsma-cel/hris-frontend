// The connection to the MSMA HRIS backend (github.com/adymsma-works/MSMA-HRIS-backend).
// Off unless VITE_API_URL is set (e.g. "/api", which the Vite dev server passes to the API on
// port 4000): without it the app runs on its in-browser data exactly as before. When it's on,
// the parts the backend covers (sign-in, people, 201 files, attendance, leave, approvals, the
// employee's own pages, dashboard figures) read and write the backend; everything else stays local.

let BASE = ((import.meta.env?.VITE_API_URL as string | undefined) ?? "").trim().replace(/\/$/, "");

/** True when the app talks to the backend. */
export const backendOn = () => BASE !== "";

/** Point at the backend (or "" for the in-browser data). The mobile app (mobile/) sets it at start-up. */
export function setBackendBase(url: string) {
  BASE = url.trim().replace(/\/$/, "");
}

const TOKEN_KEY = "heyhr-api-token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // No storage: the sign-in lasts for this page only.
  }
}

/** A refused or failed backend call, with the backend's own message when it gives one. */
export class ApiError extends Error {
  readonly status: number;
  /** The backend's error code, when it sends one (e.g. SEAT_LIMIT_REACHED). */
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (code) this.code = code;
  }
}

/** Called when the backend says the sign-in is no longer valid (set by the auth layer). */
let onSignedOut: (() => void) | null = null;
export function whenSignedOut(fn: () => void) {
  onSignedOut = fn;
}

/** One backend request: JSON in and out, the sign-in token attached. */
export async function api<T>(path: string, init: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}): Promise<T> {
  const query = Object.entries(init.query ?? {}).filter(([, v]) => v !== undefined && v !== "");
  const url = `${BASE}${path}${query.length ? `?${new URLSearchParams(query.map(([k, v]) => [k, String(v)]))}` : ""}`;
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: { ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError("Can't reach the HR server. Check your connection, or ask IT whether the server is running.", 0);
  }
  if (res.status === 401 && path !== "/auth/login") {
    setToken(null);
    onSignedOut?.();
    throw new ApiError("Your sign-in has expired. Please sign in again.", 401);
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    // A form error names the field's problem ("Enter the date") rather than the backend's general "Validation failed".
    const issue = body && typeof body === "object" && Array.isArray((body as { issues?: unknown }).issues) ? (body as { issues: { message?: string }[] }).issues[0]?.message : undefined;
    const message = issue || (body && typeof body === "object" && "message" in body ? String((body as { message: unknown }).message) : "") || `The HR server couldn't do that (${res.status}).`;
    const code = body && typeof body === "object" && "code" in body ? String((body as { code: unknown }).code) : undefined;
    throw new ApiError(message, res.status, code);
  }
  return body as T;
}

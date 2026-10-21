/**
 * Typed client for the MSMA HRIS API. Types are generated from the API's OpenAPI spec:
 *   pnpm openapi   (rebuilds packages/api-client/openapi.json and src/schema.ts)
 * Web and mobile use this instead of hand-written fetch calls.
 */
import createClient, { type Middleware } from 'openapi-fetch';
import type { components, operations, paths } from './schema';

export type { components, operations, paths };
export type ApiClient = ReturnType<typeof createClient<paths>>;

export interface ApiClientOptions {
  baseUrl: string;
  /** Current access token (or null when signed out). */
  getToken: () => string | null | Promise<string | null>;
  /** Called on 401 responses, e.g. to clear the session and show the login screen. */
  onUnauthorized?: () => void;
  /** Custom fetch (the mobile app uses one that sends plain url + init to React Native's fetch). */
  fetch?: (request: Request) => Promise<Response>;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const client = createClient<paths>({
    baseUrl: options.baseUrl.replace(/\/$/, ''),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  // The middleware only reads/mutates and returns nothing. openapi-fetch rejects a returned value unless it
  // is `instanceof` the global Request/Response, and on phones Expo's fetch returns its own Response class
  // ("onResponse: must return new Response() when modifying the response").
  const auth: Middleware = {
    async onRequest({ request }) {
      const token = await options.getToken();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
    },
    onResponse({ response, request }) {
      if (response.status === 401 && !request.url.endsWith('/auth/login'))
        options.onUnauthorized?.();
    },
  };
  client.use(auth);
  return client;
}

/** Error thrown by `unwrap` with the API's human-readable message. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function messageOf(
  error: unknown,
  status: number,
): { message: string; issues: { path: string; message: string }[] } {
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; issues?: { path: string; message: string }[] };
    const issues = Array.isArray(e.issues) ? e.issues : [];
    if (issues.length) return { message: issues[0].message, issues };
    if (typeof e.message === 'string') return { message: e.message, issues };
    if (Array.isArray(e.message)) return { message: String(e.message[0]), issues };
  }
  if (status === 413) return { message: 'The file is too large (limit 8 MB).', issues: [] };
  if (status === 0)
    return { message: 'Cannot reach the server. Check your connection.', issues: [] };
  return { message: `Something went wrong (HTTP ${status})`, issues: [] };
}

/** fetch rejects with a TypeError when the network fails; timeouts/aborts come from our own wrappers. */
function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const message = e instanceof Error ? e.message : String(e);
  return /network|fetch|no answer|timed? ?out|abort|connect|ECONN|ENOTFOUND/i.test(message);
}

/** Await an openapi-fetch call and return its data, or throw ApiError with the server's message. */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: { data?: T; error?: unknown; response: Response };
  try {
    result = await call;
  } catch (e) {
    // Keep the underlying reason (e.g. "Network request failed", a timeout) so problems can be diagnosed.
    const reason = e instanceof Error && e.message ? ` (${e.message})` : '';
    if (isNetworkError(e))
      throw new ApiError(
        `Cannot reach the server${reason}. Check that the API is running and the address is correct.`,
        0,
      );
    throw new ApiError(`Something went wrong in the app${reason}. Please try again.`, 0);
  }
  if (result.error !== undefined || !result.response.ok) {
    const { message, issues } = messageOf(result.error, result.response.status);
    throw new ApiError(message, result.response.status, issues);
  }
  return result.data as T;
}

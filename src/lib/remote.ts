// Data kept on a server rather than in this browser: the MSMA HRIS backend (VITE_API_URL) or the older HeyHR
// API server (VITE_API_MODE=server). Modules whose endpoints both servers share call these instead of choosing.

import { api, serverMode } from "./http";
import { api as backendApi, backendOn } from "./backend/client";

/** True when the data lives on a server. */
export const remoteOn = () => serverMode || backendOn();

/** One call to whichever server is in use, with the HeyHR API server's (method, path, body) shape. */
export function remoteApi<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  return backendOn() ? backendApi<T>(path, { method, body }) : api<T>(method, path, body);
}

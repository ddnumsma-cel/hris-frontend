import { createApiClient } from '@msma/api-client';

/**
 * The API is reached through this web server (/api, see next.config.ts), so it works on this PC, from
 * other PCs and through `pnpm share`. A full URL in NEXT_PUBLIC_API_URL is used only if it isn't local
 * (e.g. a separately hosted API); "http://localhost:4000" from older .env files is ignored on purpose.
 */
const configured = process.env.NEXT_PUBLIC_API_URL?.trim() ?? '';
const isLocal = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url);
export const API_URL = configured && !isLocal(configured) ? configured : '/api';
const TOKEN_KEY = 'msma-token';

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // storage unavailable (private mode): session lasts until reload
    }
  },
};

/** Typed API client generated from the OpenAPI spec (see packages/api-client). */
export const api = createApiClient({
  baseUrl: API_URL,
  getToken: () => tokenStore.get(),
  onUnauthorized: () => onUnauthorized?.(),
});

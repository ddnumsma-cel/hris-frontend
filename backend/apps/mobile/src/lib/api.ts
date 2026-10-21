import { createApiClient } from '@msma/api-client';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Where the API lives, in order of preference:
 * 1. EXPO_PUBLIC_API_URL from apps/mobile/.env (pin it manually, e.g. for a deployed API)
 * 2. Phones (Expo Go): the same address the app was loaded from + "/__api". The Expo dev server
 *    forwards that to the API on the PC (apps/mobile/metro.config.js). Works on any Wi-Fi and with
 *    `pnpm mobile:tunnel`, and needs no second port. Read at startup, so a new network just needs a
 *    new QR scan / reload, not a rebuild.
 * 3. Web preview → the API on port 4000 of the same host; Android emulator fallback → 10.0.2.2.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined')
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  const hostUri = Constants.expoConfig?.hostUri ?? ''; // "172.24.16.176:8081" or "abc-8081.exp.direct"
  if (hostUri) {
    const host = hostUri.split(':')[0];
    const isIpOrLocal = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host === 'localhost';
    return isIpOrLocal ? `http://${hostUri}/__api` : `https://${host}/__api`;
  }
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000';
  return 'http://localhost:4000';
}

export const API_URL = resolveApiUrl();

const TOKEN_KEY = 'msma-token';
let cachedToken: string | null | undefined;

/** Access token in the device keychain / keystore (localStorage on web preview). */
export const tokenStore = {
  async get(): Promise<string | null> {
    if (cachedToken !== undefined) return cachedToken;
    try {
      cachedToken =
        Platform.OS === 'web'
          ? localStorage.getItem(TOKEN_KEY)
          : await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      cachedToken = null;
    }
    return cachedToken;
  },
  async set(token: string | null) {
    cachedToken = token;
    try {
      if (Platform.OS === 'web') {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
      } else if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
      else await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      // storage unavailable: session lasts until the app closes
    }
  },
};

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

const TIMEOUT_MS = 15_000;

/** fetch with a timeout, so a wrong address fails with a clear message instead of hanging. */
async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted)
      throw new Error(`no answer from ${url} after ${TIMEOUT_MS / 1000} s`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * On phones, hand React Native's fetch a plain URL + options instead of a Request object
 * (the most widely supported form), with the same headers and body.
 */
async function nativeFetch(request: Request): Promise<Response> {
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return fetchWithTimeout(request.url, {
    method: request.method,
    headers,
    body: hasBody ? await request.text() : undefined,
  });
}

/** Typed API client generated from the OpenAPI spec (packages/api-client). */
export const api = createApiClient({
  baseUrl: API_URL,
  getToken: () => tokenStore.get(),
  onUnauthorized: () => onUnauthorized?.(),
  fetch: Platform.OS === 'web' ? undefined : nativeFetch,
});

/** Plain GET /health, used by the login screen's "Test connection" button. */
export async function checkConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetchWithTimeout(`${API_URL}/health`);
    if (res.ok) return { ok: true, message: `Connected to ${API_URL}` };
    return { ok: false, message: `${API_URL} answered HTTP ${res.status}` };
  } catch (e) {
    return {
      ok: false,
      message: `Could not reach ${API_URL}/health (${(e as Error).message || 'unknown error'})`,
    };
  }
}

import type { ZodType } from 'zod';

import {
  type AuthSession,
  clearAuthSession,
  getAuthSession,
  persistAuthSession,
} from '../auth/auth-session';

const DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1';
const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL);
let loginRedirectHandler: ((path: string) => void) | null = null;
let refreshInFlight: Promise<AuthSession> | null = null;

interface ApiFetchOptions<T> extends RequestInit {
  schema?: ZodType<T>;
  skipAuthRefresh?: boolean;
}

export function resolveApiBaseUrl(
  configuredApiUrl: string | undefined,
): string {
  const trimmedUrl = configuredApiUrl?.trim();
  return trimmedUrl && trimmedUrl.length > 0
    ? trimmedUrl
    : DEFAULT_API_BASE_URL;
}

export function buildApiUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = baseUrl.endsWith('/')
    ? baseUrl.slice(0, -1)
    : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
}

export function setLoginRedirect(
  handler: ((path: string) => void) | null,
): void {
  loginRedirectHandler = handler;
}

export async function apiFetch<T>(
  path: string,
  init?: ApiFetchOptions<T>,
): Promise<T | undefined> {
  const response = await performRequest(path, init);

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    if (response.status === 401 && !init?.skipAuthRefresh) {
      try {
        await refreshAuthSession();
        return apiFetch(path, {
          ...init,
          skipAuthRefresh: true,
        });
      } catch (error) {
        clearAuthSession();
        redirectToLogin('/login');
        throw error;
      }
    }

    if (response.status === 401) {
      clearAuthSession();
      redirectToLogin('/login');
    }
    throw new Error(
      getApiErrorMessage(payload) ?? `Request failed (${response.status})`,
    );
  }

  if (isEmptySuccessfulResponse(response)) {
    return undefined;
  }

  return parseJsonIfNotEmpty(response, init?.schema);
}

function attachAuthHeader(headers: Record<string, string>): void {
  const session = getAuthSession();
  if (!session || hasHeader(headers, 'Authorization')) {
    return;
  }

  headers.Authorization = `Bearer ${session.accessToken}`;
}

async function performRequest<T>(
  path: string,
  init?: ApiFetchOptions<T>,
): Promise<Response> {
  const {
    schema: _schema,
    skipAuthRefresh: _skipAuthRefresh,
    ...requestInit
  } = init ?? {};
  void _schema;
  void _skipAuthRefresh;
  const headers = normalizeHeaders(init?.headers);
  attachAuthHeader(headers);
  const body = normalizeRequestBody(init?.body, headers);

  return fetch(buildApiUrl(API_BASE_URL, path), {
    ...requestInit,
    headers,
    body,
  });
}

async function parseJsonIfNotEmpty<T>(
  response: Response,
  schema?: ZodType<T>,
): Promise<T | undefined> {
  const text = await response.text();
  if (text.trim().length === 0) {
    return undefined;
  }

  const payload = JSON.parse(text) as unknown;
  if (!schema) {
    return payload as T;
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error('API response shape was invalid');
  }

  return parsed.data;
}

function isEmptySuccessfulResponse(response: Response): boolean {
  return response.status === 204 || response.status === 205;
}

function getApiErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const maybeError = (payload as { error?: unknown }).error;
  if (!maybeError || typeof maybeError !== 'object') {
    return undefined;
  }

  const maybeMessage = (maybeError as { message?: unknown }).message;
  return typeof maybeMessage === 'string' ? maybeMessage : undefined;
}

function normalizeHeaders(
  headers: HeadersInit | undefined,
): Record<string, string> {
  if (!headers) {
    return {};
  }

  const normalized: Record<string, string> = {};

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      normalized[key] = value;
    });
    return normalized;
  }

  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      normalized[key] = value;
    }
    return normalized;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      normalized[key] = value;
    }
  }

  return normalized;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const target = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === target);
}

export async function refreshAuthSession(): Promise<AuthSession> {
  const session = getAuthSession();
  if (!session?.accessToken) {
    throw new Error('No persisted session to refresh');
  }

  if (!refreshInFlight) {
    refreshInFlight = fetch(buildApiUrl(API_BASE_URL, '/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => null);
          throw new Error(
            getApiErrorMessage(payload) ??
              `Request failed (${response.status})`,
          );
        }

        const payload = await parseJsonIfNotEmpty(response);
        if (
          !payload ||
          typeof payload !== 'object' ||
          typeof (payload as { accessToken?: unknown }).accessToken !== 'string'
        ) {
          throw new Error('API response shape was invalid');
        }

        persistAuthSession({
          accessToken: (payload as { accessToken: string }).accessToken,
        });
        return {
          accessToken: (payload as { accessToken: string }).accessToken,
        };
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

function redirectToLogin(path: string): void {
  if (loginRedirectHandler) {
    loginRedirectHandler(path);
    return;
  }

  const location = readBrowserLocation();
  if (!location || location.pathname === path) {
    return;
  }

  location.assign(path);
}

function normalizeRequestBody(
  body: RequestInit['body'],
  headers: Record<string, string>,
): RequestInit['body'] {
  if (body === undefined || body === null) {
    return body;
  }

  if (shouldSerializeBodyAsJson(body, headers)) {
    headers['Content-Type'] = 'application/json';
    return JSON.stringify(body);
  }

  if (shouldAddJsonContentType(body, headers)) {
    headers['Content-Type'] = 'application/json';
  }

  return body;
}

function shouldAddJsonContentType(
  body: RequestInit['body'],
  headers: Record<string, string>,
): boolean {
  if (hasHeader(headers, 'Content-Type')) {
    return false;
  }

  return typeof body === 'string' && isJsonString(body);
}

function shouldSerializeBodyAsJson(
  body: RequestInit['body'],
  headers: Record<string, string>,
): boolean {
  if (hasHeader(headers, 'Content-Type')) {
    return false;
  }

  const unknownBody = body as unknown;
  return Array.isArray(unknownBody) || isPlainObject(unknownBody);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isJsonString(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function readBrowserLocation(): {
  assign: (path: string) => void;
  pathname?: string;
} | null {
  const maybeWindow = (
    globalThis as typeof globalThis & {
      window?: {
        location?: {
          assign: (path: string) => void;
          pathname?: string;
        };
      };
    }
  ).window;

  if (maybeWindow?.location) {
    return maybeWindow.location;
  }

  return (
    (
      globalThis as typeof globalThis & {
        location?: {
          assign: (path: string) => void;
          pathname?: string;
        };
      }
    ).location ?? null
  );
}

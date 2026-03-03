const DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1';
const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL);

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

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T | undefined> {
  const response = await fetch(buildApiUrl(API_BASE_URL, path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    throw new Error(
      getApiErrorMessage(payload) ?? `Request failed (${response.status})`,
    );
  }

  if (isEmptySuccessfulResponse(response)) {
    return undefined;
  }

  return parseJsonIfNotEmpty<T>(response);
}

async function parseJsonIfNotEmpty<T>(
  response: Response,
): Promise<T | undefined> {
  const text = await response.text();
  if (text.trim().length === 0) {
    return undefined;
  }

  return JSON.parse(text) as T;
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

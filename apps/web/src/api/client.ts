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
  const headers = normalizeHeaders(init?.headers);
  const body = normalizeRequestBody(init?.body, headers);

  const response = await fetch(buildApiUrl(API_BASE_URL, path), {
    ...init,
    headers,
    body,
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

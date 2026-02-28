const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload: ApiErrorPayload = await response
      .json()
      .catch(() => ({}) as ApiErrorPayload);
    throw new Error(
      payload?.error?.message ?? `Request failed (${response.status})`,
    );
  }

  return response.json() as Promise<T>;
}

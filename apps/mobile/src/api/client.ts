import * as SecureStore from 'expo-secure-store';

const DEFAULT_API_URL = 'http://localhost:3000/api/v1';
const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL);

function resolveApiUrl(configuredApiUrl: string | undefined): string {
  const trimmedUrl = configuredApiUrl?.trim();
  return trimmedUrl && trimmedUrl.length > 0 ? trimmedUrl : DEFAULT_API_URL;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await SecureStore.getItemAsync('access_token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 409) {
    throw new Error('409_CONFLICT');
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

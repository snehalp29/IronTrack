export const DEFAULT_API_PREFIX = 'api/v1';

function normalizePrefixValue(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

export function normalizeApiPrefix(
  prefix: string | undefined,
  fallback = DEFAULT_API_PREFIX,
): string {
  const normalizedPrefix = prefix ? normalizePrefixValue(prefix) : '';
  if (normalizedPrefix) {
    return normalizedPrefix;
  }

  const normalizedFallback = normalizePrefixValue(fallback);
  return normalizedFallback || DEFAULT_API_PREFIX;
}

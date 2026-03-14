export function trimString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

export function trimStringOrUndefined(value: unknown): unknown {
  if (typeof value !== 'string') {
    // Preserve non-strings so Zod can report accurate type errors.
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

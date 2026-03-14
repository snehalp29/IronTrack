export function toLocalDateString(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
}

// Expects a UTC-anchored Date; callers should pass UTC timestamps/date-only values.
export function startOfWeek(date: Date): Date {
  const value = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = value.getUTCDay();
  const shift = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + shift);
  return value;
}

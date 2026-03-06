import { BadRequestException } from '@nestjs/common';

export function normalizeTimezoneOrThrow(
  timezone: string | undefined,
  fallback?: string,
): string | undefined {
  const candidate = timezone?.trim();
  const resolved =
    candidate && candidate.length > 0 ? candidate : fallback?.trim();

  if (!resolved) {
    return undefined;
  }

  if (!isValidTimezone(resolved)) {
    throw new BadRequestException({
      code: 'INVALID_TIMEZONE',
      message: 'Invalid timezone',
    });
  }

  return resolved;
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
    });
    return true;
  } catch {
    return false;
  }
}

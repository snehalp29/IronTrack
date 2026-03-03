import { z } from 'zod';

const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDateOnly(value: string): boolean {
  if (!ISO_DATE_ONLY_PATTERN.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const isoDateOnlySchema = z
  .string()
  .regex(ISO_DATE_ONLY_PATTERN)
  .refine(isIsoDateOnly, {
    message: 'Invalid calendar date',
  });

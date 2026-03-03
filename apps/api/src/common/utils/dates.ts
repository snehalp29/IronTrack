export function startOfWeek(date: Date): Date {
  const value = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = value.getUTCDay();
  const shift = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + shift);
  return value;
}

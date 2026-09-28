export function parseStoredDateTime(value: string | undefined): Date {
  if (!value) return new Date(Number.NaN);
  return new Date(value);
}

export function formatDateTimeInput(value: string): string {
  const date = parseStoredDateTime(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (part: number): string => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getLocalDateTimeValue(date = new Date()): string {
  return formatDateTimeInput(date.toISOString());
}


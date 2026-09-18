export const DISPLAY_TIME_ZONE = 'America/Denver';

export interface DateTimeParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

export function getDateTimeParts(date: Date, timeZone = DISPLAY_TIME_ZONE): DateTimeParts {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).reduce((values, part) => {
    if (part.type in values) {
      values[part.type as keyof DateTimeParts] = part.value;
    }
    return values;
  }, {} as DateTimeParts);
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string): number {
  const parts = getDateTimeParts(date, timeZone);
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - date.getTime();
}

export function zonedDateTimeToDate(value: string, timeZone: string): Date {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return new Date(value);
  const wallClockUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  let timestamp = wallClockUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    timestamp = wallClockUtc - getTimeZoneOffsetMilliseconds(new Date(timestamp), timeZone);
  }
  return new Date(timestamp);
}

export function parseStoredDateTime(value: string | undefined): Date {
  if (!value) return new Date(Number.NaN);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)
    ? zonedDateTimeToDate(value, DISPLAY_TIME_ZONE)
    : new Date(value);
}

export function formatDateTimeInput(value: string, timeZone = DISPLAY_TIME_ZONE): string {
  const date = parseStoredDateTime(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = getDateTimeParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function getMountainDateTimeValue(date = new Date()): string {
  return formatDateTimeInput(date.toISOString());
}

export function formatFollowUpDate(value: string | undefined, timeZone = DISPLAY_TIME_ZONE): string {
  const normalized = normalizeFollowUpDateValue(value);
  if (!normalized) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', timeZone
  }).format(new Date(`${normalized}T12:00:00Z`));
}

export function normalizeFollowUpDateValue(value: string | undefined): string {
  if (!value) return '';
  const trimValue = String(value).trim();
  if (!trimValue) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimValue)) return trimValue;
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimValue)) return trimValue.slice(0, 10);
  const asDate = new Date(trimValue);
  return Number.isFinite(asDate.getTime()) ? asDate.toISOString().slice(0, 10) : '';
}

export function parseFollowUpDate(value: string | undefined): Date {
  const normalized = normalizeFollowUpDateValue(value);
  return normalized ? new Date(`${normalized}T00:00:00`) : new Date(Number.NaN);
}

export function formatFollowUpWindow(followUpDate: string | undefined, now = new Date()): string {
  const normalizedValue = normalizeFollowUpDateValue(followUpDate);
  if (!normalizedValue) return 'No follow-up set';
  const date = parseFollowUpDate(normalizedValue);
  if (!Number.isFinite(date.getTime())) return 'No follow-up set';
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / 86400000);
  if (diffDays <= 0) return `Due ${diffDays === 0 ? 'today' : 'now'}`;
  if (diffDays === 1) return 'Due tomorrow';
  return `In ${diffDays} days`;
}

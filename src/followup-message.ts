import type { Entry } from './models/entry';

const DEFAULT_MEETING_TIME_ZONE = 'America/Denver';

export interface FollowUpMessageOptions {
  timeZone?: string;
  now?: Date;
}

export type FollowUpMessageEntry = Pick<Entry, 'fullName' | 'closer' | 'appointmentDate' | 'appointmentTimeZone'>;

function getCalendarDateValue(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function getMeetingDayPhrase(appointmentDate: Date, timeZone: string, now: Date): string {
  const appointmentDay = getCalendarDateValue(appointmentDate, timeZone);
  if (appointmentDay === getCalendarDateValue(now, timeZone)) {
    return 'today';
  }
  const tomorrow = new Date(now.getTime() + 86400000);
  if (appointmentDay === getCalendarDateValue(tomorrow, timeZone)) {
    return 'tomorrow';
  }
  const monthDay = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(appointmentDate);
  return `on ${monthDay}`;
}

function getMeetingClockTime(appointmentDate: Date, timeZone: string): string {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone, hour: 'numeric', minute: '2-digit', hour12: true
  }).format(appointmentDate);
  const match = formatted.match(/^(\d{1,2}):(\d{2})\s?([AP]M)$/i);
  if (!match) {
    return formatted;
  }
  const [, hour, minute, meridiem] = match;
  const minutePart = minute === '00' ? '' : `:${minute}`;
  return `${hour}${minutePart}${meridiem.toLowerCase()}`;
}

function getMeetingTimeZoneAbbreviation(appointmentDate: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short', hour: 'numeric' }).formatToParts(appointmentDate);
  return parts.find((part) => part.type === 'timeZoneName')?.value || '';
}

export function buildFollowUpConfirmationMessage(entry: FollowUpMessageEntry, options: FollowUpMessageOptions = {}): string {
  const timeZone = entry.appointmentTimeZone || options.timeZone || DEFAULT_MEETING_TIME_ZONE;
  const now = options.now || new Date();
  const appointmentDate = new Date(String(entry.appointmentDate));
  const firstName = String(entry.fullName || '').trim().split(/\s+/)[0] || 'there';
  const closer = entry.closer || 'your closer';
  const dayPhrase = getMeetingDayPhrase(appointmentDate, timeZone, now);
  const timePhrase = getMeetingClockTime(appointmentDate, timeZone);
  const zoneAbbreviation = getMeetingTimeZoneAbbreviation(appointmentDate, timeZone);
  return `Hey ${firstName}, just confirming here if you're still good to go for your Zoom meeting ${dayPhrase} at ${timePhrase} ${zoneAbbreviation} with ${closer}?\n\nShoot through a "Yes" and we'll get it locked in our end 👍`;
}

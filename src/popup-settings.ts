import { DISPLAY_TIME_ZONE, getMountainDateTimeValue } from './timezone';

export const REPORTING_TIME_ZONE_KEY = 'reportingTimeZone';
export const DEFAULT_TIME_ZONE_KEY = 'defaultAppointmentTimeZone';

export function getTimeZoneDisplayName(timeZone: string): string {
  const names: Record<string, string> = {
    'America/Denver': 'Mountain Time',
    'America/Los_Angeles': 'Pacific Time',
    'America/Chicago': 'Central Time',
    'America/New_York': 'Eastern Time',
    UTC: 'UTC'
  };
  return names[timeZone] || String(timeZone || '').replace(/_/g, ' ');
}

export function getReportingTimeZone(documentRef: Document = document): string {
  const select = documentRef.getElementById('reporting-time-zone') as HTMLSelectElement | null;
  return select?.value || DISPLAY_TIME_ZONE;
}

export function getLocalDateValue(
  date = new Date(),
  timeZone = getReportingTimeZone()
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce<Record<string, string>>((values, part) => {
    values[part.type] = part.value;
    return values;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getDefaultAppointmentTimeZone(documentRef: Document = document): string {
  const select = documentRef.getElementById('default-time-zone') as HTMLSelectElement | null;
  return select?.value || DISPLAY_TIME_ZONE;
}

export function getLocalDateTimeValue(date = new Date()): string {
  return getMountainDateTimeValue(date);
}

export function updateCallDateTime(documentRef: Document = document): void {
  const callDateTime = documentRef.querySelector<HTMLInputElement>('[name="callDateTime"]');
  if (callDateTime && !callDateTime.value) {
    callDateTime.value = getLocalDateTimeValue();
  }
}

export function syncDefaultAppointmentTimeZone(documentRef: Document = document): void {
  const defaultSelect = documentRef.getElementById('default-time-zone') as HTMLSelectElement | null;
  const appointmentTimeZone = documentRef.querySelector<HTMLSelectElement>('[name="appointmentTimeZone"]');
  if (defaultSelect && !defaultSelect.value) defaultSelect.value = DISPLAY_TIME_ZONE;
  if (appointmentTimeZone && !appointmentTimeZone.value) {
    appointmentTimeZone.value = defaultSelect?.value || DISPLAY_TIME_ZONE;
  }
}

export interface ChromeStorageArea {
  get(defaults: Record<string, string>): Promise<Record<string, string>>;
}

export async function loadDefaultAppointmentTimeZone(
  storage: ChromeStorageArea,
  documentRef: Document = document
): Promise<void> {
  const stored = await storage.get({
    [DEFAULT_TIME_ZONE_KEY]: DISPLAY_TIME_ZONE,
    [REPORTING_TIME_ZONE_KEY]: DISPLAY_TIME_ZONE
  });
  const defaultValue = stored[DEFAULT_TIME_ZONE_KEY] || DISPLAY_TIME_ZONE;
  const reportingValue = stored[REPORTING_TIME_ZONE_KEY] || DISPLAY_TIME_ZONE;
  const defaultSelect = documentRef.getElementById('default-time-zone') as HTMLSelectElement | null;
  const reportingSelect = documentRef.getElementById('reporting-time-zone') as HTMLSelectElement | null;
  const appointmentTimeZone = documentRef.querySelector<HTMLSelectElement>('[name="appointmentTimeZone"]');
  if (defaultSelect) defaultSelect.value = defaultValue;
  if (reportingSelect) reportingSelect.value = reportingValue;
  if (appointmentTimeZone && !appointmentTimeZone.value) appointmentTimeZone.value = defaultValue;
}

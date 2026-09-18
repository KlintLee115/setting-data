import type { Entry } from './models/entry';
import { parseFollowUpDate } from './timezone';

export interface UpcomingAppointment extends Omit<Entry, 'followUpDate'> {
  appointmentInstant: Date;
  followUpDate: Date | null;
  label: string;
  todoType?: 'appointment' | 'callback';
}

export function getAppointmentLabel(appointmentInstant: Date, now: Date): string {
  const diffDays = Math.ceil((appointmentInstant.getTime() - now.getTime()) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays <= 14) return 'In 2 weeks';
  return `In ${Math.ceil(diffDays / 7)} weeks`;
}

export function getUpcomingAppointments(
  entries: Entry[],
  now = new Date(),
  parseFollowUp: (value: string) => Date = parseFollowUpDate
): UpcomingAppointment[] {
  return entries
    .filter((entry) => Boolean(entry.appointmentDate))
    .map((entry) => {
      const appointmentInstant = new Date(entry.appointmentDate as string);
      const followUpDate = entry.followUpDate ? parseFollowUp(entry.followUpDate) : null;
      return {
        ...entry,
        appointmentInstant,
        followUpDate,
        label: getAppointmentLabel(appointmentInstant, now)
      };
    })
    .filter((entry) => Number.isFinite(entry.appointmentInstant.getTime())
      && entry.appointmentInstant.getTime() >= now.getTime())
    .sort((first, second) => first.appointmentInstant.getTime() - second.appointmentInstant.getTime());
}

export function getTodoItems(
  entries: Entry[],
  now = new Date(),
  parseFollowUp: (value: string) => Date = parseFollowUpDate
): UpcomingAppointment[] {
  const appointments = getUpcomingAppointments(entries, now, parseFollowUp)
    .map((entry) => ({ ...entry, todoType: 'appointment' as const }));
  const callbacks = entries
    .filter((entry) => entry.leaveReason === 'Had to go' && entry.calledBack !== 'Yes')
    .map((entry) => {
      const taskInstant = new Date(entry.callDateTime || entry.createdAt || entry.timestamp || '');
      return {
        ...entry,
        appointmentInstant: taskInstant,
        followUpDate: entry.followUpDate ? parseFollowUp(entry.followUpDate) : null,
        label: 'Call back',
        todoType: 'callback' as const
      };
    })
    .filter((entry) => Number.isFinite(entry.appointmentInstant.getTime()));
  return [...appointments, ...callbacks]
    .sort((first, second) => first.appointmentInstant.getTime() - second.appointmentInstant.getTime());
}

import type { LeaveReason } from './outcome';

export type PhoneOutcome = 'Yes' | 'No' | '';
export type YesNo = 'Yes' | 'No' | '';
export type EntryStatus = 'Booked' | 'Picked Up' | 'No Answer' | 'Disqualified' | 'Had to go' | '';

export interface Entry {
  id?: string;
  recordType?: 'call' | 'entry';
  entryType?: string;
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  phonePickedUp?: PhoneOutcome;
  callDateTime?: string;
  callDuration?: string;
  lastTextMessage?: string;
  disqualified?: YesNo;
  disqualificationReason?: string;
  pitched?: YesNo;
  wasSet?: YesNo;
  closer?: string;
  appointmentDate?: string;
  followUpDate?: string;
  appointmentTimeZone?: string;
  leaveReason?: LeaveReason | string;
  calledBack?: YesNo;
  notes?: string;
  status?: EntryStatus | string;
  timestamp?: string;
  createdAt?: string;
  sourceUrl?: string;
  [key: string]: unknown;
}

export const BOOKED_STATUS: EntryStatus = 'Booked';
export const DISQUALIFIED_STATUS: EntryStatus = 'Disqualified';
export const PICKED_UP_STATUS: EntryStatus = 'Picked Up';
export const NO_ANSWER_STATUS: EntryStatus = 'No Answer';

export function normalizeEntryStatus(entry: Entry): Entry {
  if (entry.disqualified === 'Yes') {
    return { ...entry, status: DISQUALIFIED_STATUS };
  }
  if (entry.wasSet === 'Yes' || entry.appointmentDate) {
    return { ...entry, status: BOOKED_STATUS };
  }
  if (entry.phonePickedUp === 'Yes') {
    return { ...entry, status: PICKED_UP_STATUS };
  }
  if (entry.phonePickedUp === 'No') {
    return { ...entry, status: NO_ANSWER_STATUS };
  }
  return { ...entry, status: entry.status || '' };
}

export function toCallEntry(entry: Entry): Entry {
  return { ...entry, recordType: 'call' };
}

export function toManualEntry(entry: Entry): Entry {
  return { ...normalizeEntryStatus(entry), recordType: 'entry' };
}

export function combineEntries(logs: Entry[], manualEntries: Entry[]): Entry[] {
  return [...logs.map(toCallEntry), ...manualEntries.map(toManualEntry)];
}

import type { Entry } from './models/entry';
import { getLeaveReasonCounts } from './models/outcome';

export interface HourlySummary {
  hour: number;
  total: number;
  pickedUp: number;
  rate: number | null;
}

export interface DailySummary {
  calls: number;
  pickups: number;
  noAnswers: number;
  disqualified: number;
  pitches: number;
  appointments: number;
  money: number;
  partner: number;
  timing: number;
  hadToGo: number;
  pitchRate: number | null;
  setRate: number | null;
  averageDuration: number;
}

function isCallEntry(entry: Entry): boolean {
  return entry.entryType === 'Call';
}

function isPickedUp(entry: Entry): boolean {
  return isCallEntry(entry) ? entry.status === 'Picked Up' : entry.phonePickedUp === 'Yes';
}

function isNoAnswer(entry: Entry): boolean {
  return isCallEntry(entry) ? entry.status === 'No Answer' : entry.phonePickedUp === 'No';
}

export function getHourlySummary<T extends Entry>(entries: T[], getHour: (entry: T) => number): HourlySummary[] {
  return Array.from({ length: 17 }, (_, index) => index + 5).map((hour) => {
    const hourlyEntries = entries.filter((entry) => getHour(entry) === hour);
    const pickedUp = hourlyEntries.filter(isPickedUp).length;
    return {
      hour,
      total: hourlyEntries.length,
      pickedUp,
      rate: hourlyEntries.length ? (pickedUp / hourlyEntries.length) * 100 : null
    };
  });
}

export function getDailySummary(
  entries: Entry[],
  durationToSeconds: (value: string | undefined) => number
): DailySummary {
  const callEntries = entries.filter((entry) => isCallEntry(entry) || ['Yes', 'No'].includes(entry.phonePickedUp || ''));
  const pitchedEntries = entries.filter((entry) => entry.disqualified === 'No');
  const durations = entries.map((entry) => durationToSeconds(entry.callDuration)).filter(Boolean);
  const totalDuration = durations.reduce((total, duration) => total + duration, 0);
  const pitchedCount = pitchedEntries.filter((entry) => entry.pitched === 'Yes').length;
  const setCount = pitchedEntries.filter((entry) => entry.wasSet === 'Yes').length;
  const leaveReasons = getLeaveReasonCounts(entries);

  return {
    calls: callEntries.length,
    pickups: callEntries.filter(isPickedUp).length,
    noAnswers: callEntries.filter(isNoAnswer).length,
    disqualified: entries.filter((entry) => entry.disqualified === 'Yes').length,
    pitches: entries.filter((entry) => entry.pitched === 'Yes').length,
    appointments: entries.filter((entry) => entry.wasSet === 'Yes').length,
    money: leaveReasons.money,
    partner: leaveReasons.partner,
    timing: leaveReasons.timing,
    hadToGo: leaveReasons.hadToGo,
    pitchRate: pitchedEntries.length ? (pitchedCount / pitchedEntries.length) * 100 : null,
    setRate: pitchedEntries.length ? (setCount / pitchedEntries.length) * 100 : null,
    averageDuration: durations.length ? Math.round(totalDuration / durations.length) : 0
  };
}

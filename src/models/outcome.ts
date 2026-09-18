export const LEAVE_REASON_HAD_TO_GO = 'Had to go';
export const LEAVE_REASON_MONEY = 'Money';
export const LEAVE_REASON_PARTNER = 'Partner';
export const LEAVE_REASON_TIMING = 'Timing';

export const LEAVE_REASONS = [
  LEAVE_REASON_HAD_TO_GO,
  LEAVE_REASON_MONEY,
  LEAVE_REASON_PARTNER,
  LEAVE_REASON_TIMING
] as const;

export type LeaveReason = typeof LEAVE_REASONS[number];
export type LegacyLeaveReason = 'Objection' | 'Spouse';

export function normalizeLeaveReason(value: unknown): LeaveReason | '' {
  if (value === 'Objection') return LEAVE_REASON_MONEY;
  if (value === 'Spouse') return LEAVE_REASON_PARTNER;
  return LEAVE_REASONS.includes(value as LeaveReason) ? value as LeaveReason : '';
}

export interface LeaveReasonCounts {
  money: number;
  partner: number;
  timing: number;
  hadToGo: number;
}

export function getLeaveReasonCounts(entries: ReadonlyArray<{ leaveReason?: unknown }> = []): LeaveReasonCounts {
  return entries.reduce<LeaveReasonCounts>((counts, entry) => {
    const reason = normalizeLeaveReason(entry.leaveReason);
    if (reason === LEAVE_REASON_MONEY) counts.money += 1;
    if (reason === LEAVE_REASON_PARTNER) counts.partner += 1;
    if (reason === LEAVE_REASON_TIMING) counts.timing += 1;
    if (reason === LEAVE_REASON_HAD_TO_GO) counts.hadToGo += 1;
    return counts;
  }, { money: 0, partner: 0, timing: 0, hadToGo: 0 });
}

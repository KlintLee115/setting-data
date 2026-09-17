const LEAVE_REASON_HAD_TO_GO = 'Had to go';
const LEAVE_REASON_MONEY = 'Money';
const LEAVE_REASON_PARTNER = 'Partner';
const LEAVE_REASON_TIMING = 'Timing';
const LEAVE_REASONS = [
  LEAVE_REASON_HAD_TO_GO,
  LEAVE_REASON_MONEY,
  LEAVE_REASON_PARTNER,
  LEAVE_REASON_TIMING
];

function normalizeLeaveReason(value) {
  if (value === 'Objection') {
    return LEAVE_REASON_MONEY;
  }
  if (value === 'Spouse') {
    return LEAVE_REASON_PARTNER;
  }
  return LEAVE_REASONS.includes(value) ? value : '';
}

function getLeaveReasonCounts(entries) {
  return (entries || []).reduce((counts, entry) => {
    const reason = normalizeLeaveReason(entry.leaveReason);
    if (reason === LEAVE_REASON_MONEY) counts.money += 1;
    if (reason === LEAVE_REASON_PARTNER) counts.partner += 1;
    if (reason === LEAVE_REASON_TIMING) counts.timing += 1;
    if (reason === LEAVE_REASON_HAD_TO_GO) counts.hadToGo += 1;
    return counts;
  }, { money: 0, partner: 0, timing: 0, hadToGo: 0 });
}

if (typeof globalThis !== 'undefined') {
  globalThis.LEAVE_REASONS = LEAVE_REASONS;
  globalThis.LEAVE_REASON_HAD_TO_GO = LEAVE_REASON_HAD_TO_GO;
  globalThis.LEAVE_REASON_MONEY = LEAVE_REASON_MONEY;
  globalThis.LEAVE_REASON_PARTNER = LEAVE_REASON_PARTNER;
  globalThis.LEAVE_REASON_TIMING = LEAVE_REASON_TIMING;
  globalThis.getLeaveReasonCounts = getLeaveReasonCounts;
  globalThis.normalizeLeaveReason = normalizeLeaveReason;
}

if (typeof module !== 'undefined') {
  module.exports = {
    LEAVE_REASON_HAD_TO_GO,
    LEAVE_REASON_MONEY,
    LEAVE_REASON_PARTNER,
    LEAVE_REASON_TIMING,
    LEAVE_REASONS,
    getLeaveReasonCounts,
    normalizeLeaveReason
  };
}

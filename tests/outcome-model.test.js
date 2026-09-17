const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LEAVE_REASONS,
  getLeaveReasonCounts,
  normalizeLeaveReason
} = require('../scripts/outcome-model');

test('keeps the coded conversation outcomes', () => {
  assert.deepEqual(LEAVE_REASONS, ['Had to go', 'Money', 'Partner', 'Timing']);
});

test('maps legacy Objection records onto Money and Spouse onto Partner', () => {
  assert.equal(normalizeLeaveReason('Objection'), 'Money');
  assert.equal(normalizeLeaveReason('Spouse'), 'Partner');
  assert.equal(normalizeLeaveReason('Money'), 'Money');
  assert.equal(normalizeLeaveReason('Partner'), 'Partner');
  assert.equal(normalizeLeaveReason('Timing'), 'Timing');
  assert.equal(normalizeLeaveReason('Had to go'), 'Had to go');
  assert.equal(normalizeLeaveReason(''), '');
});

test('counts coded outcomes including legacy Objection as Money', () => {
  assert.deepEqual(getLeaveReasonCounts([
    { leaveReason: 'Money' },
    { leaveReason: 'Objection' },
    { leaveReason: 'Partner' },
    { leaveReason: 'Spouse' },
    { leaveReason: 'Timing' },
    { leaveReason: 'Had to go' },
    { leaveReason: 'Had to go' }
  ]), { money: 2, partner: 2, timing: 1, hadToGo: 2 });
});

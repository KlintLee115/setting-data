const test = require('node:test');
const assert = require('node:assert/strict');
const {
  combineEntries,
  normalizeEntryStatus,
  toCallEntry,
  toManualEntry
} = require('../scripts/entry-model');

test('booked appointment takes precedence over phone outcome', () => {
  assert.equal(normalizeEntryStatus({ wasSet: 'Yes', phonePickedUp: 'No' }).status, 'Booked');
  assert.equal(normalizeEntryStatus({ appointmentDate: '2026-09-17T13:00:00Z' }).status, 'Booked');
});

test('disqualified status takes precedence over a previous booked appointment', () => {
  assert.equal(
    normalizeEntryStatus({ disqualified: 'Yes', wasSet: 'Yes', appointmentDate: '2026-09-17T13:00:00Z' }).status,
    'Disqualified'
  );
});

test('phone outcomes normalize to stable statuses', () => {
  assert.equal(normalizeEntryStatus({ phonePickedUp: 'Yes' }).status, 'Picked Up');
  assert.equal(normalizeEntryStatus({ phonePickedUp: 'No' }).status, 'No Answer');
});

test('combined entries preserve source record types', () => {
  const logs = [{ id: 'call-1', status: 'Picked Up' }];
  const manualEntries = [{ id: 'entry-1', phonePickedUp: 'No' }];

  assert.deepEqual(combineEntries(logs, manualEntries), [
    { id: 'call-1', status: 'Picked Up', recordType: 'call' },
    { id: 'entry-1', phonePickedUp: 'No', status: 'No Answer', recordType: 'entry' }
  ]);
  assert.equal(toCallEntry(logs[0]).recordType, 'call');
  assert.equal(toManualEntry(manualEntries[0]).recordType, 'entry');
});
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatDateTimeInput,
  parseStoredDateTime,
  zonedDateTimeToDate
} = require('./timezone');

test('converts MDT appointment time to its UTC instant', () => {
  assert.equal(
    zonedDateTimeToDate('2026-09-16T10:00', 'America/Denver').toISOString(),
    '2026-09-16T16:00:00.000Z'
  );
});

test('converts Pacific and Eastern appointment times to the same instant', () => {
  const pacific = zonedDateTimeToDate('2026-09-16T10:00', 'America/Los_Angeles');
  const eastern = zonedDateTimeToDate('2026-09-16T13:00', 'America/New_York');

  assert.equal(pacific.toISOString(), '2026-09-16T17:00:00.000Z');
  assert.equal(eastern.toISOString(), '2026-09-16T17:00:00.000Z');
});

test('preserves UTC input without applying a local machine offset', () => {
  assert.equal(
    zonedDateTimeToDate('2026-09-16T10:00', 'UTC').toISOString(),
    '2026-09-16T10:00:00.000Z'
  );
});

test('handles the Mountain Time daylight-saving transition', () => {
  assert.equal(
    zonedDateTimeToDate('2026-03-08T01:30', 'America/Denver').toISOString(),
    '2026-03-08T08:30:00.000Z'
  );
  assert.equal(
    zonedDateTimeToDate('2026-03-08T03:30', 'America/Denver').toISOString(),
    '2026-03-08T09:30:00.000Z'
  );
});

test('interprets legacy naive stored values as Mountain Time', () => {
  const date = parseStoredDateTime('2026-09-16T10:00');

  assert.equal(date.toISOString(), '2026-09-16T16:00:00.000Z');
});

test('formats an appointment instant for the selected input timezone', () => {
  assert.equal(
    formatDateTimeInput('2026-09-16T16:00:00.000Z', 'America/Denver'),
    '2026-09-16T10:00'
  );
  assert.equal(
    formatDateTimeInput('2026-09-16T16:00:00.000Z', 'America/New_York'),
    '2026-09-16T12:00'
  );
});

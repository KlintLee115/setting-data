const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatDateTimeInput,
  formatFollowUpDate,
  formatFollowUpWindow,
  parseStoredDateTime,
  zonedDateTimeToDate
} = require('../scripts/timezone');

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

test('keeps reporting timezone separate from customer booking timezone', () => {
  const bookingInstant = zonedDateTimeToDate('2026-09-16T18:00', 'America/New_York').toISOString();
  assert.equal(bookingInstant, '2026-09-16T22:00:00.000Z');
  assert.equal(formatDateTimeInput(bookingInstant, 'America/Denver'), '2026-09-16T16:00');
  assert.equal(formatDateTimeInput(bookingInstant, 'America/Los_Angeles'), '2026-09-16T15:00');
});

test('formats follow-up due windows for in-row queue updates', () => {
  const now = new Date('2026-09-16T12:00:00Z');
  assert.equal(formatFollowUpWindow('2026-09-16', now), 'Due today');
  assert.equal(formatFollowUpWindow('2026-09-17', now), 'Due tomorrow');
  assert.equal(formatFollowUpWindow('2026-09-20', now), 'In 4 days');
  assert.equal(formatFollowUpWindow('', now), 'No follow-up set');
  assert.equal(formatFollowUpWindow('2026-09-16T00:00:00.000Z', now), 'Due today');
  assert.equal(formatFollowUpWindow('not-a-date', now), 'No follow-up set');
});

test('formats follow-up dates as Mountain-time calendar dates', () => {
  assert.equal(formatFollowUpDate('2026-10-02'), 'Oct 2, 2026');
  assert.equal(formatFollowUpDate('2026-10-02T00:00:00.000Z'), 'Oct 2, 2026');
});


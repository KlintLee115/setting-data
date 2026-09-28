const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatDateTimeInput,
  getLocalDateTimeValue,
  localDateTimeToDate,
  parseStoredDateTime,
} = require('../scripts/timezone');

test('converts datetime-local input using the machine local timezone', () => {
  const value = '2026-09-16T10:00';
  assert.equal(localDateTimeToDate(value).toISOString(), new Date(value).toISOString());
});

test('formats an instant as a local datetime-local value and round-trips it', () => {
  const instant = '2026-09-16T16:00:00.000Z';
  const localInput = formatDateTimeInput(instant);
  assert.equal(localDateTimeToDate(localInput).toISOString(), instant);
});

test('generates the current local input value', () => {
  const date = new Date('2026-09-16T16:07:00.000Z');
  const localInput = getLocalDateTimeValue(date);
  assert.equal(localDateTimeToDate(localInput).getTime(), new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()).getTime());
});

test('interprets legacy naive stored values as machine-local time', () => {
  const date = parseStoredDateTime('2026-09-16T10:00');
  assert.equal(date.getHours(), 10);
  assert.equal(date.getMinutes(), 0);
});

test('returns an empty input value for invalid stored dates', () => {
  assert.equal(formatDateTimeInput('not-a-date'), '');
});



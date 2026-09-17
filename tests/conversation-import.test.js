const test = require('node:test');
const assert = require('node:assert/strict');
const { extractCallDuration, extractConversationData, getTodayAtTime } = require('../scripts/conversation-import');

const getDateTimeParts = () => ({ year: '2026', month: '09', day: '16' });
const getLocalDateTimeValue = () => '2026-09-16T12:00';
const getMountainDateTimeValue = () => '2026-09-17T09:00';

const options = {
  extractLeadName: () => 'Jane Doe',
  getDateTimeParts,
  getLocalDateTimeValue,
  getMountainDateTimeValue
};

test('extracts call duration and converts completed call time', () => {
  assert.equal(extractCallDuration('Call completed 10:30 AM 0:15 / 1:00'), '1:00');
  assert.equal(getTodayAtTime('10:30 AM', getDateTimeParts), '2026-09-16T10:30');
});

test('extracts key appointment and outcome fields', () => {
  const data = extractConversationData(
    'Hi Jane Doe! jane@example.com called from 555-123-4567. Call completed and booked an appointment at September 17, 2026 at 9:00 AM. Closer Alicia Lyttle.',
    options
  );

  assert.equal(data.fullName, 'Jane Doe');
  assert.equal(data.email, 'jane@example.com');
  assert.equal(data.wasSet, 'Yes');
  assert.equal(data.phonePickedUp, 'Yes');
  assert.equal(data.closer, 'Alicia Lyttle');
});

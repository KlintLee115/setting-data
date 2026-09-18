const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFollowUpConfirmationMessage } = require('../scripts/followup-message');

test('confirmation message uses "today" and the meeting time zone abbreviation', () => {
  const message = buildFollowUpConfirmationMessage({
    fullName: 'Aye Felix',
    closer: 'Klint',
    appointmentDate: '2026-09-18T23:00:00.000Z',
    appointmentTimeZone: 'America/New_York'
  }, { now: new Date('2026-09-18T12:00:00.000Z') });

  assert.match(message, /Hey Aye,/);
  assert.match(message, /Zoom meeting today at 7pm EDT with Klint\?/);
  assert.match(message, /Shoot through a "Yes"/);
});

test('confirmation message uses "tomorrow" when the meeting is the next calendar day', () => {
  const message = buildFollowUpConfirmationMessage({
    fullName: 'Priya Shah',
    closer: 'No closer listed',
    appointmentDate: '2026-09-19T23:00:00.000Z',
    appointmentTimeZone: 'America/New_York'
  }, { now: new Date('2026-09-18T12:00:00.000Z') });

  assert.match(message, /Hey Priya,/);
  assert.match(message, /Zoom meeting tomorrow at 7pm EDT with No closer listed\?/);
});

test('confirmation message falls back to a calendar date further out', () => {
  const message = buildFollowUpConfirmationMessage({
    fullName: 'Sam',
    closer: 'Klint',
    appointmentDate: '2026-09-25T18:00:00.000Z',
    appointmentTimeZone: 'America/Denver'
  }, { now: new Date('2026-09-18T12:00:00.000Z') });

  assert.match(message, /Zoom meeting on Sep 25 at 12pm MDT with Klint\?/);
});

test('confirmation message omits minutes only when they are zero', () => {
  const message = buildFollowUpConfirmationMessage({
    fullName: 'Sam',
    closer: 'Klint',
    appointmentDate: '2026-09-18T23:30:00.000Z',
    appointmentTimeZone: 'America/New_York'
  }, { now: new Date('2026-09-18T12:00:00.000Z') });

  assert.match(message, /at 7:30pm EDT/);
});

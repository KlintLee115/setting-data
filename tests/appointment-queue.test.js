const test = require('node:test');
const assert = require('node:assert/strict');
const { getUpcomingAppointments } = require('../scripts/appointment-queue');

const parseFollowUpDate = (value) => new Date(`${value.slice(0, 10)}T00:00:00`);

test('queue keeps only upcoming appointments in appointment order', () => {
  const now = new Date('2026-09-16T12:00:00Z');
  const appointments = getUpcomingAppointments([
    { id: 'later', wasSet: 'Yes', appointmentDate: '2026-09-17T18:00:00.000Z' },
    { id: 'past', wasSet: 'Yes', appointmentDate: '2026-09-16T11:00:00.000Z' },
    { id: 'earlier', wasSet: 'Yes', appointmentDate: '2026-09-17T11:00:00.000Z' },
    { id: 'not-booked', wasSet: 'No', appointmentDate: '2026-09-16T13:00:00.000Z' }
  ], now, parseFollowUpDate);

  assert.deepEqual(appointments.map((entry) => entry.id), ['not-booked', 'earlier', 'later']);
  assert.equal(appointments[0].label, 'Tomorrow');
});

test('queue uses the upcoming appointment date independently of booked status', () => {
  const appointments = getUpcomingAppointments([
    { id: 'future', appointmentDate: '2026-09-17T11:00:00.000Z', wasSet: 'No' },
    { id: 'disqualified', appointmentDate: '2026-09-18T11:00:00.000Z', disqualified: 'Yes' }
  ], new Date('2026-09-16T12:00:00Z'), parseFollowUpDate);

  assert.deepEqual(appointments.map((entry) => entry.id), ['future', 'disqualified']);
});

test('queue ignores invalid appointment dates', () => {
  const appointments = getUpcomingAppointments([
    { id: 'invalid', wasSet: 'Yes', appointmentDate: 'not-a-date' }
  ], new Date('2026-09-16T12:00:00Z'), parseFollowUpDate);

  assert.deepEqual(appointments, []);
});
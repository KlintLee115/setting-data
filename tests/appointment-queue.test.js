const test = require('node:test');
const assert = require('node:assert/strict');
const { getUpcomingAppointments } = require('../scripts/appointment-queue');

const parseFollowUpDate = (value) => new Date(`${value.slice(0, 10)}T00:00:00`);

test('queue keeps only upcoming booked appointments in appointment order', () => {
  const now = new Date('2026-09-16T12:00:00Z');
  const appointments = getUpcomingAppointments([
    { id: 'later', wasSet: 'Yes', appointmentDate: '2026-09-17T18:00:00.000Z' },
    { id: 'past', wasSet: 'Yes', appointmentDate: '2026-09-16T11:00:00.000Z' },
    { id: 'earlier', wasSet: 'Yes', appointmentDate: '2026-09-17T11:00:00.000Z' },
    { id: 'not-booked', wasSet: 'No', appointmentDate: '2026-09-16T13:00:00.000Z' }
  ], now, parseFollowUpDate);

  assert.deepEqual(appointments.map((entry) => entry.id), ['earlier', 'later']);
  assert.equal(appointments[0].label, 'Tomorrow');
});

test('queue ignores invalid appointment dates', () => {
  const appointments = getUpcomingAppointments([
    { id: 'invalid', wasSet: 'Yes', appointmentDate: 'not-a-date' }
  ], new Date('2026-09-16T12:00:00Z'), parseFollowUpDate);

  assert.deepEqual(appointments, []);
});
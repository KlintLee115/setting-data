const test = require('node:test');
const assert = require('node:assert/strict');
const { getDailySummary, getHourlySummary } = require('../scripts/summary-model');

const durationToSeconds = (value) => {
  const [minutes, seconds] = String(value || '').split(':').map(Number);
  return Number.isFinite(minutes) && Number.isFinite(seconds) ? minutes * 60 + seconds : 0;
};

test('calculates daily call outcomes and sales metrics', () => {
  const entries = [
    { entryType: 'Call', status: 'Picked Up', disqualified: 'No', pitched: 'Yes', wasSet: 'Yes', callDuration: '1:00' },
    { entryType: 'Call', status: 'No Answer', disqualified: '', pitched: '', wasSet: '', callDuration: '0:30' },
    { entryType: 'Entry', phonePickedUp: 'Yes', disqualified: 'No', pitched: 'No', wasSet: 'No', callDuration: '' }
  ];

  assert.deepEqual(getDailySummary(entries, durationToSeconds), {
    calls: 3,
    pickups: 2,
    noAnswers: 1,
    disqualified: 0,
    pitches: 1,
    appointments: 1,
    money: 0,
    partner: 0,
    timing: 0,
    hadToGo: 0,
    pitchRate: 50,
    setRate: 50,
    averageDuration: 45
  });
});

test('groups hourly pickup results and leaves empty hours without a rate', () => {
  const entries = [
    { entryType: 'Call', status: 'Picked Up', hour: 9 },
    { entryType: 'Call', status: 'No Answer', hour: 9 },
    { entryType: 'Entry', phonePickedUp: 'Yes', hour: 10 }
  ];
  const rows = getHourlySummary(entries, (entry) => entry.hour);

  assert.deepEqual(rows.find((row) => row.hour === 9), { hour: 9, total: 2, pickedUp: 1, rate: 50 });
  assert.deepEqual(rows.find((row) => row.hour === 10), { hour: 10, total: 1, pickedUp: 1, rate: 100 });
  assert.deepEqual(rows.find((row) => row.hour === 11), { hour: 11, total: 0, pickedUp: 0, rate: null });
});

test('counts Money, Partner, Timing, and Had to go including legacy Objection', () => {
  const summary = getDailySummary([
    { leaveReason: 'Money' },
    { leaveReason: 'Objection' },
    { leaveReason: 'Partner' },
    { leaveReason: 'Timing' },
    { leaveReason: 'Had to go' }
  ], durationToSeconds);

  assert.equal(summary.money, 2);
  assert.equal(summary.partner, 1);
  assert.equal(summary.timing, 1);
  assert.equal(summary.hadToGo, 1);
});

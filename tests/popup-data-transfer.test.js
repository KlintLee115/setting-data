const test = require('node:test');
const assert = require('node:assert/strict');
global.XLSX = require('xlsx');

require('../scripts/popup-data-transfer');
const { buildWorkbook, durationToSeconds } = global.popupDataTransfer;

test('builds an analysis-friendly workbook with typed dates and separate objection flags', () => {
  const workbook = buildWorkbook([{
    recordType: 'entry',
    fullName: 'Jane Doe',
    leadTimeZone: 'GMT-7',
    source: 'Inbound',
    intent: 'Use AI to grow an existing business',
    phonePickedUp: 'Yes',
    status: 'Booked',
    callDateTime: '2026-09-28T14:30:00.000Z',
    callDuration: '02:15',
    talkTime: '1:05',
    talkToListenRatio: '70/30',
    objections: 'Partner, Had to go',
    pitched: 'High Ticket',
    appointmentDate: '2026-10-01T16:00:00.000Z'
  }]);
  const sheet = workbook.Sheets.Entries;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const headers = rows[0];
  const row = rows[1];
  const column = (header) => headers.indexOf(header);

  assert.deepEqual(workbook.SheetNames, ['Analysis', 'Entries']);
  assert.equal(row[column('Lead name')], 'Jane Doe');
  assert.equal(row[column('Lead timezone')], 'GMT-7');
  assert.equal(row[column('Source')], 'Inbound');
  assert.equal(row[column('Intent')], 'Use AI to grow an existing business');
  assert.equal(column('Contact history'), -1);
  assert.equal(row[column('Call duration (seconds)')], 135);
  assert.equal(row[column('Talk time (seconds)')], 65);
  assert.equal(column('Talk-to-listen ratio'), -1);
  assert.equal(row[column('Objection: Partner')], true);
  assert.equal(row[column('Objection: Had to go')], true);
  assert.equal(row[column('Objection: Not interested')], false);
  assert.equal(sheet['!autofilter'].ref, sheet['!ref']);
  assert.equal(sheet[XLSX.utils.encode_cell({ r: 1, c: column('Call date/time') })].t, 'd');

  const fileBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const reopened = XLSX.read(fileBytes, { type: 'buffer', cellDates: true, cellNF: true });
  const reopenedSheet = reopened.Sheets.Entries;
  const reopenedRows = XLSX.utils.sheet_to_json(reopenedSheet, { header: 1 });
  assert.equal(reopenedRows[1][column('Call duration (seconds)')], 135);
  assert.equal(reopenedRows[1][column('Objection: Partner')], true);
  assert.equal(reopenedSheet['!autofilter'].ref, 'A1:AG2');

  const analysis = reopened.Sheets.Analysis;
  assert.equal(analysis.B5.f, 'COUNTIF(Entries!$N:$N,"Yes")+COUNTIF(Entries!$N:$N,"No")');
  assert.equal(analysis.C6.f, 'IF(B5=0,"",B6/B5)');
  assert.equal(analysis.C6.z, '0.0%');
  assert.equal(analysis.A14.v, 'GMT-7');
  assert.equal(analysis.B14.f, 'COUNTIFS(Entries!$E:$E,"GMT-7",Entries!$N:$N,"Yes")+COUNTIFS(Entries!$E:$E,"GMT-7",Entries!$N:$N,"No")');
  assert.equal(analysis.A15.v, 'Not recorded');
  assert.equal(analysis.A16, undefined);
});

test('converts supported duration values to seconds', () => {
  assert.equal(durationToSeconds('2:15'), 135);
  assert.equal(durationToSeconds('1:02:03'), 3723);
  assert.equal(durationToSeconds(42), 42);
  assert.equal(durationToSeconds('not a duration'), '');
});

test('exports DM activity fields with a distinct record type', () => {
  const workbook = buildWorkbook([{
    recordType: 'dm',
    name: 'Jordan Lee',
    status: 'Replied',
    dmDateTime: '2026-09-29T14:00:00.000Z',
    dmChannel: 'Instagram',
    dmOutcome: 'Replied',
    dmMessage: 'Are you still exploring this?'
  }]);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Entries, { header: 1 });
  const headers = rows[0];
  const row = rows[1];
  const column = (header) => headers.indexOf(header);

  assert.equal(row[column('Record type')], 'DM');
  assert.equal(row[column('Lead name')], 'Jordan Lee');
  assert.equal(row[column('DM channel')], 'Instagram');
  assert.equal(row[column('DM outcome')], 'Replied');
  assert.equal(row[column('DM message')], 'Are you still exploring this?');
});
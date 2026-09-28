const test = require('node:test');
const assert = require('node:assert/strict');
global.XLSX = require('xlsx');

require('../scripts/popup-data-transfer');
const { buildWorkbook, durationToSeconds } = global.popupDataTransfer;

test('builds an analysis-friendly workbook with typed dates and separate objection flags', () => {
  const workbook = buildWorkbook([{
    recordType: 'entry',
    fullName: 'Jane Doe',
    status: 'Booked',
    callDateTime: '2026-09-28T14:30:00.000Z',
    callDuration: '02:15',
    talkTime: '1:05',
    objections: 'Partner, Had to go',
    pitched: 'High Ticket',
    appointmentDate: '2026-10-01T16:00:00.000Z'
  }]);
  const sheet = workbook.Sheets.Entries;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const headers = rows[0];
  const row = rows[1];
  const column = (header) => headers.indexOf(header);

  assert.deepEqual(workbook.SheetNames, ['Entries']);
  assert.equal(row[column('Lead name')], 'Jane Doe');
  assert.equal(row[column('Call duration (seconds)')], 135);
  assert.equal(row[column('Talk time (seconds)')], 65);
  assert.equal(row[column('Objection: Partner')], true);
  assert.equal(row[column('Objection: Had to go')], true);
  assert.equal(row[column('Objection: Not interested')], false);
  assert.equal(sheet['!autofilter'].ref, sheet['!ref']);
  assert.equal(sheet[XLSX.utils.encode_cell({ r: 1, c: column('Call date/time') })].t, 'd');

  const fileBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const reopened = XLSX.read(fileBytes, { type: 'buffer', cellDates: true });
  const reopenedSheet = reopened.Sheets.Entries;
  const reopenedRows = XLSX.utils.sheet_to_json(reopenedSheet, { header: 1 });
  assert.equal(reopenedRows[1][column('Call duration (seconds)')], 135);
  assert.equal(reopenedRows[1][column('Objection: Partner')], true);
  assert.equal(reopenedSheet['!autofilter'].ref, 'A1:Y2');
});

test('converts supported duration values to seconds', () => {
  assert.equal(durationToSeconds('2:15'), 135);
  assert.equal(durationToSeconds('1:02:03'), 3723);
  assert.equal(durationToSeconds(42), 42);
  assert.equal(durationToSeconds('not a duration'), '');
});
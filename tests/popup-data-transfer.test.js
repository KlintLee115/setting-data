const test = require('node:test');
const assert = require('node:assert/strict');
global.ExcelJS = require('exceljs');

require('../scripts/popup-data-transfer');
const { buildWorkbook, durationToSeconds } = global.popupDataTransfer;

function entriesTable(workbook) {
  const sheet = workbook.getWorksheet('Entries');
  const headers = sheet.getRow(1).values.slice(1);
  const row = sheet.getRow(2);
  const value = (header) => {
    const cell = row.getCell(headers.indexOf(header) + 1).value;
    return cell === undefined ? null : cell;
  };
  return { sheet, headers, value };
}

test('builds a dashboard workbook with typed Entries data', async () => {
  const workbook = buildWorkbook([{
    recordType: 'entry',
    fullName: 'Jane Doe',
    intent: 'Use AI to grow an existing business',
    phonePickedUp: 'Yes',
    status: 'Booked',
    callDateTime: '2026-09-28T14:30:00.000Z',
    callDuration: '02:15',
    talkTime: '1:05',
    objections: 'Partner, Had to go',
    pitched: 'High Ticket',
    appointmentDate: '2026-10-01T16:00:00.000Z'
  }]);
  const { sheet, headers, value } = entriesTable(workbook);

  assert.deepEqual(workbook.worksheets.map((s) => s.name), ['Dashboard', 'Entries', 'Definitions']);
  assert.equal(value('Lead name'), 'Jane Doe');
  assert.equal(value('Call duration (seconds)'), 135);
  assert.equal(value('Talk time (seconds)'), 65);
  assert.equal(value('Objection: Partner'), true);
  assert.equal(value('Objection: Not interested'), false);
  assert.ok(value('Call date/time') instanceof Date);
  assert.ok(value('Week starting (Mon)') instanceof Date);
  assert.equal(value('Week starting (Mon)').getUTCDay(), 1);
  assert.equal(headers.includes('Call weekday'), true);
  assert.equal(sheet.views[0].state, 'frozen');
  assert.equal(sheet.autoFilter.to.column, headers.length);

  const dashboard = workbook.getWorksheet('Dashboard');
  assert.match(dashboard.getCell('D11').value.formula, /^COUNTIFS\(Entries!\$A\$2:\$A\$5001,"<>DM"/);
  assert.equal(dashboard.getCell('E12').value.formula, 'IF(D11=0,"",D12/D11)');
  assert.equal(dashboard.getCell('B72').value.formula.includes('Top objection'), true);
  assert.equal(workbook.calcProperties.fullCalcOnLoad, true);

  const buffer = await workbook.xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer);
  assert.deepEqual(reopened.worksheets.map((s) => s.name), ['Dashboard', 'Entries', 'Definitions']);
  assert.equal(reopened.getWorksheet('Entries').getRow(2).getCell(1).value, 'Manual');
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
    dmMessage: 'Are you still exploring this?',
    dmResponse: 'Yes!'
  }]);
  const { value } = entriesTable(workbook);

  assert.equal(value('Record type'), 'DM');
  assert.equal(value('Lead name'), 'Jordan Lee');
  assert.equal(value('DM channel'), 'Instagram');
  assert.equal(value('DM outcome'), 'Replied');
  assert.equal(value('Lead replied?'), 'Yes');
  assert.equal(value('Call date/time'), null);
});

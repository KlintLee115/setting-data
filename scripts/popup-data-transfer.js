(() => {
const ENTRIES_KEY = 'entries';

// Define exported columns for the raw data sheet
const ANALYSIS_COLUMNS = [
  ['Record type', (entry) => entry.recordType === 'call' ? 'Call' : entry.recordType === 'dm' ? 'DM' : 'Manual'],
  ['Lead name', (entry) => entry.name || entry.fullName],
  ['Email', (entry) => entry.email || ''],
  ['Phone', (entry) => entry.phone || ''],
  ['Lead timezone', (entry) => entry.leadTimeZone || ''],
  ['Source', (entry) => entry.source || ''],
  ['Intent', (entry) => entry.intent || ''],
  ['Outcome', (entry) => entry.status || ''],
  ['Call date/time', (entry) => entry.recordType === 'dm' ? '' : toExcelDate(entry.callDateTime || entry.timestamp || entry.createdAt)],
  ['Call duration (seconds)', (entry) => durationToSeconds(entry.callDuration)],
  ['Picked up?', (entry) => entry.phonePickedUp === 'Yes' || entry.phonePickedUp === true ? 'Yes' : 'No'],
  ['Disqualified?', (entry) => entry.disqualified === 'Yes' || entry.disqualified === true ? 'Yes' : 'No'],
  ['Disqualification reason', (entry) => entry.disqualificationReason || ''],
  ['Talk time (seconds)', (entry) => durationToSeconds(entry.talkTime)],
  ['Client type', (entry) => entry.clientType || ''],
  ['Objection: Partner', (entry) => hasObjection(entry.objections, 'Partner')],
  ['Objection: Had to go', (entry) => hasObjection(entry.objections, 'Had to go')],
  ['Objection: Not interested', (entry) => hasObjection(entry.objections, 'Not interested')],
  ['Objection: Just curious', (entry) => hasObjection(entry.objections, 'Just curious')],
  ['Objection: Are u trying to sell me', (entry) => hasObjection(entry.objections, 'Are u trying to sell me')],
  ['Objection notes', (entry) => entry.objectionNotes || ''],
  ['Pitch outcome', (entry) => entry.pitched || ''],
  ['Closer', (entry) => entry.closer || ''],
  ['Appointment date/time', (entry) => toExcelDate(entry.appointmentDate)],
  ['Showed?', (entry) => entry.showed ? 'Yes' : 'No'],
  ['Revenue', (entry) => typeof entry.revenue === 'number' ? entry.revenue : 0],
  ['Last text message', (entry) => entry.lastTextMessage || ''],
  ['Notes', (entry) => entry.notes || ''],
  ['Source URL', (entry) => entry.sourceUrl || ''],
  ['DM date/time', (entry) => toExcelDate(entry.dmDateTime)],
  ['DM channel', (entry) => entry.dmChannel || ''],
  ['DM outcome', (entry) => entry.dmOutcome || ''],
  ['DM message', (entry) => entry.dmMessage || '']
];

// Helper to convert column index (0-based) to Excel Column Letter (A, B, C... AA)
function colToLetter(colIndex) {
  let temp = '';
  let letter = '';
  while (colIndex >= 0) {
    temp = (colIndex % 26);
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = Math.floor((colIndex - temp) / 26) - 1;
  }
  return letter;
}

function getColumnLetter(headerName) {
  const index = ANALYSIS_COLUMNS.findIndex(([name]) => name === headerName);
  return index !== -1 ? colToLetter(index) : 'A';
}

function toExcelDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date;
}

function durationToSeconds(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (!/^\d+(?::\d{1,2}){0,2}$/.test(text)) return '';
  const parts = text.split(':').map(Number);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return '';
}

function hasObjection(value, objection) {
  return String(value || '').split(',').map((item) => item.trim()).includes(objection);
}

function setFormula(worksheet, address, formula, numberFormat) {
  worksheet[address] = { t: 'n', f: formula, v: 0, ...(numberFormat ? { z: numberFormat } : {}) };
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const cell = XLSX.utils.decode_cell(address);
  range.e.r = Math.max(range.e.r, cell.r);
  range.e.c = Math.max(range.e.c, cell.c);
  worksheet['!ref'] = XLSX.utils.encode_range(range);
}

function buildAnalysisWorksheet(entries) {
  // Dynamically pull column letters for Entries sheet
  const colPickedUp = getColumnLetter('Picked up?');
  const colDisqualified = getColumnLetter('Disqualified?');
  const colPitchOutcome = getColumnLetter('Pitch outcome');
  const colTimezone = getColumnLetter('Lead timezone');

  const rows = [
    ['Call analysis'],
    ['Counts accompany rates. Blank rates mean no eligible denominator; interpret small samples cautiously.'],
    [],
    ['Funnel stage', 'Count', 'Rate', 'Rate base'],
    ['Logged attempts', '', '', ''],
    ['Picked up', '', '', 'Attempts'],
    ['Qualified conversations', '', '', 'Pickups'],
    ['Pitched conversations', '', '', 'Qualified conversations'],
    ['High-ticket appointments', '', '', 'Qualified conversations'],
    ['Low-ticket outcomes', '', '', 'Qualified conversations'],
    [],
    ['By lead timezone'],
    ['Lead timezone', 'Attempts', 'Pickups', 'Pickup rate', 'Qualified', 'High-ticket appointments', 'Booking rate']
  ];

  // Extract unique timezones
  const timezones = [...new Set(entries.map((entry) => entry.leadTimeZone).filter(Boolean))];
  const getOffset = (timezone) => timezone === 'GMT' ? 0 : /^GMT([+-]\d+)$/.exec(timezone)?.[1];
  timezones.sort((left, right) => {
    const leftOffset = getOffset(left);
    const rightOffset = getOffset(right);
    return leftOffset !== undefined && rightOffset !== undefined
      ? Number(leftOffset) - Number(rightOffset)
      : left.localeCompare(right);
  });
  timezones.push('Not recorded');
  rows.push(...timezones.map((timezone) => [timezone]));

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Dynamic Excel range formulas
  const fAttempts = `COUNTIF(Entries!$${colPickedUp}:$${colPickedUp},"Yes")+COUNTIF(Entries!$${colPickedUp}:$${colPickedUp},"No")`;
  const fPickups = `COUNTIF(Entries!$${colPickedUp}:$${colPickedUp},"Yes")`;
  const fQualified = `COUNTIFS(Entries!$${colPickedUp}:$${colPickedUp},"Yes",Entries!$${colDisqualified}:$${colDisqualified},"No")`;
  const fPitched = `COUNTIFS(Entries!$${colDisqualified}:$${colDisqualified},"No",Entries!$${colPitchOutcome}:$${colPitchOutcome},"Low Ticket")+COUNTIFS(Entries!$${colDisqualified}:$${colDisqualified},"No",Entries!$${colPitchOutcome}:$${colPitchOutcome},"High Ticket")`;
  const fAppointments = `COUNTIFS(Entries!$${colDisqualified}:$${colDisqualified},"No",Entries!$${colPitchOutcome}:$${colPitchOutcome},"High Ticket")`;
  const fLowTicket = `COUNTIFS(Entries!$${colDisqualified}:$${colDisqualified},"No",Entries!$${colPitchOutcome}:$${colPitchOutcome},"Low Ticket")`;

  // Set Counts (Rows 5 through 10)
  [fAttempts, fPickups, fQualified, fPitched, fAppointments, fLowTicket].forEach((formula, idx) => {
    setFormula(worksheet, `B${5 + idx}`, formula);
  });

  // Funnel Rates
  [
    [6, 'IF(B5=0,"",B6/B5)'],
    [7, 'IF(B6=0,"",B7/B6)'],
    [8, 'IF(B7=0,"",B8/B7)'],
    [9, 'IF(B7=0,"",B9/B7)'],
    [10, 'IF(B7=0,"",B10/B7)']
  ].forEach(([row, formula]) => setFormula(worksheet, `C${row}`, formula, '0.0%'));

  // Timezone Breakdowns (Row 14+)
  timezones.forEach((timezone, index) => {
    const row = 14 + index;
    const criteria = `Entries!$${colTimezone}:$${colTimezone},"${timezone === 'Not recorded' ? '' : timezone}"`;
    setFormula(worksheet, `B${row}`, `COUNTIFS(${criteria},Entries!$${colPickedUp}:$${colPickedUp},"Yes")+COUNTIFS(${criteria},Entries!$${colPickedUp}:$${colPickedUp},"No")`);
    setFormula(worksheet, `C${row}`, `COUNTIFS(${criteria},Entries!$${colPickedUp}:$${colPickedUp},"Yes")`);
    setFormula(worksheet, `D${row}`, `IF(B${row}=0,"",C${row}/B${row})`, '0.0%');
    setFormula(worksheet, `E${row}`, `COUNTIFS(${criteria},Entries!$${colPickedUp}:$${colPickedUp},"Yes",Entries!$${colDisqualified}:$${colDisqualified},"No")`);
    setFormula(worksheet, `F${row}`, `COUNTIFS(${criteria},Entries!$${colDisqualified}:$${colDisqualified},"No",Entries!$${colPitchOutcome}:$${colPitchOutcome},"High Ticket")`);
    setFormula(worksheet, `G${row}`, `IF(E${row}=0,"",F${row}/E${row})`, '0.0%');
  });

  worksheet['!cols'] = [
    { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 26 }, { wch: 18 }
  ];
  return worksheet;
}

function buildWorkbook(entries) {
  const rows = [
    ANALYSIS_COLUMNS.map(([header]) => header),
    ...entries.map((entry) => ANALYSIS_COLUMNS.map(([, getValue]) => getValue(entry) ?? ''))
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  const dateColumns = ['Call date/time', 'Appointment date/time'];

  for (let row = 1; row <= range.e.r; row += 1) {
    for (const header of dateColumns) {
      const column = ANALYSIS_COLUMNS.findIndex(([name]) => name === header);
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell?.t === 'd') cell.z = 'yyyy-mm-dd hh:mm';
    }
  }

  worksheet['!autofilter'] = { ref: worksheet['!ref'] };
  worksheet['!cols'] = ANALYSIS_COLUMNS.map(([header]) => ({ wch: Math.max(header.length + 5, 15) }));

  const workbook = XLSX.utils.book_new();
  workbook.Workbook = {};
  workbook.Workbook.CalcPr = { calcMode: 'auto', fullCalcOnLoad: '1', forceFullCalc: '1' };
  XLSX.utils.book_append_sheet(workbook, buildAnalysisWorksheet(entries), 'Analysis');
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Entries');
  return workbook;
}

async function loadCombinedEntries() {
  const stored = await chrome.storage.local.get({ entries: [], callLogs: [], manualEntries: [] });
  return Array.isArray(stored[ENTRIES_KEY]) && stored[ENTRIES_KEY].length
    ? stored[ENTRIES_KEY]
    : [
      ...stored.callLogs.map((entry) => ({ ...entry, recordType: 'call' })),
      ...stored.manualEntries.map((entry) => ({ ...entry, recordType: 'entry' }))
    ];
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function exportXlsx() {
  const entries = await loadCombinedEntries();
  const workbook = buildWorkbook(entries);
  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  downloadFile(content, `call-log-export-${new Date().toISOString().slice(0, 10)}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function setupPopupDataTransfer() {
  const exportBtn = document.getElementById('export-xlsx');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportXlsx);
  }
}

globalThis.popupDataTransfer = { buildWorkbook, durationToSeconds };
globalThis.setupPopupDataTransfer = setupPopupDataTransfer;
})();
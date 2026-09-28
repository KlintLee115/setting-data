(() => {
const ENTRIES_KEY = 'entries';

const ANALYSIS_COLUMNS = [
  ['Record type', (entry) => entry.recordType === 'call' ? 'Call' : 'Manual'],
  ['Lead name', (entry) => entry.recordType === 'call' ? entry.name : entry.fullName],
  ['Email', (entry) => entry.email],
  ['Phone', (entry) => entry.phone],
  ['Outcome', (entry) => entry.status],
  ['Call date/time', (entry) => toExcelDate(entry.callDateTime || entry.timestamp || entry.createdAt)],
  ['Call duration (seconds)', (entry) => durationToSeconds(entry.callDuration)],
  ['Picked up?', (entry) => entry.phonePickedUp],
  ['Disqualified?', (entry) => entry.disqualified],
  ['Disqualification reason', (entry) => entry.disqualificationReason],
  ['Talk time (seconds)', (entry) => durationToSeconds(entry.talkTime)],
  ['Talk-to-listen ratio', (entry) => entry.talkToListenRatio],
  ['Client type', (entry) => entry.clientType],
  ['Objection: Partner', (entry) => hasObjection(entry.objections, 'Partner')],
  ['Objection: Had to go', (entry) => hasObjection(entry.objections, 'Had to go')],
  ['Objection: Not interested', (entry) => hasObjection(entry.objections, 'Not interested')],
  ['Objection: Just curious', (entry) => hasObjection(entry.objections, 'Just curious')],
  ['Objection: Are u trying to sell me', (entry) => hasObjection(entry.objections, 'Are u trying to sell me')],
  ['Objection notes', (entry) => entry.objectionNotes],
  ['Pitch outcome', (entry) => entry.pitched],
  ['Closer', (entry) => entry.closer],
  ['Appointment date/time', (entry) => toExcelDate(entry.appointmentDate)],
  ['Last text message', (entry) => entry.lastTextMessage],
  ['Notes', (entry) => entry.notes],
  ['Source URL', (entry) => entry.sourceUrl]
];

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
  worksheet['!cols'] = [
    { wch: 12 }, { wch: 24 }, { wch: 28 }, { wch: 18 }, { wch: 18 },
    { wch: 21 }, { wch: 23 }, { wch: 14 }, { wch: 15 }, { wch: 26 },
    { wch: 20 }, { wch: 20 }, { wch: 20 }, ...Array(5).fill({ wch: 25 }),
    { wch: 32 }, { wch: 18 }, { wch: 22 }, { wch: 23 }, { wch: 40 },
    { wch: 40 }, { wch: 45 }
  ];
  const workbook = XLSX.utils.book_new();
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
  document.getElementById('export-xlsx').addEventListener('click', exportXlsx);
}

globalThis.popupDataTransfer = { buildWorkbook, durationToSeconds };
globalThis.setupPopupDataTransfer = setupPopupDataTransfer;
})();

(() => {
const ENTRIES_KEY = 'entries';

const CSV_COLUMNS = [
  ['type', (entry) => entry.recordType === 'call' ? 'Call' : 'Manual'],
  ['name', (entry) => entry.recordType === 'call' ? entry.name : entry.fullName],
  ['email', (entry) => entry.email],
  ['phone', (entry) => entry.phone],
  ['status', (entry) => entry.status],
  ['callDateTime', (entry) => entry.callDateTime],
  ['callDuration', (entry) => entry.callDuration],
  ['phonePickedUp', (entry) => entry.phonePickedUp],
  ['disqualified', (entry) => entry.disqualified],
  ['disqualificationReason', (entry) => entry.disqualificationReason],
  ['talkTime', (entry) => entry.talkTime],
  ['talkToListenRatio', (entry) => entry.talkToListenRatio],
  ['clientType', (entry) => entry.clientType],
  ['objections', (entry) => entry.objections],
  ['objectionNotes', (entry) => entry.objectionNotes],
  ['pitched', (entry) => entry.pitched],
  ['closer', (entry) => entry.closer],
  ['appointmentDate', (entry) => entry.appointmentDate],
  ['lastTextMessage', (entry) => entry.lastTextMessage],
  ['notes', (entry) => entry.notes],
  ['sourceUrl', (entry) => entry.sourceUrl]
];

function toCsvValue(value) {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r') {
      // ignore, newline is handled by \n
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell !== ''));
}

function csvRowsToEntries(rows) {
  const [header, ...dataRows] = rows;
  if (!header || !header.includes('type')) {
    throw new Error('CSV must include the exported header row.');
  }
  return dataRows.map((row) => {
    const record = {};
    header.forEach((key, index) => {
      record[key] = row[index] ?? '';
    });
    const recordType = record.type === 'Call' ? 'call' : 'entry';
    const { type, name, ...rest } = record;
    return {
      ...rest,
      recordType,
      ...(recordType === 'call' ? { name } : { fullName: name })
    };
  });
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

async function exportCsv() {
  const entries = await loadCombinedEntries();
  const header = CSV_COLUMNS.map(([name]) => name).join(',');
  const rows = entries.map((entry) => CSV_COLUMNS.map(([, getValue]) => toCsvValue(getValue(entry))).join(','));
  downloadFile([header, ...rows].join('\r\n'), `call-log-export-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
}

async function restoreCsv(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (loadEvent) => {
    try {
      const entries = csvRowsToEntries(parseCsv(loadEvent.target.result));
      await chrome.storage.local.set({ [ENTRIES_KEY]: entries });
      alert('Data restored successfully.');
      location.reload();
    } catch (error) {
      alert(`Could not restore CSV: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

function setupPopupDataTransfer() {
  document.getElementById('export-csv').addEventListener('click', exportCsv);
  document.getElementById('import-csv').addEventListener('click', () => document.getElementById('import-csv-file').click());
  document.getElementById('import-csv-file').addEventListener('change', restoreCsv);
}

globalThis.setupPopupDataTransfer = setupPopupDataTransfer;
})();

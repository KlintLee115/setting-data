import type { Entry } from './models/entry';

export interface BackupStorage {
  get(key: string): Promise<Record<string, Entry[]>>;
  set(values: Record<string, Entry[]>): Promise<void>;
}

export interface DataTransferDocument extends Document {
  getElementById(elementId: string): HTMLElement | null;
}

const CSV_COLUMNS: Array<[string, (entry: Entry) => unknown]> = [
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

function toCsvValue(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function entriesToCsv(entries: Entry[]): string {
  const header = CSV_COLUMNS.map(([name]) => name).join(',');
  const rows = entries.map((entry) => CSV_COLUMNS.map(([, getValue]) => toCsvValue(getValue(entry))).join(','));
  return [header, ...rows].join('\r\n');
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
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

export function csvRowsToEntries(rows: string[][]): Entry[] {
  const [header, ...dataRows] = rows;
  if (!header || !header.includes('type')) {
    throw new Error('CSV must include the exported header row.');
  }
  return dataRows.map((row) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = row[index] ?? '';
    });
    const recordType = record.type === 'Call' ? 'call' : 'entry';
    const { type, name, ...rest } = record;
    return {
      ...rest,
      recordType,
      ...(recordType === 'call' ? { name } : { fullName: name })
    } as Entry;
  });
}

export async function backupCsv(
  storage: BackupStorage,
  documentRef: Document = document,
  urlApi: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'> = URL
): Promise<void> {
  const data = await storage.get('entries');
  const blob = new Blob([entriesToCsv(data.entries || [])], { type: 'text/csv;charset=utf-8;' });
  const url = urlApi.createObjectURL(blob);
  const link = documentRef.createElement('a');
  link.href = url;
  link.download = 'backup.csv';
  documentRef.body.appendChild(link);
  link.click();
  link.remove();
  urlApi.revokeObjectURL(url);
}

export async function restoreCsv(
  storage: BackupStorage,
  value: string
): Promise<void> {
  await storage.set({ entries: csvRowsToEntries(parseCsv(value)) });
}

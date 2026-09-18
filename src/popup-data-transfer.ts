import type { Entry } from './models/entry';

export interface BackupStorage {
  get(key: string): Promise<Record<string, Entry[]>>;
  set(values: Record<string, Entry[]>): Promise<void>;
}

export interface DataTransferDocument extends Document {
  getElementById(elementId: string): HTMLElement | null;
}

export async function backupData(
  storage: BackupStorage,
  documentRef: Document = document,
  urlApi: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'> = URL
): Promise<void> {
  const data = await storage.get('entries');
  const blob = new Blob([JSON.stringify(data.entries, null, 2)], { type: 'application/json' });
  const url = urlApi.createObjectURL(blob);
  const link = documentRef.createElement('a');
  link.href = url;
  link.download = 'backup.json';
  documentRef.body.appendChild(link);
  link.click();
  link.remove();
  urlApi.revokeObjectURL(url);
}

export function parseBackup(value: string): Entry[] {
  const data: unknown = JSON.parse(value);
  if (!Array.isArray(data) || data.some((entry) => !entry || typeof entry !== 'object')) {
    throw new Error('Backup must contain an array of entries.');
  }
  return data as Entry[];
}

export async function restoreData(
  storage: BackupStorage,
  value: string
): Promise<void> {
  await storage.set({ entries: parseBackup(value) });
}

export interface CallRecord {
  format: 'sales-call-record-v1';
  name: string;
  phonePickedUp: 'Yes' | 'No';
  callDateTime: string;
  callDuration?: string;
}

export function parseCallRecord(value: string): CallRecord {
  const record: unknown = JSON.parse(value);
  if (!record || typeof record !== 'object') {
    throw new Error('This is not a valid call record export.');
  }
  const candidate = record as Partial<CallRecord>;
  if (candidate.format !== 'sales-call-record-v1'
    || typeof candidate.name !== 'string'
    || !['Yes', 'No'].includes(candidate.phonePickedUp || '')
    || typeof candidate.callDateTime !== 'string') {
    throw new Error('This is not a valid call record export.');
  }
  return candidate as CallRecord;
}

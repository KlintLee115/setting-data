import type { Entry } from './models/entry';
import { combineEntries, toManualEntry } from './models/entry';

export interface StorageArea {
  get(defaults: Record<string, unknown>): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface PopupEntries {
  logs: Entry[];
  manualEntries: Entry[];
}

export interface PopupStorage {
  clearDraft(): Promise<void>;
  loadDraft<T = Record<string, unknown>>(): Promise<T | null>;
  loadEntries(): Promise<PopupEntries>;
  loadPendingLead<T = Record<string, unknown>>(): Promise<T | null>;
  saveDraft(draft: Record<string, unknown>): Promise<void>;
  saveEntries(logs: Entry[], manualEntries: Entry[]): Promise<Entry[]>;
}

export function createPopupStorage(storage: StorageArea): PopupStorage {
  const entriesKey = 'entries';

  async function loadEntries(): Promise<PopupEntries> {
    const stored = await storage.get({
      callLogs: [],
      manualEntries: [],
      [entriesKey]: null
    });
    const entries = stored[entriesKey];
    if (Array.isArray(entries)) {
      return {
        logs: entries.filter((entry): entry is Entry => Boolean(entry) && (entry as Entry).recordType === 'call'),
        manualEntries: entries.filter((entry): entry is Entry => Boolean(entry) && (entry as Entry).recordType !== 'call')
      };
    }
    return {
      logs: Array.isArray(stored.callLogs) ? stored.callLogs as Entry[] : [],
      manualEntries: Array.isArray(stored.manualEntries) ? stored.manualEntries as Entry[] : []
    };
  }

  async function saveEntries(logs: Entry[], manualEntries: Entry[]): Promise<Entry[]> {
    const normalizedManualEntries = manualEntries.map(toManualEntry);
    const entries = combineEntries(logs, normalizedManualEntries);
    await storage.set({
      [entriesKey]: entries,
      callLogs: logs,
      manualEntries: normalizedManualEntries
    });
    return normalizedManualEntries;
  }

  async function saveDraft(draft: Record<string, unknown>): Promise<void> {
    await storage.set({ conversationDraft: draft });
  }

  async function loadDraft<T = Record<string, unknown>>(): Promise<T | null> {
    const stored = await storage.get({ conversationDraft: null });
    return (stored.conversationDraft as T | null) || null;
  }

  async function loadPendingLead<T = Record<string, unknown>>(): Promise<T | null> {
    const stored = await storage.get({ pendingLead: null });
    return (stored.pendingLead as T | null) || null;
  }

  async function clearDraft(): Promise<void> {
    await storage.remove('conversationDraft');
  }

  return { clearDraft, loadDraft, loadEntries, loadPendingLead, saveDraft, saveEntries };
}

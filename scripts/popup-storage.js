function createPopupStorage(storage = chrome.storage.local) {
  const entriesKey = 'entries';

  async function loadEntries() {
    const stored = await storage.get({
      callLogs: [],
      manualEntries: [],
      [entriesKey]: null
    });
    if (Array.isArray(stored[entriesKey])) {
      return {
        logs: stored[entriesKey].filter((entry) => entry.recordType === 'call'),
        manualEntries: stored[entriesKey].filter((entry) => entry.recordType !== 'call')
      };
    }
    return {
      logs: Array.isArray(stored.callLogs) ? stored.callLogs : [],
      manualEntries: Array.isArray(stored.manualEntries) ? stored.manualEntries : []
    };
  }

  async function saveEntries(logs, manualEntries) {
    const normalizedManualEntries = manualEntries.map(toManualEntry);
    const entries = combineEntries(logs, normalizedManualEntries);
    await storage.set({
      [entriesKey]: entries,
      callLogs: logs,
      manualEntries: normalizedManualEntries
    });
    return normalizedManualEntries;
  }

  async function saveDraft(draft) {
    await storage.set({ conversationDraft: draft });
  }

  async function loadDraft() {
    const stored = await storage.get({ conversationDraft: null });
    return stored.conversationDraft;
  }

  async function loadPendingLead() {
    const stored = await storage.get({ pendingLead: null });
    return stored.pendingLead;
  }

  async function clearDraft() {
    await storage.remove('conversationDraft');
  }

  return {
    clearDraft,
    loadDraft,
    loadEntries,
    loadPendingLead,
    saveDraft,
    saveEntries
  };
}

if (typeof globalThis !== 'undefined') {
  globalThis.createPopupStorage = createPopupStorage;
}

if (typeof module !== 'undefined') {
  module.exports = { createPopupStorage };
}

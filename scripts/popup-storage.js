function createPopupStorage(storage = chrome.storage.local) {
  const entriesKey = 'entries';
  const withoutLegacyFields = (entry) => {
    const { contactHistory, hasContactedBefore, hasShownIntentBefore, shownIntent, talkToListenRatio, disqualified, disqualificationReason, objectionNotes, leadTimeZone, ...trackedEntry } = entry;
    delete trackedEntry['has contacted before'];
    return trackedEntry;
  };

  async function loadEntries() {
    const stored = await storage.get({
      callLogs: [],
      manualEntries: [],
      [entriesKey]: null
    });
    if (Array.isArray(stored[entriesKey])) {
      return {
        logs: stored[entriesKey].filter((entry) => entry.recordType === 'call').map(withoutLegacyFields),
        manualEntries: stored[entriesKey].filter((entry) => entry.recordType !== 'call').map(withoutLegacyFields)
      };
    }
    return {
      logs: Array.isArray(stored.callLogs) ? stored.callLogs.map(withoutLegacyFields) : [],
      manualEntries: Array.isArray(stored.manualEntries) ? stored.manualEntries.map(withoutLegacyFields) : []
    };
  }

  async function saveEntries(logs, manualEntries) {
    const normalizedLogs = logs.map(withoutLegacyFields);
    const normalizedManualEntries = manualEntries.map((entry) => toManualEntry(withoutLegacyFields(entry)));
    const entries = combineEntries(normalizedLogs, normalizedManualEntries);
    await storage.set({
      [entriesKey]: entries,
      callLogs: normalizedLogs,
      manualEntries: normalizedManualEntries
    });
    return normalizedManualEntries;
  }

  async function saveDraft(draft) {
    await storage.set({ conversationDraft: withoutLegacyFields(draft) });
  }

  async function loadDraft() {
    const stored = await storage.get({ conversationDraft: null });
    if (!stored.conversationDraft) {
      return stored.conversationDraft;
    }
    return withoutLegacyFields(stored.conversationDraft);
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

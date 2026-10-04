const logBody = document.getElementById('log-body');
const dateFilter = document.getElementById('date-filter');
const entrySearch = document.getElementById('entry-search');
const count = document.getElementById('count');
const importStatus = document.getElementById('import-status');
const saveEntryButton = document.getElementById('save-entry');
const clearFormButton = document.getElementById('clear-form');
const cancelEditButton = document.getElementById('cancel-edit');
const showCallLoggerButton = document.getElementById('show-call-logger');
const {
  getLocalDateValue,
  updateDmDateTime,
  updateCallDateTime
} = globalThis.popupSettings;

let logs = [];
let manualEntries = [];
let editingEntry = null;
let entrySort = { key: 'date', direction: 'desc' };
let entryRenderLimit = 50;
const popupStorage = createPopupStorage();

function createEntryId() {
  return `${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}
async function persistEntries() {
  manualEntries = await popupStorage.saveEntries(logs, manualEntries);
}

function setFormValue(name, value) {
  const field = document.querySelector(`[name="${name}"]`);
  if (!field || value === undefined) {
    return;
  }
  if (field.type === 'checkbox') {
    field.checked = true;
  } else {
    field.value = value;
  }
}

async function showCallLogger() {
  showCallLoggerButton.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error('No active tab.');
    }
    let result;
    try {
      result = await chrome.tabs.sendMessage(tab.id, { type: 'show-call-logger' });
    } catch (error) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scripts/objection-options.js', 'scripts/content.js'] });
      result = await chrome.tabs.sendMessage(tab.id, { type: 'show-call-logger' });
    }
    importStatus.textContent = result?.shown
      ? 'Outreach logger restored.'
      : 'Open a GoHighLevel conversation to show the outreach logger.';
  } catch (error) {
    importStatus.textContent = 'Open a GoHighLevel contact, then try again.';
  } finally {
    showCallLoggerButton.disabled = false;
  }
}

function getFormDraft() {
  const form = document.getElementById('manual-entry-form');
  return {
    ...Object.fromEntries(new FormData(form).entries()),
    editingEntry
  };
}

async function saveFormDraft() {
  await popupStorage.saveDraft(getFormDraft());
}

async function restoreFormDraft() {
  const draft = await popupStorage.loadDraft();
  if (!draft) {
    return;
  }
  Object.entries(draft).forEach(([name, value]) => {
    if (name === 'editingEntry') {
      editingEntry = value;
    } else {
      setFormValue(name, value);
    }
  });
  if (draft.editingEntry) {
    editingEntry = draft.editingEntry;
    saveEntryButton.textContent = 'Save changes';
    cancelEditButton.hidden = false;
    clearFormButton.hidden = true;
  }
  updateConditionalFields();
  importStatus.textContent = 'Draft restored. Review before saving.';
}

async function restorePendingLead() {
  const pendingLead = await popupStorage.loadPendingLead();
  const nameField = document.querySelector('[name="fullName"]');
  if (!pendingLead || !nameField) {
    return;
  }
  if (pendingLead.fullName && !nameField.value.trim()) {
    nameField.value = pendingLead.fullName;
  }
  if (pendingLead.callDateTime) {
    setFormValue('callDateTime', pendingLead.callDateTime);
  }
  if (pendingLead.fullName) {
    importStatus.textContent = `Lead detected: ${pendingLead.fullName}. Review before saving.`;
  }
  await saveFormDraft();
}

function isToday(timestamp) {
  const date = parseStoredDateTime(timestamp);
  return getLocalDateValue(date) === getLocalDateValue();
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  }).format(parseStoredDateTime(timestamp));
}

function formatDateTime(timestamp) {
  if (!timestamp) {
    return '-';
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  }).format(parseStoredDateTime(timestamp));
}

function isVisible(timestamp) {
  return dateFilter.value === 'all' || isToday(timestamp);
}

function getStatusClass(status) {
  if (status === 'Sent') {
    return 'sent';
  }
  if (status === 'Replied' || status === 'Qualified') {
    return 'replied';
  }
  if (status === 'Had to go') {
    return 'had-to-go';
  }
  if (['Picked Up', 'Showed', 'Booked'].includes(status)) {
    return status === 'Booked' ? 'booked' : 'picked-up';
  }
  return 'no-answer';
}

function render() {
  const entries = [
    ...logs.map((log) => ({ ...log, entryType: 'Call', sourceType: 'call', createdAt: log.timestamp })),
    ...manualEntries.map((entry) => ({ ...entry, entryType: entry.recordType === 'dm' ? 'DM' : 'Manual', sourceType: 'manual' }))
  ];
  const visibleEntries = searchEntriesByName(entries, entrySearch.value)
    .filter((entry) => isVisible(getEntryDateTime(entry)))
    .sort((a, b) => {
      const first = getEntrySortValue(a, entrySort.key);
      const second = getEntrySortValue(b, entrySort.key);
      const comparison = typeof first === 'number' && typeof second === 'number'
        ? first - second
        : String(first).localeCompare(String(second));
      return entrySort.direction === 'asc' ? comparison : -comparison;
    });

  if (entryRenderLimit > visibleEntries.length) {
    entryRenderLimit = visibleEntries.length || 50;
  }

  count.textContent = visibleEntries.length;
  renderEntryTable(logBody, visibleEntries.map((entry) => ({
    ...entry,
    dateTime: getEntryDateTime(entry)
  })), {
    formatDate,
    formatDateTime,
    getStatusClass,
    onEdit: startEditing,
    onDelete: deleteEntry
  }, {
    initialLimit: entryRenderLimit,
    onLoadMore: () => {
      entryRenderLimit = Math.min(entryRenderLimit + 50, visibleEntries.length);
      render();
    }
  });
}

async function loadLogs() {
  ({ logs, manualEntries } = await popupStorage.loadEntries());
  logs = logs.map((entry) => ({ ...entry, id: entry.id || createEntryId() }));
  manualEntries = manualEntries.map((entry) => ({ ...normalizeEntryStatus(entry), id: entry.id || createEntryId() }));
  await persistEntries();
  render();
}

function getEntryFormData(form) {
  const formData = new FormData(form);
  const activityType = formData.get('activityType') || 'call';
  const fullName = formData.get('fullName').trim();
  const email = formData.get('email').trim();
  const phone = formData.get('phone').trim();
  const leadTimeZone = formData.get('leadTimeZone').trim();
  const notes = formData.get('notes').trim();
  if (activityType === 'dm') {
    const dmDateTime = formData.get('dmDateTime');
    const dmOutcome = formData.get('dmOutcome') || 'Sent';
    return {
      fullName,
      email,
      phone,
      leadTimeZone,
      recordType: 'dm',
      dmChannel: formData.get('dmChannel'),
      dmOutcome,
      dmDateTime: dmDateTime ? new Date(dmDateTime).toISOString() : '',
      dmMessage: formData.get('dmMessage').trim(),
      dmResponse: formData.get('dmResponse').trim(),
      status: dmOutcome,
      notes
    };
  }
  const appointmentDate = formData.get('appointmentDate');
  const pitched = formData.get('pitched');
  const phonePickedUp = formData.get('phonePickedUp');
  const objections = OBJECTION_OPTIONS
    .filter(([name]) => formData.get(name))
    .map(([, label]) => label)
    .join(', ');
  const clientType = [
    formData.has('clientType9to5') ? '9-5' : '',
    formData.has('clientTypeBusinessOwner') ? 'Business Owner' : ''
  ].filter(Boolean).join(', ');
  const normalizedStatus = pitched === 'High Ticket' || appointmentDate
    ? 'Booked'
    : phonePickedUp === 'Yes'
      ? 'Picked Up'
      : phonePickedUp === 'No'
        ? 'No Answer'
        : '';
  return {
    fullName,
    email,
    phone,
    leadTimeZone,
    intent: formData.get('intent').trim(),
    phonePickedUp,
    callDateTime: formData.get('callDateTime'),
    callDuration: formData.get('callDuration'),
    lastTextMessage: formData.get('lastTextMessage').trim(),
    talkTime: formData.get('talkTime').trim(),
    clientType,
    objections,
    pitched,
    closer: formData.get('closer').trim(),
    appointmentDate: appointmentDate ? new Date(appointmentDate).toISOString() : '',
    status: normalizedStatus,
    notes
  };
}

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getCallTime(entry) {
  const timestamp = entry.callDateTime
    || entry.timestamp
    || entry.createdAt;
  return parseStoredDateTime(timestamp);
}

function getEntryDateTime(entry) {
  return entry.dmDateTime || entry.callDateTime || entry.pickupDateTime || entry.timestamp || entry.createdAt;
}

function getEntrySortValue(entry, key) {
  if (key === 'date') return parseStoredDateTime(getEntryDateTime(entry)).getTime();
  if (key === 'name') return String(entry.name || entry.fullName || '').toLowerCase();
  return String(entry.status || '').toLowerCase();
}

function hasDuplicateCall(entry) {
  if (entry.recordType === 'dm') {
    return false;
  }
  const normalizedName = normalizeName(entry.fullName || entry.name);
  const callTime = getCallTime(entry);
  if (!normalizedName || Number.isNaN(callTime.getTime())) {
    return false;
  }
  const callMinute = Math.floor(callTime.getTime() / 60000);
  return [
    ...logs.map((log) => ({ ...log, sourceType: 'call' })),
    ...manualEntries.map((record) => ({ ...record, sourceType: 'manual' }))
  ].filter((existing) => existing.recordType !== 'dm').some((existing) => {
    if (editingEntry
      && existing.sourceType === editingEntry.sourceType
      && existing.id === editingEntry.id) {
      return false;
    }
    const existingTime = getCallTime(existing);
    return normalizeName(existing.name || existing.fullName) === normalizedName
      && !Number.isNaN(existingTime.getTime())
      && Math.floor(existingTime.getTime() / 60000) === callMinute;
  });
}

function findStoredEntry(target) {
  const collection = target.sourceType === 'call' ? logs : manualEntries;
  const index = collection.findIndex((entry) => entry.id === target.id);
  return { collection, index, entry: index >= 0 ? collection[index] : null };
}

function startEditing(entry) {
  editingEntry = { sourceType: entry.sourceType, id: entry.id };
  const values = entry.entryType === 'Call'
    ? { ...entry, fullName: entry.name, activityType: 'call', phonePickedUp: entry.status === 'Picked Up' ? 'Yes' : 'No' }
    : { ...entry, fullName: entry.fullName || entry.name, activityType: entry.recordType === 'dm' ? 'dm' : 'call' };
  if (values.appointmentDate) {
    values.appointmentDate = formatDateTimeInput(values.appointmentDate);
  }
  if (values.dmDateTime) {
    values.dmDateTime = formatDateTimeInput(values.dmDateTime);
  }
  Object.entries(values).forEach(([name, value]) => {
    if (['entryType', 'sourceType', 'sourceIndex', 'recordType', 'createdAt', 'timestamp', 'clientType'].includes(name)) {
      return;
    }
    setFormValue(name, value);
  });
  const selectedObjections = String(values.objections || '').split(',').map((value) => value.trim()).filter(Boolean);
  document.querySelectorAll('#manual-entry-form [data-objection]').forEach((checkbox) => {
    checkbox.checked = selectedObjections.includes(checkbox.value);
  });
  const selectedClientTypes = String(values.clientType || '').split(',').map((value) => value.trim()).filter(Boolean);
  document.querySelectorAll('#manual-entry-form [name^="clientType"]').forEach((checkbox) => {
    checkbox.checked = selectedClientTypes.includes(checkbox.value);
  });
  updateConditionalFields();
  saveEntryButton.textContent = 'Save changes';
  clearFormButton.hidden = true;
  cancelEditButton.hidden = false;
  importStatus.textContent = 'Editing entry.';
  document.getElementById('manual-entry-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  saveFormDraft();
}

function resetEntryForm() {
  editingEntry = null;
  document.getElementById('manual-entry-form').reset();
  importStatus.textContent = '';
  saveEntryButton.textContent = 'Save entry';
  clearFormButton.hidden = false;
  cancelEditButton.hidden = true;
  updateConditionalFields();
  updateCallDateTime();
  updateDmDateTime();
}

async function deleteEntry(entry) {
  if (!confirm('Delete this entry? This cannot be undone.')) {
    return;
  }
  const stored = findStoredEntry(entry);
  if (stored.index < 0) {
    return;
  }
  stored.collection.splice(stored.index, 1);
  await persistEntries();
  if (editingEntry
    && editingEntry.sourceType === entry.sourceType
    && editingEntry.id === entry.id) {
    resetEntryForm();
  }
  render();
}

document.getElementById('manual-entry-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const entry = getEntryFormData(form);
  const entryWithCallTime = {
    ...entry,
    createdAt: editingEntry
      ? findStoredEntry(editingEntry).entry?.timestamp || findStoredEntry(editingEntry).entry?.createdAt
      : new Date().toISOString()
  };
  if (entry.recordType !== 'dm' && hasDuplicateCall(entryWithCallTime)
    && !confirm(`A call for ${entry.fullName} at this time already exists. Save another entry anyway?`)) {
    return;
  }
  if (editingEntry) {
    const stored = findStoredEntry(editingEntry);
    if (stored.index < 0) {
      alert('This entry no longer exists.');
      resetEntryForm();
      return;
    }
    if (editingEntry.sourceType === 'call') {
      const existing = stored.entry;
      stored.collection[stored.index] = {
        ...existing,
        ...entry,
        id: existing.id || createEntryId(),
        name: entry.fullName,
        status: entry.phonePickedUp === 'Yes' ? 'Picked Up' : 'No Answer',
        timestamp: existing.timestamp
      };
    } else {
      const existing = stored.entry;
      stored.collection[stored.index] = {
        ...existing,
        ...entry,
        id: existing.id || createEntryId(),
        createdAt: existing.createdAt
      };
    }
    await persistEntries();
  } else {
    const resolvedStatus = entry.recordType === 'dm'
      ? entry.dmOutcome
      : entry.pitched === 'High Ticket'
        ? 'Booked'
        : entry.phonePickedUp === 'Yes' ? 'Picked Up' : entry.phonePickedUp === 'No' ? 'No Answer' : '';
    manualEntries.push({
      ...entry,
      status: resolvedStatus,
      recordType: entry.recordType === 'dm' ? 'dm' : 'entry',
      id: createEntryId(),
      createdAt: new Date().toISOString()
    });
    await persistEntries();
  }
  await popupStorage.clearDraft();
  resetEntryForm();
  render();
});

function updateConditionalFields() {
  document.querySelectorAll('[data-show-when]').forEach((field) => {
    const conditions = field.dataset.showWhen.split('&');
    const visible = conditions.every((condition) => {
      const [id, expectedValue] = condition.split('=');
      const control = document.getElementById(id);
      return control && control.value === expectedValue;
    });
    field.style.display = visible ? 'grid' : 'none';
    if (!visible) {
      clearFieldValues(field);
    }
  });
  updatePitchFieldRequirements();
  const isDm = document.getElementById('activity-type').value === 'dm';
  document.querySelector('[name="phonePickedUp"]').required = !isDm;
  document.querySelector('[name="callDateTime"]').required = !isDm;
  document.querySelector('[name="dmChannel"]').required = isDm;
  document.querySelector('[name="dmDateTime"]').required = isDm;
}

function clearFieldValues(container) {
  container.querySelectorAll('input, select, textarea').forEach((control) => {
    if (control.type === 'checkbox') {
      control.checked = false;
    } else {
      control.value = '';
    }
  });
}

function updatePitchFieldRequirements() {
  const pitched = document.getElementById('pitched').value;
  const highTicket = pitched === 'High Ticket';
  document.querySelector('[name="closer"]').required = highTicket;
  document.querySelector('[name="appointmentDate"]').required = highTicket;
}

document.querySelectorAll('#manual-entry-form select').forEach((select) => {
  select.addEventListener('change', () => {
    updateConditionalFields();
    saveFormDraft();
  });
});
document.getElementById('activity-type').addEventListener('change', () => {
  updateConditionalFields();
  updateDmDateTime();
  saveFormDraft();
});
globalThis.setupPopupDataTransfer();
showCallLoggerButton.addEventListener('click', showCallLogger);
clearFormButton.addEventListener('click', async () => {
  await popupStorage.clearDraft();
  resetEntryForm();
});
cancelEditButton.addEventListener('click', async () => {
  await popupStorage.clearDraft();
  resetEntryForm();
});
document.getElementById('manual-entry-form').addEventListener('input', saveFormDraft);
updateConditionalFields();
updateCallDateTime();
updateDmDateTime();

dateFilter.addEventListener('change', () => {
  entryRenderLimit = 50;
  render();
});
entrySearch.addEventListener('input', () => {
  entryRenderLimit = 50;
  render();
});
document.querySelectorAll('[data-sort]').forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.dataset.sort;
    entrySort = entrySort.key === key
      ? { key, direction: entrySort.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: key === 'date' ? 'desc' : 'asc' };
    entryRenderLimit = 50;
    render();
  });
});
restoreFormDraft()
  .then(restorePendingLead)
  .then(loadLogs)
  .catch((error) => {
    console.error('Could not initialize popup:', error);
    importStatus.textContent = 'Could not load saved data. Reload the extension and try again.';
  });

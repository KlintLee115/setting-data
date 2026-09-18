const logBody = document.getElementById('log-body');
const dateFilter = document.getElementById('date-filter');
const count = document.getElementById('count');
const summaryDate = document.getElementById('summary-date');
const pickupSummaryBody = document.getElementById('pickup-summary-body');
const dailyCalls = document.getElementById('daily-calls');
const dailyPickups = document.getElementById('daily-pickups');
const dailyDisqualified = document.getElementById('daily-disqualified');
const dailyPitches = document.getElementById('daily-pitches');
const dailyAppointments = document.getElementById('daily-appointments');
const dailyNoAnswers = document.getElementById('daily-no-answers');
const dailyMoney = document.getElementById('daily-money');
const dailyPartner = document.getElementById('daily-partner');
const dailyTiming = document.getElementById('daily-timing');
const dailyHadToGo = document.getElementById('daily-had-to-go');
const dailyPitchRate = document.getElementById('daily-pitch-rate');
const dailySetRate = document.getElementById('daily-set-rate');
const dailyAverageDuration = document.getElementById('daily-average-duration');
const importStatus = document.getElementById('import-status');
const saveEntryButton = document.getElementById('save-entry');
const clearFormButton = document.getElementById('clear-form');
const cancelEditButton = document.getElementById('cancel-edit');
const showCallLoggerButton = document.getElementById('show-call-logger');
const {
  DEFAULT_TIME_ZONE_KEY,
  REPORTING_TIME_ZONE_KEY,
  getDefaultAppointmentTimeZone,
  getLocalDateTimeValue,
  getLocalDateValue,
  getReportingTimeZone,
  getTimeZoneDisplayName,
  loadDefaultAppointmentTimeZone,
  syncDefaultAppointmentTimeZone,
  updateCallDateTime
} = globalThis.popupSettings;

let logs = [];
let manualEntries = [];
let editingEntry = null;
let entrySort = { key: 'date', direction: 'desc' };
const popupStorage = createPopupStorage();

function createEntryId() {
  return `${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}
async function persistEntries() {
  manualEntries = await popupStorage.saveEntries(logs, manualEntries);
}

function setFormValue(name, value) {
  const field = document.querySelector(`[name="${name}"]`);
  if (field && value !== undefined) {
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
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scripts/content.js'] });
      result = await chrome.tabs.sendMessage(tab.id, { type: 'show-call-logger' });
    }
    importStatus.textContent = result?.shown
      ? 'Call logger restored.'
      : 'Open a GoHighLevel conversation to show the call logger.';
  } catch (error) {
    importStatus.textContent = 'Open a GoHighLevel contact, then try again.';
  } finally {
    showCallLoggerButton.disabled = false;
  }
}

function durationToSeconds(value) {
  const match = String(value || '').match(/^(\d+):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
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
    } else if (name === 'leaveReason') {
      setFormValue(name, normalizeLeaveReason(value));
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

function formatDate(timestamp, timeZone = getReportingTimeZone()) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone
  }).format(parseStoredDateTime(timestamp));
}

function formatDateTime(timestamp, timeZone = getReportingTimeZone()) {
  if (!timestamp) {
    return '-';
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone
  }).format(parseStoredDateTime(timestamp));
}

function isVisible(timestamp) {
  return dateFilter.value === 'all' || isToday(timestamp);
}

function getStatusClass(status) {
  if (status === 'Had to go') {
    return 'had-to-go';
  }
  if (status === 'Disqualified') {
    return 'disqualified';
  }
  if (['Picked Up', 'Showed', 'Booked'].includes(status)) {
    return status === 'Booked' ? 'booked' : 'picked-up';
  }
  return 'no-answer';
}

function getHourlyCallTime(entry) {
  const timestamp = entry.callDateTime || entry.pickupDateTime || entry.createdAt;
  return parseStoredDateTime(timestamp);
}

function getMountainHour(date) {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: getReportingTimeZone(),
    hour: 'numeric', hour12: false
  }).format(date));
}

function getDailyEntries() {
  const selectedDate = summaryDate.value;
  return [
    ...logs.map((log) => ({ ...log, entryType: 'Call', createdAt: log.timestamp })),
    ...manualEntries.map((entry) => ({ ...entry, entryType: 'Entry' }))
  ].filter((entry) => {
    const callTime = getHourlyCallTime(entry);
    return Number.isFinite(callTime.getTime())
      && getLocalDateValue(callTime) === selectedDate;
  });
}

function renderAppointmentQueue() {
  const queue = document.getElementById('appointment-queue');
  const summaryHeading = document.getElementById('summary-timezone-heading');
  if (summaryHeading) {
    summaryHeading.textContent = getTimeZoneDisplayName(getReportingTimeZone());
  }
  if (!queue) return;
    const queueEntries = [
      ...logs.map((entry) => ({ ...entry, sourceType: 'call', createdAt: entry.createdAt || entry.timestamp })),
      ...manualEntries.map((entry) => ({ ...entry, sourceType: 'manual' }))
    ];
    const todoItems = getTodoItems(queueEntries);
  renderQueueView(queue, todoItems, {
    formatDate,
    formatDateTime,
    formatFollowUpDate: (value) => formatFollowUpDate(value, getReportingTimeZone()),
    formatFollowUpWindow,
    normalizeFollowUpDateValue,
    onSaveNotes: async (entryId, value) => {
      const entry = queueEntries.find((candidate) => candidate.id === entryId);
      if (!entry) return;
      const { collection, index } = findStoredEntry(entry);
      if (index < 0) return;
      collection[index].notes = value;
      collection[index] = normalizeEntryStatus(collection[index]);
      await persistEntries();
      render();
    },
    onOpen: async (entry) => {
      if (entry.sourceUrl) {
        await chrome.tabs.create({ url: entry.sourceUrl });
      }
    },
    onCopyConfirmation: async (message) => {
      await navigator.clipboard.writeText(message);
    },
    onDelete: async (entry) => {
      await deleteEntry(entry);
      renderAppointmentQueue();
    },
  });
}

function renderPickupSummary() {
  const summaryHeading = document.getElementById('summary-timezone-heading');
  if (summaryHeading) {
    summaryHeading.textContent = `${getTimeZoneDisplayName(getReportingTimeZone())} time`;
  }
  const dailyEntries = getDailyEntries();
  const entries = dailyEntries.filter((entry) => entry.entryType === 'Call'
    || ['Yes', 'No'].includes(entry.phonePickedUp));
  const summary = getDailySummary(dailyEntries, durationToSeconds);

  pickupSummaryBody.replaceChildren();
  getHourlySummary(entries, (entry) => getMountainHour(getHourlyCallTime(entry))).forEach((hourly) => {
    const row = document.createElement('tr');
    const timeCell = document.createElement('td');
    const totalCell = document.createElement('td');
    const pickedUpCell = document.createElement('td');
    const rateCell = document.createElement('td');
    timeCell.textContent = `${formatHour(hourly.hour)} - ${formatHour(hourly.hour + 1)}`;
    totalCell.textContent = hourly.total;
    pickedUpCell.textContent = hourly.pickedUp;
    rateCell.className = 'rate';
    rateCell.textContent = hourly.rate === null ? '-' : `${hourly.rate.toFixed(2)}%`;
    row.append(timeCell, totalCell, pickedUpCell, rateCell);
    pickupSummaryBody.appendChild(row);
  });

  dailyCalls.textContent = summary.calls;
  dailyPickups.textContent = summary.pickups;
  dailyDisqualified.textContent = summary.disqualified;
  dailyPitches.textContent = summary.pitches;
  dailyAppointments.textContent = summary.appointments;
  dailyNoAnswers.textContent = summary.noAnswers;
  dailyMoney.textContent = summary.money;
  dailyPartner.textContent = summary.partner;
  dailyTiming.textContent = summary.timing;
  dailyHadToGo.textContent = summary.hadToGo;
  dailyPitchRate.textContent = summary.pitchRate === null ? '-' : `${summary.pitchRate.toFixed(1)}%`;
  dailySetRate.textContent = summary.setRate === null ? '-' : `${summary.setRate.toFixed(1)}%`;
  dailyAverageDuration.textContent = summary.averageDuration
    ? `${Math.floor(summary.averageDuration / 60)}:${String(summary.averageDuration % 60).padStart(2, '0')}`
    : '-';
}

function formatHour(hour) {
  const normalizedHour = hour % 24;
  const suffix = normalizedHour >= 12 ? 'pm' : 'am';
  const displayHour = normalizedHour % 12 || 12;
  return `${displayHour}${suffix}`;
}

function render() {
  const entries = [
    ...logs.map((log) => ({ ...log, entryType: 'Call', sourceType: 'call', createdAt: log.timestamp })),
    ...manualEntries.map((entry) => ({ ...entry, entryType: 'Manual', sourceType: 'manual' }))
  ];
  const visibleEntries = entries
    .filter((entry) => isVisible(getEntryDateTime(entry)))
    .sort((a, b) => {
      const first = getEntrySortValue(a, entrySort.key);
      const second = getEntrySortValue(b, entrySort.key);
      const comparison = typeof first === 'number' && typeof second === 'number'
        ? first - second
        : String(first).localeCompare(String(second));
      return entrySort.direction === 'asc' ? comparison : -comparison;
    });

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
  });
}

async function loadLogs() {
  ({ logs, manualEntries } = await popupStorage.loadEntries());
  logs = logs.map((entry) => ({ ...entry, id: entry.id || createEntryId() }));
  manualEntries = manualEntries.map((entry) => ({ ...normalizeEntryStatus(entry), id: entry.id || createEntryId() }));
  await persistEntries();
  render();
  renderPickupSummary();
  renderAppointmentQueue();
}

function getEntryFormData(form) {
  const formData = new FormData(form);
  const appointmentDate = formData.get('appointmentDate');
  const appointmentTimeZone = formData.get('appointmentTimeZone') || getDefaultAppointmentTimeZone();
  const followUpDate = formData.get('followUpDate');
  const wasSet = formData.get('wasSet');
  const phonePickedUp = formData.get('phonePickedUp');
  const normalizedStatus = formData.get('disqualified') === 'Yes'
    ? 'Disqualified'
    : wasSet === 'Yes' || appointmentDate
    ? 'Booked'
    : phonePickedUp === 'Yes'
      ? 'Picked Up'
      : phonePickedUp === 'No'
        ? 'No Answer'
        : '';
  return {
    fullName: formData.get('fullName').trim(),
    email: formData.get('email').trim(),
    phone: formData.get('phone').trim(),
    phonePickedUp,
    callDateTime: formData.get('callDateTime'),
    callDuration: formData.get('callDuration'),
    lastTextMessage: formData.get('lastTextMessage').trim(),
    leaveReason: normalizeLeaveReason(formData.get('leaveReason')),
    calledBack: formData.get('calledBack'),
    disqualified: formData.get('disqualified'),
    disqualificationReason: formData.get('disqualificationReason').trim(),
    pitched: formData.get('pitched'),
    wasSet,
    closer: formData.get('closer').trim(),
    appointmentDate: appointmentDate ? zonedDateTimeToDate(appointmentDate, appointmentTimeZone).toISOString() : '',
    followUpDate: followUpDate || '',
    appointmentTimeZone,
    status: normalizedStatus,
    notes: formData.get('notes').trim()
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
  return entry.callDateTime || entry.pickupDateTime || entry.timestamp || entry.createdAt;
}

function getEntrySortValue(entry, key) {
  if (key === 'date') return parseStoredDateTime(getEntryDateTime(entry)).getTime();
  if (key === 'name') return String(entry.entryType === 'Call' ? entry.name : entry.fullName || '').toLowerCase();
  return String(entry.status || entry.leaveReason || '').toLowerCase();
}

function hasDuplicateCall(entry) {
  const normalizedName = normalizeName(entry.fullName || entry.name);
  const callTime = getCallTime(entry);
  if (!normalizedName || Number.isNaN(callTime.getTime())) {
    return false;
  }
  const callMinute = Math.floor(callTime.getTime() / 60000);
  return [
    ...logs.map((log) => ({ ...log, sourceType: 'call' })),
    ...manualEntries.map((record) => ({ ...record, sourceType: 'manual' }))
  ].some((existing) => {
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
    ? { ...entry, fullName: entry.name, phonePickedUp: entry.status === 'Picked Up' ? 'Yes' : 'No', wasSet: entry.wasSet || '' }
    : { ...entry };
  if (values.appointmentDate) {
    values.appointmentTimeZone = values.appointmentTimeZone || getDefaultAppointmentTimeZone();
    values.appointmentDate = formatDateTimeInput(values.appointmentDate, values.appointmentTimeZone);
  }
  if (values.followUpDate) {
    values.followUpDate = values.followUpDate.slice(0, 10);
  }
  values.leaveReason = normalizeLeaveReason(values.leaveReason);
  Object.entries(values).forEach(([name, value]) => {
    if (['entryType', 'sourceType', 'sourceIndex', 'recordType', 'createdAt', 'timestamp'].includes(name)) {
      return;
    }
    setFormValue(name, value);
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
  syncDefaultAppointmentTimeZone();
  importStatus.textContent = '';
  saveEntryButton.textContent = 'Save entry';
  clearFormButton.hidden = false;
  cancelEditButton.hidden = true;
  updateConditionalFields();
  updateCallDateTime();
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
  renderPickupSummary();
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
  if (hasDuplicateCall(entryWithCallTime)
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
    const resolvedStatus = entry.wasSet === 'Yes'
      ? 'Booked'
      : entry.phonePickedUp === 'Yes' ? 'Picked Up' : entry.phonePickedUp === 'No' ? 'No Answer' : '';
    manualEntries.push({
      ...entry,
      status: resolvedStatus,
      id: createEntryId(),
      createdAt: new Date().toISOString()
    });
    await persistEntries();
  }
  await popupStorage.clearDraft();
  resetEntryForm();
  render();
  renderPickupSummary();
  renderAppointmentQueue();
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
  updateConversationOutcomeVisibility();
}

function clearFieldValues(container) {
  container.querySelectorAll('input, select, textarea').forEach((control) => {
    control.value = '';
  });
}

function updateConversationOutcomeVisibility() {
  const outcome = document.getElementById('conversation-outcome');
  const phonePickedUp = document.getElementById('phone-picked-up').value;
  const disqualified = document.getElementById('disqualified').value;
  const pitched = document.getElementById('pitched').value;
  const wasSet = document.getElementById('was-set').value;
  const reachedBadOutcome = disqualified !== 'Yes' && (pitched === 'No' || wasSet === 'No');
  const settingStage = document.querySelector('[data-show-when="phone-picked-up=Yes&disqualified=No&pitched=Yes"]');
  const settingVisible = settingStage?.style.display !== 'none';
  outcome.style.display = phonePickedUp === 'Yes' && reachedBadOutcome ? 'grid' : 'none';
  if (outcome.style.display === 'none') {
    clearFieldValues(outcome);
  }
  document.querySelector('[name="leaveReason"]').required = outcome.style.display === 'grid';
  document.querySelector('[name="closer"]').required = settingVisible && wasSet === 'Yes';
  document.querySelector('[name="appointmentDate"]').required = settingVisible && wasSet === 'Yes';
  document.querySelector('[name="appointmentTimeZone"]').required = settingVisible && wasSet === 'Yes';
}

document.getElementById('reporting-time-zone').addEventListener('change', async () => {
  const value = document.getElementById('reporting-time-zone').value;
  await chrome.storage.local.set({ [REPORTING_TIME_ZONE_KEY]: value });
  render();
  renderPickupSummary();
  renderAppointmentQueue();
  saveFormDraft();
});

document.getElementById('default-time-zone').addEventListener('change', async () => {
  const value = document.getElementById('default-time-zone').value;
  const appointmentTimeZone = document.querySelector('[name="appointmentTimeZone"]');
  if (appointmentTimeZone && !appointmentTimeZone.value) {
    appointmentTimeZone.value = value;
  }
  await chrome.storage.local.set({ [DEFAULT_TIME_ZONE_KEY]: value });
  saveFormDraft();
});

document.querySelectorAll('#manual-entry-form select').forEach((select) => {
  select.addEventListener('change', () => {
    updateConditionalFields();
    saveFormDraft();
  });
});
globalThis.setupPopupDataTransfer({ importStatus, saveFormDraft, setFormValue, updateConditionalFields });
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

dateFilter.addEventListener('change', () => {
  render();
});
summaryDate.value = getLocalDateValue();
summaryDate.addEventListener('change', renderPickupSummary);
document.querySelectorAll('[data-sort]').forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.dataset.sort;
    entrySort = entrySort.key === key
      ? { key, direction: entrySort.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: key === 'date' ? 'desc' : 'asc' };
    render();
  });
});
loadDefaultAppointmentTimeZone()
  .then(restoreFormDraft)
  .then(restorePendingLead)
  .then(loadLogs)
  .then(() => {
    renderAppointmentQueue();
  })
  .catch((error) => {
    console.error('Could not initialize popup:', error);
    importStatus.textContent = 'Could not load saved data. Reload the extension and try again.';
  });

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
const dailyObjections = document.getElementById('daily-objections');
const dailyHadToGo = document.getElementById('daily-had-to-go');
const dailyPitchRate = document.getElementById('daily-pitch-rate');
const dailySetRate = document.getElementById('daily-set-rate');
const dailyAverageDuration = document.getElementById('daily-average-duration');
const conversationText = document.getElementById('conversation-text');
const importStatus = document.getElementById('import-status');
const callChoices = document.getElementById('call-choices');
const saveEntryButton = document.getElementById('save-entry');
const clearFormButton = document.getElementById('clear-form');
const cancelEditButton = document.getElementById('cancel-edit');

let logs = [];
let manualEntries = [];
let editingEntry = null;
let pendingCallRecords = [];
let entrySort = { key: 'date', direction: 'desc' };
const ENTRIES_KEY = 'entries';
const REPORTING_TIME_ZONE_KEY = 'reportingTimeZone';
const DEFAULT_TIME_ZONE_KEY = 'defaultAppointmentTimeZone';
const MAX_TRANSCRIPT_LENGTH = 100000;
const popupStorage = createPopupStorage();

function createEntryId() {
  return `${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}
async function backupData() {
  const data = await chrome.storage.local.get(ENTRIES_KEY);
  const blob = new Blob([JSON.stringify(data[ENTRIES_KEY], null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'backup.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function restoreData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data) || data.some((entry) => !entry || typeof entry !== 'object')) {
        throw new Error('Backup must contain an array of entries.');
      }
      await chrome.storage.local.set({ [ENTRIES_KEY]: data });
      alert('Data restored successfully.');
      location.reload();
    } catch (error) {
      alert(`Could not restore backup: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

document.getElementById('backup-data').addEventListener('click', backupData);
document.getElementById('restore-data').addEventListener('click', () => document.getElementById('restore-file').click());
document.getElementById('restore-file').addEventListener('change', restoreData);
document.getElementById('import-call-record').addEventListener('click', () => document.getElementById('call-record-file').click());

document.getElementById('call-record-file').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const record = JSON.parse(loadEvent.target.result);
      if (record?.format !== 'sales-call-record-v1'
        || typeof record.name !== 'string'
        || !['Yes', 'No'].includes(record.phonePickedUp)
        || typeof record.callDateTime !== 'string') {
        throw new Error('This is not a valid call record export.');
      }
      setFormValue('fullName', record.name);
      setFormValue('phonePickedUp', record.phonePickedUp);
      setFormValue('callDateTime', record.callDateTime.slice(0, 16));
      setFormValue('callDuration', record.callDuration || '');
      conversationText.value = '';
      pendingCallRecords = [];
      renderCallChoices();
      updateConditionalFields();
      importStatus.textContent = 'Call metadata imported. Review before saving.';
      saveFormDraft();
    } catch (error) {
      importStatus.textContent = `Could not import call record: ${error.message}`;
    }
    event.target.value = '';
  };
  reader.readAsText(file);
});

async function persistEntries() {
  manualEntries = await popupStorage.saveEntries(logs, manualEntries);
}

function getTimeZoneDisplayName(timeZone) {
  const names = {
    'America/Denver': 'Mountain Time',
    'America/Los_Angeles': 'Pacific Time',
    'America/Chicago': 'Central Time',
    'America/New_York': 'Eastern Time',
    UTC: 'UTC'
  };
  return names[timeZone] || String(timeZone || '').replace(/_/g, ' ');
}

function getReportingTimeZone() {
  const select = document.getElementById('reporting-time-zone');
  return select?.value || DISPLAY_TIME_ZONE;
}

function getLocalDateValue(date = new Date(), timeZone = getReportingTimeZone()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce((values, part) => {
    values[part.type] = part.value;
    return values;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function setFormValue(name, value) {
  const field = document.querySelector(`[name="${name}"]`);
  if (field && value !== undefined) {
    field.value = value;
  }
}

function renderCallChoices() {
  callChoices.replaceChildren();
  if (pendingCallRecords.length < 2) {
    callChoices.style.display = 'none';
    return;
  }
  pendingCallRecords.forEach((record) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    const detail = document.createElement('div');
    const title = document.createElement('strong');
    const summary = document.createElement('span');
    checkbox.type = 'checkbox';
    checkbox.checked = record.selected;
    checkbox.dataset.callId = record.id;
    checkbox.addEventListener('change', () => {
      record.selected = checkbox.checked;
      const selectedCount = pendingCallRecords.filter((item) => item.selected).length;
      importStatus.textContent = `${selectedCount} call record${selectedCount === 1 ? '' : 's'} selected.`;
    });
    title.textContent = `Call ${pendingCallRecords.indexOf(record) + 1} - ${record.status}`;
    summary.textContent = `${formatDateTime(record.callDateTime)} | Duration: ${record.callDuration || '-'}`;
    detail.append(title, summary);
    label.className = 'call-choice';
    label.append(checkbox, detail);
    callChoices.appendChild(label);
  });
  callChoices.style.display = 'grid';
}

function limitTranscript(value) {
  if (value.length <= MAX_TRANSCRIPT_LENGTH) {
    return value;
  }
  importStatus.textContent = `Conversation was shortened to ${MAX_TRANSCRIPT_LENGTH.toLocaleString()} characters.`;
  return value.slice(0, MAX_TRANSCRIPT_LENGTH);
}

function durationToSeconds(value) {
  const match = String(value || '').match(/^(\d+):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

function getFormDraft() {
  const form = document.getElementById('manual-entry-form');
  return {
    ...Object.fromEntries(new FormData(form).entries()),
    conversationText: limitTranscript(conversationText.value),
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
    if (name === 'conversationText') {
      conversationText.value = value;
    } else if (name === 'editingEntry') {
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

function populateFromConversation() {
  const text = limitTranscript(conversationText.value.trim());
  conversationText.value = text;
  if (!text) {
    importStatus.textContent = 'Paste a conversation first.';
    return;
  }
  pendingCallRecords = extractCallRecords(text).map((record) => ({ ...record, selected: true }));
  renderCallChoices();
  const data = extractConversationData(text, {
    extractLeadName,
    getDateTimeParts,
    getMountainDateTimeValue,
    getLocalDateTimeValue
  });
  if (pendingCallRecords.length) {
    const firstCall = pendingCallRecords[0];
    data.phonePickedUp = firstCall.phonePickedUp;
    data.callDateTime = firstCall.callDateTime;
    data.callDuration = firstCall.callDuration;
  }
  Object.entries(data).forEach(([name, value]) => setFormValue(name, value));
  updateConditionalFields();
  const detected = Object.keys(data).length;
  const detectedFields = Object.keys(data).join(', ');
  const callMessage = pendingCallRecords.length > 1
    ? ` ${pendingCallRecords.length} call records found; choose which to save.`
    : '';
  importStatus.textContent = `Detected ${detected} field${detected === 1 ? '' : 's'}: ${detectedFields || 'none'}. Review before saving.${callMessage}`;
  saveFormDraft();
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
  const appointments = getUpcomingAppointments(manualEntries);
  renderQueueView(queue, appointments, {
    formatDate,
    formatDateTime,
    formatFollowUpWindow,
    normalizeFollowUpDateValue,
    onSaveFollowUp: async (entryId, value) => {
      const index = manualEntries.findIndex((entry) => entry.id === entryId);
      if (index < 0) return;
      manualEntries[index].followUpDate = normalizeFollowUpDateValue(value);
      manualEntries[index] = normalizeEntryStatus(manualEntries[index]);
      await persistEntries();
      renderAppointmentQueue();
      render();
    }
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
  dailyObjections.textContent = summary.objections;
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

function getDefaultAppointmentTimeZone() {
  const defaultSelect = document.getElementById('default-time-zone');
  return defaultSelect?.value || DISPLAY_TIME_ZONE;
}

function getEntryFormData(form) {
  const formData = new FormData(form);
  const appointmentDate = formData.get('appointmentDate');
  const appointmentTimeZone = formData.get('appointmentTimeZone') || getDefaultAppointmentTimeZone();
  const followUpDate = formData.get('followUpDate');
  const wasSet = formData.get('wasSet');
  const phonePickedUp = formData.get('phonePickedUp');
  const normalizedStatus = wasSet === 'Yes' || appointmentDate
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
    leaveReason: formData.get('leaveReason'),
    disqualified: formData.get('disqualified'),
    disqualificationReason: formData.get('disqualificationReason').trim(),
    pitched: formData.get('pitched'),
    wasSet,
    closer: formData.get('closer').trim(),
    appointmentDate: appointmentDate ? zonedDateTimeToDate(appointmentDate, appointmentTimeZone).toISOString() : '',
    followUpDate: followUpDate || '',
    appointmentTimeZone,
    status: normalizedStatus,
    notes: formData.get('notes').trim(),
    conversationText: limitTranscript(conversationText.value.trim())
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
  Object.entries(values).forEach(([name, value]) => {
    if (['entryType', 'sourceType', 'sourceIndex', 'recordType', 'createdAt', 'timestamp'].includes(name)) {
      return;
    }
    setFormValue(name, value);
  });
  conversationText.value = entry.conversationText || '';
  updateConditionalFields();
  saveEntryButton.textContent = 'Save changes';
  clearFormButton.hidden = true;
  cancelEditButton.hidden = false;
  importStatus.textContent = 'Editing entry.';
  document.getElementById('manual-entry-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  saveFormDraft();
}

function syncDefaultAppointmentTimeZone() {
  const defaultSelect = document.getElementById('default-time-zone');
  const appointmentTimeZone = document.querySelector('[name="appointmentTimeZone"]');
  if (defaultSelect && !defaultSelect.value) {
    defaultSelect.value = DISPLAY_TIME_ZONE;
  }
  if (appointmentTimeZone && !appointmentTimeZone.value) {
    appointmentTimeZone.value = defaultSelect?.value || DISPLAY_TIME_ZONE;
  }
}

function resetEntryForm() {
  editingEntry = null;
  pendingCallRecords = [];
  renderCallChoices();
  document.getElementById('manual-entry-form').reset();
  syncDefaultAppointmentTimeZone();
  conversationText.value = '';
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
  const selectedCallRecords = pendingCallRecords.filter((record) => record.selected);
  if (!editingEntry && pendingCallRecords.length > 1 && !selectedCallRecords.length) {
    importStatus.textContent = 'Select at least one call record to save.';
    return;
  }
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
    const recordsToSave = selectedCallRecords.length ? selectedCallRecords : [null];
    recordsToSave.forEach((record) => {
      const resolvedStatus = entry.wasSet === 'Yes'
        ? 'Booked'
        : record
          ? (record.phonePickedUp === 'Yes' ? 'Picked Up' : 'No Answer')
          : (entry.phonePickedUp === 'Yes' ? 'Picked Up' : entry.phonePickedUp === 'No' ? 'No Answer' : '');
      manualEntries.push({
        ...entry,
        ...(record ? {
          phonePickedUp: record.phonePickedUp,
          callDateTime: record.callDateTime,
          callDuration: record.callDuration,
          status: resolvedStatus
        } : { status: resolvedStatus }),
        id: createEntryId(),
        createdAt: new Date().toISOString()
      });
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
  });
  updateConversationOutcomeVisibility();
}

async function loadDefaultAppointmentTimeZone() {
  const stored = await chrome.storage.local.get({
    [DEFAULT_TIME_ZONE_KEY]: DISPLAY_TIME_ZONE,
    [REPORTING_TIME_ZONE_KEY]: DISPLAY_TIME_ZONE
  });
  const defaultValue = stored[DEFAULT_TIME_ZONE_KEY] || DISPLAY_TIME_ZONE;
  const reportingValue = stored[REPORTING_TIME_ZONE_KEY] || DISPLAY_TIME_ZONE;
  const defaultSelect = document.getElementById('default-time-zone');
  const reportingSelect = document.getElementById('reporting-time-zone');
  const appointmentTimeZone = document.querySelector('[name="appointmentTimeZone"]');
  if (defaultSelect) {
    defaultSelect.value = defaultValue;
  }
  if (reportingSelect) {
    reportingSelect.value = reportingValue;
  }
  if (appointmentTimeZone && !appointmentTimeZone.value) {
    appointmentTimeZone.value = defaultValue;
  }
}

function updateConversationOutcomeVisibility() {
  const outcome = document.getElementById('conversation-outcome');
  const phonePickedUp = document.getElementById('phone-picked-up').value;
  const disqualified = document.getElementById('disqualified').value;
  const pitched = document.getElementById('pitched').value;
  const wasSet = document.getElementById('was-set').value;
  const reachedBadOutcome = disqualified !== 'Yes' && (pitched === 'No' || wasSet === 'No');
  outcome.style.display = phonePickedUp === 'Yes' && reachedBadOutcome ? 'grid' : 'none';
  document.querySelector('[name="leaveReason"]').required = outcome.style.display === 'grid';
  document.querySelector('[name="closer"]').required = wasSet === 'Yes';
  document.querySelector('[name="appointmentDate"]').required = wasSet === 'Yes';
  document.querySelector('[name="appointmentTimeZone"]').required = wasSet === 'Yes';
}

function getLocalDateTimeValue(date = new Date()) {
  return getMountainDateTimeValue(date);
}

function updateCallDateTime() {
  const callDateTime = document.querySelector('[name="callDateTime"]');
  if (!callDateTime.value) {
    callDateTime.value = getLocalDateTimeValue();
  }
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
document.getElementById('analyze-conversation').addEventListener('click', populateFromConversation);
clearFormButton.addEventListener('click', async () => {
  await popupStorage.clearDraft();
  resetEntryForm();
});
cancelEditButton.addEventListener('click', async () => {
  await popupStorage.clearDraft();
  resetEntryForm();
});
document.getElementById('manual-entry-form').addEventListener('input', saveFormDraft);
conversationText.addEventListener('input', saveFormDraft);
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

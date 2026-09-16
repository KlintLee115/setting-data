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
const DRAFT_KEY = 'conversationDraft';
const PENDING_LEAD_KEY = 'pendingLead';
const IMPORT_SEED_KEY = 'importedNoShowSeeded';
const ENTRIES_KEY = 'entries';
const DISPLAY_TIME_ZONE = 'America/Denver';
const MAX_TRANSCRIPT_LENGTH = 100000;

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

function getUnifiedEntries() {
  return [
    ...logs.map((entry) => ({ ...entry, recordType: 'call' })),
    ...manualEntries.map((entry) => ({ ...entry, recordType: 'entry' }))
  ];
}

async function persistEntries() {
  await chrome.storage.local.set({
    [ENTRIES_KEY]: getUnifiedEntries(),
    callLogs: logs,
    manualEntries
  });
}

function getLocalDateValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DISPLAY_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce((values, part) => {
    values[part.type] = part.value;
    return values;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const importedNoShow = {
  id: 'omodele-francis-2026-09-12-no-show',
  appointmentDate: '2026-09-12T20:00',
  fullName: 'Omodele Francis',
  email: '',
  phone: '',
  phonePickedUp: '',
  callDateTime: '',
  callDuration: '',
  lastTextMessage: '',
  leaveReason: '',
  disqualified: '',
  disqualificationReason: '',
  pitched: '',
  wasSet: 'Yes',
  closer: 'Alicia Lyttle',
  status: 'No-show',
  notes: '',
  createdAt: '2026-09-12T20:00:00-04:00'
};

function setFormValue(name, value) {
  const field = document.querySelector(`[name="${name}"]`);
  if (field && value !== undefined) {
    field.value = value;
  }
}

function getTodayAtTime(timeText) {
  const match = timeText.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!match) {
    return '';
  }
  const date = new Date();
  let hours = Number(match[1]);
  if (match[3].toUpperCase() === 'PM' && hours !== 12) hours += 12;
  if (match[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
  date.setHours(hours, Number(match[2]), 0, 0);
  return getLocalDateTimeValue(date);
}

function extractCallDuration(text) {
  const match = text.match(/(?:call completed[\s\S]{0,120}?)?(\d{1,2}:\d{2})\s*\/\s*(\d{1,2}:\d{2})/i);
  return match ? match[2] : '';
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
  await chrome.storage.local.set({ [DRAFT_KEY]: getFormDraft() });
}

async function restoreFormDraft() {
  const stored = await chrome.storage.local.get({ [DRAFT_KEY]: null });
  const draft = stored[DRAFT_KEY];
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
  const stored = await chrome.storage.local.get({ [PENDING_LEAD_KEY]: null });
  const pendingLead = stored[PENDING_LEAD_KEY];
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

function extractConversationData(text) {
  const data = {};
  const firstLineName = typeof extractLeadName === 'function' ? extractLeadName(text) : '';
  const nameMatch = text.match(/(?:hi|hey|hello)\s+([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+){1,3})[,!]/i);
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const phoneMatch = text.match(/(?:\+?\d[\d().\s-]{7,}\d)/);
  const appointmentMatch = text.match(/(?:appointment|meeting)[^\n]*?(?:at\s+)?(?:Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)?[,]?\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})[^\n]*?(\d{1,2}:\d{2}\s*[AP]M)/i);

  if (firstLineName) data.fullName = firstLineName;
  else if (nameMatch) data.fullName = nameMatch[1].trim();
  if (emailMatch) data.email = emailMatch[0];
  if (phoneMatch) data.phone = phoneMatch[0].replace(/\s+/g, ' ').trim();
  if (appointmentMatch) {
    const parsed = new Date(`${appointmentMatch[1]} ${appointmentMatch[2]}`);
    if (!Number.isNaN(parsed.getTime())) data.appointmentDate = getLocalDateTimeValue(parsed);
  }
  if (/no[- ]?show/i.test(text)) data.status = 'No-show';
  const completedCallMatch = text.match(/call completed[\s\S]{0,120}?(\d{1,2}:\d{2}\s*[AP]M)/i);
  const callDuration = extractCallDuration(text);
  if (callDuration) data.callDuration = callDuration;
  if (/\b(picked up|call completed|spoke with|connected with)\b/i.test(text)) {
    data.phonePickedUp = 'Yes';
    data.callDateTime = completedCallMatch ? getTodayAtTime(completedCallMatch[1]) : getLocalDateTimeValue();
  } else if (/\b(no answer|did not answer|didn't answer|no response|left a voicemail)\b/i.test(text)) {
    data.phonePickedUp = 'No';
    data.callDateTime = getLocalDateTimeValue();
  }
  const leftCall = /\b(left|had to leave|got off)\b[^.\n]{0,80}\b(call|conversation)\b/i.test(text)
    || /\b(call|conversation)\b[^.\n]{0,80}\b(left|had to leave|got off)\b/i.test(text);
  if (leftCall) {
    data.disqualified = data.disqualified || 'No';
    data.pitched = data.pitched || 'No';
    if (/\b(objection|concern|hesitant|too expensive|can't afford|cannot afford)\b/i.test(text)) data.leaveReason = 'Objection';
    else if (/\b(had to go|have to go|needed to go|gotta go|has to go|leave for)\b/i.test(text)) data.leaveReason = 'Had to go';
  }
  if (/\b(disqualified|not qualified|does not qualify)\b/i.test(text)) data.disqualified = 'Yes';
  else if (/\b(qualified|qualifies)\b/i.test(text)) data.disqualified = 'No';
  if (/\b(pitched|presented|went through the offer|explained the program)\b/i.test(text)) data.pitched = 'Yes';
  if (appointmentMatch || /\b(booked|scheduled|set the appointment)\b/i.test(text)) {
    data.disqualified = data.disqualified || 'No';
    data.pitched = data.pitched || 'Yes';
    data.wasSet = 'Yes';
  }
  if (data.wasSet === 'Yes') {
    const closerMatch = text.match(/(?:closer|with)\s+([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+){1,2})/i);
    if (closerMatch) data.closer = closerMatch[1].trim();
  }
  return data;
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
  const data = extractConversationData(text);
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
  const date = new Date(timestamp);
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: DISPLAY_TIME_ZONE
  }).format(new Date(timestamp));
}

function formatDateTime(timestamp) {
  if (!timestamp) {
    return '-';
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: DISPLAY_TIME_ZONE
  }).format(new Date(timestamp));
}

function isVisible(timestamp) {
  return dateFilter.value === 'all' || isToday(timestamp);
}

function getStatusClass(status) {
  return ['Picked Up', 'Showed'].includes(status) ? 'picked-up' : 'no-answer';
}

function getHourlyCallTime(entry) {
  const timestamp = entry.callDateTime || entry.pickupDateTime || entry.createdAt;
  return new Date(timestamp);
}

function getMountainHour(date) {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: DISPLAY_TIME_ZONE,
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

function renderPickupSummary() {
  const hours = Array.from({ length: 17 }, (_, index) => index + 5);
  const entries = getDailyEntries().filter((entry) => entry.entryType === 'Call'
    || ['Yes', 'No'].includes(entry.phonePickedUp));

  pickupSummaryBody.replaceChildren();
  hours.forEach((hour) => {
    const hourlyEntries = entries.filter((entry) => getMountainHour(getHourlyCallTime(entry)) === hour);
    const pickedUp = hourlyEntries.filter((entry) => entry.entryType === 'Call'
      ? entry.status === 'Picked Up'
      : entry.phonePickedUp === 'Yes').length;
    const total = hourlyEntries.length;
    const rate = total ? `${((pickedUp / total) * 100).toFixed(2)}%` : '-';
    const row = document.createElement('tr');
    const timeCell = document.createElement('td');
    const totalCell = document.createElement('td');
    const pickedUpCell = document.createElement('td');
    const rateCell = document.createElement('td');
    timeCell.textContent = `${formatHour(hour)} - ${formatHour(hour + 1)}`;
    totalCell.textContent = total;
    pickedUpCell.textContent = pickedUp;
    rateCell.className = 'rate';
    rateCell.textContent = rate;
    row.append(timeCell, totalCell, pickedUpCell, rateCell);
    pickupSummaryBody.appendChild(row);
  });

  dailyCalls.textContent = entries.length;
  dailyPickups.textContent = entries.filter((entry) => entry.entryType === 'Call'
    ? entry.status === 'Picked Up'
    : entry.phonePickedUp === 'Yes').length;
  dailyDisqualified.textContent = getDailyEntries().filter((entry) => entry.disqualified === 'Yes').length;
  dailyPitches.textContent = getDailyEntries().filter((entry) => entry.pitched === 'Yes').length;
  dailyAppointments.textContent = getDailyEntries().filter((entry) => entry.wasSet === 'Yes').length;
  dailyNoAnswers.textContent = entries.filter((entry) => entry.entryType === 'Call'
    ? entry.status === 'No Answer'
    : entry.phonePickedUp === 'No').length;
  dailyObjections.textContent = getDailyEntries().filter((entry) => entry.leaveReason === 'Objection').length;
  dailyHadToGo.textContent = getDailyEntries().filter((entry) => entry.leaveReason === 'Had to go').length;
  const pitchedEntries = getDailyEntries().filter((entry) => entry.disqualified === 'No');
  const pitchedCount = pitchedEntries.filter((entry) => entry.pitched === 'Yes').length;
  const setCount = pitchedEntries.filter((entry) => entry.wasSet === 'Yes').length;
  dailyPitchRate.textContent = pitchedEntries.length ? `${((pitchedCount / pitchedEntries.length) * 100).toFixed(1)}%` : '-';
  dailySetRate.textContent = pitchedEntries.length ? `${((setCount / pitchedEntries.length) * 100).toFixed(1)}%` : '-';
  const durations = getDailyEntries().map((entry) => durationToSeconds(entry.callDuration)).filter(Boolean);
  const averageDuration = durations.length
    ? Math.round(durations.reduce((total, duration) => total + duration, 0) / durations.length)
    : 0;
  dailyAverageDuration.textContent = averageDuration
    ? `${Math.floor(averageDuration / 60)}:${String(averageDuration % 60).padStart(2, '0')}`
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
  logBody.replaceChildren();

  if (!visibleEntries.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.className = 'empty';
    cell.colSpan = 4;
    cell.textContent = 'No entries yet';
    row.appendChild(cell);
    logBody.appendChild(row);
    return;
  }

  visibleEntries.forEach((entry) => {
    const row = document.createElement('tr');
    const dateCell = document.createElement('td');
    const nameCell = document.createElement('td');
    const statusCell = document.createElement('td');
    const actionsCell = document.createElement('td');

    const dateStack = document.createElement('div');
    const nameStack = document.createElement('div');
    const detailsStack = document.createElement('div');
    const dateMain = document.createElement('span');
    const nameMain = document.createElement('span');
    const nameSub = document.createElement('span');
    const detailsMain = document.createElement('span');
    const detailsSub = document.createElement('span');

    dateStack.className = nameStack.className = detailsStack.className = 'cell-stack';
    dateMain.className = 'cell-main';
    nameMain.className = 'cell-main';
    detailsMain.className = entry.entryType === 'Call' || entry.status
      ? `status ${getStatusClass(entry.status)}`
      : 'cell-main';
    nameSub.className = detailsSub.className = 'cell-sub';
    dateMain.textContent = formatDate(getEntryDateTime(entry));
    nameMain.textContent = entry.entryType === 'Call' ? entry.name : entry.fullName;
    nameSub.textContent = entry.entryType === 'Call' ? '' : [entry.email, entry.phone].filter(Boolean).join(' | ');
    detailsMain.textContent = entry.entryType === 'Call' ? entry.status : entry.status;
    detailsSub.textContent = entry.entryType === 'Call'
      ? `Call: ${formatDateTime(entry.callDateTime || entry.pickupDateTime || entry.timestamp)} | Picked up: ${entry.phonePickedUp || '-'} | Duration: ${entry.callDuration || '-'}`
      : `Call: ${formatDateTime(entry.callDateTime)} | Last text: ${entry.lastTextMessage || '-'} | Appt: ${formatDateTime(entry.appointmentDate)} | Closer: ${entry.closer || '-'} | Duration: ${entry.callDuration || '-'}${entry.leaveReason ? ` | Leave reason: ${entry.leaveReason}` : ''} | Disqualified: ${entry.disqualified || '-'} | Pitched: ${entry.pitched || '-'} | Set: ${entry.wasSet || '-'}`;
    dateStack.appendChild(dateMain);
    nameStack.append(nameMain, nameSub);
    detailsStack.append(detailsMain, detailsSub);
    dateCell.appendChild(dateStack);
    nameCell.appendChild(nameStack);
    statusCell.appendChild(detailsStack);
    const actions = document.createElement('div');
    const editButton = document.createElement('button');
    const deleteButton = document.createElement('button');
    actions.className = 'row-actions';
    editButton.type = deleteButton.type = 'button';
    editButton.textContent = 'Edit';
    deleteButton.textContent = 'Delete';
    deleteButton.className = 'delete';
    editButton.title = 'Edit entry';
    deleteButton.title = 'Delete entry';
    editButton.addEventListener('click', () => startEditing(entry));
    deleteButton.addEventListener('click', () => deleteEntry(entry));
    actions.append(editButton, deleteButton);
    actionsCell.appendChild(actions);
    row.append(dateCell, nameCell, statusCell, actionsCell);
    logBody.appendChild(row);
  });
}

async function loadLogs() {
  const stored = await chrome.storage.local.get({
    callLogs: [],
    manualEntries: [],
    [ENTRIES_KEY]: null,
    [IMPORT_SEED_KEY]: false
  });
  if (Array.isArray(stored[ENTRIES_KEY])) {
    logs = stored[ENTRIES_KEY].filter((entry) => entry.recordType === 'call');
    manualEntries = stored[ENTRIES_KEY].filter((entry) => entry.recordType !== 'call');
  } else {
    logs = Array.isArray(stored.callLogs) ? stored.callLogs : [];
    manualEntries = Array.isArray(stored.manualEntries) ? stored.manualEntries : [];
  }
  logs = logs.map((entry) => ({ ...entry, id: entry.id || createEntryId() }));
  manualEntries = manualEntries.map((entry) => ({ ...entry, id: entry.id || createEntryId() }));
  if (!stored[IMPORT_SEED_KEY]) {
    if (!manualEntries.some((entry) => entry.id === importedNoShow.id)) {
      manualEntries.push(importedNoShow);
    }
    await chrome.storage.local.set({ [IMPORT_SEED_KEY]: true });
  }
  await persistEntries();
  render();
  renderPickupSummary();
}

function getEntryFormData(form) {
  const formData = new FormData(form);
  return {
    fullName: formData.get('fullName').trim(),
    email: formData.get('email').trim(),
    phone: formData.get('phone').trim(),
    phonePickedUp: formData.get('phonePickedUp'),
    callDateTime: formData.get('callDateTime'),
    callDuration: formData.get('callDuration'),
    lastTextMessage: formData.get('lastTextMessage').trim(),
    leaveReason: formData.get('leaveReason'),
    disqualified: formData.get('disqualified'),
    disqualificationReason: formData.get('disqualificationReason').trim(),
    pitched: formData.get('pitched'),
    wasSet: formData.get('wasSet'),
    closer: formData.get('closer').trim(),
    appointmentDate: formData.get('appointmentDate'),
    status: formData.get('wasSet') === 'Yes' ? 'Booked' : '',
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
  return new Date(timestamp);
}

function getEntryDateTime(entry) {
  return entry.callDateTime || entry.pickupDateTime || entry.timestamp || entry.createdAt;
}

function getEntrySortValue(entry, key) {
  if (key === 'date') return new Date(getEntryDateTime(entry)).getTime();
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
    : entry;
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

function resetEntryForm() {
  editingEntry = null;
  pendingCallRecords = [];
  renderCallChoices();
  document.getElementById('manual-entry-form').reset();
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
      manualEntries.push({
        ...entry,
        ...(record ? {
          phonePickedUp: record.phonePickedUp,
          callDateTime: record.callDateTime,
          callDuration: record.callDuration,
          status: record.phonePickedUp === 'Yes' ? 'Picked Up' : 'No Answer'
        } : {}),
        id: createEntryId(),
        createdAt: new Date().toISOString()
      });
    });
    await persistEntries();
  }
  await chrome.storage.local.remove(DRAFT_KEY);
  resetEntryForm();
  render();
  renderPickupSummary();
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
}

function getLocalDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function updateCallDateTime() {
  const callDateTime = document.querySelector('[name="callDateTime"]');
  if (!callDateTime.value) {
    callDateTime.value = getLocalDateTimeValue();
  }
}

document.querySelectorAll('#manual-entry-form select').forEach((select) => {
  select.addEventListener('change', () => {
    updateConditionalFields();
    saveFormDraft();
  });
});
document.getElementById('analyze-conversation').addEventListener('click', populateFromConversation);
clearFormButton.addEventListener('click', async () => {
  await chrome.storage.local.remove(DRAFT_KEY);
  resetEntryForm();
});
cancelEditButton.addEventListener('click', async () => {
  await chrome.storage.local.remove(DRAFT_KEY);
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
restoreFormDraft().then(restorePendingLead).then(loadLogs);

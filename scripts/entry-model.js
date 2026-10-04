const BOOKED_STATUS = 'Booked';
const PICKED_UP_STATUS = 'Picked Up';
const NO_ANSWER_STATUS = 'No Answer';

function normalizeEntryStatus(entry) {
  if (!entry || typeof entry !== 'object') {
    return entry;
  }
  if (entry.recordType === 'dm') {
    return { ...entry, status: entry.dmOutcome || entry.status || 'Sent' };
  }
  if (entry.pitched === 'High Ticket' || entry.wasSet === 'Yes' || entry.appointmentDate) {
    return { ...entry, status: BOOKED_STATUS };
  }
  if (entry.phonePickedUp === 'Yes') {
    return { ...entry, status: PICKED_UP_STATUS };
  }
  if (entry.phonePickedUp === 'No') {
    return { ...entry, status: NO_ANSWER_STATUS };
  }
  return { ...entry, status: entry.status || '' };
}

function toCallEntry(entry) {
  return { ...entry, recordType: 'call' };
}

function toManualEntry(entry) {
  const normalized = normalizeEntryStatus(entry);
  return { ...normalized, recordType: normalized.recordType === 'dm' ? 'dm' : 'entry' };
}

function combineEntries(logs, manualEntries) {
  return [
    ...logs.map(toCallEntry),
    ...manualEntries.map(toManualEntry)
  ];
}

function searchEntriesByName(entries, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return entries;
  }
  return entries.filter((entry) => String(entry.name || entry.fullName || '').toLowerCase().includes(normalizedQuery));
}

if (typeof module !== 'undefined') {
  module.exports = {
    BOOKED_STATUS,
    NO_ANSWER_STATUS,
    PICKED_UP_STATUS,
    combineEntries,
    normalizeEntryStatus,
    searchEntriesByName,
    toCallEntry,
    toManualEntry
  };
}

function parseStoredDateTime(value) {
  if (!value) return new Date(NaN);
  return new Date(value);
}

function formatDateTimeInput(value) {
  const date = parseStoredDateTime(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getLocalDateTimeValue(date = new Date()) {
  return formatDateTimeInput(date.toISOString());
}

function localDateTimeToDate(value) {
  return new Date(value);
}

if (typeof module !== 'undefined') {
  module.exports = {
    formatDateTimeInput,
    getLocalDateTimeValue,
    localDateTimeToDate,
    parseStoredDateTime,
  };
}

const DISPLAY_TIME_ZONE = 'America/Denver';

function getDateTimeParts(date, timeZone = DISPLAY_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).reduce((values, part) => {
    values[part.type] = part.value;
    return values;
  }, {});
}

function getTimeZoneOffsetMilliseconds(date, timeZone) {
  const parts = getDateTimeParts(date, timeZone);
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - date.getTime();
}

function zonedDateTimeToDate(value, timeZone) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return new Date(value);
  const wallClockUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  let timestamp = wallClockUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    timestamp = wallClockUtc - getTimeZoneOffsetMilliseconds(new Date(timestamp), timeZone);
  }
  return new Date(timestamp);
}

function parseStoredDateTime(value) {
  if (!value) return new Date(NaN);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)
    ? zonedDateTimeToDate(value, DISPLAY_TIME_ZONE)
    : new Date(value);
}

function formatDateTimeInput(value, timeZone = DISPLAY_TIME_ZONE) {
  const date = parseStoredDateTime(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = getDateTimeParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function getMountainDateTimeValue(date = new Date()) {
  return formatDateTimeInput(date);
}

if (typeof module !== 'undefined') {
  module.exports = {
    DISPLAY_TIME_ZONE,
    formatDateTimeInput,
    getDateTimeParts,
    getMountainDateTimeValue,
    parseStoredDateTime,
    zonedDateTimeToDate
  };
}

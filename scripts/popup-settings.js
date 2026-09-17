(() => {
const reportingTimeZoneKey = 'reportingTimeZone';
const defaultTimeZoneKey = 'defaultAppointmentTimeZone';

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

function getDefaultAppointmentTimeZone() {
  const defaultSelect = document.getElementById('default-time-zone');
  return defaultSelect?.value || DISPLAY_TIME_ZONE;
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

async function loadDefaultAppointmentTimeZone() {
  const stored = await chrome.storage.local.get({
    [defaultTimeZoneKey]: DISPLAY_TIME_ZONE,
    [reportingTimeZoneKey]: DISPLAY_TIME_ZONE
  });
  const defaultValue = stored[defaultTimeZoneKey] || DISPLAY_TIME_ZONE;
  const reportingValue = stored[reportingTimeZoneKey] || DISPLAY_TIME_ZONE;
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

const popupSettings = {
  DEFAULT_TIME_ZONE_KEY: defaultTimeZoneKey,
  REPORTING_TIME_ZONE_KEY: reportingTimeZoneKey,
  getDefaultAppointmentTimeZone,
  getLocalDateTimeValue,
  getLocalDateValue,
  getReportingTimeZone,
  getTimeZoneDisplayName,
  loadDefaultAppointmentTimeZone,
  syncDefaultAppointmentTimeZone,
  updateCallDateTime
};

globalThis.popupSettings = popupSettings;

if (typeof module !== 'undefined') {
  module.exports = popupSettings;
}
})();

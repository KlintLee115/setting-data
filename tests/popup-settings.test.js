const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { getMountainDateTimeValue } = require('../scripts/timezone');

global.DISPLAY_TIME_ZONE = 'America/Denver';
global.getMountainDateTimeValue = getMountainDateTimeValue;
global.document = {
  getElementById(id) {
    return this.elements[id] || null;
  },
  querySelector(selector) {
    return this.fields[selector] || null;
  },
  elements: {},
  fields: {}
};

const {
  getDefaultAppointmentTimeZone,
  getLocalDateValue,
  getReportingTimeZone,
  getTimeZoneDisplayName,
  syncDefaultAppointmentTimeZone
} = require('../scripts/popup-settings');

test('formats known and custom timezone names', () => {
  assert.equal(getTimeZoneDisplayName('America/Denver'), 'Mountain Time');
  assert.equal(getTimeZoneDisplayName('Europe/London'), 'Europe/London');
  assert.equal(getTimeZoneDisplayName('America/Los_Angeles'), 'Pacific Time');
});

test('uses selected timezone values and Mountain Time fallbacks', () => {
  document.elements['reporting-time-zone'] = { value: 'America/New_York' };
  document.elements['default-time-zone'] = { value: '' };

  assert.equal(getReportingTimeZone(), 'America/New_York');
  assert.equal(getDefaultAppointmentTimeZone(), 'America/Denver');
});

test('formats a date using the reporting timezone', () => {
  document.elements['reporting-time-zone'] = { value: 'America/New_York' };

  assert.equal(
    getLocalDateValue(new Date('2026-09-17T02:00:00.000Z')),
    '2026-09-16'
  );
});

test('syncs the default appointment timezone into the form', () => {
  const defaultSelect = { value: '' };
  const appointmentTimeZone = { value: '' };
  document.elements['default-time-zone'] = defaultSelect;
  document.fields['[name="appointmentTimeZone"]'] = appointmentTimeZone;

  syncDefaultAppointmentTimeZone();

  assert.equal(defaultSelect.value, 'America/Denver');
  assert.equal(appointmentTimeZone.value, 'America/Denver');
});

test('can load the settings script more than once without global redeclarations', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'popup-settings.js'), 'utf8');
  const context = vm.createContext({
    DISPLAY_TIME_ZONE: 'America/Denver',
    getMountainDateTimeValue,
    Intl
  });

  vm.runInContext(source, context);
  vm.runInContext(source, context);

  assert.equal(typeof context.popupSettings.getDefaultAppointmentTimeZone, 'function');
});

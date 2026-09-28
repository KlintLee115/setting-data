const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { getLocalDateTimeValue } = require('../scripts/timezone');
global.getLocalDateTimeValue = getLocalDateTimeValue;
global.document = {
  querySelector(selector) {
    return this.fields[selector] || null;
  },
  fields: {}
};

const { getLocalDateValue, updateCallDateTime } = require('../scripts/popup-settings');

test('formats a date using the machine local calendar date', () => {
  const date = new Date('2026-09-17T02:00:00.000Z');
  const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  assert.equal(getLocalDateValue(date), expected);
});

test('fills the call date field with machine-local time', () => {
  const callDateTime = { value: '' };
  document.fields['[name="callDateTime"]'] = callDateTime;
  const before = new Date();

  updateCallDateTime();

  const enteredTime = new Date(callDateTime.value).getTime();
  const earliestMinute = Math.floor(before.getTime() / 60000) * 60000;
  const latestMinute = Math.floor(Date.now() / 60000) * 60000;
  assert.ok(enteredTime >= earliestMinute && enteredTime <= latestMinute);
});

test('can load the settings script more than once without global redeclarations', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'popup-settings.js'), 'utf8');
  const context = vm.createContext({
    getLocalDateTimeValue,
    Date
  });

  vm.runInContext(source, context);
  vm.runInContext(source, context);

  assert.equal(typeof context.popupSettings.getLocalDateValue, 'function');
});

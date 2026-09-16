const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { extractLeadName } = require('./conversation-parser');

function sample(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

test('extracts Jamie Brooks from the first transcript line', () => {
  assert.equal(extractLeadName(sample('sample3.txt')), 'Jamie Brooks');
});

test('extracts David Thomas from the first transcript line', () => {
  assert.equal(extractLeadName(sample('sample2-2-calls.txt')), 'David Thomas');
});

test('extracts Nancy Mikhaiel from the first transcript line', () => {
  assert.equal(extractLeadName(sample('sample1.txt')), 'Nancy Mikhaiel');
});

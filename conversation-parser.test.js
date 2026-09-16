const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { extractCallRecords } = require('./conversation-parser');

function sample(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

test('sample 1 produces one KL call record', () => {
  const records = extractCallRecords(sample('sample1.txt'));

  assert.equal(records.length, 1);
  assert.equal(records[0].callDuration, '0:25');
  assert.equal(records[0].phonePickedUp, 'No');
});

test('sample 3 produces one KL call record', () => {
  const records = extractCallRecords(sample('sample3.txt'));

  assert.equal(records.length, 1);
  assert.equal(records[0].callDuration, '0:15');
  assert.equal(records[0].phonePickedUp, 'No');
});

test('sample 2 preserves every KL call record for review', () => {
  const records = extractCallRecords(sample('sample2-2-calls.txt'));

  assert.deepEqual(records.map((record) => record.callDuration), ['0:47', '0:51', '0:53', '8:10']);
  assert.equal(records.every((record) => record.id), true);
});

test('selected records can be reduced to any save set', () => {
  const records = extractCallRecords(sample('sample2-2-calls.txt'));
  const selected = records.filter((record) => ['call-1', 'call-4'].includes(record.id));

  assert.deepEqual(selected.map((record) => record.callDuration), ['0:47', '8:10']);
});

test('prefers the timestamp on the call completion block over earlier message timestamps', () => {
  const transcript = `Opportunity Daphne Walker created in AI Business Summit 2026 - April

Alicia Lyttle
Hey Daphne, Welcome to the VIP club - you've officially unlocked upgraded access to the AI Business Summit! 08:27 AM

KL
Call completed
0:00 / 0:49
1x
10:36 AM`;

  const records = extractCallRecords(transcript);

  assert.equal(records.length, 1);
  assert.match(records[0].callDateTime, /10:36/);
  assert.equal(records[0].phonePickedUp, 'Yes');
});

test('treats a follow-up KL text after call completion as a missed call', () => {
  const transcript = `Opportunity Daphne Walker moved from Free- General → Purchase: VIP in AI Business Summit 2026 - April

KL
Call completed
0:00 / 0:49
1x

10:36 AM
KL
Hey Daphne, Klint here from Alicia's team (not AI, I promise 😂)
Saw you recently registefred for our AI Business and even upgraded to VIP! Just to see if I can help u get more out of it
Are you looking to implement AI with your current biz or are you just starting out with AI biz?`;

  const records = extractCallRecords(transcript);

  assert.equal(records.length, 1);
  assert.match(records[0].callDateTime, /10:36/);
  assert.equal(records[0].phonePickedUp, 'No');
  assert.equal(records[0].status, 'No Answer');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPopupStorage } = require('../scripts/popup-storage');
const { combineEntries, toManualEntry } = require('../scripts/entry-model');

global.combineEntries = combineEntries;
global.toManualEntry = toManualEntry;

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    async get(defaults) {
      return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, data[key] ?? value]));
    },
    async set(values) {
      Object.assign(data, values);
    },
    async remove(key) {
      delete data[key];
    },
    data
  };
}

test('loads the canonical entries format', async () => {
  const storage = fakeStorage({ entries: [
    { id: 'call', recordType: 'call', contactHistory: 'First touch', hasContactedBefore: true, hasShownIntentBefore: 'Yes', shownIntent: 'Old value', talkToListenRatio: '70/30' },
    { id: 'manual', recordType: 'entry', phonePickedUp: 'No', contactHistory: 'Contacted before', 'has contacted before': true }
  ] });
  const result = await createPopupStorage(storage).loadEntries();

  assert.equal(result.logs[0].id, 'call');
  assert.equal(result.manualEntries[0].id, 'manual');
  assert.equal(Object.hasOwn(result.logs[0], 'contactHistory'), false);
  assert.equal(Object.hasOwn(result.logs[0], 'hasContactedBefore'), false);
  assert.equal(Object.hasOwn(result.logs[0], 'hasShownIntentBefore'), false);
  assert.equal(Object.hasOwn(result.logs[0], 'shownIntent'), false);
  assert.equal(Object.hasOwn(result.logs[0], 'talkToListenRatio'), false);
  assert.equal(Object.hasOwn(result.manualEntries[0], 'contactHistory'), false);
  assert.equal(Object.hasOwn(result.manualEntries[0], 'has contacted before'), false);
});

test('loads legacy split storage and normalizes it when saved', async () => {
  const storage = fakeStorage({
    callLogs: [{ id: 'call' }],
    manualEntries: [{ id: 'manual', phonePickedUp: 'Yes' }]
  });
  const service = createPopupStorage(storage);
  const loaded = await service.loadEntries();
  await service.saveEntries(loaded.logs, loaded.manualEntries);

  assert.equal(storage.data.entries[1].status, 'Picked Up');
  assert.equal(storage.data.manualEntries[0].recordType, 'entry');
});

test('removes legacy contact history from canonical and mirrored storage when saved', async () => {
  const storage = fakeStorage();
  const service = createPopupStorage(storage);

  await service.saveEntries(
    [{ id: 'call', contactHistory: 'First touch', hasContactedBefore: true, hasShownIntentBefore: 'Yes', shownIntent: 'Old value' }],
    [{ id: 'manual', contactHistory: 'Contacted before', 'has contacted before': true }]
  );

  assert.equal(Object.hasOwn(storage.data.entries[0], 'contactHistory'), false);
  assert.equal(Object.hasOwn(storage.data.callLogs[0], 'contactHistory'), false);
  assert.equal(Object.hasOwn(storage.data.entries[0], 'hasContactedBefore'), false);
  assert.equal(Object.hasOwn(storage.data.entries[0], 'hasShownIntentBefore'), false);
  assert.equal(Object.hasOwn(storage.data.entries[0], 'shownIntent'), false);
  assert.equal(Object.hasOwn(storage.data.manualEntries[0], 'contactHistory'), false);
  assert.equal(Object.hasOwn(storage.data.entries[1], 'has contacted before'), false);
});

test('preserves DM record types in canonical storage and compatibility mirrors', async () => {
  const storage = fakeStorage();
  const service = createPopupStorage(storage);

  await service.saveEntries([], [{ id: 'dm', recordType: 'dm', dmOutcome: 'Sent' }]);

  assert.equal(storage.data.entries.length, 1);
  assert.equal(storage.data.entries[0].recordType, 'dm');
  assert.equal(storage.data.manualEntries[0].recordType, 'dm');
  assert.equal((await service.loadEntries()).manualEntries[0].recordType, 'dm');
});

test('saves and clears drafts through the storage adapter', async () => {
  const storage = fakeStorage();
  const service = createPopupStorage(storage);
  await service.saveDraft({ fullName: 'Jane Doe', hasShownIntentBefore: 'Yes', shownIntent: 'Old value' });
  assert.deepEqual(await service.loadDraft(), { fullName: 'Jane Doe' });
  await service.clearDraft();
  assert.equal(await service.loadDraft(), null);
});

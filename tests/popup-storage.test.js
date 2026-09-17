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
    { id: 'call', recordType: 'call' },
    { id: 'manual', recordType: 'entry', phonePickedUp: 'No' }
  ] });
  const result = await createPopupStorage(storage).loadEntries();

  assert.equal(result.logs[0].id, 'call');
  assert.equal(result.manualEntries[0].id, 'manual');
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

test('saves and clears drafts through the storage adapter', async () => {
  const storage = fakeStorage();
  const service = createPopupStorage(storage);
  await service.saveDraft({ fullName: 'Jane Doe' });
  assert.deepEqual(await service.loadDraft(), { fullName: 'Jane Doe' });
  await service.clearDraft();
  assert.equal(await service.loadDraft(), null);
});

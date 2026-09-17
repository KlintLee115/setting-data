(() => {
const ENTRIES_KEY = 'entries';

async function backupData() {
  const data = await chrome.storage.local.get(ENTRIES_KEY);
  const blob = new Blob([JSON.stringify(data[ENTRIES_KEY], null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'backup.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function restoreData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (loadEvent) => {
    try {
      const data = JSON.parse(loadEvent.target.result);
      if (!Array.isArray(data) || data.some((entry) => !entry || typeof entry !== 'object')) {
        throw new Error('Backup must contain an array of entries.');
      }
      await chrome.storage.local.set({ [ENTRIES_KEY]: data });
      alert('Data restored successfully.');
      location.reload();
    } catch (error) {
      alert(`Could not restore backup: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

function setupPopupDataTransfer({ importStatus, saveFormDraft, setFormValue, updateConditionalFields }) {
  document.getElementById('backup-data').addEventListener('click', backupData);
  document.getElementById('restore-data').addEventListener('click', () => document.getElementById('restore-file').click());
  document.getElementById('restore-file').addEventListener('change', restoreData);
  document.getElementById('import-call-record').addEventListener('click', () => document.getElementById('call-record-file').click());
  document.getElementById('call-record-file').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const record = JSON.parse(loadEvent.target.result);
        if (record?.format !== 'sales-call-record-v1'
          || typeof record.name !== 'string'
          || !['Yes', 'No'].includes(record.phonePickedUp)
          || typeof record.callDateTime !== 'string') {
          throw new Error('This is not a valid call record export.');
        }
        setFormValue('fullName', record.name);
        setFormValue('phonePickedUp', record.phonePickedUp);
        setFormValue('callDateTime', record.callDateTime.slice(0, 16));
        setFormValue('callDuration', record.callDuration || '');
        updateConditionalFields();
        importStatus.textContent = 'Call metadata imported. Review before saving.';
        saveFormDraft();
      } catch (error) {
        importStatus.textContent = `Could not import call record: ${error.message}`;
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  });
}

globalThis.setupPopupDataTransfer = setupPopupDataTransfer;
})();

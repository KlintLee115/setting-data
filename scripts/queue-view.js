function renderQueueView(queue, entries, options) {
  queue.replaceChildren();
  if (!entries.length) {
    queue.appendChild(createQueueEmptyState());
    return;
  }
  entries.forEach((entry) => queue.appendChild(createQueueItem(entry, options)));
}

function createQueueEmptyState() {
  const item = document.createElement('li');
  item.className = 'queue-item';
  item.append(
    createTextElement('div', 'queue-item-title', 'No to-dos'),
    createTextElement('div', 'queue-item-meta', 'Upcoming appointments and outstanding callbacks will appear here.')
  );
  return item;
}

function createQueueItem(entry, { formatDate, formatDateTime, onSaveNotes, onOpen, onCopyConfirmation, onDelete }) {
  const item = document.createElement('li');
  item.className = 'queue-item';
  const title = createTextElement('div', 'queue-item-title', entry.fullName || 'Unknown lead');
  const badge = createTextElement('span', 'queue-badge', entry.label);
  const rightSide = createTextElement('div', 'queue-item-head-right', '');
  rightSide.append(badge);
  const head = createTextElement('div', 'queue-item-head', '');
  head.append(title, rightSide);

  const detailLine = createMetaRow(entry.todoType === 'callback'
    ? [
      { text: 'Called:', className: 'queue-item-meta-label' },
      { text: formatDateTime(entry.callDateTime), className: 'queue-item-meta-value' },
      { text: '•', className: 'queue-item-meta-divider' },
      { text: 'Called back:', className: 'queue-item-meta-label' },
      { text: entry.calledBack || 'No', className: 'queue-item-meta-value' }
    ]
    : [
      { text: 'Set:', className: 'queue-item-meta-label' },
      { text: entry.createdAt ? formatDate(entry.createdAt) : 'Unknown', className: 'queue-item-meta-value' },
      { text: '•', className: 'queue-item-meta-divider' },
      { text: 'Appt:', className: 'queue-item-meta-label' },
      { text: formatDateTime(entry.appointmentDate), className: 'queue-item-meta-value' }
    ]);
  const closerLine = createLabelValueRow('Closer:', entry.closer || 'No closer listed');

  const notesLabel = createTextElement('div', 'queue-item-meta-label', 'Notes:');
  const notesInput = document.createElement('textarea');
  notesInput.className = 'queue-item-notes-input';
  notesInput.rows = 2;
  notesInput.placeholder = 'Add a note…';
  notesInput.value = entry.notes || '';
  const notesSave = createTextElement('button', '', 'Save note');
  notesSave.type = 'button';
  const notesStatus = createTextElement('span', 'queue-item-notes-status', '');
  let notesStatusTimer = null;
  notesSave.addEventListener('click', async () => {
    if (typeof onSaveNotes !== 'function') return;
    notesStatus.textContent = 'Saving…';
    notesStatus.className = 'queue-item-notes-status is-saving';
    try {
      await onSaveNotes(entry.id, notesInput.value);
      notesStatus.textContent = 'Saved';
      notesStatus.className = 'queue-item-notes-status is-saved';
    } catch (error) {
      notesStatus.textContent = 'Failed to save';
      notesStatus.className = 'queue-item-notes-status is-error';
    }
    if (notesStatusTimer) {
      clearTimeout(notesStatusTimer);
    }
    notesStatusTimer = setTimeout(() => {
      notesStatus.textContent = '';
      notesStatus.className = 'queue-item-notes-status';
    }, 2000);
  });
  const notesControls = createTextElement('div', 'queue-item-notes-controls', '');
  notesControls.append(notesStatus, notesSave);
  const notesLine = createTextElement('div', 'queue-item-notes', '');
  notesLine.append(notesLabel, notesInput, notesControls);

  const open = createTextElement('button', '', 'Open GHL');
  open.type = 'button';
  open.disabled = !entry.sourceUrl;
  open.addEventListener('click', () => onOpen(entry));
  const deleteButton = createTextElement('button', '', 'Delete');
  deleteButton.type = 'button';
  deleteButton.addEventListener('click', () => onDelete(entry));
  const controls = createTextElement('div', 'queue-item-controls', '');
  controls.append(open, deleteButton);
  if (entry.todoType === 'appointment') {
    const confirmStatus = createTextElement('span', 'queue-item-notes-status', '');
    let confirmStatusTimer = null;
    const copyConfirmation = createTextElement('button', '', 'Copy confirm text');
    copyConfirmation.type = 'button';
    copyConfirmation.addEventListener('click', async () => {
      if (typeof onCopyConfirmation !== 'function') return;
      const message = buildFollowUpConfirmationMessage(entry);
      try {
        await onCopyConfirmation(message, entry);
        confirmStatus.textContent = 'Copied';
        confirmStatus.className = 'queue-item-notes-status is-saved';
      } catch (error) {
        confirmStatus.textContent = 'Failed to copy';
        confirmStatus.className = 'queue-item-notes-status is-error';
      }
      if (confirmStatusTimer) {
        clearTimeout(confirmStatusTimer);
      }
      confirmStatusTimer = setTimeout(() => {
        confirmStatus.textContent = '';
        confirmStatus.className = 'queue-item-notes-status';
      }, 2000);
    });
    controls.append(copyConfirmation, confirmStatus);
  }
  const meta = createTextElement('div', 'queue-item-meta', '');
  meta.append(detailLine, closerLine, notesLine, controls);
  item.append(head, meta);
  return item;
}

if (typeof globalThis !== 'undefined') {
  globalThis.renderQueueView = renderQueueView;
}

if (typeof module !== 'undefined') {
  module.exports = { createQueueItem, renderQueueView };
}

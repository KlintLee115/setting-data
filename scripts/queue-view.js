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

function createQueueItem(entry, { formatDate, formatDateTime, formatFollowUpDate, formatFollowUpWindow, normalizeFollowUpDateValue, onSaveFollowUp }) {
  const item = document.createElement('li');
  item.className = 'queue-item';
  const title = createTextElement('div', 'queue-item-title', entry.fullName || 'Unknown lead');
  const badge = createTextElement('span', 'queue-badge', entry.label);
  const whenText = entry.followUpDate ? formatFollowUpWindow(entry.followUpDate) : 'No follow-up';
  const whenClass = whenText === 'No follow-up' ? 'is-neutral' : whenText === 'Due today' || whenText === 'Due now' ? 'is-due' : '';
  const when = createTextElement('span', `queue-item-when ${whenClass}`, whenText);
  const rightSide = createTextElement('div', 'queue-item-head-right', '');
  rightSide.append(badge, when);
  const head = createTextElement('div', 'queue-item-head', '');
  head.append(title, rightSide);

  const followUpValue = entry.followUpDate ? formatFollowUpDate(entry.followUpDate) : 'Not set';
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
  const followUpLine = createLabelValueRow('Follow-up:', followUpValue);
  const closerLine = createLabelValueRow('Closer:', entry.closer || 'No closer listed');
  const notesLine = entry.todoType === 'callback' && entry.notes
    ? createLabelValueRow('Notes:', entry.notes)
    : null;
  const input = document.createElement('input');
  input.type = 'date';
  input.value = normalizeFollowUpDateValue(entry.followUpDate) || '';
  const save = createTextElement('button', '', 'Save');
  save.type = 'button';
  save.addEventListener('click', () => onSaveFollowUp(entry.id, input.value));
  const controls = createTextElement('div', 'queue-item-controls', '');
  controls.append(input, save);
  const meta = createTextElement('div', 'queue-item-meta', '');
  meta.append(detailLine, followUpLine, closerLine);
  if (notesLine) {
    meta.append(notesLine);
  }
  meta.append(controls);
  item.append(head, meta);
  return item;
}

if (typeof globalThis !== 'undefined') {
  globalThis.renderQueueView = renderQueueView;
}

if (typeof module !== 'undefined') {
  module.exports = { createQueueItem, renderQueueView };
}

import type { UpcomingAppointment } from './appointment-queue';
import { createLabelValueRow, createMetaRow, createTextElement } from './dom-utils';
import { buildFollowUpConfirmationMessage } from './followup-message';

export interface QueueViewOptions {
  formatDate: (value: string | Date | undefined) => string;
  formatDateTime: (value: string | undefined) => string;
  onSaveNotes: (entryId: string | undefined, value: string) => void | Promise<void>;
  onCopyConfirmation: (message: string, entry: UpcomingAppointment) => void | Promise<void>;
  onDelete: (entry: UpcomingAppointment) => void | Promise<void>;
}

export function renderQueueView(queue: HTMLUListElement, entries: UpcomingAppointment[], options: QueueViewOptions): void {
  queue.replaceChildren();
  if (!entries.length) {
    queue.appendChild(createQueueEmptyState());
    return;
  }
  entries.forEach((entry) => queue.appendChild(createQueueItem(entry, options)));
}

function createQueueEmptyState(): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'queue-item';
  item.append(
    createTextElement('div', 'queue-item-title', 'No to-dos'),
    createTextElement('div', 'queue-item-meta', 'Upcoming appointments and outstanding callbacks will appear here.')
  );
  return item;
}

export function createQueueItem(entry: UpcomingAppointment, options: QueueViewOptions): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'queue-item';
  const title = createTextElement('div', 'queue-item-title', String(entry.fullName || 'Unknown lead'));
  const badge = createTextElement('span', 'queue-badge', String(entry.label));
  const rightSide = createTextElement('div', 'queue-item-head-right', '');
  rightSide.append(badge);
  const head = createTextElement('div', 'queue-item-head', '');
  head.append(title, rightSide);

  const detailLine = createMetaRow(entry.todoType === 'callback'
    ? [
      { text: 'Called:', className: 'queue-item-meta-label' },
      { text: options.formatDateTime(String(entry.callDateTime || '')), className: 'queue-item-meta-value' },
      { text: '•', className: 'queue-item-meta-divider' },
      { text: 'Called back:', className: 'queue-item-meta-label' },
      { text: String(entry.calledBack || 'No'), className: 'queue-item-meta-value' }
    ]
    : [
      { text: 'Set:', className: 'queue-item-meta-label' },
      { text: entry.createdAt ? options.formatDate(String(entry.createdAt)) : 'Unknown', className: 'queue-item-meta-value' },
      { text: '•', className: 'queue-item-meta-divider' },
      { text: 'Appt:', className: 'queue-item-meta-label' },
      { text: options.formatDateTime(String(entry.appointmentDate || '')), className: 'queue-item-meta-value' }
    ]);
  const closerLine = createLabelValueRow('Closer:', String(entry.closer || 'No closer listed'));

  const notesLabel = createTextElement('div', 'queue-item-meta-label', 'Notes:');
  const notesInput = document.createElement('textarea');
  notesInput.className = 'queue-item-notes-input';
  notesInput.rows = 2;
  notesInput.placeholder = 'Add a note…';
  notesInput.value = String(entry.notes || '');
  const notesSave = createTextElement('button', '', 'Save note');
  notesSave.type = 'button';
  const notesStatus = createTextElement('span', 'queue-item-notes-status', '');
  let notesStatusTimer: ReturnType<typeof setTimeout> | null = null;
  notesSave.addEventListener('click', async () => {
    notesStatus.textContent = 'Saving…';
    notesStatus.className = 'queue-item-notes-status is-saving';
    try {
      await options.onSaveNotes(entry.id ? String(entry.id) : undefined, notesInput.value);
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

  const deleteButton = createTextElement('button', '', 'Delete');
  deleteButton.type = 'button';
  deleteButton.addEventListener('click', () => options.onDelete(entry));
  const controls = createTextElement('div', 'queue-item-controls', '');
  controls.append(deleteButton);
  if (entry.todoType === 'appointment') {
    const confirmStatus = createTextElement('span', 'queue-item-notes-status', '');
    let confirmStatusTimer: ReturnType<typeof setTimeout> | null = null;
    const copyConfirmation = createTextElement('button', '', 'Copy confirm text');
    copyConfirmation.type = 'button';
    copyConfirmation.addEventListener('click', async () => {
      const message = buildFollowUpConfirmationMessage({
        fullName: entry.fullName as string | undefined,
        closer: entry.closer as string | undefined,
        appointmentDate: entry.appointmentDate as string | undefined,
        appointmentTimeZone: entry.appointmentTimeZone as string | undefined
      });
      try {
        await options.onCopyConfirmation(message, entry);
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

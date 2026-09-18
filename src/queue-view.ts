import type { UpcomingAppointment } from './appointment-queue';
import { createLabelValueRow, createMetaRow, createTextElement } from './dom-utils';

export interface QueueViewOptions {
  formatDate: (value: string | Date | undefined) => string;
  formatDateTime: (value: string | undefined) => string;
  formatFollowUpDate: (value: string | undefined) => string;
  formatFollowUpWindow: (value: string | undefined) => string;
  normalizeFollowUpDateValue: (value: string | undefined) => string;
  onSaveFollowUp: (entryId: string | undefined, value: string) => void;
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
  const whenText = entry.followUpDate ? options.formatFollowUpWindow(String(entry.followUpDate)) : 'No follow-up';
  const whenClass = whenText === 'No follow-up' ? 'is-neutral' : whenText === 'Due today' || whenText === 'Due now' ? 'is-due' : '';
  const when = createTextElement('span', `queue-item-when ${whenClass}`, whenText);
  const rightSide = createTextElement('div', 'queue-item-head-right', '');
  rightSide.append(badge, when);
  const head = createTextElement('div', 'queue-item-head', '');
  head.append(title, rightSide);

  const followUpValue = entry.followUpDate ? options.formatFollowUpDate(String(entry.followUpDate)) : 'Not set';
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
  const followUpLine = createLabelValueRow('Follow-up:', followUpValue);
  const closerLine = createLabelValueRow('Closer:', String(entry.closer || 'No closer listed'));
  const notesLine = entry.todoType === 'callback' && entry.notes
    ? createLabelValueRow('Notes:', String(entry.notes))
    : null;
  const input = document.createElement('input');
  input.type = 'date';
  input.value = entry.followUpDate ? options.normalizeFollowUpDateValue(String(entry.followUpDate)) : '';
  const save = createTextElement('button', '', 'Save');
  save.type = 'button';
  save.addEventListener('click', () => options.onSaveFollowUp(entry.id ? String(entry.id) : undefined, input.value));
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

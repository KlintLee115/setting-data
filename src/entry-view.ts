import type { Entry } from './models/entry';
import { createTextElement } from './dom-utils';

export interface DisplayEntry extends Entry {
  dateTime?: string;
  entryType?: 'Call' | 'Manual' | string;
}

export interface EntryViewOptions {
  formatDate: (value: string | undefined) => string;
  formatDateTime: (value: string | undefined) => string;
  getStatusClass: (status: string | undefined) => string;
  onEdit: (entry: DisplayEntry) => void;
  onDelete: (entry: DisplayEntry) => void;
}

export function renderEntryTable(body: HTMLTableSectionElement, entries: DisplayEntry[], options: EntryViewOptions): void {
  body.replaceChildren();
  if (!entries.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.className = 'empty';
    cell.colSpan = 4;
    cell.textContent = 'No entries yet';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }
  entries.forEach((entry) => body.appendChild(createEntryRow(entry, options)));
}

export function createEntryRow(entry: DisplayEntry, options: EntryViewOptions): HTMLTableRowElement {
  const row = document.createElement('tr');
  const dateCell = document.createElement('td');
  const nameCell = document.createElement('td');
  const statusCell = document.createElement('td');
  const actionsCell = document.createElement('td');
  const dateStack = createStack('cell-stack', createText('span', 'cell-main', options.formatDate(entry.dateTime)));
  const name = entry.entryType === 'Call' ? entry.name : entry.fullName;
  const nameElement = createText('span', 'cell-main', name || '');
  if (entry.sourceUrl) {
    const link = document.createElement('a');
    link.href = entry.sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = name || '';
    nameElement.replaceChildren(link);
  }
  const nameStack = createStack('cell-stack', nameElement);
  nameStack.appendChild(createText('span', 'cell-sub', entry.entryType === 'Call' ? '' : [entry.email, entry.phone].filter(Boolean).join(' | ')));

  const details = entry.entryType === 'Call'
    ? `Call: ${options.formatDateTime(entry.callDateTime || entry.timestamp)} | Picked up: ${entry.phonePickedUp || '-'} | Duration: ${entry.callDuration || '-'}`
    : `Call: ${options.formatDateTime(entry.callDateTime)} | Last text: ${entry.lastTextMessage || '-'} | Appt: ${options.formatDateTime(entry.appointmentDate)} | Closer: ${entry.closer || '-'} | Duration: ${entry.callDuration || '-'}${entry.leaveReason ? ` | Leave reason: ${entry.leaveReason}` : ''}${entry.leaveReason === 'Had to go' ? ` | Called back: ${entry.calledBack || '-'}` : ''}${entry.notes ? ` | Notes: ${entry.notes}` : ''} | Disqualified: ${entry.disqualified || '-'} | Pitched: ${entry.pitched || '-'} | Set: ${entry.wasSet || '-'}`;
  const displayStatus = entry.leaveReason === 'Had to go' ? 'Had to go' : entry.status;
  const statusClass = entry.entryType === 'Call' || entry.status
    ? `status ${options.getStatusClass(displayStatus)}`
    : 'cell-main';
  const detailsStack = createStack('cell-stack', createText('span', statusClass, displayStatus || ''));
  detailsStack.appendChild(createText('span', 'cell-sub', details));

  const actions = createTextElement('div', 'row-actions', '');
  actions.append(createAction('Edit', 'Edit entry', () => options.onEdit(entry)));
  actions.append(createAction('Delete', 'Delete entry', () => options.onDelete(entry), 'delete'));
  dateCell.appendChild(dateStack);
  nameCell.appendChild(nameStack);
  statusCell.appendChild(detailsStack);
  actionsCell.appendChild(actions);
  row.append(dateCell, nameCell, statusCell, actionsCell);
  return row;
}

function createStack(className: string, ...children: HTMLElement[]): HTMLDivElement {
  const stack = createTextElement('div', className, '');
  stack.append(...children);
  return stack;
}

function createText<K extends keyof HTMLElementTagNameMap>(tagName: K, className: string, text: string): HTMLElementTagNameMap[K] {
  return createTextElement(tagName, className, text);
}

function createAction(label: string, title: string, handler: () => void, className = ''): HTMLButtonElement {
  const button = createTextElement('button', className, label);
  button.type = 'button';
  button.title = title;
  button.addEventListener('click', handler);
  return button;
}

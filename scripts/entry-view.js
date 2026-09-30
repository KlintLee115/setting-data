function renderEntryTable(body, entries, options, lazyLoad = {}) {
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
  const limit = lazyLoad.initialLimit ?? entries.length;
  const visibleEntries = entries.slice(0, limit);
  visibleEntries.forEach((entry) => body.appendChild(createEntryRow(entry, options)));
  if (lazyLoad.onLoadMore && entries.length > visibleEntries.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.className = 'load-more';
    cell.colSpan = 4;
    cell.textContent = 'Load more';
    cell.addEventListener('click', lazyLoad.onLoadMore);
    row.appendChild(cell);
    body.appendChild(row);
  }
}

function createEntryRow(entry, { formatDate, formatDateTime, getStatusClass, onEdit, onDelete }) {
  const row = document.createElement('tr');
  const dateCell = document.createElement('td');
  const nameCell = document.createElement('td');
  const statusCell = document.createElement('td');
  const actionsCell = document.createElement('td');
  const dateStack = createStack('cell-stack', createText('span', 'cell-main', formatDate(entry.dateTime)));
  const name = entry.name || entry.fullName;
  const nameElement = createText('span', 'cell-main', name);
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
    ? `Call: ${formatDateTime(entry.callDateTime || entry.pickupDateTime || entry.timestamp)} | Picked up: ${entry.phonePickedUp || '-'} | Duration: ${entry.callDuration || '-'}`
    : entry.entryType === 'DM'
      ? `DM: ${entry.dmChannel || '-'} | Outcome: ${entry.dmOutcome || entry.status || 'Sent'} | Sent: ${formatDateTime(entry.dmDateTime || entry.createdAt)} | Message: ${entry.dmMessage || '-'}${entry.notes ? ` | Notes: ${entry.notes}` : ''}`
      : `Call: ${formatDateTime(entry.callDateTime)} | Last text: ${entry.lastTextMessage || '-'} | Appt: ${formatDateTime(entry.appointmentDate)} | Closer: ${entry.closer || '-'} | Duration: ${entry.callDuration || '-'}${entry.notes ? ` | Notes: ${entry.notes}` : ''} | Disqualified: ${entry.disqualified || '-'} | Talk time: ${entry.talkTime || '-'} | Talk/listen: ${entry.talkToListenRatio || '-'} | Client type: ${entry.clientType || '-'} | Objections: ${entry.objections || '-'}${entry.objectionNotes ? ` (${entry.objectionNotes})` : ''} | Pitched: ${entry.pitched || '-'}`;
  const displayStatus = entry.status;
  const statusClass = entry.entryType === 'Call' || entry.status
    ? `status ${getStatusClass(displayStatus)}`
    : 'cell-main';
  const detailsStack = createStack('cell-stack', createText('span', statusClass, displayStatus));
  detailsStack.appendChild(createText('span', 'cell-sub', details));

  const actions = createText('div', 'row-actions', '');
  actions.append(createAction('Edit', 'Edit entry', () => onEdit(entry)));
  actions.append(createAction('Delete', 'Delete entry', () => onDelete(entry), 'delete'));
  dateCell.appendChild(dateStack);
  nameCell.appendChild(nameStack);
  statusCell.appendChild(detailsStack);
  actionsCell.appendChild(actions);
  row.append(dateCell, nameCell, statusCell, actionsCell);
  return row;
}

function createStack(className, ...children) {
  const stack = createText('div', className, '');
  stack.append(...children);
  return stack;
}

function createText(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function createAction(label, title, handler, className = '') {
  const button = createText('button', className, label);
  button.type = 'button';
  button.title = title;
  button.addEventListener('click', handler);
  return button;
}

if (typeof globalThis !== 'undefined') {
  globalThis.renderEntryTable = renderEntryTable;
}

if (typeof module !== 'undefined') {
  module.exports = { createEntryRow, renderEntryTable };
}

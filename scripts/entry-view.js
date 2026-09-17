function renderEntryTable(body, entries, options) {
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

function createEntryRow(entry, { formatDate, formatDateTime, getStatusClass, onEdit, onDelete }) {
  const row = document.createElement('tr');
  const dateCell = document.createElement('td');
  const nameCell = document.createElement('td');
  const statusCell = document.createElement('td');
  const actionsCell = document.createElement('td');
  const dateStack = createStack('cell-stack', createText('span', 'cell-main', formatDate(entry.dateTime)));
  const name = entry.entryType === 'Call' ? entry.name : entry.fullName;
  const nameStack = createStack('cell-stack', createText('span', 'cell-main', name));
  nameStack.appendChild(createText('span', 'cell-sub', entry.entryType === 'Call' ? '' : [entry.email, entry.phone].filter(Boolean).join(' | ')));

  const details = entry.entryType === 'Call'
    ? `Call: ${formatDateTime(entry.callDateTime || entry.pickupDateTime || entry.timestamp)} | Picked up: ${entry.phonePickedUp || '-'} | Duration: ${entry.callDuration || '-'}`
    : `Call: ${formatDateTime(entry.callDateTime)} | Last text: ${entry.lastTextMessage || '-'} | Appt: ${formatDateTime(entry.appointmentDate)} | Closer: ${entry.closer || '-'} | Duration: ${entry.callDuration || '-'}${entry.leaveReason ? ` | Leave reason: ${entry.leaveReason}` : ''} | Disqualified: ${entry.disqualified || '-'} | Pitched: ${entry.pitched || '-'} | Set: ${entry.wasSet || '-'}`;
  const statusClass = entry.entryType === 'Call' || entry.status
    ? `status ${getStatusClass(entry.status)}`
    : 'cell-main';
  const detailsStack = createStack('cell-stack', createText('span', statusClass, entry.status));
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

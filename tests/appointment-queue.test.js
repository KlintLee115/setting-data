const test = require('node:test');
const assert = require('node:assert/strict');
const { getTodoItems, getUpcomingAppointments } = require('../scripts/appointment-queue');

const parseFollowUpDate = (value) => new Date(`${value.slice(0, 10)}T00:00:00`);

test('queue keeps only upcoming appointments in appointment order', () => {
  const now = new Date('2026-09-16T12:00:00Z');
  const appointments = getUpcomingAppointments([
    { id: 'later', wasSet: 'Yes', appointmentDate: '2026-09-17T18:00:00.000Z' },
    { id: 'past', wasSet: 'Yes', appointmentDate: '2026-09-16T11:00:00.000Z' },
    { id: 'earlier', wasSet: 'Yes', appointmentDate: '2026-09-17T11:00:00.000Z' },
    { id: 'not-booked', wasSet: 'No', appointmentDate: '2026-09-16T13:00:00.000Z' }
  ], now, parseFollowUpDate);

  assert.deepEqual(appointments.map((entry) => entry.id), ['not-booked', 'earlier', 'later']);
  assert.equal(appointments[0].label, 'Tomorrow');
});

test('queue uses the upcoming appointment date independently of booked status', () => {
  const appointments = getUpcomingAppointments([
    { id: 'future', appointmentDate: '2026-09-17T11:00:00.000Z', wasSet: 'No' },
    { id: 'disqualified', appointmentDate: '2026-09-18T11:00:00.000Z', disqualified: 'Yes' }
  ], new Date('2026-09-16T12:00:00Z'), parseFollowUpDate);

  assert.deepEqual(appointments.map((entry) => entry.id), ['future', 'disqualified']);
});

test('queue ignores invalid appointment dates', () => {
  const appointments = getUpcomingAppointments([
    { id: 'invalid', wasSet: 'Yes', appointmentDate: 'not-a-date' }
  ], new Date('2026-09-16T12:00:00Z'), parseFollowUpDate);

  assert.deepEqual(appointments, []);
});

test('to-do includes uncalled-back Had to go prospects with appointments', () => {
  const todos = getTodoItems([
    { id: 'appointment', appointmentDate: '2026-09-18T10:00:00.000Z' },
    { id: 'callback', leaveReason: 'Had to go', calledBack: 'No', callDateTime: '2026-09-17T15:00:00.000Z' },
    { id: 'done', leaveReason: 'Had to go', calledBack: 'Yes', callDateTime: '2026-09-17T14:00:00.000Z' }
  ], new Date('2026-09-17T12:00:00Z'), parseFollowUpDate);

  assert.deepEqual(todos.map((entry) => entry.id), ['callback', 'appointment']);
  assert.equal(todos[0].todoType, 'callback');
  assert.equal(todos[0].label, 'Call back');
});

test('callback queue item includes notes in the visible entry details', () => {
  const oldDocument = global.document;
  const oldCreateTextElement = global.createTextElement;
  const oldCreateMetaRow = global.createMetaRow;
  const oldCreateLabelValueRow = global.createLabelValueRow;

  function makeNode(tagName) {
    const node = {
      tagName: String(tagName).toUpperCase(),
      className: '',
      textContent: '',
      children: [],
      append: function (...values) {
        values.forEach((value) => {
          if (value !== undefined && value !== null) {
            this.children.push(value);
          }
        });
      },
      appendChild: function (child) {
        this.children.push(child);
      },
      addEventListener: function () {},
      replaceChildren: function (...values) {
        this.children = values.filter((value) => value !== undefined && value !== null);
      }
    };
    return node;
  }

  global.createTextElement = (tagName, className, text) => {
    const node = makeNode(tagName);
    node.className = className || '';
    node.textContent = String(text ?? '');
    return node;
  };
  global.createMetaRow = (parts) => {
    const row = makeNode('div');
    row.className = 'queue-item-meta-row';
    row.append(...parts.map(({ text, className }) => global.createTextElement('span', className, text)));
    return row;
  };
  global.createLabelValueRow = (label, value) => global.createMetaRow([
    { text: label, className: 'queue-item-meta-label' },
    { text: value, className: 'queue-item-meta-value' }
  ]);
  global.document = {
    createElement: (tagName) => makeNode(tagName)
  };

  try {
    const { createQueueItem } = require('../scripts/queue-view');
    const item = createQueueItem({
      id: 'callback-1',
      fullName: 'Aye Felix',
      label: 'Call back',
      todoType: 'callback',
      calledBack: 'No',
      callDateTime: '2026-09-17T10:36:00.000Z',
      closer: 'No closer listed',
      notes: 'Customer called back after 3pm',
      followUpDate: '2026-09-19',
      appointmentInstant: new Date('2026-09-17T10:36:00.000Z')
    }, {
      formatDate: () => 'Sep 17, 2026',
      formatDateTime: () => 'Sep 17, 2026, 10:36 AM MDT',
      formatFollowUpDate: () => 'Sep 19, 2026',
      formatFollowUpWindow: () => 'Due today',
      normalizeFollowUpDateValue: (value) => String(value || ''),
      onSaveFollowUp: () => {}
    });

    let text = '';
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (typeof node.textContent === 'string' && node.textContent) {
        text += `${node.textContent} `;
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          walk(child);
        }
      }
    };
    walk(item);

    assert.match(text, /Notes:/);
    assert.match(text, /Customer called back after 3pm/);
  } finally {
    global.document = oldDocument;
    global.createTextElement = oldCreateTextElement;
    global.createMetaRow = oldCreateMetaRow;
    global.createLabelValueRow = oldCreateLabelValueRow;
  }
});

test('entry row includes notes in the visible details', () => {
  const oldDocument = global.document;

  function makeNode(tagName) {
    const node = {
      tagName: String(tagName).toUpperCase(),
      className: '',
      textContent: '',
      children: [],
      append: function (...values) {
        values.forEach((value) => {
          if (value !== undefined && value !== null) {
            this.children.push(value);
          }
        });
      },
      appendChild: function (child) {
        this.children.push(child);
      },
      addEventListener: function () {},
      replaceChildren: function (...values) {
        this.children = values.filter((value) => value !== undefined && value !== null);
      }
    };
    return node;
  }

  global.document = {
    createElement: (tagName) => makeNode(tagName)
  };

  try {
    const { createEntryRow } = require('../scripts/entry-view');
    const row = createEntryRow({
      id: 'entry-1',
      entryType: 'Manual',
      fullName: 'Ayan Hudson',
      email: 'aya@example.com',
      phone: '555-1234',
      callDateTime: '2026-09-16T20:08:00.000Z',
      leaveReason: 'Had to go',
      calledBack: 'No',
      notes: 'regregregreg',
      status: 'Had to go',
      dateTime: '2026-09-16T20:08:00.000Z'
    }, {
      formatDate: () => 'Sep 16, 2026',
      formatDateTime: () => 'Sep 16, 2026, 8:08 PM',
      getStatusClass: () => 'status-neutral',
      onEdit: () => {},
      onDelete: () => {}
    });

    let text = '';
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (typeof node.textContent === 'string' && node.textContent) {
        text += `${node.textContent} `;
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          walk(child);
        }
      }
    };
    walk(row);

    assert.match(text, /Notes: regregregreg/);
  } finally {
    global.document = oldDocument;
  }
});

test('to-do keeps overdue appointments until they are completed', () => {
  const todos = getTodoItems([
    { id: 'overdue', appointmentDate: '2026-09-16T10:00:00.000Z' },
    { id: 'complete', appointmentDate: '2026-09-16T11:00:00.000Z', appointmentOutcome: 'Completed' }
  ], new Date('2026-09-17T12:00:00Z'), parseFollowUpDate);

  assert.deepEqual(todos.map((entry) => entry.id), ['overdue']);
});
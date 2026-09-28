const test = require('node:test');
const assert = require('node:assert/strict');

function makeNode(tagName) {
  return {
    tagName: String(tagName).toUpperCase(),
    className: '',
    textContent: '',
    children: [],
    append(...values) {
      this.children.push(...values.filter((value) => value !== undefined && value !== null));
    },
    appendChild(child) {
      this.children.push(child);
    },
    addEventListener() {},
    replaceChildren(...values) {
      this.children = values.filter((value) => value !== undefined && value !== null);
    }
  };
}

function withMockDocument(run) {
  const oldDocument = global.document;
  global.document = { createElement: (tagName) => makeNode(tagName) };
  try {
    run();
  } finally {
    global.document = oldDocument;
  }
}

test('entry table adds a load-more row when lazy loading is enabled', () => {
  withMockDocument(() => {
    const { renderEntryTable } = require('../scripts/entry-view');
    const body = {
      children: [],
      replaceChildren() { this.children = []; },
      appendChild(child) { this.children.push(child); }
    };
    const entries = Array.from({ length: 12 }, (_, index) => ({
      id: `entry-${index}`,
      entryType: 'Manual',
      fullName: `Lead ${index}`,
      email: `lead${index}@example.com`,
      phone: '555-0000',
      callDateTime: '2026-09-16T20:08:00.000Z',
      leaveReason: 'Had to go',
      status: 'Had to go',
      dateTime: '2026-09-16T20:08:00.000Z'
    }));

    renderEntryTable(body, entries, {
      formatDate: () => 'Sep 16, 2026',
      formatDateTime: () => 'Sep 16, 2026, 8:08 PM',
      getStatusClass: () => 'status-neutral',
      onEdit: () => {},
      onDelete: () => {}
    }, {
      initialLimit: 5,
      onLoadMore: () => {}
    });

    assert.equal(body.children.length, 6);
    assert.equal(body.children[5].children[0].textContent, 'Load more');
  });
});

test('entry row includes notes in the visible details', () => {
  withMockDocument(() => {
    const { createEntryRow } = require('../scripts/entry-view');
    const row = createEntryRow({
      id: 'entry-1',
      entryType: 'Manual',
      fullName: 'Ayan Hudson',
      email: 'aya@example.com',
      phone: '555-1234',
      callDateTime: '2026-09-16T20:08:00.000Z',
      leaveReason: 'Had to go',
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
      node.children.forEach(walk);
    };
    walk(row);

    assert.match(text, /Notes: regregregreg/);
  });
});
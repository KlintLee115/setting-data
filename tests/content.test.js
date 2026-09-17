const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const contentScript = fs.readFileSync(`${__dirname}/../scripts/content.js`, 'utf8');

function loadContentScript(storageGetError, storageSetError) {
  const consoleErrors = [];
  const storageCalls = [];
  function element() {
    return {
      children: [],
      addEventListener(eventName, handler) {
        if (eventName === 'click') this.clickHandler = handler;
      },
      append(...items) { this.children.push(...items); },
      appendChild(item) { this.children.push(item); },
      replaceChildren(...items) { this.children = items; },
      click() { this.clickHandler?.(); },
      querySelector(selector) {
        const className = selector.slice(1);
        for (const child of this.children) {
          if (child.className === className) return child;
          const nested = child.querySelector?.(selector);
          if (nested) return nested;
        }
        return null;
      },
      style: { display: '' },
      value: '',
      textContent: ''
    };
  }
  const fields = element();
  const actions = element();
  const cancelButton = element();
  const nameElement = element();
  const shadowRoot = {
    set innerHTML(value) {},
    querySelector(selector) {
      return {
        '.fields': fields,
        '.actions': actions,
        '.cancel': cancelButton,
        '.name': nameElement,
        '.message': element()
      }[selector];
    }
  };
  const host = {
    id: '',
    style: { cssText: '', display: '' },
    shadowRoot,
    attachShadow() {
      return shadowRoot;
    }
  };
  const document = {
    body: { innerText: '' },
    documentElement: { appendChild() {} },
    createElement(tagName) {
      return tagName === 'div' ? host : element();
    },
    querySelector() {
      return { textContent: 'Jane Doe' };
    },
    querySelectorAll() {
      return [];
    }
  };
  const context = {
    chrome: {
      storage: {
        local: {
          get() {
            return storageGetError
              ? Promise.reject(storageGetError)
              : Promise.resolve({ entries: [], callLogs: [], manualEntries: [] });
          },
          set() {
            storageCalls.push([...arguments]);
            if (storageSetError) throw storageSetError;
            return Promise.resolve();
          }
        }
      }
    },
    console: {
      error(...args) {
        consoleErrors.push(args);
      }
    },
    crypto: { randomUUID: () => 'test-id' },
    document,
    MutationObserver: class {
      observe() {}
    },
    setInterval() {},
    window: {
      location: { href: 'https://app.gohighlevel.com/conversations' },
      setInterval() {}
    }
  };

  vm.runInNewContext(contentScript, context);
  return {
    clickNoAnswer: () => actions.children[1].click(),
    clickPickedUp: () => actions.children[0].click(),
    clickCancel: () => cancelButton.click(),
    actionCount: () => actions.children.length,
    clickAction: () => actions.children[0].click(),
    field: (className) => fields.children
      .map((label) => label.children.find((child) => child.className === className))
      .find(Boolean),
    isVisible: () => host.style.display !== 'none',
    consoleErrors,
    storageCalls
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

test('ignores extension context invalidation from the call logger', async () => {
  const uncaughtErrors = [];
  const handleUnhandledRejection = (error) => uncaughtErrors.push(error);
  process.on('unhandledRejection', handleUnhandledRejection);

  const { clickPickedUp, consoleErrors } = loadContentScript(
    new Error('Extension context invalidated.')
  );
  clickPickedUp();
  await flushPromises();

  process.off('unhandledRejection', handleUnhandledRejection);
  assert.deepEqual(uncaughtErrors, []);
  assert.deepEqual(consoleErrors, []);
});

test('reports unrelated call logger storage errors', async () => {
  const { clickNoAnswer, consoleErrors } = loadContentScript(new Error('Storage unavailable'));
  clickNoAnswer();
  await flushPromises();

  assert.equal(consoleErrors.length, 1);
  assert.equal(consoleErrors[0][0], 'Could not save call:');
  assert.match(consoleErrors[0][1].message, /Storage unavailable/);
});

test('ignores synchronous extension context invalidation while publishing a lead', async () => {
  const { consoleErrors } = loadContentScript(
    new Error('Storage unavailable'),
    new Error('Extension context invalidated.')
  );
  await flushPromises();

  assert.deepEqual(consoleErrors, []);
});

test('handles the no-answer button through the same save path', async () => {
  const { clickNoAnswer, consoleErrors } = loadContentScript(new Error('Storage unavailable'));
  clickNoAnswer();
  await flushPromises();

  assert.equal(consoleErrors.length, 1);
  assert.equal(consoleErrors[0][0], 'Could not save call:');
  assert.match(consoleErrors[0][1].message, /Storage unavailable/);
});

test('picked-up opens the qualification step before saving', async () => {
  const { clickPickedUp, actionCount, storageCalls } = loadContentScript();

  clickPickedUp();
  await flushPromises();

  assert.equal(actionCount(), 1);
  assert.equal(storageCalls.length, 1);
});

test('picked-up follows the form flow and saves appointment details', async () => {
  const logger = loadContentScript();

  logger.clickPickedUp();
  logger.field('disqualified').value = 'No';
  logger.clickAction();
  logger.field('pitched').value = 'Yes';
  logger.clickAction();
  logger.field('wasSet').value = 'Yes';
  logger.clickAction();
  logger.field('closer').value = 'Alicia Lyttle';
  logger.field('appointmentDate').value = '2026-09-20T10:00';
  logger.field('followUpDate').value = '2026-09-18';
  logger.field('appointmentTimeZone').value = 'America/Denver';
  logger.clickAction();
  await flushPromises();

  const saved = logger.storageCalls.at(-1)[0].entries.at(-1);
  assert.equal(saved.disqualified, 'No');
  assert.equal(saved.pitched, 'Yes');
  assert.equal(saved.wasSet, 'Yes');
  assert.equal(saved.closer, 'Alicia Lyttle');
  assert.equal(saved.followUpDate, '2026-09-18');
  assert.equal(saved.appointmentTimeZone, 'America/Denver');
});

test('X cancels an unfinished call entry', () => {
  const { clickCancel, isVisible } = loadContentScript();

  assert.equal(isVisible(), true);
  clickCancel();
  assert.equal(isVisible(), false);
});
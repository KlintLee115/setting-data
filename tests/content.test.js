const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const contentScript = fs.readFileSync(`${__dirname}/../scripts/content.js`, 'utf8');

function loadContentScript(storageGetError, storageSetError, composerMode = 'textarea', storageAvailable = true, leadName = 'Jane Doe') {
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
      dispatchEvent(event) {
        this.lastEvent = event;
        this.events = [...(this.events || []), event];
      },
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
  const composer = element();
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
    isConnected: true,
    style: { cssText: '', display: '' },
    shadowRoot,
    attachShadow() {
      return shadowRoot;
    }
  };
  let hostCreated = false;
  let messageListener;
  const document = {
    body: { innerText: '' },
    documentElement: { appendChild() {} },
    createElement(tagName) {
      if (tagName === 'div' && !hostCreated) {
        hostCreated = true;
        return host;
      }
      return element();
    },
    querySelector(selector) {
      if (composerMode === 'textarea' && selector === '#conv-composer-textarea-input') return composer;
      if (composerMode === 'input' && selector === 'input[placeholder="Type a message"]') return composer;
      if (selector === '#conv-composer-textarea-input'
        || selector === 'input[placeholder="Type a message"]'
        || selector === 'textarea[placeholder="Type a message"]') return null;
      return { textContent: leadName };
    },
    querySelectorAll() {
      return [];
    }
  };
  const context = {
    chrome: {
      runtime: {
        onMessage: {
          addListener(listener) {
            messageListener = listener;
          }
        }
      },
      storage: storageAvailable ? {
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
      } : {}
    },
    console: {
      error(...args) {
        consoleErrors.push(args);
      }
    },
    crypto: { randomUUID: () => 'test-id' },
    document,
    Event,
    MutationObserver: class {
      observe() {}
    },
    setInterval() {},
    window: {
      location: { href: 'https://app.gohighlevel.com/conversations' },
      setInterval() {},
      setTimeout
    }
  };

  vm.runInNewContext(contentScript, context);
  return {
    clickNoAnswer: () => actions.children[1].click(),
    clickPickedUp: () => actions.children[0].click(),
    clickCancel: () => cancelButton.click(),
    actionCount: () => actions.children.length,
    showCallLogger: () => new Promise((resolve) => messageListener({ type: 'show-call-logger' }, {}, resolve)),
    clickAction: (index = 0) => actions.children[index].click(),
    field: (className) => fields.children
      .map((label) => label.children.find((child) => child.className === className))
      .find(Boolean),
    composer,
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
  const logger = loadContentScript(new Error('Storage unavailable'));
  logger.clickNoAnswer();
  logger.clickAction();
  await flushPromises();

  assert.equal(logger.consoleErrors.length, 1);
  assert.equal(logger.consoleErrors[0][0], 'Could not save call:');
  assert.match(logger.consoleErrors[0][1].message, /Storage unavailable/);
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
  const logger = loadContentScript(new Error('Storage unavailable'));
  logger.clickNoAnswer();
  logger.clickAction();
  await flushPromises();

  assert.equal(logger.consoleErrors.length, 1);
  assert.equal(logger.consoleErrors[0][0], 'Could not save call:');
  assert.match(logger.consoleErrors[0][1].message, /Storage unavailable/);
});

test('fills the no-answer follow-up message for the lead', () => {
  const logger = loadContentScript();

  logger.clickNoAnswer();
  logger.clickAction(1);

  assert.equal(logger.composer.value, `Hey Jane, Klint here from Alicia's team (not AI, I promise 😂)

Saw you recently registefred for our AI Business summit... Just to see if I can help u get more out of it

Are you looking to implement AI with your current biz or are you just starting out with AI biz?`);
  assert.deepEqual(logger.composer.events.map((event) => event.type), ['input', 'change']);
  assert.equal(logger.composer.events.every((event) => event.bubbles), true);
});

test('saves the no-answer message as the last text message', async () => {
  const logger = loadContentScript();

  logger.clickNoAnswer();
  logger.clickAction();
  await flushPromises();

  const saved = logger.storageCalls.at(-1)[0].entries.at(-1);
  assert.equal(saved.lastTextMessage, logger.composer.value);
});

test('saves the current GHL page URL with the call record', async () => {
  const logger = loadContentScript();

  logger.clickNoAnswer();
  logger.clickAction(2);
  await flushPromises();

  const saved = logger.storageCalls.at(-1)[0].entries.at(-1);
  assert.equal(saved.sourceUrl, 'https://app.gohighlevel.com/conversations');
});

test('offers VIP and standard no-answer messages before saving', async () => {
  const logger = loadContentScript();

  logger.clickNoAnswer();
  await flushPromises();
  assert.equal(logger.storageCalls.some((call) => Array.isArray(call[0]?.entries)), false);
  assert.equal(logger.actionCount(), 3);
  logger.clickAction();
  await flushPromises();

  assert.match(logger.composer.value, /and even upgraded to VIP/);
  assert.equal(logger.storageCalls.at(-1)[0].entries.at(-1).lastTextMessage, logger.composer.value);
});

test('supports the alternate GHL input composer selector', () => {
  const logger = loadContentScript(undefined, undefined, 'input');

  logger.clickNoAnswer();
  logger.clickAction(1);

  assert.match(logger.composer.value, /Hey Jane/);
});

test('can save a no-answer call without leaving a text message', async () => {
  const logger = loadContentScript();

  logger.clickNoAnswer();
  logger.clickAction(2);
  await flushPromises();

  const saved = logger.storageCalls.at(-1)[0].entries.at(-1);
  assert.equal(saved.status, 'No Answer');
  assert.equal(saved.lastTextMessage, undefined);
  assert.equal(logger.composer.value, '');
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
  assert.equal(saved.appointmentDate, '2026-09-20T16:00:00.000Z');
  assert.equal(saved.appointmentTimeZone, 'America/Denver');
});

test('converts an appointment from the selected client timezone', async () => {
  const logger = loadContentScript();

  logger.clickPickedUp();
  logger.field('disqualified').value = 'No';
  logger.clickAction();
  logger.field('pitched').value = 'Yes';
  logger.clickAction();
  logger.field('wasSet').value = 'Yes';
  logger.clickAction();
  logger.field('appointmentDate').value = '2026-09-20T10:00';
  logger.field('appointmentTimeZone').value = 'America/Los_Angeles';
  logger.clickAction();
  await flushPromises();

  const saved = logger.storageCalls.at(-1)[0].entries.at(-1);
  assert.equal(saved.appointmentDate, '2026-09-20T17:00:00.000Z');
});

test('saves whether a Had to go prospect was called back', async () => {
  const logger = loadContentScript();

  logger.clickPickedUp();
  logger.field('disqualified').value = 'No';
  logger.clickAction();
  logger.field('pitched').value = 'No';
  logger.clickAction();
  logger.field('leaveReason').value = 'Had to go';
  logger.field('calledBack').value = 'Yes';
  logger.clickAction();
  await flushPromises();

  const saved = logger.storageCalls.at(-1)[0].entries.at(-1);
  assert.equal(saved.leaveReason, 'Had to go');
  assert.equal(saved.calledBack, 'Yes');
});

test('X cancels an unfinished call entry', () => {
  const { clickCancel, isVisible } = loadContentScript();

  assert.equal(isVisible(), true);
  clickCancel();
  assert.equal(isVisible(), false);
});

test('restores the call logger when requested from the popup', async () => {
  const logger = loadContentScript();

  const result = await logger.showCallLogger();

  assert.equal(result.shown, true);
  assert.equal(logger.isVisible(), true);
});

test('shows the call logger for a single-word lead name', async () => {
  const logger = loadContentScript(undefined, undefined, 'textarea', true, 'Toni');

  const result = await logger.showCallLogger();

  assert.equal(result.shown, true);
  assert.equal(logger.isVisible(), true);
});

test('treats a missing storage API as an invalidated extension context', async () => {
  const { clickPickedUp, consoleErrors } = loadContentScript(
    undefined,
    undefined,
    'textarea',
    false
  );
  clickPickedUp();
  await flushPromises();

  assert.deepEqual(consoleErrors, []);
});
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { OBJECTION_OPTIONS } = require('../scripts/objection-options');

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
    OBJECTION_OPTIONS,
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
    clickDm: () => actions.children[2].click(),
    clickCancel: () => cancelButton.click(),
    actionCount: () => actions.children.length,
    showCallLogger: () => new Promise((resolve) => messageListener({ type: 'show-call-logger' }, {}, resolve)),
    clickAction: (index = 0) => actions.children[index].click(),
      actionLabels: () => actions.children.map((action) => action.textContent),
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

  assert.equal(logger.composer.value, `Heyy Jane, this is Klint with Alicia Lyttle's AI team 😊 

I saw that you registered for the AI Marketing Summit to possibly make more money or have more freedom.

 We are just checking on all the vip members - how did the summit go for you?`);
  assert.deepEqual(logger.composer.events.map((event) => event.type), ['input', 'change']);
  assert.equal(logger.composer.events.every((event) => event.bubbles), true);
});

test('supports the AI consultancy certification form no-answer message', () => {
  const logger = loadContentScript();

  logger.clickNoAnswer();
  logger.clickAction(2);

  assert.equal(logger.composer.value, `Heyy Jane, this is Klint with Alicia Lyttle's AI team 😊 

I saw that you filled out the form for the AI Consultancy Certification to possibly leverage AI more in your biz, or become an AI consultant.

 We are just checking on all the vip members - how did the summit go for you?`);
});

test('supports the Build It Launch It no-answer message', () => {
  const logger = loadContentScript();

  logger.clickNoAnswer();
  logger.clickAction(3);

  assert.equal(logger.composer.value, `Heyy Jane, this is Klint with Alicia Lyttle's AI team 😊 

I saw that you signed up for the Build It Launch It challenge.

 We are just checking on all the vip members - how did the summit go for you?`);
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

test('offers a follow-up, form, standard, and Build It Launch It no-answer messages before saving', async () => {
  const logger = loadContentScript();

  logger.clickNoAnswer();
  await flushPromises();
  assert.equal(logger.storageCalls.some((call) => Array.isArray(call[0]?.entries)), false);
  assert.equal(logger.actionCount(), 5);
  logger.clickAction();
  await flushPromises();

  assert.equal(logger.composer.value, `Heyy Jane, Klint here from Alicia Lyttle's AI team 😊 \n\n did u get my msg?`);
  assert.equal(logger.storageCalls.at(-1)[0].entries.at(-1).lastTextMessage, logger.composer.value);
});

test('supports the alternate GHL input composer selector', () => {
  const logger = loadContentScript(undefined, undefined, 'input');

  logger.clickNoAnswer();
  logger.clickAction(1);

  assert.match(logger.composer.value, /Heyy Jane/);
});

test('can save a no-answer call without leaving a text message', async () => {
  const logger = loadContentScript();

  logger.clickNoAnswer();
  logger.field('leadTimeZone').value = 'America/New_York';
  logger.clickAction(4);
  await flushPromises();

  const saved = logger.storageCalls.at(-1)[0].entries.at(-1);
  assert.equal(saved.status, 'No Answer');
  assert.equal(saved.leadTimeZone, 'America/New_York');
  assert.equal(Object.hasOwn(saved, 'contactHistory'), false);
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

test('logs a DM as a separate activity without call-only fields', async () => {
  const logger = loadContentScript();

  logger.clickDm();
  assert.deepEqual(logger.field('dmChannel').children.map((option) => option.value), ['', 'iMessage', 'SMS']);
  logger.field('dmChannel').value = 'iMessage';
  logger.field('dmOutcome').value = 'Sent';
  assert.deepEqual(logger.actionLabels(), [
    'Use follow-up message',
    'Use standard message',
    'Use certification form message',
    'Use Build It Launch It message',
    'Save DM'
  ]);
  logger.clickAction(0);
  assert.equal(logger.field('dmMessage').value, logger.composer.value);
  logger.clickAction(4);
  await flushPromises();

  const saved = logger.storageCalls.at(-1)[0].entries.at(-1);
  assert.equal(saved.recordType, 'dm');
  assert.equal(saved.name, 'Jane Doe');
  assert.equal(saved.dmChannel, 'iMessage');
  assert.equal(saved.dmMessage, `Heyy Jane, Klint here from Alicia Lyttle's AI team 😊 \n\n did u get my msg?`);
  assert.equal(saved.dmOutcome, 'Sent');
  assert.equal(saved.status, 'Sent');
  assert.equal(saved.phonePickedUp, undefined);
  assert.equal(saved.callDateTime, undefined);
});

test('picked-up follows the form flow and saves appointment details', async () => {
  const logger = loadContentScript();

  logger.clickPickedUp();
  logger.field('leadTimeZone').value = 'America/Los_Angeles';
  logger.field('intent').value = 'Use AI to grow an existing business';
  logger.clickAction();
  logger.field('talkTime').value = '5:00';
  logger.field('clientType9to5').checked = true;
  logger.field('clientTypeBusinessOwner').checked = true;
  logger.field('objectionPartner').checked = true;
  logger.field('notes').value = 'Price';
  logger.clickAction();
  logger.field('pitched').value = 'High Ticket';
  logger.clickAction();
  logger.field('closer').value = 'Alicia Lyttle';
  logger.field('appointmentDate').value = '2026-09-20T10:00';
  assert.equal(logger.field('appointmentTimeZone'), undefined);
  logger.clickAction();
  await flushPromises();

  const saved = logger.storageCalls.at(-1)[0].entries.at(-1);
  assert.equal(saved.leadTimeZone, 'America/Los_Angeles');
  assert.equal(saved.intent, 'Use AI to grow an existing business');
  assert.equal(Object.hasOwn(saved, 'contactHistory'), false);
  assert.equal(saved.talkTime, '5:00');
  assert.equal(logger.field('talkToListenRatio'), undefined);
  assert.equal(saved.clientType, '9-5, Business Owner');
  assert.equal(saved.objections, 'Partner');
  assert.equal(saved.notes, 'Price');
  assert.equal(saved.pitched, 'High Ticket');
  assert.equal(saved.closer, 'Alicia Lyttle');
  assert.equal(saved.appointmentDate, new Date('2026-09-20T10:00').toISOString());
});

test('records the lead answer to the intent question as open text', async () => {
  const logger = loadContentScript();

  logger.clickPickedUp();
  logger.field('intent').value = 'Become an AI consultant';
  logger.clickAction();
  logger.clickAction();
  logger.field('pitched').value = 'No';
  logger.clickAction();
  await flushPromises();

  const saved = logger.storageCalls.at(-1)[0].entries.at(-1);
  assert.equal(saved.intent, 'Become an AI consultant');
});

test('uses browser local time for call logger appointments', async () => {
  const logger = loadContentScript();

  logger.clickPickedUp();
  logger.clickAction();
  logger.clickAction();
  logger.field('pitched').value = 'High Ticket';
  logger.clickAction();
  logger.field('appointmentDate').value = '2026-09-20T10:00';
  assert.equal(logger.field('appointmentTimeZone'), undefined);
  logger.clickAction();
  await flushPromises();

  const saved = logger.storageCalls.at(-1)[0].entries.at(-1);
  assert.equal(saved.appointmentDate, new Date('2026-09-20T10:00').toISOString());
});

test('saves directly when the pitch is declined, without a separate outcome step', async () => {
  const logger = loadContentScript();

  logger.clickPickedUp();
  logger.clickAction();
  logger.field('objectionHadToGo').checked = true;
  logger.field('objectionJustCurious').checked = true;
  logger.clickAction();
  logger.field('pitched').value = 'No';
  logger.clickAction();
  await flushPromises();

  const saved = logger.storageCalls.at(-1)[0].entries.at(-1);
  assert.equal(saved.pitched, 'No');
  assert.equal(saved.objections, 'Had to go, Just curious');
  assert.equal(saved.leaveReason, undefined);
  assert.equal(saved.calledBack, undefined);
  assert.equal(saved.notes, undefined);
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
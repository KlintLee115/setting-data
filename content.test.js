const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const contentScript = fs.readFileSync(`${__dirname}/content.js`, 'utf8');

function loadContentScript(storageGetError) {
  let pickedUpHandler;
  const consoleErrors = [];
  const pickedUpButton = {
    addEventListener(eventName, handler) {
      if (eventName === 'click') pickedUpHandler = handler;
    }
  };
  const noAnswerButton = { addEventListener() {} };
  const shadowRoot = {
    set innerHTML(value) {},
    querySelector(selector) {
      return selector === '.picked-up' ? pickedUpButton : noAnswerButton;
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
    createElement() {
      return host;
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
            return Promise.reject(storageGetError);
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
  return { clickPickedUp: () => pickedUpHandler(), consoleErrors };
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
  const { clickPickedUp, consoleErrors } = loadContentScript(new Error('Storage unavailable'));
  clickPickedUp();
  await flushPromises();

  assert.equal(consoleErrors.length, 1);
  assert.equal(consoleErrors[0][0], 'Could not save call:');
  assert.match(consoleErrors[0][1].message, /Storage unavailable/);
});
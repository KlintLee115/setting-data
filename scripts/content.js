(() => {
  const ROOT_ID = 'ghl-call-log-root';
  const POLL_INTERVAL = 750;
  const STORAGE_RETRY_DELAYS = [250, 1000];
  const PENDING_LEAD_KEY = 'pendingLead';
  const headerSelectors = [
    '[data-testid="CENTRALPANEL_NAME"]',
    '[data-testid="CONTACT_NAME"]',
    '[data-testid="CONVERSATION_CONTACT_NAME"]',
    '[data-testid*="contact-name" i]',
    '[data-testid*="contact_name" i]',
    '[data-testid*="contactname" i]',
    '[data-testid*="conversation"] [data-testid*="name" i]',
    '[data-testid*="contact"] [data-testid*="name" i]',
    '[data-testid*="conversation"] h1',
    '[data-testid*="conversation"] h2',
    '[data-testid*="contact"] h1',
    '[data-testid*="contact"] h2',
    '[class*="conversation"] h1',
    '[class*="conversation"] h2',
    '[class*="contact"] h1',
    '[class*="contact"] h2'
  ];

  let currentContactKey = '';
  let currentName = '';
  let overlayVisible = false;
  let lastUrl = window.location.href;
  let host = null;
  let saveInProgress = false;
  let callFlow = null;

  function normalizeName(value) {
    return value.replace(/\s+/g, ' ').replace(/\s+\.$/, '').trim();
  }

  function isLikelyLeadName(value) {
    return /^[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,3}$/.test(value)
      && !/^(conversation|messages|inbox|contacts?)$/i.test(value);
  }

  function getLeadName() {
    for (const selector of headerSelectors) {
      const element = document.querySelector(selector);
      const name = element ? normalizeName(element.textContent || '') : '';
      if (name && name.length <= 120 && isLikelyLeadName(name)) {
        return name;
      }
    }

    const headings = [...document.querySelectorAll('h1, h2, [role="heading"]')];
    const heading = headings
      .map((element) => normalizeName(element.textContent || ''))
      .find((text) => text && text.length <= 120 && isLikelyLeadName(text));

    return heading || '';
  }

  function getContactKey(name) {
    return `${window.location.pathname}|${window.location.search}|${name.toLowerCase()}`;
  }

  function isExtensionContextError(error) {
    return !chrome?.storage?.local
      || /extension context invalidated/i.test(String(error?.message || error));
  }

  async function withStorageRetry(operation) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const storage = chrome?.storage?.local;
        if (!storage) {
          throw new Error('Extension context invalidated.');
        }
        return await operation(storage);
      } catch (error) {
        if (!isExtensionContextError(error) || attempt >= STORAGE_RETRY_DELAYS.length) {
          throw error;
        }
        await new Promise((resolve) => window.setTimeout(resolve, STORAGE_RETRY_DELAYS[attempt]));
      }
    }
  }

  function getNoAnswerMessage(variant) {
    const firstName = currentName.trim().split(/\s+/)[0] || 'there';
    const eventLine = variant === 'vip'
      ? 'Saw you recently registefred for our AI Business summit and even upgraded to VIP! Just to see if I can help u get more out of it'
      : 'Saw you recently registefred for our AI Business summit... Just to see if I can help u get more out of it';
    return `Hey ${firstName}, Klint here from Alicia's team (not AI, I promise 😂)\n\n${eventLine}\n\nAre you looking to implement AI with your current biz or are you just starting out with AI biz?`;
  }

  function fillNoAnswerMessage(variant) {
    const message = getNoAnswerMessage(variant);
    const composer = document.querySelector('#conv-composer-textarea-input')
      || document.querySelector('input[placeholder="Type a message"]')
      || document.querySelector('textarea[placeholder="Type a message"]');
    if (composer) {
      const valueSetter = Object.getOwnPropertyDescriptor(
        composer.constructor?.prototype,
        'value'
      )?.set;
      if (valueSetter) {
        valueSetter.call(composer, message);
      } else {
        composer.value = message;
      }
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      composer.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return message;
  }

  function saveCallSafely(status, details = {}) {
    void Promise.resolve()
      .then(() => saveCall(status, details))
      .catch((error) => {
        if (!isExtensionContextError(error)) {
          console.error('Could not save call:', error);
        }
        setOverlayMessage(isExtensionContextError(error)
          ? 'Extension reloaded. Refresh this tab, then try again.'
          : 'Could not save call. Try again.');
      });
  }

  function getLocalDateTimeValue(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Denver',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).reduce((values, part) => {
      values[part.type] = part.value;
      return values;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function zonedDateTimeToDate(value, timeZone) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) {
      return new Date(value);
    }
    const wallClockUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
    let timestamp = wallClockUtc;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date(timestamp)).reduce((values, part) => {
        values[part.type] = part.value;
        return values;
      }, {});
      const offset = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour), Number(parts.minute), Number(parts.second)) - timestamp;
      timestamp = wallClockUtc - offset;
    }
    return new Date(timestamp);
  }

  function publishLeadSafely(name, callDateTime = '') {
    void Promise.resolve()
      .then(() => withStorageRetry((storage) => storage.set({
        [PENDING_LEAD_KEY]: {
          fullName: name,
          callDateTime,
          sourceUrl: window.location.href,
          updatedAt: new Date().toISOString()
        }
      })))
      .catch((error) => {
      if (!isExtensionContextError(error)) {
        console.error('Could not publish lead:', error);
      }
      });
  }

  function ensureOverlay() {
    if (host?.isConnected) {
      return host;
    }

    host = null;
    host = document.createElement('div');
    host.id = ROOT_ID;
    host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;display:none;';
    host.attachShadow({ mode: 'open' });
    host.shadowRoot.innerHTML = `
      <style>
        .panel { display: grid; gap: 8px; min-width: 180px; padding: 12px; border: 1px solid #d8e0eb; border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(23, 32, 51, .18); color: #172033; font: 12px Segoe UI, sans-serif; }
        .name { overflow: hidden; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
        .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .fields { display: grid; gap: 6px; }
        .message-choice-heading { color: #29364a; font-weight: 700; }
        .message-choice { display: grid; gap: 4px; padding: 7px; border: 1px solid #e1e7ef; border-radius: 5px; }
        .message-preview { overflow: hidden; color: #718096; font-size: 10px; line-height: 1.35; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
        .message-choice details { color: #245a95; font-size: 10px; }
        .message-choice details div { max-height: 130px; overflow-y: auto; margin-top: 4px; color: #29364a; white-space: pre-wrap; }
        label { display: grid; gap: 3px; color: #718096; font-size: 10px; font-weight: 700; }
        input, select, textarea { width: 100%; min-height: 30px; padding: 5px 7px; border: 1px solid #d8e0eb; border-radius: 5px; color: #29364a; font: inherit; }
        textarea { min-height: 48px; resize: vertical; }
        .cancel { min-width: 24px; min-height: 24px; padding: 0; border: 0; color: #718096; font-size: 18px; line-height: 1; }
        button { min-height: 30px; border: 1px solid #b8cbe2; border-radius: 5px; background: #fff; color: #245a95; cursor: pointer; font: inherit; font-weight: 700; }
        button:hover { background: #f0f4f9; }
        .message { min-height: 14px; color: #9b3034; font-size: 11px; }
      </style>
        <div class="panel">
        <div class="panel-head"><div class="name"></div><button class="cancel" type="button" aria-label="Cancel call entry" title="Cancel">&times;</button></div>
        <div class="fields"></div>
        <div class="actions"></div>
        <div class="message" aria-live="polite"></div>
      </div>`;
    host.shadowRoot.querySelector('.cancel').addEventListener('click', cancelCallFlow);
    document.documentElement.appendChild(host);
    renderCallFlow();
    return host;
  }

  function createField(tagName, className, labelText, attributes = {}) {
    const label = document.createElement('label');
    const text = document.createElement('span');
    const field = document.createElement(tagName);
    text.textContent = labelText;
    Object.entries(attributes).forEach(([name, value]) => {
      field[name] = value;
    });
    field.className = className;
    label.append(text, field);
    return { field, label };
  }

  function addSelectField(container, key, labelText, options) {
    const { field, label } = createField('select', key, labelText);
    options.forEach(([value, text]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      field.appendChild(option);
    });
    field.value = callFlow.data[key] || '';
    container.appendChild(label);
    return field;
  }

  function addTextField(container, key, labelText, type = 'text') {
    const { field, label } = createField('input', key, labelText, { type });
    field.value = callFlow.data[key] || '';
    container.appendChild(label);
    return field;
  }

  function addNotesField(container) {
    const { field, label } = createField('textarea', 'notes', 'Notes');
    field.value = callFlow.data.notes || '';
    container.appendChild(label);
    return field;
  }

  function nextButton(text, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.addEventListener('click', handler);
    return button;
  }

  function renderCallFlow() {
    if (!host) return;
    const fields = host.shadowRoot.querySelector('.fields');
    const actions = host.shadowRoot.querySelector('.actions');
    fields.replaceChildren();
    actions.replaceChildren();
    if (!callFlow) {
      const pickedUp = nextButton('Picked up', () => startCallFlow('Picked Up'));
      pickedUp.className = 'picked-up';
      const noAnswer = nextButton('No answer', () => {
        callFlow = { status: 'No Answer', step: 'message-choice', data: {} };
        renderCallFlow();
      });
      noAnswer.className = 'no-answer';
      actions.append(pickedUp, noAnswer);
      return;
    }
    if (callFlow.step === 'message-choice') {
      const heading = document.createElement('div');
      heading.textContent = 'Which message do you want to use?';
      heading.className = 'message-choice-heading';
      fields.appendChild(heading);
      [['vip', 'Use VIP message'], ['standard', 'Use standard message']].forEach(([variant, label]) => {
        const message = getNoAnswerMessage(variant);
        const choice = document.createElement('div');
        choice.className = 'message-choice';
        const preview = document.createElement('div');
        preview.className = 'message-preview';
        preview.textContent = `${message.slice(0, 135)}...`;
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Read full message...';
        const fullMessage = document.createElement('div');
        fullMessage.textContent = message;
        details.append(summary, fullMessage);
        choice.append(preview, details);
        fields.appendChild(choice);
        actions.append(nextButton(label, () => {
          const lastTextMessage = fillNoAnswerMessage(variant);
          saveCallSafely('No Answer', { lastTextMessage });
        }));
      });
      actions.append(nextButton('Leave blank', () => saveCallSafely('No Answer')));
    } else if (callFlow.step === 'qualification') {
      const disqualified = addSelectField(fields, 'disqualified', 'Disqualified?', [['', 'Select'], ['Yes', 'Yes'], ['No', 'No']]);
      actions.append(nextButton('Next', () => {
        callFlow.data.disqualified = disqualified.value;
        callFlow.step = disqualified.value === 'Yes' ? 'disqualification' : 'pitch';
        renderCallFlow();
      }));
    } else if (callFlow.step === 'disqualification') {
      const reason = addTextField(fields, 'disqualificationReason', 'Reason');
      addNotesField(fields);
      actions.append(nextButton('Save', () => {
        callFlow.data.disqualificationReason = reason.value;
        callFlow.data.notes = fields.querySelector('.notes').value;
        saveCallSafely('Picked Up', callFlow.data);
      }));
    } else if (callFlow.step === 'pitch') {
      const pitched = addSelectField(fields, 'pitched', 'Were you able to pitch?', [['', 'Select'], ['Yes', 'Yes'], ['No', 'No']]);
      actions.append(nextButton('Next', () => {
        callFlow.data.pitched = pitched.value;
        callFlow.step = pitched.value === 'Yes' ? 'setting' : 'outcome';
        renderCallFlow();
      }));
    } else if (callFlow.step === 'setting') {
      const wasSet = addSelectField(fields, 'wasSet', 'Were you able to set?', [['', 'Select'], ['Yes', 'Yes'], ['No', 'No']]);
      actions.append(nextButton('Next', () => {
        callFlow.data.wasSet = wasSet.value;
        callFlow.step = wasSet.value === 'Yes' ? 'appointment' : 'outcome';
        renderCallFlow();
      }));
    } else if (callFlow.step === 'appointment') {
      const closer = addTextField(fields, 'closer', 'Closer');
      const appointmentDate = addTextField(fields, 'appointmentDate', 'Appointment date/time', 'datetime-local');
      addTextField(fields, 'followUpDate', 'Follow-up date', 'date');
      addSelectField(fields, 'appointmentTimeZone', 'Appointment timezone', [
        ['America/Denver', 'Mountain Time'], ['America/Los_Angeles', 'Pacific Time'],
        ['America/Chicago', 'Central Time'], ['America/New_York', 'Eastern Time'], ['UTC', 'UTC']
      ]);
      addNotesField(fields);
      actions.append(nextButton('Save', () => {
        callFlow.data.closer = closer.value;
        callFlow.data.appointmentDate = appointmentDate.value
          ? zonedDateTimeToDate(appointmentDate.value, fields.querySelector('.appointmentTimeZone').value).toISOString()
          : '';
        callFlow.data.followUpDate = fields.querySelector('.followUpDate').value;
        callFlow.data.appointmentTimeZone = fields.querySelector('.appointmentTimeZone').value;
        callFlow.data.notes = fields.querySelector('.notes').value;
        saveCallSafely('Picked Up', callFlow.data);
      }));
    } else {
      const leaveReason = addSelectField(fields, 'leaveReason', 'Conversation outcome', [['', 'Select'], ['Had to go', 'Had to go'], ['Money', 'Money'], ['Partner', 'Partner'], ['Timing', 'Timing']]);
      const calledBack = addSelectField(fields, 'calledBack', 'Called back?', [['', 'Select'], ['Yes', 'Yes'], ['No', 'No']]);
      addNotesField(fields);
      actions.append(nextButton('Save', () => {
        callFlow.data.leaveReason = leaveReason.value;
        callFlow.data.calledBack = leaveReason.value === 'Had to go' ? calledBack.value : '';
        callFlow.data.notes = fields.querySelector('.notes').value;
        saveCallSafely('Picked Up', callFlow.data);
      }));
    }
  }

  function startCallFlow(status) {
    callFlow = { status, step: 'qualification', data: {} };
    renderCallFlow();
  }

  function cancelCallFlow() {
    callFlow = null;
    overlayVisible = false;
    setOverlayMessage('');
    renderOverlay();
  }

  async function saveCall(status, details = {}) {
    if (!currentName || saveInProgress) {
      return;
    }
    saveInProgress = true;

    try {
      const callDateTime = getLocalDateTimeValue();
      publishLeadSafely(currentName, callDateTime);
      const stored = await withStorageRetry((storage) => storage.get({ entries: [], callLogs: [], manualEntries: [] }));
      const entries = Array.isArray(stored.entries) && stored.entries.length
        ? stored.entries
        : [
          ...(Array.isArray(stored.callLogs) ? stored.callLogs : []).map((entry) => ({ ...entry, recordType: 'call' })),
          ...(Array.isArray(stored.manualEntries) ? stored.manualEntries : []).map((entry) => ({ ...entry, recordType: 'entry' }))
        ];
      const timestamp = new Date().toISOString();
      const durationMatch = document.body.innerText.match(/(?:call completed[\s\S]{0,120}?)?(\d{1,2}:\d{2})\s*\/\s*(\d{1,2}:\d{2})/i);
      const call = {
        id: `${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
        recordType: 'call',
        name: currentName,
        sourceUrl: window.location.href,
        status,
        phonePickedUp: status === 'Picked Up' ? 'Yes' : 'No',
        callDateTime,
        callDuration: durationMatch ? durationMatch[2] : '',
        timestamp,
        ...details
      };
      entries.push(call);
      await withStorageRetry((storage) => storage.set({
        entries,
        callLogs: entries.filter((entry) => entry.recordType === 'call'),
        manualEntries: entries.filter((entry) => entry.recordType !== 'call')
      }));
      overlayVisible = false;
      callFlow = null;
      renderOverlay();
    } finally {
      saveInProgress = false;
    }
  }

  function setOverlayMessage(message) {
    if (!host) {
      return;
    }
    const messageElement = host.shadowRoot.querySelector('.message');
    if (messageElement) {
      messageElement.textContent = message;
    }
  }

  function renderOverlay() {
    const host = ensureOverlay();
    const nameElement = host.shadowRoot.querySelector('.name');
    nameElement.textContent = currentName;
    if (currentName && overlayVisible && !callFlow) {
      renderCallFlow();
    }
    host.style.display = currentName && overlayVisible ? 'block' : 'none';
  }

  function scanPage() {
    const name = getLeadName();
    const contactKey = name ? getContactKey(name) : '';

    if (contactKey && contactKey !== currentContactKey) {
      currentContactKey = contactKey;
      currentName = name;
      callFlow = null;
      overlayVisible = true;
      publishLeadSafely(name);
    } else if (!contactKey) {
      currentName = '';
      overlayVisible = false;
    }

    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      if (contactKey) {
        currentContactKey = contactKey;
        overlayVisible = true;
      }
    }

    renderOverlay();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'show-call-logger') {
      return;
    }
    if (host && !host.isConnected) {
      host = null;
    }
    scanPage();
    sendResponse({ shown: Boolean(currentName && overlayVisible) });
  });

  const observer = new MutationObserver(() => scanPage());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(scanPage, POLL_INTERVAL);
  scanPage();
})();

(() => {
  const ROOT_ID = 'ghl-call-log-root';
  const POLL_INTERVAL = 750;
  const PENDING_LEAD_KEY = 'pendingLead';
  const headerSelectors = [
    '[data-testid="CENTRALPANEL_NAME"]',
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
    return /^[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){1,3}$/.test(value)
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

  function saveCallSafely(status, details = {}) {
    void Promise.resolve()
      .then(() => saveCall(status, details))
      .catch((error) => {
        if (!/extension context invalidated/i.test(String(error?.message || error))) {
          console.error('Could not save call:', error);
        }
        setOverlayMessage(/extension context invalidated/i.test(String(error?.message || error))
          ? 'Reload this page to reconnect the logger.'
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

  function publishLeadSafely(name, callDateTime = '') {
    void Promise.resolve()
      .then(() => chrome.storage.local.set({
        [PENDING_LEAD_KEY]: {
          fullName: name,
          callDateTime,
          sourceUrl: window.location.href,
          updatedAt: new Date().toISOString()
        }
      }))
      .catch((error) => {
      if (!/extension context invalidated/i.test(String(error?.message || error))) {
        console.error('Could not publish lead:', error);
      }
      });
  }

  function ensureOverlay() {
    if (host) {
      return host;
    }

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
      const noAnswer = nextButton('No answer', () => saveCallSafely('No Answer'));
      noAnswer.className = 'no-answer';
      actions.append(pickedUp, noAnswer);
      return;
    }
    if (callFlow.step === 'qualification') {
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
        callFlow.data.appointmentDate = appointmentDate.value ? new Date(appointmentDate.value).toISOString() : '';
        callFlow.data.followUpDate = fields.querySelector('.followUpDate').value;
        callFlow.data.appointmentTimeZone = fields.querySelector('.appointmentTimeZone').value;
        callFlow.data.notes = fields.querySelector('.notes').value;
        saveCallSafely('Picked Up', callFlow.data);
      }));
    } else {
      const leaveReason = addSelectField(fields, 'leaveReason', 'Conversation outcome', [['', 'Select'], ['Had to go', 'Had to go'], ['Money', 'Money'], ['Partner', 'Partner'], ['Timing', 'Timing']]);
      addNotesField(fields);
      actions.append(nextButton('Save', () => {
        callFlow.data.leaveReason = leaveReason.value;
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
    setOverlayMessage('Saving...');

    try {
      const callDateTime = getLocalDateTimeValue();
      publishLeadSafely(currentName, callDateTime);
      const stored = await chrome.storage.local.get({ entries: [], callLogs: [], manualEntries: [] });
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
        status,
        phonePickedUp: status === 'Picked Up' ? 'Yes' : 'No',
        callDateTime,
        callDuration: durationMatch ? durationMatch[2] : '',
        timestamp,
        ...details
      };
      entries.push(call);
      await chrome.storage.local.set({
        entries,
        callLogs: entries.filter((entry) => entry.recordType === 'call'),
        manualEntries: entries.filter((entry) => entry.recordType !== 'call')
      });
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

  const observer = new MutationObserver(() => scanPage());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(scanPage, POLL_INTERVAL);
  scanPage();
})();

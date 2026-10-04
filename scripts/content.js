(() => {
  const ROOT_ID = 'ghl-call-log-root';
  const POLL_INTERVAL = 750;
  const STORAGE_RETRY_DELAYS = [250, 1000];
  const PENDING_LEAD_KEY = 'pendingLead';
  const LEAD_TIME_ZONE_OPTIONS = [
    ['', 'Select'],
    ...Array.from({ length: 27 }, (_, index) => {
      const offset = index - 12;
      return [offset === 0 ? 'GMT' : `GMT${offset > 0 ? '+' : ''}${offset}`, offset === 0 ? 'GMT' : `GMT${offset > 0 ? '+' : ''}${offset}`];
    })
  ];
  const SOURCE_OPTIONS = [
    ['', 'Select source'],
    ['GA Summit Sept Form', 'GA Summit Sept Form'],
    ['Inbound', 'Inbound'],
    ['Elective declined', 'Elective declined'],
    ['Elective approved', 'Elective approved'],
    ['abandoned aicc', 'abandoned aicc'],
    ['abandoned agents', 'abandoned agents']
  ];
  const MESSAGE_VARIANTS = [
    ['followup', 'Use follow-up message'],
    ['standard', 'Use standard message'],
    ['form', 'Use certification form message'],
    ['build', 'Use Build It Launch It message']
  ];
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

  function getDetectedLeadTimeZone() {
    const element = document.querySelector('[id="contact.timezone"] .hr-base-selection-overlay__wrapper');
    const match = /^GMT([+-])(\d{2}):(\d{2})/.exec(normalizeName(element?.textContent || ''));
    if (!match || match[3] !== '00') {
      return '';
    }
    const hours = Number(match[2]);
    return hours === 0 ? 'GMT' : `GMT${match[1]}${hours}`;
  }

  function getTouchHistory() {
    const bubbles = typeof document.querySelectorAll === 'function'
      ? Array.from(document.querySelectorAll('.message-item .chat-bubble-outbound') || [])
      : [];
    const touchedBy = [];
    bubbles.forEach((bubble) => {
      const initials = normalizeName(
        bubble.closest('.message-item')?.querySelector('.hr-avatar__text p')?.textContent || ''
      ).toUpperCase();
      if (initials && !touchedBy.includes(initials)) {
        touchedBy.push(initials);
      }
    });
    const callMatches = String(document.body?.innerText || '').match(/call completed|no answer/gi);
    return {
      priorDms: bubbles.length,
      priorCalls: callMatches ? callMatches.length : 0,
      touchedBy: touchedBy.join(', ')
    };
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
    if (variant === 'followup') {
      return `Heyy ${firstName}, Klint here from Alicia Lyttle's AI team 😊 \n\n did u get my msg?`;
    }
    const eventLine = {
      form: 'I saw that you filled out the form for the AI Consultancy Certification to possibly leverage AI more in your biz, or become an AI consultant.',
      standard: 'I saw that you registered for the AI Marketing Summit to possibly make more money or have more freedom.',
      build: 'I saw that you signed up for the Build It Launch It challenge.'
    }[variant];
    const baseMessage = `Heyy ${firstName}, this is Klint with Alicia Lyttle's AI team 😊 \n\n${eventLine}\n\n We are just checking on all the vip members - how did the summit go for you?`;
    if (variant === 'build') {
      return baseMessage;
    }
    return baseMessage;
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

  function saveDmSafely(details = {}) {
    void Promise.resolve()
      .then(() => saveDm(details))
      .catch((error) => {
        if (!isExtensionContextError(error)) {
          console.error('Could not save DM:', error);
        }
        setOverlayMessage(isExtensionContextError(error)
          ? 'Extension reloaded. Refresh this tab, then try again.'
          : 'Could not save DM. Try again.');
      });
  }

  function getLocalDateTimeValue(date = new Date()) {
    const pad = (part) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

  function addTextAreaField(container, key, labelText) {
    const { field, label } = createField('textarea', key, labelText);
    field.value = callFlow.data[key] || '';
    container.appendChild(label);
    return field;
  }

  function addCheckboxField(container, key, labelText) {
    const { field, label } = createField('input', key, labelText, { type: 'checkbox' });
    field.checked = !!callFlow.data[key];
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

  function addMessageChoice(fields, variant, label, onChoose) {
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
    return nextButton(label, () => onChoose(message));
  }

  function renderCallFlow() {
    if (!host) return;
    const fields = host.shadowRoot.querySelector('.fields');
    const actions = host.shadowRoot.querySelector('.actions');
    fields.replaceChildren();
    actions.replaceChildren();
    if (!callFlow) {
      const pickedUp = nextButton('Picked up', () => startCallFlow());
      pickedUp.className = 'picked-up';
      const noAnswer = nextButton('No answer', () => {
        callFlow = { step: 'message-choice', data: { leadTimeZone: getDetectedLeadTimeZone(), ...getTouchHistory() } };
        renderCallFlow();
      });
      noAnswer.className = 'no-answer';
      const logDm = nextButton('Log DM', () => {
        callFlow = { step: 'dm', data: getTouchHistory() };
        renderCallFlow();
      });
      actions.append(pickedUp, noAnswer, logDm);
      return;
    }
    if (callFlow.step === 'dm') {
      const source = addSelectField(fields, 'source', 'Source', SOURCE_OPTIONS);
      const channel = addSelectField(fields, 'dmChannel', 'Channel', [
        ['', 'Select'],
        ['iMessage', 'iMessage'],
        ['SMS', 'SMS']
      ]);
      const message = createField('textarea', 'dmMessage', 'Message sent');
      message.field.value = callFlow.data.dmMessage || '';
      fields.appendChild(message.label);
      MESSAGE_VARIANTS.forEach(([variant, label]) => {
        actions.append(addMessageChoice(fields, variant, label, () => {
          message.field.value = fillNoAnswerMessage(variant);
        }));
      });
      const outcome = addSelectField(fields, 'dmOutcome', 'Outcome', [
        ['Sent', 'Sent'],
        ['Replied', 'Replied'],
        ['Qualified', 'Qualified'],
        ['Booked', 'Booked']
      ]);
      outcome.value = callFlow.data.dmOutcome || 'Sent';
      actions.append(nextButton('Save DM', () => {
        if (!source.value) {
          setOverlayMessage('Select a source before saving.');
          return;
        }
        saveDmSafely({
          priorDms: callFlow.data.priorDms,
          priorCalls: callFlow.data.priorCalls,
          touchedBy: callFlow.data.touchedBy,
          source: source.value,
          dmChannel: channel.value,
          dmMessage: message.field.value,
          dmOutcome: outcome.value
        });
      }));
    } else if (callFlow.step === 'message-choice') {
      const source = addSelectField(fields, 'source', 'Source', SOURCE_OPTIONS);
      const leadTimeZone = addSelectField(fields, 'leadTimeZone', 'Lead timezone', LEAD_TIME_ZONE_OPTIONS);
      const heading = document.createElement('div');
      heading.textContent = 'Which message do you want to use?';
      heading.className = 'message-choice-heading';
      fields.appendChild(heading);
      MESSAGE_VARIANTS.forEach(([variant, label]) => {
        actions.append(addMessageChoice(fields, variant, label, () => {
          if (!source.value) {
            setOverlayMessage('Select a source before saving.');
            return;
          }
          const lastTextMessage = fillNoAnswerMessage(variant);
          saveCallSafely('No Answer', { source: source.value, leadTimeZone: leadTimeZone.value, lastTextMessage });
        }));
      });
      actions.append(nextButton('Leave blank', () => {
        if (!source.value) {
          setOverlayMessage('Select a source before saving.');
          return;
        }
        saveCallSafely('No Answer', {
          ...callFlow.data,
          source: source.value,
          leadTimeZone: leadTimeZone.value
        });
      }));
    } else if (callFlow.step === 'qualification') {
      const source = addSelectField(fields, 'source', 'Source', SOURCE_OPTIONS);
      const leadTimeZone = addSelectField(fields, 'leadTimeZone', 'Lead timezone', LEAD_TIME_ZONE_OPTIONS);
      const intent = addTextAreaField(fields, 'intent', 'Intent (their answer to “What are you looking for?”)');
      actions.append(nextButton('Next', () => {
        if (!source.value) {
          setOverlayMessage('Select a source before continuing.');
          return;
        }
        callFlow.data.source = source.value;
        callFlow.data.leadTimeZone = leadTimeZone.value;
        callFlow.data.intent = intent.value;
        callFlow.step = 'details';
        renderCallFlow();
      }));
    } else if (callFlow.step === 'details') {
      const talkTime = addTextField(fields, 'talkTime', 'Talk time (MM:SS)');
      const clientTypeOptions = [
        ['9-5', addCheckboxField(fields, 'clientType9to5', '9-5')],
        ['Business Owner', addCheckboxField(fields, 'clientTypeBusinessOwner', 'Business Owner')]
      ];
      const objectionCheckboxes = OBJECTION_OPTIONS.map(([key, label]) => [label, addCheckboxField(fields, key, label)]);
      const notes = addTextAreaField(fields, 'notes', 'Notes (why they did not proceed)');
      actions.append(nextButton('Next', () => {
        callFlow.data.talkTime = talkTime.value;
        callFlow.data.clientType = clientTypeOptions
          .filter(([, checkbox]) => checkbox.checked)
          .map(([label]) => label)
          .join(', ');
        callFlow.data.objections = objectionCheckboxes
          .filter(([, checkbox]) => checkbox.checked)
          .map(([label]) => label)
          .join(', ');
        callFlow.data.notes = notes.value;
        callFlow.step = 'pitch';
        renderCallFlow();
      }));
    } else if (callFlow.step === 'pitch') {
      const pitched = addSelectField(fields, 'pitched', 'Pitch outcome', [['', 'Select'], ['No', 'No'], ['Low Ticket', 'Low ticket self close'], ['High Ticket', 'High ticket booking']]);
      actions.append(nextButton('Next', () => {
        callFlow.data.pitched = pitched.value;
        if (pitched.value === 'High Ticket') {
          callFlow.step = 'appointment';
          renderCallFlow();
        } else {
          saveCallSafely('Picked Up', callFlow.data);
        }
      }));
    } else if (callFlow.step === 'appointment') {
      const closer = addTextField(fields, 'closer', 'Closer name');
      const appointmentDate = addTextField(fields, 'appointmentDate', 'Appointment date/time', 'datetime-local');
      actions.append(nextButton('Save', () => {
        callFlow.data.closer = closer.value;
        callFlow.data.appointmentDate = appointmentDate.value
          ? new Date(appointmentDate.value).toISOString()
          : '';
        saveCallSafely('Picked Up', callFlow.data);
      }));
    }
  }

  function startCallFlow() {
    callFlow = { step: 'qualification', data: { leadTimeZone: getDetectedLeadTimeZone(), ...getTouchHistory() } };
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
      entries.forEach((entry) => {
        delete entry.contactHistory;
        delete entry.hasContactedBefore;
        delete entry['has contacted before'];
        delete entry.hasShownIntentBefore;
        delete entry.shownIntent;
        delete entry.talkToListenRatio;
        const legacyNotes = [entry.disqualificationReason, entry.objectionNotes].filter(Boolean).join(' | ');
        if (legacyNotes) {
          entry.notes = [entry.notes, legacyNotes].filter(Boolean).join(' | ');
        }
        delete entry.objectionNotes;
        delete entry.disqualified;
        delete entry.disqualificationReason;
      });
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

  async function saveDm(details = {}) {
    if (!currentName || saveInProgress) {
      return;
    }
    saveInProgress = true;

    try {
      const timestamp = new Date().toISOString();
      publishLeadSafely(currentName);
      const stored = await withStorageRetry((storage) => storage.get({ entries: [], callLogs: [], manualEntries: [] }));
      const entries = Array.isArray(stored.entries) && stored.entries.length
        ? stored.entries
        : [
          ...(Array.isArray(stored.callLogs) ? stored.callLogs : []).map((entry) => ({ ...entry, recordType: 'call' })),
          ...(Array.isArray(stored.manualEntries) ? stored.manualEntries : []).map((entry) => ({ ...entry, recordType: 'entry' }))
        ];
      entries.forEach((entry) => {
        delete entry.contactHistory;
        delete entry.hasContactedBefore;
        delete entry['has contacted before'];
        delete entry.hasShownIntentBefore;
        delete entry.shownIntent;
        delete entry.talkToListenRatio;
        const legacyNotes = [entry.disqualificationReason, entry.objectionNotes].filter(Boolean).join(' | ');
        if (legacyNotes) {
          entry.notes = [entry.notes, legacyNotes].filter(Boolean).join(' | ');
        }
        delete entry.objectionNotes;
        delete entry.disqualified;
        delete entry.disqualificationReason;
      });
      entries.push({
        id: `${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
        recordType: 'dm',
        name: currentName,
        sourceUrl: window.location.href,
        status: details.dmOutcome || 'Sent',
        dmDateTime: timestamp,
        timestamp,
        ...details
      });
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

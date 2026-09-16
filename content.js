(() => {
  const ROOT_ID = 'ghl-call-log-root';
  const POLL_INTERVAL = 750;
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

  function saveCallSafely(status) {
    void Promise.resolve()
      .then(() => saveCall(status))
      .catch((error) => {
        if (!/extension context invalidated/i.test(String(error?.message || error))) {
          console.error('Could not save call:', error);
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
        .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        button { min-height: 30px; border: 1px solid #b8cbe2; border-radius: 5px; background: #fff; color: #245a95; cursor: pointer; font: inherit; font-weight: 700; }
        button:hover { background: #f0f4f9; }
      </style>
      <div class="panel">
        <div class="name"></div>
        <div class="actions">
          <button class="picked-up" type="button">Picked up</button>
          <button class="no-answer" type="button">No answer</button>
        </div>
      </div>`;
    host.shadowRoot.querySelector('.picked-up').addEventListener('click', () => {
      saveCallSafely('Picked Up');
    });
    host.shadowRoot.querySelector('.no-answer').addEventListener('click', () => {
      saveCallSafely('No Answer');
    });
    document.documentElement.appendChild(host);
    return host;
  }

  async function saveCall(status) {
    if (!currentName) {
      return;
    }

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
      callDateTime: timestamp,
      callDuration: durationMatch ? durationMatch[2] : '',
      timestamp
    };
    entries.push(call);
    await chrome.storage.local.set({
      entries,
      callLogs: entries.filter((entry) => entry.recordType === 'call'),
      manualEntries: entries.filter((entry) => entry.recordType !== 'call')
    });
    overlayVisible = false;
    renderOverlay();
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
      overlayVisible = true;
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

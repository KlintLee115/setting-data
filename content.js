(() => {
  const ROOT_ID = 'ghl-call-log-root';
  const POLL_INTERVAL = 750;
  const headerSelectors = [
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

  function normalizeName(value) {
    return value.replace(/\\s+/g, ' ').trim();
  }

  function getLeadName() {
    for (const selector of headerSelectors) {
      const element = document.querySelector(selector);
      const name = element ? normalizeName(element.textContent || '') : '';
      if (name && name.length <= 120) {
        return name;
      }
    }

    const headings = [...document.querySelectorAll('h1, h2, [role="heading"]')];
    const heading = headings
      .map((element) => normalizeName(element.textContent || ''))
      .find((text) => text && text.length <= 120 && !/conversation|messages|inbox/i.test(text));

    return heading || '';
  }

  function getContactKey(name) {
    return `${window.location.pathname}|${window.location.search}|${name.toLowerCase()}`;
  }

  function ensureOverlay() {
    let host = document.getElementById(ROOT_ID);
    if (host) {
      return host;
    }

    host = document.createElement('div');
    host.id = ROOT_ID;
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    host.style.inset = 'auto 20px 20px auto';
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .panel { width: 290px; box-sizing: border-box; padding: 16px; color: #172033; background: #ffffff; border: 1px solid #e1e7ef; border-radius: 12px; box-shadow: 0 12px 35px rgba(20, 34, 58, .18); }
        .eyebrow { margin: 0 0 5px; color: #718096; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
        .name { margin: 0 0 14px; overflow: hidden; color: #172033; font-size: 16px; font-weight: 700; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
        .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        button { min-height: 38px; padding: 8px 10px; border: 0; border-radius: 8px; color: #ffffff; cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; transition: transform .15s ease, filter .15s ease; }
        button:hover { filter: brightness(.96); transform: translateY(-1px); }
        button:focus-visible { outline: 3px solid rgba(49, 130, 206, .35); outline-offset: 2px; }
        .picked-up { background: #21835b; }
        .no-answer { background: #c24145; }
      </style>
      <section class="panel" role="dialog" aria-label="Log call outcome">
        <p class="eyebrow">Log call outcome</p>
        <p class="name"></p>
        <div class="actions">
          <button class="picked-up" type="button" data-status="Picked Up">Picked Up</button>
          <button class="no-answer" type="button" data-status="No Answer">No Answer</button>
        </div>
      </section>
    `;

    shadow.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => saveCall(button.dataset.status));
    });
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

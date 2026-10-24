(() => {
  if (window.__ghlMessageSuggestions) return;
  window.__ghlMessageSuggestions = true;

  // {name} is replaced with the lead's first name.
  const DEFAULTS = [
    { label: 'Follow-up', text: "Heyy {name}, Klint here from Alicia Lyttle's AI team 😊 \n\n did u get my msg?" },
    { label: 'Standard', text: "Heyy {name}, this is Klint with Alicia Lyttle's AI team 😊 \n\nI saw that you registered for the AI Marketing Summit to possibly make more money or have more freedom.\n\n We are just checking on all the vip members - how did the summit go for you?" },
    { label: 'Certification form', text: "Heyy {name}, this is Klint with Alicia Lyttle's AI team 😊 \n\nI saw that you filled out the form for the AI Consultancy Certification to possibly leverage AI more in your biz, or become an AI consultant.\n\n We are just checking on all the vip members - how did the summit go for you?" },
    { label: 'Build It Launch It', text: "Heyy {name}, this is Klint with Alicia Lyttle's AI team 😊 \n\nI saw that you signed up for the Build It Launch It challenge.\n\n We are just checking on all the vip members - how did the summit go for you?" }
  ];
  const HEADER_SELECTORS = [
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
    '[class*="conversation"] h2'
  ];

  const normalizeName = (value) => value.replace(/\s+/g, ' ').replace(/\s+\.$/, '').trim();
  const isLikelyLeadName = (value) => /^[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,3}$/.test(value)
    && !/^(conversation|messages|inbox|contacts?)$/i.test(value);

  function getLeadName() {
    for (const selector of HEADER_SELECTORS) {
      const element = document.querySelector(selector);
      const name = element ? normalizeName(element.textContent || '') : '';
      if (name && name.length <= 120 && isLikelyLeadName(name)) return name;
    }
    const heading = [...document.querySelectorAll('h1, h2, [role="heading"]')]
      .map((element) => normalizeName(element.textContent || ''))
      .find((text) => text && text.length <= 120 && isLikelyLeadName(text));
    return heading || '';
  }

  const buildMessage = (text) => text.split('{name}').join(getLeadName().split(/\s+/)[0] || 'there');

  function fillComposer(message) {
    const composer = document.querySelector('#conv-composer-textarea-input')
      || document.querySelector('input[placeholder="Type a message"]')
      || document.querySelector('textarea[placeholder="Type a message"]');
    if (!composer) return false;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(composer), 'value')?.set;
    if (setter) setter.call(composer, message); else composer.value = message;
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    composer.dispatchEvent(new Event('change', { bubbles: true }));
    composer.focus();
    return true;
  }

  let messages = DEFAULTS;
  const store = chrome.storage.local;
  const save = () => store.set({ messages });

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;flex-direction:column;gap:6px;width:220px;max-width:calc(100vw - 32px);padding:8px;box-sizing:border-box;background:#fff;border:1px solid #d5dbe5;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.18);font:12px Arial,sans-serif;color:#222;cursor:move;';
  document.body.appendChild(panel);

  const style = (el, css) => { el.style.cssText = css; return el; };
  const make = (tag, css, text) => { const el = style(document.createElement(tag), css); if (text) el.textContent = text; return el; };
  const BTN = 'padding:6px 10px;border:1px solid #245a95;border-radius:5px;background:#fff;color:#245a95;cursor:pointer;text-align:left;';
  const FIELD = 'width:100%;box-sizing:border-box;padding:4px;border:1px solid #c5ccd8;border-radius:4px;font:12px Arial,sans-serif;';
  const MAX_VISIBLE_MESSAGES = 6;
  let adding = false, editingIndex = null, status = '';
  let activeView = 'tracker';
  let minimized = false;
  let lastLeadName = '';
  let lastLeadUrl = '';
  const titlebar = make('div', 'display:flex;align-items:center;justify-content:space-between;gap:8px;');
  const title = make('strong', 'font-size:13px;', 'Setting Tracker');
  const minimize = make('button', 'border:0;background:transparent;color:#596579;font-size:20px;line-height:1;cursor:pointer;padding:2px 6px;', '−');
  minimize.type = 'button';
  minimize.setAttribute('aria-label', 'Minimize dashboard');
  minimize.title = 'Minimize';
  minimize.onclick = () => { minimized = true; render(); };
  titlebar.append(title, minimize);
  const restore = make('button', 'position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:10px 14px;border:1px solid #245a95;border-radius:8px;background:#fff;color:#245a95;box-shadow:0 4px 14px rgba(0,0,0,.18);font:13px Arial,sans-serif;cursor:move;touch-action:none;');
  restore.type = 'button';
  restore.textContent = 'Open tracker';
  restore.setAttribute('aria-label', 'Restore dashboard');
  restore.title = 'Restore dashboard';
  restore.onclick = () => { minimized = false; render(); };
  restore.style.display = 'none';
  let position = null;
  const applyPosition = (el) => {
    if (!position) return;
    const rect = el.getBoundingClientRect();
    el.style.left = `${Math.max(0, Math.min(window.innerWidth - rect.width, position.left))}px`;
    el.style.top = `${Math.max(0, Math.min(window.innerHeight - rect.height, position.top))}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  };
  // Drags `el` by pressing anywhere on `handle` except interactive controls; a drag suppresses the click.
  function makeDraggable(el, handle) {
    let start = null, dragged = false, suppressClick = false;
    handle.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      const control = event.target.closest('button, input, textarea, select, a');
      if (control && control !== handle) return;
      const rect = el.getBoundingClientRect();
      start = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      dragged = false;
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', (event) => {
      if (!start || !handle.hasPointerCapture(event.pointerId)) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (!dragged && Math.hypot(dx, dy) < 4) return;
      dragged = true;
      position = { left: start.left + dx, top: start.top + dy };
      applyPosition(el);
      position = { left: parseFloat(el.style.left), top: parseFloat(el.style.top) };
    });
    const finish = (event, cancelled) => {
      if (!start) return;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      suppressClick = dragged && !cancelled;
      start = null;
    };
    handle.addEventListener('pointerup', (event) => finish(event, false));
    handle.addEventListener('pointercancel', (event) => finish(event, true));
    handle.addEventListener('click', (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = false;
    }, true);
  } document.body.appendChild(restore);
  const nav = make('div', 'display:flex;gap:6px;');
  const messagesTab = make('button', BTN + 'flex:1;text-align:center;', 'Messages');
  const trackerTab = make('button', BTN + 'flex:1;text-align:center;', 'Tracker');
  messagesTab.type = trackerTab.type = 'button';
  messagesTab.onclick = () => { activeView = 'messages'; render(); };
  trackerTab.onclick = () => { activeView = 'tracker'; render(); };
  nav.append(messagesTab, trackerTab);
  const messageView = make('div', 'display:flex;flex-direction:column;gap:6px;');
  const messageList = make('div', 'display:flex;flex-direction:column;gap:6px;overflow-y:auto;overscroll-behavior:contain;cursor:default;');
  const trackerFrame = make('iframe', 'display:none;width:100%;height:min(72vh,680px);min-height:420px;border:0;border-radius:6px;background:#111827;');
  trackerFrame.title = 'Setting Tracker';
  trackerFrame.src = chrome.runtime.getURL('tracker/index.html');
  trackerFrame.addEventListener('load', () => sendLeadName(true));
  window.addEventListener('message', (event) => {
    if (event.source === trackerFrame.contentWindow && event.data?.type === 'setting-tracker:focus') trackerFrame.focus();
  });
  // N/P/B work anywhere on the GHL page except while typing; they are forwarded to the tracker.
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.repeat) return;
    const key = event.key.toLowerCase();
    if (!['n', 'p', 'b', 'h'].includes(key)) return;
    const origin = event.composedPath()[0];
    if (origin === trackerFrame) return;
    if (origin instanceof HTMLElement && (origin.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(origin.tagName))) return;
    // P/B open the tracker so the "Why?" box is visible and can take focus.
    if (key === 'p' || key === 'b') {
      minimized = false;
      activeView = 'tracker';
      render();
    }
    trackerFrame.contentWindow?.postMessage({ type: 'setting-tracker:key', key }, '*');
  }, true);
  panel.append(titlebar, nav, messageView, trackerFrame);
  makeDraggable(panel, panel);
  makeDraggable(restore, restore);

  function sendLeadName(force = false) {
    const name = getLeadName();
    const url = window.location.href;
    if (!force && name === lastLeadName && url === lastLeadUrl && trackerFrame.contentWindow) return;
    lastLeadName = name;
    lastLeadUrl = url;
    trackerFrame.contentWindow?.postMessage({ type: 'setting-tracker:lead', name, url }, '*');
  }

  function render() {
    panel.style.display = minimized ? 'none' : 'flex';
    restore.style.display = minimized ? 'block' : 'none';
    if (minimized) { applyPosition(restore); return; }
    const showingTracker = activeView === 'tracker';
    panel.style.width = showingTracker ? 'min(380px, calc(100vw - 32px))' : '220px';
    panel.style.maxHeight = showingTracker ? 'calc(100vh - 32px)' : '';
    messagesTab.style.background = showingTracker ? '#fff' : '#e9f1fa';
    trackerTab.style.background = showingTracker ? '#e9f1fa' : '#fff';
    messageView.style.display = showingTracker ? 'none' : 'flex';
    trackerFrame.style.display = showingTracker ? 'block' : 'none';
    applyPosition(panel);
    messageView.textContent = '';
    messageList.textContent = '';
    messages.forEach((m, i) => {
      if (editingIndex === i) {
        messageList.appendChild(buildEditForm(m, (label, text) => {
          messages = messages.map((msg, idx) => (idx === i ? { label, text } : msg));
          editingIndex = null; save(); render();
        }, () => { editingIndex = null; render(); }));
        return;
      }
      const row = make('div', 'display:flex;gap:4px;align-items:stretch;');
      const use = make('button', BTN + 'flex:1;', m.label);
      use.type = 'button';
      use.title = buildMessage(m.text);
      use.onclick = () => {
        status = fillComposer(buildMessage(m.text)) ? '' : 'Open a conversation first.';
        render();
      };
      const edit = make('button', BTN + 'flex:0 0 auto;padding:6px 8px;', '✎');
      edit.type = 'button';
      edit.title = 'Edit message';
      edit.onclick = () => { adding = false; editingIndex = i; status = ''; render(); };
      const del = make('button', BTN + 'flex:0 0 auto;padding:6px 8px;border-color:#9b3034;color:#9b3034;', '✕');
      del.type = 'button';
      del.title = 'Delete message';
      del.onclick = () => {
        if (!window.confirm(`Delete "${m.label}"?`)) return;
        messages = messages.filter((_, idx) => idx !== i);
        if (editingIndex === i) editingIndex = null;
        save(); render();
      };
      row.append(use, edit, del);
      messageList.appendChild(row);
    });
    messageView.appendChild(messageList);
    const firstButton = messageList.firstElementChild;
    if (firstButton) {
      const rowHeight = firstButton.offsetHeight + 6;
      messageList.style.maxHeight = `${rowHeight * MAX_VISIBLE_MESSAGES - 6}px`;
    }
    if (status) messageView.appendChild(make('div', 'color:#9b3034;', status));
    if (editingIndex !== null) return;
    if (!adding) {
      const add = make('button', BTN + 'border-style:dashed;', '+ Add message');
      add.type = 'button';
      add.onclick = () => { adding = true; status = ''; render(); };
      messageView.appendChild(add);
      return;
    }
    messageView.appendChild(buildEditForm(null, (label, text) => {
      messages = [...messages, { label, text }];
      adding = false; save(); render();
    }, () => { adding = false; render(); }));
  }

  // Builds a label/text/Save/Cancel form, pre-filled when editing an existing message (`m` is null when adding).
  function buildEditForm(m, onSave, onCancel) {
    const form = make('div', 'display:flex;flex-direction:column;gap:6px;');
    const label = make('input', FIELD); label.placeholder = 'Button name';
    const text = make('textarea', FIELD + 'height:110px;resize:vertical;'); text.placeholder = 'Message. Use {name} for the first name.';
    if (m) { label.value = m.label; text.value = m.text; }
    const ok = make('button', BTN, 'Save');
    const cancel = make('button', BTN + 'border-color:#999;color:#666;', 'Cancel');
    ok.type = cancel.type = 'button';
    ok.onclick = () => {
      if (!label.value.trim() || !text.value.trim()) return;
      onSave(label.value.trim(), text.value);
    };
    cancel.onclick = onCancel;
    form.append(label, text, ok, cancel);
    requestAnimationFrame(() => label.focus());
    return form;
  }

  let leadUpdateQueued = false;
  const queueLeadUpdate = () => {
    if (leadUpdateQueued) return;
    leadUpdateQueued = true;
    requestAnimationFrame(() => {
      leadUpdateQueued = false;
      sendLeadName();
    });
  };
  new MutationObserver(queueLeadUpdate).observe(document.body, { childList: true, subtree: true, characterData: true });

  store.get('messages', (data) => {
    if (Array.isArray(data.messages)) messages = data.messages;
    render();
    sendLeadName();
  });
})();
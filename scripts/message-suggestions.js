(() => {
  if (window.__ghlMessageSuggestions) return;
  window.__ghlMessageSuggestions = true;

  // {name} is replaced with the lead's first name.
  const DEFAULTS = [
    { label: 'Follow-up', text: "Heyy {name}, Klint here from Alicia Lyttle's AI team 😊 \n\n did u get my msg?" },
    { label: 'Standard', text: "Heyy {name}, this is Klint with Alicia Lyttle's AI team 😊 \n\nI saw that you registered for the AI Marketing Summit to possibly make more money or have more freedom.\n\n We are just checking on all the vip members - how did the summit go for you?" },
    { label: 'Certification form', text: "Heyy {name}, this is Klint with Alicia Lyttle's AI team 😊 \n\nI saw that you filled out the form for the AI Consultancy Certification to possibly leverage AI more in your biz, or become an AI consultant.\n\n We are just checking on all the vip members - how did the summit go for you?" },
    { label: 'Build It Launch It', text: "Heyy {name}, this is Klint with Alicia Lyttle's AI team 😊 \n\nI saw that you signed up for the Build It Launch It challenge.\n\n We are just checking on all the vip members - how did the summit go for you?" },
    {
      label: 'AICC prep',
      subject: 'Your call is coming up in 3 days!',
      text: [
        "Hey hey, it's Team Alicia here with a friendly little nudge…",
        '',
        "You've got your call coming up in just 3 days, and I want to make sure you're feeling good and ready!",
        "Here's a quick recap of your details:",
        '',
        '📅 Date: November 17, 2026',
        '🕒 Time: 8:00 PM',
        '📍 Meeting Type: https://us02web.zoom.us/j/87858185565?pwd=gbCcgVGxFMWB0RK0RFXCb8bnOBDN3y.1',
        "👋 You'll be meeting with: AJ",
        '',
        'This call is your chance to talk with our team about how to turn your passion for AI into a profitable consulting business with our Certified AI Consultant Program.',
        "We'll walk through:",
        '',
        '✅ How the certification works',
        "✅ What's included in the program",
        '✅ Real examples of how people are landing clients, speaking gigs, and building AI-powered offers',
        '',
        'Katrice Francis – Closed her first paid client and made back her investment plus profit before graduating.',
        'Susan Gordon-Jackson – Mentioned her certification at a meeting → landed a paid legal client on the spot.',
        'Lindsay (Summit Presenter) – Generated 80 leads from AI Insights Summit → closed a $6,000 package and teed up a $15K deal.',
        '',
        '...all from this same program.',
        '',
        "You've already taken the first step by booking the call. Now just make sure you show up, ask your questions, and bring your big ideas. Your next level might just start right here.",
        'Also, Please go through these resources to prepare for the call about AI consulting with AJ on Wednesday at 6PM EST, as they may be beneficial for your situation :)',
        '',
        'Getting into AI Consulting',
        'https://www.youtube.com/watch?v=6Tt2wjv8hio',
        '',
        'Where our students go',
        'https://www.iaaic.org',
        '',
        'Preparation for the call',
        'https://aiprepcall.com',
        "Can't wait for you to connect with the team!",
        '',
        'Talk soon,',
        '',
        'Team Alicia'
      ].join('\n')
    }
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

  const isVisible = (el) => Boolean(el && el.getClientRects().length);

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
    if (setter) setter.call(input, value); else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // GHL's email composer: a subject input plus a ProseMirror rich-text body.
  const EMAIL_EDITOR = '.ProseMirror[contenteditable="true"]';
  function getEmailEditor() {
    const editors = [...document.querySelectorAll(EMAIL_EDITOR)];
    const fromParagraph = document.querySelector('p.custom-newline')?.closest('[contenteditable="true"]');
    if (fromParagraph) editors.unshift(fromParagraph);
    return editors.find(isVisible) || null;
  }
  // The email editor `node` is in, if any (GHL's editor may lack the .ProseMirror class).
  function emailEditorOf(node) {
    const el = node instanceof Element ? node : node?.parentElement;
    const editor = el?.closest('[contenteditable="true"]');
    return editor && (editor.matches(EMAIL_EDITOR) || editor.querySelector('p.custom-newline')) ? editor : null;
  }

  // GHL's editor turns a pasted paragraph that is only a YouTube link into a video embed. Starting such a
  // paragraph with a non-breaking space means it is no longer "just the link", so it stays a plain URL.
  const YOUTUBE_URL = /https?:\/\/(?:[\w-]+\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\//i;
  const escapeHtml = (value) => value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const linkify = (line) => escapeHtml(line).replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`);
  function toEmailHtml(text) {
    return text.replace(/\r\n?/g, '\n').split('\n').map((line) => {
      if (!line.trim()) return '<p><br></p>';
      const prefix = YOUTUBE_URL.test(line) && /^\S+$/.test(line.trim()) ? '&nbsp;' : '';
      return `<p>${prefix}${linkify(line.trim())}</p>`;
    }).join('');
  }

  // Pastes text through the editor's own paste handling, which keeps its state in sync with what is shown.
  let pastingOurs = false;
  function pasteIntoEditor(editor, text) {
    const data = new DataTransfer();
    data.setData('text/html', toEmailHtml(text));
    data.setData('text/plain', text);
    pastingOurs = true;
    try {
      editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    } finally {
      pastingOurs = false;
    }
  }

  // Replaces the email editor's content with `message`.
  function fillEmailBody(editor, message) {
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    // Let the editor pick up the new selection before pasting over it.
    setTimeout(() => pasteIntoEditor(editor, message), 0);
  }

  // When the user pastes text containing a YouTube link, re-paste it with the link protected from embedding.
  window.addEventListener('paste', (event) => {
    if (pastingOurs) return;
    const editor = emailEditorOf(event.target);
    const text = event.clipboardData?.getData('text/plain') || '';
    if (!editor || !YOUTUBE_URL.test(text)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pasteIntoEditor(editor, text);
  }, true);

  function fillComposer(message, subject) {
    const emailEditor = getEmailEditor();
    if (emailEditor) {
      const subjectInput = document.querySelector('#subject-input');
      if (subject && isVisible(subjectInput)) setInputValue(subjectInput, subject);
      fillEmailBody(emailEditor, message);
      return true;
    }
    const composer = document.querySelector('#conv-composer-textarea-input')
      || document.querySelector('input[placeholder="Type a message"]')
      || document.querySelector('textarea[placeholder="Type a message"]');
    if (!composer) return false;
    setInputValue(composer, message);
    composer.focus();
    return true;
  }

  let messages = DEFAULTS;
  const store = chrome.storage.local;
  const save = () => store.set({ messages });

  // The UI lives in a shadow root so GHL's (and third-party widgets') page CSS, e.g. rules targeting
  // `body > div > iframe`, cannot hide or collapse the tracker iframe.
  const host = document.createElement('setting-tracker-root');
  host.style.cssText = 'all:initial;';
  const root = host.attachShadow({ mode: 'open' });
  const ensureMounted = () => { if (!host.isConnected && document.body) document.body.appendChild(host); };
  ensureMounted();

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;flex-direction:column;gap:6px;width:220px;max-width:calc(100vw - 32px);padding:8px;box-sizing:border-box;background:#fff;border:1px solid #d5dbe5;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.18);font:12px Arial,sans-serif;color:#222;cursor:move;';
  root.appendChild(panel);

  const style = (el, css) => { el.style.cssText = css; return el; };
  const make = (tag, css, text) => { const el = style(document.createElement(tag), css); if (text) el.textContent = text; return el; };
  const BTN = 'padding:6px 10px;border:1px solid #245a95;border-radius:5px;background:#fff;color:#245a95;cursor:pointer;text-align:left;';
  const FIELD = 'width:100%;box-sizing:border-box;padding:4px;border:1px solid #c5ccd8;border-radius:4px;font:12px Arial,sans-serif;';
  const MAX_VISIBLE_MESSAGES = 6;
  // Arrow keys press GHL's previous/next chevron icons, matched by their path since the buttons have no labels.
  const CHEVRONS = { arrowleft: 'path[d="M15 18l-6-6 6-6"]', arrowright: 'path[d="M9 18l6-6-6-6"]' };
  function clickChevron(key) {
    const icon = [...document.querySelectorAll(CHEVRONS[key])]
      .map((path) => path.closest('svg'))
      .find((svg) => svg && svg.getClientRects().length);
    if (!icon) return false;
    icon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }
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
  }
  root.appendChild(restore);
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
    if (event.source !== trackerFrame.contentWindow) return;
    if (event.data?.type === 'setting-tracker:focus') trackerFrame.focus();
    if (event.data?.type === 'setting-tracker:navigate' && CHEVRONS[event.data.key]) clickChevron(event.data.key);
  });
  // N/I/L/P/B/H work anywhere on the GHL page except while typing; they are forwarded to the tracker.
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.repeat) return;
    const key = event.key.toLowerCase();
    if (!['n', 'i', 'l', 'p', 'b', 'h', 'arrowleft', 'arrowright'].includes(key)) return;
    const origin = event.composedPath()[0];
    if (origin === trackerFrame) return;
    if (origin instanceof HTMLElement && (origin.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(origin.tagName))) return;
    if (CHEVRONS[key]) {
      if (clickChevron(key)) event.preventDefault();
      return;
    }
    // I/L/P/B open the tracker so the "Why?" box is visible and can take focus.
    if (['i', 'l', 'p', 'b'].includes(key)) {
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
        messageList.appendChild(buildEditForm(m, (label, text, subject) => {
          messages = messages.map((msg, idx) => (idx === i ? { ...msg, label, text, subject } : msg));
          editingIndex = null; save(); render();
        }, () => { editingIndex = null; render(); }));
        return;
      }
      const row = make('div', 'display:flex;gap:4px;align-items:stretch;');
      const use = make('button', BTN + 'flex:1;', m.label);
      use.type = 'button';
      use.title = (m.subject ? `Subject: ${buildMessage(m.subject)}\n\n` : '') + buildMessage(m.text);
      use.onclick = () => {
        status = fillComposer(buildMessage(m.text), m.subject ? buildMessage(m.subject) : '') ? '' : 'Open a conversation first.';
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
    messageView.appendChild(buildEditForm(null, (label, text, subject) => {
      messages = [...messages, { label, text, subject }];
      adding = false; save(); render();
    }, () => { adding = false; render(); }));
  }

  // Builds a label/text/Save/Cancel form, pre-filled when editing an existing message (`m` is null when adding).
  function buildEditForm(m, onSave, onCancel) {
    const form = make('div', 'display:flex;flex-direction:column;gap:6px;');
    const label = make('input', FIELD); label.placeholder = 'Button name';
    const subject = make('input', FIELD); subject.placeholder = 'Email subject (optional)';
    const text = make('textarea', FIELD + 'height:110px;resize:vertical;'); text.placeholder = 'Message. Use {name} for the first name.';
    if (m) { label.value = m.label; subject.value = m.subject || ''; text.value = m.text; }
    const ok = make('button', BTN, 'Save');
    const cancel = make('button', BTN + 'border-color:#999;color:#666;', 'Cancel');
    ok.type = cancel.type = 'button';
    ok.onclick = () => {
      if (!label.value.trim() || !text.value.trim()) return;
      onSave(label.value.trim(), text.value, subject.value.trim());
    };
    cancel.onclick = onCancel;
    form.append(label, subject, text, ok, cancel);
    requestAnimationFrame(() => label.focus());
    return form;
  }

  let leadUpdateQueued = false;
  const queueLeadUpdate = () => {
    ensureMounted();
    if (leadUpdateQueued) return;
    leadUpdateQueued = true;
    requestAnimationFrame(() => {
      leadUpdateQueued = false;
      sendLeadName();
    });
  };
  new MutationObserver(queueLeadUpdate).observe(document.body, { childList: true, subtree: true, characterData: true });

  // Built-in messages added after a user already saved their list are appended once; deleting them later sticks.
  const LEGACY_DEFAULT_LABELS = ['Follow-up', 'Standard', 'Certification form', 'Build It Launch It'];
  store.get(['messages', 'seededMessageLabels'], (data) => {
    if (Array.isArray(data.messages)) {
      messages = data.messages;
      const seeded = Array.isArray(data.seededMessageLabels) ? data.seededMessageLabels : LEGACY_DEFAULT_LABELS;
      const added = DEFAULTS.filter((d) => !seeded.includes(d.label) && !messages.some((m) => m.label === d.label));
      if (added.length) { messages = [...messages, ...added]; save(); }
    }
    store.set({ seededMessageLabels: DEFAULTS.map((d) => d.label) });
    render();
    sendLeadName();
  });
})();
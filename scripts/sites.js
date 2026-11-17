// Site adapters: everything that depends on GoHighLevel's or Aloware's page markup lives here.
// When either site changes its page, this is the file to fix. message-suggestions.js (the panel,
// templates, shortcuts and tracker messaging) only talks to the adapter chosen for the current page:
//
//   getLeadName()                   -> the open contact's name, or ''
//   getLeadRef()                    -> { url, phone } saved with each call (GHL: link, Aloware: phone)
//   fillComposer(message, subject)  -> true if a message box was filled
//   navigate(key)                   -> true if 'arrowleft' / 'arrowright' moved to another contact
(() => {
  if (globalThis.SettingTrackerSite) return;

  // ---------- Shared helpers ----------

  const isVisible = (el) => Boolean(el && el.getClientRects().length);
  const firstVisible = (selector) => {
    const all = [...document.querySelectorAll(selector)];
    return all.find(isVisible) || null;
  };
  const normalizeName = (value) => value.replace(/\s+/g, ' ').replace(/\s+\.$/, '').trim();

  // Sets a framework-controlled input's value so Vue/React notice the change.
  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
    if (setter) setter.call(input, value); else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function selectContents(editor) {
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // Pasting through a rich editor's own paste handling keeps its state in sync with what is shown.
  // YouTube-only lines start with a non-breaking space so GHL's editor keeps them as plain links
  // instead of turning them into video embeds.
  const YOUTUBE_URL = /https?:\/\/(?:[\w-]+\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\//i;
  const escapeHtml = (value) => value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const linkify = (line) => escapeHtml(line).replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`);
  function toEditorHtml(text) {
    return text.replace(/\r\n?/g, '\n').split('\n').map((line) => {
      if (!line.trim()) return '<p><br></p>';
      const prefix = YOUTUBE_URL.test(line) && /^\S+$/.test(line.trim()) ? '&nbsp;' : '';
      return `<p>${prefix}${linkify(line.trim())}</p>`;
    }).join('');
  }
  let pastingOurs = false;
  function pasteInto(editor, text) {
    const data = new DataTransfer();
    data.setData('text/html', toEditorHtml(text));
    data.setData('text/plain', text);
    const paste = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
    pastingOurs = true;
    try {
      editor.dispatchEvent(paste);
    } finally {
      pastingOurs = false;
    }
    return paste.defaultPrevented;
  }

  // Replaces a rich editor's content, waiting a tick so the editor sees the new selection first.
  function fillRichEditor(editor, message) {
    selectContents(editor);
    setTimeout(() => {
      if (!pasteInto(editor, message)) document.execCommand('insertText', false, message);
    }, 0);
  }

  // Remembers the last message box the user clicked into (outside the extension panel), as a fallback
  // for composers no adapter has a selector for.
  const SUBJECT_INPUTS = '#subject-input, [data-testid="email-subject-input"]';
  let lastEditable = null;
  const isEditable = (el) => el instanceof HTMLElement && (el.isContentEditable
    || el.tagName === 'TEXTAREA'
    || (el.tagName === 'INPUT' && ['text', 'search', ''].includes((el.getAttribute('type') || '').toLowerCase())));
  document.addEventListener('focusin', (event) => {
    const path = event.composedPath();
    const target = path[0];
    if (!isEditable(target) || target.matches(SUBJECT_INPUTS)) return;
    if (path.some((node) => node instanceof Element && node.tagName === 'SETTING-TRACKER-ROOT')) return;
    lastEditable = target.isContentEditable ? (target.closest('[contenteditable="true"]') || target) : target;
  }, true);

  // Fills the first visible known box, else the last box the user clicked, else any message-like textarea.
  function fillAnyComposer(message, knownSelectors) {
    const known = knownSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]);
    const composer = known.find(isVisible)
      || (lastEditable?.isConnected && isVisible(lastEditable) ? lastEditable : null)
      || [...document.querySelectorAll('textarea')].find((el) => isVisible(el) && /message|type|text|reply|sms/i.test(el.placeholder || ''))
      || known[0];
    if (!composer) return false;
    if (composer.isContentEditable) {
      fillRichEditor(composer, message);
      return true;
    }
    setInputValue(composer, message);
    composer.focus();
    return true;
  }

  // ---------- GoHighLevel ----------

  const GHL_NAME_SELECTORS = [
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
  const isLikelyLeadName = (value) => value.length <= 120
    && /^[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,3}$/.test(value)
    && !/^(conversation|messages|inbox|contacts?)$/i.test(value);

  // GHL's email composer: a subject input plus a ProseMirror rich-text body (which may lack the class).
  const GHL_EMAIL_EDITOR = '.ProseMirror[contenteditable="true"]';
  function ghlEmailEditor() {
    const editors = [...document.querySelectorAll(GHL_EMAIL_EDITOR)];
    const fromParagraph = document.querySelector('p.custom-newline')?.closest('[contenteditable="true"]');
    if (fromParagraph) editors.unshift(fromParagraph);
    return editors.find(isVisible) || null;
  }
  function ghlEmailEditorOf(node) {
    const el = node instanceof Element ? node : node?.parentElement;
    const editor = el?.closest('[contenteditable="true"]');
    return editor && (editor.matches(GHL_EMAIL_EDITOR) || editor.querySelector('p.custom-newline')) ? editor : null;
  }

  // Previous/next contact chevrons have no labels, so they are matched by their icon path.
  const GHL_CHEVRONS = { arrowleft: 'path[d="M15 18l-6-6 6-6"]', arrowright: 'path[d="M9 18l6-6-6-6"]' };

  const ghl = {
    id: 'ghl',
    getLeadName() {
      for (const selector of GHL_NAME_SELECTORS) {
        const element = document.querySelector(selector);
        const name = element ? normalizeName(element.textContent || '') : '';
        if (name && isLikelyLeadName(name)) return name;
      }
      return [...document.querySelectorAll('h1, h2, [role="heading"]')]
        .map((element) => normalizeName(element.textContent || ''))
        .find((text) => text && isLikelyLeadName(text)) || '';
    },
    getLeadRef() {
      return { url: window.location.href, phone: '' };
    },
    fillComposer(message, subject) {
      const editor = ghlEmailEditor();
      if (editor) {
        const subjectInput = document.querySelector('#subject-input');
        if (subject && isVisible(subjectInput)) setInputValue(subjectInput, subject);
        selectContents(editor);
        setTimeout(() => pasteInto(editor, message), 0);
        return true;
      }
      return fillAnyComposer(message, ['#conv-composer-textarea-input', 'input[placeholder="Type a message"]', 'textarea[placeholder="Type a message"]']);
    },
    navigate(key) {
      if (!GHL_CHEVRONS[key]) return false;
      const icon = [...document.querySelectorAll(GHL_CHEVRONS[key])]
        .map((path) => path.closest('svg'))
        .find(isVisible);
      if (!icon) return false;
      icon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    },
    install() {
      // A YouTube link pasted by the user into the email editor is re-pasted protected from embedding.
      window.addEventListener('paste', (event) => {
        if (pastingOurs) return;
        const editor = ghlEmailEditorOf(event.target);
        const text = event.clipboardData?.getData('text/plain') || '';
        if (!editor || !YOUTUBE_URL.test(text)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        pasteInto(editor, text);
      }, true);
    }
  };

  // ---------- Aloware ----------

  const aloware = {
    id: 'aloware',
    getLeadName() {
      const element = firstVisible('.alw-contact-name') || document.querySelector('.alw-contact-name');
      return element ? normalizeName(element.textContent || '') : '';
    },
    // Aloware calls are saved with the contact's phone number instead of a page link.
    getLeadRef() {
      const element = firstVisible('.alw-contact-phone-number') || document.querySelector('.alw-contact-phone-number');
      return { url: '', phone: element ? element.textContent.replace(/\s+/g, '') : '' };
    },
    fillComposer(message, subject) {
      const emailBody = firstVisible('[data-testid="email-message-body-input"]');
      if (emailBody) {
        const subjectInput = firstVisible('[data-testid="email-subject-input"]');
        if (subject && subjectInput) setInputValue(subjectInput, subject);
        setInputValue(emailBody, message);
        emailBody.focus();
        return true;
      }
      return fillAnyComposer(message, ['[data-testid="sms-message-body-input"]']);
    },
    navigate() {
      return false;
    },
    install() {}
  };

  // ---------- Pick the adapter for this page ----------

  const host = window.location.hostname;
  const site = /(^|\.)aloware\.(io|com)$/.test(host) ? aloware : ghl;
  site.install();
  globalThis.SettingTrackerSite = site;
})();

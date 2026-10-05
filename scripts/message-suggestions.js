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
  panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;flex-direction:column;gap:6px;width:200px;padding:8px;background:#fff;border:1px solid #d5dbe5;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.18);font:12px Arial,sans-serif;color:#222;';
  document.body.appendChild(panel);

  const style = (el, css) => { el.style.cssText = css; return el; };
  const make = (tag, css, text) => { const el = style(document.createElement(tag), css); if (text) el.textContent = text; return el; };
  const BTN = 'padding:6px 10px;border:1px solid #245a95;border-radius:5px;background:#fff;color:#245a95;cursor:pointer;text-align:left;';
  const FIELD = 'width:100%;box-sizing:border-box;padding:4px;border:1px solid #c5ccd8;border-radius:4px;font:12px Arial,sans-serif;';
  let adding = false, status = '';

  function render() {
    panel.textContent = '';
    messages.forEach((m, i) => {
      const use = make('button', BTN, m.label);
      use.type = 'button';
      use.title = buildMessage(m.text);
      use.onclick = () => { status = fillComposer(buildMessage(m.text)) ? '' : 'Open a conversation first.'; render(); };
      panel.appendChild(use);
    });
    if (status) panel.appendChild(make('div', 'color:#9b3034;', status));
    if (!adding) {
      const add = make('button', BTN + 'border-style:dashed;', '+ Add message');
      add.type = 'button';
      add.onclick = () => { adding = true; status = ''; render(); };
      panel.appendChild(add);
      return;
    }
    const label = make('input', FIELD); label.placeholder = 'Button name';
    const text = make('textarea', FIELD + 'height:110px;resize:vertical;'); text.placeholder = 'Message. Use {name} for the first name.';
    const ok = make('button', BTN, 'Save');
    const cancel = make('button', BTN + 'border-color:#999;color:#666;', 'Cancel');
    ok.type = cancel.type = 'button';
    ok.onclick = () => {
      if (!label.value.trim() || !text.value.trim()) return;
      messages = [...messages, { label: label.value.trim(), text: text.value }];
      adding = false; save(); render();
    };
    cancel.onclick = () => { adding = false; render(); };
    panel.append(label, text, ok, cancel);
    label.focus();
  }

  store.get('messages', (data) => {
    if (Array.isArray(data.messages)) messages = data.messages;
    render();
  });
})();
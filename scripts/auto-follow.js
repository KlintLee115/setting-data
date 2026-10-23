(() => {
  if (window.__ghlAutoFollow) return;
  window.__ghlAutoFollow = true;

  const FOLLOWER_NAME = 'Klint Lee';
  const TRIGGER_SELECTOR = '#followers-trigger';
  const MAX_ATTEMPTS = 3;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function waitFor(check, timeout = 2500) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const value = check();
      if (value) return value;
      await sleep(50);
    }
    return null;
  }

  const contactKey = () => window.location.pathname + window.location.search;
  const isChecked = (checkbox) => checkbox.getAttribute('aria-checked') === 'true';

  // Finds the followers-list checkbox in the row labelled with FOLLOWER_NAME.
  function findFollowerCheckbox() {
    const labels = [...document.querySelectorAll('span, p, div, label')]
      .filter((element) => element.children.length === 0 && element.textContent.trim() === FOLLOWER_NAME);
    for (const label of labels) {
      let row = label.parentElement;
      for (let depth = 0; row && depth < 6; depth += 1, row = row.parentElement) {
        const boxes = row.querySelectorAll('[role="checkbox"]');
        if (boxes.length === 1) return boxes[0];
        if (boxes.length > 1) break;
      }
    }
    return null;
  }

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, value); else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Returns true once FOLLOWER_NAME is a follower of the open contact.
  async function ensureFollower() {
    const trigger = document.querySelector(TRIGGER_SELECTOR);
    if (!trigger) return false;
    const previousFocus = document.activeElement;
    const inputsBefore = new Set(document.querySelectorAll('input'));
    trigger.click();
    let search = null;
    try {
      let checkbox = await waitFor(findFollowerCheckbox, 800);
      if (!checkbox) {
        search = await waitFor(() => [...document.querySelectorAll('input')]
          .find((input) => !inputsBefore.has(input) && input.offsetParent !== null), 1500);
        if (search) {
          setInputValue(search, FOLLOWER_NAME);
          checkbox = await waitFor(findFollowerCheckbox, 2500);
        }
      }
      if (!checkbox) return false;
      if (!isChecked(checkbox)) {
        checkbox.click();
        return !!(await waitFor(() => isChecked(checkbox), 1500));
      }
      return true;
    } finally {
      const stillOpen = findFollowerCheckbox() || (search && document.body.contains(search));
      if (stillOpen && document.body.contains(trigger)) trigger.click();
      if (previousFocus instanceof HTMLElement && document.body.contains(previousFocus)) previousFocus.focus();
    }
  }

  let handledKey = '';
  let attempts = 0;
  let running = false;
  let queued = false;

  async function run() {
    const key = contactKey();
    if (running || key === handledKey || !document.querySelector(TRIGGER_SELECTOR)) return;
    if (key !== lastKey) { lastKey = key; attempts = 0; }
    if (attempts >= MAX_ATTEMPTS) return;
    running = true;
    attempts += 1;
    try {
      // Give the page a moment to finish loading this contact before opening the list.
      await sleep(800);
      if (contactKey() !== key) return;
      if (await ensureFollower()) handledKey = key;
    } catch (error) {
      console.warn('Auto-follow failed.', error);
    } finally {
      running = false;
      if (contactKey() !== key || (handledKey !== key && attempts < MAX_ATTEMPTS)) queue();
    }
  }
  let lastKey = '';

  function queue() {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; run(); }, 500);
  }

  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  queue();
})();

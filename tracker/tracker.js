const KEY_CALLS = 'tracker.calls';
const KEY_METRICS = 'tracker.metrics';
// Outcomes are mutually exclusive; a finished call with none of them selected counts as booked.
const BASE_STAGES = ['no answer', 'didnt pitch', 'didnt book'];
const FIELD = {
  'no answer': 'noAnswer',
  'didnt pitch': 'didntPitch',
  'didnt book': 'didntBook'
};
const SHORTCUT_STAGE = { n: 'no answer', p: 'didnt pitch', b: 'didnt book' };
const LEGACY_KEYS = ['pickup', 'pitched', 'booked', 'didntProceed', 'somethingBeforeCall', 'somethingBeforeCallContext', 'reasons', 'note', 'disqualified', 'reason'];
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const clone = (value) => JSON.parse(JSON.stringify(value));
const CHANNELS = ['call'];
const CHANNEL_LABEL = { call: 'Call' };
const ACTIVITY = { call: 'outbound dials' };
const chOf = (entry) => entry.channel || 'call';
// Custom metrics are stored in one list; call metrics stay unprefixed so existing data keeps working.
const metricPrefix = (channel) => (channel === 'call' ? '' : `${channel}:`);
const isReservedMetricName = (name) => name.startsWith('dm:') || name.startsWith('email:');
const isLegacyCall = (call) => LEGACY_KEYS.some((key) => key in call);
// Converts the old pickup/pitched/booked fields into the new funnel outcomes.
function normalizeCall(call) {
  if (!isLegacyCall(call)) return call;
  if (call.disqualified) call.didntProceed = true;
  if (!call.noAnswer && !call.didntPitch && !call.didntBook && !call.booked) {
    if (call.pitched) call.didntBook = true;
    else if (call.pickup || call.didntProceed) call.didntPitch = true;
  }
  for (const key of LEGACY_KEYS) delete call[key];
  return call;
}
const retainCallEntries = (entries) => entries.filter((entry) => chOf(entry) === 'call').map(normalizeCall);
const retainCallMetrics = (values) => values.filter((name) => !isReservedMetricName(name));
const storedCalls = load(KEY_CALLS, []);
const storedMetrics = load(KEY_METRICS, []);
const needsCleanup = (entries, names) => entries.some((entry) => chOf(entry) !== 'call' || isLegacyCall(entry))
  || names.some(isReservedMetricName);
const startupCleanup = needsCleanup(storedCalls, storedMetrics);
let metrics = retainCallMetrics(storedMetrics);
const metricsFor = (channel) => metrics
  .filter((m) => (channel === 'call' ? !isReservedMetricName(m) : m.startsWith(metricPrefix(channel))))
  .map((m) => m.slice(metricPrefix(channel).length));
const field = (s, channel = 'call') => FIELD[s] || (BASE_STAGES.includes(s) ? s : `x:${metricPrefix(channel)}${s}`);
const baseStagesFor = () => BASE_STAGES;
const stagesFor = (entry) => [...baseStagesFor(chOf(entry)), ...metricsFor(chOf(entry))];
const hasNegativeOutcome = (call) => BASE_STAGES.some((s) => call[field(s)]);
const allButtons = (channel) => [ACTIVITY[channel], 'picked up', ...baseStagesFor(channel), 'booked', ...metricsFor(channel)];
let calls = retainCallEntries(storedCalls);
let savedState = { calls: clone(calls), metrics: clone(metrics) };
let activeId = null;
let whyId = null;
let whyDraft = '';
let metricsOpen = false;
let highlightsOnly = false;
let bookedOnly = false;
let currentGhlLead = '';
let currentGhlUrl = '';
let autoLead = '';
let counts = {};
const dateEl = document.getElementById('date');
const reviewFilterEl = document.getElementById('review-filter');
const bookedFilterEl = document.getElementById('booked-filter');
const pad2 = (n) => String(n).padStart(2, '0');
const dayOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const localDateTimeValue = (value) => {
  const date = new Date(value);
  return `${dayOf(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};
dateEl.value = dayOf(new Date());

function derive() {
  counts = {};
  for (const call of calls) {
    if (call.done === false) continue;
    const t = new Date(call.time);
    const date = dayOf(t);
    const channel = chOf(call);
    const perChannel = counts[channel] || (counts[channel] = {});
    const day = perChannel[date] || (perChannel[date] = {});
    const activity = ACTIVITY[channel];
    day[activity] = (day[activity] || 0) + 1;
    if (!call.noAnswer) day['picked up'] = (day['picked up'] || 0) + 1;
    if (!hasNegativeOutcome(call)) day.booked = (day.booked || 0) + 1;
    for (const s of stagesFor(call)) if (call[field(s, channel)]) day[s] = (day[s] || 0) + 1;
  }
}
function mergeCalls(base, edited, latest) {
  const result = new Map(latest.map((call) => [call.id, clone(call)]));
  const baseById = new Map(base.map((call) => [call.id, call]));
  const editedById = new Map(edited.map((call) => [call.id, call]));

  for (const [id, original] of baseById) {
    const changed = editedById.get(id);
    if (!changed) {
      result.delete(id);
      continue;
    }
    if (JSON.stringify(original) === JSON.stringify(changed)) continue;
    const merged = result.get(id) || {};
    for (const key of new Set([...Object.keys(original), ...Object.keys(changed)])) {
      if (JSON.stringify(original[key]) === JSON.stringify(changed[key])) continue;
      if (Object.prototype.hasOwnProperty.call(changed, key)) merged[key] = clone(changed[key]);
      else delete merged[key];
    }
    result.set(id, merged);
  }
  for (const [id, call] of editedById) {
    if (!baseById.has(id) && !result.has(id)) result.set(id, clone(call));
  }
  return [...result.values()];
}
const mergeList = (base, edited, latest) => [
  ...latest.filter((value) => !base.includes(value) || edited.includes(value)),
  ...edited.filter((value) => !base.includes(value) && !latest.includes(value))
];
function applyStoredState(latest) {
  const local = { calls, metrics };
  const normalized = { calls: retainCallEntries(latest.calls), metrics: retainCallMetrics(latest.metrics) };
  const merged = {
    calls: mergeCalls(savedState.calls, local.calls, normalized.calls),
    metrics: mergeList(savedState.metrics, local.metrics, normalized.metrics)
  };
  savedState = clone(normalized);
  calls = merged.calls;
  metrics = merged.metrics;
}
const save = (shouldRender = true) => {
  const base = clone(savedState);
  const edited = { calls: clone(calls), metrics: clone(metrics) };
  if (shouldRender) render();
  if (!navigator.locks) {
    console.error('This browser does not support shared tracker saves.');
    window.alert('Unable to safely save tracker data across windows. Please update Chrome and try again.');
    return;
  }
  navigator.locks.request('setting-tracker-data', () => {
    const latest = {
      calls: retainCallEntries(load(KEY_CALLS, [])),
      metrics: retainCallMetrics(load(KEY_METRICS, []))
    };
    const next = {
      calls: retainCallEntries(mergeCalls(base.calls, edited.calls, latest.calls)),
      metrics: retainCallMetrics(mergeList(base.metrics, edited.metrics, latest.metrics))
    };
    localStorage.setItem(KEY_CALLS, JSON.stringify(next.calls));
    localStorage.setItem(KEY_METRICS, JSON.stringify(next.metrics));
    savedState = clone(next);
    calls = next.calls.map((nextCall) => {
      const current = calls.find((call) => call.id === nextCall.id);
      if (!current) return clone(nextCall);
      for (const key of Object.keys(current)) {
        if (!Object.prototype.hasOwnProperty.call(nextCall, key)) delete current[key];
      }
      Object.assign(current, clone(nextCall));
      return current;
    });
    metrics = next.metrics;
    if (shouldRender) render();
  }).catch((error) => {
    console.error('Unable to save tracker data.', error);
    window.alert('Unable to save tracker data. Your changes are still on this page; please try again.');
  });
};
window.addEventListener('storage', (event) => {
  const key = event.key;
  if (![KEY_CALLS, KEY_METRICS].includes(key)) return;
  const latest = { calls: load(KEY_CALLS, []), metrics: load(KEY_METRICS, []) };
  if (key === KEY_CALLS && event.newValue !== null) latest.calls = JSON.parse(event.newValue);
  if (key === KEY_METRICS && event.newValue !== null) latest.metrics = JSON.parse(event.newValue);
  const shouldPurge = needsCleanup(latest.calls, latest.metrics);
  applyStoredState(latest);
  render();
  if (shouldPurge) save();
});
window.addEventListener('message', (event) => {
  if (event.source !== parent) return;
  if (event.data?.type === 'setting-tracker:key') {
    if (typeof event.data.key === 'string') handleShortcut(event.data.key.toLowerCase());
    return;
  }
  if (event.data?.type !== 'setting-tracker:lead') return;
  const lead = typeof event.data.name === 'string' ? event.data.name.trim() : '';
  const url = typeof event.data.url === 'string' ? event.data.url : '';
  if (lead === currentGhlLead && url === currentGhlUrl) return;
  const previousAutoLead = autoLead;
  currentGhlLead = lead;
  currentGhlUrl = url;
  const active = calls.find((call) => call.id === activeId);
  if (active && lead && (!active.lead || (previousAutoLead && active.lead === previousAutoLead))) {
    active.lead = lead;
    active.leadUrl = url;
    autoLead = lead;
    save();
    return;
  }
  if (!active) autoLead = lead;
});

function toggle(call, stage) {
  const key = field(stage, chOf(call));
  const turnOn = !call[key];
  if (BASE_STAGES.includes(stage)) for (const s of BASE_STAGES) delete call[field(s)];
  if (turnOn) call[key] = true; else if (!BASE_STAGES.includes(stage)) delete call[key];
}
function tagButtons(call) {
  const wrap = document.createElement('div'); wrap.className = 'tags';
  for (const stage of stagesFor(call)) {
    const b = document.createElement('button');
    b.textContent = stage;
    if (call[field(stage, chOf(call))]) b.className = 'on' + (BASE_STAGES.includes(stage) ? ' bad' : '');
    b.onclick = () => { toggle(call, stage); save(); };
    wrap.append(b);
  }
  return wrap;
}

function describe(call) {
  const tags = stagesFor(call).filter((s) => call[field(s, chOf(call))]);
  if (call.done === false) return 'in progress (not counted until Done)' + (tags.length ? ': ' + tags.join(' › ') : '');
  if (!hasNegativeOutcome(call)) tags.unshift('booked');
  return tags.join(' › ') + (call.why ? ` — ${call.why}` : '');
}

function render() {
  derive();
  const active = calls.find((c) => c.id === activeId);
  const box = document.getElementById('active');
  box.textContent = '';
  if (active) {
    const card = document.createElement('div'); card.className = 'card active';
    const top = document.createElement('div'); top.className = 'top';
    const name = document.createElement('input'); name.type = 'text'; name.placeholder = 'Lead name (optional)'; name.value = active.lead || '';
    name.onchange = () => {
      active.lead = name.value.trim();
      if (active.lead !== autoLead) autoLead = '';
      save();
    };
    const entryTime = document.createElement('input');
    entryTime.type = 'datetime-local';
    entryTime.className = 'call-time';
    entryTime.setAttribute('aria-label', 'Outreach date and time');
    entryTime.value = localDateTimeValue(active.time);
    entryTime.onchange = () => {
      const updatedTime = new Date(entryTime.value);
      if (Number.isNaN(updatedTime.getTime())) return;
      active.time = updatedTime.toISOString();
      dateEl.value = dayOf(updatedTime);
      save();
    };
    const done = document.createElement('button');
    done.textContent = hasNegativeOutcome(active) ? 'Done' : 'Done (booked)';
    done.setAttribute('aria-keyshortcuts', 'Enter');
    done.onclick = finishActive;
    top.append(name, done);
    card.append(top);
    const comment = document.createElement('textarea');
    comment.placeholder = 'Optional comment';
    comment.setAttribute('aria-label', 'Optional comment');
    comment.value = active.why || '';
    comment.onchange = () => {
      active.why = comment.value.trim();
      if (!active.why) delete active.why;
      save(false);
    };
    card.append(entryTime, comment, tagButtons(active));
    const metricManager = document.createElement('details');
    metricManager.className = 'metrics';
    metricManager.open = metricsOpen;
    metricManager.ontoggle = () => { metricsOpen = metricManager.open; };
    const metricTitle = document.createElement('summary');
    metricTitle.textContent = 'Manage call metrics';
    const metricRow = document.createElement('div'); metricRow.className = 'top'; metricRow.style.marginTop = '8px';
    const newMetric = document.createElement('input'); newMetric.type = 'text'; newMetric.placeholder = 'New metric, e.g. voicemail';
    const addMetric = document.createElement('button'); addMetric.textContent = 'Add';
    addMetric.onclick = () => {
      const name = newMetric.value.trim().toLowerCase();
      if (!name || isReservedMetricName(name) || allButtons(chOf(active)).includes(name)) return;
      metrics.push(metricPrefix(chOf(active)) + name);
      metricsOpen = true;
      save();
    };
    newMetric.onkeydown = (event) => { if (event.key === 'Enter') addMetric.click(); };
    metricRow.append(newMetric, addMetric);
    const metricList = document.createElement('div'); metricList.className = 'tags';
    for (const metric of metricsFor(chOf(active))) {
      const stored = metricPrefix(chOf(active)) + metric;
      const removeMetric = document.createElement('button');
      removeMetric.textContent = `✕ ${metric}`;
      removeMetric.title = 'Remove metric (past data is kept but hidden)';
      removeMetric.onclick = () => {
        if (confirm(`Remove "${metric}"?`)) {
          metrics = metrics.filter((value) => value !== stored);
          metricsOpen = true;
          save();
        }
      };
      metricList.append(removeMetric);
    }
    metricManager.append(metricTitle, metricRow, metricList);
    card.append(metricManager);
    box.append(card);
  }
  const whyCall = calls.find((c) => c.id === whyId);
  if (whyCall) {
    const card = document.createElement('div'); card.className = 'card active';
    const row = document.createElement('div'); row.className = 'top';
    const why = document.createElement('input'); why.type = 'text';
    why.placeholder = `Why ${whyCall.didntPitch ? "didn't pitch" : "didn't book"}? (Enter to save, Esc to skip)`;
    why.setAttribute('aria-label', 'Reason');
    why.value = whyDraft;
    why.oninput = () => { whyDraft = why.value; };
    const dismiss = () => { whyId = null; whyDraft = ''; render(); };
    why.onkeydown = (event) => {
      if (event.key === 'Enter') {
        whyCall.why = why.value.trim();
        if (!whyCall.why) delete whyCall.why;
        whyId = null;
        whyDraft = '';
        save();
      } else if (event.key === 'Escape') dismiss();
    };
    const skip = document.createElement('button'); skip.textContent = 'Skip'; skip.onclick = dismiss;
    row.append(why, skip);
    card.append(row);
    box.append(card);
    // The widget may have just been revealed, so retry until the box is visible and focused.
    window.scrollTo(0, 0);
    let attempts = 0;
    const focusWhy = () => {
      if (!why.isConnected) return;
      parent.postMessage({ type: 'setting-tracker:focus' }, '*');
      why.focus({ preventScroll: true });
      if (document.activeElement !== why && attempts++ < 20) setTimeout(focusWhy, 50);
    };
    focusWhy();
  }
  const callDay = (counts.call || {})[dateEl.value] || {};
  const day = {
    'outbound dials': callDay[ACTIVITY.call] || 0,
    'Call picked up': callDay['picked up'] || 0,
    'Call no answer': callDay['no answer'] || 0,
    'Call didnt pitch': callDay['didnt pitch'] || 0,
    'Call didnt book': callDay['didnt book'] || 0,
    'Call booked': callDay.booked || 0
  };
  const sum = document.getElementById('sum'); sum.textContent = '';
  for (const b of Object.keys(day)) {
    const d = document.createElement('div');
    const n = document.createElement('b'); n.textContent = day[b];
    const l = document.createElement('span'); l.textContent = b;
    d.append(n, l); sum.append(d);
  }
  const dialCount = callDay[ACTIVITY.call] || 0;
  const pickedUp = callDay['picked up'] || 0;
  document.getElementById('rate').textContent = dialCount ? `Call pickup rate: ${Math.round((pickedUp / dialCount) * 100)}% (${pickedUp}/${dialCount})` : '';
  const list = document.getElementById('list'); list.textContent = '';
  reviewFilterEl.setAttribute('aria-pressed', String(highlightsOnly));
  reviewFilterEl.textContent = highlightsOnly ? '★ Showing review only' : '☆ Review only';
  bookedFilterEl.setAttribute('aria-pressed', String(bookedOnly));
  bookedFilterEl.textContent = bookedOnly ? '✓ Showing booked only' : '✓ Booked only';
  const visibleCalls = calls.filter((entry) =>
    dayOf(new Date(entry.time)) === dateEl.value
    && (!highlightsOnly || entry.highlight)
    && (!bookedOnly || (entry.done !== false && !hasNegativeOutcome(entry)))
    && entry.id !== activeId
  ).reverse();
  for (const call of visibleCalls) {
    const card = document.createElement('div'); card.className = `card entry-${chOf(call)}${call.highlight ? ' entry-highlight' : ''}`;
    const top = document.createElement('div'); top.className = 'top';
    const time = new Date(call.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const channel = CHANNEL_LABEL[chOf(call)];
    const label = document.createElement('span'); label.className = 'meta'; label.textContent = `${call.highlight ? '★ ' : ''}${time} · ${channel}${call.lead ? ' · ' + call.lead : ''}`;
    top.append(label);
    if (call.leadUrl) {
      try {
        const leadUrl = new URL(call.leadUrl);
        if (leadUrl.protocol === 'https:' && (leadUrl.hostname === 'gohighlevel.com' || leadUrl.hostname.endsWith('.gohighlevel.com') || leadUrl.hostname === 'msgsndr.com' || leadUrl.hostname.endsWith('.msgsndr.com'))) {
          const link = document.createElement('a');
          link.href = leadUrl.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = 'GHL';
          link.className = 'meta';
          top.append(link);
        }
      } catch (error) {
        console.warn('Ignoring invalid saved GoHighLevel lead URL.', error);
      }
    }
    const star = document.createElement('button'); star.className = 'x'; star.textContent = call.highlight ? '★ review' : '☆ review';
    star.onclick = () => toggleHighlight(call);
    const edit = document.createElement('button'); edit.className = 'x'; edit.textContent = 'edit'; edit.onclick = () => { activeId = call.id; save(); };
    const del = document.createElement('button'); del.className = 'x'; del.textContent = 'delete';
    del.onclick = () => { if (confirm(`Delete this ${CHANNEL_LABEL[chOf(call)].toLowerCase()}?`)) { calls = calls.filter((c) => c !== call); save(); } };
    const spacer = document.createElement('span'); spacer.style.flex = '1';
    top.append(spacer, star, edit, del);
    const s = document.createElement('div'); s.className = 'summary'; s.textContent = describe(call);
    card.append(top, s); list.append(card);
  }
  if ((highlightsOnly || bookedOnly) && visibleCalls.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'rate';
    empty.textContent = 'No calls match the selected filters on this date.';
    list.append(empty);
  }
}

function finishActive() {
  const active = calls.find((c) => c.id === activeId);
  if (!active) return;
  active.done = true;
  activeId = null; autoLead = '';
  save();
}
function recordOutcome(outcome) {
  if (activeId) {
    activeId = null;
    autoLead = '';
  }
  const entry = {
    id: crypto.randomUUID(),
    channel: 'call',
    time: new Date().toISOString(),
    lead: currentGhlLead,
    leadUrl: currentGhlUrl,
    done: true
  };
  if (BASE_STAGES.includes(outcome)) entry[field(outcome)] = true;
  calls.push(entry);
  whyId = outcome === 'didnt pitch' || outcome === 'didnt book' ? entry.id : null;
  whyDraft = '';
  save();
}
function toggleHighlight(call) {
  if (call.highlight) delete call.highlight;
  else call.highlight = true;
  save();
}
for (const button of document.querySelectorAll('[data-outcome]')) {
  button.onclick = () => recordOutcome(button.dataset.outcome);
}
// Returns true when the key was handled. Also driven by the GHL page via postMessage.
function handleShortcut(key, fromButton = false) {
  const stage = SHORTCUT_STAGE[key];
  if (stage) { recordOutcome(stage); return true; }
  if (key === 'h') {
    const latest = calls[calls.length - 1];
    if (!latest) return false;
    toggleHighlight(latest);
    return true;
  }
  if (key === 'enter' && !fromButton && calls.some((c) => c.id === activeId)) { finishActive(); return true; }
  return false;
}
document.addEventListener('keydown', (event) => {
  const target = event.target;
  const isEditing = target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.repeat || isEditing) return;
  if (handleShortcut(event.key.toLowerCase(), target.tagName === 'BUTTON')) event.preventDefault();
});
dateEl.onchange = render;
reviewFilterEl.onclick = () => { highlightsOnly = !highlightsOnly; render(); };
bookedFilterEl.onclick = () => { bookedOnly = !bookedOnly; render(); };
render();
if (startupCleanup) save();

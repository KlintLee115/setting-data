const KEY_CALLS = 'tracker.calls';
const KEY_METRICS = 'tracker.metrics';
const KEY_REASON_OPTIONS = 'tracker.reasonOptions';
const BASE_STAGES = ['pickup', 'no answer', 'didnt proceed', 'pitched', 'booked'];
const FIELD = { 'no answer': 'noAnswer', 'didnt proceed': 'didntProceed' };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
let metrics = load(KEY_METRICS, []);
let REASON_OPTIONS = load(KEY_REASON_OPTIONS, ['not interested', 'had to go', 'just curious']);
const field = (s) => FIELD[s] || (BASE_STAGES.includes(s) ? s : `x:${s}`);
const allStages = () => [...BASE_STAGES, ...metrics];
const allButtons = () => ['outbound dials', ...allStages()];
let calls = load(KEY_CALLS, []);
for (const call of calls) {
  if (call.disqualified) { call.didntProceed = true; call.reasons = call.reasons || []; call.note = call.note ?? call.reason ?? ''; }
  delete call.disqualified; delete call.reason;
}
let activeId = null;
let removing = false;
let currentGhlLead = '';
let autoLead = '';
let counts = {}, hourly = {}, reasons = {};
const dateEl = document.getElementById('date');
const pad2 = (n) => String(n).padStart(2, '0');
const dayOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const localDateTimeValue = (value) => {
  const date = new Date(value);
  return `${dayOf(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};
dateEl.value = dayOf(new Date());

const reasonText = (call) => [...(call.reasons || []), call.note].filter(Boolean).join(', ');
function derive() {
  counts = {}; hourly = {}; reasons = {};
  for (const call of calls) {
    if (call.done === false) continue;
    const t = new Date(call.time);
    const date = dayOf(t), hour = t.getHours();
    const day = counts[date] || (counts[date] = {});
    const slot = (hourly[date] || (hourly[date] = {}))[hour] || (hourly[date][hour] = {});
    day['outbound dials'] = (day['outbound dials'] || 0) + 1; slot.dials = (slot.dials || 0) + 1;
    for (const s of allStages()) if (call[field(s)]) day[s] = (day[s] || 0) + 1;
    if (call.pickup) slot.pickup = (slot.pickup || 0) + 1;
    if (call.didntProceed) (reasons[date] || (reasons[date] = [])).push(reasonText(call) || '(no reason)');
  }
}
const save = () => { localStorage.setItem(KEY_CALLS, JSON.stringify(calls)); render(); };
const todays = () => calls.filter((c) => dayOf(new Date(c.time)) === dateEl.value);

window.addEventListener('message', (event) => {
  if (event.source !== parent || event.data?.type !== 'setting-tracker:lead') return;
  const lead = typeof event.data.name === 'string' ? event.data.name.trim() : '';
  if (lead === currentGhlLead) return;
  const previousAutoLead = autoLead;
  currentGhlLead = lead;
  const active = calls.find((call) => call.id === activeId);
  if (active && lead && (!active.lead || (previousAutoLead && active.lead === previousAutoLead))) {
    active.lead = lead;
    autoLead = lead;
    save();
    return;
  }
  if (!active) autoLead = lead;
});

function toggle(call, stage) {
  const key = field(stage);
  call[key] = !call[key];
  if (!call[key] && key === 'didntProceed') { call.reasons = []; call.note = ''; }
}
function tagButtons(call) {
  const wrap = document.createElement('div'); wrap.className = 'tags';
  for (const stage of allStages()) {
    const b = document.createElement('button');
    b.textContent = stage;
    if (call[field(stage)]) b.className = 'on' + (stage === 'didnt proceed' || stage === 'no answer' ? ' bad' : '');
    b.onclick = () => { toggle(call, stage); save(); };
    wrap.append(b);
  }
  return wrap;
}

const hasResult = (call) => allStages().some((s) => call[field(s)]);
function describe(call) {
  const tags = allStages().filter((s) => call[field(s)]);
  if (call.done === false) return 'in progress (not counted until Done)' + (tags.length ? ': ' + tags.join(' › ') : '');
  return tags.length ? tags.join(' › ') + (call.didntProceed && reasonText(call) ? ` (${reasonText(call)})` : '') : 'no result yet';
}

function renderMetrics() {
  const list = document.getElementById('metricList'); list.textContent = '';
  for (const m of metrics) {
    const b = document.createElement('button'); b.textContent = `✕ ${m}`; b.title = 'Remove metric (past data is kept but hidden)';
    b.onclick = () => { if (confirm(`Remove "${m}"?`)) { metrics = metrics.filter((x) => x !== m); localStorage.setItem(KEY_METRICS, JSON.stringify(metrics)); render(); } };
    list.append(b);
  }
}
document.getElementById('addMetric').onclick = () => {
  const el = document.getElementById('newMetric');
  const name = el.value.trim().toLowerCase();
  el.value = '';
  if (!name || allButtons().includes(name)) return;
  metrics.push(name); localStorage.setItem(KEY_METRICS, JSON.stringify(metrics)); render();
};
document.getElementById('newMetric').onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('addMetric').click(); };

function render() {
  derive();
  renderMetrics();
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
    const callTime = document.createElement('input');
    callTime.type = 'datetime-local';
    callTime.className = 'call-time';
    callTime.setAttribute('aria-label', 'Call date and time');
    callTime.value = localDateTimeValue(active.time);
    callTime.onchange = () => {
      const updatedTime = new Date(callTime.value);
      if (Number.isNaN(updatedTime.getTime())) return;
      active.time = updatedTime.toISOString();
      dateEl.value = dayOf(updatedTime);
      save();
    };
    const done = document.createElement('button'); done.textContent = 'Done'; done.onclick = () => {
      if (hasResult(active)) active.done = true; else calls = calls.filter((x) => x !== active);
      activeId = null; autoLead = '';
      save();
    };
    top.append(name, done);
    card.append(top, callTime, tagButtons(active));
    if (active.didntProceed) {
      const wrap = document.createElement('div'); wrap.style.cssText = 'margin-top:10px';
      for (const option of REASON_OPTIONS) {
        if (removing) {
          const rm = document.createElement('button'); rm.className = 'x'; rm.textContent = '✕ ' + option;
          rm.onclick = () => { REASON_OPTIONS = REASON_OPTIONS.filter((o) => o !== option); localStorage.setItem(KEY_REASON_OPTIONS, JSON.stringify(REASON_OPTIONS)); save(); };
          wrap.append(rm); continue;
        }
        const label = document.createElement('label'); label.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-right:14px;cursor:pointer';
        const box = document.createElement('input'); box.type = 'checkbox';
        box.checked = (active.reasons || []).includes(option);
        box.onchange = () => {
          const set = new Set(active.reasons || []);
          if (box.checked) set.add(option); else set.delete(option);
          active.reasons = REASON_OPTIONS.filter((o) => set.has(o));
          save();
        };
        label.append(box, option); wrap.append(label);
      }
      const note = document.createElement('input'); note.type = 'text'; note.placeholder = 'Other reason / note (optional)'; note.value = active.note || '';
      note.style.cssText = 'width:100%;box-sizing:border-box;margin-top:8px';
      note.onchange = () => { active.note = note.value.trim(); save(); };
      const addRow = document.createElement('div'); addRow.className = 'top'; addRow.style.marginTop = '8px';
      const newReason = document.createElement('input'); newReason.type = 'text'; newReason.placeholder = 'Add a reason to the checklist';
      const addReason = document.createElement('button'); addReason.textContent = 'Add';
      addReason.onclick = () => {
        const v = newReason.value.trim().toLowerCase();
        if (v && !REASON_OPTIONS.includes(v)) { REASON_OPTIONS.push(v); active.reasons = [...(active.reasons || []), v]; localStorage.setItem(KEY_REASON_OPTIONS, JSON.stringify(REASON_OPTIONS)); save(); }
      };
      newReason.onkeydown = (e) => { if (e.key === 'Enter') addReason.click(); };
      const manage = document.createElement('button'); manage.className = 'x'; manage.textContent = 'remove reasons';
      manage.onclick = () => { removing = !removing; render(); };
      addRow.append(newReason, addReason, manage);
      card.append(wrap, note, addRow);
    }
    box.append(card);
  }
  const day = counts[dateEl.value] || {};
  const sum = document.getElementById('sum'); sum.textContent = '';
  for (const b of allButtons()) {
    const d = document.createElement('div');
    const n = document.createElement('b'); n.textContent = day[b] || 0;
    const l = document.createElement('span'); l.textContent = b;
    d.append(n, l); sum.append(d);
  }
  const dialCount = day['outbound dials'] || 0;
  document.getElementById('rate').textContent = dialCount ? `Pickup rate: ${Math.round(((day.pickup || 0) / dialCount) * 100)}% (${day.pickup || 0}/${dialCount})` : '';
  const list = document.getElementById('list'); list.textContent = '';
  for (const call of todays().reverse()) {
    if (call.id === activeId) continue;
    const card = document.createElement('div'); card.className = 'card';
    const top = document.createElement('div'); top.className = 'top';
    const time = new Date(call.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const label = document.createElement('span'); label.className = 'meta'; label.textContent = `${time}${call.lead ? ' · ' + call.lead : ''}`;
    const edit = document.createElement('button'); edit.className = 'x'; edit.textContent = 'edit'; edit.onclick = () => { activeId = call.id; render(); };
    const del = document.createElement('button'); del.className = 'x'; del.textContent = 'delete';
    del.onclick = () => { if (confirm('Delete this call?')) { calls = calls.filter((c) => c !== call); save(); } };
    const spacer = document.createElement('span'); spacer.style.flex = '1';
    top.append(label, spacer, edit, del);
    const s = document.createElement('div'); s.className = 'summary'; s.textContent = describe(call);
    card.append(top, s); list.append(card);
  }
}

document.getElementById('newCall').onclick = () => {
  const open = calls.find((x) => x.id === activeId);
  if (open && !hasResult(open)) return;
  if (open) open.done = true;
  const call = { id: String(Date.now()), time: new Date().toISOString(), lead: currentGhlLead, done: false };
  calls.push(call); activeId = call.id; autoLead = currentGhlLead; save();
};
dateEl.onchange = render;
render();

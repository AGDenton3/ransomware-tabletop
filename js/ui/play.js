// play.html: the war room. Loads ?scenario=<id>. Optional ?present=1 and ?debug=1.
import { createState, choose, jumpTo, formatClock, METERS, METER_INFO } from '../engine/state.js';
import { availableChoices, matches } from '../engine/resolve.js';
import { computeResults, scales } from '../engine/score.js';
import { saveProgress, loadProgress, clearProgress, recordRun, getPref, setPref } from '../engine/save.js';
import { initTheme, loadScenario, loadReferences, esc, paras, formatMeter, formatDelta, speakDelta, isGood, deltaList, csfBadge, phaseBadge, showError } from './common.js';
import { renderPicker } from './picker.js';

initTheme();

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const scenarioId = params.get('scenario');
const PRESENT = params.get('present') === '1';
const DEBUG = params.get('debug') === '1';
const KEYS = PRESENT ? ['A', 'B', 'C', 'D'] : ['1', '2', '3', '4'];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let scenario = null;
let refs = {};
let state = null;
let runId = null;
let pending = null;      // presentation mode: { choice } awaiting reveal
let timer = null;        // presentation mode: per-decision countdown
let timerOn = getPref('timer') !== false;
const TIMER_SECONDS = 45;
const SHORT = { cost: 'Cost', downtime: 'Down', dataLoss: 'Data', trust: 'Trust', legal: 'Legal' };

// ---------------------------------------------------------------- boot
async function boot() {
  if (!scenarioId) {
    $('picker-view').hidden = false;
    renderPicker($('scenario-list'));
    return;
  }
  try {
    [scenario, refs] = await Promise.all([loadScenario(scenarioId), loadReferences()]);
  } catch (e) {
    $('error').hidden = false;
    showError($('error'), `Could not load scenario "${scenarioId}". ${e.message}`);
    return;
  }
  document.title = `${scenario.title} · Ransomware Tabletop`;
  if (PRESENT) document.body.classList.add('present');
  $('scn-name').innerHTML = `<small>${esc(scenario.orgType)}${PRESENT ? ' · Presentation mode' : ''}</small>${esc(scenario.title)}`;
  buildMeters();
  renderOrg();
  $('restart').addEventListener('click', restart);
  document.addEventListener('keydown', onKey);
  showSplash(loadProgress(scenario.id));
}

// ---------------------------------------------------------------- splash
function showSplash(saved) {
  const dlg = $('splash');
  const note = scenario.ransomNote;
  $('note-gang').textContent = `${note.gang} (fictional)`;
  $('note-text').textContent = note.text;
  $('note-demand').innerHTML = `Demand: <strong>${esc(note.demand)}</strong>`;
  $('note-deadline').textContent = `Deadline: ${note.deadlineHours} hours.`;
  let remaining = (note.deadlineHours || 72) * 3600;
  const tick = () => {
    const h = Math.floor(remaining / 3600), m = Math.floor((remaining % 3600) / 60), s = remaining % 60;
    $('note-countdown').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    remaining = Math.max(0, remaining - 1);
  };
  tick();
  const interval = reducedMotion ? null : setInterval(tick, 1000);

  const actions = $('note-actions');
  actions.innerHTML = saved
    ? `<button class="btn" type="button" data-act="resume">Resume where you left off</button><button class="btn btn-ghost" type="button" data-act="new">Start over</button>`
    : `<button class="btn" type="button" data-act="new">Begin the response</button>`;

  const start = (act) => {
    clearInterval(interval);
    if (dlg.open) dlg.close();
    if (act === 'resume' && saved) state = saved.state;
    else { clearProgress(scenario.id); state = createState(scenario); }
    $('game').hidden = false;
    render(null, true);
  };
  actions.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => start(b.dataset.act)));
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); start(saved ? 'resume' : 'new'); }, { once: true });

  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');
  actions.querySelector('button').focus();
}

// ---------------------------------------------------------------- meters
function buildMeters() {
  $('meters').innerHTML = METERS.map((k) => `
    <div class="meter" id="meter-${k}">
      <div class="meter-head"><span class="meter-label"><span class="full">${esc(METER_INFO[k].label)}</span><span class="short" aria-hidden="true">${SHORT[k]}</span></span><span class="meter-value" id="mv-${k}"></span></div>
      <div class="meter-bar" aria-hidden="true"><div class="meter-fill" id="mf-${k}"></div></div>
      <span class="meter-delta" id="md-${k}" aria-hidden="true"></span>
    </div>`).join('');
}

function meterFraction(k, v) {
  const { costBad, downtimeBad } = scales(scenario);
  if (k === 'cost') return Math.min(1, v / costBad);
  if (k === 'downtime') return Math.min(1, v / downtimeBad);
  return v / 100;
}

function updateMeters(deltas) {
  for (const k of METERS) {
    const v = state.meters[k];
    const frac = meterFraction(k, v);
    const badness = METER_INFO[k].higherIsBetter ? 1 - frac : frac;
    const el = $(`meter-${k}`);
    el.dataset.tone = badness < 0.34 ? 'good' : badness < 0.67 ? 'warn' : 'bad';
    $(`mv-${k}`).textContent = formatMeter(k, v);
    $(`mf-${k}`).style.width = `${Math.max(2, frac * 100)}%`;
    el.setAttribute('aria-label', `${METER_INFO[k].label}: ${formatMeter(k, v)}`);
    const d = deltas?.[k];
    const chip = $(`md-${k}`);
    chip.classList.remove('show', 'is-good', 'is-bad');
    if (d) {
      chip.textContent = formatDelta(k, d);
      void chip.offsetWidth; // restart the animation
      chip.classList.add('show', isGood(k, d) ? 'is-good' : 'is-bad');
    }
  }
}

function announce(deltas, newMessages) {
  const parts = METERS.filter((k) => deltas?.[k]).map((k) => speakDelta(k, deltas[k]));
  if (newMessages) parts.push(`${newMessages} new ${newMessages === 1 ? 'message' : 'messages'}`);
  const live = $('live');
  live.textContent = '';
  if (parts.length) setTimeout(() => { live.textContent = `${parts.join('. ')}.`; }, 50);
}

// ---------------------------------------------------------------- render
function render(deltas, first = false) {
  const node = scenario.nodes[state.nodeId];
  $('clock').textContent = formatClock(scenario, state.clock);
  $('clock').setAttribute('aria-label', `In-game time: ${formatClock(scenario, state.clock)}`);
  updateMeters(deltas);
  const count = renderInbox(node);
  renderBoard();
  if (!first) announce(deltas, count);

  $('node-eyebrow').textContent = node.ending ? 'Outcome' : `Decision · ${formatClock(scenario, state.clock)}`;
  $('node-title').textContent = node.title;
  $('narrative').innerHTML = paras(node.narrative);
  if (node.ending) renderEnding(node);
  else renderChoices();
  renderDebug();
  saveProgress(state);
  $('node-title').focus({ preventScroll: true });
  if (!first) $('stage-card').scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
}

function renderInbox(node) {
  const time = formatClock(scenario, state.clock).split(' · ')[1];
  const injected = (state.injectMessages || []).map((m) => ({ ...m, isInject: true }));
  const msgs = [...injected, ...(node.inbox || [])];
  const label = { email: 'EMAIL', phone: 'CALL', text: 'TEXT', news: 'NEWS', portal: 'PORTAL' };
  $('inbox').innerHTML = msgs.length
    ? msgs.map((m, i) => `
      <article class="msg msg-${esc(m.channel)} is-new${m.isInject ? ' msg-inject' : ''}" style="animation-delay:${reducedMotion ? 0 : i * 280}ms" aria-label="${esc(label[m.channel])} from ${esc(m.from)}">
        <div class="msg-head"><span class="msg-channel">${label[m.channel]}</span><span class="msg-from">${esc(m.from)}</span><span class="msg-time">${esc(time)}</span></div>
        ${m.isInject ? '<p class="msg-tag" style="padding:.5rem .9rem 0;margin:0">NEW DEVELOPMENT</p>' : ''}
        ${m.subject ? `<p class="msg-subject">${esc(m.subject)}</p>` : ''}
        <div class="msg-body">${esc(m.body)}</div>
      </article>`).join('')
    : '<p class="muted">No new messages.</p>';
  return msgs.length;
}

function renderBoard() {
  const b = scenario.board || {};
  const rows = (b.items || []).map((item) => {
    const hit = (item.states || []).find((s) => matches(s.if, state));
    const text = hit ? hit.text : item.default || 'Unknown';
    const tone = hit ? hit.tone || '' : 'unknown';
    return `<div class="row"><dt>${esc(item.label)}</dt><dd data-tone="${esc(tone)}">${esc(text)}</dd></div>`;
  });
  if (b.notifications?.length) {
    const items = b.notifications.map((n) => {
      const done = state.flags[n.flag];
      const when = done && state.flagTimes[n.flag] !== undefined ? formatClock(scenario, state.flagTimes[n.flag]) : '';
      return `<li><span>${esc(n.label)}</span>${done ? `<span class="yes">Notified${when ? ` · ${esc(when.replace('Day ', 'D'))}` : ''}</span>` : '<span class="no">Not yet</span>'}</li>`;
    }).join('');
    rows.push(`<div class="row"><dt>Who has been told</dt><dd><ul class="notify-list">${items}</ul></dd></div>`);
  }
  $('board').innerHTML = rows.join('') || '<div class="row"><dt>Status</dt><dd data-tone="unknown">Unknown</dd></div>';
}

function renderOrg() {
  const o = scenario.orgProfile;
  const list = (a) => a.map(esc).join(', ');
  $('org-dl').innerHTML = `
    <dt>Organization</dt><dd>${esc(o.name)}</dd>
    <dt>Size</dt><dd>${esc(o.size)}</dd>
    <dt>What it does</dt><dd>${esc(o.description)}</dd>
    <dt>Critical systems</dt><dd>${list(o.criticalSystems)}</dd>
    <dt>Backups (as documented)</dt><dd>${esc(o.backups)}</dd>
    <dt>Cyber insurance</dt><dd>${esc(o.insurance)}</dd>
    <dt>Regulated data</dt><dd>${list(o.regulatedData)}</dd>`;
}

function renderChoices() {
  const choices = availableChoices(scenario, state);
  const area = $('choices-area');
  area.innerHTML = `
    <div class="choices" role="group" aria-label="Your options">
      ${choices.map((c, i) => `
        <button class="choice" type="button" data-choice="${esc(c.id)}" aria-keyshortcuts="${KEYS[i]}">
          <span class="choice-key" aria-hidden="true">${KEYS[i]}</span>
          <span class="choice-label"><span class="sr-only">Option ${KEYS[i]}: </span>${esc(c.label)}</span>
          <span class="choice-hint">${esc(c.hint)}</span>
        </button>`).join('')}
    </div>
    ${PRESENT ? presentBar() : ''}`;
  area.querySelectorAll('.choice').forEach((btn) => btn.addEventListener('click', () => pick(btn.dataset.choice)));
  if (PRESENT) wirePresentBar();
}

function renderEnding(node) {
  stopTimer();
  if (!runId) runId = recordRun(state, computeResults(scenario, state));
  $('choices-area').innerHTML = `
    <div class="callout ending-card" style="margin-top:1.25rem">
      <p class="callout-title">${esc(node.outcome)}</p>
      <p>${esc(node.summary)}</p>
    </div>
    <div class="btn-row result-actions">
      <a class="btn" href="debrief.html?run=${encodeURIComponent(runId)}">See your debrief</a>
      <a class="btn btn-ghost" href="play.html?scenario=${encodeURIComponent(scenario.id)}${PRESENT ? '&present=1' : ''}">Play again</a>
    </div>`;
}

// ---------------------------------------------------------------- choosing
function step(choiceId) {
  const before = state.history.length;
  state = choose(scenario, state, choiceId);
  const deltas = {};
  for (const e of state.history.slice(before)) for (const [k, v] of Object.entries(e.deltas || {})) deltas[k] = (deltas[k] || 0) + v;
  return deltas;
}

function pick(choiceId) {
  if (PRESENT) return presentPick(choiceId);
  render(step(choiceId));
}

function onKey(e) {
  if (e.altKey || e.ctrlKey || e.metaKey || $('splash').open) return;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  const key = e.key.toUpperCase();
  const idx = PRESENT ? ['A', 'B', 'C', 'D', '1', '2', '3', '4'].indexOf(key) % 4 : KEYS.indexOf(key);
  if (idx < 0 || pending) return;
  const btn = document.querySelectorAll('#choices-area .choice')[idx];
  if (btn) { e.preventDefault(); btn.click(); }
}

// ---------------------------------------------------------------- presentation mode
function presentBar() {
  return `<div class="present-bar no-print">
    <span class="timer" id="timer" role="timer" aria-label="Vote timer">${timerOn ? `${TIMER_SECONDS}s` : '—'}</span>
    <button class="btn btn-ghost" type="button" id="timer-toggle" aria-pressed="${timerOn}">Timer ${timerOn ? 'on' : 'off'}</button>
    <span class="muted">Class votes by show of hands, then press <kbd>A</kbd>–<kbd>D</kbd>.</span>
  </div>`;
}

function wirePresentBar() {
  $('timer-toggle').addEventListener('click', () => {
    timerOn = !timerOn;
    setPref('timer', timerOn);
    $('timer-toggle').textContent = `Timer ${timerOn ? 'on' : 'off'}`;
    $('timer-toggle').setAttribute('aria-pressed', String(timerOn));
    timerOn ? startTimer() : (stopTimer(), ($('timer').textContent = '—'));
  });
  if (timerOn) startTimer();
}

function startTimer() {
  stopTimer();
  let left = TIMER_SECONDS;
  const el = $('timer');
  const draw = () => { el.textContent = left > 0 ? `${left}s` : 'Vote!'; el.classList.toggle('is-low', left <= 10); };
  draw();
  timer = setInterval(() => { left--; draw(); if (left <= 0) { stopTimer(); $('live').textContent = 'Time is up. Take the vote.'; } }, 1000);
}

function stopTimer() { clearInterval(timer); timer = null; }

function presentPick(choiceId) {
  stopTimer();
  const choices = availableChoices(scenario, state);
  const idx = choices.findIndex((c) => c.id === choiceId);
  const choice = choices[idx];
  pending = { choiceId };
  document.querySelectorAll('#choices-area .choice').forEach((b) => {
    const on = b.dataset.choice === choiceId;
    b.setAttribute('aria-pressed', String(on));
    b.disabled = !on;
  });
  const bar = document.querySelector('.present-bar');
  bar.innerHTML = `<span><strong>The room chose ${KEYS[idx]}.</strong></span><button class="btn" type="button" id="reveal-btn">Reveal consequences</button>`;
  $('reveal-btn').addEventListener('click', () => reveal(choice));
  $('reveal-btn').focus();
}

function reveal(choice) {
  const before = state.history.length;
  const deltas = step(choice.id);
  updateMeters(deltas);
  announce(deltas, 0);
  const events = state.history.slice(before).filter((e) => e.type === 'inject').length;
  const bar = document.querySelector('.present-bar');
  bar.outerHTML = `
    <div class="reveal callout" role="region" aria-label="Consequences">
      <p class="callout-title">Consequences</p>
      ${deltaList(deltas)}
      <p>${esc(choice.debrief.whyItMatters)}</p>
      <p class="badges">${csfBadge(choice.csf)} ${phaseBadge(choice.legacyPhase)}</p>
      ${events ? `<p><strong>${events} new development${events > 1 ? 's' : ''}</strong> in the inbox.</p>` : ''}
      <button class="btn" type="button" id="continue-btn">Continue</button>
    </div>`;
  $('continue-btn').addEventListener('click', () => { pending = null; render(null); });
  $('continue-btn').focus();
}

// ---------------------------------------------------------------- restart / debug
function restart() {
  if (!confirm('Restart this scenario? Your current progress will be lost.')) return;
  clearProgress(scenario.id);
  state = createState(scenario);
  runId = null;
  pending = null;
  render(null, true);
}

function renderDebug() {
  if (!DEBUG) return;
  const el = $('debug');
  el.hidden = false;
  el.className = 'debug no-print';
  el.innerHTML = `
    <strong>Debug</strong> · node <code>${esc(state.nodeId)}</code> · clock ${state.clock.toFixed(1)} h
    <pre>meters ${esc(JSON.stringify(state.meters))}</pre>
    <pre>flags ${esc(JSON.stringify(state.flags, null, 1))}</pre>
    <label for="jump">Jump to node</label>
    <select id="jump">${Object.keys(scenario.nodes).map((id) => `<option${id === state.nodeId ? ' selected' : ''}>${esc(id)}</option>`).join('')}</select>
    <button type="button" class="btn btn-ghost" id="jump-go">Jump</button>`;
  $('jump-go').addEventListener('click', () => { state = jumpTo(scenario, state, $('jump').value); runId = null; render(null); });
}

boot();

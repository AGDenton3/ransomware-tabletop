// Shared UI helpers: theme toggle, data loading, formatting, small HTML builders.

import { CSF_FUNCTIONS, METER_INFO } from '../engine/state.js';
import { getPref, setPref } from '../engine/save.js';

/** Escape text for safe insertion into HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Plain text with blank lines → paragraphs. */
export function paras(text) {
  return String(text ?? '').split(/\n\s*\n/).map((p) => `<p>${esc(p.trim())}</p>`).join('');
}

/** Fetch JSON with a relative URL so the site works under any base path. */
export async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json();
}

export async function loadScenario(id) {
  if (!/^[a-z0-9_-]+$/i.test(id || '')) throw new Error('Unknown scenario');
  return loadJSON(`data/scenarios/${id}.json`);
}

export const loadReferences = () => loadJSON('data/references.json');

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Format a meter value for display. */
export function formatMeter(key, v) {
  switch (key) {
    case 'cost': return v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : v >= 10_000 ? `$${Math.round(v / 1000)}k` : money.format(v);
    case 'downtime': return v >= 72 ? `${(v / 24).toFixed(1)} d` : `${Math.round(v)} h`;
    case 'dataLoss': return `${Math.round(v)}%`;
    default: return `${Math.round(v)}`;
  }
}

/** Format a delta ("+6 h", "−$25,000", "Trust −5"). */
export function formatDelta(key, d) {
  const sign = d > 0 ? '+' : '−';
  const a = Math.abs(d);
  switch (key) {
    case 'cost': return `${sign}${money.format(a)}`;
    case 'downtime': return `${sign}${a} h`;
    case 'dataLoss': return `${sign}${a}%`;
    default: return `${sign}${a}`;
  }
}

/** Words for screen readers: "Downtime +6 hours". */
export function speakDelta(key, d) {
  const a = Math.abs(d);
  const sign = d > 0 ? 'plus' : 'minus';
  const label = METER_INFO[key].label;
  switch (key) {
    case 'cost': return `Cost ${sign} ${money.format(a)}`;
    case 'downtime': return `Downtime ${sign} ${a} ${a === 1 ? 'hour' : 'hours'}`;
    case 'dataLoss': return `Data loss ${sign} ${a} percent`;
    default: return `${label} ${sign} ${a}`;
  }
}

/** Is this delta good for the player? */
export const isGood = (key, d) => (METER_INFO[key].higherIsBetter ? d > 0 : d < 0);

export function deltaList(deltas) {
  const items = Object.entries(deltas || {}).filter(([, d]) => d);
  if (!items.length) return '<p class="muted note-block">No meter change.</p>';
  return `<ul class="deltas" aria-label="Meter changes">${items
    .map(([k, d]) => `<li class="${isGood(k, d) ? 'is-good' : 'is-bad'}">${esc(METER_INFO[k].label)} ${esc(formatDelta(k, d))}</li>`)
    .join('')}</ul>`;
}

export function csfBadge(code) {
  const f = CSF_FUNCTIONS[code];
  return `<span class="badge badge-${esc(code)}" title="NIST CSF 2.0: ${esc(f?.name)}"><span class="code">${esc(code)}</span> ${esc(f?.name)}</span>`;
}

export function phaseBadge(phase) {
  return `<span class="badge badge-phase" title="Legacy SP 800-61 Rev. 2 phase">Rev. 2: ${esc(phase)}</span>`;
}

/** Inline citation links for a list of reference ids. */
export function citeLinks(ids, refs) {
  return (ids || [])
    .filter((id) => refs[id])
    .map((id) => `<a href="${esc(refs[id].url)}" rel="noopener" title="${esc(refs[id].title)}">${esc(shortRef(refs[id]))}</a>`)
    .join('; ');
}

export function shortRef(r) {
  const pub = r.publisher.replace(/\s*\(.*?\)\s*/g, ' ').split(/,| and /)[0].trim();
  const t = r.title.length > 60 ? `${r.title.slice(0, 57).trim()}…` : r.title;
  return `${pub}, “${t}” (${r.year})`;
}

/** Theme toggle: light / dark / follow the system. Stored in localStorage. */
export function initTheme() {
  const root = document.documentElement;
  const saved = getPref('theme');
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  const btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  const current = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const label = () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    btn.textContent = next === 'dark' ? 'Dark mode' : 'Light mode';
    btn.setAttribute('aria-label', `Switch to ${next} mode`);
  };
  label();
  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    setPref('theme', next);
    label();
  });
}

/** Show a readable error in a container. */
export function showError(el, message) {
  el.innerHTML = `<div class="card callout" role="alert"><p class="callout-title">Something went wrong</p><p>${esc(message)}</p><p><a href="index.html">Back to the scenario list</a></p></div>`;
}

// Scenario picker cards, shared by the landing page and play.html.
import { loadJSON, esc, showError } from './common.js';
import { loadProgress, listRuns } from '../engine/save.js';

const BURST = '<svg class="shape" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path fill="currentColor" d="M50 2 L57 30 L80 10 L68 37 L98 34 L72 52 L96 70 L66 66 L76 94 L54 72 L46 98 L41 70 L18 90 L30 63 L2 66 L27 50 L4 30 L33 37 L22 8 L44 29 Z"/></svg>';

export function scenarioCard(s, i = 0) {
  const saved = loadProgress(s.id);
  const runs = listRuns().filter((r) => r.scenarioId === s.id);
  const best = runs.length ? runs.reduce((a, b) => (b.total > a.total ? b : a)) : null;
  const playUrl = `play.html?scenario=${encodeURIComponent(s.id)}`;
  const sticker = best ? `Best<br>${esc(best.grade)}` : saved ? 'Still<br>open' : i === 0 ? 'House<br>pick' : 'Hard<br>mode';
  return `
    <div class="ticket-wrap">
      <span class="sticker" aria-hidden="true">${BURST}<span>${sticker}</span></span>
      <article class="ticket scenario-card">
        <p class="ticket-head"><span>Order ${String(i + 1).padStart(2, '0')}</span><span>${esc(s.orgType.split('·')[0].trim())}</span></p>
        <h3>${esc(s.title)}</h3>
        <ul class="receipt-lines">
          <li><span>Difficulty</span><span>${esc(s.difficulty)}</span></li>
          <li><span>Time</span><span>≈ ${esc(s.estMinutes)} min</span></li>
          ${best ? `<li><span>Your best</span><span>${esc(best.grade)}</span></li>` : ''}
        </ul>
        <p>${esc(s.blurb)}</p>
        <div class="btn-row">
          <a class="btn" href="${playUrl}">${saved ? 'Pick back up' : 'Clock in'}<span class="sr-only">: ${esc(s.title)}</span></a>
          <a class="btn btn-secondary" href="${playUrl}&amp;present=1">Run it for the room<span class="sr-only">: ${esc(s.title)}</span></a>
        </div>
      </article>
    </div>`;
}

export async function renderPicker(el) {
  try {
    const idx = await loadJSON('data/scenarios/index.json');
    el.innerHTML = idx.scenarios.length
      ? idx.scenarios.map((sc, i) => scenarioCard(sc, i)).join('')
      : '<p>Nothing on the board yet.</p>';
  } catch (e) {
    showError(el, e.message);
  }
}


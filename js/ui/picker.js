// Scenario picker cards, shared by the landing page and play.html.
import { loadJSON, esc, showError } from './common.js';
import { loadProgress, listRuns } from '../engine/save.js';

export function scenarioCard(s, i = 0) {
  const saved = loadProgress(s.id);
  const runs = listRuns().filter((r) => r.scenarioId === s.id);
  const best = runs.length ? runs.reduce((a, b) => (b.total > a.total ? b : a)) : null;
  const playUrl = `play.html?scenario=${encodeURIComponent(s.id)}`;
  return `
    <article class="scenario-card">
      <span class="tab">CASE FILE ${String(i + 1).padStart(2, '0')}</span>
      <span class="stamp">${saved ? 'In progress' : best ? 'Closed' : 'Open'}</span>
      <p class="eyebrow">${esc(s.orgType)}</p>
      <h3>${esc(s.title)}</h3>
      <div class="meta"><span>${esc(s.difficulty)}</span><span>≈ ${esc(s.estMinutes)} min</span>${best ? `<span class="best">Best: ${esc(best.grade)}</span>` : ''}</div>
      <p>${esc(s.blurb)}</p>
      <div class="btn-row">
        <a class="btn" href="${playUrl}">${saved ? 'Resume' : 'Start'}<span class="sr-only"> ${esc(s.title)}</span></a>
        <a class="btn btn-ghost" href="${playUrl}&amp;present=1">Present<span class="sr-only">ation mode for ${esc(s.title)}</span></a>
      </div>
    </article>`;
}

export async function renderPicker(el) {
  try {
    const idx = await loadJSON('data/scenarios/index.json');
    el.innerHTML = idx.scenarios.length
      ? idx.scenarios.map((sc, i) => scenarioCard(sc, i)).join('')
      : '<p class="muted">No scenarios yet.</p>';
  } catch (e) {
    showError(el, e.message);
  }
}


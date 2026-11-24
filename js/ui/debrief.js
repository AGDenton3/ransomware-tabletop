// debrief.html: end-of-run debrief. Reads ?run=<id> (default: the last finished run).
import { formatClock, METERS, METER_INFO, CSF_FUNCTIONS } from '../engine/state.js';
import { computeResults, subscores, WEIGHTS, GRADE_BANDS } from '../engine/score.js';
import { getRun } from '../engine/save.js';
import { initTheme, loadScenario, loadReferences, esc, formatMeter, deltaList, csfBadge, phaseBadge, citeLinks, showError } from './common.js';

initTheme();

const root = document.getElementById('debrief');
const runId = new URLSearchParams(location.search).get('run');

async function boot() {
  const run = getRun(runId);
  if (!run) {
    root.innerHTML = `<h1 tabindex="-1">No finished run <em>yet</em></h1>
      <p class="lede">Play a scenario to the end and your debrief will appear here. Runs are stored only in this browser.</p>
      <p><a class="btn" href="index.html#scenarios">Choose a scenario</a></p>`;
    return;
  }
  let scenario, refs;
  try {
    [scenario, refs] = await Promise.all([loadScenario(run.scenarioId), loadReferences()]);
  } catch (e) {
    showError(root, e.message);
    return;
  }
  const state = run.state;
  const results = computeResults(scenario, state);
  document.title = `Debrief: ${scenario.title} · Ransomware Tabletop`;

  root.innerHTML = [
    header(scenario, results, state),
    compare(scenario, results),
    timeline(scenario, state, refs),
    csfSection(results),
    missed(scenario, results, refs),
    preparation(scenario),
    actions(scenario),
  ].join('');

  document.getElementById('export-btn').addEventListener('click', () => exportRun(scenario, run, results));
  document.getElementById('print-btn').addEventListener('click', () => window.print());
  root.querySelector('h1').focus();
}

// 1. outcome header -------------------------------------------------------------
function header(scenario, r, state) {
  const e = r.ending || { outcome: 'Unfinished run', summary: '' };
  return `
  <section class="card" aria-labelledby="outcome-title">
    <div class="outcome-head">
      <div>
        <p class="eyebrow">Debrief · ${esc(scenario.title)}</p>
        <h1 id="outcome-title" tabindex="-1">${esc(e.outcome)}</h1>
        <p class="lede">${esc(e.summary)}</p>
        <p class="muted">${r.decisions} decisions · finished ${esc(formatClock(scenario, state.clock))}</p>
      </div>
      <div class="grade" aria-label="Grade ${esc(r.grade)}, score ${r.total} out of 100">${esc(r.grade)}<small>${r.total.toFixed(1)} / 100</small></div>
    </div>
  </section>`;
}

// meters vs best ending -----------------------------------------------------------
function compare(scenario, r) {
  const bench = scenario.benchmark;
  const sub = subscores(r.meters, scenario);
  const rows = METERS.map((k) => {
    const you = r.meters[k];
    const best = bench?.meters?.[k];
    let verdict = '';
    if (best !== undefined) {
      const diff = you - best;
      const better = METER_INFO[k].higherIsBetter ? diff > 0 : diff < 0;
      verdict = diff === 0 ? '<span class="muted">Matched</span>' : `<span class="${better ? 'better' : 'worse'}">${better ? 'Better' : 'Worse'}</span>`;
    }
    return `<tr><th scope="row">${esc(METER_INFO[k].label)}</th><td class="num">${esc(formatMeter(k, you))}</td><td class="num">${best !== undefined ? esc(formatMeter(k, best)) : '—'}</td><td>${verdict}</td><td class="num">${Math.round(sub[k])}</td><td class="num">${WEIGHTS[k]}%</td></tr>`;
  }).join('');
  const bands = GRADE_BANDS.filter((b) => b.grade !== 'F').map((b) => `${b.grade} ≥ ${b.min}`).join(' · ');
  return `
  <section class="section" aria-labelledby="meters-title">
    <h2 id="meters-title">Your meters vs. the <em>best run</em></h2>
    <p class="muted">“Best run” is the highest-scoring of every possible path through this scenario (${esc(bench?.outcome || 'n/a')}, grade ${esc(bench?.grade || '—')}), found by playing every path automatically.</p>
    <div class="table-scroll card">
      <table class="data">
        <thead><tr><th scope="col">Meter</th><th scope="col" class="num">You</th><th scope="col" class="num">Best run</th><th scope="col">Compared</th><th scope="col" class="num">Subscore</th><th scope="col" class="num">Weight</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="muted" style="margin-top:.75rem">How the grade works: each meter becomes a 0–100 subscore (cost and downtime against this scenario's worst case of ${esc(formatMeter('cost', scenario.scoring?.costBad ?? 1e6))} and ${esc(formatMeter('downtime', scenario.scoring?.downtimeBad ?? 336))}; trust as is; data loss and legal exposure inverted), then they are combined with the weights shown. Grades: ${bands} · F below.</p>
  </section>`;
}

// 2. decision timeline ------------------------------------------------------------
function timeline(scenario, state, refs) {
  const items = state.history.map((e) => {
    const time = esc(formatClock(scenario, e.clock));
    if (e.type === 'choice') {
      const node = scenario.nodes[e.nodeId];
      const c = node.choices.find((x) => x.id === e.choiceId);
      if (!c) return '';
      const d = c.debrief;
      return `<li>
        <p class="timeline-time">${time} · ${esc(node.title)}</p>
        <p class="timeline-title">${esc(c.label)}</p>
        <p class="badges">${csfBadge(c.csf)} ${phaseBadge(c.legacyPhase)}${c.keyDecision ? ' <span class="badge badge-key">Key decision</span>' : ''}</p>
        ${deltaList(e.deltas)}
        <p class="note-block"><strong>Why it matters:</strong> ${esc(d.whyItMatters)}</p>
        <p class="note-block"><strong>Better practice:</strong> ${esc(d.betterPractice)}</p>
        ${d.realWorld ? `<p class="note-block"><strong>Real-world parallel:</strong> ${esc(d.realWorld)}</p>` : ''}
        <p class="refs-inline muted">Sources: ${citeLinks(d.referenceIds, refs)}</p>
      </li>`;
    }
    if (e.type === 'inject') {
      const inj = (scenario.injects || []).find((i) => i.id === e.injectId);
      const m = inj?.message || {};
      return `<li class="is-event">
        <p class="timeline-time">${time} · Development</p>
        <p class="timeline-title">${esc(m.subject || `${m.from}`)}</p>
        <p class="muted note-block">${esc(m.from)}: ${esc(m.body)}</p>
        ${deltaList(e.deltas)}
      </li>`;
    }
    if (e.type === 'node') {
      const node = scenario.nodes[e.nodeId];
      return `<li class="is-event">
        <p class="timeline-time">${time} · Consequence</p>
        <p class="timeline-title">${esc(node.title)}</p>
        ${deltaList(e.deltas)}
      </li>`;
    }
    return '';
  }).join('');
  return `
  <section class="section" aria-labelledby="timeline-title">
    <h2 id="timeline-title">Decision <em>timeline</em></h2>
    <p class="muted">Each decision with its time, NIST CSF 2.0 Function, legacy SP 800-61 Rev. 2 phase, and meter changes. Filled markers are events you didn't choose.</p>
    <ol class="timeline">${items}</ol>
  </section>`;
}

// 3. CSF function chart (plain SVG) ------------------------------------------------
function csfSection(r) {
  const codes = Object.keys(CSF_FUNCTIONS);
  const max = Math.max(1, ...codes.map((c) => r.csfCounts[c]));
  const rowH = 34, labelW = 120, barW = 360, W = labelW + barW + 40, H = codes.length * rowH + 10;
  const bars = codes.map((c, i) => {
    const n = r.csfCounts[c];
    const w = (n / max) * barW;
    const y = 5 + i * rowH;
    return `<g>
      <text x="0" y="${y + 21}" font-size="14" font-weight="600">${c} · ${esc(CSF_FUNCTIONS[c].name)}</text>
      <rect x="${labelW}" y="${y + 6}" width="${barW}" height="20" rx="4" fill="var(--surface-2)"/>
      <rect x="${labelW}" y="${y + 6}" width="${Math.max(n ? 4 : 0, w)}" height="20" rx="4" fill="var(--${c.toLowerCase()}-fg)"/>
      <text x="${labelW + Math.max(w, 0) + 8}" y="${y + 21}" font-size="14" font-weight="700">${n}</text>
    </g>`;
  }).join('');
  const table = codes.map((c) => `<tr><th scope="row">${c} ${esc(CSF_FUNCTIONS[c].name)}</th><td class="num">${r.csfCounts[c]}</td></tr>`).join('');
  return `
  <section class="section" aria-labelledby="csf-title">
    <h2 id="csf-title">Your response by <em>NIST function</em></h2>
    <div class="grid grid-2">
      <div class="card">
        <svg class="csf-chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="csf-svg-title">
          <title id="csf-svg-title">Number of your decisions in each CSF 2.0 Function</title>
          ${bars}
        </svg>
        <table class="sr-only"><caption>Decisions per function</caption><tbody>${table}</tbody></table>
      </div>
      <div class="csf-legend">
        ${codes.map((c) => `<p>${csfBadge(c)} ${esc(CSF_FUNCTIONS[c].blurb)}</p>`).join('')}
      </div>
    </div>
    <p class="muted" style="margin-top:1rem">During an incident most decisions are Respond and Recover. Govern, Identify and Protect are mostly about the preparation that decides how hard those calls are. <a href="learn.html#nist">How SP 800-61 Rev. 3 uses the six Functions</a>.</p>
  </section>`;
}

// 4. missed opportunities -----------------------------------------------------------
function missed(scenario, r, refs) {
  if (!r.missed.length) {
    return `<section class="section" aria-labelledby="missed-title"><h2 id="missed-title">Missed <em>opportunities</em></h2>
      <div class="callout"><p>You took every key decision that was offered to you. Well run.</p></div></section>`;
  }
  return `
  <section class="section" aria-labelledby="missed-title">
    <h2 id="missed-title">Missed <em>opportunities</em></h2>
    <p class="muted">Key decisions that were on the table but that you didn't take.</p>
    <div class="grid">
      ${r.missed.map((m) => `
        <article class="card">
          <p class="timeline-time">${esc(formatClock(scenario, m.clock))} · ${esc(scenario.nodes[m.nodeId].title)}</p>
          <h3>${esc(m.choice.label)}</h3>
          <p class="badges">${csfBadge(m.choice.csf)} ${phaseBadge(m.choice.legacyPhase)}</p>
          <p>${esc(m.choice.debrief.betterPractice)}</p>
          <p class="refs-inline muted">Sources: ${citeLinks(m.choice.debrief.referenceIds, refs)}</p>
        </article>`).join('')}
    </div>
  </section>`;
}

// 5. preparation ----------------------------------------------------------------------
function preparation(scenario) {
  const facts = Object.values(scenario.hiddenFacts || {}).filter((f) => typeof f === 'object' && f.preparation);
  if (!facts.length) return '';
  return `
  <section class="section" aria-labelledby="prep-title">
    <h2 id="prep-title">Preparation would have <em>changed this</em></h2>
    <p class="muted">What was true all along, and the pre-incident measure that would have defused it.</p>
    <div class="grid grid-2">
      ${facts.map((f) => `
        <article class="card">
          <p class="badges">${csfBadge(f.preparation.csf)}</p>
          <h3>${esc(f.preparation.measure)}</h3>
          <p class="note-block"><strong>What was true:</strong> ${esc(f.label)}.</p>
          <p class="note-block">${esc(f.preparation.detail)}</p>
        </article>`).join('')}
    </div>
  </section>`;
}

// 6. actions -----------------------------------------------------------------------------
function actions(scenario) {
  return `
  <section class="section no-print" aria-label="What next">
    <div class="btn-row">
      <a class="btn" href="play.html?scenario=${encodeURIComponent(scenario.id)}">Replay this scenario</a>
      <a class="btn btn-secondary" href="index.html#scenarios">Try another scenario</a>
      <button class="btn btn-ghost" type="button" id="export-btn">Export run (JSON)</button>
      <button class="btn btn-ghost" type="button" id="print-btn">Print</button>
    </div>
  </section>`;
}

function exportRun(scenario, run, results) {
  const decisions = run.state.history.map((e) => {
    if (e.type !== 'choice') return { type: e.type, id: e.injectId || e.nodeId, time: formatClock(scenario, e.clock), deltas: e.deltas };
    const c = scenario.nodes[e.nodeId].choices.find((x) => x.id === e.choiceId);
    return { type: 'choice', time: formatClock(scenario, e.clock), node: e.nodeId, choice: e.choiceId, label: c?.label, csf: c?.csf, legacyPhase: c?.legacyPhase, deltas: e.deltas };
  });
  const data = {
    tool: 'Ransomware Tabletop',
    scenario: { id: scenario.id, title: scenario.title },
    finishedAt: new Date(run.finishedAt).toISOString(),
    outcome: results.ending,
    grade: results.grade,
    score: results.total,
    meters: results.meters,
    csfCounts: results.csfCounts,
    missedKeyDecisions: results.missed.map((m) => ({ node: m.nodeId, choice: m.choiceId, label: m.choice.label })),
    timeline: decisions,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ransomware-tabletop-${scenario.id}-${new Date(run.finishedAt).toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

boot();

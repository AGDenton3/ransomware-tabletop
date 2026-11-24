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
    root.innerHTML = `<h1 tabindex="-1">No receipt <em>yet</em></h1>
      <p class="lede">Finish a shift and your receipt prints here. Runs are kept only in this browser.</p>
      <p><a class="btn" href="index.html#scenarios">Pick your shift</a></p>`;
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
    timeline(scenario, state, refs, results),
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
  const e = r.ending || { outcome: 'Unfinished shift', summary: '' };
  return `
  <section class="outcome-card" aria-labelledby="outcome-title">
    <div class="outcome-head">
      <div>
        <p class="eyebrow">Last call · ${esc(scenario.title)}</p>
        <h1 id="outcome-title" tabindex="-1">${esc(e.outcome)}</h1>
        <p class="lede">${esc(e.summary)}</p>
        <p>${r.decisions} calls made · lights off ${esc(formatClock(scenario, state.clock))}</p>
      </div>
      <div class="grade" role="img" aria-label="Grade ${esc(r.grade)}, score ${r.total} out of 100"><span aria-hidden="true">${esc(r.grade)}</span><small aria-hidden="true">${r.total.toFixed(1)}/100</small></div>
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
      verdict = diff === 0 ? '<span>Even</span>' : `<span class="${better ? 'better' : 'worse'}">${better ? 'Better' : 'Worse'}</span>`;
    }
    return `<tr><th scope="row">${esc(METER_INFO[k].label)}</th><td class="num">${esc(formatMeter(k, you))}</td><td class="num">${best !== undefined ? esc(formatMeter(k, best)) : '—'}</td><td>${verdict}</td><td class="num">${Math.round(sub[k])}</td><td class="num">${WEIGHTS[k]}%</td></tr>`;
  }).join('');
  const bands = GRADE_BANDS.filter((b) => b.grade !== 'F').map((b) => `${b.grade} ≥ ${b.min}`).join(' · ');
  return `
  <section class="section" aria-labelledby="meters-title">
    <div class="section-head"><h2 id="meters-title">You vs. the <em>house best</em></h2></div>
    <p>The house best is the highest-scoring of every possible path through this shift (${esc(bench?.outcome || 'n/a')}, grade ${esc(bench?.grade || '—')}), found by playing every path automatically.</p>
    <div class="table-scroll menu-board">
      <table class="data">
        <thead><tr><th scope="col">Meter</th><th scope="col" class="num">You</th><th scope="col" class="num">House best</th><th scope="col">Compared</th><th scope="col" class="num">Subscore</th><th scope="col" class="num">Weight</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p style="margin-top:1.2rem">How the grade works: each meter becomes a 0–100 subscore (cost and downtime against this scenario's worst case of ${esc(formatMeter('cost', scenario.scoring?.costBad ?? 1e6))} and ${esc(formatMeter('downtime', scenario.scoring?.downtimeBad ?? 336))}; trust as is; data loss and legal exposure inverted), then they are combined with the weights shown. Grades: ${bands} · F below.</p>
  </section>`;
}

// 2. decision timeline: one long itemized receipt -----------------------------------
function timeline(scenario, state, refs, r) {
  const items = state.history.map((e) => {
    const time = esc(formatClock(scenario, e.clock).replace('Day ', 'D').replace(' · ', ' '));
    if (e.type === 'choice') {
      const node = scenario.nodes[e.nodeId];
      const c = node.choices.find((x) => x.id === e.choiceId);
      if (!c) return '';
      const d = c.debrief;
      return `<li>
        <div class="line-item">
          <span class="timeline-time">${time}</span>
          <p class="timeline-title">${esc(c.label)}</p>
          ${csfBadge(c.csf)}
          <div class="line-body">
            <p class="badges">${phaseBadge(c.legacyPhase)}${c.keyDecision ? ' <span class="badge-key">Key call</span>' : ''}</p>
            ${deltaList(e.deltas)}
            <p class="note-block"><strong>Why it matters</strong> ${esc(d.whyItMatters)}</p>
            <p class="note-block"><strong>Better practice</strong> ${esc(d.betterPractice)}</p>
            ${d.realWorld ? `<p class="note-block"><strong>Real-world parallel</strong> ${esc(d.realWorld)}</p>` : ''}
            <p class="refs-inline">Sources: ${citeLinks(d.referenceIds, refs)}</p>
          </div>
        </div>
      </li>`;
    }
    if (e.type === 'inject' || e.type === 'node') {
      const inj = e.type === 'inject' ? (scenario.injects || []).find((i) => i.id === e.injectId) : null;
      const m = inj?.message || {};
      const title = inj ? (m.subject || m.from) : scenario.nodes[e.nodeId].title;
      return `<li class="is-event">
        <div class="line-item">
          <span class="timeline-time">${time}</span>
          <p class="timeline-title">${esc(title)}</p>
          <span></span>
          <div class="line-body">
            ${inj ? `<p class="note-block">${esc(m.from)}: ${esc(m.body)}</p>` : ''}
            ${deltaList(e.deltas)}
          </div>
        </div>
      </li>`;
    }
    return '';
  }).join('');
  const dots = '<span class="dots" aria-hidden="true"></span>';
  const totals = METERS.map((k) => `<div><span>${esc(METER_INFO[k].label)}</span>${dots}<span>${esc(formatMeter(k, r.meters[k]))}</span></div>`).join('');
  return `
  <section class="section" aria-labelledby="timeline-title">
    <div class="section-head"><h2 id="timeline-title">The <em>receipt</em></h2></div>
    <p style="max-width:46rem;margin:0 auto 1.6rem">Every call you made, rung up in order: the time, the NIST CSF 2.0 Function on the bottle cap, the old SP 800-61 Rev. 2 phase, and what it did to the board. Shaded lines are kitchen notes: things that happened to you.</p>
    <div class="receipt-wrap">
      <div class="ticket receipt">
        <div class="receipt-header">
          <p class="order">Order #477</p>
          <p>${esc(scenario.orgProfile.name)}</p>
          <p>Server: you · ${r.decisions} items</p>
        </div>
        <ol class="timeline">${items}</ol>
        <p class="tear" aria-hidden="true">- - - - tear here - - - -</p>
        <div class="totals">
          ${totals}
          <div><span>Subtotal (score)</span>${dots}<span>${r.total.toFixed(1)} / 100</span></div>
          <div class="grand"><span>Total</span>${dots}<span class="grade-mark" aria-label="Grade ${esc(r.grade)}">${esc(r.grade)}</span></div>
        </div>
        <p class="thanks">Thank you, come again… prepared</p>
        <p>No refunds on downtime.</p>
      </div>
    </div>
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
      <rect x="${labelW}" y="${y + 6}" width="${barW}" height="20" fill="var(--grease)"/>
      <rect x="${labelW}" y="${y + 6}" width="${Math.max(n ? 4 : 0, w)}" height="20" fill="var(--cap-${c})" stroke="var(--chalk)" stroke-width="2"/>
      <text x="${labelW + Math.max(w, 0) + 8}" y="${y + 21}" font-size="14" font-weight="700">${n}</text>
    </g>`;
  }).join('');
  const table = codes.map((c) => `<tr><th scope="row">${c} ${esc(CSF_FUNCTIONS[c].name)}</th><td class="num">${r.csfCounts[c]}</td></tr>`).join('');
  return `
  <section class="section" aria-labelledby="csf-title">
    <div class="section-head"><h2 id="csf-title">Your calls by <em>NIST function</em></h2></div>
    <div class="grid grid-2">
      <div class="card tilt-l">
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
    <p style="margin-top:1.4rem">During an incident most decisions are Respond and Recover. Govern, Identify and Protect are mostly about the preparation that decides how hard those calls are. <a href="learn.html#nist">How SP 800-61 Rev. 3 uses the six Functions</a>.</p>
  </section>`;
}

// 4. missed opportunities -----------------------------------------------------------
function missed(scenario, r, refs) {
  if (!r.missed.length) {
    return `<section class="section" aria-labelledby="missed-title"><div class="section-head"><h2 id="missed-title">Missed <em>opportunities</em></h2><span class="count" aria-hidden="true">00</span></div>
      <div class="callout"><p>You made every key call that was put in front of you. Clean shift.</p></div></section>`;
  }
  return `
  <section class="section" aria-labelledby="missed-title">
    <div class="section-head"><h2 id="missed-title">Missed <em>opportunities</em></h2><span class="count" aria-hidden="true">${String(r.missed.length).padStart(2, '0')}</span></div>
    <p>Key calls that were on the table and got left there.</p>
    <div class="grid grid-2">
      ${r.missed.map((m) => `
        <article class="sticky">
          <p class="timeline-time">${esc(formatClock(scenario, m.clock))} · ${esc(scenario.nodes[m.nodeId].title)}</p>
          <h3>${esc(m.choice.label)}</h3>
          <p class="badges">${csfBadge(m.choice.csf)} ${phaseBadge(m.choice.legacyPhase)}</p>
          <p>${esc(m.choice.debrief.betterPractice)}</p>
          <p class="refs-inline">Sources: ${citeLinks(m.choice.debrief.referenceIds, refs)}</p>
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
    <div class="section-head"><h2 id="prep-title">What a little prep <em>would've saved</em></h2></div>
    <p>What was true the whole time, and the fix that would have taken the sting out of it.</p>
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
      <a class="btn" href="play.html?scenario=${encodeURIComponent(scenario.id)}">Run it back</a>
      <a class="btn btn-secondary" href="index.html#scenarios">Pick another shift</a>
      <button class="btn btn-secondary" type="button" id="export-btn">Save the receipt (JSON)</button>
      <button class="btn btn-secondary" type="button" id="print-btn">Print it</button>
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

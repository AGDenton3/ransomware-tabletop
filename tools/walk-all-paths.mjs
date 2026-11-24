#!/usr/bin/env node
// Play every possible path through each scenario headlessly with the real engine.
// Reports each ending's reach and meter ranges, and flags QA problems:
//   - endings no path reaches
//   - dominant strategies (scenario.qa.shouldNotDominate flags that win anyway)
//   - nonsense meter values (pinned at a clamp limit on most paths, NaN, etc.)
// Usage:
//   node tools/walk-all-paths.mjs                 # all scenarios in index.json
//   node tools/walk-all-paths.mjs clinic          # one scenario
//   node tools/walk-all-paths.mjs --write         # also store the best run as scenario.benchmark
//   node tools/walk-all-paths.mjs --json          # machine-readable summary

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createState, choose, METERS, formatClock } from '../js/engine/state.js';
import { availableChoices } from '../js/engine/resolve.js';
import { totalScore, letterGrade } from '../js/engine/score.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const JSON_OUT = args.includes('--json');
const ids = args.filter((a) => !a.startsWith('--'));
const MAX_PATHS = 2_000_000;

export function walk(scn) {
  const paths = [];
  const stack = [{ state: createState(scn), path: [] }];
  while (stack.length) {
    const { state, path } = stack.pop();
    if (state.ended) {
      const total = totalScore(state.meters, scn);
      paths.push({ ending: state.nodeId, meters: state.meters, flags: state.flags, clock: state.clock, total, grade: letterGrade(total), path });
      if (paths.length > MAX_PATHS) throw new Error('Too many paths');
      continue;
    }
    const choices = availableChoices(scn, state);
    if (!choices.length) throw new Error(`Dead end at node "${state.nodeId}" after ${path.join(' → ')}`);
    for (const c of choices) stack.push({ state: choose(scn, state, c.id), path: [...path, `${state.nodeId}:${c.id}`] });
  }
  return paths;
}

export function analyze(scn, paths) {
  const endings = Object.keys(scn.nodes).filter((id) => scn.nodes[id].ending);
  const byEnding = {};
  for (const e of endings) byEnding[e] = { outcome: scn.nodes[e].outcome, count: 0, ranges: {}, grades: {}, best: null, worst: null };
  for (const p of paths) {
    const b = byEnding[p.ending];
    b.count++;
    b.grades[p.grade] = (b.grades[p.grade] || 0) + 1;
    for (const k of METERS) {
      const r = (b.ranges[k] ||= { min: Infinity, max: -Infinity });
      r.min = Math.min(r.min, p.meters[k]);
      r.max = Math.max(r.max, p.meters[k]);
    }
    if (!b.best || p.total > b.best.total) b.best = p;
    if (!b.worst || p.total < b.worst.total) b.worst = p;
  }

  const problems = [];
  for (const [id, b] of Object.entries(byEnding)) if (!b.count) problems.push(`Ending "${id}" is unreachable on every path.`);

  for (const flag of scn.qa?.shouldNotDominate || []) {
    const withF = paths.filter((p) => p.flags[flag]);
    const without = paths.filter((p) => !p.flags[flag]);
    if (!withF.length || !without.length) continue;
    const bestWith = withF.reduce((m, p) => Math.max(m, p.total), -Infinity);
    const bestWithout = without.reduce((m, p) => Math.max(m, p.total), -Infinity);
    const avgWith = withF.reduce((s, p) => s + p.total, 0) / withF.length;
    const avgWithout = without.reduce((s, p) => s + p.total, 0) / without.length;
    if (bestWith >= bestWithout) problems.push(`Dominant strategy: the best path with "${flag}" (${bestWith.toFixed(1)}) matches or beats the best without it (${bestWithout.toFixed(1)}).`);
    if (avgWith > avgWithout + 5) problems.push(`"${flag}" scores better on average (${avgWith.toFixed(1)} vs ${avgWithout.toFixed(1)}).`);
  }

  // A choice that, wherever it appears, never makes the score worse than its siblings is fine; we look
  // instead for a first move that strictly dominates (every path through it beats every path not through it).
  const firstMoves = {};
  for (const p of paths) (firstMoves[p.path[0]] ||= []).push(p.total);
  const fm = Object.entries(firstMoves);
  for (const [move, totals] of fm) {
    const others = fm.filter(([m]) => m !== move).flatMap(([, t]) => t);
    const minT = totals.reduce((m, t) => Math.min(m, t), Infinity);
    const maxO = others.reduce((m, t) => Math.max(m, t), -Infinity);
    if (others.length && minT > maxO) problems.push(`First move "${move}" strictly dominates every alternative (no overlap in scores).`);
  }

  for (const p of paths) for (const k of METERS) if (!Number.isFinite(p.meters[k])) problems.push(`Non-numeric ${k} on path ${p.path.join(' → ')}`);
  const share = (pred) => paths.filter(pred).length / paths.length;
  if (share((p) => p.meters.trust <= 0) > 0.25) problems.push('Public Trust hits 0 on more than a quarter of paths; deltas are too harsh.');
  if (share((p) => p.meters.legal >= 100) > 0.25) problems.push('Legal Exposure hits 100 on more than a quarter of paths; deltas are too harsh.');
  if (share((p) => p.meters.dataLoss >= 100) > 0.05) problems.push('Data Loss reaches 100% on more than 5% of paths.');

  const best = paths.reduce((a, b) => (b.total > a.total ? b : a));
  const worst = paths.reduce((a, b) => (b.total < a.total ? b : a));
  const grades = {};
  for (const p of paths) grades[p.grade] = (grades[p.grade] || 0) + 1;
  return { paths: paths.length, byEnding, problems, best, worst, grades };
}

const fmt = { cost: (v) => `$${Math.round(v / 1000)}k`, downtime: (v) => `${(v / 24).toFixed(1)}d`, dataLoss: (v) => `${v}%`, trust: (v) => `${v}`, legal: (v) => `${v}` };
const range = (k, r) => (r.min === r.max ? fmt[k](r.min) : `${fmt[k](r.min)}–${fmt[k](r.max)}`);
const meterLine = (m) => METERS.map((k) => `${k} ${fmt[k](m[k])}`).join(' · ');
const pathLine = (p) => p.path.map((s) => s.split(':')[1]).join(' → ');

function main() {
  const index = JSON.parse(readFileSync(join(ROOT, 'data/scenarios/index.json'), 'utf8'));
  const list = ids.length ? ids : index.scenarios.map((s) => s.id);
  const summary = {};
  let failed = false;
  for (const id of list) {
    const file = join(ROOT, 'data/scenarios', `${id}.json`);
    const scn = JSON.parse(readFileSync(file, 'utf8'));
    const res = analyze(scn, walk(scn));
    summary[id] = res;
    if (res.problems.length) failed = true;
    if (WRITE) {
      scn.benchmark = { ending: res.best.ending, outcome: scn.nodes[res.best.ending].outcome, meters: res.best.meters, total: Math.round(res.best.total * 10) / 10, grade: res.best.grade, path: res.best.path };
      writeFileSync(file, `${JSON.stringify(scn, null, 2)}\n`);
    }
    if (JSON_OUT) continue;
    console.log(`\n=== ${scn.title} (${id}) ===`);
    console.log(`${res.paths.toLocaleString()} complete paths · grades ${Object.entries(res.grades).sort().map(([g, n]) => `${g}:${n}`).join(' ')}`);
    for (const [eid, b] of Object.entries(res.byEnding)) {
      console.log(`\n  ${b.outcome} [${eid}]: ${b.count.toLocaleString()} paths (${((b.count / res.paths) * 100).toFixed(1)}%) · grades ${Object.entries(b.grades).sort().map(([g, n]) => `${g}:${n}`).join(' ')}`);
      if (!b.count) continue;
      console.log(`    ranges: ${METERS.map((k) => `${k} ${range(k, b.ranges[k])}`).join(' · ')}`);
      console.log(`    best (${b.best.grade}, ${b.best.total.toFixed(1)}): ${pathLine(b.best)}`);
      console.log(`      → ${meterLine(b.best.meters)} · ends ${formatClock(scn, b.best.clock)}`);
      console.log(`    worst (${b.worst.grade}, ${b.worst.total.toFixed(1)}): ${pathLine(b.worst)}`);
      console.log(`      → ${meterLine(b.worst.meters)}`);
    }
    console.log(res.problems.length ? `\n  PROBLEMS:\n${res.problems.map((p) => `   - ${p}`).join('\n')}` : '\n  No balance problems found.');
  }
  if (JSON_OUT) {
    const slim = Object.fromEntries(Object.entries(summary).map(([id, r]) => [id, { paths: r.paths, grades: r.grades, problems: r.problems, endings: Object.fromEntries(Object.entries(r.byEnding).map(([e, b]) => [e, { outcome: b.outcome, count: b.count, ranges: b.ranges, grades: b.grades }])) }]));
    console.log(JSON.stringify(slim, null, 2));
  }
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();

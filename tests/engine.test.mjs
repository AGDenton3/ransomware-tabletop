// Engine tests. Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createState, choose, applyEffects, formatClock, maxClock, jumpTo } from '../js/engine/state.js';
import { availableChoices, resolveNext, matches } from '../js/engine/resolve.js';
import { computeResults, totalScore, letterGrade, WEIGHTS } from '../js/engine/score.js';
import { saveProgress, loadProgress, recordRun, getRun, listRuns } from '../js/engine/save.js';
import { validateScenario } from '../tools/validate.mjs';

const sample = JSON.parse(readFileSync(new URL('../data/scenarios/_sample.json', import.meta.url)));
const refs = JSON.parse(readFileSync(new URL('../data/references.json', import.meta.url)));

const play = (scn, ids) => ids.reduce((s, id) => choose(scn, s, id), createState(scn));

test('sample scenario passes validation', () => {
  const { errors } = validateScenario(sample, refs, '_sample.json');
  assert.deepEqual(errors, []);
});

test('createState starts at the start node with hidden facts as flags', () => {
  const s = createState(sample);
  assert.equal(s.nodeId, 'start');
  assert.equal(s.clock, 0);
  assert.equal(s.flags.backupsIntact, true);
  assert.deepEqual(s.meters, { cost: 0, downtime: 0, dataLoss: 0, trust: 70, legal: 10 });
  assert.equal(s.ended, false);
});

test('choose applies effects, sets flags, advances the clock and logs history', () => {
  const s0 = createState(sample);
  const s1 = choose(sample, s0, 'isolate');
  assert.equal(s1.nodeId, 'scope');
  assert.equal(s1.clock, 2);
  assert.equal(s1.meters.downtime, 4);
  assert.equal(s1.meters.cost, 500);
  assert.equal(s1.flags.isolated, true);
  assert.equal(s1.flagTimes.isolated, 0);
  const entry = s1.history.at(-1);
  assert.equal(entry.type, 'choice');
  assert.equal(entry.choiceId, 'isolate');
  assert.deepEqual(entry.deltas, { downtime: 4, cost: 500 });
  assert.deepEqual(entry.available, ['isolate', 'keep_running']);
});

test('state updates are immutable', () => {
  const s0 = createState(sample);
  const snapshot = JSON.stringify(s0);
  choose(sample, s0, 'isolate');
  assert.equal(JSON.stringify(s0), snapshot);
});

test('conditional next follows hidden facts', () => {
  const good = play(sample, ['isolate', 'check_backups']);
  assert.equal(good.nodeId, 'backups_good');
  const flipped = structuredClone(sample);
  flipped.hiddenFacts.backupsIntact.value = false;
  const bad = play(flipped, ['isolate', 'check_backups']);
  assert.equal(bad.nodeId, 'backups_bad');
});

test('resolveNext and matches handle else branches, unset flags and clock keys', () => {
  const st = { flags: { a: true }, clock: 10 };
  assert.equal(resolveNext([{ if: { a: false }, next: 'x' }, { else: 'y' }], st), 'y');
  assert.equal(resolveNext('z', st), 'z');
  assert.equal(matches({ missing: false }, st), true);
  assert.equal(matches({ $clockGte: 10 }, st), true);
  assert.equal(matches({ $clockLt: 10 }, st), false);
});

test('requires hides choices until met', () => {
  const notIsolated = play(sample, ['keep_running', 'skip_check']);
  assert.deepEqual(availableChoices(sample, notIsolated).map((c) => c.id), ['pay']);
  const isolated = play(sample, ['isolate', 'skip_check']);
  assert.deepEqual(availableChoices(sample, isolated).map((c) => c.id), ['pay', 'rebuild']);
  assert.throws(() => choose(sample, notIsolated, 'rebuild'), /not available/);
});

test('injects fire once when clock and condition are met', () => {
  // keep_running: clock 2 at scope (inject needs hour 3) → skip_check: clock 3 → fires
  const s1 = play(sample, ['keep_running']);
  assert.equal(s1.firedInjects.length, 0);
  const s2 = choose(sample, s1, 'skip_check');
  assert.deepEqual(s2.firedInjects, ['spread']);
  assert.equal(s2.flags.spreadToLaptop, true);
  assert.equal(s2.injectMessages.length, 1);
  assert.equal(s2.meters.dataLoss, 30); // 20 from choice + 10 from inject
  const s3 = choose(sample, s2, 'pay');
  assert.equal(s3.firedInjects.length, 1, 'does not fire twice');
  assert.equal(s3.injectMessages.length, 0);
});

test('injects do not fire when the condition is false', () => {
  const s = play(sample, ['isolate', 'skip_check', 'pay']);
  assert.deepEqual(s.firedInjects, []);
});

test('meters are clamped to their ranges', () => {
  const { meters, deltas } = applyEffects({ cost: 100, downtime: 0, dataLoss: 95, trust: 5, legal: 98 }, { cost: -500, dataLoss: 20, trust: -30, legal: 10 });
  assert.deepEqual(meters, { cost: 0, downtime: 0, dataLoss: 100, trust: 0, legal: 100 });
  assert.deepEqual(deltas, { cost: -100, dataLoss: 5, trust: -5, legal: 2 }, 'records the delta actually applied');
});

test('the clock is capped at the end of Day 14 and formats correctly', () => {
  assert.equal(formatClock(sample, 0), 'Day 1 · 07:42');
  assert.equal(formatClock(sample, 1.55), 'Day 1 · 09:15');
  assert.equal(formatClock(sample, 24), 'Day 2 · 07:42');
  assert.equal(formatClock(sample, maxClock(sample)), 'Day 15 · 00:00');
  const long = structuredClone(sample);
  long.nodes.end_restore.clockAdvance = 336;
  const s = play(long, ['isolate', 'check_backups', 'restore']);
  assert.equal(s.clock, maxClock(long));
});

test('reaching an ending marks the state ended and blocks further choices', () => {
  const s = play(sample, ['isolate', 'check_backups', 'restore']);
  assert.equal(s.ended, true);
  assert.equal(s.nodeId, 'end_restore');
  assert.throws(() => choose(sample, s, 'restore'), /ended/);
});

test('scoring: weights sum to 100, grades and CSF counts', () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
  const perfect = { cost: 0, downtime: 0, dataLoss: 0, trust: 100, legal: 0 };
  assert.equal(totalScore(perfect, sample), 100);
  assert.equal(letterGrade(100), 'A');
  assert.equal(letterGrade(0), 'F');
  const good = computeResults(sample, play(sample, ['isolate', 'check_backups', 'restore']));
  const bad = computeResults(sample, play(sample, ['keep_running', 'skip_check', 'pay']));
  assert.ok(good.total > bad.total, `good ${good.total} should beat bad ${bad.total}`);
  assert.deepEqual(good.csfCounts, { GV: 0, ID: 1, PR: 0, DE: 0, RS: 1, RC: 1 });
  assert.equal(good.ending.outcome, 'Restored without paying');
  assert.equal(good.decisions, 3);
});

test('missed opportunities list key decisions that were available but skipped', () => {
  const r = computeResults(sample, play(sample, ['keep_running', 'skip_check', 'pay']));
  assert.deepEqual(r.missed.map((m) => m.choiceId), ['isolate', 'check_backups']);
  const r2 = computeResults(sample, play(sample, ['isolate', 'check_backups', 'restore']));
  assert.deepEqual(r2.missed, []);
});

test('jumpTo moves to any node (debug)', () => {
  const s = jumpTo(sample, createState(sample), 'backups_bad');
  assert.equal(s.nodeId, 'backups_bad');
});

test('save/resume and completed runs round-trip through storage', () => {
  const mem = new Map();
  const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const s = play(sample, ['isolate']);
  saveProgress(s, storage);
  assert.equal(loadProgress('_sample', storage).state.nodeId, 'scope');
  const done = play(sample, ['isolate', 'check_backups', 'restore']);
  const id = recordRun(done, computeResults(sample, done), storage);
  assert.equal(loadProgress('_sample', storage), null, 'finishing clears the save');
  assert.equal(getRun(id, storage).state.nodeId, 'end_restore');
  assert.equal(getRun(null, storage).id, id, 'last run is the default');
  assert.equal(listRuns(storage).length, 1);
});

test('save functions survive a broken storage object', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('x'); } };
  assert.equal(saveProgress(createState(sample), broken), false);
  assert.equal(loadProgress('_sample', broken), null);
  assert.deepEqual(listRuns(broken), []);
});

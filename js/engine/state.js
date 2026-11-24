// Game state: creation and immutable transitions.
// Pure functions. No DOM access. No scenario-specific logic.

import { availableChoices, resolveNext, dueInjects } from './resolve.js';

export const METERS = ['cost', 'downtime', 'dataLoss', 'trust', 'legal'];

export const METER_INFO = {
  cost:     { label: 'Cost',           min: 0, max: 10_000_000, higherIsBetter: false, unit: '$' },
  downtime: { label: 'Downtime',       min: 0, max: 2_160,      higherIsBetter: false, unit: 'h' },
  dataLoss: { label: 'Data Loss',      min: 0, max: 100,        higherIsBetter: false, unit: '%' },
  trust:    { label: 'Public Trust',   min: 0, max: 100,        higherIsBetter: true,  unit: '' },
  legal:    { label: 'Legal Exposure', min: 0, max: 100,        higherIsBetter: false, unit: '' },
};

export const DEFAULT_METERS = { cost: 0, downtime: 0, dataLoss: 0, trust: 70, legal: 10 };

export const CSF_FUNCTIONS = {
  GV: { name: 'Govern',   blurb: 'Set strategy, roles, policy and oversight for cybersecurity risk, including who decides what during an incident.' },
  ID: { name: 'Identify', blurb: 'Understand assets, risks and what is actually affected, so decisions rest on facts rather than guesses.' },
  PR: { name: 'Protect',  blurb: 'Safeguards such as MFA, segmentation and backups that limit how far an attack can go.' },
  DE: { name: 'Detect',   blurb: 'Find and analyze signs of compromise: logs, alerts and forensic evidence.' },
  RS: { name: 'Respond',  blurb: 'Contain the incident, coordinate, communicate and report while it is under way.' },
  RC: { name: 'Recover',  blurb: 'Restore systems and services, verify they are clean, and communicate the return to normal.' },
};

export const LEGACY_PHASES = [
  'Preparation',
  'Detection & Analysis',
  'Containment, Eradication & Recovery',
  'Post-Incident Activity',
];

/** Minutes after midnight at Hour 0, from scenario.startTime ("HH:MM", default 07:42). */
export function startMinutes(scenario) {
  const [h, m] = String(scenario.startTime || '07:42').split(':').map(Number);
  return h * 60 + m;
}

/** The in-game clock stops at the end of Day 14. */
export function maxClock(scenario) {
  return 14 * 24 - startMinutes(scenario) / 60;
}

/** Format a clock value (hours since Hour 0) as "Day 1 · 09:15". */
export function formatClock(scenario, clock) {
  const total = Math.round(startMinutes(scenario) + clock * 60);
  const day = Math.floor(total / 1440) + 1;
  const mins = total % 1440;
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return `Day ${day} · ${hh}:${mm}`;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Apply meter deltas with clamping. Returns new meters and the deltas actually applied. */
export function applyEffects(meters, effects = {}) {
  const next = { ...meters };
  const applied = {};
  for (const key of METERS) {
    const d = effects[key];
    if (typeof d !== 'number' || d === 0) continue;
    const { min, max } = METER_INFO[key];
    const before = next[key];
    next[key] = clamp(before + d, min, max);
    const real = next[key] - before;
    if (real !== 0) applied[key] = real;
  }
  return { meters: next, deltas: applied };
}

function mergeDeltas(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] || 0) + v;
  return out;
}

function withFlags(state, flags = {}) {
  const keys = Object.keys(flags);
  if (!keys.length) return state;
  const flagTimes = { ...state.flagTimes };
  for (const k of keys) if (state.flags[k] !== flags[k]) flagTimes[k] = state.clock;
  return { ...state, flags: { ...state.flags, ...flags }, flagTimes };
}

function advanceClock(scenario, state, hours = 0) {
  if (!hours) return state;
  return { ...state, clock: Math.min(maxClock(scenario), state.clock + hours) };
}

/** Fire every due inject (repeatedly, since one inject's flags can trigger another). */
function fireInjects(scenario, state) {
  let s = state;
  const messages = [];
  for (let guard = 0; guard < 50; guard++) {
    const due = dueInjects(scenario, s);
    if (!due.length) break;
    for (const inj of due) {
      const { meters, deltas } = applyEffects(s.meters, inj.effects);
      s = { ...s, meters, firedInjects: [...s.firedInjects, inj.id] };
      s = withFlags(s, inj.setFlags);
      s = {
        ...s,
        history: [...s.history, {
          type: 'inject', injectId: inj.id, nodeId: s.nodeId, clock: s.clock,
          deltas, flagsSet: { ...(inj.setFlags || {}) },
        }],
      };
      if (inj.message) messages.push({ ...inj.message, inject: inj.id });
    }
  }
  return { state: s, messages };
}

/** Move to a node: advance the clock, apply node entry effects, then fire injects. */
function enterNode(scenario, state, nodeId, extraHours = 0) {
  const node = scenario.nodes[nodeId];
  if (!node) throw new Error(`Unknown node "${nodeId}"`);
  let s = { ...state, nodeId };
  s = advanceClock(scenario, s, (node.clockAdvance || 0) + extraHours);
  if (node.effects || node.setFlags) {
    const { meters, deltas } = applyEffects(s.meters, node.effects);
    s = { ...s, meters };
    s = withFlags(s, node.setFlags);
    if (Object.keys(deltas).length) {
      s = { ...s, history: [...s.history, { type: 'node', nodeId, clock: s.clock, deltas, flagsSet: { ...(node.setFlags || {}) } }] };
    }
  }
  const fired = fireInjects(scenario, s);
  s = fired.state;
  return { ...s, injectMessages: fired.messages, ended: !!node.ending };
}

/** Initial state for a scenario, positioned at its start node. */
export function createState(scenario) {
  const hidden = Object.fromEntries(
    Object.entries(scenario.hiddenFacts || {}).map(([k, v]) => [k, typeof v === 'object' ? v.value : v])
  );
  const base = {
    scenarioId: scenario.id,
    nodeId: scenario.start,
    clock: 0,
    meters: applyEffects({ ...DEFAULT_METERS }, {}).meters,
    flags: { ...hidden, ...(scenario.initialFlags || {}) },
    flagTimes: {},
    history: [],
    firedInjects: [],
    injectMessages: [],
    ended: false,
  };
  // Starting meters are absolute values, clamped to range.
  for (const key of METERS) {
    if (typeof scenario.startingMeters?.[key] === 'number') {
      const { min, max } = METER_INFO[key];
      base.meters[key] = clamp(scenario.startingMeters[key], min, max);
    }
  }
  return enterNode(scenario, base, scenario.start);
}

/** Take a choice on the current node. Returns a new state; the input is not modified. */
export function choose(scenario, state, choiceId) {
  if (state.ended) throw new Error('The scenario has already ended');
  const available = availableChoices(scenario, state);
  const choice = available.find((c) => c.id === choiceId);
  if (!choice) throw new Error(`Choice "${choiceId}" is not available on node "${state.nodeId}"`);

  const decidedAt = state.clock;
  const { meters, deltas } = applyEffects(state.meters, choice.effects);
  let s = { ...state, meters };
  s = withFlags(s, choice.setFlags);
  const nextId = resolveNext(choice.next, s);
  s = {
    ...s,
    history: [...s.history, {
      type: 'choice', nodeId: state.nodeId, choiceId, clock: decidedAt,
      deltas, flagsSet: { ...(choice.setFlags || {}) },
      available: available.map((c) => c.id), next: nextId,
    }],
  };
  return enterNode(scenario, s, nextId, choice.clockAdvance || 0);
}

/** Debug only: move to any node without taking a choice. */
export function jumpTo(scenario, state, nodeId) {
  return enterNode(scenario, { ...state, ended: false }, nodeId);
}

/** Total deltas recorded in a history slice (useful for "what changed since"). */
export function sumDeltas(entries) {
  return entries.reduce((acc, e) => mergeDeltas(acc, e.deltas || {}), {});
}

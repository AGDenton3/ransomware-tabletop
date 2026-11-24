// Final results: meters, letter grade (with visible weights), CSF counts and missed opportunities.
// Pure functions. No DOM access.

import { METERS, CSF_FUNCTIONS } from './state.js';

/** Weights (sum to 100) shown to the player on the debrief. */
export const WEIGHTS = { cost: 20, downtime: 25, dataLoss: 20, trust: 15, legal: 20 };

export const GRADE_BANDS = [
  { grade: 'A', min: 82 },
  { grade: 'B', min: 70 },
  { grade: 'C', min: 58 },
  { grade: 'D', min: 46 },
  { grade: 'F', min: 0 },
];

/** Each scenario can set the cost and downtime that count as "worst case" (score 0). */
export function scales(scenario) {
  return {
    costBad: scenario.scoring?.costBad ?? 1_000_000,
    downtimeBad: scenario.scoring?.downtimeBad ?? 336,
  };
}

/** Convert each meter to a 0–100 "how well did this go" subscore. */
export function subscores(meters, scenario) {
  const { costBad, downtimeBad } = scales(scenario);
  const inv = (v, bad) => Math.max(0, 100 * (1 - Math.min(1, v / bad)));
  return {
    cost: inv(meters.cost, costBad),
    downtime: inv(meters.downtime, downtimeBad),
    dataLoss: 100 - meters.dataLoss,
    trust: meters.trust,
    legal: 100 - meters.legal,
  };
}

export function totalScore(meters, scenario) {
  const sub = subscores(meters, scenario);
  return METERS.reduce((sum, k) => sum + (sub[k] * WEIGHTS[k]) / 100, 0);
}

export function letterGrade(total) {
  return GRADE_BANDS.find((b) => total >= b.min).grade;
}

function findChoice(scenario, nodeId, choiceId) {
  return scenario.nodes[nodeId]?.choices?.find((c) => c.id === choiceId);
}

/** Count of decisions per CSF Function. */
export function csfCounts(scenario, history) {
  const counts = Object.fromEntries(Object.keys(CSF_FUNCTIONS).map((k) => [k, 0]));
  for (const e of history) {
    if (e.type !== 'choice') continue;
    const c = findChoice(scenario, e.nodeId, e.choiceId);
    if (c && c.csf in counts) counts[c.csf]++;
  }
  return counts;
}

const groupOf = (nodeId, c) => c.keyGroup || `${nodeId}:${c.id}`;

/**
 * keyDecision choices that were available but not taken. A choice offered on
 * several nodes can share a `keyGroup`; it only counts as missed if no choice
 * in that group was ever taken. Reported once per group, at the first time it was offered.
 */
export function missedOpportunities(scenario, history) {
  const taken = new Set();
  for (const e of history) {
    if (e.type !== 'choice') continue;
    const c = findChoice(scenario, e.nodeId, e.choiceId);
    if (c) taken.add(groupOf(e.nodeId, c));
  }
  const missed = [];
  const seen = new Set();
  for (const e of history) {
    if (e.type !== 'choice') continue;
    for (const id of e.available || []) {
      if (id === e.choiceId) continue;
      const c = findChoice(scenario, e.nodeId, id);
      if (!c || !c.keyDecision) continue;
      const g = groupOf(e.nodeId, c);
      if (taken.has(g) || seen.has(g)) continue;
      seen.add(g);
      missed.push({ nodeId: e.nodeId, choiceId: id, clock: e.clock, choice: c });
    }
  }
  return missed;
}

/** Everything the debrief needs about a finished (or in-progress) run. */
export function computeResults(scenario, state) {
  const total = totalScore(state.meters, scenario);
  const node = scenario.nodes[state.nodeId];
  return {
    meters: { ...state.meters },
    subscores: subscores(state.meters, scenario),
    weights: { ...WEIGHTS },
    total: Math.round(total * 10) / 10,
    grade: letterGrade(total),
    csfCounts: csfCounts(scenario, state.history),
    missed: missedOpportunities(scenario, state.history),
    decisions: state.history.filter((e) => e.type === 'choice').length,
    ending: node?.ending ? { id: state.nodeId, outcome: node.outcome, summary: node.summary } : null,
  };
}

// Condition evaluation: requires, conditional next, and injects.
// Pure functions. No DOM access.

/**
 * A condition is an object whose keys are flag names and whose values are the
 * required flag values. A flag that was never set counts as `false`.
 * Special keys:
 *   "$clockGte": n  — the clock (hours since Hour 0) is at least n
 *   "$clockLt":  n  — the clock is below n
 * An empty or missing condition always matches.
 */
export function matches(cond, state) {
  if (!cond) return true;
  for (const [key, want] of Object.entries(cond)) {
    if (key === '$clockGte') { if (!(state.clock >= want)) return false; continue; }
    if (key === '$clockLt') { if (!(state.clock < want)) return false; continue; }
    const have = state.flags[key] ?? false;
    if (have !== want) return false;
  }
  return true;
}

/** Choices on the current node whose `requires` condition is met. */
export function availableChoices(scenario, state) {
  const node = scenario.nodes[state.nodeId];
  if (!node || !node.choices) return [];
  return node.choices.filter((c) => matches(c.requires, state));
}

/**
 * Resolve a `next` field: either a node id string, or an ordered list of
 * branches [{ if: {...}, next: "id" }, ..., { else: "id" }].
 */
export function resolveNext(next, state) {
  if (typeof next === 'string') return next;
  if (Array.isArray(next)) {
    for (const branch of next) {
      if ('else' in branch) return branch.else;
      if (matches(branch.if, state)) return branch.next;
    }
  }
  throw new Error('Could not resolve next: no branch matched and no else branch');
}

/** Every node id a `next` field could lead to (for validation and path walking). */
export function nextTargets(next) {
  if (typeof next === 'string') return [next];
  if (Array.isArray(next)) return next.map((b) => ('else' in b ? b.else : b.next));
  return [];
}

/** Injects that have not fired yet and whose clock threshold and condition are met. */
export function dueInjects(scenario, state) {
  return (scenario.injects || []).filter(
    (inj) =>
      !state.firedInjects.includes(inj.id) &&
      state.clock >= (inj.atHour ?? 0) &&
      matches(inj.if, state)
  );
}

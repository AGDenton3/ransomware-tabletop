// Save/resume and completed runs in localStorage. Every access is wrapped in
// try/catch because storage can be disabled, full, or blocked (private mode).
// The storage object is injectable so the module stays testable without a DOM.

const PREFIX = 'rt:';
const MAX_RUNS = 20;

function store(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function read(key, storage) {
  try {
    const raw = store(storage)?.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function write(key, value, storage) {
  try { store(storage)?.setItem(PREFIX + key, JSON.stringify(value)); return true; }
  catch { return false; }
}

function remove(key, storage) {
  try { store(storage)?.removeItem(PREFIX + key); } catch { /* ignore */ }
}

export function saveProgress(state, storage) {
  return write(`save:${state.scenarioId}`, { savedAt: Date.now(), state }, storage);
}

export function loadProgress(scenarioId, storage) {
  const saved = read(`save:${scenarioId}`, storage);
  return saved && saved.state && !saved.state.ended ? saved : null;
}

export function clearProgress(scenarioId, storage) {
  remove(`save:${scenarioId}`, storage);
}

/** Record a finished run. Returns its id. */
export function recordRun(state, results, storage) {
  const id = `${state.scenarioId}-${Date.now()}`;
  const run = { id, finishedAt: Date.now(), scenarioId: state.scenarioId, state, grade: results?.grade, total: results?.total };
  const runs = (read('runs', storage) || []).filter(Boolean);
  runs.unshift(run);
  write('runs', runs.slice(0, MAX_RUNS), storage);
  write('lastRun', id, storage);
  clearProgress(state.scenarioId, storage);
  return id;
}

export function listRuns(storage) {
  return read('runs', storage) || [];
}

export function getRun(id, storage) {
  const runs = listRuns(storage);
  const wanted = id || read('lastRun', storage);
  return runs.find((r) => r.id === wanted) || null;
}

export function getPref(key, storage) { return read(`pref:${key}`, storage); }
export function setPref(key, value, storage) { return write(`pref:${key}`, value, storage); }

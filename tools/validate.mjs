#!/usr/bin/env node
// Validate every scenario in data/scenarios/ against the format in data/schema.md.
// Usage: node tools/validate.mjs [path/to/scenario.json ...]
// No dependencies. Exits 1 if any errors are found.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { nextTargets } from '../js/engine/resolve.js';
import { METERS, METER_INFO, CSF_FUNCTIONS, LEGACY_PHASES } from '../js/engine/state.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANNELS = ['email', 'phone', 'text', 'news', 'portal'];
const MAX_DELTA = { cost: 5_000_000, downtime: 720, dataLoss: 60, trust: 50, legal: 50 };
const MAX_CHOICES = 4; // number keys 1–4 and A–D in presentation mode
// Real ransomware groups that must never appear as the in-game attacker.
const REAL_GANGS = ['LockBit', 'BlackCat', 'ALPHV', 'Conti', 'REvil', 'Sodinokibi', 'Ryuk', 'DarkSide', 'Cl0p', 'Clop', 'Akira', 'Black Basta', 'BlackBasta', 'Rhysida', 'RansomHub', 'Scattered Spider', 'BianLian', 'Qilin', 'Babuk', 'Vice Society', 'NetWalker', 'Egregor', 'DoppelPaymer', 'WannaCry', 'NotPetya', 'Ragnar Locker', 'BlackSuit', 'Avaddon'];

export function validateScenario(scn, refs, file = 'scenario') {
  const errors = [];
  const warnings = [];
  const err = (where, msg) => errors.push(`${file} › ${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${file} › ${where}: ${msg}`);
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const str = (v) => typeof v === 'string' && v.trim().length > 0;

  // ---- top level ----
  for (const f of ['id', 'title', 'orgType', 'difficulty', 'start']) if (!str(scn[f])) err('scenario', `missing or empty "${f}"`);
  if (typeof scn.estMinutes !== 'number') err('scenario', '"estMinutes" must be a number');
  if (!isObj(scn.nodes)) { err('scenario', '"nodes" must be an object of nodeId → node'); return { errors, warnings }; }

  const op = scn.orgProfile;
  if (!isObj(op)) err('orgProfile', 'missing');
  else {
    for (const f of ['name', 'size', 'description', 'backups', 'insurance']) if (!str(op[f])) err('orgProfile', `missing "${f}"`);
    for (const f of ['criticalSystems', 'regulatedData']) if (!Array.isArray(op[f])) err('orgProfile', `"${f}" must be an array`);
  }
  const rn = scn.ransomNote;
  if (!isObj(rn)) err('ransomNote', 'missing');
  else for (const f of ['gang', 'demand', 'text']) if (!str(rn[f])) err('ransomNote', `missing "${f}"`);

  if (!isObj(scn.startingMeters)) err('startingMeters', 'missing');
  else for (const [k, v] of Object.entries(scn.startingMeters)) {
    if (!METERS.includes(k)) err('startingMeters', `unknown meter "${k}" (expected one of ${METERS.join(', ')})`);
    else if (typeof v !== 'number' || v < METER_INFO[k].min || v > METER_INFO[k].max) err('startingMeters', `"${k}" = ${v} is out of range`);
  }

  // ---- flags ----
  const knownFlags = new Set(Object.keys(scn.initialFlags || {}));
  for (const [k, v] of Object.entries(scn.hiddenFacts || {})) {
    knownFlags.add(k);
    if (isObj(v)) {
      if (!('value' in v)) err(`hiddenFacts.${k}`, 'object form needs a "value"');
      if (v.preparation) {
        if (!str(v.preparation.measure)) err(`hiddenFacts.${k}.preparation`, 'missing "measure"');
        if (!(v.preparation.csf in CSF_FUNCTIONS)) err(`hiddenFacts.${k}.preparation`, `invalid csf "${v.preparation.csf}"`);
      }
    }
  }
  const collectSet = (o) => Object.keys(o || {}).forEach((k) => knownFlags.add(k));
  for (const n of Object.values(scn.nodes)) {
    collectSet(n.setFlags);
    for (const c of n.choices || []) collectSet(c.setFlags);
  }
  for (const inj of scn.injects || []) collectSet(inj.setFlags);
  const checkCond = (where, cond) => {
    if (cond === undefined) return;
    if (!isObj(cond)) return err(where, 'condition must be an object of flag → value');
    for (const k of Object.keys(cond)) {
      if (k.startsWith('$')) { if (!['$clockGte', '$clockLt'].includes(k)) err(where, `unknown condition key "${k}"`); continue; }
      if (!knownFlags.has(k)) warn(where, `flag "${k}" is never set anywhere (it will always read as false)`);
    }
  };

  const checkEffects = (where, eff) => {
    if (eff === undefined) return;
    if (!isObj(eff)) return err(where, '"effects" must be an object');
    for (const [k, v] of Object.entries(eff)) {
      if (!METERS.includes(k)) err(where, `unknown meter "${k}" in effects`);
      else if (typeof v !== 'number' || Number.isNaN(v)) err(where, `effect "${k}" must be a number`);
      else if (Math.abs(v) > MAX_DELTA[k]) err(where, `effect ${k} ${v} is not sane (limit ±${MAX_DELTA[k]})`);
    }
  };
  const checkMessage = (where, m) => {
    if (!isObj(m)) return err(where, 'message must be an object');
    if (!str(m.from)) err(where, 'message missing "from"');
    if (!CHANNELS.includes(m.channel)) err(where, `channel "${m.channel}" must be one of ${CHANNELS.join(', ')}`);
    if (!str(m.body)) err(where, 'message missing "body"');
  };

  // ---- nodes and choices ----
  const ids = Object.keys(scn.nodes);
  if (!scn.nodes[scn.start]) err('scenario', `start node "${scn.start}" does not exist`);
  const edges = {};
  const keyGroups = new Set();
  for (const [nid, n] of Object.entries(scn.nodes)) {
    const where = `node "${nid}"`;
    edges[nid] = [];
    if (!str(n.title)) err(where, 'missing "title"');
    if (!str(n.narrative)) err(where, 'missing "narrative"');
    if (n.clockAdvance !== undefined && (typeof n.clockAdvance !== 'number' || n.clockAdvance < 0 || n.clockAdvance > 336)) err(where, '"clockAdvance" must be 0–336 hours');
    (n.inbox || []).forEach((m, i) => checkMessage(`${where} inbox[${i}]`, m));
    checkEffects(where, n.effects);
    if (n.ending) {
      if (!str(n.outcome)) err(where, 'ending needs an "outcome" title');
      if (!str(n.summary)) err(where, 'ending needs a "summary"');
      if (n.choices?.length) err(where, 'ending nodes must not have choices');
      continue;
    }
    if (!Array.isArray(n.choices) || n.choices.length === 0) { err(where, 'non-ending node has no choices (dead end)'); continue; }
    if (n.choices.length > MAX_CHOICES) err(where, `has ${n.choices.length} choices; the UI supports at most ${MAX_CHOICES}`);
    if (!n.choices.some((c) => !c.requires || Object.keys(c.requires).length === 0)) {
      // Fine if two single-flag requires are complementary (e.g. isolated: true / isolated: false).
      const single = n.choices.map((c) => Object.entries(c.requires || {})).filter((e) => e.length === 1).map((e) => e[0]);
      const covered = single.some(([k, v]) => v === true && single.some(([k2, v2]) => k2 === k && v2 === false));
      if (!covered) warn(where, 'every choice has "requires"; make sure at least one is always available');
    }
    const seen = new Set();
    for (const c of n.choices) {
      const cw = `${where} choice "${c.id}"`;
      if (!str(c.id)) err(where, 'choice missing "id"');
      if (seen.has(c.id)) err(cw, 'duplicate choice id in this node');
      seen.add(c.id);
      if (!str(c.label)) err(cw, 'missing "label"');
      if (!str(c.hint)) err(cw, 'missing "hint"');
      if (!(c.csf in CSF_FUNCTIONS)) err(cw, `csf "${c.csf}" must be one of ${Object.keys(CSF_FUNCTIONS).join(', ')}`);
      if (!LEGACY_PHASES.includes(c.legacyPhase)) err(cw, `legacyPhase "${c.legacyPhase}" must be one of: ${LEGACY_PHASES.join(' | ')}`);
      checkEffects(cw, c.effects);
      checkCond(`${cw} requires`, c.requires);
      if (c.keyDecision !== undefined && typeof c.keyDecision !== 'boolean') err(cw, '"keyDecision" must be true or false');
      if (c.keyDecision) keyGroups.add(c.keyGroup || `${nid}:${c.id}`);
      if (!isObj(c.debrief)) err(cw, 'missing "debrief"');
      else {
        if (!str(c.debrief.whyItMatters)) err(cw, 'debrief missing "whyItMatters"');
        if (!str(c.debrief.betterPractice)) err(cw, 'debrief missing "betterPractice"');
        const rids = c.debrief.referenceIds;
        if (!Array.isArray(rids) || rids.length === 0) err(cw, 'debrief needs at least one referenceId');
        else for (const r of rids) if (!refs[r]) err(cw, `referenceId "${r}" is not in data/references.json`);
      }
      // next
      if (typeof c.next === 'string') edges[nid].push(c.next);
      else if (Array.isArray(c.next)) {
        if (!c.next.length || !('else' in c.next[c.next.length - 1])) err(cw, 'conditional "next" must end with an { "else": nodeId } branch');
        c.next.forEach((b, i) => { if (!('else' in b)) { checkCond(`${cw} next[${i}].if`, b.if); if (!str(b.next)) err(cw, `next[${i}] missing "next"`); } });
        edges[nid].push(...nextTargets(c.next));
      } else err(cw, '"next" must be a node id or a list of conditional branches');
      for (const t of nextTargets(c.next)) if (t && !scn.nodes[t]) err(cw, `next target "${t}" does not exist`);
    }
  }

  // ---- injects ----
  const injIds = new Set();
  for (const inj of scn.injects || []) {
    const where = `inject "${inj.id}"`;
    if (!str(inj.id)) err('injects', 'inject missing "id"');
    if (injIds.has(inj.id)) err(where, 'duplicate inject id');
    injIds.add(inj.id);
    if (inj.atHour !== undefined && typeof inj.atHour !== 'number') err(where, '"atHour" must be a number');
    if (inj.atHour === undefined && !inj.if) err(where, 'needs "atHour", "if", or both');
    checkCond(`${where} if`, inj.if);
    checkEffects(where, inj.effects);
    if (inj.message) checkMessage(`${where} message`, inj.message);
    else err(where, 'missing "message" (the player must see what happened)');
  }

  // ---- board ----
  for (const [i, item] of (scn.board?.items || []).entries()) {
    if (!str(item.label)) err(`board.items[${i}]`, 'missing "label"');
    (item.states || []).forEach((s, j) => checkCond(`board.items[${i}].states[${j}]`, s.if));
  }
  for (const [i, n] of (scn.board?.notifications || []).entries()) {
    if (!str(n.flag) || !str(n.label)) err(`board.notifications[${i}]`, 'needs "flag" and "label"');
    else if (!knownFlags.has(n.flag)) warn(`board.notifications[${i}]`, `flag "${n.flag}" is never set`);
  }

  // ---- graph: reachability, cycles, every path ends ----
  if (scn.nodes[scn.start]) {
    const reach = new Set([scn.start]);
    const stack = [scn.start];
    while (stack.length) for (const t of edges[stack.pop()] || []) if (scn.nodes[t] && !reach.has(t)) { reach.add(t); stack.push(t); }
    for (const id of ids) if (!reach.has(id)) err(`node "${id}"`, 'unreachable from the start node');

    // cycle detection (DFS colouring)
    const color = {};
    const visit = (id, path) => {
      color[id] = 1;
      for (const t of edges[id] || []) {
        if (!scn.nodes[t]) continue;
        if (color[t] === 1) { err(`node "${id}"`, `cycle detected: ${[...path, id, t].join(' → ')}`); continue; }
        if (!color[t]) visit(t, [...path, id]);
      }
      color[id] = 2;
    };
    visit(scn.start, []);

    // every reachable node can reach an ending
    const canEnd = new Set(ids.filter((id) => scn.nodes[id].ending));
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of ids) if (!canEnd.has(id) && (edges[id] || []).some((t) => canEnd.has(t))) { canEnd.add(id); changed = true; }
    }
    for (const id of reach) if (!canEnd.has(id)) err(`node "${id}"`, 'no path from here reaches an ending');
    // every branch target must also end (already covered by node check) — also flag a choice whose every target is a dead end
  }

  // ---- fiction check: real gang names ----
  const fictional = JSON.stringify({ ransomNote: scn.ransomNote, nodes: Object.fromEntries(Object.entries(scn.nodes).map(([k, n]) => [k, { ...n, choices: (n.choices || []).map(({ debrief, ...rest }) => rest) }])), injects: scn.injects });
  for (const g of REAL_GANGS) if (new RegExp(`\\b${g}\\b`, 'i').test(fictional)) err('fiction', `mentions the real ransomware group "${g}" outside debrief notes`);

  const endings = ids.filter((id) => scn.nodes[id].ending).length;
  const decisions = ids.length - endings;
  const verify = (JSON.stringify(scn).match(/\[VERIFY/g) || []).length;
  return { errors, warnings, stats: { nodes: ids.length, decisions, endings, keyDecisions: keyGroups.size, injects: (scn.injects || []).length, verify } };
}

export function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function validateAll(files) {
  const refsPath = join(ROOT, 'data', 'references.json');
  let refs = {};
  const errors = [];
  const warnings = [];
  const report = [];
  try { refs = loadJSON(refsPath); } catch (e) { errors.push(`data/references.json: ${e.message}`); }
  for (const [id, r] of Object.entries(refs)) {
    for (const f of ['title', 'publisher', 'year', 'url']) if (!r[f]) errors.push(`data/references.json › "${id}": missing "${f}"`);
    if (r.url && !/^https:\/\//.test(r.url)) errors.push(`data/references.json › "${id}": url must be https`);
  }

  const dir = join(ROOT, 'data', 'scenarios');
  const list = files?.length ? files : readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => join(dir, f));
  const byId = {};
  for (const path of list) {
    const name = basename(path);
    let scn;
    try { scn = loadJSON(path); } catch (e) { errors.push(`${name}: invalid JSON (${e.message})`); continue; }
    const res = validateScenario(scn, refs, name);
    if (!name.startsWith('_') && scn.id !== name.replace(/\.json$/, '')) res.errors.push(`${name} › scenario: id "${scn.id}" must match the file name`);
    errors.push(...res.errors);
    warnings.push(...res.warnings);
    byId[scn.id] = scn;
    report.push({ name, ...res.stats, errors: res.errors.length });
  }

  // index.json lists the playable scenarios for the picker
  const indexPath = join(dir, 'index.json');
  if (!files?.length) {
    if (!existsSync(indexPath)) errors.push('data/scenarios/index.json is missing');
    else {
      try {
        const idx = loadJSON(indexPath);
        if (!Array.isArray(idx.scenarios)) errors.push('index.json › "scenarios" must be an array');
        for (const e of idx.scenarios || []) {
          if (!existsSync(join(dir, e.file || ''))) errors.push(`index.json › "${e.id}": file "${e.file}" not found`);
          else if (byId[e.id] === undefined) errors.push(`index.json › "${e.id}": no scenario with that id`);
          for (const f of ['id', 'title', 'file', 'blurb']) if (!e[f]) errors.push(`index.json › entry ${e.id || '?'}: missing "${f}"`);
        }
      } catch (e) { errors.push(`index.json: invalid JSON (${e.message})`); }
    }
  }
  return { errors, warnings, report };
}

// ---- CLI ----
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { errors, warnings, report } = validateAll(process.argv.slice(2));
  for (const r of report) {
    console.log(`${r.errors ? '✗' : '✓'} ${r.name}: ${r.nodes} nodes (${r.decisions} decision, ${r.endings} endings), ${r.keyDecisions} key decisions, ${r.injects} injects${r.verify ? `, ${r.verify} [VERIFY] markers` : ''}`);
  }
  for (const w of warnings) console.log(`  warning: ${w}`);
  for (const e of errors) console.log(`  error:   ${e}`);
  console.log(errors.length ? `\n${errors.length} error(s). Fix them and run again.` : `\nAll scenarios valid.${warnings.length ? ` ${warnings.length} warning(s).` : ''}`);
  process.exit(errors.length ? 1 : 0);
}

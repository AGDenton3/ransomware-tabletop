// learn.html: pre-incident checklist and the full reference list.
import { initTheme, loadReferences, esc, csfBadge } from './common.js';
import { getPref, setPref } from '../engine/save.js';

initTheme();

const CHECKLIST = [
  { id: 'backups', csf: 'PR', text: 'At least one offline or immutable backup, with restores tested on a schedule.', refs: ['cisa-stopransomware-guide', 'cisa-cpg'] },
  { id: 'mfa', csf: 'PR', text: 'MFA on every remote-access, email and administrator account.', refs: ['cisa-cpg', 'cisa-stopransomware-guide'] },
  { id: 'patch', csf: 'ID', text: 'Internet-facing systems (VPNs, firewalls, remote access) inventoried and patched first. Water utilities can enroll in CISA’s free vulnerability scanning.', refs: ['cisa-water-vuln-scanning', 'cisa-cpg'] },
  { id: 'inventory', csf: 'ID', text: 'An asset and backup inventory: what you run, where data lives, where every backup copy is.', refs: ['cisa-cpg'] },
  { id: 'plan', csf: 'GV', text: 'A written incident-response plan with a call tree: leadership, counsel, insurer hotline, FBI field office or IC3, CISA, and state reporting contacts.', refs: ['nist-sp800-61r3', 'epa-cyberwater'] },
  { id: 'authority', csf: 'GV', text: 'Decision authority settled in advance: who can take systems offline, approve emergency spending, and decide on payment.', refs: ['nist-csf2', 'nist-sp800-61r3'] },
  { id: 'duties', csf: 'GV', text: 'Notification duties and deadlines listed for your sector and state (for example HIPAA, Texas breach notice, Texas DIR reporting for local governments).', refs: ['hhs-breach-notification-rule', 'tx-bcc-521-053', 'tx-gov-2054-603'] },
  { id: 'segment', csf: 'PR', text: 'IT and OT networks segmented, with manual operation documented and drilled.', refs: ['cisa-aa21-131a', 'cisa-ot-primary-mitigations'] },
  { id: 'monitor', csf: 'DE', text: 'Logging kept long enough to investigate, with alerts on unusual logins and large outbound transfers.', refs: ['cisa-stopransomware-guide'] },
  { id: 'comms', csf: 'RS', text: 'Holding statements and a hotline plan drafted for patients, customers or residents.', refs: ['nist-sp800-61r3', 'wws-ir-guide'] },
  { id: 'exercise', csf: 'ID', text: 'A tabletop exercise, like this one, at least once a year, with lessons tracked to completion.', refs: ['nist-sp800-61r3', 'cisa-stopransomware-guide'] },
];

async function boot() {
  const listEl = document.getElementById('ref-list');
  let refs = {};
  try {
    refs = await loadReferences();
  } catch (e) {
    listEl.innerHTML = `<li>Could not load references: ${esc(e.message)}</li>`;
  }
  renderChecklist(refs);
  listEl.innerHTML = Object.entries(refs)
    .sort(([, a], [, b]) => a.publisher.localeCompare(b.publisher) || b.year - a.year)
    .map(([id, r]) => `
      <li id="ref-${esc(id)}" tabindex="-1">
        ${esc(r.publisher)} (${esc(r.year)}). <a href="${esc(r.url)}" rel="noopener"><cite>${esc(r.title)}</cite></a>.
        ${r.note ? `<span class="ref-note">${esc(r.note)}</span>` : ''}
      </li>`).join('');
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
}

function renderChecklist(refs) {
  const saved = getPref('checklist') || {};
  const el = document.getElementById('checklist-list');
  el.innerHTML = CHECKLIST.map((item) => `
    <li>
      <input type="checkbox" id="chk-${item.id}" data-id="${item.id}"${saved[item.id] ? ' checked' : ''}>
      <label for="chk-${item.id}">${csfBadge(item.csf)} ${esc(item.text)}
        <span class="refs-inline muted">[${item.refs.filter((r) => refs[r]).map((r) => `<a href="#ref-${r}">${esc(refs[r].publisher.split(/[,(]/)[0].trim())}</a>`).join('; ')}]</span>
      </label>
    </li>`).join('');
  el.addEventListener('change', (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    const next = { ...(getPref('checklist') || {}), [id]: e.target.checked };
    setPref('checklist', next);
  });
}

boot();

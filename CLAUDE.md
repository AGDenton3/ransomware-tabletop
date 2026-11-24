# CLAUDE.md: Ransomware Tabletop

## Project
"Ransomware Tabletop", a CSCE 477 (Texas A&M Cybersecurity) project by Amy Denton. A browser-based, choose-your-path incident-response tabletop exercise. The player is the IT lead at a fictional small organization on the morning a ransom note appears. Each decision moves five meters (Cost $, Downtime hours, Data Loss %, Public Trust 0-100, Legal Exposure 0-100) and an in-game clock (Hour 0 to Day 14). A debrief maps every decision to the NIST incident-response framework.

## Learning goals
- Containment speed vs. business continuity
- Why tested offline/immutable backups decide outcomes
- The legal and ethical issues of paying a ransom
- Notification duties (leadership, insurer, law enforcement, regulators, public)
- Double extortion (encryption plus data theft)
- The NIST framework

## Hard constraints
- Static site on GitHub Pages from the repo root of `main`. No backend, no build step, no frameworks: plain HTML, CSS and vanilla JS ES modules. Relative URLs only, so it works under `/ransomware-tabletop/`.
- Fully client-side. No analytics, no external requests, no CDNs.
- All organizations, people, ransomware gangs, domains and phone numbers are FICTIONAL. Never name a real ransomware group as the attacker. Real incidents appear only in debrief "real-world parallel" notes, with a citation.
- Evidence discipline: every real-world fact (law, regulation, guidance, statistic) cites a primary source in `data/references.json`. Never invent figures or legal requirements; mark anything unverified as `[VERIFY: ...]`. Show a disclaimer: educational simulation, not legal advice, in-game costs are illustrative.
- Game content is DATA: scenarios live in `data/scenarios/*.json` and must pass `tools/validate.mjs`. No scenario-specific logic in the engine.
- Accessible: semantic HTML, fully keyboard-playable, visible focus, WCAG AA contrast, `aria-live` for meter changes, `prefers-reduced-motion` respected, mobile-friendly.

## Framework
Tag every decision with a NIST CSF 2.0 Function (GV Govern, ID Identify, PR Protect, DE Detect, RS Respond, RC Recover), per NIST SP 800-61 Rev. 3 (April 2025, https://csrc.nist.gov/pubs/sp/800/61/r3/final), which superseded Rev. 2 (2012). Also give each decision the legacy Rev. 2 phase as a secondary label (Preparation; Detection & Analysis; Containment, Eradication & Recovery; Post-Incident Activity).

## Design
Restrained and academic, like the AGGIES Lab BLOCKMINE site: deep maroon accent on warm off-white, graphite for threat elements, a serif display font with italic emphasis, cards, numbered steps. In-game it feels like an incident war room: a clock, a meters dashboard, and "incoming message" cards (CEO email, reporter call, attacker portal mock-up). Serious, not cartoonish, not "hacker green".

## Layout
Pages: `index.html` (landing + scenario picker), `play.html`, `debrief.html`, `learn.html`.
Folders: `data/`, `js/engine/`, `js/ui/`, `css/`, `assets/`, `tools/`, `tests/`.

## Commands
- Validate scenarios: `node tools/validate.mjs`
- Tests: `node --test tests/`
- Walk all paths: `node tools/walk-all-paths.mjs`
- Local preview: `python3 -m http.server` then open http://localhost:8000

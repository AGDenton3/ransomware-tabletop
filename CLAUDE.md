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
CONCEPT: "Late-night Northgate chicken joint meets incident war room." A hand-painted local College Station restaurant (sign-painter lettering, wall murals, a menu board behind the counter, order tickets, sauce-cup yellow, fryer-paper checks) with a light 1960s space-age (atomic/Googie) accent: starbursts, orbit rings, boomerangs. Never use any real restaurant's name, logo, mascot or wording.

PALETTE (the only colors allowed; CSS custom properties in css/styles.css):
- --maroon #5C0A14 primary ink, headers, borders
- --sauce #E8A33D mustard-gold accent
- --fry #F6D365 crinkle-fry yellow, highlights only
- --paper #F4EBD9 fryer-paper cream background
- --ketchup #C8361C danger, alerts, meter increases that hurt
- --pickle #4F6B3A good outcomes, recovery
- --chalk #22201C menu-board near-black (game dashboard)
- --grease #D9C7A3 muted secondary surfaces, rules, dividers
Translucency only via color-mix() of these. No other hex values.

CONTRAST RULES (measured): chalk/paper 13.73, maroon/paper 11.75, chalk/grease 9.79, maroon/grease 8.38, sauce/chalk 7.54, fry/chalk 11.17, maroon/sauce 6.45, pickle/paper 5.07, ketchup/paper 4.43 (large text or non-text only), ketchup/chalk 3.10 (large or non-text only), pickle/chalk 2.71 (never), sauce/paper 1.82 (never).
- Body text: chalk or maroon on paper, or paper on chalk/maroon.
- Text on --fry or --sauce only if it is --chalk and at least 18px bold (or 24px).
- Ketchup never carries small text; use it for fills, borders, markers, and 24px+ type.
- Daytime (light) is the default for everyone. "After hours" (dark: chalk background, paper text, sauce accents, maroon menu board) applies only when chosen with the header toggle.

TYPE (self-hosted in assets/fonts with OFL licenses, loaded by @font-face; no CDNs):
- Shrikhand: display headlines
- Bungee: labels, nav, buttons, menu-board headers (all caps, letter-spaced)
- Atkinson Hyperlegible: body text
- DM Mono: numbers, meters, receipts; DSEG7 Classic: the game clock only
- Generic fallbacks (sans-serif, monospace, cursive) only; never Inter, Roboto, Arial, Helvetica, system-ui or a serif.

COMPONENTS
- Dashboard = menu board (chalk): meters as menu items with dot leaders; changes flash like a price being repainted (stepped wipe), not a glow.
- Clock = scoreboard (DSEG7 digits in fry on chalk).
- Inbox = order tickets on receipt paper: perforated top edge, monospace header, some rotated 1–2 degrees.
- Choices = printed stickers: 3px maroon border, flat fill, hard 4px 4px 0 shadow that collapses when pressed.
- CSF badges = round bottle-cap stickers with the two-letter code (24px so every cap color passes AA-large).
- Debrief timeline = one itemized receipt "ORDER #477" with a dashed tear line, totals and grade at the bottom, footer "THANK YOU, COME AGAIN… PREPARED".
- Ransom splash = taped paper notice with a ketchup "SIMULATION" rubber stamp.
- Hero = hand-painted wall sign: Shrikhand with a hard maroon-on-sauce offset, a starburst behind the key word, inline-SVG noise for plaster texture.
- Background = paper with faint halftone dots. Icons = hand-drawn inline SVGs written in-house (thick, slightly uneven strokes). No icon libraries, no emoji.
- Focus = thick sauce outline with a chalk ring. Reduced motion turns off rotations and repaint animations.

AVOID: purple/blue gradients, gradient text, neon hacker looks, glassmorphism/backdrop blur, soft blurred shadows, glowing borders, identical rounded cards in a 3-column grid, centered hero with a tagline pill, pill badges, slate/gray palettes, emoji icons, sparkles, generic icon sets, perfect symmetry everywhere (let tickets rotate and stickers overlap), and stock copy ("Seamless", "Empower", "Unlock", "Dive in"). Write UI copy in a plain, local, slightly wry voice ("Pick your shift", "Read the ticket").

## Layout
Pages: `index.html` (landing + scenario picker), `play.html`, `debrief.html`, `learn.html`.
Folders: `data/`, `js/engine/`, `js/ui/`, `css/`, `assets/`, `tools/`, `tests/`.

## Commands
- Validate scenarios: `node tools/validate.mjs`
- Tests: `node --test tests/`
- Walk all paths: `node tools/walk-all-paths.mjs`
- Local preview: `python3 -m http.server` then open http://localhost:8000

# Ransomware Tabletop

A browser-based, choose-your-path **ransomware incident-response tabletop exercise**. You are the IT lead at a small organization on the morning a ransom note appears. Every decision moves five meters (Cost, Downtime, Data Loss, Public Trust, Legal Exposure) and an in-game clock, and the debrief maps each decision to the NIST incident-response framework (SP 800-61 Rev. 3 / CSF 2.0, with the legacy Rev. 2 phases as secondary labels).

CSCE 477 (Cybersecurity), Texas A&M University · Amy Denton · Dr. Kumar

**Live site:** https://agdenton3.github.io/ransomware-tabletop/

## Scenarios

| Scenario | What makes it different |
|---|---|
| **Brazos Valley Family Clinic**: 40-person outpatient clinic | Patient health data, double extortion, HIPAA and Texas notification duties, a backup hidden in plain sight |
| **City of Millbrook Water & Wastewater**: utility serving 30,000 residents | IT/OT segmentation and manual plant operation, council approval for any payment, public-safety communications, a slow tape restore |

## How to play

1. Pick a scenario on the home page.
2. Read the inbox (emails, calls, texts, news and the attacker's portal) as the clock advances.
3. Choose with the mouse or keys **1–4**. Watch the meters and the situation board.
4. Read the debrief: your grade and how it's weighted, a timeline tagged by CSF Function, missed key decisions, and the preparation that would have changed the outcome.

**Presentation mode** (`play.html?scenario=clinic&present=1`): large text, A–D choices for a show-of-hands vote, a "Reveal consequences" step after each decision, and an optional 45-second vote timer.
**Debug mode** (`&debug=1`): shows the node id, flags and meters, plus a jump-to-node menu.

Progress and finished runs are saved in your browser's `localStorage`. Nothing leaves your device.

## Project layout

```
index.html  play.html  debrief.html  learn.html  404.html
css/styles.css            design system (light/dark, reduced motion, print)
js/engine/                pure game logic, no DOM: state, resolve, score, save
js/ui/                    page controllers
data/scenarios/*.json     scenarios (content is data)
data/schema.md            scenario format, with annotated examples
data/references.json      every real-world source the game cites
tools/validate.mjs        scenario validator
tools/walk-all-paths.mjs  plays every path; balance and QA report
tests/engine.test.mjs     engine tests
```

Plain HTML, CSS and vanilla ES modules. No build step, no frameworks, no external requests. All URLs are relative, so the site works at any base path.

## Run locally

```sh
python3 -m http.server      # then open http://localhost:8000
```

(Opening the files directly with `file://` won't work, because browsers block ES modules and `fetch` there.)

## Validate and test (Node 18+, no dependencies)

```sh
node tools/validate.mjs           # schema, graph and citation checks for every scenario
node --test tests/                # engine tests
node tools/walk-all-paths.mjs     # play every path; report ending reach, meter ranges, dominant strategies
node tools/walk-all-paths.mjs --write   # also refresh each scenario's "best run" benchmark used by the debrief
```

## Add a scenario

1. Copy `data/scenarios/_sample.json` to `data/scenarios/<id>.json` and read `data/schema.md`.
2. Write the org profile, ransom note, hidden facts (with `preparation` notes), nodes, choices and injects. Every choice needs a CSF Function, a legacy phase, debrief notes and at least one `referenceId`.
3. Add any new sources to `data/references.json` (title, publisher, year, URL). Mark anything unverified as `[VERIFY: ...]`.
4. Add an entry to `data/scenarios/index.json`.
5. Run `node tools/validate.mjs`, then `node tools/walk-all-paths.mjs <id>`, and adjust the scenario's numbers (not the engine) until no balance problems are reported. Finally run `--write` to store the benchmark.

## References

Every real-world law, regulation, guidance document or statistic cites a primary source in [`data/references.json`](data/references.json), listed in full on the site's **Learn** page. Key sources: NIST SP 800-61 Rev. 3 (2025), NIST CSF 2.0 (2024), the CISA/FBI/NSA/MS-ISAC #StopRansomware Guide, Treasury OFAC's 2021 ransomware advisory, FBI/IC3 guidance, the HHS Breach Notification Rule and ransomware fact sheet, Texas Business & Commerce Code § 521.053, Texas Government Code § 2054.603, CISA/FBI advisory AA21-131A, and the CISA/FBI/EPA Water and Wastewater Sector Incident Response Guide. To list open verification items: `grep -rn "VERIFY" data/`.

## Disclaimer

This is an educational simulation, **not legal advice**. All organizations, people, ransomware groups, domains and phone numbers are fictional; real incidents appear only as cited "real-world parallel" notes in the debrief. In-game costs and meter values are illustrative, not estimates.

# Ransomware Tabletop: slide content (5 slides)

Live: https://agdenton3.github.io/ransomware-tabletop/

---

## Slide 1: The Problem
`CSCE 477`

### Ransomware hits the organizations least ready for it

| | |
|---|---|
| **Who gets hit** | Clinics, small utilities, cities: no security team, IT is one or two people |
| **What's at stake** | Patient care, safe water, residents' data, public money |
| **The scale** | Ransomware was the most-reported threat among critical-infrastructure complainants to the FBI in 2024: about 1,400 complaints, up 9% [FBI IC3 2024]* |
| **The trend** | Ransomware reports to the FBI rose 21%, and losses 225%, from 2019 to 2020 [OFAC 2021]* |

**The first hours decide the outcome, and nobody has practised them.**

*Speaker notes*
- The hard part of a ransomware incident isn't technical. It's a chain of decisions under time pressure: contain or keep operating, who to call, whether to pay, what to tell the public.
- Large companies rehearse these decisions; a 40-person clinic or a 30,000-resident water utility usually doesn't.
- Rehearsing decisions in a safe setting is the cheapest preparation there is, and that's what this project builds.

\* *Before presenting: confirm both figures in the original documents (`data/references.json` marks the IC3 figure [VERIFY]; the OFAC figure comes from the 2021 advisory's background section).*

---

## Slide 2: Approach
`CSCE 477`

### A tabletop exercise, mapped to NIST

1. **Tabletop exercise:** a scripted scenario where a team talks through its response; standard practice for testing IR plans
2. **Framework:** every decision is tagged with a **NIST CSF 2.0 Function** (SP 800-61 Rev. 3, April 2025), plus its **legacy Rev. 2 phase**
3. **Five meters**, because no single number captures an incident:

| Meter | Why it exists |
|---|---|
| Cost ($) | Response, recovery and ransom money are real trade-offs |
| Downtime (h) | Patients turned away, bills not sent |
| Data Loss (%) | What can't be recovered |
| Public Trust (0–100) | Communication choices have consequences |
| Legal Exposure (0–100) | Notification deadlines, sanctions risk |

*Speaker notes*
- Rev. 3 replaced Rev. 2's four-phase lifecycle with the six CSF 2.0 Functions: Govern, Identify, Protect, Detect, Respond, Recover. Its message is that incident response is part of everyday risk management.
- I kept Rev. 2's phases as a secondary label because many playbooks and courses still use them.
- The meters pull against each other: isolating the network costs downtime, paying costs money and legal exposure, and staying quiet costs trust.

---

## Slide 3: What I Built
`CSCE 477`

### A browser game with data-driven scenarios

**Live:** agdenton3.github.io/ransomware-tabletop

| Layer | What it does |
|---|---|
| Scenarios (JSON) | Nodes, choices, hidden facts, timed "injects" such as leak threats and reporter calls |
| Engine (pure JS) | State, branching, clock, meters, scoring; no scenario-specific code |
| Tooling | Validator, 17 engine tests, an all-paths walker |
| UI | War room, debrief, presentation mode; accessible; runs entirely in the browser |

| Clinic | Water utility |
|---|---|
| Patient data, HIPAA notice | IT/OT segmentation: cut the plant off and run it by hand? |
| Double extortion: data stolen *and* encrypted | Council must approve any payment (governance decision) |
| A backup "hidden in plain sight" | Public safety messaging; slow tape restore |

*Speaker notes*
- Content is data: a new scenario is a JSON file that has to pass the validator. It checks every path reaches an ending, every choice has a CSF tag, and every real-world claim cites a primary source.
- Everything is fictional (organizations, people, the gangs) except the laws and guidance, which link to HHS, Treasury, the FBI, CISA, NIST and Texas statutes.
- Static site on GitHub Pages: no backend, no tracking, no external requests. Progress stays in your browser.

---

## Slide 4: Results & Limitations
`CSCE 477`

### Every possible path, played automatically

| | Clinic | Water utility |
|---|---|---|
| Complete paths | 1,122,660 | 202,176 |
| Endings reached | 4 of 4 | 4 of 4 |
| Best "paid" grade | B | C |
| Paths earning an A | 267 (0.02%) | 406 (0.2%) |

| Ending (clinic) | Downtime range | Cost range |
|---|---|---|
| Recovered without paying | 2.7–8.4 days | $85k–$321k |
| Paid the ransom | 2.8–10.3 days | $367k–$681k |
| Rebuilt from scratch | 11.5–15.9 days | $206k–$439k |
| Regulatory fallout | 2.7–8.4 days | $110k–$341k |

**Playtests:** [RESULT: number of players] · [RESULT: average grade] · [RESULT: most-missed key decision]

**Limitations:** scripted branches, not open-ended · costs and meter values are illustrative · scoring weights are a design choice

*Speaker notes*
- The path walker found real balance bugs while I built this. At first, skipping the forensic investigation was the best strategy, and keeping the water plant connected beat cutting it off. I fixed both in the scenario data, not the engine.
- Paying never earns an A in either scenario: the decryptor is partial, and the data leaks anyway.
- [RESULT: one quote or observation from playtesting.]

---

## Slide 5: Takeaways & Next Steps
`CSCE 477`

### Three lessons the game teaches

1. **Contain first.** Every connected minute widens what you have to restore.
2. **Your backups decide the ransom question.** Test them before you need them, and keep one offline.
3. **Notification is a legal clock, not a PR choice.** HIPAA: 60 days at most. Texas AG: 30 days. Texas local governments: 48 hours to DIR.

### Next steps
- More sectors: schools, county government, a small manufacturer
- Multiplayer roles: CEO, legal and PR each see different information
- Scenarios built from real CISA #StopRansomware advisories

### Questions?
**agdenton3.github.io/ransomware-tabletop**

*Speaker notes*
- Almost every bad outcome traces back to something fixable before the incident: MFA on remote access, an offline backup, a written plan, IT/OT segmentation. That's what the debrief's "Preparation would have changed this" section shows.
- Invite the class to play: it takes about 12–15 minutes, and the debrief is the payoff.

---

# 3-minute live demo (presentation mode)

**Setup before class:** open `agdenton3.github.io/ransomware-tabletop/play.html?scenario=clinic&present=1` in a private window (no saved progress). Turn the timer **off** at the first decision; turn it on only for the pay vote.

| Time | Do | Say |
|---|---|---|
| 0:00 | Ransom note splash on screen | "It's 7:42 at a 40-person family clinic. This is what the front desk sees." Press **Begin**. |
| 0:20 | Decision 1: press **A** (isolate now) → **Reveal** | "First call: isolate, even though patients are in the lobby. Watch Downtime go up; that's the price of containment." Point at the CSF badge: **RS Respond**. |
| 0:45 | Owner call: **A** (paper schedule) → Reveal → Continue | "The owner wants to stay open. This is a **Govern** decision: who decides?" |
| 1:00 | Call insurer **A**, forensics **A**, full reset **A** (reveal each quickly) | "Bring in help, find the way in (no MFA), close it." Point at the situation board filling in. |
| 1:30 | Backups: choose **B** (check only the NAS) → "Open the portal" | "Let's take the realistic shortcut and only check the nearest backup. It's encrypted." |
| 1:45 | Portal → **A** (counsel + FBI first) → **"Do we pay?"** | Timer **on**. "Class vote: A, pay through counsel; B, pay fast for the discount; C, don't pay. Hands up." |
| 2:15 | Press the class's letter → **Reveal consequences** | Read the consequence line aloud. If they paid: "Watch the leak inject later; paying didn't stop it." If they refused: "And we never checked the cloud copy…" |
| 2:35 | Open a pre-finished debrief in a second tab | Show the grade and weights, the **NIST function chart**, and **Missed opportunities** ("check every backup" will be listed). |
| 2:55 | Back to slides | "Everything you just saw is one JSON file. The engine doesn't know it's a clinic." |

**Tip:** before class, play once to the end so the debrief tab is ready (any path works; a run that skipped the cloud backup makes the best example).

---

# 3 screenshots to capture

1. **The war room** (desktop, 1280 px, light mode): clinic, first decision, showing the inbox, the meters, the clock and the situation board. For Slide 3.
2. **Presentation mode reveal**: after a vote, the Consequences panel with meter deltas and the CSF badge. For Slide 2 or the demo backup.
3. **Debrief**: the grade card plus the "Your response by NIST function" bar chart. For Slide 4.

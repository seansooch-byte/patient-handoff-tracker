# Patient Handoff Tracker

An evidence-based I-PASS/SBAR digital handoff system for Emergency Medicine, built as a Quality Improvement project to standardize shift communication and measure Joint Commission compliance.

## The Problem

Patient handoffs during shift changes are the highest-risk communication events in emergency medicine. The Joint Commission identifies handoff failures as a leading root cause of sentinel events. Paper-based handoffs are unstandardized, unauditable, and lose critical information.

## The Solution

A mobile-first web application that enforces the I-PASS framework (validated in NEJM, 30% reduction in preventable adverse events) with built-in quality metrics for continuous improvement.

### Features

- **I-PASS structured handoffs**: Illness severity, Patient summary, Action list, Situational awareness, Synthesis by receiver
- **SBAR quick mode**: Situation, Background, Assessment, Recommendation for urgent calls
- **Patient board**: one chart folder per patient, coloured by ESI acuity, with handoff status and open actions
- **Named receiver and read-back**: every sent handoff names a receiver from the shift team; only that person can acknowledge and verify
- **Action item tracking**: STAT / urgent / routine to-dos with completion tracking
- **QI metrics dashboard**: Joint Commission compliance indicators, timing, CSV export
- **Print-friendly sheets**: the handoff prints as a chart sheet on letter paper for rounds
- **HIPAA-conscious design**: session auth on every route, audit log rows on handoff views and changes, soft delete, synthetic data only

Planned, not built: real-time board updates (Server-Sent Events) and role-based zone filtering.

**Live demo:** https://patient-handoff-tracker.onrender.com (synthetic data; demo sign-in sheet on the login page).
Edition 1 of the interface is preserved at https://handoff-tracker-v1.pages.dev.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python / Flask 3.1 |
| Database | SQLite (WAL mode) |
| Frontend | Vanilla HTML / CSS / JavaScript, Jinja templates |
| Auth | Flask-Login (session cookies) |
| Tests | pytest (fresh seeded database per test) |
| Deployment | Render (render.yaml) |

## Quick Start

```bash
git clone https://github.com/[username]/patient-handoff-tracker.git
cd patient-handoff-tracker
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python3 scripts/init_db.py
python3 scripts/seed_db.py
flask run --debug --port 5000
```

Run the tests with `pip install pytest && python3 -m pytest tests`.

Open http://localhost:5000. Login with demo credentials from seed data.

## Clinical Framework

This tool implements the I-PASS handoff bundle as validated by Starmer et al. (NEJM, 2014) across 9 residency programs. The I-PASS mnemonic structures every handoff:

| Component | What It Captures |
|-----------|-----------------|
| **I**llness Severity | Critical / Serious / Stable / Watch |
| **P**atient Summary | One-liner, HPI, PMH, key meds/labs/imaging |
| **A**ction List | Prioritized to-dos with assignments |
| **S**ituational Awareness | Contingency plans, anticipated changes |
| **S**ynthesis by Receiver | Read-back confirmation of understanding |

## License

MIT

# Patient Handoff Tracker

An evidence-based I-PASS/SBAR digital handoff system for Emergency Medicine, built as a Quality Improvement project to standardize shift communication and measure Joint Commission compliance.

## The Problem

Patient handoffs during shift changes are the highest-risk communication events in emergency medicine. The Joint Commission identifies handoff failures as a leading root cause of sentinel events. Paper-based handoffs are unstandardized, unauditable, and lose critical information.

## The Solution

A mobile-first web application that enforces the I-PASS framework (validated in NEJM, 30% reduction in preventable adverse events) with built-in quality metrics for continuous improvement.

### Features

- **I-PASS Structured Handoffs** — Illness severity, Patient summary, Action list, Situational awareness, Synthesis by receiver
- **SBAR Quick Mode** — Streamlined urgent handoff for fast-paced EM environments
- **Real-time Patient Board** — Live updates via Server-Sent Events across all connected devices
- **Receiver Verification** — Read-back confirmation completing the communication loop
- **Action Item Tracking** — Priority-based to-dos with assignment and completion tracking
- **QI Metrics Dashboard** — Automated compliance scoring, timing analysis, provider confidence surveys
- **Print-Friendly Sheets** — Clean handoff printouts for rounds
- **HIPAA-Conscious Design** — Audit logging, role-based access, session management

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python / Flask 3.1 |
| Database | SQLite (WAL mode) |
| Frontend | Vanilla HTML / CSS / JavaScript |
| Auth | Flask-Login (session cookies) |
| Real-time | Server-Sent Events |
| Deployment | Railway |

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

## Screenshots

<!-- TODO: Add screenshots after Step 1 frontend build -->

## License

MIT

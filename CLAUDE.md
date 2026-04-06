# Patient Handoff Tracker

## Change Philosophy

For each change, examine the existing system and redesign it into the most elegant solution that would have emerged if the change had been a foundational assumption from the start.

## Project Context

Emergency Medicine patient handoff tool implementing I-PASS and SBAR frameworks. Built as a QI project for a real clinical site. Every design decision should prioritize: clinical usability > code elegance > feature richness.

## Architecture Rules

- **No ORM.** Raw SQL with parameterized queries only. Learn what the database does.
- **No frontend framework.** Vanilla HTML/CSS/JS with Jinja2 templates.
- **Light theme.** Clinical environments under fluorescent lighting need max readability.
- **Mobile-first.** Every page must work on an iPad held during shift change.
- **Print-friendly.** Handoff sheets must print cleanly on letter paper.
- **No real PHI.** All development data is synthetic. Seed scripts generate fake patients.

## Security Rules

- Every route that accesses patient data must be behind @login_required
- Every data access must be audit-logged (use the @audit decorator)
- SQL queries must use parameterized placeholders (?), never string interpolation
- No patient data in URL parameters
- No deletion — soft delete only (is_active = 0)
- Session timeout: 8 hours (shift-aligned)

## I-PASS Framework

Every handoff must capture:
- **I** — Illness severity (critical / serious / stable / watch)
- **P** — Patient summary (one-liner, HPI, PMH, meds, labs, imaging)
- **A** — Action list (to-dos with priority and assignment)
- **S** — Situational awareness (contingency plans, what to watch for)
- **S** — Synthesis by receiver (read-back confirmation)

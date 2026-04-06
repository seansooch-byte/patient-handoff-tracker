# Decision Log

Append-only record of architectural and design decisions. Never edit past entries — add a new entry that supersedes the old one.

---

## DEC-001: Flask over FastAPI

**Date:** 2026-04-05
**Status:** Accepted

### Context
Choosing the Python web framework for a developer with no backend experience.

### Decision
Flask 3.1 with synchronous request handling.

### Alternatives Considered
- **FastAPI** — rejected because it adds three simultaneous new concepts (async, Pydantic models, dependency injection). For a first backend project, that's a learning cliff, not a curve.
- **Django** — rejected because it's too opinionated for a small app. ORM, admin panel, migrations system are overhead for 7 tables.

### Rationale
Flask routes read top-to-bottom like a script. The mental model is: request comes in, function runs, response goes out. Sean's Python experience is synchronous and imperative — Flask matches that. For 5-15 concurrent users on SQLite, async is not a bottleneck.

### Consequences
- No automatic API documentation (FastAPI gives this free via OpenAPI)
- No async I/O — fine for our scale, would need migration if scaling to 100+ concurrent
- Flask-Login provides session auth with minimal code

---

## DEC-002: SQLite over PostgreSQL

**Date:** 2026-04-05
**Status:** Accepted

### Context
Database choice for a clinical handoff tool with 5-15 concurrent users per shift.

### Decision
SQLite 3 with WAL mode enabled.

### Alternatives Considered
- **PostgreSQL** — rejected because it's not installed and adds setup/ops complexity. Sean has never managed a database server.
- **MongoDB** — rejected because clinical data is inherently relational (patients have handoffs, handoffs have action items).

### Rationale
SQLite is already on the machine. WAL mode handles concurrent reads during shift change. The write pattern (burst during handoff creation, mostly reads otherwise) is ideal for SQLite. Migration to PostgreSQL is straightforward if the pilot scales beyond one site.

### Consequences
- No concurrent write scaling beyond ~50 writes/second (not a concern at our scale)
- Database is a single file — easy backup, easy to reset for testing
- Railway deployment needs a mounted volume for persistence

---

## DEC-003: Light theme for clinical UI

**Date:** 2026-04-05
**Status:** Accepted

### Context
Color theme choice for an app used in clinical environments.

### Decision
Light theme with high-contrast acuity color coding.

### Alternatives Considered
- **Dark theme** — rejected despite being Sean's default aesthetic. Hospital environments use fluorescent lighting where dark themes reduce readability and increase eye strain.

### Rationale
Clinical tools prioritize scannability. Acuity colors (red/orange/green/yellow) need a neutral light background for maximum contrast. Print stylesheets also work better from a light base. This is a deliberate departure from portfolio aesthetics toward clinical functionality.

### Consequences
- Must ensure acuity badge colors meet WCAG AA contrast ratios against light backgrounds
- Print stylesheet is simpler (light → white is trivial)

---

## DEC-004: Raw SQL over ORM

**Date:** 2026-04-05
**Status:** Accepted

### Context
Whether to use SQLAlchemy ORM or write raw SQL queries.

### Decision
Raw SQL with parameterized queries throughout.

### Alternatives Considered
- **SQLAlchemy ORM** — rejected because learning SQL and learning an ORM simultaneously doubles the cognitive load. The ORM abstracts away exactly what needs to be understood first.

### Rationale
Sean needs to know what `SELECT`, `JOIN`, `INSERT` do before hiding them behind `.query.filter_by()`. Parameterized queries (`?` placeholders) force thinking about SQL injection — a HIPAA-relevant security skill. When the queries are visible, security review is straightforward.

### Consequences
- More verbose code for complex queries
- No automatic migration tooling — manual SQL files in schema/
- Easy to audit every database interaction for security review

---

## DEC-005: Session cookies over JWT

**Date:** 2026-04-05
**Status:** Accepted

### Context
Authentication mechanism for a same-origin web application.

### Decision
Flask-Login with server-side sessions and HttpOnly cookies.

### Alternatives Considered
- **JWT** — rejected because it requires manual token storage decisions, refresh logic, and Authorization header injection on every fetch call. For a same-origin app, cookies are simpler and more secure.

### Rationale
The browser handles session cookies automatically — no client-side code needed for auth persistence. Flask-Login is 4 functions. Sessions are server-side, so they can be invalidated immediately on logout (HIPAA requirement). HttpOnly prevents XSS from stealing sessions.

### Consequences
- Auth doesn't work for third-party API consumers (not needed)
- Sessions stored on server — need session cleanup on long-running deployments
- 8-hour timeout aligns with shift length

---

## DEC-006: SSE over WebSockets

**Date:** 2026-04-05
**Status:** Accepted

### Context
How to push real-time board updates to connected browsers.

### Decision
Server-Sent Events (EventSource API).

### Alternatives Considered
- **WebSockets** — rejected because they require flask-socketio + a message broker. Bidirectional communication is unnecessary — the board pushes updates, clients don't push back via the same channel.
- **Polling** — rejected because it wastes bandwidth on hospital WiFi and introduces visible update lag.

### Rationale
Handoff board updates are one-directional broadcasts. SSE is a native browser API (no library), auto-reconnects on network drops (common on hospital WiFi), and requires only a Python generator function in Flask. The implementation is ~20 lines of code.

### Consequences
- One-directional only (server → client). Client actions use regular fetch() calls.
- Max ~6 concurrent SSE connections per domain in older browsers (fine for 5-15 users)
- Auto-reconnect handles hospital WiFi flakiness gracefully

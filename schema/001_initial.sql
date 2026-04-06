-- Patient Handoff Tracker — Initial Schema
-- I-PASS/SBAR framework for Emergency Medicine

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- Providers
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT    NOT NULL UNIQUE,
    password_hash   TEXT    NOT NULL,
    display_name    TEXT    NOT NULL,
    role            TEXT    NOT NULL CHECK(role IN ('attending','resident','intern','nurse','admin')),
    specialty       TEXT    DEFAULT 'emergency_medicine',
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT    DEFAULT (datetime('now')),
    last_login      TEXT
);

-- Shifts
CREATE TABLE IF NOT EXISTS shifts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_type      TEXT    NOT NULL CHECK(shift_type IN ('day','evening','night','swing')),
    start_time      TEXT    NOT NULL,
    end_time        TEXT    NOT NULL,
    department      TEXT    DEFAULT 'emergency',
    created_by      INTEGER REFERENCES users(id),
    created_at      TEXT    DEFAULT (datetime('now'))
);

-- Shift assignments (who is on which shift)
CREATE TABLE IF NOT EXISTS shift_assignments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id        INTEGER NOT NULL REFERENCES shifts(id),
    user_id         INTEGER NOT NULL REFERENCES users(id),
    assignment_role TEXT    CHECK(assignment_role IN ('primary','secondary','supervisor')),
    zone            TEXT,
    UNIQUE(shift_id, user_id)
);

-- Patients
CREATE TABLE IF NOT EXISTS patients (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    mrn             TEXT    NOT NULL,
    display_name    TEXT    NOT NULL,
    age             INTEGER,
    sex             TEXT    CHECK(sex IN ('M','F','O','U')),
    chief_complaint TEXT,
    room_bed        TEXT,
    arrival_time    TEXT,
    acuity          INTEGER CHECK(acuity BETWEEN 1 AND 5),
    disposition     TEXT    CHECK(disposition IN ('admit','discharge','transfer','observe','undecided')),
    is_active       INTEGER DEFAULT 1,
    created_by      INTEGER REFERENCES users(id),
    created_at      TEXT    DEFAULT (datetime('now')),
    updated_at      TEXT    DEFAULT (datetime('now'))
);

-- Handoffs (I-PASS + SBAR)
CREATE TABLE IF NOT EXISTS handoffs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id          INTEGER NOT NULL REFERENCES patients(id),
    shift_id            INTEGER REFERENCES shifts(id),

    -- Who
    sender_id           INTEGER NOT NULL REFERENCES users(id),
    receiver_id         INTEGER REFERENCES users(id),

    -- I: Illness Severity
    illness_severity    TEXT    NOT NULL CHECK(illness_severity IN ('critical','serious','stable','watch')),
    code_status         TEXT,

    -- P: Patient Summary
    one_liner           TEXT    NOT NULL,
    hpi_summary         TEXT,
    pertinent_pmh       TEXT,
    key_meds            TEXT,
    key_labs            TEXT,
    key_imaging         TEXT,

    -- S: Situational Awareness
    contingency_plan    TEXT,
    what_to_watch       TEXT,
    anticipated_changes TEXT,

    -- S: Synthesis by Receiver
    receiver_summary    TEXT,
    questions_asked     TEXT,
    verification_status TEXT    DEFAULT 'pending'
                               CHECK(verification_status IN ('pending','verified','clarification_needed')),

    -- SBAR mode (alternative framework, same table)
    handoff_type        TEXT    DEFAULT 'ipass' CHECK(handoff_type IN ('ipass','sbar')),
    sbar_situation      TEXT,
    sbar_background     TEXT,
    sbar_assessment     TEXT,
    sbar_recommendation TEXT,

    -- Workflow status
    status              TEXT    DEFAULT 'draft' CHECK(status IN ('draft','sent','acknowledged','verified','archived')),
    started_at          TEXT    DEFAULT (datetime('now')),
    sent_at             TEXT,
    acknowledged_at     TEXT,
    verified_at         TEXT,
    is_printed          INTEGER DEFAULT 0,
    created_at          TEXT    DEFAULT (datetime('now')),
    updated_at          TEXT    DEFAULT (datetime('now'))
);

-- Action items per handoff
CREATE TABLE IF NOT EXISTS action_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    handoff_id      INTEGER NOT NULL REFERENCES handoffs(id),
    description     TEXT    NOT NULL,
    priority        TEXT    DEFAULT 'routine' CHECK(priority IN ('stat','urgent','routine')),
    due_by          TEXT,
    assigned_to     INTEGER REFERENCES users(id),
    completed       INTEGER DEFAULT 0,
    completed_at    TEXT,
    completed_by    INTEGER REFERENCES users(id),
    created_at      TEXT    DEFAULT (datetime('now'))
);

-- QI metrics (Joint Commission compliance + outcomes)
CREATE TABLE IF NOT EXISTS handoff_metrics (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    handoff_id      INTEGER NOT NULL REFERENCES handoffs(id),
    shift_id        INTEGER REFERENCES shifts(id),

    -- Joint Commission compliance indicators
    used_standardized_format  INTEGER DEFAULT 0,
    interactive_communication INTEGER DEFAULT 0,
    verification_completed    INTEGER DEFAULT 0,
    documentation_complete    INTEGER DEFAULT 0,

    -- Timing
    handoff_duration_seconds  INTEGER,
    action_items_count        INTEGER DEFAULT 0,
    action_items_completed    INTEGER DEFAULT 0,

    -- Quality self-assessment (post-handoff survey)
    sender_confidence         INTEGER CHECK(sender_confidence BETWEEN 1 AND 5),
    receiver_confidence       INTEGER CHECK(receiver_confidence BETWEEN 1 AND 5),
    perceived_completeness    INTEGER CHECK(perceived_completeness BETWEEN 1 AND 5),

    -- Outcome tracking (filled retrospectively)
    adverse_event_within_shift  INTEGER DEFAULT 0,
    bounce_back                 INTEGER DEFAULT 0,
    near_miss                   INTEGER DEFAULT 0,
    notes                       TEXT,

    created_at      TEXT    DEFAULT (datetime('now'))
);

-- HIPAA audit trail (append-only)
CREATE TABLE IF NOT EXISTS audit_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER REFERENCES users(id),
    action          TEXT    NOT NULL,
    resource_type   TEXT,
    resource_id     INTEGER,
    ip_address      TEXT,
    user_agent      TEXT,
    details         TEXT,
    created_at      TEXT    DEFAULT (datetime('now'))
);

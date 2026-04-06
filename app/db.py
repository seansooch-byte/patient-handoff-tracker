"""Database connection and query helpers for SQLite."""

import os
import sqlite3

from flask import g, current_app


def get_db():
    """Get a database connection for the current request.
    Stored in Flask's g object so the same connection is reused
    within a single request. Closed automatically at teardown."""
    if 'db' not in g:
        db_path = current_app.config.get('DATABASE_PATH', 'instance/handoff.db')
        g.db = sqlite3.connect(db_path)
        g.db.row_factory = sqlite3.Row  # dict-like access
        g.db.execute('PRAGMA foreign_keys = ON')
        g.db.execute('PRAGMA journal_mode = WAL')
    return g.db


def close_db(e=None):
    """Close the database connection at the end of the request."""
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    """Run schema files to create tables and indexes."""
    db = get_db()
    schema_dir = os.path.join(os.path.dirname(__file__), '..', 'schema')
    for sql_file in sorted(os.listdir(schema_dir)):
        if sql_file.endswith('.sql') and sql_file != 'seed_data.sql':
            path = os.path.join(schema_dir, sql_file)
            with open(path, 'r') as f:
                db.executescript(f.read())
    db.commit()


def query(sql, args=(), one=False):
    """Execute a SELECT query and return results as dicts."""
    cur = get_db().execute(sql, args)
    rows = cur.fetchall()
    cur.close()
    if one:
        return dict(rows[0]) if rows else None
    return [dict(row) for row in rows]


def execute(sql, args=()):
    """Execute an INSERT/UPDATE/DELETE and return the cursor."""
    db = get_db()
    cur = db.execute(sql, args)
    db.commit()
    return cur


def init_app(app):
    """Register the database teardown with the Flask app."""
    app.teardown_appcontext(close_db)

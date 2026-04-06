"""Seed the database with synthetic demo data."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from werkzeug.security import generate_password_hash

from app import create_app
from app.db import get_db

DEMO_USERS = [
    ('achen', 'Dr. Amy Chen', 'attending'),
    ('rpatel', 'Dr. Raj Patel', 'resident'),
    ('mwilliams', 'Dr. Maya Williams', 'resident'),
    ('jnurse', 'Jamie Torres, RN', 'nurse'),
    ('admin', 'System Admin', 'admin'),
]

app = create_app()
with app.app_context():
    db = get_db()

    # Check if users already exist
    existing = db.execute('SELECT COUNT(*) as c FROM users').fetchone()['c']
    if existing > 0:
        print(f'Database already has {existing} users. Skipping seed.')
        sys.exit(0)

    # Insert users with hashed password
    pw_hash = generate_password_hash('demo')
    for username, display_name, role in DEMO_USERS:
        db.execute(
            'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
            (username, pw_hash, display_name, role),
        )
    db.commit()
    print(f'Inserted {len(DEMO_USERS)} demo users.')

    # Run seed SQL
    seed_path = os.path.join(os.path.dirname(__file__), '..', 'schema', 'seed_data.sql')
    with open(seed_path, 'r') as f:
        db.executescript(f.read())
    print('Seed data loaded (patients, shifts, handoffs, action items).')
    print()
    print('Demo credentials:')
    for username, display_name, role in DEMO_USERS:
        print(f'  {username} / demo  ({role}: {display_name})')

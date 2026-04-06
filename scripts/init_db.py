"""Initialize the database — create tables and indexes."""

import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.db import init_db

app = create_app()
with app.app_context():
    init_db()
    print('Database initialized.')

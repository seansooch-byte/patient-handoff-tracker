import os

from flask import Flask, render_template, jsonify
from flask_login import login_required, current_user

from . import db as database
from . import auth


def _auto_seed(app):
    """Seed demo users + data if DB is empty (for Render deploys)."""
    from .db import get_db
    from werkzeug.security import generate_password_hash
    db = get_db()
    existing = db.execute('SELECT COUNT(*) as c FROM users').fetchone()['c']
    if existing > 0:
        return
    pw_hash = generate_password_hash('demo')
    for username, display_name, role in [
        ('achen', 'Dr. Amy Chen', 'attending'),
        ('rpatel', 'Dr. Raj Patel', 'resident'),
        ('mwilliams', 'Dr. Maya Williams', 'resident'),
        ('jnurse', 'Jamie Torres, RN', 'nurse'),
    ]:
        db.execute('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
                   (username, pw_hash, display_name, role))
    db.commit()
    seed_path = os.path.join(os.path.dirname(__file__), '..', 'schema', 'seed_data.sql')
    if os.path.exists(seed_path):
        with open(seed_path, 'r') as f:
            db.executescript(f.read())
    print('Auto-seeded database with demo data.')


def create_app():
    app = Flask(
        __name__,
        template_folder='../templates',
        static_folder='../static',
        instance_relative_config=False,
    )

    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-only-change-in-production')
    app.config['DATABASE_PATH'] = os.environ.get(
        'DATABASE_PATH',
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'instance', 'handoff.db'),
    )

    # Ensure instance directory exists
    os.makedirs(os.path.dirname(app.config['DATABASE_PATH']), exist_ok=True)

    # Register database teardown
    database.init_app(app)

    # Auto-initialize DB + seed on first run (needed for Render's ephemeral filesystem)
    with app.app_context():
        database.init_db()
        _auto_seed(app)

    # Register auth (Flask-Login + auth blueprint)
    auth.init_app(app)

    # Register API blueprints
    from .routes import patients as patients_bp
    from .routes import handoffs as handoffs_bp
    from .routes import metrics as metrics_bp
    app.register_blueprint(patients_bp.bp)
    app.register_blueprint(handoffs_bp.bp)
    app.register_blueprint(metrics_bp.bp)

    # --- Page routes (serve templates) ---

    @app.route('/')
    @app.route('/board')
    @login_required
    def board():
        return render_template('board.html', active_page='board', user=current_user)

    @app.route('/handoff/new')
    @login_required
    def handoff_new():
        return render_template('handoff_form.html', active_page='board', user=current_user)

    @app.route('/sbar/new')
    @login_required
    def sbar_new():
        return render_template('sbar_form.html', active_page='board', user=current_user)

    @app.route('/handoff/view')
    @app.route('/handoff/<int:handoff_id>')
    @login_required
    def handoff_view(handoff_id=None):
        return render_template('handoff_view.html', active_page='board', user=current_user)

    @app.route('/shifts')
    @login_required
    def shifts():
        return render_template('shifts.html', active_page='shifts', user=current_user)

    @app.route('/dashboard')
    @login_required
    def dashboard():
        return render_template('dashboard.html', active_page='dashboard', user=current_user)

    @app.route('/login')
    def login():
        if current_user.is_authenticated:
            return render_template('board.html', active_page='board', user=current_user)
        return render_template('login.html', active_page=None)

    return app

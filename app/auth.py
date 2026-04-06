"""Authentication — Flask-Login with session cookies."""

from functools import wraps

from flask import Blueprint, request, jsonify, redirect, url_for
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash

from .db import query, execute

bp = Blueprint('auth', __name__, url_prefix='/auth')

# Flask-Login setup
login_manager = LoginManager()
login_manager.login_view = 'login'


class User(UserMixin):
    """User model for Flask-Login. Wraps a database row."""

    def __init__(self, row):
        self.id = row['id']
        self.username = row['username']
        self.display_name = row['display_name']
        self.role = row['role']
        self.specialty = row.get('specialty', 'emergency_medicine')

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'display_name': self.display_name,
            'role': self.role,
            'specialty': self.specialty,
        }


@login_manager.user_loader
def load_user(user_id):
    """Load user by ID — called on every request with a session cookie."""
    row = query('SELECT * FROM users WHERE id = ? AND is_active = 1', (user_id,), one=True)
    if row:
        return User(row)
    return None


@login_manager.unauthorized_handler
def unauthorized():
    """Handle unauthorized access — redirect to login for pages, 401 for API."""
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Authentication required'}), 401
    return redirect('/login')


@bp.route('/login', methods=['POST'])
def login():
    """Authenticate with username and password."""
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password required'}), 400

    row = query(
        'SELECT * FROM users WHERE username = ? AND is_active = 1',
        (data['username'],),
        one=True,
    )

    if not row or not check_password_hash(row['password_hash'], data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401

    user = User(row)
    login_user(user, remember=True)

    # Update last login
    execute("UPDATE users SET last_login = datetime('now') WHERE id = ?", (user.id,))

    # Audit log
    execute(
        "INSERT INTO audit_log (user_id, action, details) VALUES (?, 'login', ?)",
        (user.id, f'Login from {request.remote_addr}'),
    )

    return jsonify(user.to_dict())


@bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """End the session."""
    execute(
        "INSERT INTO audit_log (user_id, action, details) VALUES (?, 'logout', NULL)",
        (current_user.id,),
    )
    logout_user()
    return jsonify({'message': 'Logged out'})


@bp.route('/me')
@login_required
def me():
    """Return the current authenticated user."""
    return jsonify(current_user.to_dict())


def init_app(app):
    """Register Flask-Login with the app."""
    from datetime import timedelta
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=8)
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['SESSION_COOKIE_NAME'] = 'handoff_session'

    login_manager.init_app(app)
    app.register_blueprint(bp)

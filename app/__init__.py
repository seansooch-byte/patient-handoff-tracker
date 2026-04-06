import os

from flask import Flask, render_template, jsonify
from flask_login import login_required, current_user

from . import db as database
from . import auth


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

"""Shared fixtures: a fresh seeded app per test, and a client signed in as a chosen demo user."""
import pytest

from app import create_app


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv('DATABASE_PATH', str(tmp_path / 'test.db'))
    monkeypatch.setenv('SECRET_KEY', 'test-only')
    app = create_app()
    app.config['TESTING'] = True
    return app


@pytest.fixture
def client_as(app):
    """client_as(user_id) returns a test client whose session is that seeded user."""
    def make(user_id):
        client = app.test_client()
        with client.session_transaction() as sess:
            sess['_user_id'] = str(user_id)
            sess['_fresh'] = True
        return client
    return make

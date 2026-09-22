"""The current shift and its team: one source for the board strip, the roster and the receiver list."""


def test_current_shift_requires_login(app):
    res = app.test_client().get('/api/shifts/current')
    assert res.status_code == 401


def test_current_shift_returns_seeded_team(client_as):
    res = client_as(1).get('/api/shifts/current')
    assert res.status_code == 200
    shift = res.get_json()
    assert shift['shift_type'] == 'night'
    assert shift['department'] == 'emergency'
    team = shift['team']
    assert [m['display_name'] for m in team] == [
        'Dr. Amy Chen', 'Dr. Raj Patel', 'Dr. Maya Williams', 'Jamie Torres, RN',
    ]
    assert team[0]['assignment_role'] == 'supervisor'
    assert team[1] == {
        'user_id': 2, 'display_name': 'Dr. Raj Patel', 'role': 'resident',
        'assignment_role': 'primary', 'zone': 'A',
    }
    # never leak credentials
    assert all('password_hash' not in m and 'username' not in m for m in team)


def test_named_receiver_can_verify_and_nobody_else(client_as):
    sender = client_as(2)
    res = sender.post('/api/handoffs', json={
        'patient_id': 1, 'illness_severity': 'critical', 'one_liner': 'test one-liner',
        'receiver_id': 3, 'shift_id': 1, 'status': 'sent',
    })
    assert res.status_code == 201
    hid = res.get_json()['id']
    assert res.get_json()['receiver_id'] == 3

    outsider = client_as(4).post(f'/api/handoffs/{hid}/verify', json={'receiver_summary': 'x'})
    assert outsider.status_code == 403

    ok = client_as(3).post(f'/api/handoffs/{hid}/verify', json={'receiver_summary': 'read back'})
    assert ok.status_code == 200
    assert ok.get_json()['status'] == 'verified'

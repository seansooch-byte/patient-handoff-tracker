"""Patient CRUD API endpoints."""

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user

from ..db import query, execute

bp = Blueprint('patients', __name__, url_prefix='/api')


@bp.route('/patients')
@login_required
def list_patients():
    """List active patients with optional filters."""
    filters = ['p.is_active = 1']
    args = []

    acuity = request.args.get('acuity')
    if acuity and acuity.isdigit():
        filters.append('p.acuity = ?')
        args.append(int(acuity))

    disposition = request.args.get('disposition')
    if disposition in ('admit', 'discharge', 'transfer', 'observe', 'undecided'):
        filters.append('p.disposition = ?')
        args.append(disposition)

    severity = request.args.get('severity')
    if severity in ('critical', 'serious', 'stable', 'watch'):
        severity_map = {'critical': 1, 'serious': 2, 'watch': 3, 'stable': 4}
        filters.append('p.acuity <= ?')
        args.append(severity_map.get(severity, 5))

    where = ' AND '.join(filters)

    patients = query(f'''
        SELECT
            p.*,
            h.id as latest_handoff_id,
            h.status as handoff_status,
            h.illness_severity,
            (SELECT COUNT(*) FROM action_items ai
             JOIN handoffs hh ON ai.handoff_id = hh.id
             WHERE hh.patient_id = p.id AND ai.completed = 0) as pending_actions,
            (SELECT COUNT(*) FROM action_items ai
             JOIN handoffs hh ON ai.handoff_id = hh.id
             WHERE hh.patient_id = p.id AND ai.completed = 1) as completed_actions
        FROM patients p
        LEFT JOIN handoffs h ON h.patient_id = p.id
            AND h.id = (SELECT MAX(id) FROM handoffs WHERE patient_id = p.id)
        WHERE {where}
        ORDER BY p.acuity ASC, p.arrival_time ASC
    ''', args)

    return jsonify(patients)


@bp.route('/patients/<int:patient_id>')
@login_required
def get_patient(patient_id):
    """Get a single patient with their handoff history."""
    patient = query(
        'SELECT * FROM patients WHERE id = ? AND is_active = 1',
        (patient_id,),
        one=True,
    )
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    handoffs = query(
        '''SELECT h.*, u.display_name as sender_name
           FROM handoffs h
           JOIN users u ON h.sender_id = u.id
           WHERE h.patient_id = ?
           ORDER BY h.created_at DESC''',
        (patient_id,),
    )
    patient['handoffs'] = handoffs

    return jsonify(patient)


@bp.route('/patients', methods=['POST'])
@login_required
def create_patient():
    """Create a new patient."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    required = ['display_name', 'mrn']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    acuity = data.get('acuity')
    if acuity is not None and (not isinstance(acuity, int) or acuity < 1 or acuity > 5):
        return jsonify({'error': 'Acuity must be 1-5'}), 400

    disposition = data.get('disposition', 'undecided')
    if disposition not in ('admit', 'discharge', 'transfer', 'observe', 'undecided'):
        return jsonify({'error': 'Invalid disposition'}), 400

    sex = data.get('sex', 'U')
    if sex not in ('M', 'F', 'O', 'U'):
        return jsonify({'error': 'Sex must be M, F, O, or U'}), 400

    cur = execute(
        '''INSERT INTO patients (mrn, display_name, age, sex, chief_complaint,
           room_bed, arrival_time, acuity, disposition, created_by)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)''',
        (
            data['mrn'],
            data['display_name'],
            data.get('age'),
            sex,
            data.get('chief_complaint', ''),
            data.get('room_bed', ''),
            acuity or 3,
            disposition,
            data.get('created_by', 1),  # TODO: use current user from auth
        ),
    )

    patient = query('SELECT * FROM patients WHERE id = ?', (cur.lastrowid,), one=True)
    return jsonify(patient), 201


@bp.route('/patients/<int:patient_id>', methods=['PUT'])
@login_required
def update_patient(patient_id):
    """Update a patient's info."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    patient = query('SELECT * FROM patients WHERE id = ? AND is_active = 1', (patient_id,), one=True)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    updatable = ['display_name', 'age', 'sex', 'chief_complaint', 'room_bed', 'acuity', 'disposition']
    sets = []
    args = []
    for field in updatable:
        if field in data:
            sets.append(f'{field} = ?')
            args.append(data[field])

    if not sets:
        return jsonify({'error': 'No fields to update'}), 400

    sets.append("updated_at = datetime('now')")
    args.append(patient_id)

    execute(f"UPDATE patients SET {', '.join(sets)} WHERE id = ?", args)

    updated = query('SELECT * FROM patients WHERE id = ?', (patient_id,), one=True)
    return jsonify(updated)


@bp.route('/patients/<int:patient_id>/discharge', methods=['PUT'])
@login_required
def discharge_patient(patient_id):
    """Soft-delete: mark patient as inactive (discharged)."""
    patient = query('SELECT * FROM patients WHERE id = ? AND is_active = 1', (patient_id,), one=True)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    execute(
        "UPDATE patients SET is_active = 0, disposition = 'discharge', updated_at = datetime('now') WHERE id = ?",
        (patient_id,),
    )

    return jsonify({'message': 'Patient discharged', 'id': patient_id})


@bp.route('/patients/stats')
@login_required
def patient_stats():
    """Board summary stats."""
    stats = query('''
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN acuity <= 1 THEN 1 ELSE 0 END) as critical,
            SUM(CASE WHEN acuity = 2 THEN 1 ELSE 0 END) as serious,
            SUM(CASE WHEN acuity = 3 THEN 1 ELSE 0 END) as watch,
            SUM(CASE WHEN acuity >= 4 THEN 1 ELSE 0 END) as stable
        FROM patients
        WHERE is_active = 1
    ''', one=True)

    pending_handoffs = query('''
        SELECT COUNT(DISTINCT p.id) as count
        FROM patients p
        LEFT JOIN handoffs h ON h.patient_id = p.id
            AND h.id = (SELECT MAX(id) FROM handoffs WHERE patient_id = p.id)
        WHERE p.is_active = 1
            AND (h.id IS NULL OR h.status NOT IN ('verified', 'archived'))
    ''', one=True)

    stats['pending_handoffs'] = pending_handoffs['count']
    return jsonify(stats)

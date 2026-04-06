"""Handoff CRUD + verification workflow API endpoints."""

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user

from ..db import query, execute

bp = Blueprint('handoffs', __name__, url_prefix='/api')


@bp.route('/handoffs')
@login_required
def list_handoffs():
    """List handoffs with optional filters (shift, patient, status)."""
    filters = []
    args = []

    patient_id = request.args.get('patient_id')
    if patient_id and patient_id.isdigit():
        filters.append('h.patient_id = ?')
        args.append(int(patient_id))

    shift_id = request.args.get('shift_id')
    if shift_id and shift_id.isdigit():
        filters.append('h.shift_id = ?')
        args.append(int(shift_id))

    status = request.args.get('status')
    if status in ('draft', 'sent', 'acknowledged', 'verified', 'archived'):
        filters.append('h.status = ?')
        args.append(status)

    where = 'WHERE ' + ' AND '.join(filters) if filters else ''

    handoffs = query(f'''
        SELECT h.*,
               p.display_name as patient_name, p.mrn, p.room_bed, p.acuity, p.age, p.sex,
               p.chief_complaint,
               s.display_name as sender_name, s.role as sender_role,
               r.display_name as receiver_name, r.role as receiver_role
        FROM handoffs h
        JOIN patients p ON h.patient_id = p.id
        JOIN users s ON h.sender_id = s.id
        LEFT JOIN users r ON h.receiver_id = r.id
        {where}
        ORDER BY h.created_at DESC
    ''', args)

    return jsonify(handoffs)


@bp.route('/handoffs/<int:handoff_id>')
@login_required
def get_handoff(handoff_id):
    """Get a single handoff with action items."""
    handoff = query('''
        SELECT h.*,
               p.display_name as patient_name, p.mrn, p.room_bed, p.acuity, p.age, p.sex,
               p.chief_complaint, p.disposition,
               s.display_name as sender_name, s.role as sender_role,
               r.display_name as receiver_name, r.role as receiver_role
        FROM handoffs h
        JOIN patients p ON h.patient_id = p.id
        JOIN users s ON h.sender_id = s.id
        LEFT JOIN users r ON h.receiver_id = r.id
        WHERE h.id = ?
    ''', (handoff_id,), one=True)

    if not handoff:
        return jsonify({'error': 'Handoff not found'}), 404

    # Get action items
    actions = query('''
        SELECT ai.*,
               a.display_name as assigned_name,
               c.display_name as completer_name
        FROM action_items ai
        LEFT JOIN users a ON ai.assigned_to = a.id
        LEFT JOIN users c ON ai.completed_by = c.id
        WHERE ai.handoff_id = ?
        ORDER BY
            CASE ai.priority WHEN 'stat' THEN 1 WHEN 'urgent' THEN 2 ELSE 3 END,
            ai.created_at
    ''', (handoff_id,))

    handoff['action_items'] = actions

    # Audit log
    execute(
        "INSERT INTO audit_log (user_id, action, resource_type, resource_id, ip_address) VALUES (?, 'view', 'handoff', ?, ?)",
        (current_user.id, handoff_id, request.remote_addr),
    )

    return jsonify(handoff)


@bp.route('/handoffs', methods=['POST'])
@login_required
def create_handoff():
    """Create a new I-PASS or SBAR handoff."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    # Validate required fields
    if not data.get('patient_id'):
        return jsonify({'error': 'patient_id is required'}), 400
    if not data.get('illness_severity'):
        return jsonify({'error': 'illness_severity is required'}), 400
    if not data.get('one_liner'):
        return jsonify({'error': 'one_liner is required'}), 400

    severity = data['illness_severity']
    if severity not in ('critical', 'serious', 'stable', 'watch'):
        return jsonify({'error': 'Invalid illness_severity'}), 400

    handoff_type = data.get('handoff_type', 'ipass')
    if handoff_type not in ('ipass', 'sbar'):
        return jsonify({'error': 'Invalid handoff_type'}), 400

    status = data.get('status', 'draft')
    if status not in ('draft', 'sent'):
        return jsonify({'error': 'Status must be draft or sent'}), 400

    sent_at = "datetime('now')" if status == 'sent' else 'NULL'

    cur = execute(f'''
        INSERT INTO handoffs (
            patient_id, shift_id, sender_id, receiver_id,
            illness_severity, code_status,
            one_liner, hpi_summary, pertinent_pmh, key_meds, key_labs, key_imaging,
            contingency_plan, what_to_watch, anticipated_changes,
            handoff_type,
            sbar_situation, sbar_background, sbar_assessment, sbar_recommendation,
            status, sent_at
        ) VALUES (
            ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?,
            ?, ?, ?, ?,
            ?, {sent_at}
        )
    ''', (
        data['patient_id'],
        data.get('shift_id'),
        current_user.id,
        data.get('receiver_id'),
        severity,
        data.get('code_status'),
        data['one_liner'],
        data.get('hpi_summary'),
        data.get('pertinent_pmh'),
        data.get('key_meds'),
        data.get('key_labs'),
        data.get('key_imaging'),
        data.get('contingency_plan'),
        data.get('what_to_watch'),
        data.get('anticipated_changes'),
        handoff_type,
        data.get('sbar_situation'),
        data.get('sbar_background'),
        data.get('sbar_assessment'),
        data.get('sbar_recommendation'),
        status,
    ))

    handoff_id = cur.lastrowid

    # Create action items if provided
    action_items = data.get('action_items', [])
    for item in action_items:
        if item.get('description'):
            execute('''
                INSERT INTO action_items (handoff_id, description, priority, due_by, assigned_to)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                handoff_id,
                item['description'],
                item.get('priority', 'routine'),
                item.get('due_by'),
                item.get('assigned_to'),
            ))

    # Auto-generate metrics entry
    execute('''
        INSERT INTO handoff_metrics (handoff_id, shift_id, used_standardized_format, action_items_count)
        VALUES (?, ?, 1, ?)
    ''', (handoff_id, data.get('shift_id'), len(action_items)))

    # Audit log
    execute(
        "INSERT INTO audit_log (user_id, action, resource_type, resource_id, ip_address) VALUES (?, 'create', 'handoff', ?, ?)",
        (current_user.id, handoff_id, request.remote_addr),
    )

    handoff = query('SELECT * FROM handoffs WHERE id = ?', (handoff_id,), one=True)
    return jsonify(handoff), 201


@bp.route('/handoffs/<int:handoff_id>', methods=['PUT'])
@login_required
def update_handoff(handoff_id):
    """Update a draft handoff."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    handoff = query('SELECT * FROM handoffs WHERE id = ?', (handoff_id,), one=True)
    if not handoff:
        return jsonify({'error': 'Handoff not found'}), 404

    if handoff['status'] not in ('draft',) and handoff['sender_id'] != current_user.id:
        return jsonify({'error': 'Can only edit your own draft handoffs'}), 403

    updatable = [
        'illness_severity', 'code_status', 'one_liner', 'hpi_summary',
        'pertinent_pmh', 'key_meds', 'key_labs', 'key_imaging',
        'contingency_plan', 'what_to_watch', 'anticipated_changes',
        'receiver_id', 'shift_id',
        'sbar_situation', 'sbar_background', 'sbar_assessment', 'sbar_recommendation',
    ]
    sets = []
    args = []
    for field in updatable:
        if field in data:
            sets.append(f'{field} = ?')
            args.append(data[field])

    if not sets:
        return jsonify({'error': 'No fields to update'}), 400

    sets.append("updated_at = datetime('now')")
    args.append(handoff_id)
    execute(f"UPDATE handoffs SET {', '.join(sets)} WHERE id = ?", args)

    # Audit
    execute(
        "INSERT INTO audit_log (user_id, action, resource_type, resource_id, ip_address) VALUES (?, 'update', 'handoff', ?, ?)",
        (current_user.id, handoff_id, request.remote_addr),
    )

    updated = query('SELECT * FROM handoffs WHERE id = ?', (handoff_id,), one=True)
    return jsonify(updated)


@bp.route('/handoffs/<int:handoff_id>/send', methods=['POST'])
@login_required
def send_handoff(handoff_id):
    """Send a handoff to the receiver."""
    data = request.get_json() or {}

    handoff = query('SELECT * FROM handoffs WHERE id = ?', (handoff_id,), one=True)
    if not handoff:
        return jsonify({'error': 'Handoff not found'}), 404

    if handoff['sender_id'] != current_user.id:
        return jsonify({'error': 'Only the sender can send this handoff'}), 403

    if handoff['status'] != 'draft':
        return jsonify({'error': 'Handoff already sent'}), 400

    receiver_id = data.get('receiver_id') or handoff['receiver_id']
    if not receiver_id:
        return jsonify({'error': 'receiver_id required'}), 400

    execute('''
        UPDATE handoffs
        SET status = 'sent', receiver_id = ?, sent_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
    ''', (receiver_id, handoff_id))

    execute(
        "INSERT INTO audit_log (user_id, action, resource_type, resource_id, details) VALUES (?, 'send', 'handoff', ?, ?)",
        (current_user.id, handoff_id, f'Sent to user {receiver_id}'),
    )

    updated = query('SELECT * FROM handoffs WHERE id = ?', (handoff_id,), one=True)
    return jsonify(updated)


@bp.route('/handoffs/<int:handoff_id>/acknowledge', methods=['POST'])
@login_required
def acknowledge_handoff(handoff_id):
    """Receiver acknowledges receipt of handoff."""
    handoff = query('SELECT * FROM handoffs WHERE id = ?', (handoff_id,), one=True)
    if not handoff:
        return jsonify({'error': 'Handoff not found'}), 404

    if handoff['receiver_id'] != current_user.id:
        return jsonify({'error': 'Only the designated receiver can acknowledge'}), 403

    if handoff['status'] != 'sent':
        return jsonify({'error': 'Handoff must be in sent status'}), 400

    execute('''
        UPDATE handoffs
        SET status = 'acknowledged', acknowledged_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
    ''', (handoff_id,))

    # Update metrics — interactive communication
    execute('''
        UPDATE handoff_metrics SET interactive_communication = 1 WHERE handoff_id = ?
    ''', (handoff_id,))

    execute(
        "INSERT INTO audit_log (user_id, action, resource_type, resource_id) VALUES (?, 'acknowledge', 'handoff', ?)",
        (current_user.id, handoff_id),
    )

    updated = query('SELECT * FROM handoffs WHERE id = ?', (handoff_id,), one=True)
    return jsonify(updated)


@bp.route('/handoffs/<int:handoff_id>/verify', methods=['POST'])
@login_required
def verify_handoff(handoff_id):
    """Receiver verifies with read-back (synthesis)."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    handoff = query('SELECT * FROM handoffs WHERE id = ?', (handoff_id,), one=True)
    if not handoff:
        return jsonify({'error': 'Handoff not found'}), 404

    if handoff['receiver_id'] != current_user.id:
        return jsonify({'error': 'Only the designated receiver can verify'}), 403

    if handoff['status'] not in ('sent', 'acknowledged'):
        return jsonify({'error': 'Handoff must be sent or acknowledged'}), 400

    receiver_summary = data.get('receiver_summary', '')
    questions = data.get('questions_asked', '')
    verification = data.get('verification_status', 'verified')

    if verification not in ('verified', 'clarification_needed'):
        return jsonify({'error': 'Invalid verification_status'}), 400

    new_status = 'verified' if verification == 'verified' else 'acknowledged'

    execute('''
        UPDATE handoffs
        SET status = ?, verification_status = ?,
            receiver_summary = ?, questions_asked = ?,
            verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
    ''', (new_status, verification, receiver_summary, questions, handoff_id))

    # Update metrics — verification + documentation
    started = handoff['started_at'] or handoff['created_at']
    execute('''
        UPDATE handoff_metrics
        SET verification_completed = ?,
            documentation_complete = 1,
            handoff_duration_seconds = CAST((julianday('now') - julianday(?)) * 86400 AS INTEGER)
        WHERE handoff_id = ?
    ''', (1 if verification == 'verified' else 0, started, handoff_id))

    execute(
        "INSERT INTO audit_log (user_id, action, resource_type, resource_id, details) VALUES (?, 'verify', 'handoff', ?, ?)",
        (current_user.id, handoff_id, verification),
    )

    updated = query('SELECT * FROM handoffs WHERE id = ?', (handoff_id,), one=True)
    return jsonify(updated)


# --- Action Items ---

@bp.route('/handoffs/<int:handoff_id>/actions')
@login_required
def list_actions(handoff_id):
    """List action items for a handoff."""
    actions = query('''
        SELECT ai.*,
               a.display_name as assigned_name,
               c.display_name as completer_name
        FROM action_items ai
        LEFT JOIN users a ON ai.assigned_to = a.id
        LEFT JOIN users c ON ai.completed_by = c.id
        WHERE ai.handoff_id = ?
        ORDER BY
            CASE ai.priority WHEN 'stat' THEN 1 WHEN 'urgent' THEN 2 ELSE 3 END,
            ai.created_at
    ''', (handoff_id,))
    return jsonify(actions)


@bp.route('/handoffs/<int:handoff_id>/actions', methods=['POST'])
@login_required
def create_action(handoff_id):
    """Add an action item to a handoff."""
    data = request.get_json()
    if not data or not data.get('description'):
        return jsonify({'error': 'description is required'}), 400

    priority = data.get('priority', 'routine')
    if priority not in ('stat', 'urgent', 'routine'):
        return jsonify({'error': 'Invalid priority'}), 400

    cur = execute('''
        INSERT INTO action_items (handoff_id, description, priority, due_by, assigned_to)
        VALUES (?, ?, ?, ?, ?)
    ''', (handoff_id, data['description'], priority, data.get('due_by'), data.get('assigned_to')))

    # Update metrics count
    execute('''
        UPDATE handoff_metrics
        SET action_items_count = (SELECT COUNT(*) FROM action_items WHERE handoff_id = ?)
        WHERE handoff_id = ?
    ''', (handoff_id, handoff_id))

    action = query('SELECT * FROM action_items WHERE id = ?', (cur.lastrowid,), one=True)
    return jsonify(action), 201


@bp.route('/actions/<int:action_id>/complete', methods=['PUT'])
@login_required
def complete_action(action_id):
    """Mark an action item as complete."""
    action = query('SELECT * FROM action_items WHERE id = ?', (action_id,), one=True)
    if not action:
        return jsonify({'error': 'Action item not found'}), 404

    execute('''
        UPDATE action_items
        SET completed = 1, completed_at = datetime('now'), completed_by = ?
        WHERE id = ?
    ''', (current_user.id, action_id))

    # Update metrics
    execute('''
        UPDATE handoff_metrics
        SET action_items_completed = (
            SELECT COUNT(*) FROM action_items WHERE handoff_id = ? AND completed = 1
        )
        WHERE handoff_id = ?
    ''', (action['handoff_id'], action['handoff_id']))

    execute(
        "INSERT INTO audit_log (user_id, action, resource_type, resource_id) VALUES (?, 'complete_action', 'action_item', ?)",
        (current_user.id, action_id),
    )

    updated = query('SELECT * FROM action_items WHERE id = ?', (action_id,), one=True)
    return jsonify(updated)

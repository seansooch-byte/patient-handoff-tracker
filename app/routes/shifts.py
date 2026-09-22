"""Shift API: the current shift and who is on it."""

from flask import Blueprint, jsonify
from flask_login import login_required

from ..db import query

bp = Blueprint('shifts', __name__, url_prefix='/api')


@bp.route('/shifts/current')
@login_required
def current_shift():
    """The latest shift with its team, supervisor first. Feeds the board strip, the roster and the
    receiver list on the handoff forms, so a handoff can always name who reads it back."""
    shift = query(
        '''SELECT id, shift_type, start_time, end_time, department
           FROM shifts ORDER BY start_time DESC, id DESC LIMIT 1''',
        one=True,
    )
    if not shift:
        return jsonify({'error': 'No shift on file'}), 404

    shift['team'] = query(
        '''SELECT u.id AS user_id, u.display_name, u.role, sa.assignment_role, sa.zone
           FROM shift_assignments sa
           JOIN users u ON u.id = sa.user_id
           WHERE sa.shift_id = ? AND u.is_active = 1
           ORDER BY CASE sa.assignment_role
                      WHEN 'supervisor' THEN 1 WHEN 'primary' THEN 2 ELSE 3 END,
                    sa.id''',
        (shift['id'],),
    )
    return jsonify(shift)

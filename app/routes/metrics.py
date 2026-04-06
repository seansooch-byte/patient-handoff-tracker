"""QI Metrics API — aggregated handoff quality data for the dashboard."""

from flask import Blueprint, jsonify, request
from flask_login import login_required

from ..db import query

bp = Blueprint('metrics', __name__, url_prefix='/api')


@bp.route('/metrics/summary')
@login_required
def metrics_summary():
    """Aggregated QI dashboard data."""

    # Total handoffs by status
    status_counts = query('''
        SELECT status, COUNT(*) as count
        FROM handoffs
        GROUP BY status
    ''')

    # Total handoffs by type
    type_counts = query('''
        SELECT handoff_type, COUNT(*) as count
        FROM handoffs
        GROUP BY handoff_type
    ''')

    # Compliance rates from metrics table
    compliance = query('''
        SELECT
            COUNT(*) as total,
            SUM(used_standardized_format) as standardized,
            SUM(interactive_communication) as interactive,
            SUM(verification_completed) as verified,
            SUM(documentation_complete) as documented,
            AVG(handoff_duration_seconds) as avg_duration,
            SUM(action_items_count) as total_actions,
            SUM(action_items_completed) as completed_actions
        FROM handoff_metrics
    ''', one=True)

    # Handoffs over time (by day)
    over_time = query('''
        SELECT
            date(created_at) as day,
            COUNT(*) as count,
            SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified
        FROM handoffs
        GROUP BY date(created_at)
        ORDER BY day
    ''')

    # Severity distribution
    severity = query('''
        SELECT illness_severity, COUNT(*) as count
        FROM handoffs
        GROUP BY illness_severity
    ''')

    # Confidence scores (from surveys)
    confidence = query('''
        SELECT
            AVG(sender_confidence) as avg_sender,
            AVG(receiver_confidence) as avg_receiver,
            AVG(perceived_completeness) as avg_completeness,
            COUNT(sender_confidence) as survey_count
        FROM handoff_metrics
        WHERE sender_confidence IS NOT NULL
    ''', one=True)

    # Adverse events
    outcomes = query('''
        SELECT
            SUM(adverse_event_within_shift) as adverse_events,
            SUM(bounce_back) as bounce_backs,
            SUM(near_miss) as near_misses
        FROM handoff_metrics
    ''', one=True)

    return jsonify({
        'status_counts': {r['status']: r['count'] for r in status_counts},
        'type_counts': {r['handoff_type']: r['count'] for r in type_counts},
        'compliance': compliance,
        'over_time': over_time,
        'severity': {r['illness_severity']: r['count'] for r in severity},
        'confidence': confidence,
        'outcomes': outcomes,
    })


@bp.route('/metrics/export')
@login_required
def export_csv():
    """Export metrics as CSV for statistical analysis."""
    rows = query('''
        SELECT
            h.id as handoff_id,
            h.handoff_type,
            h.illness_severity,
            h.status,
            h.created_at,
            h.sent_at,
            h.verified_at,
            p.acuity,
            p.disposition,
            m.used_standardized_format,
            m.interactive_communication,
            m.verification_completed,
            m.documentation_complete,
            m.handoff_duration_seconds,
            m.action_items_count,
            m.action_items_completed,
            m.sender_confidence,
            m.receiver_confidence,
            m.perceived_completeness,
            m.adverse_event_within_shift,
            m.bounce_back,
            m.near_miss
        FROM handoffs h
        JOIN patients p ON h.patient_id = p.id
        LEFT JOIN handoff_metrics m ON m.handoff_id = h.id
        ORDER BY h.created_at
    ''')

    if not rows:
        return 'No data', 404

    headers = list(rows[0].keys())
    lines = [','.join(headers)]
    for row in rows:
        lines.append(','.join(str(row[h] or '') for h in headers))

    csv_content = '\n'.join(lines)
    return csv_content, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=handoff_metrics.csv',
    }

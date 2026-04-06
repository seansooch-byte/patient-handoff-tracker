-- Performance indexes

CREATE INDEX IF NOT EXISTS idx_handoffs_patient ON handoffs(patient_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_shift ON handoffs(shift_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_sender ON handoffs(sender_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_status ON handoffs(status);
CREATE INDEX IF NOT EXISTS idx_action_items_handoff ON action_items(handoff_id);
CREATE INDEX IF NOT EXISTS idx_action_items_assigned ON action_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_patients_active ON patients(is_active);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_shift ON shift_assignments(shift_id);
CREATE INDEX IF NOT EXISTS idx_handoff_metrics_handoff ON handoff_metrics(handoff_id);

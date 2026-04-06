-- Synthetic seed data for development
-- All patient data is fictional. No real PHI.

-- Users (password is 'demo' for all — hashed via werkzeug in seed script)
-- Inserted by scripts/seed_db.py, not here, because we need werkzeug hashing

-- Shift
INSERT INTO shifts (shift_type, start_time, end_time, department, created_by)
VALUES ('night', '2026-04-05 19:00:00', '2026-04-06 07:00:00', 'emergency', 1);

-- Shift assignments
INSERT INTO shift_assignments (shift_id, user_id, assignment_role, zone) VALUES (1, 1, 'supervisor', NULL);
INSERT INTO shift_assignments (shift_id, user_id, assignment_role, zone) VALUES (1, 2, 'primary', 'A');
INSERT INTO shift_assignments (shift_id, user_id, assignment_role, zone) VALUES (1, 3, 'primary', 'B');
INSERT INTO shift_assignments (shift_id, user_id, assignment_role, zone) VALUES (1, 4, 'secondary', 'A');

-- Patients (8 synthetic EM patients across ESI 1-5)
INSERT INTO patients (mrn, display_name, age, sex, chief_complaint, room_bed, arrival_time, acuity, disposition, created_by)
VALUES
('4829103', 'Martinez, R.', 67, 'M', 'STEMI — cath lab activated, on heparin drip, cardiology en route', 'T1', '2026-04-05 18:42:00', 1, 'admit', 1),
('7391024', 'Johnson, T.', 45, 'F', 'MVC with LOC, GCS 11 on arrival, CT head pending, c-collar in place', 'T2', '2026-04-05 20:15:00', 1, 'undecided', 1),
('5520381', 'Williams, A.', 78, 'M', 'Acute on chronic CHF exacerbation, BiPAP initiated, BNP 2400, troponin negative x2', '12', '2026-04-05 17:30:00', 2, 'admit', 1),
('8843210', 'Chen, L.', 52, 'F', 'Sepsis — lactate 4.2, blood cultures drawn, broad-spectrum abx started, 2L NS given', '08', '2026-04-05 19:45:00', 2, 'admit', 2),
('6617892', 'Patel, S.', 34, 'M', 'RLQ pain, CT showing acute appendicitis, surgery consulted, NPO, morphine given', '15', '2026-04-05 21:00:00', 3, 'admit', 2),
('9920147', 'Davis, K.', 28, 'F', 'Asthma exacerbation, continuous nebs x3, O2 sat 92% on RA improving to 96% post-treatment', '20', '2026-04-05 22:10:00', 3, 'observe', 3),
('3310458', 'Brown, J.', 42, 'M', 'Laceration R forearm, 6cm, cleaned and sutured, tetanus updated, follow-up PCP 10 days', '22', '2026-04-05 20:30:00', 4, 'discharge', 3),
('7712033', 'Garcia, M.', 55, 'F', 'UTI with flank pain, UA positive, urine culture sent, cipro started, tolerating PO fluids', '18', '2026-04-05 21:45:00', 4, 'discharge', 2);

-- Handoffs (3 at various statuses)
INSERT INTO handoffs (patient_id, shift_id, sender_id, receiver_id, illness_severity, code_status,
    one_liner, hpi_summary, pertinent_pmh, key_meds, key_labs, key_imaging,
    contingency_plan, what_to_watch, anticipated_changes,
    handoff_type, status, sent_at)
VALUES
(1, 1, 1, 2, 'critical', 'Full Code',
 '67M presenting with acute STEMI, cath lab activated, on heparin drip',
 'Presented with acute onset substernal chest pain radiating to left arm x2 hours. ECG showed ST elevation in leads II, III, aVF. Troponin I 2.4 (elevated). Heparin drip started, aspirin and Plavix loaded. Cath lab activated — ETA 45 min. Hemodynamically stable on arrival, BP 138/82, HR 88.',
 'HTN, HLD, DM2, prior PCI 2019 (LAD stent)',
 'Heparin drip (per protocol), ASA 325mg, Plavix 600mg load, metoprolol 25mg, atorvastatin 80mg',
 'Trop I 2.4 (H), BMP wnl, Cr 1.1, CBC wnl, INR 1.0, PTT pending (on heparin)',
 'CXR: mild cardiomegaly, no acute process. ECG: ST elevation II, III, aVF — inferior STEMI.',
 'If hypotensive (SBP < 90): hold metoprolol, bolus 500mL NS, call cardiology. If chest pain recurs or ST changes worsen: stat 12-lead ECG, notify cath lab for expedited procedure.',
 'Hemodynamic instability (inferior STEMI can cause RV dysfunction), bradycardia, arrhythmias. Monitor for signs of cardiogenic shock.',
 'Expect cath lab within 60-90 min. Post-procedure: transfer to CCU. May need IABP if hemodynamically unstable. Cardiology fellow (Dr. Kumar, pager 4421) managing.',
 'ipass', 'sent', '2026-04-05 23:30:00'),

(2, 1, 1, NULL, 'critical', 'Full Code',
 '45F MVC with LOC, GCS 11, CT pending',
 'Brought in by EMS after high-speed MVC. LOC at scene. GCS 11 (E3V3M5) on arrival. C-collar in place. Primary survey: airway intact, breathing symmetric, tachycardic to 110. FAST negative. CT head/c-spine ordered.',
 'No known PMH per EMS report',
 'NS 1L wide open, no meds yet pending imaging',
 'CBC, BMP, type and screen sent. Coags pending.',
 'CT head and c-spine pending.',
 'If GCS drops below 8: RSI for airway protection, call anesthesia. If FAST becomes positive: activate trauma surgery.',
 'Declining GCS, pupil asymmetry, hemodynamic instability.',
 'Awaiting CT results. If negative: serial neuro checks q1h. If positive: neurosurgery consult.',
 'ipass', 'draft', NULL),

(3, 1, 1, 2, 'serious', 'Full Code',
 '78M acute on chronic CHF exacerbation on BiPAP, BNP 2400',
 'Presenting with worsening dyspnea x2 days, orthopnea, and bilateral LE edema. BiPAP initiated in field. BNP 2400. Troponin negative x2. CXR shows bilateral pleural effusions and pulmonary edema. Given furosemide 40mg IV with 800mL UOP so far.',
 'CHF (EF 30%), AF on apixaban, CKD3, COPD',
 'BiPAP 12/5, furosemide 40mg IV given, home apixaban held, home metoprolol continued',
 'BNP 2400, Trop neg x2, Cr 1.8 (baseline 1.5), K 4.2, BG 145',
 'CXR: bilateral pleural effusions, pulmonary edema, cardiomegaly.',
 'If O2 requirement increases or BiPAP fails: call RT for intubation setup, notify ICU. If new AF with RVR: diltiazem drip.',
 'Respiratory status (BiPAP tolerance), urine output (target >0.5mL/kg/hr), renal function.',
 'Admit to telemetry. Cardiology consulted, will see in AM. Continue diuresis. Repeat BMP in 6h.',
 'ipass', 'acknowledged', '2026-04-05 22:45:00');

-- Action items for handoff 1 (STEMI patient)
INSERT INTO action_items (handoff_id, description, priority, due_by, assigned_to)
VALUES
(1, 'Check PTT in 2 hours (target 60-80), adjust heparin per protocol', 'stat', '2026-04-06 01:30:00', 2),
(1, 'Serial troponins q6h — next due 00:42', 'urgent', '2026-04-06 00:42:00', 2),
(1, 'Follow up with cath lab for procedure timing update', 'urgent', NULL, 2);

-- Mark one action as completed
UPDATE action_items SET completed = 1, completed_at = '2026-04-05 23:45:00', completed_by = 2 WHERE id = 3;

-- Action items for handoff 3 (CHF patient)
INSERT INTO action_items (handoff_id, description, priority, due_by, assigned_to)
VALUES
(3, 'Repeat BMP in 6 hours (due ~04:45)', 'urgent', '2026-04-06 04:45:00', 2),
(3, 'Monitor UOP — target >0.5mL/kg/hr, call if <30mL/hr', 'urgent', NULL, 4),
(3, 'Cardiology will round in AM — have latest echo on file', 'routine', NULL, 2);

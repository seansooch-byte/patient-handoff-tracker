/**
 * Handoff forms (I-PASS and SBAR share this file; the form's data-type picks the fields).
 * Loads the patient label, the receiver list from the current shift, and posts the handoff
 * as a draft or sent. Sending needs a named receiver, because only that person can read it back.
 */

const form = document.getElementById('handoff-form');
const TYPE = form.dataset.type;
const patientId = new URLSearchParams(window.location.search).get('patient');
let shiftId = null;

async function initSheetForm() {
  document.querySelectorAll('[data-framework]').forEach(a => {
    if (patientId) a.href += '?patient=' + encodeURIComponent(patientId);
  });
  wireIndex();

  if (!patientId) {
    document.getElementById('patient-bar').innerHTML =
      '<div class="pt"><div class="pt-name">No patient selected</div><div class="ids">Open a chart from the board to start a handoff.</div></div>';
  } else {
    try {
      const p = await api.get('/api/patients/' + encodeURIComponent(patientId));
      const bar = document.getElementById('patient-bar');
      bar.classList.remove('loading');
      bar.innerHTML = chartLabelHtml(p);
      const radio = form.querySelector(`input[name="severity"][value="${acuityOf(p.acuity).key}"]`);
      if (radio) radio.checked = true;
    } catch (err) {
      flash('Could not load the patient: ' + err.message);
    }
  }

  const shift = await fillReceivers(document.getElementById('receiver'));
  shiftId = shift?.id || null;
}

// Action list rows (I-PASS only)
function addActionRow() {
  const row = document.createElement('div');
  row.className = 'action-row';
  row.innerHTML = `
    <input type="text" class="input" name="action" placeholder="Describe the action item..." aria-label="Action item">
    <select class="select" name="action_priority" aria-label="Priority">
      <option value="stat">STAT</option>
      <option value="urgent">Urgent</option>
      <option value="routine" selected>Routine</option>
    </select>
    <button type="button" class="remove" title="Remove" aria-label="Remove action item">&times;</button>`;
  document.getElementById('action-items').appendChild(row);
  row.querySelector('.input').focus();
}

form.addEventListener('click', (e) => {
  if (e.target.closest('#add-action')) addActionRow();
  const remove = e.target.closest('.action-row .remove');
  if (remove) remove.closest('.action-row').remove();
});

const val = (id) => (document.getElementById(id)?.value || '').trim();

function payload(status) {
  const base = {
    patient_id: parseInt(patientId, 10),
    shift_id: shiftId,
    receiver_id: parseInt(val('receiver'), 10) || null,
    illness_severity: form.querySelector('input[name="severity"]:checked')?.value || 'watch',
    handoff_type: TYPE,
    status,
  };
  if (TYPE === 'sbar') {
    const situation = val('situation');
    return {
      ...base,
      one_liner: situation.substring(0, 200),
      sbar_situation: situation,
      sbar_background: val('background'),
      sbar_assessment: val('assessment'),
      sbar_recommendation: val('recommendation'),
      action_items: [],
    };
  }
  const rows = [...form.querySelectorAll('.action-row')];
  return {
    ...base,
    code_status: val('code-status'),
    one_liner: val('one-liner'),
    hpi_summary: val('hpi'),
    pertinent_pmh: val('pmh'),
    key_meds: val('meds'),
    key_labs: val('labs'),
    key_imaging: val('imaging'),
    contingency_plan: val('contingency'),
    what_to_watch: val('watch-for'),
    anticipated_changes: val('anticipated'),
    action_items: rows
      .map(r => ({ description: r.querySelector('[name="action"]').value.trim(), priority: r.querySelector('[name="action_priority"]').value }))
      .filter(a => a.description),
  };
}

function problem(data) {
  if (!patientId) return 'No patient selected.';
  if (!data.one_liner) return TYPE === 'sbar' ? 'Situation is required.' : 'One-liner is required.';
  if (data.status === 'sent' && !data.receiver_id) return 'Choose the receiving provider before sending.';
  return null;
}

async function submitHandoff(status) {
  const data = payload(status);
  const why = problem(data);
  if (why) {
    flash(why);
    document.getElementById('form-status').textContent = why;
    const target = !data.one_liner ? (TYPE === 'sbar' ? 'situation' : 'one-liner') : 'receiver';
    document.getElementById(target)?.focus();
    return;
  }
  const buttons = form.querySelectorAll('.sheet-foot button');
  buttons.forEach(b => { b.disabled = true; });
  document.getElementById('form-status').textContent = status === 'sent' ? 'Sending...' : 'Saving draft...';
  try {
    const result = await api.post('/api/handoffs', data);
    window.location.href = '/handoff/' + result.id;
  } catch (err) {
    flash(err.message);
    buttons.forEach(b => { b.disabled = false; });
    document.getElementById('form-status').textContent = 'Not saved.';
  }
}

form.addEventListener('submit', (e) => { e.preventDefault(); submitHandoff('sent'); });
document.getElementById('save-draft').addEventListener('click', () => submitHandoff('draft'));

initSheetForm();

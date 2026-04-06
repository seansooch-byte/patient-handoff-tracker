/**
 * Handoff Form — loads patient data, submits I-PASS handoff to API.
 */

let currentPatientId = null;

async function initHandoffForm() {
  // Get patient ID from URL
  const params = new URLSearchParams(window.location.search);
  currentPatientId = params.get('patient');

  if (currentPatientId) {
    await loadPatientInfo(currentPatientId);
  }

  // Load team members for receiver dropdown
  await loadReceivers();
}

async function loadPatientInfo(patientId) {
  try {
    const patient = await api.get('/api/patients/' + patientId);
    const bar = document.getElementById('patient-bar');
    if (!bar) return;

    const sevMap = {1:'critical',2:'serious',3:'watch',4:'stable',5:'stable'};
    const sevLabel = {1:'Critical',2:'Serious',3:'Watch',4:'Stable',5:'Stable'};
    const sev = sevMap[patient.acuity] || 'stable';

    bar.innerHTML = `
      <div class="handoff-patient-info">
        <div>
          <div class="handoff-patient-name">${esc(patient.display_name)}</div>
          <div class="handoff-patient-details">
            <span>${patient.age || ''}${patient.sex || ''}</span>
            <span>MRN ${esc(patient.mrn)}</span>
            <span>Room ${esc(patient.room_bed || '')}</span>
            <span class="badge badge-${sev}">${sevLabel[patient.acuity] || 'Stable'}</span>
          </div>
        </div>
      </div>
      <div style="text-align:right; font-size: var(--fs-xs); color: var(--text-muted);">
        <div>Chief Complaint</div>
        <div style="color: var(--text); font-size: var(--fs-sm);">${esc(patient.chief_complaint || 'N/A')}</div>
      </div>`;

    // Pre-select severity based on acuity
    const sevValue = sev === 'watch' ? 'watch' : sev;
    const radio = document.querySelector(`input[name="severity"][value="${sevValue}"]`);
    if (radio) radio.checked = true;

  } catch (err) {
    console.error('Failed to load patient:', err);
  }
}

async function loadReceivers() {
  // For now, we'll use a simple approach — future: load from shift assignments
}

// Add action item
document.addEventListener('click', function(e) {
  if (e.target.id === 'add-action' || e.target.closest('#add-action')) {
    const list = document.getElementById('action-items');
    const row = document.createElement('div');
    row.className = 'action-item-row';
    row.innerHTML = `
      <input type="text" class="form-input" name="action[]" placeholder="Describe the action item...">
      <select class="form-select" name="action_priority[]">
        <option value="stat">STAT</option>
        <option value="urgent">Urgent</option>
        <option value="routine" selected>Routine</option>
      </select>
      <button type="button" class="action-item-remove" title="Remove">&times;</button>`;
    list.appendChild(row);
    row.querySelector('.form-input').focus();
  }

  if (e.target.classList.contains('action-item-remove')) {
    e.target.closest('.action-item-row').remove();
  }
});

// Form submission
document.getElementById('handoff-form')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  await submitHandoff('sent');
});

// Save draft
document.getElementById('save-draft')?.addEventListener('click', async function() {
  await submitHandoff('draft');
});

async function submitHandoff(status) {
  const form = document.getElementById('handoff-form');
  if (!currentPatientId) {
    alert('No patient selected');
    return;
  }

  // Collect action items
  const actionInputs = form.querySelectorAll('input[name="action[]"]');
  const priorityInputs = form.querySelectorAll('select[name="action_priority[]"]');
  const actionItems = [];
  actionInputs.forEach((input, i) => {
    if (input.value.trim()) {
      actionItems.push({
        description: input.value.trim(),
        priority: priorityInputs[i]?.value || 'routine',
      });
    }
  });

  const data = {
    patient_id: parseInt(currentPatientId),
    illness_severity: form.querySelector('input[name="severity"]:checked')?.value || 'stable',
    code_status: form.querySelector('#code-status')?.value,
    one_liner: form.querySelector('#one-liner')?.value || '',
    hpi_summary: form.querySelector('#hpi')?.value,
    pertinent_pmh: form.querySelector('#pmh')?.value,
    key_meds: form.querySelector('#meds')?.value,
    key_labs: form.querySelector('#labs')?.value,
    key_imaging: form.querySelector('#imaging')?.value,
    contingency_plan: form.querySelector('#contingency')?.value,
    what_to_watch: form.querySelector('#watch-for')?.value,
    anticipated_changes: form.querySelector('#anticipated')?.value,
    handoff_type: 'ipass',
    status: status,
    action_items: actionItems,
  };

  if (!data.one_liner) {
    alert('One-liner is required');
    return;
  }

  try {
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = status === 'sent' ? 'Sending...' : 'Saving...';

    const result = await api.post('/api/handoffs', data);
    window.location.href = '/handoff/' + result.id;
  } catch (err) {
    alert('Error: ' + err.message);
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = false;
    btn.textContent = 'Send Handoff';
  }
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', initHandoffForm);

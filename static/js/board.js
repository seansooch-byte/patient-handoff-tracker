/**
 * Patient Board — loads patients from API, renders cards, handles filters.
 */

const SEVERITY_MAP = { 1: 'critical', 2: 'serious', 3: 'watch', 4: 'stable', 5: 'stable' };
const SEVERITY_LABEL = { 1: 'Critical', 2: 'Serious', 3: 'Watch', 4: 'Stable', 5: 'Stable' };

let allPatients = [];
let activeFilter = 'all';

async function loadBoard() {
  try {
    const [patients, stats] = await Promise.all([
      api.get('/api/patients'),
      api.get('/api/patients/stats'),
    ]);
    allPatients = patients;
    renderStats(stats);
    renderPatients(patients);
  } catch (err) {
    console.error('Failed to load board:', err);
    document.getElementById('patient-grid').innerHTML =
      '<div class="empty-state"><h3>Failed to load patients</h3><p>' + err.message + '</p></div>';
  }
}

function renderStats(stats) {
  const el = document.getElementById('board-stats');
  if (el) {
    el.innerHTML = `
      <span><strong>${stats.total}</strong> patients</span>
      <span><strong>${stats.critical}</strong> critical</span>
      <span><strong>${stats.pending_handoffs}</strong> pending handoffs</span>
    `;
  }
}

function renderPatients(patients) {
  const grid = document.getElementById('patient-grid');
  if (!patients.length) {
    grid.innerHTML = '<div class="empty-state"><h3>No patients</h3><p>Add a patient to get started.</p></div>';
    return;
  }

  grid.innerHTML = patients.map(p => renderPatientCard(p)).join('');
}

function renderPatientCard(p) {
  const sev = SEVERITY_MAP[p.acuity] || 'stable';
  const sevLabel = SEVERITY_LABEL[p.acuity] || 'Stable';
  const dispClass = p.disposition || 'undecided';
  const dispLabel = (p.disposition || 'undecided').charAt(0).toUpperCase() + (p.disposition || 'undecided').slice(1);

  // Format arrival time
  let arrivalStr = '';
  if (p.arrival_time) {
    const d = new Date(p.arrival_time);
    arrivalStr = 'Arrived ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Handoff indicator
  let handoffHtml = '';
  if (p.handoff_status) {
    const statusMap = {
      draft: { cls: 'draft', icon: 'D', label: 'Draft' },
      sent: { cls: 'sent', icon: 'S', label: 'Sent' },
      acknowledged: { cls: 'sent', icon: 'A', label: 'Acknowledged' },
      verified: { cls: 'verified', icon: 'V', label: 'Verified' },
    };
    const s = statusMap[p.handoff_status] || statusMap.draft;
    handoffHtml = `
      <div class="handoff-indicator ${s.cls}">
        <span class="status-icon">${s.icon}</span>
        <span>${s.label}</span>
      </div>`;
  }

  // Action items
  let actionsHtml = '';
  if (p.pending_actions > 0) {
    actionsHtml = `<div class="patient-actions-count"><span class="dot"></span> ${p.pending_actions} action${p.pending_actions > 1 ? 's' : ''} pending</div>`;
  } else if (p.completed_actions > 0) {
    actionsHtml = `<div class="patient-actions-count"><span class="dot done"></span> ${p.completed_actions} action${p.completed_actions > 1 ? 's' : ''} done</div>`;
  }

  return `
    <div class="patient-card acuity-${p.acuity}" onclick="location.href='/handoff/new?patient=${p.id}'">
      <div class="patient-card-header">
        <div>
          <div class="patient-name">${esc(p.display_name)}</div>
          <div class="patient-meta">
            <span>${p.age || ''}${p.sex || ''}</span>
            <span>MRN ${esc(p.mrn)}</span>
            ${arrivalStr ? `<span>${arrivalStr}</span>` : ''}
          </div>
        </div>
        <span class="patient-room">${esc(p.room_bed || '')}</span>
      </div>
      <div class="patient-complaint">${esc(p.chief_complaint || '')}</div>
      <div class="patient-card-footer">
        <div style="display:flex; gap: var(--sp-2);">
          <span class="badge badge-${sev}">${sevLabel}</span>
          <span class="badge badge-${dispClass}">${dispLabel}</span>
        </div>
        ${handoffHtml || actionsHtml}
      </div>
    </div>`;
}

// Filter handling
function setFilter(filter) {
  activeFilter = filter;

  // Update filter chip styles
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === filter);
  });

  // Filter patients
  let filtered = allPatients;
  if (filter !== 'all') {
    const filterMap = {
      critical: p => p.acuity <= 1,
      serious: p => p.acuity === 2,
      stable: p => p.acuity >= 4,
      watch: p => p.acuity === 3,
      admit: p => p.disposition === 'admit',
      discharge: p => p.disposition === 'discharge',
      undecided: p => p.disposition === 'undecided',
      observe: p => p.disposition === 'observe',
    };
    const fn = filterMap[filter];
    if (fn) filtered = allPatients.filter(fn);
  }

  renderPatients(filtered);
}

// HTML escape
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Init on page load
document.addEventListener('DOMContentLoaded', loadBoard);

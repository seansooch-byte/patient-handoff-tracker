/**
 * Patient board: the chart rack. Loads patients, the census and the shift, renders one folder per
 * patient, filters, and adds new (synthetic) patients.
 *
 * A folder opens the patient's latest handoff if there is one, otherwise a new I-PASS handoff.
 * "Next handoff" walks the rack in acuity order to the first chart not yet handed off.
 */

const FILTERS = {
  all: () => true,
  critical: p => p.acuity <= 1,
  serious: p => p.acuity === 2,
  watch: p => p.acuity === 3,
  stable: p => p.acuity >= 4,
  admit: p => p.disposition === 'admit',
  discharge: p => p.disposition === 'discharge',
  undecided: p => p.disposition === 'undecided',
};

const STATUS_LABEL = { draft: 'Draft', sent: 'Sent', acknowledged: 'Acknowledged', verified: 'Verified' };

let allPatients = [];
let activeFilter = 'all';

async function loadBoard() {
  try {
    const [patients, stats] = await Promise.all([
      api.get('/api/patients'),
      api.get('/api/patients/stats'),
    ]);
    allPatients = patients;
    renderCensus(stats);
    renderCounts();
    renderPatients();
    wireNextHandoff();
  } catch (err) {
    document.getElementById('patient-grid').innerHTML =
      `<div class="empty"><h3>Could not load the board</h3><p>${esc(err.message)}</p></div>`;
  }
  renderShift(await currentShift());
}

function renderShift(shift) {
  const el = document.getElementById('shift-strip');
  if (!shift) {
    el.innerHTML = '<span class="shift-name">No shift on file</span><a class="btn sm roster-link" href="/shifts">Roster</a>';
    return;
  }
  const team = shift.team.map(m => `
      <span class="initials${m.assignment_role === 'supervisor' ? ' lead' : ''}"
            title="${esc(m.display_name)} (${esc(ROLE_LABEL[m.role] || m.role)}${m.zone ? ', zone ' + esc(m.zone) : ''})">${esc(initialsOf(m.display_name))}</span>`).join('');
  el.innerHTML = `
    <span class="shift-name">${esc(cap(shift.shift_type))} shift</span>
    <span class="shift-time">${clock(shift.start_time)} to ${clock(shift.end_time)}</span>
    <span class="sep" aria-hidden="true"></span>
    <span>${esc(cap(shift.department))}</span>
    <span class="sep" aria-hidden="true"></span>
    <span class="team" aria-label="Team on shift">${team}</span>
    <a class="btn sm roster-link" href="/shifts">Roster</a>`;
}

function renderCensus(stats) {
  document.getElementById('board-stats').innerHTML = `
    <span><b>${stats.total}</b>patients</span>
    <span class="${stats.critical ? 'hot' : ''}"><b>${stats.critical}</b>critical</span>
    <span><b>${stats.pending_handoffs}</b>pending handoffs</span>`;
}

function renderCounts() {
  document.querySelectorAll('.chip[data-filter]').forEach(chip => {
    const n = allPatients.filter(FILTERS[chip.dataset.filter]).length;
    chip.querySelector('.n')?.remove();
    chip.insertAdjacentHTML('beforeend', `<span class="n">${n}</span>`);
  });
}

function renderPatients() {
  const grid = document.getElementById('patient-grid');
  const shown = allPatients.filter(FILTERS[activeFilter]);
  if (!allPatients.length) {
    grid.innerHTML = '<div class="empty"><h3>No patients on the board</h3><p>Add a patient to get started.</p></div>';
  } else if (!shown.length) {
    grid.innerHTML = '<div class="empty"><h3>No patients match this filter</h3></div>';
  } else {
    grid.innerHTML = shown.map(folderHtml).join('');
  }
}

const chartHref = (p) => p.latest_handoff_id ? `/handoff/${p.latest_handoff_id}` : `/handoff/new?patient=${p.id}`;

function folderHtml(p) {
  const sev = acuityOf(p.acuity);
  const dispo = p.disposition || 'undecided';
  const status = p.handoff_status
    ? `<span class="stamp ${esc(p.handoff_status)}">${STATUS_LABEL[p.handoff_status] || esc(p.handoff_status)}</span>`
    : '<span class="stamp draft">No handoff</span>';

  let actions = '';
  if (p.pending_actions > 0) {
    actions = `<span class="next"><span class="dot"></span>${p.pending_actions} action${p.pending_actions > 1 ? 's' : ''} open</span>`;
  } else if (p.completed_actions > 0) {
    actions = `<span class="next"><span class="dot done"></span>${p.completed_actions} action${p.completed_actions > 1 ? 's' : ''} done</span>`;
  }

  return `
    <a class="folder ${sev.key}" href="${chartHref(p)}">
      <span class="folder-tab"><span class="room">${esc(p.room_bed || '--')}</span>${sev.label}</span>
      <div class="folder-body">
        <div class="pt-name">${esc(p.display_name)}</div>
        <div class="pt-meta">
          <span>${esc(p.age || '')}${esc(p.sex || '')}</span>
          <span>MRN ${esc(p.mrn)}</span>
          <span>ESI ${esc(p.acuity)}</span>
          ${p.arrival_time ? `<span>in ${clock(p.arrival_time)}</span>` : ''}
        </div>
        <p class="pt-cc">${esc(p.chief_complaint || '')}</p>
        <div class="folder-foot">
          <span class="stamp ${esc(dispo)}">${esc(cap(dispo))}</span>
          ${status}
          ${actions}
        </div>
      </div>
    </a>`;
}

function setFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll('.chip[data-filter]').forEach(chip => {
    const on = chip.dataset.filter === filter;
    chip.classList.toggle('on', on);
    chip.setAttribute('aria-pressed', on);
  });
  renderPatients();
}

function wireNextHandoff() {
  const btn = document.getElementById('next-handoff');
  const next = allPatients.find(p => !p.handoff_status || p.handoff_status === 'draft');
  btn.disabled = !next;
  btn.textContent = next ? `Next handoff: ${next.room_bed || next.display_name}` : 'All charts handed off';
  btn.onclick = next ? () => { location.href = chartHref(next); } : null;
}

// New patient dialog
const dialog = document.getElementById('patient-dialog');
document.getElementById('new-patient').addEventListener('click', () => dialog.showModal());
dialog.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dialog.close()));

document.getElementById('patient-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const age = f.get('age');
  const submit = e.target.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await api.post('/api/patients', {
      display_name: f.get('display_name').trim(),
      mrn: f.get('mrn').trim(),
      age: age ? parseInt(age, 10) : null,
      sex: f.get('sex'),
      room_bed: f.get('room_bed').trim(),
      acuity: parseInt(f.get('acuity'), 10),
      chief_complaint: f.get('chief_complaint').trim(),
      disposition: f.get('disposition'),
    });
    dialog.close();
    e.target.reset();
    await loadBoard();
  } catch (err) {
    dialog.close();
    flash(err.message);
  } finally {
    submit.disabled = false;
  }
});

document.querySelectorAll('.chip[data-filter]').forEach(chip =>
  chip.addEventListener('click', () => setFilter(chip.dataset.filter)));

document.addEventListener('DOMContentLoaded', loadBoard);

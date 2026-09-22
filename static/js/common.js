/**
 * Shared vocabulary for every page: acuity names, escaping, clock times, the patient label,
 * the current shift, and flash notices. Loaded after api.js.
 */

// ESI level to I-PASS illness severity (ESI 4 and 5 are both "stable")
const ACUITY = {
  1: { key: 'critical', label: 'Critical' },
  2: { key: 'serious', label: 'Serious' },
  3: { key: 'watch', label: 'Watch' },
  4: { key: 'stable', label: 'Stable' },
  5: { key: 'stable', label: 'Stable' },
};
const acuityOf = (esi) => ACUITY[esi] || ACUITY[4];
// I-PASS illness severity, looked up from a fixed table so no stored string reaches the markup raw
const SEVERITY = Object.fromEntries(Object.values(ACUITY).map(a => [a.key, a]));

const ROLE_LABEL = { attending: 'Attending', resident: 'Resident', intern: 'Intern', nurse: 'Nurse', admin: 'Admin' };

// Safe between tags AND inside quoted attributes (title=, aria-label=), so quotes are escaped too
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ESCAPES[c]);
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

// Every stored timestamp is UTC without a zone marker (SQLite datetime('now'), and the seed follows
// suit); read it as UTC, show it in the viewer's local time
function asDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
  return isNaN(d) ? null : d;
}
const clock = (s) => asDate(s)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) || '';
const day = (s) => asDate(s)?.toLocaleDateString([], { dateStyle: 'medium' }) || '';

const initialsOf = (name) => name.replace(/^Dr\.\s+/, '').replace(/,.*$/, '')
  .split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

// The sticker on the chart: name, age/sex, MRN, room, acuity, chief complaint
function chartLabelHtml(p, severityKey) {
  const sev = SEVERITY[severityKey] || acuityOf(p.acuity);
  const name = p.display_name || p.patient_name;
  return `
    <div class="pt">
      <div class="pt-name">${esc(name)}</div>
      <div class="ids">
        <span>${esc(p.age || '')}${esc(p.sex || '')}</span>
        <span>MRN ${esc(p.mrn)}</span>
        <span>Room ${esc(p.room_bed || '')}</span>
        ${p.acuity ? `<span>ESI ${esc(p.acuity)}</span>` : ''}
        <span class="stamp solid ${sev.key}">${sev.label}</span>
        ${p.disposition ? `<span class="stamp ${esc(p.disposition)}">${esc(cap(p.disposition))}</span>` : ''}
      </div>
    </div>
    <div class="cc">
      <div class="label">Chief complaint</div>
      <p>${esc(p.chief_complaint || 'Not recorded')}</p>
      ${p.arrival_time ? `<div class="ids arrived">Arrived ${clock(p.arrival_time)}</div>` : ''}
    </div>`;
}

let _shift;
function currentShift() {
  if (!_shift) _shift = api.get('/api/shifts/current').catch(() => null);
  return _shift;
}

function flash(message, kind = 'error') {
  const host = document.getElementById('flash-container');
  if (!host) return;
  host.innerHTML = `<div class="notice ${kind}" role="alert">${esc(message)}</div>`;
  host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Binder index: light the tab of the page in view
function wireIndex() {
  const tabs = [...document.querySelectorAll('.index a')];
  if (!tabs.length || !('IntersectionObserver' in window)) return;
  const byId = new Map(tabs.map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      tabs.forEach(a => a.classList.toggle('on', a === byId.get(e.target.id)));
    });
  }, { rootMargin: '-35% 0px -60% 0px' });
  byId.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

// Receiver options: everyone on the shift except the sender
async function fillReceivers(select, selected) {
  const shift = await currentShift();
  const team = (shift?.team || []).filter(m => m.user_id !== window.ME);
  select.insertAdjacentHTML('beforeend', team.map(m => `
    <option value="${m.user_id}"${m.user_id === selected ? ' selected' : ''}>${esc(m.display_name)} · ${esc(ROLE_LABEL[m.role] || m.role)}${m.zone ? ' · zone ' + esc(m.zone) : ''}</option>`).join(''));
  return shift;
}

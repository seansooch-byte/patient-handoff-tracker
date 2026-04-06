/**
 * Handoff View — loads handoff from API, renders read-only view, handles verification.
 */

let currentHandoff = null;

async function initHandoffView() {
  // Get handoff ID from URL path: /handoff/3
  const match = window.location.pathname.match(/\/handoff\/(\d+)/);
  if (!match) return;

  const handoffId = match[1];

  try {
    currentHandoff = await api.get('/api/handoffs/' + handoffId);
    renderHandoff(currentHandoff);
  } catch (err) {
    document.getElementById('handoff-content').innerHTML =
      `<div class="empty-state"><h3>Handoff not found</h3><p>${err.message}</p></div>`;
  }
}

function renderHandoff(h) {
  const container = document.getElementById('handoff-content');
  if (!container) return;

  const sevMap = { critical: 'critical', serious: 'serious', stable: 'stable', watch: 'watch' };
  const sevClass = sevMap[h.illness_severity] || 'stable';
  const dispClass = h.disposition || 'undecided';

  // Status timeline
  const steps = ['draft', 'sent', 'acknowledged', 'verified'];
  const currentIdx = steps.indexOf(h.status);

  const timelineHtml = steps.map((step, i) => {
    const cls = i < currentIdx ? 'done' : i === currentIdx ? 'active' : '';
    const lineClass = i < currentIdx ? 'done' : '';
    const label = step.charAt(0).toUpperCase() + step.slice(1);
    let html = `<div class="timeline-step ${cls}"><span class="timeline-dot"></span><span>${label}</span></div>`;
    if (i < steps.length - 1) html += `<div class="timeline-line ${lineClass}"></div>`;
    return html;
  }).join('');

  // Action items
  const actionsHtml = (h.action_items || []).map(a => {
    const checked = a.completed ? 'checked' : '';
    const textCls = a.completed ? 'completed' : '';
    const checkHtml = a.completed ? '&#10003;' : '';
    const completedInfo = a.completed && a.completer_name
      ? `<span style="margin-left: var(--sp-2);">Completed by ${esc(a.completer_name)} at ${formatTime(a.completed_at)}</span>`
      : '';

    return `
      <div class="action-item-view">
        <div class="action-checkbox ${checked}" data-action-id="${a.id}" onclick="toggleAction(${a.id}, ${a.completed ? 0 : 1})">${checkHtml}</div>
        <div class="action-item-text ${textCls}">
          <div style="font-size: var(--fs-sm);">${esc(a.description)}</div>
          <div style="font-size: var(--fs-xs); color: var(--text-muted); margin-top: 2px;">
            <span class="badge badge-${a.priority}" style="font-size: 9px;">${a.priority.toUpperCase()}</span>
            ${a.due_by ? `<span style="margin-left: var(--sp-2);">Due: ${formatTime(a.due_by)}</span>` : ''}
            ${completedInfo}
          </div>
        </div>
      </div>`;
  }).join('');

  const completedCount = (h.action_items || []).filter(a => a.completed).length;
  const totalActions = (h.action_items || []).length;

  // Check if current user is the receiver (for verification section)
  const meRes = await_me();

  container.innerHTML = `
    <!-- Patient header -->
    <div class="handoff-patient-bar">
      <div class="handoff-patient-info">
        <div>
          <div class="handoff-patient-name">${esc(h.patient_name)}</div>
          <div class="handoff-patient-details">
            <span>${h.age || ''}${h.sex || ''}</span>
            <span>MRN ${esc(h.mrn)}</span>
            <span>Room ${esc(h.room_bed || '')}</span>
            <span class="badge badge-${sevClass}">${h.illness_severity.charAt(0).toUpperCase() + h.illness_severity.slice(1)}</span>
            ${h.disposition ? `<span class="badge badge-${dispClass}">${h.disposition.charAt(0).toUpperCase() + h.disposition.slice(1)}</span>` : ''}
          </div>
        </div>
      </div>
      <div style="text-align:right; font-size: var(--fs-xs); color: var(--text-muted);">
        <div>${esc(h.chief_complaint || '')}</div>
        <div>${h.arrival_time ? 'Arrived ' + formatTime(h.arrival_time) : ''}</div>
      </div>
    </div>

    <!-- Status timeline -->
    <div class="handoff-timeline no-print">${timelineHtml}</div>

    <!-- Meta -->
    <div class="handoff-meta" style="font-size: var(--fs-xs); color: var(--text-muted); margin-bottom: var(--sp-4); display:flex; gap: var(--sp-4); flex-wrap: wrap;">
      <span>From: <strong style="color: var(--text);">${esc(h.sender_name)} (${h.sender_role})</strong></span>
      ${h.receiver_name ? `<span>To: <strong style="color: var(--text);">${esc(h.receiver_name)} (${h.receiver_role})</strong></span>` : ''}
      ${h.sent_at ? `<span>Sent: <strong style="color: var(--text);">${formatTime(h.sent_at)}</strong></span>` : ''}
    </div>

    <!-- I — Illness Severity -->
    <div class="handoff-section">
      <div class="handoff-section-header">
        <div class="form-section-letter letter-I">I</div>
        <div><div class="form-section-title">Illness Severity</div></div>
      </div>
      <div class="handoff-section-body" style="display:flex; gap: var(--sp-6);">
        <div class="handoff-field">
          <div class="handoff-field-label">Severity</div>
          <div><span class="badge badge-${sevClass}" style="font-size: var(--fs-sm);">${h.illness_severity.charAt(0).toUpperCase() + h.illness_severity.slice(1)}</span></div>
        </div>
        <div class="handoff-field">
          <div class="handoff-field-label">Code Status</div>
          <div class="handoff-field-value">${esc(h.code_status || 'Not specified')}</div>
        </div>
      </div>
    </div>

    <!-- P — Patient Summary -->
    <div class="handoff-section">
      <div class="handoff-section-header">
        <div class="form-section-letter letter-P">P</div>
        <div><div class="form-section-title">Patient Summary</div></div>
      </div>
      <div class="handoff-section-body">
        <div class="handoff-field">
          <div class="handoff-field-label">One-Liner</div>
          <div class="handoff-field-value" style="font-weight: 600;">${esc(h.one_liner)}</div>
        </div>
        ${h.hpi_summary ? `<div class="handoff-field"><div class="handoff-field-label">HPI</div><div class="handoff-field-value">${esc(h.hpi_summary)}</div></div>` : ''}
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4);">
          ${fieldBlock('Pertinent PMH', h.pertinent_pmh)}
          ${fieldBlock('Key Medications', h.key_meds)}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4);">
          ${fieldBlock('Key Labs', h.key_labs)}
          ${fieldBlock('Key Imaging', h.key_imaging)}
        </div>
      </div>
    </div>

    <!-- A — Action List -->
    <div class="handoff-section">
      <div class="handoff-section-header">
        <div class="form-section-letter letter-A">A</div>
        <div><div class="form-section-title">Action List</div></div>
        <div style="margin-left: auto; font-size: var(--fs-xs); color: var(--text-muted);">${completedCount} of ${totalActions} complete</div>
      </div>
      <div style="padding: 0;">
        ${actionsHtml || '<div style="padding: var(--sp-4); color: var(--text-muted); font-size: var(--fs-sm);">No action items</div>'}
      </div>
    </div>

    <!-- S — Situational Awareness -->
    <div class="handoff-section">
      <div class="handoff-section-header">
        <div class="form-section-letter letter-S1">S</div>
        <div><div class="form-section-title">Situational Awareness</div></div>
      </div>
      <div class="handoff-section-body">
        ${fieldBlock('Contingency Plan', h.contingency_plan)}
        ${fieldBlock('What to Watch For', h.what_to_watch)}
        ${fieldBlock('Anticipated Changes', h.anticipated_changes)}
      </div>
    </div>

    <!-- S — Synthesis / Verification -->
    ${renderVerificationSection(h)}
  `;
}

function renderVerificationSection(h) {
  if (h.status === 'verified' && h.receiver_summary) {
    return `
      <div class="handoff-section">
        <div class="handoff-section-header">
          <div class="form-section-letter letter-S2">S</div>
          <div><div class="form-section-title">Synthesis by Receiver</div></div>
          <span class="badge badge-verified" style="margin-left: auto;">Verified</span>
        </div>
        <div class="handoff-section-body">
          ${fieldBlock('Receiver Summary', h.receiver_summary)}
          ${fieldBlock('Questions Asked', h.questions_asked)}
          <div style="font-size: var(--fs-xs); color: var(--text-muted);">
            Verified at ${formatTime(h.verified_at)} by ${esc(h.receiver_name || 'receiver')}
          </div>
        </div>
      </div>`;
  }

  if (h.status === 'sent' || h.status === 'acknowledged') {
    return `
      <div class="verification-section no-print" id="verification-section">
        <h3>Synthesis by Receiver</h3>
        <p style="font-size: var(--fs-sm); color: var(--text-secondary); margin-bottom: var(--sp-3);">
          As the receiving provider, summarize your understanding to complete the read-back verification.
        </p>
        <div class="form-group">
          <label class="form-label" for="receiver-summary">Your Summary</label>
          <textarea class="form-textarea" id="receiver-summary" rows="3" placeholder="Summarize what you understand about this patient, the plan, and action items..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="questions">Questions or Clarifications</label>
          <textarea class="form-textarea" id="questions" rows="2" placeholder="Any questions for the outgoing provider?"></textarea>
        </div>
        <div style="display:flex; justify-content:flex-end; gap: var(--sp-2);">
          <button class="btn btn-outline" onclick="verifyHandoff('clarification_needed')">Need Clarification</button>
          <button class="btn btn-primary" onclick="verifyHandoff('verified')">Verify &amp; Accept</button>
        </div>
      </div>`;
  }

  return `
    <div class="handoff-section" style="border: 2px dashed var(--border); opacity: 0.6;">
      <div class="handoff-section-header">
        <div class="form-section-letter letter-S2">S</div>
        <div><div class="form-section-title">Synthesis by Receiver</div></div>
      </div>
      <div class="handoff-section-body">
        <div class="handoff-field-value empty">Pending — handoff must be sent first</div>
      </div>
    </div>`;
}

async function verifyHandoff(verificationStatus) {
  if (!currentHandoff) return;

  const summary = document.getElementById('receiver-summary')?.value || '';
  const questions = document.getElementById('questions')?.value || '';

  // Acknowledge first if needed
  if (currentHandoff.status === 'sent') {
    try {
      await api.post('/api/handoffs/' + currentHandoff.id + '/acknowledge');
    } catch (err) {
      // May fail if not the receiver — that's fine
    }
  }

  try {
    await api.post('/api/handoffs/' + currentHandoff.id + '/verify', {
      receiver_summary: summary,
      questions_asked: questions,
      verification_status: verificationStatus,
    });
    window.location.reload();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function toggleAction(actionId, newState) {
  if (newState === 1) {
    try {
      await api.put('/api/actions/' + actionId + '/complete');
      window.location.reload();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }
}

function fieldBlock(label, value) {
  if (!value) return '';
  return `
    <div class="handoff-field">
      <div class="handoff-field-label">${label}</div>
      <div class="handoff-field-value">${esc(value)}</div>
    </div>`;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'Z'));
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function await_me() {
  // Sync check — we'll use the user data from the template
  return null;
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', initHandoffView);

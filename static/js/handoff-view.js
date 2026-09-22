/**
 * Handoff view: the chart opened read-only, one divider page per framework letter.
 * The last page is the receiver's read-back: a form for the named receiver, a waiting note for
 * everyone else, the signed synthesis once verified. A draft can be routed from here by its sender.
 */

let current = null;

const CODE_STATUS = { full: 'Full Code', dnr: 'DNR', dni: 'DNI', 'dnr-dni': 'DNR/DNI', comfort: 'Comfort Care' };
const STEPS = [
  ['draft', 'Draft', 'created_at'],
  ['sent', 'Sent', 'sent_at'],
  ['acknowledged', 'Acknowledged', 'acknowledged_at'],
  ['verified', 'Verified', 'verified_at'],
];

async function initHandoffView() {
  const match = window.location.pathname.match(/\/handoff\/(\d+)/);
  if (!match) {
    document.getElementById('handoff-content').innerHTML =
      '<div class="empty"><h3>No handoff selected</h3><p>Open a chart from the board.</p></div>';
    return;
  }
  await load(match[1]);
  window.addEventListener('beforeprint', stampPrint);
}

async function load(id) {
  try {
    current = await api.get('/api/handoffs/' + id);
    render(current);
  } catch (err) {
    document.getElementById('handoff-content').innerHTML =
      `<div class="empty"><h3>Handoff not found</h3><p>${esc(err.message)}</p></div>`;
  }
}

function stampPrint() {
  document.getElementById('print-stamp').textContent =
    'Printed ' + new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short', hour12: false });
}

/* ── pieces ── */

const entry = (label, value, cls = '') => value
  ? `<div class="entry"><div class="label">${label}</div><div class="written ${cls}">${esc(value)}</div></div>`
  : '';

const pair = (a, b) => (a || b) ? `<div class="entry-pair">${a}${b}</div>` : '';

const orNothing = (html) => html.trim() || '<div class="written none">Nothing recorded</div>';

function section(id, letter, word, title, body, extra = '', cls = '') {
  return `
    <section class="section ${cls}" id="${id}" aria-labelledby="h-${id}">
      <div class="divider" aria-hidden="true"><span class="letter">${letter}</span><span class="word">${word}</span></div>
      <div class="sec-page">
        <header class="sec-head"><h2 id="h-${id}">${title}</h2>${extra}</header>
        ${body}
      </div>
    </section>`;
}

const who = (name, role) => name ? `<b>${esc(name)}</b> <span class="muted">(${esc(ROLE_LABEL[role] || role || '')})</span>` : '<span class="muted">No receiver named</span>';

function routingHtml(h) {
  const at = STEPS.findIndex(([s]) => s === h.status);
  const slip = STEPS.map(([key, label, field], i) => {
    const cls = i < at ? 'done' : i === at ? `now ${key}` : '';
    // the draft's own time only matters while it is still a draft
    const time = i <= at && h[field] && (key !== 'draft' || at === 0) ? clock(h[field]) : '';
    return `<div class="slip-step ${cls}"><div class="label">${label}</div><div class="t">${time}</div></div>`;
  }).join('');

  const canSend = h.status === 'draft' && h.sender_id === window.ME;
  const to = canSend
    ? `<div class="field no-print"><label for="send-to">To</label>
         <select class="select" id="send-to"><option value="">Choose the receiving provider</option></select></div>
       <button class="btn primary no-print" type="button" onclick="sendDraft()">Send</button>`
    : `<span class="who">To ${who(h.receiver_name, h.receiver_role)}</span>`;

  return `
    <div class="routing">
      <div class="routing-line">
        <span class="stamp">${h.handoff_type === 'sbar' ? 'SBAR' : 'I-PASS'}</span>
        <span class="who">From ${who(h.sender_name, h.sender_role)}</span>
        <span class="arrow" aria-hidden="true">&rarr;</span>
        ${to}
      </div>
      <div class="slip">${slip}</div>
    </div>`;
}

function actionsHtml(items) {
  if (!items.length) return '<div class="written none">No action items</div>';
  return items.map(a => `
    <div class="todo${a.completed ? ' done' : ''}">
      <button class="box" type="button" role="checkbox" aria-checked="${a.completed ? 'true' : 'false'}"
              aria-label="${a.completed ? 'Completed' : 'Mark complete'}: ${esc(a.description)}"
              ${a.completed ? 'disabled' : `onclick="completeAction(${a.id})"`}></button>
      <div class="text">
        <p>${esc(a.description)}</p>
        <div class="meta">
          <span class="stamp ${esc(a.priority)}">${esc((a.priority || '').toUpperCase())}</span>
          ${a.due_by ? `<span>Due ${clock(a.due_by)}</span>` : ''}
          ${a.completed && a.completer_name ? `<span>Done by ${esc(a.completer_name)} at ${clock(a.completed_at)}</span>` : ''}
        </div>
      </div>
    </div>`).join('');
}

function readbackHtml(h, letter, word) {
  const notes = entry('Receiver summary', h.receiver_summary) + entry('Questions asked', h.questions_asked);

  if (h.status === 'verified') {
    return section('sec-rb', letter, word, 'Synthesis by receiver',
      orNothing(notes) + `<p class="hint sec-foot-note">Verified at ${clock(h.verified_at)} by ${esc(h.receiver_name || 'the receiver')}</p>`,
      '<span class="stamp verified">Verified</span>');
  }

  if (h.status === 'draft') {
    return section('sec-rb', letter, word, 'Synthesis by receiver',
      '<div class="written none">Opens for the receiver once the handoff is sent</div>', '', 'pending');
  }

  const clarification = h.verification_status === 'clarification_needed'
    ? `<div class="notice">Clarification requested. The read-back below is still open.</div>${notes}` : '';

  if (h.receiver_id !== window.ME) {
    return section('sec-rb', letter, word, 'Synthesis by receiver',
      clarification + `<div class="written none">Awaiting read-back from ${esc(h.receiver_name || 'the receiver')}</div>`, '', 'pending');
  }

  return section('sec-rb', letter, word, 'Synthesis by receiver', `
      ${clarification}
      <div class="readback-form">
        <p class="hint readback-intro">As the receiving provider, summarize your understanding to complete the read-back.</p>
        <div class="field">
          <label for="receiver-summary">Your summary</label>
          <textarea class="ruled" id="receiver-summary" rows="3" placeholder="Summarize what you understand about this patient, the plan, and action items..."></textarea>
        </div>
        <div class="field">
          <label for="questions">Questions or clarifications</label>
          <textarea class="ruled" id="questions" rows="2" placeholder="Any questions for the outgoing provider?"></textarea>
        </div>
        <div class="readback-acts">
          <button class="btn" type="button" onclick="verify('clarification_needed')">Need clarification</button>
          <button class="btn primary" type="button" onclick="verify('verified')">Verify &amp; accept</button>
        </div>
      </div>`, '<span class="stamp sent">Your read-back</span>');
}

/* ── the sheet ── */

function render(h) {
  const sev = (SEVERITY[h.illness_severity] || SEVERITY.stable).key;
  const isSbar = h.handoff_type === 'sbar';
  const items = h.action_items || [];
  const done = items.filter(a => a.completed).length;

  document.getElementById('print-title').textContent = (isSbar ? 'SBAR' : 'I-PASS') + ' handoff sheet';
  const acts = document.getElementById('view-acts');
  acts.querySelectorAll('[data-new]').forEach(n => n.remove());
  acts.insertAdjacentHTML('afterbegin', `
    <a class="btn sm" data-new href="/handoff/new?patient=${Number(h.patient_id)}">New I-PASS</a>
    <a class="btn sm" data-new href="/sbar/new?patient=${Number(h.patient_id)}">New SBAR</a>`);

  const severity = `
    <div class="severity-line">
      <div class="entry"><div class="label">Severity</div><span class="stamp solid big ${esc(sev)}">${esc(cap(sev))}</span></div>
      ${isSbar ? '' : `<div class="entry"><div class="label">Code status</div><div class="written">${esc(CODE_STATUS[h.code_status] || h.code_status || 'Not specified')}</div></div>`}
    </div>`;

  let pages;
  let index;
  if (isSbar) {
    pages = [
      section('sec-s', 'S', 'Situation', 'Situation', severity + entry('Situation', h.sbar_situation || h.one_liner, 'lead')),
      section('sec-b', 'B', 'Background', 'Background', orNothing(entry('Background', h.sbar_background))),
      section('sec-a', 'A', 'Assessment', 'Assessment', orNothing(entry('Assessment', h.sbar_assessment))),
      section('sec-r', 'R', 'Recommend', 'Recommendation', orNothing(entry('Recommendation', h.sbar_recommendation))),
      readbackHtml(h, '&#10003;', 'Read-back'),
    ];
    index = [['sec-s', 'S'], ['sec-b', 'B'], ['sec-a', 'A'], ['sec-r', 'R'], ['sec-rb', '&#10003;']];
  } else {
    pages = [
      section('sec-i', 'I', 'Illness', 'Illness severity', severity),
      section('sec-p', 'P', 'Patient', 'Patient summary',
        entry('One-liner', h.one_liner, 'lead') + entry('HPI', h.hpi_summary) +
        pair(entry('Pertinent PMH', h.pertinent_pmh), entry('Key medications', h.key_meds)) +
        pair(entry('Key labs', h.key_labs), entry('Key imaging', h.key_imaging))),
      section('sec-a', 'A', 'Actions', 'Action list', actionsHtml(items),
        `<span class="count">${done} of ${items.length} complete</span>`),
      section('sec-s1', 'S', 'Awareness', 'Situational awareness', orNothing(
        entry('Contingency plan', h.contingency_plan) + entry('What to watch for', h.what_to_watch) +
        entry('Anticipated changes', h.anticipated_changes))),
      readbackHtml(h, 'S', 'Synthesis'),
    ];
    index = [['sec-i', 'I'], ['sec-p', 'P'], ['sec-a', 'A'], ['sec-s1', 'S'], ['sec-rb', 'S']];
  }

  document.getElementById('handoff-content').innerHTML = `
    <header class="chart-label">${chartLabelHtml(h, sev)}</header>
    ${routingHtml(h)}
    <div class="binder">
      <div class="pages">${pages.join('')}</div>
      <nav class="index no-print" aria-label="Jump to section">
        ${index.map(([id, l]) => `<a href="#${id}">${l}</a>`).join('')}
      </nav>
    </div>`;

  wireIndex();
  stampPrint();
  if (h.status === 'draft' && h.sender_id === window.ME) {
    fillReceivers(document.getElementById('send-to'), h.receiver_id);
  }
}

/* ── actions ── */

async function sendDraft() {
  const receiver = parseInt(document.getElementById('send-to').value, 10);
  if (!receiver) { flash('Choose the receiving provider before sending.'); return; }
  try {
    await api.post(`/api/handoffs/${current.id}/send`, { receiver_id: receiver });
    await load(current.id);
  } catch (err) { flash(err.message); }
}

async function verify(verificationStatus) {
  const summary = document.getElementById('receiver-summary')?.value.trim() || '';
  if (verificationStatus === 'verified' && !summary) {
    flash('Write your read-back summary before verifying.');
    document.getElementById('receiver-summary')?.focus();
    return;
  }
  try {
    if (current.status === 'sent') await api.post(`/api/handoffs/${current.id}/acknowledge`);
    await api.post(`/api/handoffs/${current.id}/verify`, {
      receiver_summary: summary,
      questions_asked: document.getElementById('questions')?.value.trim() || '',
      verification_status: verificationStatus,
    });
    await load(current.id);
  } catch (err) { flash(err.message); }
}

async function completeAction(actionId) {
  try {
    await api.put(`/api/actions/${actionId}/complete`);
    await load(current.id);
  } catch (err) { flash(err.message); }
}

initHandoffView();

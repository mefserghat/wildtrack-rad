// WildTrack RAD prototype front end (vanilla JS, no build step)
const USER_ID = 'r-117'; // simulated signed-in ranger
const TYPE_LABELS = {
  injured_wildlife: 'Injured / dead wildlife',
  poaching: 'Suspected poaching',
  habitat_damage: 'Habitat damage',
  human_wildlife_conflict: 'Human–wildlife conflict',
};

const $ = (sel) => document.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const form = $('#report-form');
let meta = null;
let currentId = null;

async function api(method, url, body, extraHeaders = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-User': USER_ID, ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ---------------- Tabs ----------------
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => { b.classList.toggle('active', b === btn); b.setAttribute('aria-selected', b === btn); });
    $('#tab-author').classList.toggle('hidden', btn.dataset.tab !== 'author');
    $('#tab-view').classList.toggle('hidden', btn.dataset.tab !== 'view');
    if (btn.dataset.tab === 'view') loadReportOptions();
  });
});

// ---------------- Story 1: authoring ----------------
function readForm() {
  const f = new FormData(form);
  const incidentTypes = [...form.querySelectorAll('input[name="incidentType"]:checked')].map((c) => c.value);
  const evidence = incidentTypes.includes('poaching')
    ? [{ item: f.get('evItem'), collector: f.get('evCollector'), collectedAt: f.get('evCollectedAt'), storage: f.get('evStorage') }]
    : [];
  return {
    incidentTypes,
    species: f.get('species'),
    location: { lat: f.get('lat'), lng: f.get('lng'), county: f.get('county'), description: f.get('description') },
    narrative: f.get('narrative'),
    witness: { name: f.get('witnessName'), phone: f.get('witnessPhone') },
    evidence,
  };
}

function fillForm(r) {
  form.reset();
  form.querySelectorAll('input[name="incidentType"]').forEach((c) => { c.checked = (r.incidentTypes || []).includes(c.value); });
  form.species.value = r.species || '';
  form.lat.value = r.location?.lat ?? '';
  form.lng.value = r.location?.lng ?? '';
  form.county.value = r.location?.county || '';
  form.description.value = r.location?.description || '';
  form.narrative.value = r.narrative || '';
  form.witnessName.value = r.witness?.name || '';
  form.witnessPhone.value = r.witness?.phone || '';
  const ev = (r.evidence || [])[0] || {};
  form.evItem.value = ev.item || '';
  form.evCollector.value = ev.collector || '';
  form.evCollectedAt.value = ev.collectedAt || '';
  form.evStorage.value = ev.storage || '';
  syncConditionalUI();
}

function setStatus(status, reportNumber) {
  $('#status-pill').textContent = status;
  $('#status-pill').className = 'pill ' + status.toLowerCase().replace(/\s+/g, '-');
  $('#report-number').textContent = reportNumber || 'Number pending';
}

function showMessage(text, kind = 'info', list = []) {
  const box = $('#form-message');
  box.className = `message ${kind}`;
  box.innerHTML = `<p>${esc(text)}</p>` + (list.length ? `<ul>${list.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : '');
}

function clearMessage() { $('#form-message').className = 'message hidden'; }

function syncConditionalUI() {
  const poaching = form.querySelector('input[value="poaching"]')?.checked;
  $('#evidence-section').classList.toggle('hidden', !poaching);
  const sensitive = meta && meta.sensitiveSpecies.includes(form.species.value.trim().toLowerCase());
  $('#sensitive-flag').classList.toggle('hidden', !sensitive);
}

function newReport() {
  currentId = null;
  form.reset();
  syncConditionalUI();
  setStatus('Not saved');
  $('#form-title').textContent = 'New incident report';
  clearMessage();
}

async function saveDraft() {
  const body = readForm();
  const res = currentId ? await api('PUT', `/api/reports/${currentId}`, body) : await api('POST', '/api/reports', body);
  if (!res.ok) return showMessage(res.data.error || 'Could not save draft', 'error');
  currentId = res.data.id;
  setStatus(res.data.status, res.data.reportNumber);
  $('#form-title').textContent = 'Draft report';
  showMessage(`Draft saved at ${new Date(res.data.updatedAt).toLocaleTimeString()}.`, 'success');
  loadDrafts();
}

async function submitReport() {
  if (!currentId) {
    const saved = await api('POST', '/api/reports', readForm());
    if (!saved.ok) return showMessage(saved.data.error || 'Enter the report before submitting', 'error');
    currentId = saved.data.id;
  } else {
    const upd = await api('PUT', `/api/reports/${currentId}`, readForm());
    if (!upd.ok) return showMessage(upd.data.error || 'Could not save changes', 'error');
  }
  const res = await api('POST', `/api/reports/${currentId}/submit`);
  if (res.status === 422) {
    setStatus('Draft');
    loadDrafts();
    return showMessage('This report cannot be submitted yet. Complete these required fields:', 'error', res.data.missing);
  }
  if (!res.ok) return showMessage(res.data.error || 'Submit failed', 'error');
  setStatus(res.data.status, res.data.reportNumber);
  showMessage(`Submitted for supervisor approval as ${res.data.reportNumber}.`, 'success');
  loadDrafts();
}

async function loadDrafts() {
  const res = await api('GET', '/api/reports?status=Draft');
  const list = $('#drafts');
  list.innerHTML = '';
  if (!res.ok || !res.data.length) { list.innerHTML = '<li class="muted">No drafts yet.</li>'; return; }
  res.data.forEach((d) => {
    const li = document.createElement('li');
    const types = d.incidentTypes.map((t) => TYPE_LABELS[t]).join(', ') || 'No type yet';
    li.innerHTML = `<button class="link"><strong>${esc(d.species) || 'Untitled draft'}</strong><span>${types}</span><span class="muted">Saved ${new Date(d.updatedAt).toLocaleString()}</span></button>`;
    li.querySelector('button').addEventListener('click', () => openDraft(d.id));
    list.appendChild(li);
  });
}

async function openDraft(id) {
  const res = await api('GET', `/api/reports/${id}`);
  if (!res.ok) return showMessage(res.data.error || 'Could not open draft', 'error');
  currentId = id;
  fillForm(res.data);
  setStatus(res.data.status, res.data.reportNumber);
  $('#form-title').textContent = 'Draft report';
  showMessage('Draft reopened. All fields restored.', 'info');
}

// ---------------- Story 2: recipient views ----------------
async function loadReportOptions() {
  const res = await api('GET', '/api/reports?status=Approved');
  const sel = $('#report-select');
  const prev = sel.value;
  sel.innerHTML = res.data.map((r) => `<option value="${r.id}">${esc(r.reportNumber)} · ${esc(r.species)} (${r.incidentTypes.map((t) => TYPE_LABELS[t]).join(' + ')})</option>`).join('');
  if (prev) sel.value = prev;
  renderRecipientView();
}

function fmtLocation(loc) {
  if (loc === '[REDACTED]') return redacted('Location withheld');
  if (loc.precision === 'county') return `${esc(loc.county)} <span class="tag">county level only</span>`;
  if (loc.precision) return `${loc.lat}, ${loc.lng} <span class="tag">${esc(loc.precision)}</span><br>${esc(loc.county)}`;
  return `${esc(loc.lat)}, ${esc(loc.lng)}<br>${esc(loc.description)}<br>${esc(loc.county)}`;
}

function redacted(label = 'Redacted') { return `<span class="redacted">${label}</span>`; }

async function renderRecipientView() {
  const id = $('#report-select').value;
  const role = $('#role-select').value;
  if (!id || !role) return;
  const res = await api('GET', `/api/reports/${id}`, null, { 'X-Role': role });
  $('#api-call').textContent = `GET /api/reports/${id.slice(0, 8)}…   X-Role: ${role}`;
  $('#raw-json').textContent = JSON.stringify(res.data, null, 2);
  if (!res.ok) { $('#recipient-view').innerHTML = `<p class="message error">${esc(res.data.error)}</p>`; return; }
  const v = res.data;
  const d = v.disclosure;
  const ev = v.evidence === '[REDACTED]' ? redacted('Evidence withheld')
    : (v.evidence.length ? v.evidence.map((e) => `${esc(e.item)}, collected by ${esc(e.collector)} at ${esc(e.collectedAt)}; stored: ${esc(e.storage)}`).join('<br>') : '<span class="muted">None</span>');
  const wit = v.witness === '[REDACTED]' ? redacted('Witness identity withheld') : `${esc(v.witness.name)} · ${esc(v.witness.phone)}`;
  $('#recipient-view').innerHTML = `
    <div class="card-head"><h2>${esc(v.reportNumber)}</h2><span class="pill approved">${v.status}</span></div>
    <p class="viewing">Viewing as <strong>${d.roleLabel}</strong>
      ${d.sensitiveSpecies ? '<span class="tag warn">Sensitive species</span>' : ''}
      ${d.poachingCase ? '<span class="tag warn">Poaching case</span>' : ''}</p>
    <dl>
      <dt>Incident type</dt><dd>${v.incidentTypes.map((t) => TYPE_LABELS[t]).join(' + ')}</dd>
      <dt>Species</dt><dd>${esc(v.species)}</dd>
      <dt>Location</dt><dd>${fmtLocation(v.location)}</dd>
      <dt>Narrative</dt><dd>${esc(v.narrative)}</dd>
      <dt>Witness / reporting party</dt><dd>${wit}</dd>
      <dt>Evidence</dt><dd>${ev}</dd>
    </dl>
    <p class="hint">Disclosure applied: location = <code>${d.outcomes.location}</code>, witness = <code>${d.outcomes.witness_identity}</code>, evidence = <code>${d.outcomes.evidence}</code></p>`;
}

// ---------------- Init ----------------
async function init() {
  meta = (await api('GET', '/api/meta')).data;
  $('#incident-types').innerHTML = meta.incidentTypes
    .map((t) => `<label class="check"><input type="checkbox" name="incidentType" value="${t}"> ${TYPE_LABELS[t]}</label>`).join('');
  $('#species-list').innerHTML = ['Bald eagle', 'Desert tortoise', 'Mule deer', 'Black bear', 'Elk'].map((s) => `<option value="${s}">`).join('');
  $('#role-select').innerHTML = Object.entries(meta.roles).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('#role-select').value = 'police';

  form.addEventListener('change', syncConditionalUI);
  form.species.addEventListener('input', syncConditionalUI);
  $('#btn-new').addEventListener('click', newReport);
  $('#btn-save').addEventListener('click', saveDraft);
  $('#btn-submit').addEventListener('click', submitReport);
  $('#report-select').addEventListener('change', renderRecipientView);
  $('#role-select').addEventListener('change', renderRecipientView);

  newReport();
  loadDrafts();
}

init();

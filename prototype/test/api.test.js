// Automated API tests. Run: node --test
// Each test name starts with its test case ID so results map to 04_test_cases.csv
// and the traceability matrix.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { createServer, reports } = require('../server');

let server, base;
before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

async function call(method, path, { body, user = 'r-117', role } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (user) headers['X-User'] = user;
  if (role) headers['X-Role'] = role;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
}

const partialDraft = {
  incidentTypes: ['injured_wildlife'],
  species: 'Elk',
  location: { lat: '', lng: '', county: '', description: 'Near south trailhead' },
  narrative: '',
  witness: { name: '', phone: '' },
};

function approvedId(species) {
  return [...reports.values()].find((r) => r.species === species && r.status === 'Approved').id;
}

// ---------------- Story 1: Save draft (FR-02) ----------------

test('TC-01 Save a partially completed report as a draft and restore it (FR-02; TR-02.1, 02.3, 02.5)', async () => {
  const created = await call('POST', '/api/reports', { body: partialDraft });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.data.status, 'Draft', 'new reports start as Draft (TR-02.1)');
  assert.strictEqual(created.data.reportNumber, null, 'number pending until submission (TR-10.4)');

  const list = await call('GET', '/api/reports?status=Draft');
  assert.ok(list.data.some((d) => d.id === created.data.id), 'draft appears in My Drafts');

  const reopened = await call('GET', `/api/reports/${created.data.id}`);
  assert.strictEqual(reopened.data.species, 'Elk');
  assert.strictEqual(reopened.data.location.description, 'Near south trailhead', 'all fields restored (TR-02.5)');
});

test('TC-02 An empty draft is rejected (FR-02; TR-02.6)', async () => {
  const res = await call('POST', '/api/reports', { body: { incidentTypes: [], species: '', location: {}, witness: {} } });
  assert.strictEqual(res.status, 400);
});

test('TC-04 Drafts are visible only to their author (FR-02; TR-02.4)', async () => {
  const created = await call('POST', '/api/reports', { body: partialDraft, user: 'r-117' });
  const other = await call('GET', `/api/reports/${created.data.id}`, { user: 'r-999' });
  assert.strictEqual(other.status, 403);
  const otherList = await call('GET', '/api/reports?status=Draft', { user: 'r-999' });
  assert.ok(!otherList.data.some((d) => d.id === created.data.id));
});

test('TC-05 Submit is blocked until required fields are complete, and the server lists what is missing (FR-03; TR-03.4)', async () => {
  const created = await call('POST', '/api/reports', { body: partialDraft });
  const res = await call('POST', `/api/reports/${created.data.id}/submit`);
  assert.strictEqual(res.status, 422);
  assert.ok(res.data.missing.includes('GPS coordinates'));
  assert.ok(res.data.missing.includes('Narrative'));
});

test('TC-06 A multi-type report including poaching requires evidence fields (FR-03, FR-11; TR-03.2)', async () => {
  const body = {
    incidentTypes: ['injured_wildlife', 'poaching'], species: 'Bald eagle',
    location: { lat: 44.1, lng: -105.6, county: 'Pine County', description: '' },
    narrative: 'Eagle with gunshot wound', witness: {}, evidence: [],
  };
  const created = await call('POST', '/api/reports', { body });
  const res = await call('POST', `/api/reports/${created.data.id}/submit`);
  assert.strictEqual(res.status, 422);
  assert.ok(res.data.missing.some((m) => m.startsWith('Evidence')), 'poaching evidence cannot be skipped on a combined report');
});

test('TC-07 A complete report submits and receives a report number (FR-03, FR-10; TR-10.2)', async () => {
  const body = {
    incidentTypes: ['injured_wildlife'], species: 'Elk',
    location: { lat: 44.2, lng: -105.4, county: 'Pine County', description: 'South trailhead' },
    narrative: 'Elk with leg injury, rehab notified', witness: {}, evidence: [],
  };
  const created = await call('POST', '/api/reports', { body });
  const res = await call('POST', `/api/reports/${created.data.id}/submit`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.status, 'Submitted');
  assert.match(res.data.reportNumber, /^NR-\d{4}-\d{5}$/);
});

// ---------------- Story 2: Redaction (FR-05) ----------------

test('TC-03 Partner without access sees redacted GPS, and the API response contains no real coordinates (FR-05; TR-05.4, 05.5)', async () => {
  const id = approvedId('Bald eagle');
  const res = await call('GET', `/api/reports/${id}`, { role: 'land_manager' });
  assert.strictEqual(res.status, 200);
  const raw = JSON.stringify(res.data);
  assert.ok(!raw.includes('44.123456') && !raw.includes('105.678912'), 'exact coordinates never leave the server');
  assert.ok(!raw.includes('active nest tree'), 'precise location description withheld');
  assert.strictEqual(res.data.location.precision, 'within ~1 mile');
  assert.strictEqual(res.data.witness, '[REDACTED]');
});

test('TC-08 Police see full details on a poaching case (FR-05; TR-05.2)', async () => {
  const res = await call('GET', `/api/reports/${approvedId('Bald eagle')}`, { role: 'police' });
  assert.strictEqual(res.data.location.lat, 44.123456);
  assert.strictEqual(res.data.witness.name, 'Jordan Reyes (reporting party)');
  assert.ok(Array.isArray(res.data.evidence) && res.data.evidence.length === 1);
});

test('TC-09 Police do not receive location or witness data on a non-poaching case (FR-05; TR-05.2)', async () => {
  const res = await call('GET', `/api/reports/${approvedId('Mule deer')}`, { role: 'police' });
  assert.strictEqual(res.data.location, '[REDACTED]');
  assert.strictEqual(res.data.witness, '[REDACTED]');
});

test('TC-10 Rehab vet gets an approximate location for a sensitive species and no witness or evidence data (FR-05; TR-05.3)', async () => {
  const res = await call('GET', `/api/reports/${approvedId('Bald eagle')}`, { role: 'rehab_vet' });
  assert.strictEqual(res.data.location.precision, 'approximate (~0.25 mile)');
  assert.notStrictEqual(res.data.location.lat, 44.123456);
  assert.strictEqual(res.data.witness, '[REDACTED]');
  assert.strictEqual(res.data.evidence, '[REDACTED]');
});

test('TC-11 Non-sensitive species: full location for every recipient of the report (FR-05; TR-05.6)', async () => {
  const res = await call('GET', `/api/reports/${approvedId('Mule deer')}`, { role: 'land_manager' });
  assert.strictEqual(res.data.location.lat, 44.201234);
});

test('TC-12 Every recipient view is logged with the disclosure outcome applied (FR-28; TR-05.7)', async () => {
  await call('GET', `/api/reports/${approvedId('Bald eagle')}`, { role: 'public' });
  const audit = await call('GET', '/api/audit');
  const entry = audit.data.find((a) => a.role === 'public' && a.reportNumber === 'NR-2026-00041');
  assert.ok(entry);
  assert.strictEqual(entry.outcomes.location, 'county');
});

test('TC-13 An unknown recipient role is refused (FR-05)', async () => {
  const res = await call('GET', `/api/reports/${approvedId('Bald eagle')}`, { role: 'hacker' });
  assert.strictEqual(res.status, 400);
});

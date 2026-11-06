// WildTrack RAD prototype server
// Zero dependencies: requires only Node.js 18+.
// Run:  node server.js   then open http://localhost:3000
//
// Simulated identity (prototype only): the client sends
//   X-User: the ranger's user id (for drafts)
//   X-Role: the recipient category viewing a report (for redaction)
// Production would use State SSO (IF-01) and partner one-time codes (FR-19).

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

// Sensitive species list (FR-26). Maintained by the lead biologist in production (IF-05).
const SENSITIVE_SPECIES = ['bald eagle', 'golden eagle', 'desert tortoise', 'mexican spotted owl', 'little brown bat'];

const INCIDENT_TYPES = ['injured_wildlife', 'poaching', 'habitat_damage', 'human_wildlife_conflict'];

// TR-05.1: each report field carries a data class.
const FIELD_DATA_CLASS = {
  reportNumber: 'general',
  status: 'general',
  incidentTypes: 'general',
  species: 'general',
  narrative: 'general',
  location: 'location',
  witness: 'witness_identity',
  evidence: 'evidence',
};

// TR-05.2: disclosure policy table.
// recipient category -> data class -> outcome, given report context.
// Outcomes: 'full' | 'withheld' | a location precision ('approximate' | 'mile' | 'county').
// Starting policy from the customer (Dana); to be confirmed with Dr. Priya Anand and Legal Counsel.
const POLICY = {
  ranger:       { location: () => 'full', witness_identity: () => 'full', evidence: () => 'full' },
  supervisor:   { location: () => 'full', witness_identity: () => 'full', evidence: () => 'full' },
  liaison:      { location: () => 'full', witness_identity: () => 'full', evidence: () => 'full' },
  usfws:        { location: () => 'full', witness_identity: () => 'withheld' /* open question #5 */, evidence: () => 'withheld' },
  police:       {
    location:         (ctx) => (ctx.poaching ? 'full' : 'withheld'),
    witness_identity: (ctx) => (ctx.poaching ? 'full' : 'withheld'),
    evidence:         (ctx) => (ctx.poaching ? 'full' : 'withheld'),
  },
  rehab_vet:    { location: (ctx) => (ctx.sensitive ? 'approximate' : 'full'), witness_identity: () => 'withheld', evidence: () => 'withheld' },
  land_manager: { location: (ctx) => (ctx.sensitive ? 'mile' : 'full'),        witness_identity: () => 'withheld', evidence: () => 'withheld' },
  public:       { location: () => 'county', witness_identity: () => 'withheld', evidence: () => 'withheld' },
};

const ROLE_LABELS = {
  ranger: 'Authoring ranger',
  supervisor: 'Supervisor',
  liaison: 'Law enforcement liaison',
  usfws: 'U.S. Fish & Wildlife',
  police: 'State police / county sheriff',
  rehab_vet: 'Rehabilitation veterinarian',
  land_manager: 'Land manager',
  public: 'Public (records request)',
};

// TR-05.3: generalization grid sizes, in degrees of latitude/longitude.
// approximate ≈ 0.25 mi (pending Priya: open question), mile ≈ 1 mi.
const GRID_DEGREES = { approximate: 0.004, mile: 0.015 };

// ---------------------------------------------------------------------------
// In-memory data store (prototype only; production uses the server database)
// ---------------------------------------------------------------------------

const reports = new Map();
const auditLog = []; // TR-05.7: append-only in this prototype (no delete route exists)
let sequence = 41;

function nowIso() { return new Date().toISOString(); }

function seed() {
  const eagle = {
    id: crypto.randomUUID(),
    reportNumber: 'NR-2026-00041',
    status: 'Approved',
    authorId: 'r-204',
    incidentTypes: ['injured_wildlife', 'poaching'],
    species: 'Bald eagle',
    location: {
      lat: 44.123456, lng: -105.678912,
      description: 'North ridge, 0.4 mi past the creek crossing, beside an active nest tree',
      county: 'Pine County',
    },
    narrative: 'Adult bald eagle found grounded with a wing injury consistent with a gunshot. Spent .22 casing found 30 ft from the bird. Bird transported to rehab.',
    witness: { name: 'Jordan Reyes (reporting party)', phone: '555-0142' },
    evidence: [{ item: 'Spent .22 casing', collector: 'Ranger M. Ortiz', collectedAt: '2026-11-02T09:40', storage: 'Northern Region evidence locker, bag #118' }],
    createdAt: '2026-11-02T10:05:00Z', updatedAt: '2026-11-02T15:30:00Z',
  };
  const deer = {
    id: crypto.randomUUID(),
    reportNumber: 'NR-2026-00040',
    status: 'Approved',
    authorId: 'r-117',
    incidentTypes: ['injured_wildlife'],
    species: 'Mule deer',
    location: { lat: 44.201234, lng: -105.512345, description: 'Highway 16, mile marker 42, eastbound shoulder', county: 'Pine County' },
    narrative: 'Mule deer struck by a vehicle. Animal deceased on arrival; carcass removed.',
    witness: { name: 'Caller via dispatch', phone: '555-0199' },
    evidence: [],
    createdAt: '2026-11-01T07:15:00Z', updatedAt: '2026-11-01T12:00:00Z',
  };
  reports.set(eagle.id, eagle);
  reports.set(deer.id, deer);
}

// ---------------------------------------------------------------------------
// Domain logic
// ---------------------------------------------------------------------------

function isSensitiveSpecies(species) {
  return SENSITIVE_SPECIES.includes(String(species || '').trim().toLowerCase());
}

function hasAnyContent(body) {
  // TR-02.6: a draft is created only if at least one field has a value.
  const fields = ['species', 'narrative'];
  if (fields.some((f) => body[f] && String(body[f]).trim())) return true;
  if (Array.isArray(body.incidentTypes) && body.incidentTypes.length) return true;
  const loc = body.location || {};
  if (loc.lat || loc.lng || (loc.description && loc.description.trim())) return true;
  const w = body.witness || {};
  if ((w.name && w.name.trim()) || (w.phone && w.phone.trim())) return true;
  if (Array.isArray(body.evidence) && body.evidence.some((e) => Object.values(e || {}).some((v) => String(v || '').trim()))) return true;
  return false;
}

function sanitizeReportInput(body) {
  const loc = body.location || {};
  const w = body.witness || {};
  return {
    incidentTypes: Array.isArray(body.incidentTypes) ? body.incidentTypes.filter((t) => INCIDENT_TYPES.includes(t)) : [],
    species: String(body.species || '').trim(),
    location: {
      lat: loc.lat === '' || loc.lat == null ? null : Number(loc.lat),
      lng: loc.lng === '' || loc.lng == null ? null : Number(loc.lng),
      description: String(loc.description || '').trim(),
      county: String(loc.county || '').trim(),
    },
    narrative: String(body.narrative || '').trim(),
    witness: { name: String(w.name || '').trim(), phone: String(w.phone || '').trim() },
    evidence: Array.isArray(body.evidence)
      ? body.evidence.map((e) => ({
          item: String(e.item || '').trim(),
          collector: String(e.collector || '').trim(),
          collectedAt: String(e.collectedAt || '').trim(),
          storage: String(e.storage || '').trim(),
        })).filter((e) => Object.values(e).some(Boolean))
      : [],
  };
}

// TR-03.2: required set = core fields + required fields of EVERY selected incident type.
function missingRequiredFields(r) {
  const missing = [];
  if (!r.incidentTypes.length) missing.push('Incident type');
  if (!r.species) missing.push('Species');
  if (r.location.lat == null || Number.isNaN(r.location.lat) || r.location.lng == null || Number.isNaN(r.location.lng)) missing.push('GPS coordinates');
  if (!r.location.county) missing.push('County');
  if (!r.narrative) missing.push('Narrative');
  if (r.incidentTypes.includes('poaching')) {
    // FR-11: structured evidence details required on any report that includes poaching.
    if (!r.evidence.length) missing.push('Evidence (at least one item for poaching)');
    r.evidence.forEach((e, i) => {
      ['item', 'collector', 'collectedAt', 'storage'].forEach((k) => {
        if (!e[k]) missing.push(`Evidence #${i + 1}: ${k}`);
      });
    });
  }
  return missing;
}

function snap(value, grid) { return Math.round(value / grid) * grid; }

function generalizeLocation(location, outcome) {
  if (outcome === 'full') return location;
  if (outcome === 'withheld') return '[REDACTED]';
  if (outcome === 'county') return { county: location.county, precision: 'county' };
  const grid = GRID_DEGREES[outcome];
  return {
    lat: Number(snap(location.lat, grid).toFixed(3)),
    lng: Number(snap(location.lng, grid).toFixed(3)),
    description: '[REDACTED]',
    county: location.county,
    precision: outcome === 'mile' ? 'within ~1 mile' : 'approximate (~0.25 mile)',
  };
}

// TR-05.4 / TR-05.5: build the recipient's view on the server. The client never receives restricted values.
function recipientView(report, role) {
  const rules = POLICY[role];
  if (!rules) return null;
  const ctx = { sensitive: isSensitiveSpecies(report.species), poaching: report.incidentTypes.includes('poaching') };
  const outcomes = {};
  const view = {
    id: report.id,
    reportNumber: report.reportNumber,
    status: report.status,
    incidentTypes: report.incidentTypes,
    species: report.species,
    narrative: report.narrative,
  };
  for (const [field, dataClass] of Object.entries(FIELD_DATA_CLASS)) {
    if (dataClass === 'general') continue;
    // TR-05.6: species not on the sensitive list get full location for every recipient of the report.
    let outcome = rules[dataClass](ctx);
    if (dataClass === 'location' && !ctx.sensitive && outcome !== 'withheld') outcome = 'full';
    outcomes[dataClass] = outcome;
    if (field === 'location') view.location = generalizeLocation(report.location, outcome);
    else view[field] = outcome === 'full' ? report[field] : '[REDACTED]';
  }
  view.disclosure = { role, roleLabel: ROLE_LABELS[role], sensitiveSpecies: ctx.sensitive, poachingCase: ctx.poaching, outcomes };
  return view;
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

function send(res, status, body) {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(json);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
  });
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.normalize(path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'Forbidden' });
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': (MIME[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
    res.end(buf);
  });
}

function summary(r) {
  return { id: r.id, reportNumber: r.reportNumber, status: r.status, species: r.species, incidentTypes: r.incidentTypes, updatedAt: r.updatedAt };
}

async function handleApi(req, res, url) {
  const user = req.headers['x-user'];
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'reports', ':id', 'submit']

  // Reference data for the UI
  if (req.method === 'GET' && url.pathname === '/api/meta') {
    return send(res, 200, { roles: ROLE_LABELS, incidentTypes: INCIDENT_TYPES, sensitiveSpecies: SENSITIVE_SPECIES });
  }

  // Disclosure audit log (TR-05.7)
  if (req.method === 'GET' && url.pathname === '/api/audit') {
    return send(res, 200, auditLog.slice(-50).reverse());
  }

  if (parts[0] !== 'api' || parts[1] !== 'reports') return send(res, 404, { error: 'Not found' });
  const id = parts[2];

  // GET /api/reports?status=Draft  -> the current ranger's drafts (TR-02.4)
  // GET /api/reports?status=Approved -> approved reports available to view
  if (req.method === 'GET' && !id) {
    const status = url.searchParams.get('status');
    if (status === 'Draft') {
      if (!user) return send(res, 401, { error: 'X-User header required' });
      const mine = [...reports.values()].filter((r) => r.status === 'Draft' && r.authorId === user);
      return send(res, 200, mine.map(summary));
    }
    const list = [...reports.values()].filter((r) => r.status !== 'Draft' && (!status || r.status === status));
    return send(res, 200, list.map(summary));
  }

  // POST /api/reports -> create a draft (TR-02.1, TR-02.3, TR-02.6, TR-10.1)
  if (req.method === 'POST' && !id) {
    if (!user) return send(res, 401, { error: 'X-User header required' });
    const body = await readJson(req);
    if (!hasAnyContent(body)) return send(res, 400, { error: 'An empty draft cannot be saved. Enter at least one field.' });
    const r = {
      id: crypto.randomUUID(), // device-style UUID; human-readable number assigned later (TR-10.2)
      reportNumber: null,
      status: 'Draft',
      authorId: user,
      ...sanitizeReportInput(body),
      createdAt: nowIso(), updatedAt: nowIso(),
    };
    reports.set(r.id, r);
    return send(res, 201, r);
  }

  const report = id ? reports.get(id) : null;
  if (id && !report) return send(res, 404, { error: 'Report not found' });

  // PUT /api/reports/:id -> update a draft (author only, Draft or Returned only)
  if (req.method === 'PUT' && id && !parts[3]) {
    if (report.authorId !== user) return send(res, 403, { error: 'Only the authoring ranger can edit this draft' });
    if (!['Draft', 'Returned'].includes(report.status)) return send(res, 409, { error: `Cannot edit a report in status ${report.status}` });
    const body = await readJson(req);
    Object.assign(report, sanitizeReportInput(body), { updatedAt: nowIso() });
    return send(res, 200, report);
  }

  // POST /api/reports/:id/submit -> server-side required-field check (TR-03.4)
  if (req.method === 'POST' && id && parts[3] === 'submit') {
    if (report.authorId !== user) return send(res, 403, { error: 'Only the authoring ranger can submit this report' });
    if (!['Draft', 'Returned'].includes(report.status)) return send(res, 409, { error: `Cannot submit a report in status ${report.status}` });
    const missing = missingRequiredFields(report);
    if (missing.length) return send(res, 422, { error: 'Required fields are incomplete', missing });
    report.status = 'Submitted';
    report.reportNumber = report.reportNumber || `NR-2026-${String(++sequence).padStart(5, '0')}`; // TR-10.2
    report.updatedAt = nowIso();
    return send(res, 200, report);
  }

  // GET /api/reports/:id -> author sees own draft in full; otherwise the X-Role recipient view (FR-05)
  if (req.method === 'GET' && id) {
    if (report.status === 'Draft') {
      if (report.authorId !== user) return send(res, 403, { error: 'Drafts are visible only to their author' });
      return send(res, 200, report);
    }
    const role = req.headers['x-role'];
    if (!POLICY[role]) return send(res, 400, { error: 'Unknown or missing X-Role', validRoles: Object.keys(POLICY) });
    const view = recipientView(report, role);
    auditLog.push({ at: nowIso(), reportNumber: report.reportNumber, role, outcomes: view.disclosure.outcomes });
    return send(res, 200, view);
  }

  return send(res, 405, { error: 'Method not allowed' });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      return serveStatic(req, res);
    } catch (err) {
      return send(res, 400, { error: 'Bad request', detail: err.message });
    }
  });
}

seed();

if (require.main === module) {
  createServer().listen(PORT, () => {
    console.log(`WildTrack RAD prototype running at http://localhost:${PORT}`);
  });
}

module.exports = { createServer, recipientView, missingRequiredFields, isSensitiveSpecies, reports };

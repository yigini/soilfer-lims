const jwt = require('jsonwebtoken');
const fs = require('fs');
const Database = require('better-sqlite3');

let secret = process.env.JWT_SECRET;
if (!secret && fs.existsSync('prisma/.jwt_secret')) {
  secret = fs.readFileSync('prisma/.jwt_secret', 'utf8').trim();
}
if (!secret && fs.existsSync('/app/server/prisma/.jwt_secret')) {
  secret = fs.readFileSync('/app/server/prisma/.jwt_secret', 'utf8').trim();
}
if (!secret) {
  console.error('❌ Postflight failed: JWT secret not found!');
  process.exit(1);
}

const adminId = process.env.POSTFLIGHT_ADMIN_ID;
const mgrId = process.env.POSTFLIGHT_MANAGER_ID;
const techId = process.env.POSTFLIGHT_TECH_ID;

if (!adminId || !mgrId || !techId) {
  console.error('❌ Postflight failed: POSTFLIGHT_ADMIN_ID, POSTFLIGHT_MANAGER_ID, and POSTFLIGHT_TECH_ID must all be explicitly defined.');
  process.exit(1);
}

const dbPath = fs.existsSync('prisma/dev.db') ? 'prisma/dev.db' : (fs.existsSync('/app/server/prisma/dev.db') ? '/app/server/prisma/dev.db' : 'dev.db');
let db;
let adminPrincipal, mgrPrincipal, techPrincipal;
try {
  db = new Database(dbPath, { readonly: true });
  adminPrincipal = db.prepare('SELECT id, username, role, labId, countries, projects, tokenVersion, mustChangePassword, isActive FROM User WHERE id = ?').get(adminId);
  mgrPrincipal = db.prepare('SELECT id, username, role, labId, countries, projects, tokenVersion, mustChangePassword, isActive FROM User WHERE id = ?').get(mgrId);
  techPrincipal = db.prepare('SELECT id, username, role, labId, countries, projects, tokenVersion, mustChangePassword, isActive FROM User WHERE id = ?').get(techId);
  db.close();
} catch (err) {
  console.error('❌ Postflight failed: Database error looking up reviewed principals:', err.message);
  process.exit(1);
}

if (!adminPrincipal || adminPrincipal.role !== 'SUPER_ADMIN' || !adminPrincipal.isActive || adminPrincipal.mustChangePassword) {
  console.error('❌ Postflight failed: Reviewed active SUPER_ADMIN principal (' + adminId + ') not found, inactive, wrong role, or password not changed!');
  process.exit(1);
}
if (!mgrPrincipal || mgrPrincipal.role !== 'LAB_MANAGER' || !mgrPrincipal.isActive || mgrPrincipal.mustChangePassword) {
  console.error('❌ Postflight failed: Reviewed active LAB_MANAGER principal (' + mgrId + ') not found, inactive, wrong role, or password not changed!');
  process.exit(1);
}
if (!techPrincipal || techPrincipal.role !== 'LAB_TECHNICIAN' || !techPrincipal.isActive || techPrincipal.mustChangePassword) {
  console.error('❌ Postflight failed: Reviewed active LAB_TECHNICIAN principal (' + techId + ') not found, inactive, wrong role, or password not changed!');
  process.exit(1);
}

const superToken = jwt.sign({
  id: adminPrincipal.id,
  username: adminPrincipal.username,
  role: adminPrincipal.role,
  tokenVersion: adminPrincipal.tokenVersion || 0
}, secret, { expiresIn: '5m' });

const mgrToken = jwt.sign({
  id: mgrPrincipal.id,
  username: mgrPrincipal.username,
  role: mgrPrincipal.role,
  labId: mgrPrincipal.labId,
  tokenVersion: mgrPrincipal.tokenVersion || 0
}, secret, { expiresIn: '5m' });

const techToken = jwt.sign({
  id: techPrincipal.id,
  username: techPrincipal.username,
  role: techPrincipal.role,
  labId: techPrincipal.labId,
  tokenVersion: techPrincipal.tokenVersion || 0
}, secret, { expiresIn: '5m' });

function parseArray(val, fieldName) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (!Array.isArray(parsed)) {
        console.error(`❌ Malformed ${fieldName} metadata for principal: expected JSON array, got ${typeof parsed}`);
        process.exit(1);
      }
      return parsed;
    } catch (err) {
      console.error(`❌ Failed to parse ${fieldName} JSON metadata for principal: ${err.message}`);
      process.exit(1);
    }
  }
  console.error(`❌ Invalid ${fieldName} metadata for principal: expected array or string, got ${typeof val}`);
  process.exit(1);
}

const baseUrl = process.env.POSTFLIGHT_BASE_URL || 'http://127.0.0.1:3000';

async function checkRoute(role, path, expectedStatus, token, principal) {
  const res = await fetch(baseUrl + path, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (res.status !== expectedStatus) {
    console.error(`❌ Role gate failed for ${role} on ${path}: expected ${expectedStatus}, got ${res.status}`);
    process.exit(1);
  }
  let body;
  try {
    body = await res.json();
  } catch (err) {
    console.error(`❌ Role gate failed for ${role} on ${path}: Response is not valid JSON (${err.message})`);
    process.exit(1);
  }
  if (!body || typeof body !== 'object') {
    console.error(`❌ Role gate failed for ${role} on ${path}: Invalid response body structure`);
    process.exit(1);
  }

  // Route-specific envelope and schema validation
  let records = [];
  if (path === '/api/work') {
    if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.data)) {
      console.error(`❌ Invalid schema for ${path}: expected envelope object with array 'data'`);
      process.exit(1);
    }
    records = body.data;
  } else if (path === '/api/users') {
    if (Array.isArray(body)) {
      records = body;
    } else if (Array.isArray(body.data)) {
      records = body.data;
    } else if (Array.isArray(body.users)) {
      records = body.users;
    } else {
      console.error(`❌ Invalid schema for ${path}: expected array or envelope with 'data'/'users' array`);
      process.exit(1);
    }
  } else if (path === '/api/labs' || path === '/api/submissions') {
    if (Array.isArray(body)) {
      records = body;
    } else if (Array.isArray(body.data)) {
      records = body.data;
    } else {
      console.error(`❌ Invalid schema for ${path}: expected array of records`);
      process.exit(1);
    }
  } else if (path === '/api/dashboard/live') {
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        !Array.isArray(body.intakeQueue) || !Array.isArray(body.reviewQueue) || !Array.isArray(body.oversight)) {
      console.error(`❌ Invalid schema for ${path}: expected dashboard object with intakeQueue, reviewQueue, and oversight arrays`);
      process.exit(1);
    }
    records = [
      ...body.intakeQueue,
      ...body.reviewQueue,
      ...body.oversight
    ];
  } else {
    if (Array.isArray(body)) {
      records = body;
    } else if (Array.isArray(body.data)) {
      records = body.data;
    } else {
      console.error(`❌ Invalid schema for ${path}: unknown envelope`);
      process.exit(1);
    }
  }

  // Validate that every record in records is a valid, non-null record object with required content identity
  for (const item of records) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      console.error(`❌ Role gate failed for ${role} on ${path}: Record is not a valid non-null object (${JSON.stringify(item)})`);
      process.exit(1);
    }
    if (path === '/api/work') {
      if (!item.id || (!item.assignedLab && !item.labId) || (!item.status && !item.analysis)) {
        console.error(`❌ Record content validation failed for ${path}: Missing required work item fields (id, assignedLab/labId, status/analysis)`);
        process.exit(1);
      }
    } else if (path === '/api/submissions') {
      if (!item.id || (!item.assignedLab && !item.labId && !item.sampleId)) {
        console.error(`❌ Record content validation failed for ${path}: Missing required submission fields (id, assignedLab/labId/sampleId)`);
        process.exit(1);
      }
    } else if (path === '/api/users') {
      if (!item.id || !item.username) {
        console.error(`❌ Record content validation failed for ${path}: Missing required user fields (id, username)`);
        process.exit(1);
      }
    } else if (path === '/api/labs') {
      if (!item.id) {
        console.error(`❌ Record content validation failed for ${path}: Missing required lab field (id)`);
        process.exit(1);
      }
    }
  }

  // Route-specific and role-specific scope validation
  if (principal.role !== 'SUPER_ADMIN') {
    const userLabId = principal.labId || null;
    const userProjects = parseArray(principal.projects, 'projects');
    const userCountries = parseArray(principal.countries, 'countries');

    for (const item of records) {
      // 0. Technician assignee validation on /api/work
      if (principal.role === 'LAB_TECHNICIAN' && path === '/api/work') {
        if (!item.assignedTo || item.assignedTo !== principal.username) {
          console.error(`❌ Scope violation: work item assignedTo '${item.assignedTo}' does not match technician username '${principal.username}' for ${role} on ${path}`);
          process.exit(1);
        }
      }

      // 1. Facility assignedLab scoping (distinguished from specimen accession labId)
      if (userLabId) {
        if (item.assignedLab && item.assignedLab !== userLabId) {
          console.error(`❌ Scope violation: item assignedLab '${item.assignedLab}' does not match principal labId '${userLabId}' for ${role} on ${path}`);
          process.exit(1);
        }
      } else {
        // Principal has NO assigned lab: must not receive facility-assigned records unless authorized by project/country
        if (item.assignedLab) {
          if (!userProjects.length || (item.projectCode && !userProjects.includes(item.projectCode))) {
            console.error(`❌ Scope violation: unassigned-lab principal received facility record '${item.assignedLab}' for ${role} on ${path}`);
            process.exit(1);
          }
        }
      }

      // 2. Project scoping (route-specific):
      // /api/submissions controller scopes LAB_MANAGER strictly by assignedLab (facility),
      // so an own-facility manager legitimately processes samples from any project at their lab.
      // /api/work controller scopes LAB_TECHNICIAN strictly by assignedLab and assignedTo,
      // so an own-facility technician legitimately processes assigned work from any project at their lab.
      // For other routes or when userLabId is not set, enforce project allow-list.
      if ((path !== '/api/submissions' && path !== '/api/work') || !userLabId) {
        const itemProjectCode = item.projectCode || (item.sample && item.sample.projectCode);
        if (userProjects.length > 0 && itemProjectCode && !userProjects.includes(itemProjectCode)) {
          console.error(`❌ Scope violation: item projectCode '${itemProjectCode}' outside authorized projects for ${role} on ${path}`);
          process.exit(1);
        }
      }

      // 3. Country scoping
      if (item.country && !userCountries.includes('*') && !userCountries.includes(item.country)) {
        console.error(`❌ Scope violation: item country '${item.country}' outside authorized countries for ${role} on ${path}`);
        process.exit(1);
      }

      // 4. Lab catalogue scoping on /api/labs
      if (path === '/api/labs' && userLabId && item.id && item.id !== userLabId) {
        console.error(`❌ Scope violation: lab ID '${item.id}' does not match principal labId '${userLabId}' for ${role} on ${path}`);
        process.exit(1);
      }

      // 5. Unscoped principal receiving scoped record
      if (!userLabId && userProjects.length === 0 && userCountries.length === 0) {
        if (item.assignedLab || item.projectCode || item.country) {
          console.error(`❌ Scope violation: unscoped principal received scoped record for ${role} on ${path}`);
          process.exit(1);
        }
      }
    }
  }
  console.log(`  ✓ ${role} -> ${path} (${res.status} OK, records: ${records.length})`);
}

(async () => {
  await checkRoute('SUPER_ADMIN', '/api/users', 200, superToken, adminPrincipal);
  await checkRoute('SUPER_ADMIN', '/api/labs', 200, superToken, adminPrincipal);
  await checkRoute('LAB_MANAGER', '/api/dashboard/live', 200, mgrToken, mgrPrincipal);
  await checkRoute('LAB_MANAGER', '/api/submissions', 200, mgrToken, mgrPrincipal);
  await checkRoute('LAB_TECHNICIAN', '/api/work', 200, techToken, techPrincipal);
  console.log('✓ Read-only role and route API postflight gates verified.');
})().catch(e => { console.error('Postflight API error:', e.message); process.exit(1); });

const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const vm = require('vm');
const assert = require('assert/strict');
const { createRequire } = require('module');

const repo = 'C:/Users/yigin/Documents/soilfer-lims';
function source(p) { return fs.readFileSync(path.join(repo, p), 'utf8').replace(/\r/g, ''); }
function slice(s, start, end) {
  const a = s.indexOf(start), b = s.indexOf(end, a);
  assert(a >= 0 && b > a, 'Missing anchor ' + start);
  return s.slice(a, b);
}

const guide = source('docs/UPGRADING.md');
const blocks = [...guide.matchAll(/```bash\n([\s\S]*?)\n```/g)].map(m => m[1]);

const post = blocks.find(b => b.includes('LIVE_CONTAINER_ID='));
const launch = blocks.find(b => b.includes('# Ingress Hold:'));
const reopen = blocks.find(b => b.includes('Reopening public ingress'));

assert(post, 'Missing post block');
assert(launch, 'Missing launch block');
assert(reopen, 'Missing reopen block');

const hold = post.slice(post.indexOf('# 7. Verify NGINX'));
assert(hold, 'Missing hold slice');

console.log('✓ Found all required anchors in docs/UPGRADING.md');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-continuation5-'));
const results = { scratch, cases: [] };

function shell(name, code, env, expected) {
  const pre = String.raw`COMPOSE_FILES='-f docker-compose.yml -f docker-compose.nginx.yml'
touch docker-compose.nginx.yml
proxy_state=true
if [ "$INITIAL_PROXY_STATE" = false ]; then proxy_state=false; fi
docker(){
 printf 'docker %s\n' "$*" >> "$TRACE_PATH"
 case "$*" in
  *'stop nginx'*) [ "$STOP_FAIL" = 1 ] && return 49; proxy_state=false; return 0;;
  *'up -d lims'*) printf 'LAUNCHED LIMS; proxy_state=%s\n' "$proxy_state"; return 0;;
  *'up -d nginx'*) proxy_state=true; return 0;;
  *'ps -q nginx'*) [ "$PS_FAIL" = 1 ] && return 49; if [ "$INCLUDE_STOPPED" = 1 ] || [ "$proxy_state" = true ]; then printf 'fixture-nginx\n'; fi; return 0;;
  *'.State.Running'*) [ "$PROXY_INSPECT_FAIL" = 1 ] && return 49; printf '%s\n' "$proxy_state"; return 0;;
 esac
 return 1
}
curl(){ printf 'curl %s\n' "$*" >> "$TRACE_PATH"; [ "$HEALTH_FAIL" = 1 ] && return 22; printf '{"status":"ok"}\n'; return 0; }
`;
  const file = path.join(scratch, name + '.sh'), trace = path.join(scratch, name + '.trace');
  fs.writeFileSync(file, '#!/bin/bash\nset -e\n' + pre + '\n' + code + '\n');
  const r = cp.spawnSync('C:/Program Files/Git/bin/bash.exe', [file], {
    cwd: scratch,
    env: { ...process.env, STOP_FAIL: '0', PS_FAIL: '0', PROXY_INSPECT_FAIL: '0', INCLUDE_STOPPED: '0', HEALTH_FAIL: '0', TRACE_PATH: trace, ...env },
    encoding: 'utf8',
    timeout: 10000
  });
  assert.ifError(r.error);
  assert.equal(r.status, expected, `Test '${name}' expected exit ${expected}, got ${r.status}. Output:\n${r.stdout}\n${r.stderr}`);
  const row = { name, exit: r.status, output: r.stdout + r.stderr, trace: fs.readFileSync(trace, 'utf8') };
  results.cases.push(row);
  console.log(`  ✓ Shell test passed: ${name} (exit ${r.status})`);
  return row;
}

console.log('\n--- Running Ingress Shell Tests ---');
shell('successful-stop-and-compatible-hold-now-pass', launch + '\n' + hold, {}, 0);
const stopped = shell('failed-stop-now-aborts-before-lims-launch', launch, { STOP_FAIL: '1' }, 1);
assert(!stopped.trace.includes('up -d lims'));
shell('observed-running-proxy-rejects', hold, {}, 1);
shell('observed-stopped-proxy-passes', hold, { INITIAL_PROXY_STATE: 'false', INCLUDE_STOPPED: '1' }, 0);
shell('failed-proxy-inspection-now-aborts', hold, { PROXY_INSPECT_FAIL: '1' }, 1);
shell('failed-proxy-list-now-aborts', hold, { PS_FAIL: '1' }, 1);
shell('deliberate-reopening-positive', reopen, {}, 0);
shell('reopening-failed-inspection-rejects', reopen, { PROXY_INSPECT_FAIL: '1' }, 1);
shell('reopening-failed-public-health-rejects', reopen, { HEALTH_FAIL: '1' }, 1);

// Direct topology shell tests
function shellDirect(name, code, env, expected) {
  const pre = String.raw`COMPOSE_FILES='-f docker-compose.yml'
LIVE_CONTAINER_ID='direct-lims'
docker(){
 printf 'docker %s\n' "$*" >> "$TRACE_PATH"
 case "$*" in
  *'up -d lims'*) printf 'LAUNCHED DIRECT LIMS; PORT=%s\n' "$PORT"; return 0;;
  *'.NetworkSettings.Ports'*) [ "$INSPECT_FAIL" = 1 ] && return 49; printf '%s\n' "$MOCK_HOST_IP"; return 0;;
 esac
 return 1
}
curl(){ printf 'curl %s\n' "$*" >> "$TRACE_PATH"; [ "$HEALTH_FAIL" = 1 ] && return 22; printf '{"status":"ok"}\n'; return 0; }
`;
  const file = path.join(scratch, name + '.sh'), trace = path.join(scratch, name + '.trace');
  fs.writeFileSync(file, '#!/bin/bash\nset -e\n' + pre + '\n' + code + '\n');
  const r = cp.spawnSync('C:/Program Files/Git/bin/bash.exe', [file], {
    cwd: scratch,
    env: { ...process.env, INSPECT_FAIL: '0', HEALTH_FAIL: '0', TRACE_PATH: trace, ...env },
    encoding: 'utf8',
    timeout: 10000
  });
  assert.ifError(r.error);
  assert.equal(r.status, expected, `Direct test '${name}' expected exit ${expected}, got ${r.status}. Output:\n${r.stdout}\n${r.stderr}`);
  console.log(`  ✓ Direct shell test passed: ${name} (exit ${r.status})`);
}

console.log('\n--- Running Direct Topology Shell Tests ---');
shellDirect('direct-launch-and-hold-passes', launch + '\n' + hold, { MOCK_HOST_IP: '127.0.0.1' }, 0);
shellDirect('direct-hold-exposed-public-interface-rejects', hold, { MOCK_HOST_IP: '0.0.0.0' }, 1);
shellDirect('direct-reopening-positive', reopen, {}, 0);
shellDirect('direct-reopening-health-failure-rejects', reopen, { HEALTH_FAIL: '1' }, 1);

async function main() {
  console.log('\n--- Running Role & Scope API Tests ---');
  const jwt = createRequire(repo + '/server/package.json')('jsonwebtoken');
  const session = source('server/services/sessionValidationService.js');
  const js = slice(post, '  const jwt =', '\n"\n\n# 7. Verify NGINX').replace(/\\`/g, '`').replace(/\\\$/g, '$');

  const admin = { id: 'reviewed-admin', username: 'fixture-admin', role: 'SUPER_ADMIN', tokenVersion: 1, isActive: 1, mustChangePassword: 0 };
  const mgr = { id: 'reviewed-manager', username: 'fixture-manager', role: 'LAB_MANAGER', labId: 'lab-own', tokenVersion: 2, isActive: 1, mustChangePassword: 0, countries: '[]', projects: '[]' };
  const tech = { id: 'reviewed-tech', username: 'fixture-tech', role: 'LAB_TECHNICIAN', labId: 'lab-own', tokenVersion: 3, isActive: 1, mustChangePassword: 0, countries: '[]', projects: '[]' };
  const explicit = { POSTFLIGHT_ADMIN_ID: admin.id, POSTFLIGHT_MANAGER_ID: mgr.id, POSTFLIGHT_TECH_ID: tech.id };

  const emptyResponses = {
    '/api/users': { data: [], users: [], pagination: { total: 0 }, meta: { total: 0 } },
    '/api/labs': [],
    '/api/submissions': [],
    '/api/work': { data: [], meta: { total: 0 }, pagination: { total: 0 } },
    '/api/dashboard/live': { role: 'LAB_MANAGER', kpis: {}, intakeQueue: [], reviewQueue: [], oversight: [], techWorkload: [], recentActivity: [], warnings: [], timestamp: '2030-01-01T00:00:00Z' }
  };

  async function roleCase(name, users, expected, opt = {}) {
    const sm = { exports: {} }, calls = [], logs = [];
    let exit = 0;
    const secret = 'synthetic-3de2a25-review-only';

    vm.runInNewContext(session, {
      module: sm,
      exports: sm.exports,
      require: p => {
        assert.equal(p, '../prisma');
        return { user: { findUnique: async ({ where }) => users.find(u => u.id === where.id) || null } };
      }
    }, { timeout: 1000 });

    class Database {
      prepare(sql) { return { get: arg => users.find(u => u.id === arg) }; }
      close() {}
    }

    const sandbox = {
      require: p => p === 'jsonwebtoken' ? jwt : p === 'fs' ? { existsSync: () => false } : p === 'better-sqlite3' ? Database : (() => { throw Error('Unexpected ' + p) })(),
      process: {
        env: { JWT_SECRET: secret, ...explicit },
        exit: n => { const e = new Error('fixture exit'); e.code = n; throw e; }
      },
      console: {
        log: (...v) => logs.push(v.join(' ')),
        error: (...v) => logs.push(v.join(' '))
      },
      fetch: async (url, init) => {
        const decoded = jwt.verify(init.headers.Authorization.split(' ')[1], secret);
        const decision = await sm.exports.validateUserPrincipal(decoded, { currentPath: new URL(url).pathname });
        calls.push({ url, id: decoded.id, status: decision.valid ? 200 : decision.statusCode });
        return {
          status: decision.valid ? 200 : decision.statusCode,
          json: async () => {
            if (opt.jsonError) throw Error('invalid response JSON');
            const route = new URL(url).pathname;
            return Object.hasOwn(opt.bodies || {}, route) ? opt.bodies[route] : emptyResponses[route];
          }
        };
      }
    };

    try { await vm.runInNewContext(js, sandbox, { timeout: 1000 }); } catch (e) { exit = e.code || 99; }
    assert.equal(exit, expected, `RoleCase '${name}' expected exit ${expected}, got ${exit}. Logs:\n${logs.join('\n')}`);
    results.cases.push({ name, exit, calls, logs });
    console.log(`  ✓ Role case passed: ${name} (exit ${exit})`);
  }

  await roleCase('actual-empty-envelope-positive', [admin, mgr, tech], 0);
  await roleCase('ordinary-foreign-work-envelope-now-rejects', [admin, mgr, tech], 1, { bodies: { '/api/work': { data: [{ id: 'ordinary-id', assignedLab: 'lab-other' }], meta: { total: 1 }, pagination: { total: 1 } } } });
  await roleCase('null-lab-foreign-project-submission-now-rejects', [admin, { ...mgr, labId: null, projects: '["OWN-PROJECT"]' }, tech], 1, { bodies: { '/api/submissions': [{ id: 'ordinary-id', assignedLab: 'lab-other', projectCode: 'OTHER-PROJECT' }] } });
  await roleCase('invalid-JSON-now-rejects', [admin, mgr, tech], 1, { jsonError: true });

  // Schema and record shape validation
  await roleCase('unrecognized-object-envelope-now-rejects', [admin, mgr, tech], 1, { bodies: { '/api/work': { unexpected: [{ id: 'ordinary-id', assignedLab: 'lab-other' }] } } });
  await roleCase('wrong-data-type-envelope-now-rejects', [admin, mgr, tech], 1, { bodies: { '/api/work': { data: { id: 'ordinary-id', assignedLab: 'lab-other' } } } });
  await roleCase('null-and-scalar-records-now-reject', [admin, mgr, tech], 1, { bodies: { '/api/work': { data: [null, 'ordinary-id'], meta: { total: 2 }, pagination: { total: 2 } } } });

  // Malformed metadata parsing
  await roleCase('malformed-metadata-projects-now-rejects', [admin, { ...mgr, projects: '["unclosed' }, tech], 1);
  await roleCase('malformed-metadata-countries-now-rejects', [admin, { ...mgr, countries: 'not-json' }, tech], 1);

  // Exact real listSubmissions controller
  const submissionSource = source('server/controllers/submissionController.js');
  const handler = slice(submissionSource, 'exports.listSubmissions = async', 'exports.getSubmission = async');
  const exportsObj = {}, controllerQueries = [];
  let actualBody;
  vm.runInNewContext(handler, {
    exports: exportsObj,
    console,
    prisma: {
      submission: {
        findMany: async ({ where }) => {
          controllerQueries.push(where);
          assert.equal(where.assignedLab, 'lab-own');
          assert.equal(where.projectCode, undefined);
          return [{ id: 'ordinary-own-submission', sampleId: 'sample-own', assignedLab: 'lab-own', submittedBy: 'fixture-tech' }];
        }
      },
      sample: {
        findMany: async () => [{ id: 'sample-own', labId: 'SPECIMEN-ACCESSION', originalId: 'SPECIMEN-ORIGINAL', projectCode: 'OTHER-PROJECT' }]
      }
    }
  }, { timeout: 1000 });

  await exportsObj.listSubmissions(
    { user: { ...mgr, projects: '["OWN-PROJECT"]' }, query: {} },
    { json: b => { actualBody = b; }, status: () => { throw Error('Unexpected controller failure'); } }
  );

  assert.equal(actualBody[0].assignedLab, 'lab-own');
  assert.equal(actualBody[0].projectCode, 'OTHER-PROJECT');

  console.log('\n--- Testing Controller Allowed Submission ---');
  await roleCase('actual-route-allowed-submission-now-passes', [admin, { ...mgr, projects: '["OWN-PROJECT"]' }, tech], 0, { bodies: { '/api/submissions': actualBody } });

  console.log('\n========================================');
  console.log('  ALL 24 CONTROLS PASSED WITH 100% SUCCESS');
  console.log('========================================\n');
}

main().catch(e => { console.error(e.stack); process.exit(1); });

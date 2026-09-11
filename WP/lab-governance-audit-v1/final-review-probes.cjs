'use strict';
// Independent follow-up probes: fictional fixtures in a new schema-only database.
// The source database is opened read-only; no existing data rows are copied.
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { randomUUID, createHash } = require('crypto');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const req = createRequire(path.join(root, 'server/package.json'));
const Database = req('better-sqlite3');
const outputDir = path.join(__dirname, 'independent-review');
const dbPath = path.join(outputDir, `disposable-final-${randomUUID()}.db`);
const sourcePath = path.join(root, 'server/prisma/dev.db');
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sourceHashBefore = hash(sourcePath);
const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
const ddl = source.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND type IN ('table','index') ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END").all();
source.close();
if (!dbPath.startsWith(outputDir + path.sep) || fs.existsSync(dbPath)) throw Error('Unsafe destination');
const empty = new Database(dbPath);
empty.pragma('foreign_keys=OFF');
for (const { sql } of ddl) empty.exec(sql);
empty.pragma('foreign_keys=ON');
empty.close();
process.env.DATABASE_PATH = dbPath;
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'fictional-final-review-only';
const print = console.log;
console.log = () => {};
console.warn = () => {};
const prisma = req('./prisma');
const app = req('./app');
const request = req('supertest');
const jwt = req('jsonwebtoken');
const labLifecycle = req('./services/labLifecycleService');
const results = [];
function record(id, description, expected, actual, passed) {
    results.push({ id, description, expected, actual, passed });
}
const token = (u, omitVersion = false) => jwt.sign({ id: u.id, username: u.username, role: u.role, ...(omitVersion ? {} : { tokenVersion: u.tokenVersion || 0 }) }, process.env.JWT_SECRET, { expiresIn: '1h' });
const call = (u, method, url, body) => request(app)[method](url).set('Authorization', `Bearer ${token(u)}`).send(body);
const makeUser = (id, role, labId, countries = '[]') => prisma.user.create({ data: { id, username: `${id}-login`, email: `${id}@example.invalid`, password: 'FICTIONAL_TEST_HASH', role, labId, countries, projects: '[]', isActive: true } });
async function main() {
    for (const [id, country, active] of [['FINAL-A', 'Guatemala', true], ['FINAL-B', 'France', true], ['FINAL-SETUP', 'Guatemala', false]]) {
        await prisma.lab.create({ data: { id, code: id, name: id, country, isActive: active, timezone: 'UTC' } });
    }
    const admin = await makeUser('final-admin', 'SUPER_ADMIN', null);
    const national = await makeUser('final-national', 'MASTER_USER', null, '["Guatemala"]');
    const manager = await makeUser('final-manager', 'LAB_MANAGER', 'FINAL-A');
    let tech = await makeUser('final-tech', 'LAB_TECHNICIAN', 'FINAL-A');
    await labLifecycle.getLabOperationalState('FINAL-SETUP');
    await prisma.$executeRawUnsafe('INSERT OR REPLACE INTO "LabLifecycleState" ("labId","operationalStatus","revision") VALUES (?,?,?)', 'FINAL-SETUP', 'SETUP', 1);

    let r = await call(national, 'post', '/api/staff/invitations', { name: 'Fictional Foreign Invite', email: 'foreign-invite@example.invalid', role: 'LAB_TECHNICIAN', labId: 'FINAL-B' });
    const foreignInvites = await prisma.$queryRawUnsafe('SELECT COUNT(*) AS n FROM "StaffInvitation" WHERE "labId" = ?', 'FINAL-B');
    record('F01', 'Guatemala national lead invites staff into France laboratory', { http: 403, persistedInvitations: 0 }, { http: r.status, persistedInvitations: Number(foreignInvites[0].n) }, r.status === 403 && Number(foreignInvites[0].n) === 0);
    r = await call(national, 'post', '/api/staff/invitations', { name: 'Fictional Local Invite', email: 'local-invite@example.invalid', role: 'LAB_TECHNICIAN', labId: 'FINAL-A' });
    record('C01', 'National lead can invite allowed staff inside their own country', { http: 201 }, { http: r.status }, r.status === 201);
    r = await call(admin, 'post', '/api/staff/invitations', { name: 'Fictional Setup Manager', email: 'setup-manager@example.invalid', role: 'LAB_MANAGER', labId: 'FINAL-SETUP' });
    record('F02', 'Administrator appoints a pending manager while lab is in SETUP, as specified by onboarding scenario', { http: 201 }, { http: r.status, code: r.body.code }, r.status === 201);

    await prisma.project.create({ data: { id: 'final-project', code: 'FINAL-PROJECT', name: 'Fictional Junction Project', status: 'ACTIVE', labId: 'FINAL-B', assignedLabIds: '[]' } });
    await prisma.projectLab.create({ data: { id: 'final-junction', projectCode: 'FINAL-PROJECT', labId: 'FINAL-A', role: 'BACKUP' } });
    for (const [id, status] of [['final-expected', 'EXPECTED'], ['final-released', 'RELEASED']]) {
        await prisma.sample.create({ data: { id, originalId: id, labId: `ACCESSION-${id}`, assignedLab: 'FINAL-A', status } });
    }
    r = await call(manager, 'get', '/api/labs/FINAL-A/workspace');
    record('F03', 'Junction-only servicing project appears in laboratory workspace', { http: 200, projectVisible: true }, { http: r.status, projectVisible: !!r.body.projects?.some(p => p.code === 'FINAL-PROJECT') }, r.status === 200 && !!r.body.projects?.some(p => p.code === 'FINAL-PROJECT'));
    record('F04', 'Expected and released samples are excluded from active laboratory workload', { activeSamples: 0 }, { activeSamples: r.body.workload?.samples?.active, expected: r.body.workload?.samples?.expected, released: r.body.workload?.samples?.released }, r.body.workload?.samples?.active === 0);
    await prisma.sample.create({ data: { id: 'final-inwork', originalId: 'final-inwork', labId: 'ACCESSION-INWORK', assignedLab: 'FINAL-A', status: 'ACCEPTED', receptionDate: new Date(), dryingStatus: 'DONE', preparationStatus: 'DONE' } });
    await prisma.workItem.create({ data: { id: 'final-submitted', sampleId: 'final-inwork', analysis: 'PH_H2O', labId: 'FINAL-A', assignedLab: 'FINAL-A', assignedTo: tech.username, status: 'SUBMITTED' } });
    r = await call(manager, 'post', `/api/users/${tech.id}/access-preview`, { role: 'VIEWER' });
    record('F05', 'Access review accounts for submitted work awaiting review before role removal', { openAssignmentsAtLeast: 1 }, { http: r.status, openAssignmentsCount: r.body.openAssignmentsCount }, r.status === 200 && r.body.openAssignmentsCount >= 1);

    // Compare current HTTP and SIS authentication for a signed legacy token after revocation.
    const legacy = token(admin, true);
    await prisma.user.update({ where: { id: admin.id }, data: { tokenVersion: { increment: 1 } } });
    const http = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${legacy}`);
    const sis = await request(app).get('/api/v1/sis/samples').set('Authorization', `Bearer ${legacy}`);
    record('F06', 'Revoked legacy JWT without tokenVersion is rejected consistently by HTTP and SIS', { http: 401, sis: 401 }, { http: http.status, sis: sis.status }, http.status === 401 && sis.status === 401);

    // An established socket must stop receiving the prior lab's updates after suspension.
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const wsServer = req('./wsServer');
    wsServer.init(server);
    const WS = req('ws');
    const socket = new WS(`ws://127.0.0.1:${server.address().port}/ws`, [token(tech)]);
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('Socket authentication timeout')), 3000);
        socket.on('message', m => { if (JSON.parse(m).type === 'CONNECTED') { clearTimeout(timer); resolve(); } });
        socket.once('error', e => { clearTimeout(timer); reject(e); });
    });
    let receivedAfterSuspend = false;
    socket.on('message', m => { if (JSON.parse(m).type === 'FINAL_REVIEW_PING') receivedAfterSuspend = true; });
    r = await call(manager, 'post', `/api/users/${tech.id}/suspend`, { reason: 'Fictional independent review' });
    wsServer.broadcastToLab('FINAL-A', 'FINAL_REVIEW_PING', { fictional: true });
    await new Promise(resolve => setTimeout(resolve, 100));
    record('F07', 'Suspension revokes an already connected socket before further lab events', { suspendHttp: 200, receivedAfterSuspend: false, socketOpen: false }, { suspendHttp: r.status, receivedAfterSuspend, socketOpen: socket.readyState === WS.OPEN }, r.status === 200 && !receivedAfterSuspend && socket.readyState !== WS.OPEN);
    socket.terminate();
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
    const report = { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), timestamp: new Date().toISOString(), database: dbPath, schemaSource: 'Read-only SQL schema; no existing data rows copied', sourceHashBefore, sourceHashAfter: hash(sourcePath), results };
    fs.writeFileSync(path.join(outputDir, 'final-review-results.json'), JSON.stringify(report, null, 2));
    print(JSON.stringify(report, null, 2));
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });

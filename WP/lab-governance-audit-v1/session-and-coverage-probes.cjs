'use strict';
// Additional original IR-09 / A13-A15 and IR-04 / A38 checks.
// Reuses only the verified schema-only fixture bootstrap, never existing rows.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const bootstrapPath = path.join(__dirname, 'final-review-probes.cjs');
const bootstrap = fs.readFileSync(bootstrapPath, 'utf8').split('async function main() {')[0];
const probeBody = String.raw`
async function main() {
    const staff = req('./services/staffLifecycleService');
    const WS = req('ws');
    const wsServer = req('./wsServer');
    await prisma.lab.create({ data: { id: 'COVER-LAB', code: 'COVER-LAB', name: 'Fictional review lab', country: 'Guatemala', isActive: true } });
    const admin = await makeUser('cover-admin', 'SUPER_ADMIN', null);
    const actor = await makeUser('cover-actor', 'SUPER_ADMIN', null);
    const target = await makeUser('cover-target', 'LAB_TECHNICIAN', 'COVER-LAB');
    const txTarget = await makeUser('cover-tx', 'LAB_TECHNICIAN', 'COVER-LAB');
    const resetTarget = await makeUser('cover-reset', 'LAB_MANAGER', 'COVER-LAB');
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    wsServer.init(server);
    const sockets = [];
    const connect = rawToken => new Promise(resolve => {
        const socket = new WS('ws://127.0.0.1:' + server.address().port + '/ws', [rawToken]);
        sockets.push(socket);
        const timer = setTimeout(() => { socket.terminate(); resolve({ socket, connected: false, timedOut: true }); }, 2500);
        socket.on('message', m => { if (JSON.parse(m).type === 'CONNECTED') { clearTimeout(timer); resolve({ socket, connected: true }); } });
        socket.once('close', code => { clearTimeout(timer); resolve({ socket, connected: false, closeCode: code }); });
        socket.once('error', () => { clearTimeout(timer); resolve({ socket, connected: false, error: true }); });
    });
    const pause = () => new Promise(resolve => setTimeout(resolve, 100));
    const txSocket = await connect(token(txTarget));
    const calls = [];
    const originalRevoke = wsServer.revokeUserSockets;
    wsServer.revokeUserSockets = id => { calls.push(id); return originalRevoke(id); };
    let rollbackMessage;
    try {
        await staff.withTransaction(async tx => {
            await staff.suspendUser(admin, txTarget.id, { reason: 'Fictional rollback probe' }, tx);
            if (calls.includes(txTarget.id)) throw Error('PREMATURE_REVOCATION');
            throw Error('EXPECTED_ROLLBACK');
        });
    } catch (e) { rollbackMessage = e.message; }
    let state = await prisma.user.findUnique({ where: { id: txTarget.id } });
    const rollbackAuditCount = await prisma.auditLog.count({ where: { entityId: txTarget.id, action: 'USER_SUSPENDED' } });
    record('T01', 'Outer rollback preserves account, audit and established connection', { rollback: 'EXPECTED_ROLLBACK', active: true, version: 0, revokeCalls: 0, audits: 0, socketOpen: true }, { rollback: rollbackMessage, active: state.isActive, version: state.tokenVersion, revokeCalls: calls.length, audits: rollbackAuditCount, socketOpen: txSocket.socket.readyState === WS.OPEN }, rollbackMessage === 'EXPECTED_ROLLBACK' && state.isActive && state.tokenVersion === 0 && calls.length === 0 && rollbackAuditCount === 0 && txSocket.socket.readyState === WS.OPEN);
    let rawError;
    try { await prisma.$transaction(tx => staff.suspendUser(admin, txTarget.id, { reason: 'Unsupported raw transaction' }, tx)); } catch (e) { rawError = e.code; }
    state = await prisma.user.findUnique({ where: { id: txTarget.id } });
    record('T02', 'Unsupported outer transaction rejects before mutation', { code: 'UNSUPPORTED_TRANSACTION_CONTRACT', active: true, version: 0 }, { code: rawError, active: state.isActive, version: state.tokenVersion }, rawError === 'UNSUPPORTED_TRANSACTION_CONTRACT' && state.isActive && state.tokenVersion === 0);
    let premature = false;
    await staff.withTransaction(async tx => {
        await staff.suspendUser(admin, txTarget.id, { reason: 'Fictional committed transaction' }, tx);
        premature = calls.includes(txTarget.id) || txSocket.socket.readyState !== WS.OPEN;
    });
    await pause();
    state = await prisma.user.findUnique({ where: { id: txTarget.id } });
    record('T03', 'Successful outer commit revokes exactly once after transaction callback', { premature: false, active: false, version: 1, revokeCalls: 1, socketOpen: false }, { premature, active: state.isActive, version: state.tokenVersion, revokeCalls: calls.filter(id => id === txTarget.id).length, socketOpen: txSocket.socket.readyState === WS.OPEN }, !premature && !state.isActive && state.tokenVersion === 1 && calls.filter(id => id === txTarget.id).length === 1 && txSocket.socket.readyState !== WS.OPEN);
    wsServer.revokeUserSockets = originalRevoke;
    await prisma.user.update({ where: { id: resetTarget.id }, data: { mustChangePassword: true } });
    const resetHttp = await call(resetTarget, 'get', '/api/labs');
    const resetSis = await call(resetTarget, 'get', '/api/v1/sis/samples');
    const resetSocket = await connect(token(resetTarget));
    record('S01', 'Pending password change blocks operational HTTP, SIS and socket access', { http: 403, sisDenied: true, socketConnected: false }, { http: resetHttp.status, sis: resetSis.status, socketConnected: resetSocket.connected }, resetHttp.status === 403 && [401, 403].includes(resetSis.status) && !resetSocket.connected);
    const supportToken = jwt.sign({ id: target.id, username: target.username, role: target.role, tokenVersion: target.tokenVersion, act: { id: actor.id, username: actor.username, tokenVersion: actor.tokenVersion } }, process.env.JWT_SECRET, { expiresIn: '30m' });
    const supportSocket = await connect(supportToken);
    const validSupport = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + supportToken);
    record('C02', 'Authorized impersonation starts before actor suspension', { http: 200, socketConnected: true }, { http: validSupport.status, socketConnected: supportSocket.connected }, validSupport.status === 200 && supportSocket.connected);
    let receivedAfterActorSuspended = false;
    supportSocket.socket.on('message', m => { if (JSON.parse(m).type === 'COVER_ACTOR_PING') receivedAfterActorSuspended = true; });
    const suspended = await call(admin, 'post', '/api/users/' + actor.id + '/suspend', { reason: 'Fictional support actor suspension' });
    wsServer.broadcastToLab('COVER-LAB', 'COVER_ACTOR_PING', { fictional: true });
    await pause();
    const revokedHttp = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + supportToken);
    const revokedSis = await request(app).get('/api/v1/sis/samples').set('Authorization', 'Bearer ' + supportToken);
    const revokedSocket = await connect(supportToken);
    record('S02', 'Suspended impersonating administrator invalidates support token on every channel', { suspension: 200, httpDenied: true, sisDenied: true, newSocketConnected: false }, { suspension: suspended.status, http: revokedHttp.status, sis: revokedSis.status, newSocketConnected: revokedSocket.connected }, suspended.status === 200 && [401, 403].includes(revokedHttp.status) && [401, 403].includes(revokedSis.status) && !revokedSocket.connected);
    record('S03', 'Actor suspension closes already established impersonation socket', { socketOpen: false, receivedAfterActorSuspended: false }, { socketOpen: supportSocket.socket.readyState === WS.OPEN, receivedAfterActorSuspended }, supportSocket.socket.readyState !== WS.OPEN && !receivedAfterActorSuspended);
    await prisma.user.createMany({ data: Array.from({ length: 205 }, (_, i) => ({ id: 'cover-roster-' + i, username: 'cover_roster_' + i, email: 'cover-roster-' + i + '@example.invalid', password: 'FICTIONAL_TEST_HASH', role: 'LAB_TECHNICIAN', labId: 'COVER-LAB', isActive: true })) });
    const roster = await call(admin, 'get', '/api/labs/COVER-LAB/workspace?page=1&limit=20');
    record('P01', 'Workspace staff collection is bounded for a 200-plus-person roster', { http: 200, returnedAtMost: 100, paginationMetadata: true }, { http: roster.status, returned: roster.body.staff?.length, paginationMetadata: !!(roster.body.pagination || roster.body.staffPagination) }, roster.status === 200 && Array.isArray(roster.body.staff) && roster.body.staff.length <= 100 && !!(roster.body.pagination || roster.body.staffPagination));
    for (const socket of sockets) socket.terminate();
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
    const report = { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), timestamp: new Date().toISOString(), database: dbPath, schemaSource: 'Read-only SQL schema; fictional fixtures only', sourceHashBefore, sourceHashAfter: hash(sourcePath), results };
    fs.writeFileSync(path.join(outputDir, 'session-and-coverage-results.json'), JSON.stringify(report, null, 2));
    print(JSON.stringify(report, null, 2));
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
`;
const fixtureModule = new Module(bootstrapPath, module);
fixtureModule.filename = bootstrapPath;
fixtureModule.paths = Module._nodeModulePaths(__dirname);
fixtureModule._compile(bootstrap + probeBody, bootstrapPath);

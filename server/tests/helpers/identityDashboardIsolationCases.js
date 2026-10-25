const cases = [];
function add(key, path, body, query, globalReason) { cases.push({ key, path, ...(body && { body }), ...(query && { query }), ...(globalReason && { globalReason }) }); }
const self = 'Identity endpoint is bound to the verified current principal, not a caller-selected laboratory or user.';
add('GET /api/auth/me', '/api/auth/me', null, null, self);
add('PATCH /api/auth/preferences', '/api/auth/preferences', { language: 'en' }, null, self);
add('PATCH /api/auth/profile', '/api/auth/profile', { name: 'Synthetic current profile' }, null, self);
add('POST /api/auth/refresh', '/api/auth/refresh', {}, null, self);
add('GET /api/auth/bench', '/api/auth/bench', null, null, self);
add('PUT /api/auth/bench/pin', '/api/auth/bench/pin', { password: 'Public-wrong-test-password', pin: '123456' }, null, self);
cases.push({ key: 'POST /api/auth/bench/pin/verify', path: '/api/auth/bench/pin/verify', body: { pin: '123456' },
    protocolRefusal: { status: 409, code: 'BENCH_PIN_NOT_SET' }, globalReason: self + ' The actual new fixture has no PIN; the documented refusal is409.' });
cases.push({ key: 'POST /api/auth/change-password', path: '/api/auth/change-password',
    body: { currentPassword: 'Public-wrong-test-password', newPassword: 'Public-new-test-password-336' }, expectedStatus: 400,
    globalReason: self + ' A wrong current password is refused; no credential is changed.' });
add('POST /api/auth/impersonate', '/api/auth/impersonate', { userId: '{managerIdA}' });
cases.push({ key: 'POST /api/auth/login', path: '/api/auth/login',
    body: { username: 'synthetic-nonexistent-login-336', password: 'Public-wrong-test-password' }, expectedStatus: 401,
    globalReason: 'Public credential authentication, without an authenticated laboratory scope; valid credential-shaped input receives the generic rejection.' });
for (const [key, path, body] of [
    ['GET /api/auth/invitation/:token', '/api/auth/invitation/{invitationA}', null],
    ['GET /api/auth/recovery/:token', '/api/auth/recovery/{recoveryA}', null],
    ['POST /api/auth/activate', '/api/auth/activate', { token: '{invitationA}', password: 'Public-new-test-password-336' }],
    ['POST /api/auth/reset-password-grant', '/api/auth/reset-password-grant', { token: '{recoveryA}', password: 'Public-new-test-password-336' }],
]) cases.push({ key, path, ...(body && { body }), expectedStatus: 404,
    globalReason: 'Public capability workflow. A real private row ID is not its secret bearer capability and cannot inspect, consume or change that row.' });

add('GET /api/access/assignable-roles', '/api/access/assignable-roles', null, { labId: '{labA}' });
add('GET /api/access/project-membership-report', '/api/access/project-membership-report', null, { labId: '{labA}', projectId: '{projectA}' });
add('GET /api/access/capabilities', '/api/access/capabilities', null, null, 'Global public role and permission names; no laboratory entities or operational data.');
for (const route of ['home', 'qa', 'live']) add(`GET /api/dashboard/${route}`, `/api/dashboard/${route}`, null, { labId: '{labA}', projectId: '{projectA}' });
cases.push({ key: 'GET /api/dashboard/stats', path: '/api/dashboard/stats', query: { projectId: '{projectA}' }, emptyDashboard: true });
for (const queue of ['manager.review', 'manager.exceptions', 'bench.toSubmit']) cases.push({ key: 'GET /api/dashboard/queues/:queueKey',
    path: `/api/dashboard/queues/${queue}`, variant: queue, query: { labId: '{labA}', projectId: '{projectA}' } });
add('GET /api/audit-final', '/api/audit-final');
module.exports = cases;

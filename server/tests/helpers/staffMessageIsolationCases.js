const cases = [];
function add(key, path, body, query) { cases.push({ key, path, ...(body && { body }), ...(query && { query }) }); }
add('GET /api/users', '/api/users', null, { labId: '{labA}' });
add('GET /api/users/directory', '/api/users/directory', null, { labId: '{labA}' });
add('POST /api/users', '/api/users', { username: 'synthetic-foreign-target-336', password: 'Public-synthetic-test-password-336',
    role: 'LAB_TECHNICIAN', name: 'Synthetic target', email: 'synthetic-target@example.test', labId: '{labA}' });
add('PUT /api/users/:id', '/api/users/{managerIdA}', { name: 'Synthetic changed foreign name' });
add('DELETE /api/users/:id', '/api/users/{managerIdA}', { reason: 'Synthetic removal' });
add('POST /api/users/:id/access-preview', '/api/users/{managerIdA}/access-preview', { labId: '{labB}', role: 'LAB_TECHNICIAN' });
add('PATCH /api/users/:id/access', '/api/users/{managerIdA}/access', { changes: { labId: '{labB}', role: 'LAB_TECHNICIAN' }, reason: 'Synthetic access change' });
add('POST /api/users/:id/suspend', '/api/users/{managerIdA}/suspend', { reason: 'Synthetic suspension' });
add('POST /api/users/:id/reactivate', '/api/users/{managerIdA}/reactivate', { reason: 'Synthetic reactivation' });
add('POST /api/users/:id/recovery', '/api/users/{managerIdA}/recovery', { reason: 'Synthetic recovery' });
for (const mount of ['users', 'staff']) {
    add(`GET /api/${mount}/invitations`, `/api/${mount}/invitations`, null, { labId: '{labA}' });
    add(`POST /api/${mount}/invitations`, `/api/${mount}/invitations`, { labId: '{labA}', role: 'LAB_TECHNICIAN',
        name: 'Synthetic foreign invitation', email: 'synthetic-foreign-invite@example.test' });
    for (const action of ['reissue', 'revoke']) add(`POST /api/${mount}/invitations/:id/${action}`,
        `/api/${mount}/invitations/{invitationA}/${action}`, { reason: 'Synthetic invitation change' });
    add(`DELETE /api/${mount}/invitations/:id`, `/api/${mount}/invitations/{invitationA}`, { reason: 'Synthetic invitation removal' });
}

add('GET /api/messages', '/api/messages', null, { folder: 'INBOX', userId: '{managerIdA}' });
add('GET /api/messages/conversations', '/api/messages/conversations');
add('GET /api/messages/thread/:userId', '/api/messages/thread/{managerIdA}');
add('POST /api/messages/draft', '/api/messages/draft', { id: '{messageA}', toUserId: '{managerIdB}', subject: 'Synthetic changed subject', body: 'Synthetic changed private draft' });
add('POST /api/messages/send', '/api/messages/send', { draftId: '{messageDraftA}', toUserId: '{managerIdB}', subject: 'Synthetic message', body: 'Synthetic private-draft redemption' });
cases.push({ key: 'POST /api/messages/send', path: '/api/messages/send', variant: 'foreign direct recipient', mustDeny: true,
    body: { toUserId: '{managerIdA}', subject: 'Synthetic foreign direct message', body: 'Synthetic foreign delivery' } });
cases.push({ key: 'POST /api/messages/send', path: '/api/messages/send', variant: 'foreign chat recipient', mustDeny: true,
    body: { toUserId: '{managerIdA}', isChat: true, body: 'Synthetic foreign chat delivery' } });
cases.push({ key: 'POST /api/messages/send', path: '/api/messages/send', variant: 'broadcast laboratory boundary',
    body: { toUserId: 'BROADCAST', subject: 'Synthetic broadcast', body: 'Synthetic broadcast delivery' } });
add('POST /api/messages/read', '/api/messages/read', { id: '{receivedMessageA}' });
add('POST /api/messages/move', '/api/messages/move', { id: '{receivedMessageA}', targetFolder: 'TRASH', scope: 'recipient' });
add('GET /api/notifications', '/api/notifications', null, { userId: '{managerIdA}' });
add('POST /api/notifications/mark-read', '/api/notifications/mark-read', { id: '{notificationA}' });
add('POST /api/notifications/mark-all-read', '/api/notifications/mark-all-read', {});
add('POST /api/notifications/clear-all', '/api/notifications/clear-all', {});
cases.push({ key: 'POST /api/notifications/send', path: '/api/notifications/send', mustDeny: true,
    body: { toUserId: '{managerIdA}', message: 'Synthetic foreign personal notification' } });
module.exports = cases;
